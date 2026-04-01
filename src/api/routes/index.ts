import { Router } from 'express';
import { appointmentRouter } from './appointment.route';
import { clientPlatformRouter } from './clientPlatform.route';
import { healthRouter } from './health.route';

export const apiRouter = Router();

apiRouter.use('/', healthRouter);
apiRouter.use('/', appointmentRouter);
apiRouter.use('/', clientPlatformRouter);
