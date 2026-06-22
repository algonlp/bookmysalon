import { Router } from 'express';
import { appointmentRouter } from './appointment.route';
import { billingRouter } from './billing.route';
import { clientPlatformRouter } from './clientPlatform.route';
import { customerAccountRouter } from './customerAccount.route';
import { customerAuthRouter } from './customerAuth.route';
import { healthRouter } from './health.route';
import { locationRouter } from './location.route';
import { publicConfigRouter } from './publicConfig.route';

export const apiRouter = Router();

apiRouter.use('/', healthRouter);
apiRouter.use('/', locationRouter);
apiRouter.use('/', publicConfigRouter);
apiRouter.use('/', appointmentRouter);
apiRouter.use('/', billingRouter);
apiRouter.use('/', customerAuthRouter);
apiRouter.use('/', customerAccountRouter);
apiRouter.use('/', clientPlatformRouter);
