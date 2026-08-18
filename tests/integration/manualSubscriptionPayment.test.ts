import request from 'supertest';
import { vi } from 'vitest';
import { app } from '../../src/app';
import { env } from '../../src/config/env';
import { resetBillingRepositoryForTests } from '../../src/billing/billing.repository';
import { resetClientPlatformRepositoryForTests } from '../../src/platform/clientPlatform.repository';
import { emailService } from '../../src/notifications/email.service';
import { createTestClient } from '../helpers/createTestClient';

const extractVerifyToken = (text: string): string => {
  const match = text.match(/\/api\/payments\/verify\/subscription_payment\/[^\s?]+\?token=([a-f0-9]+)/);

  if (!match) {
    throw new Error(`No verification link found in email text: ${text}`);
  }

  return match[1];
};

describe('Manual (Raast) subscription payment', () => {
  const originalSuperAdminKey = env.PLATFORM_SUPER_ADMIN_KEY;
  const TEST_SUPER_ADMIN_KEY = 'test-super-admin-key';

  beforeEach(async () => {
    env.PLATFORM_SUPER_ADMIN_KEY = TEST_SUPER_ADMIN_KEY;
    await resetBillingRepositoryForTests();
    await resetClientPlatformRepositoryForTests();
  });

  afterAll(() => {
    env.PLATFORM_SUPER_ADMIN_KEY = originalSuperAdminKey;
  });

  it('runs a full lifecycle: submit -> admin email link -> approve -> subscription active -> buyer confirmation', async () => {
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail');

    const createResponse = await createTestClient(app, {
      email: 'manual-sub-payment@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const plansResponse = await request(app).get('/api/billing/subscription-plans');
    const planId = plansResponse.body.plans[0].id as string;

    const submitResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/billing/manual-payment`)
      .set('x-admin-token', adminToken)
      .send({
        planId,
        paymentMethod: 'jazzcash',
        paymentProofDataUrl: 'data:image/png;base64,fakeproof',
        transactionReference: 'TXN-SUB-1'
      });
    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.paymentRequest.status).toBe('pending_review');
    const requestId = submitResponse.body.paymentRequest.id as string;

    const adminCall = sendEmailSpy.mock.calls.find(([message]) => message.subject.startsWith('[Verify]'));
    expect(adminCall).toBeDefined();
    expect(adminCall![0].subject).toContain('Subscription payment');
    const token = extractVerifyToken(adminCall![0].text);

    // No subscription yet.
    const beforeApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/billing`)
      .set('x-admin-token', adminToken);
    expect(beforeApproval.body.currentPlan).toBeFalsy();

    // GET must not mutate state.
    const getResponse = await request(app).get(
      `/api/payments/verify/subscription_payment/${requestId}?token=${token}`
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.text).toContain('Approve');

    // POST performs the actual approval and activates the plan.
    const postResponse = await request(app)
      .post(`/api/payments/verify/subscription_payment/${requestId}`)
      .type('form')
      .send({ token, decision: 'approve' });
    expect(postResponse.status).toBe(200);

    const afterApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/billing`)
      .set('x-admin-token', adminToken);
    expect(afterApproval.body.currentPlan?.id).toBe(planId);
    expect(afterApproval.body.subscription?.provider).toBe('manual');

    expect(
      sendEmailSpy.mock.calls.some(([message]) => message.subject.includes('confirmed'))
    ).toBe(true);

    // Replaying the link must not re-activate/duplicate the subscription.
    const replayResponse = await request(app)
      .post(`/api/payments/verify/subscription_payment/${requestId}`)
      .type('form')
      .send({ token, decision: 'approve' });
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.text).toContain('Already reviewed');

    const afterReplay = await request(app)
      .get(`/api/platform/clients/${clientId}/billing`)
      .set('x-admin-token', adminToken);
    expect(afterReplay.body.subscription?.id).toBe(afterApproval.body.subscription?.id);
  });

  it('rejecting a manual payment request never activates a subscription', async () => {
    const createResponse = await createTestClient(app, {
      email: 'manual-sub-reject@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const plansResponse = await request(app).get('/api/billing/subscription-plans');
    const planId = plansResponse.body.plans[0].id as string;

    const submitResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/billing/manual-payment`)
      .set('x-admin-token', adminToken)
      .send({
        planId,
        paymentMethod: 'bank_transfer',
        paymentProofDataUrl: 'data:image/png;base64,fakeproof',
        transactionReference: ''
      });
    const requestId = submitResponse.body.paymentRequest.id as string;

    const rejectResponse = await request(app)
      .post(`/api/super-admin/billing/manual-payment-requests/${requestId}/reject`)
      .set('x-super-admin-key', TEST_SUPER_ADMIN_KEY)
      .send({ reason: 'Amount does not match plan price' });
    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.paymentRequest.status).toBe('rejected');

    const overview = await request(app)
      .get(`/api/platform/clients/${clientId}/billing`)
      .set('x-admin-token', adminToken);
    expect(overview.body.currentPlan).toBeFalsy();
  });
});
