import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { billingService } from '../../billing/billing.service';
import { clientPlatformRepository } from '../../platform/clientPlatform.repository';
import { clientPlatformService } from '../../platform/clientPlatform.service';
import { emailService } from '../../notifications/email.service';
import { renderEmailLayout, BRAND_NAME } from '../../notifications/emailTemplate';
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

const checkoutSchema = z.object({
  planId: z.string().trim().min(1, 'Plan is required')
});

const soloFreeTrialSchema = z.object({
  name: z.string().trim().min(2, 'Your name is required'),
  email: z.string().trim().email('A valid email is required')
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

  async getBillingOverview(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(await billingService.getBillingOverview(getClientId(req)));
  },

  async startSoloFreeTrial(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = soloFreeTrialSchema.parse(req.body);

    const existingClient = await clientPlatformService.findClientForLogin({ email: input.email });

    if (existingClient) {
      throw new HttpError(
        409,
        'An account with this email already exists. Log in to manage your plan.'
      );
    }

    const temporaryPassword = `QrTrial-${randomUUID().slice(0, 8)}`;
    const { client, plainAdminToken } = await clientPlatformService.createClient({
      email: input.email,
      password: temporaryPassword,
      businessName: input.name,
      provider: 'email'
    });

    const { subscription, plan } = await billingService.startFreeTrialSubscription(
      client.id,
      'solo'
    );

    const origin = getRequestOrigin(req);
    const trialEndsAt = subscription.trialEndsAt ?? subscription.currentPeriodEnd;
    const trialEndLabel = new Date(trialEndsAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const emailResult = await emailService.sendEmail(
      {
        to: client.email,
        subject: `Your ${plan.name} free trial is active — 1 month free`,
        text: [
          `Hi ${input.name},`,
          '',
          `Your ${plan.name} plan free trial on ${BRAND_NAME} is now active. Every ${plan.name} feature is unlocked for one month, free — no card required.`,
          `Your trial runs until ${trialEndLabel}.`,
          '',
          'Log in with:',
          `  Email: ${client.email}`,
          `  Temporary password: ${temporaryPassword}`,
          '',
          `Open your workspace: ${origin}/login`,
          '',
          'You can change your password any time from Settings.'
        ].join('\n'),
        html: renderEmailLayout({
          preheader: `Your ${plan.name} free trial is active until ${trialEndLabel}.`,
          eyebrow: 'Free trial activated',
          heading: `Welcome, ${input.name} — your ${plan.name} month is free`,
          bodyHtml: `
            <p>Your <strong>${plan.name}</strong> plan free trial on ${BRAND_NAME} is now active.
            Every ${plan.name} feature is unlocked for one month, free — no card required.
            Your trial runs until <strong>${trialEndLabel}</strong>.</p>
            <p style="margin-top:16px">Log in with:</p>
            <p style="margin:8px 0 0">
              Email: <strong>${client.email}</strong><br />
              Temporary password: <strong>${temporaryPassword}</strong>
            </p>
            <p style="margin-top:16px">You can change your password any time from Settings.</p>
          `,
          button: {
            label: 'Open your workspace',
            url: `${origin}/login`
          }
        })
      },
      'admin',
      { businessId: client.id, source: 'free_trial' }
    );

    setAdminSessionCookie(res, plainAdminToken);
    res.status(201).json({
      clientId: client.id,
      planKey: plan.key,
      planName: plan.name,
      subscriptionStatus: subscription.status,
      trialEndsAt,
      emailStatus: emailResult.status
    });
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
