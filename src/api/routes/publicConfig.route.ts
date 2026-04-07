import { Router } from 'express';
import { publicConfigController } from '../controllers/publicConfig.controller';

export const publicConfigRouter = Router();

publicConfigRouter.get('/public-config', publicConfigController);
