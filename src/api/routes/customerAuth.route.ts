import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { customerAuthController } from '../controllers/customerAuth.controller';

export const customerAuthRouter = Router();

customerAuthRouter.post('/public/customer-auth/otp/request', asyncHandler(customerAuthController.requestOtp));
customerAuthRouter.post('/public/customer-auth/otp/verify', asyncHandler(customerAuthController.verifyOtp));
