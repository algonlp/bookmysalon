import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requirePlatformAdminAccess } from '../middlewares/requirePlatformAdminAccess';

export const billingRouter = Router();

billingRouter.get(
  '/billing/subscription-plans',
  asyncHandler(billingController.listSubscriptionPlans)
);

billingRouter.get(
  '/billing/stripe-return',
  asyncHandler(billingController.handleStripeSubscriptionReturn)
);

billingRouter.put(
  '/billing/subscription-plans/:planId',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.updateSubscriptionPlan)
);

billingRouter.get(
  '/platform/clients/:clientId/billing',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.getBillingOverview)
);

billingRouter.post(
  '/platform/clients/:clientId/billing/checkout',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.createStripeSubscriptionCheckout)
);

billingRouter.post(
  '/platform/clients/:clientId/billing/checkout/confirm',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.confirmStripeSubscriptionCheckout)
);

billingRouter.post(
  '/platform/clients/:clientId/billing/demo-checkout',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.checkoutDemoSubscription)
);
