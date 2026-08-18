import type { Request, Response } from 'express';
import { z } from 'zod';
import { walletService } from '../../wallet/wallet.service';
import { getRequestOrigin } from '../../shared/http';
import { MANUAL_PAYMENT_METHOD_KEYS } from '../../platform/platformSettings.types';

const getClientId = (req: Request): string => req.params.clientId;

const requestTopupSchema = z.object({
  amountCents: z.coerce.number().int().positive(),
  paymentMethod: z.enum(MANUAL_PAYMENT_METHOD_KEYS),
  paymentProofDataUrl: z.string().trim().min(1, 'Payment proof is required'),
  transactionReference: z.string().trim().optional().default('')
});

const rejectTopupSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required')
});

export const walletController = {
  async getOverview(req: Request, res: Response): Promise<void> {
    res.status(200).json(await walletService.getOverview(getClientId(req)));
  },

  async requestTopup(req: Request, res: Response): Promise<void> {
    const input = requestTopupSchema.parse(req.body);
    const request = await walletService.requestTopup(getClientId(req), input, getRequestOrigin(req));
    res.status(201).json({ topupRequest: request });
  },

  async listPendingTopupRequests(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ topupRequests: await walletService.listPendingTopupRequests() });
  },

  async approveTopup(req: Request, res: Response): Promise<void> {
    const operator = req.header('x-super-admin-actor')?.trim() || undefined;
    const request = await walletService.approveTopup(req.params.topupId, operator);
    res.status(200).json({ topupRequest: request });
  },

  async rejectTopup(req: Request, res: Response): Promise<void> {
    const { reason } = rejectTopupSchema.parse(req.body);
    const operator = req.header('x-super-admin-actor')?.trim() || undefined;
    const request = await walletService.rejectTopup(req.params.topupId, operator, reason);
    res.status(200).json({ topupRequest: request });
  }
};
