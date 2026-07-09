import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireStaffAccess } from '../middlewares/requireStaffAccess';
import { staffAuthController } from '../controllers/staffAuth.controller';

export const staffAuthRouter = Router();

staffAuthRouter.post('/platform/staff-login', asyncHandler(staffAuthController.loginStaff));
staffAuthRouter.post(
  '/platform/clients/:clientId/staff/:teamMemberId/logout',
  asyncHandler(requireStaffAccess),
  asyncHandler(staffAuthController.logoutStaff)
);
