import type { Request, Response } from 'express';
import { appointmentService } from '../../appointments/appointment.service';
import { billingService } from '../../billing/billing.service';
import { stripePaymentService } from '../../payments/stripePayment.service';
import { clientPlatformService } from '../../platform/clientPlatform.service';

interface StripeCheckoutSessionPayload {
  id: string;
  metadata?: Record<string, string>;
  payment_intent?: string | { id?: string } | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
}

interface StripeInvoicePayload {
  id: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string; metadata?: Record<string, string> } | null;
  status?: string;
  paid?: boolean;
  amount_paid?: number | null;
  currency?: string | null;
  created?: number | null;
  period_start?: number | null;
  period_end?: number | null;
  metadata?: Record<string, string>;
  subscription_details?: {
    metadata?: Record<string, string>;
  } | null;
  lines?: {
    data?: Array<{
      period?: {
        start?: number | null;
        end?: number | null;
      } | null;
    }>;
  } | null;
}

interface StripeSubscriptionPayload {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string;
  current_period_start?: number | null;
  current_period_end?: number | null;
  canceled_at?: number | null;
  metadata?: Record<string, string>;
}

const getStringId = (
  value: string | { id?: string } | null | undefined
): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  return value?.id;
};

const fromUnixSeconds = (value: number | undefined | null): string | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : undefined;

const getInvoiceMetadata = (invoice: StripeInvoicePayload): Record<string, string> => ({
  ...(typeof invoice.subscription === 'object' && invoice.subscription?.metadata
    ? invoice.subscription.metadata
    : {}),
  ...(invoice.subscription_details?.metadata ?? {}),
  ...(invoice.metadata ?? {})
});

const getInvoicePeriod = (
  invoice: StripeInvoicePayload
): { periodStart?: string; periodEnd?: string } => {
  const linePeriod = invoice.lines?.data?.[0]?.period;

  return {
    periodStart: fromUnixSeconds(linePeriod?.start ?? invoice.period_start),
    periodEnd: fromUnixSeconds(linePeriod?.end ?? invoice.period_end)
  };
};

export const stripeWebhookController = {
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const event = stripePaymentService.constructWebhookEvent(
      req.body as Buffer,
      req.header('stripe-signature')
    );

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as StripeCheckoutSessionPayload;

      if (session.metadata?.kind === 'package_purchase' && session.payment_status === 'paid') {
        await appointmentService.activateStripePackagePurchase(
          session.id,
          getStringId(session.payment_intent)
        );
      }

      if (session.metadata?.kind === 'special_service_deposit' && session.payment_status === 'paid') {
        await appointmentService.activateSpecialServiceDeposit(
          session.id,
          getStringId(session.payment_intent)
        );
      }

      if (
        event.type === 'checkout.session.completed' &&
        session.payment_status === 'paid' &&
        session.metadata?.kind === 'subscription_checkout' &&
        session.metadata.businessId &&
        session.metadata.planId &&
        getStringId(session.subscription)
      ) {
        await billingService.activateStripeSubscriptionCheckout({
          businessId: session.metadata.businessId,
          planId: session.metadata.planId,
          providerCustomerId: getStringId(session.customer),
          providerSubscriptionId: getStringId(session.subscription)
        });
      }
    }

    if (
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object as StripeCheckoutSessionPayload;

      if (session.metadata?.kind === 'package_purchase') {
        await appointmentService.markStripePackagePurchasePaymentFailed(session.id);
      }

      if (session.metadata?.kind === 'special_service_deposit') {
        await appointmentService.markSpecialServiceDepositFailed(session.id);
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as StripeInvoicePayload;
      const providerSubscriptionId = getStringId(invoice.subscription);

      if (providerSubscriptionId && (invoice.paid === true || invoice.status === 'paid')) {
        const { periodStart, periodEnd } = getInvoicePeriod(invoice);

        await billingService.recordStripeInvoicePaid({
          providerInvoiceId: invoice.id,
          providerSubscriptionId,
          providerCustomerId: getStringId(invoice.customer),
          amountPaidCents: invoice.amount_paid ?? undefined,
          currencyCode: invoice.currency?.toUpperCase() ?? undefined,
          periodStart,
          periodEnd,
          paidAt: fromUnixSeconds(invoice.created),
          metadata: getInvoiceMetadata(invoice)
        });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as StripeInvoicePayload;
      const providerSubscriptionId = getStringId(invoice.subscription);

      if (providerSubscriptionId) {
        await billingService.markStripeInvoicePaymentFailed({
          providerSubscriptionId,
          failedAt: fromUnixSeconds(invoice.created)
        });
      }
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as StripeSubscriptionPayload;

      await billingService.syncStripeSubscriptionLifecycle({
        providerSubscriptionId: subscription.id,
        providerCustomerId: getStringId(subscription.customer),
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status,
        currentPeriodStart: fromUnixSeconds(subscription.current_period_start),
        currentPeriodEnd: fromUnixSeconds(subscription.current_period_end),
        cancelledAt: fromUnixSeconds(subscription.canceled_at),
        metadata: subscription.metadata
      });
    }

    if (event.type === 'account.updated') {
      await clientPlatformService.syncStripeConnectAccount(
        stripePaymentService.toConnectAccountStatus(
          event.data.object as Parameters<typeof stripePaymentService.toConnectAccountStatus>[0]
        )
      );
    }

    res.status(200).json({ received: true });
  }
};
