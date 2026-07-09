import Stripe from 'stripe';
import { env } from '../config/env';
import { HttpError } from '../shared/errors/httpError';
import type { PackagePurchaseRecord } from '../appointments/appointment.types';
import type { SubscriptionPlan } from '../billing/billing.types';

type StripeClient = ReturnType<typeof Stripe>;
type StripeCheckoutSession = Awaited<
  ReturnType<StripeClient['checkout']['sessions']['create']>
>;
type StripeWebhookEvent = ReturnType<StripeClient['webhooks']['constructEvent']>;
type StripeConnectAccount = Awaited<ReturnType<StripeClient['accounts']['create']>>;
type StripeConnectAccountLink = Awaited<ReturnType<StripeClient['accountLinks']['create']>>;
type StripePaymentIntentData = NonNullable<
  NonNullable<Parameters<StripeClient['checkout']['sessions']['create']>[0]>['payment_intent_data']
>;

interface CreatePackageCheckoutSessionInput {
  packagePurchase: PackagePurchaseRecord;
  businessName?: string;
  amountCents: number;
  currencyCode: string;
  successUrl: string;
  cancelUrl: string;
  destinationAccountId?: string;
}

interface CreateSpecialServiceDepositCheckoutSessionInput {
  appointmentId: string;
  businessId: string;
  serviceName: string;
  customerEmail?: string;
  businessName?: string;
  amountCents: number;
  currencyCode: string;
  successUrl: string;
  cancelUrl: string;
  destinationAccountId?: string;
}

interface CreateSubscriptionCheckoutSessionInput {
  businessId: string;
  businessName?: string;
  plan: SubscriptionPlan;
  successUrl: string;
  cancelUrl: string;
}

const getStripeChargeMoney = (
  amountCents: number,
  currencyCode: string
): { amountCents: number; currencyCode: string } => {
  const sourceCurrencyCode = currencyCode.toUpperCase();
  const chargeCurrencyCode = (env.STRIPE_CHARGE_CURRENCY_CODE || sourceCurrencyCode).toUpperCase();

  if (sourceCurrencyCode === chargeCurrencyCode) {
    return {
      amountCents,
      currencyCode: sourceCurrencyCode
    };
  }

  if (sourceCurrencyCode === 'PKR' && chargeCurrencyCode === 'GBP') {
    if (!env.STRIPE_PKR_TO_GBP_RATE) {
      throw new HttpError(
        503,
        'STRIPE_PKR_TO_GBP_RATE is required when charging PKR prices in GBP'
      );
    }

    return {
      amountCents: Math.max(1, Math.round(amountCents * env.STRIPE_PKR_TO_GBP_RATE)),
      currencyCode: chargeCurrencyCode
    };
  }

  if (sourceCurrencyCode === 'USD' && chargeCurrencyCode === 'GBP') {
    if (!env.STRIPE_USD_TO_GBP_RATE) {
      throw new HttpError(
        503,
        'STRIPE_USD_TO_GBP_RATE is required when charging USD prices in GBP'
      );
    }

    return {
      amountCents: Math.max(1, Math.round(amountCents * env.STRIPE_USD_TO_GBP_RATE)),
      currencyCode: chargeCurrencyCode
    };
  }

  throw new HttpError(
    503,
    `Stripe currency conversion from ${sourceCurrencyCode} to ${chargeCurrencyCode} is not configured`
  );
};

const getStripeClient = (): StripeClient => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, 'Stripe is not configured');
  }

  return new Stripe(env.STRIPE_SECRET_KEY);
};

const getStripeErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Stripe request failed';

const toStripeConnectHttpError = (error: unknown): HttpError => {
  const message = getStripeErrorMessage(error);

  if (message.toLowerCase().includes("signed up for connect")) {
    return new HttpError(
      503,
      'Stripe Connect is not enabled for this Stripe account. Open Stripe Dashboard > Connect and complete Connect setup before connecting salons.'
    );
  }

  return new HttpError(502, message);
};

const getAccountRequirementsDue = (account: StripeConnectAccount): string[] => [
  ...(account.requirements?.currently_due ?? []),
  ...(account.requirements?.past_due ?? [])
].filter((value, index, values) => values.indexOf(value) === index);

async function findOrCreateCustomer(
  client: StripeClient,
  businessId: string,
  businessName: string
): Promise<string> {
  const existing = await client.customers.search({
    query: `metadata["businessId"]:"${businessId}"`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    const cust = existing.data[0];
    if (cust.metadata?.businessName !== businessName) {
      await client.customers.update(cust.id, {
        metadata: { businessId, businessName },
      });
    }
    return cust.id;
  }

  const customer = await client.customers.create({
    name: businessName,
    metadata: { businessId, businessName },
  });

  return customer.id;
}

export const stripePaymentService = {
  async retrieveCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
    return getStripeClient().checkout.sessions.retrieve(sessionId);
  },

  async createConnectAccount(input: {
    email: string;
    businessName: string;
    countryCode?: string;
  }): Promise<StripeConnectAccount> {
    try {
      return await getStripeClient().accounts.create({
        type: 'express',
        country: input.countryCode || env.STRIPE_CONNECT_COUNTRY_CODE,
        email: input.email,
        business_profile: {
          name: input.businessName || undefined
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });
    } catch (error) {
      throw toStripeConnectHttpError(error);
    }
  },

  async retrieveConnectAccount(accountId: string): Promise<StripeConnectAccount> {
    const account = await getStripeClient().accounts.retrieve(accountId);

    if ('deleted' in account && account.deleted) {
      throw new HttpError(409, 'The salon Stripe Connect account no longer exists');
    }

    return account;
  },

  async createConnectAccountLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<StripeConnectAccountLink> {
    try {
      return await getStripeClient().accountLinks.create({
        account: input.accountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: 'account_onboarding',
        collection_options: {
          fields: 'eventually_due',
          future_requirements: 'include'
        }
      });
    } catch (error) {
      throw toStripeConnectHttpError(error);
    }
  },

  toConnectAccountStatus(account: StripeConnectAccount): {
    accountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    requirementsDue: string[];
    disabledReason?: string;
    country?: string;
    defaultCurrency?: string;
  } {
    return {
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirementsDue: getAccountRequirementsDue(account),
      disabledReason: account.requirements?.disabled_reason ?? undefined,
      country: account.country ?? undefined,
      defaultCurrency: account.default_currency ?? undefined
    };
  },

  async createPackageCheckoutSession(
    input: CreatePackageCheckoutSessionInput
  ): Promise<StripeCheckoutSession> {
    const chargeMoney = getStripeChargeMoney(input.amountCents, input.currencyCode);
    const paymentIntentData: StripePaymentIntentData = {
      metadata: {
        businessId: input.packagePurchase.businessId,
        packagePurchaseId: input.packagePurchase.id,
        packagePlanId: input.packagePurchase.packagePlanId,
        sourceAmountCents: String(input.amountCents),
        sourceCurrencyCode: input.currencyCode,
        chargeAmountCents: String(chargeMoney.amountCents),
        chargeCurrencyCode: chargeMoney.currencyCode
      }
    };

    if (input.destinationAccountId) {
      paymentIntentData.transfer_data = {
        destination: input.destinationAccountId
      };
      paymentIntentData.on_behalf_of = input.destinationAccountId;
    }

    if (input.destinationAccountId && env.STRIPE_PACKAGE_PAYMENT_APPLICATION_FEE_CENTS > 0) {
      if (env.STRIPE_PACKAGE_PAYMENT_APPLICATION_FEE_CENTS > chargeMoney.amountCents) {
        throw new HttpError(400, 'Stripe application fee cannot exceed the payment amount');
      }
      paymentIntentData.application_fee_amount =
        env.STRIPE_PACKAGE_PAYMENT_APPLICATION_FEE_CENTS;
    }

    const salonLabel = input.businessName?.trim() || input.packagePurchase.businessId;

    return getStripeClient().checkout.sessions.create({
      mode: 'payment',
      customer_email: input.packagePurchase.customerEmail || undefined,
      client_reference_id: input.packagePurchase.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: chargeMoney.currencyCode.toLowerCase(),
            unit_amount: chargeMoney.amountCents,
            product_data: {
              name: `${input.packagePurchase.packageName} — ${salonLabel}`,
              metadata: {
                businessId: input.packagePurchase.businessId,
                packagePlanId: input.packagePurchase.packagePlanId,
                sourceAmountCents: String(input.amountCents),
                sourceCurrencyCode: input.currencyCode
              }
            }
          }
        }
      ],
      custom_text: {
        submit: {
          message: `QRSchedule — ${input.packagePurchase.packageName} at ${salonLabel}`
        }
      },
      metadata: {
        kind: 'package_purchase',
        businessId: input.packagePurchase.businessId,
        packagePurchaseId: input.packagePurchase.id,
        packagePlanId: input.packagePurchase.packagePlanId,
        sourceAmountCents: String(input.amountCents),
        sourceCurrencyCode: input.currencyCode,
        chargeAmountCents: String(chargeMoney.amountCents),
        chargeCurrencyCode: chargeMoney.currencyCode
      },
      payment_intent_data: paymentIntentData,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    });
  },

  async createSpecialServiceDepositCheckoutSession(
    input: CreateSpecialServiceDepositCheckoutSessionInput
  ): Promise<StripeCheckoutSession> {
    const chargeMoney = getStripeChargeMoney(input.amountCents, input.currencyCode);
    const paymentIntentData: StripePaymentIntentData = {
      metadata: {
        businessId: input.businessId,
        appointmentId: input.appointmentId,
        sourceAmountCents: String(input.amountCents),
        sourceCurrencyCode: input.currencyCode,
        chargeAmountCents: String(chargeMoney.amountCents),
        chargeCurrencyCode: chargeMoney.currencyCode
      }
    };

    if (input.destinationAccountId) {
      paymentIntentData.transfer_data = {
        destination: input.destinationAccountId
      };
      paymentIntentData.on_behalf_of = input.destinationAccountId;
    }

    const salonLabel = input.businessName?.trim() || input.businessId;

    return getStripeClient().checkout.sessions.create({
      mode: 'payment',
      customer_email: input.customerEmail || undefined,
      client_reference_id: input.appointmentId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: chargeMoney.currencyCode.toLowerCase(),
            unit_amount: chargeMoney.amountCents,
            product_data: {
              name: `${input.serviceName} — 5% advance deposit at ${salonLabel}`,
              metadata: {
                businessId: input.businessId,
                appointmentId: input.appointmentId,
                sourceAmountCents: String(input.amountCents),
                sourceCurrencyCode: input.currencyCode
              }
            }
          }
        }
      ],
      custom_text: {
        submit: {
          message: `QRSchedule — advance deposit for ${input.serviceName} at ${salonLabel}`
        }
      },
      metadata: {
        kind: 'special_service_deposit',
        businessId: input.businessId,
        appointmentId: input.appointmentId,
        sourceAmountCents: String(input.amountCents),
        sourceCurrencyCode: input.currencyCode,
        chargeAmountCents: String(chargeMoney.amountCents),
        chargeCurrencyCode: chargeMoney.currencyCode
      },
      payment_intent_data: paymentIntentData,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    });
  },

  async createSubscriptionCheckoutSession(
    input: CreateSubscriptionCheckoutSessionInput
  ): Promise<StripeCheckoutSession> {
    const chargeMoney = getStripeChargeMoney(input.plan.amountCents, input.plan.currencyCode);
    const salonLabel = input.businessName?.trim() || input.businessId;
    const productName = `${input.plan.name} — ${salonLabel}`;

    const client = getStripeClient();
    const customerId = await findOrCreateCustomer(client, input.businessId, salonLabel);

    return client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: chargeMoney.currencyCode.toLowerCase(),
            unit_amount: chargeMoney.amountCents,
            recurring: {
              interval: input.plan.billingInterval
            },
            product_data: {
              name: productName,
              description: input.plan.summary,
              metadata: {
                businessId: input.businessId,
                businessName: salonLabel,
                planId: input.plan.id,
                planKey: input.plan.key,
                sourceAmountCents: String(input.plan.amountCents),
                sourceCurrencyCode: input.plan.currencyCode
              }
            }
          }
        }
      ],
      custom_text: {
        submit: {
          message: `QRSchedule — ${input.plan.name} plan for ${salonLabel}`
        }
      },
      subscription_data: {
        description: `QRSchedule ${input.plan.name} — ${salonLabel}`,
        trial_period_days: input.plan.trialDays > 0 ? input.plan.trialDays : undefined,
        metadata: {
          businessId: input.businessId,
          businessName: salonLabel,
          planId: input.plan.id,
          planKey: input.plan.key,
          sourceAmountCents: String(input.plan.amountCents),
          sourceCurrencyCode: input.plan.currencyCode,
          chargeAmountCents: String(chargeMoney.amountCents),
          chargeCurrencyCode: chargeMoney.currencyCode
        }
      },
      metadata: {
        kind: 'subscription_checkout',
        businessId: input.businessId,
        businessName: salonLabel,
        planId: input.plan.id,
        planKey: input.plan.key,
        sourceAmountCents: String(input.plan.amountCents),
        sourceCurrencyCode: input.plan.currencyCode,
        chargeAmountCents: String(chargeMoney.amountCents),
        chargeCurrencyCode: chargeMoney.currencyCode
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl
    });
  },

  constructWebhookEvent(payload: Buffer, signature: string | undefined): StripeWebhookEvent {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new HttpError(503, 'Stripe webhook secret is not configured');
    }

    if (!signature) {
      throw new HttpError(400, 'Stripe signature is required');
    }

    return getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  }
};
