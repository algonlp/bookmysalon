import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requirePlatformAdminAccess } from '../middlewares/requirePlatformAdminAccess';
import { requireSuperAdminAccess } from '../middlewares/requireSuperAdminAccess';

export const billingRouter = Router();

billingRouter.get(
  '/billing/subscription-plans',
  asyncHandler(billingController.listSubscriptionPlans)
);

billingRouter.post(
  '/billing/solo-free-trial',
  asyncHandler(billingController.startSoloFreeTrial)
);

billingRouter.get(
  '/billing/stripe-return',
  asyncHandler(billingController.handleStripeSubscriptionReturn)
);

billingRouter.get(
  '/platform/clients/:clientId/billing',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.getBillingOverview)
);

billingRouter.get(
  '/platform/clients/:clientId/billing/plans/:planId/downgrade-eligibility',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.getDowngradePlanEligibility)
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

billingRouter.post(
  '/platform/clients/:clientId/billing/manual-payment',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(billingController.requestManualSubscriptionPayment)
);

billingRouter.get(
  '/super-admin/billing/manual-payment-requests',
  requireSuperAdminAccess,
  asyncHandler(billingController.listPendingManualSubscriptionPaymentRequests)
);

billingRouter.post(
  '/super-admin/billing/manual-payment-requests/:requestId/approve',
  requireSuperAdminAccess,
  asyncHandler(billingController.approveManualSubscriptionPayment)
);

billingRouter.post(
  '/super-admin/billing/manual-payment-requests/:requestId/reject',
  requireSuperAdminAccess,
  asyncHandler(billingController.rejectManualSubscriptionPayment)
);
