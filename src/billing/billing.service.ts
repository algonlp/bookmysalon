import { randomUUID } from 'crypto';
import { billingRepository } from './billing.repository';
import {
  billingFeatureCatalog,
  defaultSubscriptionPlans,
  normalizeSubscriptionPlans
} from './defaultPlans';
import type {
  BillingInvoice,
  BillingOverview,
  BookableStaffMemberUsage,
  BusinessSubscription,
  BusinessSubscriptionStatus,
  CreateSubscriptionCheckoutInput,
  DemoBillingCard,
  DemoCheckoutInput,
  DowngradePlanEligibility,
  SubscriptionPaymentRequestRecord,
  SubscriptionPlan,
  SubscriptionPlanKey
} from './billing.types';
import { clientPlatformRepository } from '../platform/clientPlatform.repository';
import type { TeamMemberRecord } from '../platform/clientPlatform.types';
import { HttpError } from '../shared/errors/httpError';
import { logger } from '../shared/logger';
import { stripePaymentService } from '../payments/stripePayment.service';
import { walletService } from '../wallet/wallet.service';
import { platformSettingsService, MANUAL_PAYMENT_METHOD_LABELS } from '../platform/platformSettings.service';
import { env } from '../config/env';
import {
  issueVerificationToken,
  sendAdminVerificationEmail,
  sendBuyerDecisionEmail,
  type PaymentVerificationAdapter
} from '../notifications/paymentVerification';

const formatAmountCentsLabel = (amountCents: number): string => `Rs${(amountCents / 100).toFixed(0)}`;

const activeSubscriptionStatuses: BusinessSubscriptionStatus[] = ['active', 'trialing'];
const appointmentCreditsFinishedMessage =
  'Appointment credits are finished. Buy or upgrade a plan to receive more booking credits.';

const sortPlans = (plans: SubscriptionPlan[]): SubscriptionPlan[] =>
  [...plans]
    .filter((plan) => plan.isActive !== false)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));

const listNormalizedSubscriptionPlans = async (): Promise<SubscriptionPlan[]> =>
  sortPlans(normalizeSubscriptionPlans(await billingRepository.listSubscriptionPlans()));

const getBusinessOrThrow = async (
  businessId: string
): Promise<{ businessName: string; teamMembers: TeamMemberRecord[]; email: string }> => {
  const business = await clientPlatformRepository.getClientById(businessId);

  if (!business) {
    throw new HttpError(404, 'Business not found');
  }

  return { businessName: business.businessName, teamMembers: business.teamMembers, email: business.email };
};

const countActiveBookableStaffMembers = (teamMembers: TeamMemberRecord[]): number =>
  teamMembers.filter(
    (member) => member.isActive !== false && member.isBookableStaffMember !== false
  ).length;

const buildBookableStaffMemberUsage = (
  currentPlan: SubscriptionPlan | null,
  teamMembers: TeamMemberRecord[]
): BookableStaffMemberUsage | null => {
  if (!currentPlan) {
    return null;
  }

  const active = countActiveBookableStaffMembers(teamMembers);
  const included = currentPlan.entitlements.maxTeamMembers;
  const extra = Math.max(0, active - included);
  const cap = currentPlan.entitlements.maxBookableStaffCap;

  return {
    included,
    active,
    extra,
    extraMonthlyCostCents: extra * currentPlan.entitlements.extraBookableStaffPriceCents,
    cap,
    capReached: cap !== null && active >= cap
  };
};

const getExtraBookableStaffCostCents = (plan: SubscriptionPlan, teamMembers: TeamMemberRecord[]): number =>
  buildBookableStaffMemberUsage(plan, teamMembers)?.extraMonthlyCostCents ?? 0;

const getActiveBookableStaffMembers = (teamMembers: TeamMemberRecord[]): TeamMemberRecord[] =>
  teamMembers.filter((member) => member.isActive !== false && member.isBookableStaffMember !== false);

// A downgrade (or any plan switch) must never silently drop staff past the
// new plan's cap. Instead of auto-deactivating anyone, activation is simply
// refused until the admin has deactivated enough Bookable Staff Members
// themselves (via the existing team-member endpoints) - see
// billingService.getDowngradePlanEligibility for the picker data.
const assertBookableStaffFitsPlanCap = (plan: SubscriptionPlan, teamMembers: TeamMemberRecord[]): void => {
  const cap = plan.entitlements.maxBookableStaffCap;

  if (cap === null) {
    return;
  }

  const activeCount = getActiveBookableStaffMembers(teamMembers).length;

  if (activeCount > cap) {
    throw new HttpError(
      409,
      `The ${plan.name} plan allows up to ${cap} Bookable Staff Member${cap === 1 ? '' : 's'}, but ${activeCount} are currently active. Deactivate ${activeCount - cap} Bookable Staff Member${activeCount - cap === 1 ? '' : 's'} first, then switch plans.`
    );
  }
};

// Grants the FULL amount actually paid for a subscription activation back
// into the business's wallet, on every paid activation of a plan - both the
// first purchase and every subsequent renewal - but never for the separate
// free-trial-with-no-payment flow (only ever called with the real amount
// paid: demo checkout, manual/Raast approval, or Stripe create/renew; a
// trial period's invoice amount is 0, which is a no-op here). Idempotent
// per `activationKey`, so a retry/duplicate webhook for the same billing
// event can never grant it twice, while each new activation/renewal (its
// own fresh subscription id, or subscription id + invoice id for a Stripe
// renewal) gets its own grant.
const grantCampaignCreditForActivation = async (
  businessId: string,
  plan: SubscriptionPlan,
  activationKey: string,
  amountPaidCents: number
): Promise<void> => {
  if (amountPaidCents <= 0) {
    return;
  }

  // The subscription itself is already committed by the time this runs - a
  // wallet hiccup here must never surface as a failed activation.
  try {
    await walletService.grantPromotionalCredit(
      businessId,
      amountPaidCents,
      `Wallet credit for ${plan.name} subscription payment`,
      `subscription_activation_credit:${activationKey}`
    );
  } catch (error) {
    logger.error('Failed to grant subscription-activation wallet credit', {
      error: error instanceof Error ? error.message : String(error),
      businessId,
      planId: plan.id,
      activationKey
    });
  }
};

const addMonths = (date: Date, monthsToAdd: number): Date => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
  return nextDate;
};

const normalizeCardDigits = (cardNumber: string): string => cardNumber.replace(/[^\d]/g, '');

const detectCardBrand = (digits: string): DemoBillingCard['brand'] => {
  if (/^4/.test(digits)) {
    return 'visa';
  }

  if (/^5[1-5]/.test(digits) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(digits)) {
    return 'mastercard';
  }

  if (/^3[47]/.test(digits)) {
    return 'amex';
  }

  if (/^6(?:011|5)/.test(digits)) {
    return 'discover';
  }

  return 'unknown';
};

const getSafeDemoCard = (input: DemoCheckoutInput): DemoBillingCard => {
  const cardDigits = normalizeCardDigits(input.cardNumber);
  const cvcDigits = normalizeCardDigits(input.cvc);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (input.cardholderName.trim().length < 2) {
    throw new HttpError(400, 'Cardholder name is required');
  }

  if (cardDigits.length < 12 || cardDigits.length > 19) {
    throw new HttpError(400, 'Demo card number must contain 12 to 19 digits');
  }

  if (input.expMonth < 1 || input.expMonth > 12) {
    throw new HttpError(400, 'Card expiry month is invalid');
  }

  if (
    input.expYear < currentYear ||
    (input.expYear === currentYear && input.expMonth < currentMonth)
  ) {
    throw new HttpError(400, 'Card expiry date is in the past');
  }

  if (cvcDigits.length < 3 || cvcDigits.length > 4) {
    throw new HttpError(400, 'Demo CVC must contain 3 or 4 digits');
  }

  return {
    brand: detectCardBrand(cardDigits),
    last4: cardDigits.slice(-4),
    expMonth: input.expMonth,
    expYear: input.expYear,
    holderName: input.cardholderName.trim()
  };
};

const getLatestSubscription = (subscriptions: BusinessSubscription[]): BusinessSubscription | null =>
  subscriptions
    .filter((subscription) => activeSubscriptionStatuses.includes(subscription.status))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

const getLatestInvoice = (invoices: BillingInvoice[]): BillingInvoice | null =>
  [...invoices].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

const getPlanIncludedEntitlement = (
  plan: SubscriptionPlan | null | undefined,
  entitlementKey: 'includedAppointmentCredits' | 'includedMessages' | 'includedMarketingEmails'
): number => {
  const includedCredits = Number(plan?.entitlements[entitlementKey]);
  if (Number.isFinite(includedCredits) && includedCredits > 0) {
    return Math.floor(includedCredits);
  }

  const defaultPlan = defaultSubscriptionPlans.find((entry) => entry.key === plan?.key);
  const defaultIncludedCredits = Number(defaultPlan?.entitlements[entitlementKey]);
  return Number.isFinite(defaultIncludedCredits) && defaultIncludedCredits > 0
    ? Math.floor(defaultIncludedCredits)
    : 0;
};

const getPlanIncludedCredits = (plan: SubscriptionPlan | null | undefined): number =>
  getPlanIncludedEntitlement(plan, 'includedAppointmentCredits');

const getPlanIncludedMessages = (plan: SubscriptionPlan | null | undefined): number =>
  getPlanIncludedEntitlement(plan, 'includedMessages');

const getPlanIncludedMarketingEmails = (plan: SubscriptionPlan | null | undefined): number =>
  getPlanIncludedEntitlement(plan, 'includedMarketingEmails');

const normalizeCreditTriplet = (
  granted: unknown,
  used: unknown,
  remaining: unknown,
  fallbackGranted: number
): { granted: number; used: number; remaining: number } => {
  const grantedNumber = Number(granted);
  const usedNumber = Number(used);
  const remainingNumber = Number(remaining);
  const normalizedGranted =
    Number.isFinite(grantedNumber) && grantedNumber >= 0 ? Math.floor(grantedNumber) : fallbackGranted;
  const normalizedUsed = Number.isFinite(usedNumber) && usedNumber >= 0 ? Math.floor(usedNumber) : 0;
  const normalizedRemaining =
    Number.isFinite(remainingNumber) && remainingNumber >= 0
      ? Math.floor(remainingNumber)
      : Math.max(0, normalizedGranted - normalizedUsed);

  return { granted: normalizedGranted, used: normalizedUsed, remaining: normalizedRemaining };
};

const hydrateSubscriptionCredits = (
  subscription: BusinessSubscription,
  plan: SubscriptionPlan | null | undefined
): BusinessSubscription => {
  const appointmentCredits = normalizeCreditTriplet(
    subscription.appointmentCreditsGranted,
    subscription.appointmentCreditsUsed,
    subscription.appointmentCreditsRemaining,
    getPlanIncludedCredits(plan)
  );
  const messageCredits = normalizeCreditTriplet(
    subscription.messageCreditsGranted,
    subscription.messageCreditsUsed,
    subscription.messageCreditsRemaining,
    getPlanIncludedMessages(plan)
  );
  const marketingEmailCredits = normalizeCreditTriplet(
    subscription.marketingEmailCreditsGranted,
    subscription.marketingEmailCreditsUsed,
    subscription.marketingEmailCreditsRemaining,
    getPlanIncludedMarketingEmails(plan)
  );

  return {
    ...subscription,
    appointmentCreditsGranted: appointmentCredits.granted,
    appointmentCreditsRemaining: appointmentCredits.remaining,
    appointmentCreditsUsed: appointmentCredits.used,
    messageCreditsGranted: messageCredits.granted,
    messageCreditsRemaining: messageCredits.remaining,
    messageCreditsUsed: messageCredits.used,
    marketingEmailCreditsGranted: marketingEmailCredits.granted,
    marketingEmailCreditsRemaining: marketingEmailCredits.remaining,
    marketingEmailCreditsUsed: marketingEmailCredits.used
  };
};

// Shared subscription-activation logic: computes credit carryover from any
// existing active subscription, cancels it, and saves the new subscription +
// invoice with rollback on failure. Used by both the demo checkout and the
// manual/Raast payment approval path so this ~70-line sequence isn't
// duplicated a second time.
const activateSubscriptionForPlan = async (
  businessId: string,
  plan: SubscriptionPlan,
  providerMeta: {
    provider: BusinessSubscription['provider'];
    providerCustomerId: string;
    providerSubscriptionId: string;
    demoCard?: DemoBillingCard;
  }
): Promise<{ subscription: BusinessSubscription; invoice: BillingInvoice }> => {
  const [plans, business, allBusinessSubscriptions] = await Promise.all([
    listNormalizedSubscriptionPlans(),
    getBusinessOrThrow(businessId),
    billingRepository.listBusinessSubscriptionsByBusinessId(businessId)
  ]);
  const now = new Date();
  const nowIso = now.toISOString();
  const periodEnd = addMonths(now, plan.billingInterval === 'year' ? 12 : 1).toISOString();
  const trialEndsAt =
    plan.trialDays > 0
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
  assertBookableStaffFitsPlanCap(plan, business.teamMembers);
  const extraBookableStaffCostCents = getExtraBookableStaffCostCents(plan, business.teamMembers);

  const existingSubscriptions = allBusinessSubscriptions.filter((subscription) =>
    activeSubscriptionStatuses.includes(subscription.status)
  );
  const existingCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
    const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
    return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).appointmentCreditsRemaining;
  }, 0);
  const existingMessageCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
    const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
    return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).messageCreditsRemaining;
  }, 0);
  const existingMarketingEmailCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
    const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
    return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).marketingEmailCreditsRemaining;
  }, 0);
  const includedCredits = getPlanIncludedCredits(plan);
  const includedMessages = getPlanIncludedMessages(plan);
  const includedMarketingEmails = getPlanIncludedMarketingEmails(plan);
  const appointmentCreditsGranted = existingCreditRemainder + includedCredits;
  const messageCreditsGranted = existingMessageCreditRemainder + includedMessages;
  const marketingEmailCreditsGranted = existingMarketingEmailCreditRemainder + includedMarketingEmails;

  const subscription: BusinessSubscription = {
    id: randomUUID(),
    businessId,
    planId: plan.id,
    status: plan.trialDays > 0 ? 'trialing' : 'active',
    provider: providerMeta.provider,
    providerCustomerId: providerMeta.providerCustomerId,
    providerSubscriptionId: providerMeta.providerSubscriptionId,
    demoCard: providerMeta.demoCard,
    appointmentCreditsGranted,
    appointmentCreditsRemaining: appointmentCreditsGranted,
    appointmentCreditsUsed: 0,
    messageCreditsGranted,
    messageCreditsRemaining: messageCreditsGranted,
    messageCreditsUsed: 0,
    marketingEmailCreditsGranted,
    marketingEmailCreditsRemaining: marketingEmailCreditsGranted,
    marketingEmailCreditsUsed: 0,
    currentPeriodStart: nowIso,
    currentPeriodEnd: periodEnd,
    trialEndsAt,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const invoice: BillingInvoice = {
    id: randomUUID(),
    businessId,
    subscriptionId: subscription.id,
    planId: plan.id,
    amountCents: trialEndsAt ? 0 : plan.amountCents + extraBookableStaffCostCents,
    currencyCode: plan.currencyCode,
    status: 'paid',
    periodStart: nowIso,
    periodEnd,
    paidAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  let hasSavedNextSubscription = false;

  try {
    await Promise.all(
      existingSubscriptions.map((existingSubscription) =>
        billingRepository.saveBusinessSubscription({
          ...existingSubscription,
          status: 'cancelled',
          cancelledAt: nowIso,
          updatedAt: nowIso
        })
      )
    );

    await billingRepository.saveBusinessSubscription(subscription);
    hasSavedNextSubscription = true;
    await billingRepository.saveBillingInvoice(invoice);
  } catch (error) {
    if (hasSavedNextSubscription) {
      await billingRepository.saveBusinessSubscription({
        ...subscription,
        status: 'cancelled',
        cancelledAt: nowIso,
        updatedAt: new Date().toISOString()
      });
    }

    await Promise.all(
      existingSubscriptions.map((existingSubscription) =>
        billingRepository.saveBusinessSubscription(existingSubscription)
      )
    );

    throw error;
  }

  // The plan's real price, not invoice.amountCents - that's zeroed out
  // whenever this activation happens to start with a trial period, which is
  // a deferred-charge bookkeeping detail unrelated to whether a manual/demo/
  // Stripe payment was actually made for this plan.
  await grantCampaignCreditForActivation(
    businessId,
    plan,
    subscription.id,
    plan.amountCents + extraBookableStaffCostCents
  );

  return { subscription, invoice };
};

const buildFeatureAccess = (currentPlan: SubscriptionPlan | null): BillingOverview['featureAccess'] => {
  const enabledFeatureKeys = new Set(currentPlan?.entitlements.featureKeys ?? ['online_booking', 'qr_booking']);
  const maxTeamMembers = Number(currentPlan?.entitlements.maxTeamMembers ?? 0);

  if (Number.isFinite(maxTeamMembers) && maxTeamMembers > 0) {
    enabledFeatureKeys.add('team_management');
  }

  return billingFeatureCatalog.map((feature) => ({
    key: feature.key,
    label: feature.label,
    isEnabled: enabledFeatureKeys.has(feature.key),
    requiredPlanKey: 'requiredPlanKey' in feature ? feature.requiredPlanKey : undefined
  }));
};

const mapStripeSubscriptionStatus = (
  status: string | undefined,
  fallback: BusinessSubscriptionStatus
): BusinessSubscriptionStatus => {
  if (status === 'trialing') {
    return 'trialing';
  }

  if (status === 'active') {
    return 'active';
  }

  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') {
    return 'past_due';
  }

  if (status === 'canceled' || status === 'cancelled' || status === 'incomplete_expired') {
    return 'cancelled';
  }

  return fallback;
};

const findStripeSubscriptionByProviderId = async (
  providerSubscriptionId: string
): Promise<BusinessSubscription | null> =>
  (await billingRepository.listBusinessSubscriptions()).find(
    (subscription) =>
      subscription.provider === 'stripe' &&
      subscription.providerSubscriptionId === providerSubscriptionId
  ) ?? null;

export const billingService = {
  // Lets the frontend show a "choose who stays active" picker before the
  // salon ever tries to pay for a plan switch that would exceed the target
  // plan's Bookable Staff Member cap. Mirrors the same check that
  // requestManualSubscriptionPayment/createStripeSubscriptionCheckout/
  // activateSubscriptionForPlan enforce server-side either way.
  async getDowngradePlanEligibility(
    businessId: string,
    planId: string
  ): Promise<DowngradePlanEligibility> {
    const business = await getBusinessOrThrow(businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    const activeBookableStaff = getActiveBookableStaffMembers(business.teamMembers);
    const cap = plan.entitlements.maxBookableStaffCap;
    const excessCount = cap === null ? 0 : Math.max(0, activeBookableStaff.length - cap);

    return {
      planId: plan.id,
      planName: plan.name,
      targetCap: cap,
      activeBookableStaffCount: activeBookableStaff.length,
      excessCount,
      requiresStaffSelection: excessCount > 0,
      bookableStaffMembers: activeBookableStaff.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role
      }))
    };
  },

  async listSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    return {
      plans: await listNormalizedSubscriptionPlans()
    };
  },

  async getBillingOverview(businessId: string): Promise<BillingOverview> {
    const business = await getBusinessOrThrow(businessId);

    const [plans, businessSubscriptions, businessInvoices] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptionsByBusinessId(businessId),
      billingRepository.listBillingInvoicesByBusinessId(businessId)
    ]);
    const sortedPlans = plans;
    const rawSubscription = getLatestSubscription(businessSubscriptions);
    const currentPlan = rawSubscription
      ? sortedPlans.find((plan) => plan.id === rawSubscription.planId) ?? null
      : null;
    const subscription = rawSubscription
      ? hydrateSubscriptionCredits(rawSubscription, currentPlan)
      : null;
    const featureAccess = buildFeatureAccess(currentPlan);

    return {
      plans: sortedPlans,
      subscription,
      currentPlan,
      bookableStaffMemberUsage: buildBookableStaffMemberUsage(currentPlan, business.teamMembers),
      latestInvoice: getLatestInvoice(businessInvoices),
      creditBalance: {
        granted: subscription?.appointmentCreditsGranted ?? 0,
        remaining: subscription?.appointmentCreditsRemaining ?? 0,
        used: subscription?.appointmentCreditsUsed ?? 0
      },
      messageCreditBalance: {
        granted: subscription?.messageCreditsGranted ?? 0,
        remaining: subscription?.messageCreditsRemaining ?? 0,
        used: subscription?.messageCreditsUsed ?? 0
      },
      marketingEmailCreditBalance: {
        granted: subscription?.marketingEmailCreditsGranted ?? 0,
        remaining: subscription?.marketingEmailCreditsRemaining ?? 0,
        used: subscription?.marketingEmailCreditsUsed ?? 0
      },
      featureAccess,
      lockedFeatureKeys: featureAccess
        .filter((feature) => !feature.isEnabled)
        .map((feature) => feature.key)
    };
  },

  async checkoutDemoSubscription(
    businessId: string,
    input: DemoCheckoutInput
  ): Promise<{
    subscription: BusinessSubscription;
    invoice: BillingInvoice;
    overview: BillingOverview;
  }> {
    await getBusinessOrThrow(businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === input.planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    const demoCard = getSafeDemoCard(input);
    const { subscription, invoice } = await activateSubscriptionForPlan(businessId, plan, {
      provider: 'demo',
      providerCustomerId: `demo_customer_${businessId}`,
      providerSubscriptionId: `demo_subscription_${randomUUID()}`,
      demoCard
    });

    return {
      subscription,
      invoice,
      overview: await billingService.getBillingOverview(businessId)
    };
  },

  async requestManualSubscriptionPayment(
    businessId: string,
    input: {
      planId: string;
      paymentMethod: SubscriptionPaymentRequestRecord['paymentMethod'];
      paymentProofDataUrl: string;
      transactionReference: string;
    },
    origin: string
  ): Promise<SubscriptionPaymentRequestRecord> {
    const business = await getBusinessOrThrow(businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === input.planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    if (!input.paymentProofDataUrl?.trim()) {
      throw new HttpError(400, 'Upload payment proof before submitting a payment request');
    }

    assertBookableStaffFitsPlanCap(plan, business.teamMembers);
    const extraBookableStaffCostCents = getExtraBookableStaffCostCents(plan, business.teamMembers);
    const { tokenHash, expiresAt, plainToken } = issueVerificationToken();
    const now = new Date().toISOString();
    const request: SubscriptionPaymentRequestRecord = {
      id: randomUUID(),
      businessId,
      planId: plan.id,
      amountCents: plan.amountCents + extraBookableStaffCostCents,
      currencyCode: plan.currencyCode,
      paymentMethod: input.paymentMethod,
      paymentProofDataUrl: input.paymentProofDataUrl.trim(),
      transactionReference: input.transactionReference?.trim() ?? '',
      status: 'pending_review',
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now
    };

    const saved = await billingRepository.saveSubscriptionPaymentRequest(request);
    await sendAdminVerificationEmail(subscriptionPaymentAdapter, saved, plainToken, origin);
    return saved;
  },

  async listPendingManualSubscriptionPaymentRequests(): Promise<SubscriptionPaymentRequestRecord[]> {
    const all = await billingRepository.listSubscriptionPaymentRequests();
    return all.filter((entry) => entry.status === 'pending_review');
  },

  async approveManualSubscriptionPayment(
    requestId: string,
    operator?: string
  ): Promise<SubscriptionPaymentRequestRecord> {
    const request = await billingRepository.getSubscriptionPaymentRequestById(requestId);

    if (!request) {
      throw new HttpError(404, 'Payment request not found');
    }

    if (request.status !== 'pending_review') {
      // Idempotent: approving an already-decided request just returns it
      // as-is instead of erroring, so a double-click/replayed link never
      // double-activates the subscription.
      return request;
    }

    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === request.planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    await activateSubscriptionForPlan(request.businessId, plan, {
      provider: 'manual',
      providerCustomerId: `manual_customer_${request.businessId}`,
      providerSubscriptionId: `manual_subscription_${randomUUID()}`
    });

    const updated: SubscriptionPaymentRequestRecord = {
      ...request,
      status: 'approved',
      verificationTokenHash: undefined,
      verificationTokenExpiresAt: undefined,
      reviewedBy: operator,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await billingRepository.saveSubscriptionPaymentRequest(updated);
    await sendBuyerDecisionEmail(subscriptionPaymentAdapter, saved, 'approved');
    return saved;
  },

  async rejectManualSubscriptionPayment(
    requestId: string,
    operator: string | undefined,
    reason: string
  ): Promise<SubscriptionPaymentRequestRecord> {
    const request = await billingRepository.getSubscriptionPaymentRequestById(requestId);

    if (!request) {
      throw new HttpError(404, 'Payment request not found');
    }

    if (request.status !== 'pending_review') {
      return request;
    }

    const updated: SubscriptionPaymentRequestRecord = {
      ...request,
      status: 'rejected',
      verificationTokenHash: undefined,
      verificationTokenExpiresAt: undefined,
      reviewedBy: operator,
      reviewedAt: new Date().toISOString(),
      rejectionReason: reason.trim(),
      updatedAt: new Date().toISOString()
    };

    const saved = await billingRepository.saveSubscriptionPaymentRequest(updated);
    await sendBuyerDecisionEmail(subscriptionPaymentAdapter, saved, 'rejected', reason);
    return saved;
  },

  async startFreeTrialSubscription(
    businessId: string,
    planKey: SubscriptionPlanKey
  ): Promise<{
    subscription: BusinessSubscription;
    plan: SubscriptionPlan;
    overview: BillingOverview;
  }> {
    await getBusinessOrThrow(businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.key === planKey);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    if (plan.trialDays <= 0) {
      throw new HttpError(400, 'This plan does not include a free trial');
    }

    const existingSubscriptions = (
      await billingRepository.listBusinessSubscriptionsByBusinessId(businessId)
    ).filter((subscription) => activeSubscriptionStatuses.includes(subscription.status));

    if (existingSubscriptions.length > 0) {
      throw new HttpError(409, 'This business already has an active subscription');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const trialEndsAt = new Date(
      now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const appointmentCreditsGranted = getPlanIncludedCredits(plan);
    const messageCreditsGranted = getPlanIncludedMessages(plan);
    const marketingEmailCreditsGranted = getPlanIncludedMarketingEmails(plan);

    const subscription: BusinessSubscription = {
      id: randomUUID(),
      businessId,
      planId: plan.id,
      status: 'trialing',
      provider: 'trial',
      providerCustomerId: `trial_customer_${businessId}`,
      providerSubscriptionId: `trial_subscription_${randomUUID()}`,
      appointmentCreditsGranted,
      appointmentCreditsRemaining: appointmentCreditsGranted,
      appointmentCreditsUsed: 0,
      messageCreditsGranted,
      messageCreditsRemaining: messageCreditsGranted,
      messageCreditsUsed: 0,
      marketingEmailCreditsGranted,
      marketingEmailCreditsRemaining: marketingEmailCreditsGranted,
      marketingEmailCreditsUsed: 0,
      currentPeriodStart: nowIso,
      currentPeriodEnd: trialEndsAt,
      trialEndsAt,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const invoice: BillingInvoice = {
      id: randomUUID(),
      businessId,
      subscriptionId: subscription.id,
      planId: plan.id,
      amountCents: 0,
      currencyCode: plan.currencyCode,
      status: 'paid',
      periodStart: nowIso,
      periodEnd: trialEndsAt,
      paidAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await billingRepository.saveBusinessSubscription(subscription);
    await billingRepository.saveBillingInvoice(invoice);

    return {
      subscription,
      plan,
      overview: await billingService.getBillingOverview(businessId)
    };
  },

  async createStripeSubscriptionCheckout(
    businessId: string,
    input: CreateSubscriptionCheckoutInput,
    origin: string
  ): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
    const business = await getBusinessOrThrow(businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === input.planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    if (!(await platformSettingsService.isStripeEnabled()) || !env.STRIPE_SECRET_KEY) {
      throw new HttpError(503, 'Stripe payments are currently disabled');
    }

    // Blocked here, before Stripe ever charges the card - activateStripeSubscriptionCheckout
    // runs after payment has already been collected, which is too late to refuse safely.
    assertBookableStaffFitsPlanCap(plan, business.teamMembers);

    const bookableStaffMemberUsage = buildBookableStaffMemberUsage(plan, business.teamMembers);

    const checkoutSession = await stripePaymentService.createSubscriptionCheckoutSession({
      businessId,
      businessName: business.businessName,
      plan,
      extraBookableStaffCount: bookableStaffMemberUsage?.extra ?? 0,
      successUrl: `${origin}/api/billing/stripe-return?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/calendar?clientId=${encodeURIComponent(businessId)}&subscriptionCheckout=cancelled`
    });

    if (!checkoutSession.url) {
      throw new HttpError(502, 'Stripe checkout session did not return a checkout URL');
    }

    return {
      checkoutUrl: checkoutSession.url,
      checkoutSessionId: checkoutSession.id
    };
  },

  async confirmStripeSubscriptionCheckout(
    businessId: string,
    checkoutSessionId: string
  ): Promise<{ subscription: BusinessSubscription; invoice: BillingInvoice; overview: BillingOverview }> {
    await getBusinessOrThrow(businessId);
    const session = await stripePaymentService.retrieveCheckoutSession(checkoutSessionId);
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (
      session.status !== 'complete' ||
      session.payment_status !== 'paid' ||
      session.metadata?.kind !== 'subscription_checkout' ||
      session.metadata.businessId !== businessId ||
      !session.metadata.planId ||
      !subscriptionId
    ) {
      throw new HttpError(409, 'Stripe subscription checkout is not complete');
    }

    return billingService.activateStripeSubscriptionCheckout({
      businessId,
      planId: session.metadata.planId,
      providerCustomerId: customerId,
      providerSubscriptionId: subscriptionId
    });
  },

  async confirmStripeSubscriptionReturn(
    checkoutSessionId: string
  ): Promise<{
    businessId: string;
    subscription: BusinessSubscription;
    invoice: BillingInvoice;
    overview: BillingOverview;
  }> {
    const session = await stripePaymentService.retrieveCheckoutSession(checkoutSessionId);
    const businessId = session.metadata?.businessId;

    if (!businessId) {
      throw new HttpError(409, 'Stripe subscription checkout has no business');
    }

    return {
      businessId,
      ...(await billingService.confirmStripeSubscriptionCheckout(businessId, checkoutSessionId))
    };
  },

  async activateStripeSubscriptionCheckout(input: {
    businessId: string;
    planId: string;
    providerCustomerId?: string;
    providerSubscriptionId?: string;
  }): Promise<{ subscription: BusinessSubscription; invoice: BillingInvoice; overview: BillingOverview }> {
    const business = await getBusinessOrThrow(input.businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === input.planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const periodEnd = addMonths(now, plan.billingInterval === 'year' ? 12 : 1).toISOString();
    const trialEndsAt =
      plan.trialDays > 0
        ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    const extraBookableStaffCostCents = getExtraBookableStaffCostCents(plan, business.teamMembers);
    const businessSubscriptions = await billingRepository.listBusinessSubscriptionsByBusinessId(input.businessId);
    const existingSubscriptions = businessSubscriptions.filter(
      (subscription) =>
        activeSubscriptionStatuses.includes(subscription.status)
    );
    const existingCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
      const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
      return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).appointmentCreditsRemaining;
    }, 0);
    const existingMessageCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
      const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
      return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).messageCreditsRemaining;
    }, 0);
    const existingMarketingEmailCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
      const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
      return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).marketingEmailCreditsRemaining;
    }, 0);
    const includedCredits = getPlanIncludedCredits(plan);
    const includedMessages = getPlanIncludedMessages(plan);
    const includedMarketingEmails = getPlanIncludedMarketingEmails(plan);
    const appointmentCreditsGranted = existingCreditRemainder + includedCredits;
    const messageCreditsGranted = existingMessageCreditRemainder + includedMessages;
    const marketingEmailCreditsGranted = existingMarketingEmailCreditRemainder + includedMarketingEmails;

    const duplicateSubscription = businessSubscriptions.find(
      (subscription) =>
        subscription.provider === 'stripe' &&
        subscription.providerSubscriptionId === input.providerSubscriptionId
    );

    if (duplicateSubscription) {
      const invoice =
        (await billingRepository.listBillingInvoicesByBusinessId(input.businessId)).find(
          (entry) => entry.subscriptionId === duplicateSubscription.id
        ) ?? {
          id: randomUUID(),
          businessId: input.businessId,
          subscriptionId: duplicateSubscription.id,
          planId: plan.id,
          amountCents: plan.amountCents + extraBookableStaffCostCents,
          currencyCode: plan.currencyCode,
          status: 'paid',
          periodStart: duplicateSubscription.currentPeriodStart,
          periodEnd: duplicateSubscription.currentPeriodEnd,
          paidAt: duplicateSubscription.createdAt,
          createdAt: duplicateSubscription.createdAt,
          updatedAt: duplicateSubscription.updatedAt
        };

      return {
        subscription: duplicateSubscription,
        invoice,
        overview: await billingService.getBillingOverview(input.businessId)
      };
    }

    const subscription: BusinessSubscription = {
      id: randomUUID(),
      businessId: input.businessId,
      planId: plan.id,
      status: plan.trialDays > 0 ? 'trialing' : 'active',
      provider: 'stripe',
      providerCustomerId: input.providerCustomerId ?? '',
      providerSubscriptionId: input.providerSubscriptionId ?? '',
      appointmentCreditsGranted,
      appointmentCreditsRemaining: appointmentCreditsGranted,
      appointmentCreditsUsed: 0,
      messageCreditsGranted,
      messageCreditsRemaining: messageCreditsGranted,
      messageCreditsUsed: 0,
      marketingEmailCreditsGranted,
      marketingEmailCreditsRemaining: marketingEmailCreditsGranted,
      marketingEmailCreditsUsed: 0,
      currentPeriodStart: nowIso,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const invoice: BillingInvoice = {
      id: randomUUID(),
      businessId: input.businessId,
      subscriptionId: subscription.id,
      planId: plan.id,
      amountCents: trialEndsAt ? 0 : plan.amountCents + extraBookableStaffCostCents,
      currencyCode: plan.currencyCode,
      status: 'paid',
      periodStart: nowIso,
      periodEnd,
      paidAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await Promise.all(
      existingSubscriptions.map((existingSubscription) =>
        billingRepository.saveBusinessSubscription({
          ...existingSubscription,
          status: 'cancelled',
          cancelledAt: nowIso,
          updatedAt: nowIso
        })
      )
    );
    await billingRepository.saveBusinessSubscription(subscription);
    await billingRepository.saveBillingInvoice(invoice);
    await grantCampaignCreditForActivation(
      input.businessId,
      plan,
      subscription.id,
      plan.amountCents + extraBookableStaffCostCents
    );

    return {
      subscription,
      invoice,
      overview: await billingService.getBillingOverview(input.businessId)
    };
  },

  async recordStripeInvoicePaid(input: {
    providerInvoiceId: string;
    providerSubscriptionId: string;
    providerCustomerId?: string;
    amountPaidCents?: number;
    currencyCode?: string;
    periodStart?: string;
    periodEnd?: string;
    paidAt?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    if (!input.providerSubscriptionId) {
      return;
    }

    const existingInvoice = (await billingRepository.listBillingInvoices()).find(
      (invoice) => invoice.id === input.providerInvoiceId
    );

    let subscription = await findStripeSubscriptionByProviderId(input.providerSubscriptionId);

    if (!subscription && input.metadata?.businessId && input.metadata.planId) {
      const activation = await billingService.activateStripeSubscriptionCheckout({
        businessId: input.metadata.businessId,
        planId: input.metadata.planId,
        providerCustomerId: input.providerCustomerId,
        providerSubscriptionId: input.providerSubscriptionId
      });
      subscription = activation.subscription;
    }

    if (!subscription) {
      return;
    }

    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === subscription?.planId) ?? null;
    const periodStart = input.periodStart ?? subscription.currentPeriodStart;
    const periodEnd = input.periodEnd ?? subscription.currentPeriodEnd;
    const isNewerPeriod = periodEnd.localeCompare(subscription.currentPeriodEnd) > 0;
    const includedCredits = isNewerPeriod && !existingInvoice ? getPlanIncludedCredits(plan) : 0;
    const includedMessages = isNewerPeriod && !existingInvoice ? getPlanIncludedMessages(plan) : 0;
    const includedMarketingEmails = isNewerPeriod && !existingInvoice ? getPlanIncludedMarketingEmails(plan) : 0;
    const paidAt = input.paidAt ?? new Date().toISOString();

    const updatedSubscription: BusinessSubscription = {
      ...subscription,
      status: subscription.status === 'trialing' ? 'trialing' : 'active',
      providerCustomerId: input.providerCustomerId ?? subscription.providerCustomerId,
      appointmentCreditsGranted: subscription.appointmentCreditsGranted + includedCredits,
      appointmentCreditsRemaining: subscription.appointmentCreditsRemaining + includedCredits,
      messageCreditsGranted: subscription.messageCreditsGranted + includedMessages,
      messageCreditsRemaining: subscription.messageCreditsRemaining + includedMessages,
      marketingEmailCreditsGranted: subscription.marketingEmailCreditsGranted + includedMarketingEmails,
      marketingEmailCreditsRemaining: subscription.marketingEmailCreditsRemaining + includedMarketingEmails,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelledAt: undefined,
      updatedAt: paidAt
    };

    await billingRepository.saveBusinessSubscription(updatedSubscription);

    await billingRepository.saveBillingInvoice({
      id: input.providerInvoiceId,
      businessId: subscription.businessId,
      subscriptionId: subscription.id,
      planId: subscription.planId,
      amountCents: input.amountPaidCents ?? plan?.amountCents ?? 0,
      currencyCode: input.currencyCode ?? plan?.currencyCode ?? 'PKR',
      status: 'paid',
      periodStart,
      periodEnd,
      paidAt,
      createdAt: existingInvoice?.createdAt ?? paidAt,
      updatedAt: paidAt
    });

    // Same "actually a new billing period" guard as the credit top-up above -
    // activateStripeSubscriptionCheckout already granted it for the very
    // first invoice, this covers every renewal after that.
    if (isNewerPeriod && !existingInvoice && plan) {
      await grantCampaignCreditForActivation(
        subscription.businessId,
        plan,
        `${subscription.id}:${input.providerInvoiceId}`,
        input.amountPaidCents ?? plan.amountCents ?? 0
      );
    }
  },

  async markStripeInvoicePaymentFailed(input: {
    providerSubscriptionId: string;
    failedAt?: string;
  }): Promise<void> {
    const subscription = await findStripeSubscriptionByProviderId(input.providerSubscriptionId);

    if (!subscription) {
      return;
    }

    await billingRepository.saveBusinessSubscription({
      ...subscription,
      status: 'past_due',
      updatedAt: input.failedAt ?? new Date().toISOString()
    });
  },

  async syncStripeSubscriptionLifecycle(input: {
    providerSubscriptionId: string;
    providerCustomerId?: string;
    status?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelledAt?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    if (!input.providerSubscriptionId) {
      return;
    }

    let subscription = await findStripeSubscriptionByProviderId(input.providerSubscriptionId);

    if (!subscription && input.metadata?.businessId && input.metadata.planId) {
      const activation = await billingService.activateStripeSubscriptionCheckout({
        businessId: input.metadata.businessId,
        planId: input.metadata.planId,
        providerCustomerId: input.providerCustomerId,
        providerSubscriptionId: input.providerSubscriptionId
      });
      subscription = activation.subscription;
    }

    if (!subscription) {
      return;
    }

    const nowIso = new Date().toISOString();
    const nextStatus = mapStripeSubscriptionStatus(input.status, subscription.status);

    await billingRepository.saveBusinessSubscription({
      ...subscription,
      status: nextStatus,
      providerCustomerId: input.providerCustomerId ?? subscription.providerCustomerId,
      currentPeriodStart: input.currentPeriodStart ?? subscription.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd ?? subscription.currentPeriodEnd,
      cancelledAt: nextStatus === 'cancelled' ? input.cancelledAt ?? nowIso : undefined,
      updatedAt: nowIso
    });
  },

  async consumeAppointmentCreditForBooking(
    businessId: string
  ): Promise<BusinessSubscription | null> {
    await getBusinessOrThrow(businessId);
    const [plans, businessSubscriptions] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptionsByBusinessId(businessId)
    ]);
    const sortedPlans = plans;
    const rawSubscription = getLatestSubscription(businessSubscriptions);

    if (!rawSubscription) {
      return null;
    }

    const currentPlan = sortedPlans.find((plan) => plan.id === rawSubscription.planId) ?? null;
    const subscription = hydrateSubscriptionCredits(rawSubscription, currentPlan);

    if (subscription.appointmentCreditsRemaining <= 0) {
      throw new HttpError(402, appointmentCreditsFinishedMessage);
    }

    const updatedSubscription: BusinessSubscription = {
      ...subscription,
      appointmentCreditsRemaining: subscription.appointmentCreditsRemaining - 1,
      appointmentCreditsUsed: subscription.appointmentCreditsUsed + 1,
      updatedAt: new Date().toISOString()
    };

    await billingRepository.saveBusinessSubscription(updatedSubscription);
    return subscription;
  },

  async restoreAppointmentCreditForBooking(
    subscription: BusinessSubscription | null
  ): Promise<void> {
    if (!subscription) {
      return;
    }

    await billingRepository.saveBusinessSubscription(subscription);
  },

  // Returns false (and consumes nothing) when the business has no active
  // subscription or no message credits remain, so callers can skip the send
  // instead of throwing mid-batch.
  async consumeMessageCredit(businessId: string): Promise<boolean> {
    const [plans, businessSubscriptions] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptionsByBusinessId(businessId)
    ]);
    const rawSubscription = getLatestSubscription(businessSubscriptions);

    if (!rawSubscription) {
      return false;
    }

    const currentPlan = plans.find((plan) => plan.id === rawSubscription.planId) ?? null;
    const subscription = hydrateSubscriptionCredits(rawSubscription, currentPlan);

    if (subscription.messageCreditsRemaining <= 0) {
      return false;
    }

    await billingRepository.saveBusinessSubscription({
      ...subscription,
      messageCreditsRemaining: subscription.messageCreditsRemaining - 1,
      messageCreditsUsed: subscription.messageCreditsUsed + 1,
      updatedAt: new Date().toISOString()
    });

    return true;
  },

  async consumeMarketingEmailCredit(businessId: string): Promise<boolean> {
    const [plans, businessSubscriptions] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptionsByBusinessId(businessId)
    ]);
    const rawSubscription = getLatestSubscription(businessSubscriptions);

    if (!rawSubscription) {
      return false;
    }

    const currentPlan = plans.find((plan) => plan.id === rawSubscription.planId) ?? null;
    const subscription = hydrateSubscriptionCredits(rawSubscription, currentPlan);

    if (subscription.marketingEmailCreditsRemaining <= 0) {
      return false;
    }

    await billingRepository.saveBusinessSubscription({
      ...subscription,
      marketingEmailCreditsRemaining: subscription.marketingEmailCreditsRemaining - 1,
      marketingEmailCreditsUsed: subscription.marketingEmailCreditsUsed + 1,
      updatedAt: new Date().toISOString()
    });

    return true;
  },

  async getPublicBookingAvailability(
    businessId: string
  ): Promise<{
    hasActiveSubscription: boolean;
    remainingCredits: number;
    isBookingEnabled: boolean;
    reason: string;
  }> {
    await getBusinessOrThrow(businessId);
    const [plans, businessSubscriptions] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptionsByBusinessId(businessId)
    ]);
    const sortedPlans = plans;
    const rawSubscription = getLatestSubscription(businessSubscriptions);

    if (!rawSubscription) {
      return {
        hasActiveSubscription: false,
        remainingCredits: 0,
        isBookingEnabled: true,
        reason: ''
      };
    }

    const currentPlan = sortedPlans.find((plan) => plan.id === rawSubscription.planId) ?? null;
    const subscription = hydrateSubscriptionCredits(rawSubscription, currentPlan);
    const remainingCredits = subscription.appointmentCreditsRemaining;

    return {
      hasActiveSubscription: true,
      remainingCredits,
      isBookingEnabled: remainingCredits > 0,
      reason: remainingCredits > 0 ? '' : appointmentCreditsFinishedMessage
    };
  }
};

export const subscriptionPaymentAdapter: PaymentVerificationAdapter<SubscriptionPaymentRequestRecord> = {
  kind: 'subscription_payment',
  getById: (id) => billingRepository.getSubscriptionPaymentRequestById(id).then((entry) => entry ?? null),
  approve: (id, operator) => billingService.approveManualSubscriptionPayment(id, operator),
  reject: (id, operator, reason) => billingService.rejectManualSubscriptionPayment(id, operator, reason),
  async describe(request) {
    const [business, plans] = await Promise.all([
      getBusinessOrThrow(request.businessId).catch(() => null),
      listNormalizedSubscriptionPlans()
    ]);
    const plan = plans.find((entry) => entry.id === request.planId);

    return {
      businessName: business?.businessName ?? 'Unknown business',
      businessEmail: business?.email ?? '',
      kindLabel: 'Subscription payment',
      amountLabel: formatAmountCentsLabel(request.amountCents),
      proofUrl: request.paymentProofDataUrl,
      extraLines: [
        `Plan: ${plan?.name ?? request.planId}`,
        `Method: ${MANUAL_PAYMENT_METHOD_LABELS[request.paymentMethod]}`,
        request.transactionReference ? `Reference: ${request.transactionReference}` : ''
      ].filter(Boolean)
    };
  }
};
