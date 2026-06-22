import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler';
import { customerAccountController } from '../controllers/customerAccount.controller';

export const customerAccountRouter = Router();

customerAccountRouter.get('/public/customers/me', asyncHandler(customerAccountController.getMe));
customerAccountRouter.patch('/public/customers/me', asyncHandler(customerAccountController.updateProfile));
customerAccountRouter.post('/public/customers/me/favorites', asyncHandler(customerAccountController.addFavorite));
customerAccountRouter.delete(
  '/public/customers/me/favorites',
  asyncHandler(customerAccountController.removeFavorite)
);
customerAccountRouter.patch(
  '/public/customers/me/settings',
  asyncHandler(customerAccountController.updateSettings)
);
