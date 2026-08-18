import request from 'supertest';
import { vi } from 'vitest';
import { app } from '../../src/app';
import { env } from '../../src/config/env';
import { walletService } from '../../src/wallet/wallet.service';
import { walletRepository, resetWalletRepositoryForTests } from '../../src/wallet/wallet.repository';
import { resetClientPlatformRepositoryForTests } from '../../src/platform/clientPlatform.repository';
import { emailService } from '../../src/notifications/email.service';
import { createTestClient } from '../helpers/createTestClient';

// vi.spyOn call history accumulates across `it` blocks in this file (no
// clearMocks configured), so extraction must be scoped to this specific
// request's id rather than just "the first [Verify] email seen so far".
const extractVerifyTokenForRequest = (
  calls: Array<[{ text: string; subject: string }, ...unknown[]]>,
  requestId: string
): string => {
  const pattern = new RegExp(`/api/payments/verify/wallet_topup/${requestId}\\?token=([a-f0-9]+)`);
  const match = calls.map(([message]) => message.text.match(pattern)).find((entry) => entry);

  if (!match) {
    throw new Error(`No verification link found for request ${requestId}`);
  }

  return match[1];
};

describe('Communication wallet', () => {
  const originalSuperAdminKey = env.PLATFORM_SUPER_ADMIN_KEY;
  const TEST_SUPER_ADMIN_KEY = 'test-super-admin-key';

  beforeEach(async () => {
    env.PLATFORM_SUPER_ADMIN_KEY = TEST_SUPER_ADMIN_KEY;
    await resetWalletRepositoryForTests();
    await resetClientPlatformRepositoryForTests();
  });

  afterAll(() => {
    env.PLATFORM_SUPER_ADMIN_KEY = originalSuperAdminKey;
  });

  it('starts a new business at a zero balance', async () => {
    const createResponse = await createTestClient(app, {
      email: 'wallet-zero@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const response = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);

    expect(response.status).toBe(200);
    expect(response.body.balanceCents).toBe(0);
    expect(response.body.currencyCode).toBe('PKR');
    expect(response.body.transactions).toEqual([]);
  });

  it('rejects a top-up request with an amount that is not a preset or a valid custom amount', async () => {
    const createResponse = await createTestClient(app, {
      email: 'wallet-invalid-amount@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const response = await request(app)
      .post(`/api/platform/clients/${clientId}/wallet/topup`)
      .set('x-admin-token', adminToken)
      .send({
        amountCents: 4999, // not a preset and below the Rs100 custom floor... actually above floor but not preset
        paymentMethod: 'bank_transfer',
        paymentProofDataUrl: 'data:image/png;base64,fake',
        transactionReference: 'TXN123'
      });

    // 4999 cents = Rs49.99, below the Rs100 minimum for custom amounts.
    expect(response.status).toBe(400);
  });

  it('runs a full top-up lifecycle: request -> super-admin approval -> wallet credited', async () => {
    const createResponse = await createTestClient(app, {
      email: 'wallet-topup@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const requestResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/wallet/topup`)
      .set('x-admin-token', adminToken)
      .send({
        amountCents: 100000, // Rs1,000 preset
        paymentMethod: 'easypaisa',
        paymentProofDataUrl: 'data:image/png;base64,fakeproof',
        transactionReference: 'TXN-1000'
      });

    expect(requestResponse.status).toBe(201);
    expect(requestResponse.body.topupRequest.status).toBe('pending_review');
    const topupId = requestResponse.body.topupRequest.id as string;

    // Not yet approved - balance should still be zero.
    const beforeApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(beforeApproval.body.balanceCents).toBe(0);
    expect(beforeApproval.body.pendingTopupRequests).toHaveLength(1);

    // Wrong super-admin key is rejected.
    const wrongKeyResponse = await request(app)
      .post(`/api/super-admin/wallet/topup-requests/${topupId}/approve`)
      .set('x-super-admin-key', 'not-the-right-key');
    expect(wrongKeyResponse.status).toBe(403);

    // Correct key approves it.
    const approveResponse = await request(app)
      .post(`/api/super-admin/wallet/topup-requests/${topupId}/approve`)
      .set('x-super-admin-key', TEST_SUPER_ADMIN_KEY)
      .set('x-super-admin-actor', 'algonlp-ops');
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.topupRequest.status).toBe('approved');

    const afterApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(afterApproval.body.balanceCents).toBe(100000);
    expect(afterApproval.body.pendingTopupRequests).toHaveLength(0);
    expect(afterApproval.body.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'paid_topup',
          amountCents: 100000,
          balanceBeforeCents: 0,
          balanceAfterCents: 100000,
          operator: 'algonlp-ops'
        })
      ])
    );

    // Approving again is idempotent - does not double-credit.
    const secondApprove = await request(app)
      .post(`/api/super-admin/wallet/topup-requests/${topupId}/approve`)
      .set('x-super-admin-key', TEST_SUPER_ADMIN_KEY);
    expect(secondApprove.status).toBe(200);

    const afterSecondApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(afterSecondApproval.body.balanceCents).toBe(100000);
  });

  it('rejecting a top-up request leaves the balance unchanged', async () => {
    const createResponse = await createTestClient(app, {
      email: 'wallet-reject@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const requestResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/wallet/topup`)
      .set('x-admin-token', adminToken)
      .send({
        amountCents: 50000,
        paymentMethod: 'jazzcash',
        paymentProofDataUrl: 'data:image/png;base64,fakeproof',
        transactionReference: ''
      });
    const topupId = requestResponse.body.topupRequest.id as string;

    const rejectResponse = await request(app)
      .post(`/api/super-admin/wallet/topup-requests/${topupId}/reject`)
      .set('x-super-admin-key', TEST_SUPER_ADMIN_KEY)
      .send({ reason: 'Payment proof does not match transaction reference' });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.topupRequest.status).toBe('rejected');
    expect(rejectResponse.body.topupRequest.rejectionReason).toBe(
      'Payment proof does not match transaction reference'
    );

    const overview = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(overview.body.balanceCents).toBe(0);
  });

  it('emails an admin verification link on request, and the emailed link approves the top-up exactly once', async () => {
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail');

    const createResponse = await createTestClient(app, {
      email: 'wallet-verify-link@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const requestResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/wallet/topup`)
      .set('x-admin-token', adminToken)
      .send({
        amountCents: 50000,
        paymentMethod: 'bank_transfer',
        paymentProofDataUrl: 'data:image/png;base64,fakeproof',
        transactionReference: 'TXN-VERIFY'
      });
    expect(requestResponse.status).toBe(201);
    const topupId = requestResponse.body.topupRequest.id as string;

    const token = extractVerifyTokenForRequest(sendEmailSpy.mock.calls as never, topupId);

    // GET renders the confirm page but must never mutate state on its own
    // (protects against email-client/link-scanner prefetch triggering a
    // false approval).
    const getResponse = await request(app).get(`/api/payments/verify/wallet_topup/${topupId}?token=${token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.text).toContain('Approve');

    const beforeApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(beforeApproval.body.balanceCents).toBe(0);

    // POST with the token performs the actual approval.
    const callCountBeforePost = sendEmailSpy.mock.calls.length;
    const postResponse = await request(app)
      .post(`/api/payments/verify/wallet_topup/${topupId}`)
      .type('form')
      .send({ token, decision: 'approve' });
    expect(postResponse.status).toBe(200);

    const afterApproval = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(afterApproval.body.balanceCents).toBe(50000);

    // A buyer confirmation email was sent as a direct result of this approval.
    const callsSincePost = sendEmailSpy.mock.calls.slice(callCountBeforePost);
    expect(callsSincePost.some(([message]) => message.subject.includes('confirmed'))).toBe(true);

    // Replaying the exact same link must not double-credit the wallet.
    const replayResponse = await request(app)
      .post(`/api/payments/verify/wallet_topup/${topupId}`)
      .type('form')
      .send({ token, decision: 'approve' });
    expect(replayResponse.status).toBe(200);
    expect(replayResponse.text).toContain('Already reviewed');

    const afterReplay = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(afterReplay.body.balanceCents).toBe(50000);
  });

  it('rejects an expired verification link and leaves the request pending', async () => {
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail');

    const createResponse = await createTestClient(app, {
      email: 'wallet-verify-expired@example.com',
      provider: 'email'
    });
    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const requestResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/wallet/topup`)
      .set('x-admin-token', adminToken)
      .send({
        amountCents: 50000,
        paymentMethod: 'easypaisa',
        paymentProofDataUrl: 'data:image/png;base64,fakeproof',
        transactionReference: 'TXN-EXPIRED'
      });
    const topupId = requestResponse.body.topupRequest.id as string;

    const token = extractVerifyTokenForRequest(sendEmailSpy.mock.calls as never, topupId);

    const stored = await walletRepository.getTopupRequestById(topupId);
    await walletRepository.saveTopupRequest({
      ...stored!,
      verificationTokenExpiresAt: new Date(Date.now() - 1000).toISOString()
    });

    const getResponse = await request(app).get(`/api/payments/verify/wallet_topup/${topupId}?token=${token}`);
    expect(getResponse.status).toBe(410);

    const overview = await request(app)
      .get(`/api/platform/clients/${clientId}/wallet`)
      .set('x-admin-token', adminToken);
    expect(overview.body.balanceCents).toBe(0);
    expect(overview.body.pendingTopupRequests).toHaveLength(1);
  });

  it('blocks a campaign send with insufficient wallet balance and never double-charges on retry', async () => {
    const businessId = 'wallet-test-business';

    // First reservation against a zero balance must fail.
    await expect(
      walletService.reserveAndDeductForCampaign(businessId, 'campaign-1', 1000)
    ).rejects.toThrow(/Insufficient wallet balance/);

    // Grant enough promotional credit to cover it.
    await walletService.grantPromotionalCredit(businessId, 1000, 'test credit');

    const firstAttempt = await walletService.reserveAndDeductForCampaign(businessId, 'campaign-1', 1000);
    expect(firstAttempt.balanceAfterCents).toBe(0);

    // Retrying the exact same campaign send must not deduct a second time.
    const secondAttempt = await walletService.reserveAndDeductForCampaign(businessId, 'campaign-1', 1000);
    expect(secondAttempt.id).toBe(firstAttempt.id);
    expect(secondAttempt.balanceAfterCents).toBe(0);
  });
});
