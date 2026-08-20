import { randomUUID } from 'crypto';
import { HttpError } from '../shared/errors/httpError';
import { clientPlatformRepository } from '../platform/clientPlatform.repository';
import type { ClientRecord } from '../platform/clientPlatform.types';
import { appointmentRepository } from '../appointments/appointment.repository';
import type { AppointmentRecord } from '../appointments/appointment.types';
import { customerAccountRepository } from '../customers/customerAccount.repository';
import { twilioSmsService } from '../notifications/twilioSms.service';
import { whatsappService, toWhatsappButtonSuffix as sharedToWhatsappButtonSuffix } from '../notifications/whatsapp.service';
import { whatsappTemplates } from '../notifications/whatsappTemplates';
import { emailService } from '../notifications/email.service';
import { renderMarketingEmail } from '../notifications/emailTemplate';
import { env } from '../config/env';
import { billingService } from '../billing/billing.service';
import { walletService } from '../wallet/wallet.service';
import { platformSettingsService } from '../platform/platformSettings.service';
import type { CampaignCostPreview } from '../wallet/wallet.types';
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

// Big, punchy badge shown in the promotional email hero (e.g. "PKR 500 OFF").
const buildOfferBadge = (campaign: CampaignRecord): string => {
  switch (campaign.templateType) {
    case 'free_service':
      return 'Free service';
    case 'percent_off':
      return campaign.discountPercent ? `${campaign.discountPercent}% OFF` : 'Special offer';
    case 'flat_amount_off':
      return campaign.discountAmountCents
        ? `${formatPriceCents(campaign.discountAmountCents, campaign.currencyCode)} OFF`
        : 'Special offer';
    case 'happy_hour':
      return 'Happy hour';
    case 'last_minute_fill':
      return campaign.offerName?.trim() || 'Limited offer';
    default:
      return campaign.offerName?.trim() || 'Special offer';
  }
};

const escapeEmailText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

const isChannelRelevant = (channel: CampaignChannel, target: 'sms' | 'email' | 'whatsapp'): boolean => {
  if (target === 'sms') {
    return channel === 'sms' || channel === 'both' || channel === 'all';
  }

  if (target === 'email') {
    return channel === 'email' || channel === 'both' || channel === 'all';
  }

  return channel === 'whatsapp' || channel === 'all';
};

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

const isOptedOutOfWhatsapp = async (phone: string): Promise<boolean> => {
  if (!phone) {
    return false;
  }

  const account = await customerAccountRepository.getCustomerByPhone(phone);
  return account ? account.notifications.marketingWhatsapp === false : false;
};

const toWhatsappButtonSuffix = (fullUrl: string): string =>
  sharedToWhatsappButtonSuffix(fullUrl, env.PUBLIC_BASE_URL ?? '');

const whatsappTemplateNameByType: Record<CampaignTemplateType, string> = {
  percent_off: whatsappTemplates.promoPercentOff,
  flat_amount_off: whatsappTemplates.promoFlatAmountOff,
  free_service: whatsappTemplates.promoFreeService,
  custom_offer: whatsappTemplates.promoCustomOffer,
  happy_hour: whatsappTemplates.promoHappyHour,
  last_minute_fill: whatsappTemplates.promoLastMinuteFill
};

const buildWhatsappBodyParams = (
  templateType: CampaignTemplateType,
  values: Record<string, string>
): string[] => {
  switch (templateType) {
    case 'percent_off':
      return [values.customerName, values.businessName, values.discountLabel, values.serviceName];
    case 'flat_amount_off':
      return [values.customerName, values.discountLabel, values.serviceName, values.businessName];
    case 'free_service':
      return [values.customerName, values.businessName, values.serviceName];
    case 'custom_offer':
      return [values.customerName, values.businessName, values.offerName, values.serviceName];
    case 'happy_hour':
      return [
        values.startTime,
        values.endTime,
        values.offerName,
        values.serviceName,
        values.discountedPrice,
        values.originalPrice,
        values.businessName
      ];
    case 'last_minute_fill':
      return [values.slotTime, values.businessName, values.discountLabel, values.serviceName, values.seatsLeft];
    default:
      return [];
  }
};

const buildPlaceholderValues = (
  client: ClientRecord,
  campaign: CampaignRecord,
  recipientName: string,
  recipientId?: string
): Record<string, string> => ({
  customerName: recipientName || 'there',
  businessName: client.businessName || 'us',
  discountLabel: formatDiscountLabel(campaign),
  serviceName:
    (campaign.templateType === 'free_service' ? campaign.freeServiceName : campaign.targetServiceName) ||
    'your next visit',
  // Per-recipient link so we can record who opened it.
  bookingLink: recipientId ? `${campaign.bookingLink}&r=${encodeURIComponent(recipientId)}` : campaign.bookingLink,
  startTime: campaign.happyHourStartTime ?? '',
  endTime: campaign.happyHourEndTime ?? '',
  offerName: campaign.offerName || 'Happy Hour',
  originalPrice: formatPriceCents(campaign.originalPriceCents, campaign.currencyCode),
  discountedPrice: formatPriceCents(campaign.discountedPriceCents, campaign.currencyCode),
  slotTime: campaign.fillSlotTime ?? '',
  seatsLeft: '1'
});

const dispatchSingleRecipient = async (
  client: ClientRecord,
  campaign: CampaignRecord,
  recipient: CampaignRecipientRecord
): Promise<void> => {
  const placeholderValues = buildPlaceholderValues(client, campaign, recipient.customerName, recipient.id);

  let smsStatus = recipient.smsStatus;
  let smsReason = recipient.smsReason;
  let smsMessageId = recipient.smsMessageId;
  let emailStatus = recipient.emailStatus;
  let emailReason = recipient.emailReason;
  let whatsappStatus = recipient.whatsappStatus;
  let whatsappReason = recipient.whatsappReason;
  let whatsappMessageId = recipient.whatsappMessageId;

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

  if (isChannelRelevant(campaign.channel, 'whatsapp')) {
    if (!recipient.customerPhone) {
      whatsappStatus = 'skipped';
      whatsappReason = 'No phone number on file';
    } else if (await isOptedOutOfWhatsapp(recipient.customerPhone)) {
      whatsappStatus = 'skipped';
      whatsappReason = 'Customer opted out of marketing WhatsApp messages';
    } else if (!(await billingService.consumeMessageCredit(campaign.businessId))) {
      whatsappStatus = 'skipped';
      whatsappReason = 'No message credits remaining on your plan';
    } else {
      const result = await whatsappService.sendTemplate(
        recipient.customerPhone,
        {
          templateName: whatsappTemplateNameByType[campaign.templateType],
          bodyParams: buildWhatsappBodyParams(campaign.templateType, placeholderValues),
          buttonUrlParam: toWhatsappButtonSuffix(placeholderValues.bookingLink)
        },
        'customer',
        { businessId: campaign.businessId, source: 'marketing_campaign' }
      );
      whatsappStatus = result.status;
      whatsappReason = result.reason ?? '';
      whatsappMessageId = result.messageId ?? '';
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
      const bookingLink = placeholderValues.bookingLink;

      // Strip the raw booking URL from the message body — the styled CTA button
      // carries the link in the promotional email.
      const bodyForHtml = bodyText
        .split(bookingLink)
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/:\s*(\n|$)/g, '.$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const happyHourWindow =
        campaign.templateType === 'happy_hour' &&
        campaign.happyHourStartTime &&
        campaign.happyHourEndTime
          ? `${campaign.happyHourStartTime} – ${campaign.happyHourEndTime}`
          : '';

      const html = renderMarketingEmail({
        preheader: subject,
        businessName: client.businessName || 'Our salon',
        offerBadge: buildOfferBadge(campaign),
        headline: subject,
        bodyHtml: escapeEmailText(bodyForHtml).replace(/\n/g, '<br />'),
        originalPrice: campaign.originalPriceCents
          ? formatPriceCents(campaign.originalPriceCents, campaign.currencyCode)
          : '',
        discountedPrice: campaign.discountedPriceCents
          ? formatPriceCents(campaign.discountedPriceCents, campaign.currencyCode)
          : '',
        happyHourWindow,
        ctaUrl: bookingLink,
        ctaLabel: 'Book your slot',
        footerNote: `You're receiving this offer from ${client.businessName || 'this salon'}.`
      });

      const result = await emailService.sendEmail(
        {
          to: recipient.customerEmail,
          subject,
          text: bodyText,
          html
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
    whatsappStatus,
    whatsappReason,
    whatsappMessageId,
    updatedAt: new Date().toISOString()
  });
};

const classifyRecipientOutcome = (
  campaign: CampaignRecord,
  recipient: CampaignRecipientRecord
): 'sent' | 'failed' | 'skipped' => {
  const relevantStatuses = [
    isChannelRelevant(campaign.channel, 'sms') ? recipient.smsStatus : null,
    isChannelRelevant(campaign.channel, 'email') ? recipient.emailStatus : null,
    isChannelRelevant(campaign.channel, 'whatsapp') ? recipient.whatsappStatus : null
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

  // Recipients that were counted (and charged for) in the reserved wallet
  // cost but did not end up with a 'sent' status on that channel - these are
  // refunded below so a provider outage or exhausted plan credits never
  // permanently consumes wallet balance for messages that were never delivered.
  let unsentSmsCount = 0;
  let unsentEmailCount = 0;
  let unsentWhatsappCount = 0;

  for (const recipient of finalRecipients) {
    const outcome = classifyRecipientOutcome(campaign, recipient);

    if (outcome === 'sent') {
      sentCount += 1;
    } else if (outcome === 'failed') {
      failedCount += 1;
    } else {
      skippedCount += 1;
    }

    if (isChannelRelevant(campaign.channel, 'sms') && recipient.customerPhone && recipient.smsStatus !== 'sent') {
      unsentSmsCount += 1;
    }

    if (isChannelRelevant(campaign.channel, 'email') && recipient.customerEmail && recipient.emailStatus !== 'sent') {
      unsentEmailCount += 1;
    }

    if (
      isChannelRelevant(campaign.channel, 'whatsapp') &&
      recipient.customerPhone &&
      recipient.whatsappStatus !== 'sent'
    ) {
      unsentWhatsappCount += 1;
    }
  }

  const status: CampaignStatus = sentCount === finalRecipients.length
    ? 'sent'
    : sentCount > 0
      ? 'partially_sent'
      : 'failed';

  let refundCents = 0;

  if (unsentSmsCount > 0 || unsentEmailCount > 0 || unsentWhatsappCount > 0) {
    const pricing = await platformSettingsService.getCampaignPricing();
    refundCents = (unsentSmsCount + unsentEmailCount + unsentWhatsappCount) * pricing.promotionalMessageCostCents;
  }

  await marketingRepository.updateCampaign({
    ...campaign,
    status,
    recipientsSent: sentCount,
    recipientsFailed: failedCount,
    recipientsSkipped: skippedCount,
    // Net actual spend: what was reserved minus whatever gets refunded below
    // for recipients that were never delivered.
    costCents: Math.max(0, campaign.costCents - refundCents),
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (refundCents > 0) {
    await walletService.refundForCampaign(campaign.businessId, campaign.id, refundCents);
  }
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

    if (input.templateType === 'custom_offer' && !input.offerName?.trim()) {
      throw new HttpError(400, 'Enter a name for this custom offer');
    }

    const isPromotedOnMarketplace = input.isPromotedOnMarketplace === true;
    const marketplaceServiceIds = (input.marketplaceServiceIds ?? []).filter((entry) => entry.trim());

    if (isPromotedOnMarketplace) {
      if (!input.marketplaceOfferTitle?.trim()) {
        throw new HttpError(400, 'Enter a marketplace offer title');
      }

      if (marketplaceServiceIds.length === 0) {
        throw new HttpError(400, 'Select at least one service for the marketplace offer');
      }

      const invalidService = marketplaceServiceIds.find(
        (serviceId) => !client.services.some((service) => service.id === serviceId && service.isActive)
      );

      if (invalidService) {
        throw new HttpError(400, 'One of the selected marketplace services is not available');
      }

      if (!input.marketplaceStartDate || !input.marketplaceEndDate) {
        throw new HttpError(400, 'Enter a start and end date for the marketplace offer');
      }

      if (input.marketplaceEndDate < input.marketplaceStartDate) {
        throw new HttpError(400, 'The marketplace offer end date must be on or after the start date');
      }

      if (
        input.marketplaceRedemptionCap !== undefined &&
        (!Number.isInteger(input.marketplaceRedemptionCap) || input.marketplaceRedemptionCap <= 0)
      ) {
        throw new HttpError(400, 'Enter a redemption cap greater than zero');
      }

      const overview = await billingService.getBillingOverview(businessId);
      const maxActiveOffers = overview.currentPlan?.entitlements.maxActiveMarketplaceOffers ?? 0;
      const activeOfferCount = await marketingRepository.countActiveMarketplaceOffers(businessId);

      if (activeOfferCount >= maxActiveOffers) {
        throw new HttpError(
          403,
          `You've reached the maximum of ${maxActiveOffers} active marketplace offers on your plan. End an existing offer or upgrade your plan to add more.`
        );
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
      offerName:
        input.templateType === 'happy_hour'
          ? input.offerName?.trim() || 'Happy Hour'
          : input.templateType === 'custom_offer'
            ? input.offerName?.trim() || 'Custom offer'
            : '',
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
      costCents: 0,
      linkOpensCount: 0,
      bookingLink,
      isPromotedOnMarketplace,
      marketplaceOfferTitle: isPromotedOnMarketplace ? input.marketplaceOfferTitle?.trim() : undefined,
      marketplaceServiceIds: isPromotedOnMarketplace ? marketplaceServiceIds : [],
      marketplaceStartDate: isPromotedOnMarketplace ? input.marketplaceStartDate : undefined,
      marketplaceEndDate: isPromotedOnMarketplace ? input.marketplaceEndDate : undefined,
      marketplaceBranchId: isPromotedOnMarketplace ? input.marketplaceBranchId?.trim() : undefined,
      marketplaceRedemptionCap: isPromotedOnMarketplace ? input.marketplaceRedemptionCap : undefined,
      marketplaceNewCustomerOnly: isPromotedOnMarketplace ? input.marketplaceNewCustomerOnly === true : false,
      marketplaceCtaLabel: isPromotedOnMarketplace
        ? input.marketplaceCtaLabel?.trim() || 'Book Offer'
        : 'Book Offer',
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
      emailEligibleCount: merged.filter((entry) => entry.email).length,
      whatsappEligibleCount: merged.filter((entry) => entry.phone).length
    };
  },

  // Cost preview shown before Send: how much this campaign will cost from the
  // wallet, and whether the balance covers it (spec 5.2 steps 4-6).
  async previewCampaignCost(
    businessId: string,
    recipientSource: CampaignRecipientSource,
    csvContacts: CsvContactRow[]
  ): Promise<CampaignCostPreview> {
    const preview = await marketingService.previewRecipients(businessId, recipientSource, csvContacts);
    return walletService.previewCampaignCost(
      businessId,
      preview.smsEligibleCount,
      preview.emailEligibleCount,
      preview.whatsappEligibleCount
    );
  },

  // Shows the business owner exactly what a recipient will receive - same
  // placeholder rendering as the real send, just with a sample name and no
  // per-recipient tracking id in the booking link.
  async previewCampaignMessage(
    businessId: string,
    campaignId: string,
    sampleRecipientName?: string
  ): Promise<{ smsBody: string; emailSubject: string; emailBodyText: string }> {
    const client = await getClientOrThrow(businessId);
    const campaign = await getCampaignOrThrow(businessId, campaignId);
    const placeholderValues = buildPlaceholderValues(client, campaign, sampleRecipientName?.trim() || 'Ayesha');

    return {
      smsBody: renderPlaceholders(campaign.smsBody, placeholderValues),
      emailSubject: renderPlaceholders(campaign.emailSubject, placeholderValues),
      emailBodyText: renderPlaceholders(campaign.emailBodyText, placeholderValues)
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

    // Reserve/deduct the wallet cost before any recipient is written, keyed
    // by campaignId so a retry or double-click on Send can never charge
    // twice. Throws HttpError(402) if the wallet balance is insufficient,
    // which blocks the send entirely (spec 5.2 step 6-7).
    // Only count recipients toward the cost for channels this campaign
    // actually sends on - an email-only campaign must never be charged for
    // the phone numbers on file, since no SMS will ever be attempted for them.
    const smsEligibleCount = isChannelRelevant(campaign.channel, 'sms')
      ? merged.filter((entry) => entry.phone).length
      : 0;
    const emailEligibleCount = isChannelRelevant(campaign.channel, 'email')
      ? merged.filter((entry) => entry.email).length
      : 0;
    const whatsappEligibleCount = isChannelRelevant(campaign.channel, 'whatsapp')
      ? merged.filter((entry) => entry.phone).length
      : 0;
    const costPreview = await walletService.previewCampaignCost(
      businessId,
      smsEligibleCount,
      emailEligibleCount,
      whatsappEligibleCount
    );
    await walletService.reserveAndDeductForCampaign(businessId, campaignId, costPreview.estimatedTotalCents);

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
      whatsappStatus: 'pending',
      whatsappReason: '',
      whatsappMessageId: '',
      createdAt: now,
      updatedAt: now
    }));

    await marketingRepository.insertRecipients(recipientRecords);

    const sendingCampaign: CampaignRecord = {
      ...campaign,
      recipientSource,
      status: 'sending',
      recipientsTotal: recipientRecords.length,
      costCents: costPreview.estimatedTotalCents,
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
        costCents: 0,
        linkOpensCount: 0,
        bookingLink,
        isPromotedOnMarketplace: false,
        marketplaceServiceIds: [],
        marketplaceNewCustomerOnly: false,
        marketplaceCtaLabel: 'Book Offer',
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
    const [appointments, recipients] = await Promise.all([
      appointmentRepository.listAppointmentsByBusinessId(businessId),
      marketingRepository.listRecipientsByCampaignId(campaignId)
    ]);
    const conversionsCount = appointments.filter(
      (appointment) => appointment.campaignId === campaignId && appointment.status !== 'cancelled'
    ).length;
    const openedCount = recipients.filter((recipient) => Boolean(recipient.openedAt)).length;

    return {
      ...campaign,
      linkOpensCount: Math.max(campaign.linkOpensCount ?? 0, openedCount),
      conversionsCount
    };
  },

  async listCampaignsWithStats(
    businessId: string,
    filters?: {
      status?: CampaignStatus;
      channel?: CampaignChannel;
      fromDate?: string;
      toDate?: string;
    }
  ): Promise<CampaignWithStats[]> {
    const [campaigns, appointments, openCounts] = await Promise.all([
      marketingRepository.listCampaignsByBusinessId(businessId, filters),
      appointmentRepository.listAppointmentsByBusinessId(businessId),
      marketingRepository.countOpensByBusinessId(businessId)
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
      // Derive opens from the per-recipient records so the count always matches
      // the "Opened" rows; fall back to the stored counter for older opens.
      linkOpensCount: Math.max(campaign.linkOpensCount ?? 0, openCounts.get(campaign.id) ?? 0),
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

  async recordLinkOpen(campaignId: string, recipientId?: string): Promise<void> {
    if (!campaignId) {
      return;
    }

    try {
      if (recipientId) {
        // Count the campaign open only on a recipient's first open so the
        // total reflects unique people, and record who opened it.
        const isFirstOpen = await marketingRepository.markRecipientOpened(recipientId);

        if (isFirstOpen) {
          await marketingRepository.incrementLinkOpens(campaignId);
        }
      } else {
        await marketingRepository.incrementLinkOpens(campaignId);
      }
    } catch (_error) {
      // Best-effort analytics counter — a failure here should never break the
      // public booking page for the visitor.
    }
  }
};
