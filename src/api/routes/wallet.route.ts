import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requirePlatformAdminAccess } from '../middlewares/requirePlatformAdminAccess';
import { requireSuperAdminAccess } from '../middlewares/requireSuperAdminAccess';

export const walletRouter = Router();

walletRouter.get(
  '/platform/clients/:clientId/wallet',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(walletController.getOverview)
);

walletRouter.post(
  '/platform/clients/:clientId/wallet/topup',
  asyncHandler(requirePlatformAdminAccess),
  asyncHandler(walletController.requestTopup)
);

walletRouter.get(
  '/super-admin/wallet/topup-requests',
  requireSuperAdminAccess,
  asyncHandler(walletController.listPendingTopupRequests)
);

walletRouter.post(
  '/super-admin/wallet/topup-requests/:topupId/approve',
  requireSuperAdminAccess,
  asyncHandler(walletController.approveTopup)
);

walletRouter.post(
  '/super-admin/wallet/topup-requests/:topupId/reject',
  requireSuperAdminAccess,
  asyncHandler(walletController.rejectTopup)
);
