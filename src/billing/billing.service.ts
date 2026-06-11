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
  BusinessSubscription,
  BusinessSubscriptionStatus,
  CreateSubscriptionCheckoutInput,
  DemoBillingCard,
  DemoCheckoutInput,
  SubscriptionPlan
} from './billing.types';
import { clientPlatformRepository } from '../platform/clientPlatform.repository';
import { HttpError } from '../shared/errors/httpError';
import { stripePaymentService } from '../payments/stripePayment.service';
import { env } from '../config/env';

const activeSubscriptionStatuses: BusinessSubscriptionStatus[] = ['active', 'trialing'];
const appointmentCreditsFinishedMessage =
  'Appointment credits are finished. Buy or upgrade a plan to receive more booking credits.';

const sortPlans = (plans: SubscriptionPlan[]): SubscriptionPlan[] =>
  [...plans]
    .filter((plan) => plan.isActive !== false)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));

const listNormalizedSubscriptionPlans = async (): Promise<SubscriptionPlan[]> =>
  sortPlans(normalizeSubscriptionPlans(await billingRepository.listSubscriptionPlans()));

const getBusinessOrThrow = async (businessId: string): Promise<void> => {
  const business = await clientPlatformRepository.getClientById(businessId);

  if (!business) {
    throw new HttpError(404, 'Business not found');
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

const getPlanIncludedCredits = (plan: SubscriptionPlan | null | undefined): number => {
  const includedCredits = Number(plan?.entitlements.includedAppointmentCredits);
  if (Number.isFinite(includedCredits) && includedCredits > 0) {
    return Math.floor(includedCredits);
  }

  const defaultPlan = defaultSubscriptionPlans.find((entry) => entry.key === plan?.key);
  const defaultIncludedCredits = Number(defaultPlan?.entitlements.includedAppointmentCredits);
  return Number.isFinite(defaultIncludedCredits) && defaultIncludedCredits > 0
    ? Math.floor(defaultIncludedCredits)
    : 0;
};

const hydrateSubscriptionCredits = (
  subscription: BusinessSubscription,
  plan: SubscriptionPlan | null | undefined
): BusinessSubscription => {
  const fallbackCredits = getPlanIncludedCredits(plan);
  const granted = Number(subscription.appointmentCreditsGranted);
  const used = Number(subscription.appointmentCreditsUsed);
  const remaining = Number(subscription.appointmentCreditsRemaining);
  const normalizedGranted =
    Number.isFinite(granted) && granted >= 0 ? Math.floor(granted) : fallbackCredits;
  const normalizedUsed = Number.isFinite(used) && used >= 0 ? Math.floor(used) : 0;
  const normalizedRemaining =
    Number.isFinite(remaining) && remaining >= 0
      ? Math.floor(remaining)
      : Math.max(0, normalizedGranted - normalizedUsed);

  return {
    ...subscription,
    appointmentCreditsGranted: normalizedGranted,
    appointmentCreditsRemaining: normalizedRemaining,
    appointmentCreditsUsed: normalizedUsed
  };
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

export const billingService = {
  async listSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    return {
      plans: await listNormalizedSubscriptionPlans()
    };
  },

  async getBillingOverview(businessId: string): Promise<BillingOverview> {
    await getBusinessOrThrow(businessId);

    const [plans, subscriptions, invoices] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptions(),
      billingRepository.listBillingInvoices()
    ]);
    const sortedPlans = plans;
    const businessSubscriptions = subscriptions.filter(
      (subscription) => subscription.businessId === businessId
    );
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
      latestInvoice: getLatestInvoice(
        invoices.filter((invoice) => invoice.businessId === businessId)
      ),
      creditBalance: {
        granted: subscription?.appointmentCreditsGranted ?? 0,
        remaining: subscription?.appointmentCreditsRemaining ?? 0,
        used: subscription?.appointmentCreditsUsed ?? 0
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
    const now = new Date();
    const nowIso = now.toISOString();
    const periodEnd = addMonths(now, plan.billingInterval === 'year' ? 12 : 1).toISOString();
    const trialEndsAt =
      plan.trialDays > 0
        ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

    const existingSubscriptions = (await billingRepository.listBusinessSubscriptions()).filter(
      (subscription) =>
        subscription.businessId === businessId &&
        activeSubscriptionStatuses.includes(subscription.status)
    );
    const existingCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
      const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
      return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).appointmentCreditsRemaining;
    }, 0);
    const includedCredits = getPlanIncludedCredits(plan);
    const appointmentCreditsGranted = existingCreditRemainder + includedCredits;

    const subscription: BusinessSubscription = {
      id: randomUUID(),
      businessId,
      planId: plan.id,
      status: plan.trialDays > 0 ? 'trialing' : 'active',
      provider: 'demo',
      providerCustomerId: `demo_customer_${businessId}`,
      providerSubscriptionId: `demo_subscription_${randomUUID()}`,
      demoCard,
      appointmentCreditsGranted,
      appointmentCreditsRemaining: appointmentCreditsGranted,
      appointmentCreditsUsed: 0,
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
      amountCents: plan.amountCents,
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

    return {
      subscription,
      invoice,
      overview: await billingService.getBillingOverview(businessId)
    };
  },

  async createStripeSubscriptionCheckout(
    businessId: string,
    input: CreateSubscriptionCheckoutInput,
    origin: string
  ): Promise<{ checkoutUrl: string; checkoutSessionId: string }> {
    await getBusinessOrThrow(businessId);
    const plans = await listNormalizedSubscriptionPlans();
    const plan = plans.find((entry) => entry.id === input.planId);

    if (!plan) {
      throw new HttpError(404, 'Subscription plan was not found');
    }

    if (!env.STRIPE_SECRET_KEY) {
      throw new HttpError(503, 'Stripe is not configured');
    }

    const checkoutSession = await stripePaymentService.createSubscriptionCheckoutSession({
      businessId,
      plan,
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
    await getBusinessOrThrow(input.businessId);
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
    const existingSubscriptions = (await billingRepository.listBusinessSubscriptions()).filter(
      (subscription) =>
        subscription.businessId === input.businessId &&
        activeSubscriptionStatuses.includes(subscription.status)
    );
    const existingCreditRemainder = existingSubscriptions.reduce((sum, subscription) => {
      const subscriptionPlan = plans.find((entry) => entry.id === subscription.planId);
      return sum + hydrateSubscriptionCredits(subscription, subscriptionPlan).appointmentCreditsRemaining;
    }, 0);
    const includedCredits = getPlanIncludedCredits(plan);
    const appointmentCreditsGranted = existingCreditRemainder + includedCredits;

    const duplicateSubscription = (await billingRepository.listBusinessSubscriptions()).find(
      (subscription) =>
        subscription.provider === 'stripe' &&
        subscription.providerSubscriptionId === input.providerSubscriptionId
    );

    if (duplicateSubscription) {
      const invoice =
        (await billingRepository.listBillingInvoices()).find(
          (entry) => entry.subscriptionId === duplicateSubscription.id
        ) ?? {
          id: randomUUID(),
          businessId: input.businessId,
          subscriptionId: duplicateSubscription.id,
          planId: plan.id,
          amountCents: plan.amountCents,
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
      amountCents: plan.amountCents,
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

    return {
      subscription,
      invoice,
      overview: await billingService.getBillingOverview(input.businessId)
    };
  },

  async consumeAppointmentCreditForBooking(
    businessId: string
  ): Promise<BusinessSubscription | null> {
    await getBusinessOrThrow(businessId);
    const [plans, subscriptions] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptions()
    ]);
    const sortedPlans = plans;
    const rawSubscription = getLatestSubscription(
      subscriptions.filter((subscription) => subscription.businessId === businessId)
    );

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

  async getPublicBookingAvailability(
    businessId: string
  ): Promise<{
    hasActiveSubscription: boolean;
    remainingCredits: number;
    isBookingEnabled: boolean;
    reason: string;
  }> {
    await getBusinessOrThrow(businessId);
    const [plans, subscriptions] = await Promise.all([
      listNormalizedSubscriptionPlans(),
      billingRepository.listBusinessSubscriptions()
    ]);
    const sortedPlans = plans;
    const rawSubscription = getLatestSubscription(
      subscriptions.filter((subscription) => subscription.businessId === businessId)
    );

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
