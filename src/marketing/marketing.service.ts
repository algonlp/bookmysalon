import { randomUUID } from 'crypto';
import { HttpError } from '../shared/errors/httpError';
import { clientPlatformRepository } from '../platform/clientPlatform.repository';
import type { ClientRecord } from '../platform/clientPlatform.types';
import { appointmentRepository } from '../appointments/appointment.repository';
import type { AppointmentRecord } from '../appointments/appointment.types';
import { customerAccountRepository } from '../customers/customerAccount.repository';
import { twilioSmsService } from '../notifications/twilioSms.service';
import { emailService } from '../notifications/email.service';
import { billingService } from '../billing/billing.service';
import { marketingRepository } from './marketing.repository';
import { defaultCampaignTemplates } from './marketingTemplates.defaults';
import { buildDedupeKey, normalizeContactEmail, normalizeContactPhone } from './marketingRecipients.util';
import type {
  CampaignChannel,
  CampaignRecipientOrigin,
  CampaignRecipientRecord,
  CampaignRecipientSource,
  CampaignRecord,
  CampaignStatus,
  CampaignTemplateRecord,
  CampaignTemplateType,
  CampaignWithStats,
  CreateCampaignInput,
  CsvContactRow,
  RecipientPreview
} from './marketing.types';

const MARKETING_FEATURE_KEY = 'marketing';
const SEND_BATCH_SIZE = 8;
const SEND_BATCH_DELAY_MS = 300;
const RANDOM_BATCH_SIZE = 20;
const LAST_MINUTE_FILL_WINDOW_HOURS = 6;
const DEFAULT_LAST_MINUTE_FILL_DISCOUNT_PERCENT = 20;

interface MergedRecipient {
  name: string;
  phone: string;
  email: string;
  origin: CampaignRecipientOrigin;
  customerProfileId?: string;
}

const getClientOrThrow = async (businessId: string): Promise<ClientRecord> => {
  const client = await clientPlatformRepository.getClientById(businessId);

  if (!client) {
    throw new HttpError(404, 'Business was not found');
  }

  return client;
};

const getCampaignOrThrow = async (businessId: string, campaignId: string): Promise<CampaignRecord> => {
  const campaign = await marketingRepository.getCampaignById(businessId, campaignId);

  if (!campaign) {
    throw new HttpError(404, 'Campaign was not found');
  }

  return campaign;
};

const assertMarketingFeatureUnlocked = async (businessId: string): Promise<void> => {
  const overview = await billingService.getBillingOverview(businessId);

  if (overview.lockedFeatureKeys.includes(MARKETING_FEATURE_KEY)) {
    throw new HttpError(403, 'Marketing campaigns require a Solo or Team Premium plan');
  }
};

const formatPriceCents = (cents: number | undefined, currencyCode: string): string => {
  const amount = (cents ?? 0) / 100;
  const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return currencyCode ? `${currencyCode} ${formatted}` : formatted;
};

const formatDiscountLabel = (campaign: CampaignRecord): string => {
  if (campaign.templateType === 'free_service') {
    return 'a free service';
  }

  if (typeof campaign.discountPercent === 'number' && campaign.discountPercent > 0) {
    return `${campaign.discountPercent}%`;
  }

  if (typeof campaign.discountAmountCents === 'number' && campaign.discountAmountCents > 0) {
    return formatPriceCents(campaign.discountAmountCents, campaign.currencyCode);
  }

  return '';
};

const renderPlaceholders = (template: string, values: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

const buildMergedRecipients = (
  client: ClientRecord,
  recipientSource: CampaignRecipientSource,
  csvContacts: CsvContactRow[]
): MergedRecipient[] => {
  const merged = new Map<string, MergedRecipient>();

  if (recipientSource === 'random_batch') {
    const eligible: MergedRecipient[] = [];

    for (const profile of client.customerProfiles) {
      const phone = normalizeContactPhone(profile.customerPhone);
      const email = normalizeContactEmail(profile.customerEmail);

      if (!phone && !email) {
        continue;
      }

      eligible.push({
        name: profile.customerName,
        phone,
        email,
        origin: 'existing_client',
        customerProfileId: profile.id
      });
    }

    return shuffle(eligible).slice(0, RANDOM_BATCH_SIZE);
  }

  if (recipientSource === 'existing_clients' || recipientSource === 'both') {
    for (const profile of client.customerProfiles) {
      const phone = normalizeContactPhone(profile.customerPhone);
      const email = normalizeContactEmail(profile.customerEmail);

      if (!phone && !email) {
        continue;
      }

      merged.set(buildDedupeKey(phone, email), {
        name: profile.customerName,
        phone,
        email,
        origin: 'existing_client',
        customerProfileId: profile.id
      });
    }
  }

  if (recipientSource === 'csv_upload' || recipientSource === 'both') {
    for (const contact of csvContacts) {
      const phone = normalizeContactPhone(contact.phone);
      const email = normalizeContactEmail(contact.email);

      if (!phone && !email) {
        continue;
      }

      const key = buildDedupeKey(phone, email);
      const existing = merged.get(key);

      merged.set(key, {
        name: contact.name || existing?.name || '',
        phone,
        email,
        origin: 'csv_upload',
        customerProfileId: existing?.customerProfileId
      });
    }
  }

  return [...merged.values()];
};

const isChannelRelevant = (channel: CampaignChannel, target: 'sms' | 'email'): boolean =>
  channel === target || channel === 'both';

const isOptedOutOfSms = async (phone: string): Promise<boolean> => {
  if (!phone) {
    return false;
  }

  const account = await customerAccountRepository.getCustomerByPhone(phone);
  return account ? account.notifications.marketingTextMessage === false : false;
};

const isOptedOutOfEmail = async (email: string): Promise<boolean> => {
  if (!email) {
    return false;
  }

  const account = await customerAccountRepository.getCustomerByEmail(email);
  return account ? account.notifications.marketingEmail === false : false;
};

const dispatchSingleRecipient = async (
  client: ClientRecord,
  campaign: CampaignRecord,
  recipient: CampaignRecipientRecord
): Promise<void> => {
  const placeholderValues: Record<string, string> = {
    customerName: recipient.customerName || 'there',
    businessName: client.businessName || 'us',
    discountLabel: formatDiscountLabel(campaign),
    serviceName:
      (campaign.templateType === 'free_service' ? campaign.freeServiceName : campaign.targetServiceName) ||
      'your next visit',
    bookingLink: campaign.bookingLink,
    startTime: campaign.happyHourStartTime ?? '',
    endTime: campaign.happyHourEndTime ?? '',
    offerName: campaign.offerName || 'Happy Hour',
    originalPrice: formatPriceCents(campaign.originalPriceCents, campaign.currencyCode),
    discountedPrice: formatPriceCents(campaign.discountedPriceCents, campaign.currencyCode),
    slotTime: campaign.fillSlotTime ?? '',
    seatsLeft: '1'
  };

  let smsStatus = recipient.smsStatus;
  let smsReason = recipient.smsReason;
  let smsMessageId = recipient.smsMessageId;
  let emailStatus = recipient.emailStatus;
  let emailReason = recipient.emailReason;

  if (isChannelRelevant(campaign.channel, 'sms')) {
    if (!recipient.customerPhone) {
      smsStatus = 'skipped';
      smsReason = 'No phone number on file';
    } else if (await isOptedOutOfSms(recipient.customerPhone)) {
      smsStatus = 'skipped';
      smsReason = 'Customer opted out of marketing text messages';
    } else if (!(await billingService.consumeMessageCredit(campaign.businessId))) {
      smsStatus = 'skipped';
      smsReason = 'No message credits remaining on your plan';
    } else {
      const body = renderPlaceholders(campaign.smsBody, placeholderValues);
      const result = await twilioSmsService.sendSms(recipient.customerPhone, body, 'customer', {
        businessId: campaign.businessId,
        source: 'marketing_campaign'
      });
      smsStatus = result.status;
      smsReason = result.reason ?? '';
      smsMessageId = result.messageId ?? '';
    }
  }

  if (isChannelRelevant(campaign.channel, 'email')) {
    if (!recipient.customerEmail) {
      emailStatus = 'skipped';
      emailReason = 'No email address on file';
    } else if (await isOptedOutOfEmail(recipient.customerEmail)) {
      emailStatus = 'skipped';
      emailReason = 'Customer opted out of marketing email';
    } else if (!(await billingService.consumeMarketingEmailCredit(campaign.businessId))) {
      emailStatus = 'skipped';
      emailReason = 'No email credits remaining on your plan';
    } else {
      const subject = renderPlaceholders(campaign.emailSubject, placeholderValues);
      const bodyText = renderPlaceholders(campaign.emailBodyText, placeholderValues);
      const result = await emailService.sendEmail(
        {
          to: recipient.customerEmail,
          subject,
          text: bodyText,
          html: `<p>${bodyText.replace(/\n/g, '<br />')}</p>`
        },
        'customer',
        { businessId: campaign.businessId, source: 'marketing_campaign' }
      );
      emailStatus = result.status;
      emailReason = result.reason ?? '';
    }
  }

  await marketingRepository.updateRecipient({
    ...recipient,
    smsStatus,
    smsReason,
    smsMessageId,
    emailStatus,
    emailReason,
    updatedAt: new Date().toISOString()
  });
};

const classifyRecipientOutcome = (
  campaign: CampaignRecord,
  recipient: CampaignRecipientRecord
): 'sent' | 'failed' | 'skipped' => {
  const relevantStatuses = [
    isChannelRelevant(campaign.channel, 'sms') ? recipient.smsStatus : null,
    isChannelRelevant(campaign.channel, 'email') ? recipient.emailStatus : null
  ].filter((status): status is NonNullable<typeof status> => status !== null);

  if (relevantStatuses.some((status) => status === 'sent')) {
    return 'sent';
  }

  if (relevantStatuses.every((status) => status === 'skipped' || status === 'not_applicable')) {
    return 'skipped';
  }

  return 'failed';
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const dispatchRecipients = async (
  client: ClientRecord,
  campaign: CampaignRecord,
  recipients: CampaignRecipientRecord[]
): Promise<void> => {
  const batches = chunk(recipients, SEND_BATCH_SIZE);

  for (const batch of batches) {
    await Promise.allSettled(batch.map((recipient) => dispatchSingleRecipient(client, campaign, recipient)));
    await delay(SEND_BATCH_DELAY_MS);
  }

  const finalRecipients = await marketingRepository.listRecipientsByCampaignId(campaign.id);
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const recipient of finalRecipients) {
    const outcome = classifyRecipientOutcome(campaign, recipient);

    if (outcome === 'sent') {
      sentCount += 1;
    } else if (outcome === 'failed') {
      failedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  const status: CampaignStatus = sentCount === finalRecipients.length
    ? 'sent'
    : sentCount > 0
      ? 'partially_sent'
      : 'failed';

  await marketingRepository.updateCampaign({
    ...campaign,
    status,
    recipientsSent: sentCount,
    recipientsFailed: failedCount,
    recipientsSkipped: skippedCount,
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
};

export const marketingService = {
  async getEffectiveTemplate(
    businessId: string,
    templateType: CampaignTemplateType
  ): Promise<{ smsBody: string; emailSubject: string; emailBodyText: string }> {
    const saved = await marketingRepository.getTemplate(businessId, templateType);
    return saved ?? defaultCampaignTemplates[templateType];
  },

  async updateTemplate(
    businessId: string,
    templateType: CampaignTemplateType,
    patch: {
      smsBody?: string;
      emailSubject?: string;
      emailBodyText?: string;
      defaultDiscountPercent?: number;
    }
  ): Promise<CampaignTemplateRecord> {
    await assertMarketingFeatureUnlocked(businessId);
    const existing = await marketingRepository.getTemplate(businessId, templateType);
    const seed = defaultCampaignTemplates[templateType];
    const now = new Date().toISOString();

    const record: CampaignTemplateRecord = {
      id: existing?.id ?? randomUUID(),
      businessId,
      templateType,
      smsBody: patch.smsBody?.trim() || existing?.smsBody || seed.smsBody,
      emailSubject: patch.emailSubject?.trim() || existing?.emailSubject || seed.emailSubject,
      emailBodyText: patch.emailBodyText?.trim() || existing?.emailBodyText || seed.emailBodyText,
      defaultDiscountPercent:
        patch.defaultDiscountPercent ??
        existing?.defaultDiscountPercent ??
        (templateType === 'last_minute_fill' ? DEFAULT_LAST_MINUTE_FILL_DISCOUNT_PERCENT : undefined),
      updatedAt: now
    };

    return marketingRepository.upsertTemplate(record);
  },

  async createCampaign(businessId: string, input: CreateCampaignInput, origin: string): Promise<CampaignRecord> {
    await assertMarketingFeatureUnlocked(businessId);
    const client = await getClientOrThrow(businessId);

    let targetServiceName = '';
    let freeServiceName = '';

    if (input.templateType === 'free_service') {
      if (!input.freeServiceId) {
        throw new HttpError(400, 'Select a service to give away for free');
      }

      const service = client.services.find((entry) => entry.id === input.freeServiceId && entry.isActive);

      if (!service) {
        throw new HttpError(400, 'Selected free service is not available');
      }

      freeServiceName = service.name;
    } else if (input.targetServiceId) {
      const service = client.services.find((entry) => entry.id === input.targetServiceId && entry.isActive);

      if (!service) {
        throw new HttpError(400, 'Selected service is not available');
      }

      targetServiceName = service.name;
    }

    if (input.templateType === 'percent_off' || input.templateType === 'last_minute_fill') {
      if (!input.discountPercent || input.discountPercent <= 0 || input.discountPercent > 100) {
        throw new HttpError(400, 'Enter a discount percentage between 1 and 100');
      }
    }

    if (input.templateType === 'flat_amount_off') {
      if (!input.discountAmountCents || input.discountAmountCents <= 0) {
        throw new HttpError(400, 'Enter a discount amount greater than zero');
      }
    }

    if (input.templateType === 'happy_hour') {
      if (!input.targetServiceId) {
        throw new HttpError(400, 'Select a service for this happy hour offer');
      }

      if (!input.happyHourStartTime || !input.happyHourEndTime) {
        throw new HttpError(400, 'Enter a start and end time for this happy hour offer');
      }

      if (!input.originalPriceCents || !input.discountedPriceCents || input.originalPriceCents <= 0) {
        throw new HttpError(400, 'Enter the original and discounted price for this offer');
      }

      if (input.discountedPriceCents >= input.originalPriceCents) {
        throw new HttpError(400, 'The discounted price must be lower than the original price');
      }
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const bookingLink = `${origin}/book/${encodeURIComponent(businessId)}?campaign=${id}`;

    const campaign: CampaignRecord = {
      id,
      businessId,
      name: input.name.trim() || 'Untitled campaign',
      templateType: input.templateType,
      discountPercent:
        input.templateType === 'percent_off' || input.templateType === 'last_minute_fill'
          ? input.discountPercent
          : undefined,
      discountAmountCents: input.templateType === 'flat_amount_off' ? input.discountAmountCents : undefined,
      currencyCode: input.currencyCode?.trim() ?? '',
      targetServiceId: input.templateType !== 'free_service' ? input.targetServiceId : undefined,
      targetServiceName,
      freeServiceId: input.templateType === 'free_service' ? input.freeServiceId : undefined,
      freeServiceName,
      happyHourStartTime: input.templateType === 'happy_hour' ? input.happyHourStartTime : undefined,
      happyHourEndTime: input.templateType === 'happy_hour' ? input.happyHourEndTime : undefined,
      offerName: input.templateType === 'happy_hour' ? input.offerName?.trim() || 'Happy Hour' : '',
      originalPriceCents: input.templateType === 'happy_hour' ? input.originalPriceCents : undefined,
      discountedPriceCents: input.templateType === 'happy_hour' ? input.discountedPriceCents : undefined,
      isAutoGenerated: false,
      smsBody: input.smsBody.trim(),
      emailSubject: input.emailSubject.trim(),
      emailBodyText: input.emailBodyText.trim(),
      channel: input.channel,
      recipientSource: input.recipientSource,
      status: 'draft',
      recipientsTotal: 0,
      recipientsSent: 0,
      recipientsFailed: 0,
      recipientsSkipped: 0,
      linkOpensCount: 0,
      bookingLink,
      createdAt: now,
      updatedAt: now
    };

    return marketingRepository.createCampaign(campaign);
  },

  async previewRecipients(
    businessId: string,
    recipientSource: CampaignRecipientSource,
    csvContacts: CsvContactRow[]
  ): Promise<RecipientPreview> {
    const client = await getClientOrThrow(businessId);
    const merged = buildMergedRecipients(client, recipientSource, csvContacts);

    return {
      recipients: merged
        .slice(0, 20)
        .map((entry) => ({ name: entry.name, phone: entry.phone, email: entry.email, origin: entry.origin })),
      total: merged.length,
      smsEligibleCount: merged.filter((entry) => entry.phone).length,
      emailEligibleCount: merged.filter((entry) => entry.email).length
    };
  },

  async confirmAndDispatchCampaign(
    businessId: string,
    campaignId: string,
    recipientSource: CampaignRecipientSource,
    csvContacts: CsvContactRow[]
  ): Promise<CampaignRecord> {
    await assertMarketingFeatureUnlocked(businessId);
    const campaign = await getCampaignOrThrow(businessId, campaignId);

    if (campaign.status !== 'draft') {
      throw new HttpError(409, 'This campaign has already been sent');
    }

    const client = await getClientOrThrow(businessId);
    const merged = buildMergedRecipients(client, recipientSource, csvContacts);

    if (merged.length === 0) {
      throw new HttpError(400, 'No valid recipients found for this campaign');
    }

    const now = new Date().toISOString();
    const recipientRecords: CampaignRecipientRecord[] = merged.map((entry) => ({
      id: randomUUID(),
      campaignId,
      businessId,
      origin: entry.origin,
      customerProfileId: entry.customerProfileId,
      customerName: entry.name,
      customerPhone: entry.phone,
      customerEmail: entry.email,
      dedupeKey: buildDedupeKey(entry.phone, entry.email),
      smsStatus: 'pending',
      smsReason: '',
      smsMessageId: '',
      emailStatus: 'pending',
      emailReason: '',
      createdAt: now,
      updatedAt: now
    }));

    await marketingRepository.insertRecipients(recipientRecords);

    const sendingCampaign: CampaignRecord = {
      ...campaign,
      recipientSource,
      status: 'sending',
      recipientsTotal: recipientRecords.length,
      updatedAt: now
    };
    await marketingRepository.updateCampaign(sendingCampaign);

    void dispatchRecipients(client, sendingCampaign, recipientRecords).catch(() => {});

    return sendingCampaign;
  },

  async listCampaignRecipients(businessId: string, campaignId: string): Promise<CampaignRecipientRecord[]> {
    await getCampaignOrThrow(businessId, campaignId);
    return marketingRepository.listRecipientsByCampaignId(campaignId);
  },

  async listPendingAutoGeneratedCampaigns(businessId: string): Promise<CampaignRecord[]> {
    const campaigns = await marketingRepository.listCampaignsByBusinessId(businessId);
    return campaigns.filter((campaign) => campaign.isAutoGenerated && campaign.status === 'draft');
  },

  // Called when a booked appointment is cancelled with short notice. Creates a
  // draft "last minute fill" campaign (never auto-sent — the owner still has
  // to confirm from the dashboard) targeting a random batch of existing
  // clients. Silently does nothing if marketing is locked on the business's
  // plan, or the cancellation wasn't actually last-minute.
  async createAutoFillCampaignForCancelledAppointment(
    appointment: AppointmentRecord,
    origin: string
  ): Promise<CampaignRecord | null> {
    try {
      const overview = await billingService.getBillingOverview(appointment.businessId);

      if (overview.lockedFeatureKeys.includes(MARKETING_FEATURE_KEY)) {
        return null;
      }

      const hoursUntilStart = (new Date(appointment.startAt).getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilStart <= 0 || hoursUntilStart > LAST_MINUTE_FILL_WINDOW_HOURS) {
        return null;
      }

      const template = await marketingRepository.getTemplate(appointment.businessId, 'last_minute_fill');
      const seed = defaultCampaignTemplates.last_minute_fill;
      const discountPercent = template?.defaultDiscountPercent ?? DEFAULT_LAST_MINUTE_FILL_DISCOUNT_PERCENT;

      const id = randomUUID();
      const now = new Date().toISOString();
      const bookingLink = `${origin}/book/${encodeURIComponent(appointment.businessId)}?campaign=${id}`;

      const campaign: CampaignRecord = {
        id,
        businessId: appointment.businessId,
        name: `Last-minute fill - ${appointment.serviceName} ${appointment.appointmentTime}`,
        templateType: 'last_minute_fill',
        discountPercent,
        currencyCode: '',
        targetServiceId: appointment.serviceId,
        targetServiceName: appointment.serviceName,
        freeServiceName: '',
        offerName: '',
        fillSlotDate: appointment.appointmentDate,
        fillSlotTime: appointment.appointmentTime,
        isAutoGenerated: true,
        smsBody: template?.smsBody || seed.smsBody,
        emailSubject: template?.emailSubject || seed.emailSubject,
        emailBodyText: template?.emailBodyText || seed.emailBodyText,
        channel: 'both',
        recipientSource: 'random_batch',
        status: 'draft',
        recipientsTotal: 0,
        recipientsSent: 0,
        recipientsFailed: 0,
        recipientsSkipped: 0,
        linkOpensCount: 0,
        bookingLink,
        createdAt: now,
        updatedAt: now
      };

      return await marketingRepository.createCampaign(campaign);
    } catch (_error) {
      return null;
    }
  },

  async getCampaignStats(businessId: string, campaignId: string): Promise<CampaignWithStats> {
    const campaign = await getCampaignOrThrow(businessId, campaignId);
    const appointments = await appointmentRepository.listAppointmentsByBusinessId(businessId);
    const conversionsCount = appointments.filter(
      (appointment) => appointment.campaignId === campaignId && appointment.status !== 'cancelled'
    ).length;

    return { ...campaign, conversionsCount };
  },

  async listCampaignsWithStats(businessId: string): Promise<CampaignWithStats[]> {
    const [campaigns, appointments] = await Promise.all([
      marketingRepository.listCampaignsByBusinessId(businessId),
      appointmentRepository.listAppointmentsByBusinessId(businessId)
    ]);

    const conversionCounts = new Map<string, number>();

    for (const appointment of appointments) {
      if (!appointment.campaignId || appointment.status === 'cancelled') {
        continue;
      }

      conversionCounts.set(appointment.campaignId, (conversionCounts.get(appointment.campaignId) ?? 0) + 1);
    }

    return campaigns.map((campaign) => ({
      ...campaign,
      conversionsCount: conversionCounts.get(campaign.id) ?? 0
    }));
  },

  async recordConversionForAppointment(appointment: AppointmentRecord): Promise<void> {
    if (!appointment.campaignId) {
      return;
    }

    try {
      const matches = await marketingRepository.findRecipientsByBusinessAndContact(
        appointment.businessId,
        appointment.campaignId,
        normalizeContactPhone(appointment.customerPhone),
        normalizeContactEmail(appointment.customerEmail)
      );
      const target = matches.find((match) => !match.convertedAppointmentId) ?? matches[0];

      if (!target) {
        return;
      }

      await marketingRepository.updateRecipient({
        ...target,
        convertedAppointmentId: appointment.id,
        convertedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (_error) {
      // Best-effort side-write only — the dashboard's conversion count always
      // comes from listCampaignsWithStats/getCampaignStats reading appointments
      // directly, so a failure here never affects what the owner sees.
    }
  },

  async recordLinkOpen(campaignId: string): Promise<void> {
    if (!campaignId) {
      return;
    }

    try {
      await marketingRepository.incrementLinkOpens(campaignId);
    } catch (_error) {
      // Best-effort analytics counter — a failure here should never break the
      // public booking page for the visitor.
    }
  }
};
