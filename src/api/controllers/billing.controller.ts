import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { billingService } from '../../billing/billing.service';
import { HttpError } from '../../shared/errors/httpError';

const demoCheckoutSchema = z.object({
  planId: z.string().trim().min(1, 'Plan is required'),
  cardholderName: z.string().trim().min(2, 'Cardholder name is required'),
  cardNumber: z.string().trim().min(12, 'Demo card number is required'),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2026).max(2100),
  cvc: z.string().trim().min(3).max(4),
  billingEmail: z.string().trim().email().optional().or(z.literal(''))
});

const getClientId = (req: Request): string => {
  if (!req.params.clientId) {
    throw new HttpError(400, 'Client id is required');
  }

  return req.params.clientId;
};

export const billingController = {
  async listSubscriptionPlans(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(await billingService.listSubscriptionPlans());
  },

  async getBillingOverview(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(await billingService.getBillingOverview(getClientId(req)));
  },

  async checkoutDemoSubscription(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    res.status(201).json(
      await billingService.checkoutDemoSubscription(
        getClientId(req),
        demoCheckoutSchema.parse(req.body)
      )
    );
  }
};
