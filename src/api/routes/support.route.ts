import { Router } from 'express';
import { supportController } from '../controllers/support.controller';
import { asyncHandler } from '../middlewares/asyncHandler';

export const supportRouter = Router();

supportRouter.post('/support/request', asyncHandler(supportController.submitSupportRequest));
