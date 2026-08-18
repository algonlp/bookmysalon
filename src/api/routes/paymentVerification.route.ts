import { Router, urlencoded } from 'express';
import { paymentVerificationController } from '../controllers/paymentVerification.controller';
import { asyncHandler } from '../middlewares/asyncHandler';

export const paymentVerificationRouter = Router();

// No requirePlatformAdminAccess/requireSuperAdminAccess here on purpose: the
// single-use, expiring token embedded in the emailed link IS the auth for
// this route (see src/notifications/paymentVerification.ts).
paymentVerificationRouter.get(
  '/payments/verify/:kind/:requestId',
  asyncHandler(paymentVerificationController.confirmGet)
);

// The confirm page (renderConfirmPage) submits a plain HTML <form>, which
// posts as application/x-www-form-urlencoded - the app only parses JSON
// bodies globally, so this route parses its own form body instead of
// changing that global default for every other route.
paymentVerificationRouter.post(
  '/payments/verify/:kind/:requestId',
  urlencoded({ extended: true }),
  asyncHandler(paymentVerificationController.confirmPost)
);
