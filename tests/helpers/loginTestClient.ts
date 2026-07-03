import request from 'supertest';
import type { Express } from 'express';

/**
 * Professional login now always requires OTP verification (SMS for
 * mobileNumber, email OTP otherwise) — there is no longer a direct-login
 * shortcut for email-only accounts. In test env the OTP is never actually
 * dispatched and the controller exposes the generated code as `otpCode` so
 * tests can complete the two-step flow. This helper hides that so call
 * sites can keep using `response.body.client` / `response.body.adminToken`
 * exactly like a single-step login.
 */
export const loginTestClient = async (
  app: Express,
  payload: Record<string, unknown>
): Promise<request.Response> => {
  const initial = await request(app).post('/api/platform/clients/login').send(payload);

  if (!initial.body?.otpRequired) {
    return initial;
  }

  if (!initial.body?.otpCode) {
    return initial;
  }

  return request(app)
    .post('/api/platform/clients/otp/verify')
    .send({ clientId: initial.body.clientId, code: initial.body.otpCode });
};
