import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  handleVerificationGet,
  handleVerificationPost,
  type PaymentVerificationAdapter,
  type VerifiableRequest
} from '../../notifications/paymentVerification';
import { walletTopupAdapter } from '../../wallet/wallet.service';
import { subscriptionPaymentAdapter } from '../../billing/billing.service';
import { HttpError } from '../../shared/errors/httpError';

// Keyed by the adapter's own `kind` value ('wallet_topup' / 'subscription_payment'),
// which is exactly what buildConfirmUrl() embeds in the emailed link's :kind segment.
const kindToAdapter: Record<string, PaymentVerificationAdapter<VerifiableRequest>> = {
  [walletTopupAdapter.kind]: walletTopupAdapter,
  // Both adapters satisfy the same VerifiableRequest shape at runtime; the
  // cast is needed because TypeScript can't unify two different concrete T's
  // into one map value type, even though each entry is only ever used with
  // its own record type end-to-end.
  [subscriptionPaymentAdapter.kind]: subscriptionPaymentAdapter as unknown as PaymentVerificationAdapter<VerifiableRequest>
};

const getAdapter = (kindParam: string): PaymentVerificationAdapter<VerifiableRequest> => {
  const adapter = kindToAdapter[kindParam];

  if (!adapter) {
    throw new HttpError(404, 'Unknown payment verification type');
  }

  return adapter;
};

const confirmPostSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().optional(),
  operator: z.string().trim().optional()
});

export const paymentVerificationController = {
  async confirmGet(req: Request, res: Response): Promise<void> {
    const adapter = getAdapter(req.params.kind);
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const { status, html } = await handleVerificationGet(adapter, req.params.requestId, token);
    res.status(status).type('html').send(html);
  },

  async confirmPost(req: Request, res: Response): Promise<void> {
    const adapter = getAdapter(req.params.kind);
    const { token, decision, reason, operator } = confirmPostSchema.parse(req.body);
    const { status, html } = await handleVerificationPost(
      adapter,
      req.params.requestId,
      token,
      decision,
      reason,
      operator
    );
    res.status(status).type('html').send(html);
  }
};
