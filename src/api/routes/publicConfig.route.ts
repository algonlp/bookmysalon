import { Router } from 'express';
import { publicConfigController } from '../controllers/publicConfig.controller';
import { asyncHandler } from '../middlewares/asyncHandler';

export const publicConfigRouter = Router();

publicConfigRouter.get('/public-config', asyncHandler(publicConfigController));
