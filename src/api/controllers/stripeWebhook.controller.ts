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

const getStringId = (value: StripeCheckoutSessionPayload['payment_intent']): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  return value?.id;
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
