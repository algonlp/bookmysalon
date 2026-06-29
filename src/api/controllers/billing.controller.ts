import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { billingService } from '../../billing/billing.service';
import { clientPlatformRepository } from '../../platform/clientPlatform.repository';
import { HttpError } from '../../shared/errors/httpError';
import { hashAdminToken } from '../../shared/hashToken';
import { getRequestOrigin, setAdminSessionCookie } from '../../shared/http';

const demoCheckoutSchema = z.object({
  planId: z.string().trim().min(1, 'Plan is required'),
  cardholderName: z.string().trim().min(2, 'Cardholder name is required'),
  cardNumber: z.string().trim().min(12, 'Demo card number is required'),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2026).max(2100),
  cvc: z.string().trim().min(3).max(4),
  billingEmail: z.string().trim().email().optional().or(z.literal(''))
});

const updatePlanSchema = z.object({
  name: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  amountCents: z.coerce.number().int().min(0).optional(),
  badgeLabel: z.string().trim().optional(),
  trialDays: z.coerce.number().int().min(0).optional(),
  includedAppointmentCredits: z.coerce.number().int().min(0).optional()
});

const checkoutSchema = z.object({
  planId: z.string().trim().min(1, 'Plan is required')
});

const confirmCheckoutSchema = z.object({
  checkoutSessionId: z.string().trim().min(1, 'Checkout session id is required')
});

const stripeReturnSchema = z.object({
  session_id: z.string().trim().min(1, 'Checkout session id is required')
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

  async updateSubscriptionPlan(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const planId = req.params.planId;

    if (!planId) {
      throw new HttpError(400, 'Plan id is required');
    }

    const updates = updatePlanSchema.parse(req.body);
    const plan = await billingService.updateSubscriptionPlan(planId, updates);
    res.status(200).json(plan);
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
  },

  async createStripeSubscriptionCheckout(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    res.status(201).json(
      await billingService.createStripeSubscriptionCheckout(
        getClientId(req),
        checkoutSchema.parse(req.body),
        getRequestOrigin(req)
      )
    );
  },

  async confirmStripeSubscriptionCheckout(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    res.status(200).json(
      await billingService.confirmStripeSubscriptionCheckout(
        getClientId(req),
        confirmCheckoutSchema.parse(req.body).checkoutSessionId
      )
    );
  },

  async handleStripeSubscriptionReturn(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const { session_id: checkoutSessionId } = stripeReturnSchema.parse(req.query);
    const confirmation = await billingService.confirmStripeSubscriptionReturn(checkoutSessionId);
    const client = await clientPlatformRepository.getClientById(confirmation.businessId);

    if (!client) {
      throw new HttpError(404, 'Business not found');
    }

    const plainAdminToken = randomUUID();
    await clientPlatformRepository.saveClient({
      ...client,
      adminToken: hashAdminToken(plainAdminToken),
      updatedAt: new Date().toISOString()
    });
    setAdminSessionCookie(res, plainAdminToken);
    res.redirect(
      303,
      `/calendar?clientId=${encodeURIComponent(confirmation.businessId)}&subscriptionCheckout=success`
    );
  }
};
