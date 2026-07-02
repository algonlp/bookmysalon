import request from 'supertest';
import type { Express } from 'express';

/**
 * Professional signup now requires OTP verification (SMS for mobileNumber,
 * email OTP otherwise). In test env the OTP is never actually dispatched
 * (see isTestEnvironment guards in twilioSms.service/emailOtp.service) and
 * the controller exposes the generated code as `otpCode` so tests can
 * complete the two-step flow. This helper hides that so call sites can keep
 * using `response.body.client` / `response.body.adminToken` exactly like
 * the old single-step signup.
 */
export const createTestClient = async (
  app: Express,
  payload: Record<string, unknown>
): Promise<request.Response> => {
  const initial = await request(app).post('/api/platform/clients').send(payload);

  if (!initial.body?.otpRequired) {
    return initial;
  }

  if (!initial.body?.otpCode) {
    return initial;
  }

  const verifyPayload = payload.mobileNumber
    ? { phone: payload.mobileNumber, code: initial.body.otpCode }
    : { email: payload.email, code: initial.body.otpCode };

  return request(app).post('/api/platform/clients/signup/verify').send(verifyPayload);
};
