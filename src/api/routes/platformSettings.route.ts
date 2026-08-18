import { Router } from 'express';
import { platformSettingsController } from '../controllers/platformSettings.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireSuperAdminAccess } from '../middlewares/requireSuperAdminAccess';

export const platformSettingsRouter = Router();

platformSettingsRouter.post(
  '/super-admin/verify',
  requireSuperAdminAccess,
  asyncHandler(platformSettingsController.verifyAccess)
);

platformSettingsRouter.get(
  '/super-admin/settings',
  requireSuperAdminAccess,
  asyncHandler(platformSettingsController.getOverview)
);

platformSettingsRouter.patch(
  '/super-admin/settings/stripe',
  requireSuperAdminAccess,
  asyncHandler(platformSettingsController.setStripeEnabled)
);

platformSettingsRouter.patch(
  '/super-admin/settings/manual-payment/:method',
  requireSuperAdminAccess,
  asyncHandler(platformSettingsController.setManualPaymentMethod)
);
