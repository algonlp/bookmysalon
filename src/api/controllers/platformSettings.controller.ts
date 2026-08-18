import type { Request, Response } from 'express';
import { z } from 'zod';
import { platformSettingsService } from '../../platform/platformSettings.service';
import { MANUAL_PAYMENT_METHOD_KEYS } from '../../platform/platformSettings.types';

const setStripeEnabledSchema = z.object({
  enabled: z.boolean()
});

const setManualPaymentMethodSchema = z.object({
  qrImageUrl: z.string().trim().optional(),
  instructions: z.string().trim().optional()
});

export const platformSettingsController = {
  async verifyAccess(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ ok: true });
  },

  async getOverview(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      stripe: await platformSettingsService.getStripeOverview(),
      manualPaymentMethods: await platformSettingsService.getManualPaymentMethods()
    });
  },

  async setStripeEnabled(req: Request, res: Response): Promise<void> {
    const { enabled } = setStripeEnabledSchema.parse(req.body);
    const updatedBy = req.header('x-super-admin-actor')?.trim() || undefined;

    res.status(200).json({
      stripe: await platformSettingsService.setStripeEnabled(enabled, updatedBy)
    });
  },

  async setManualPaymentMethod(req: Request, res: Response): Promise<void> {
    const method = MANUAL_PAYMENT_METHOD_KEYS.find((key) => key === req.params.method);

    if (!method) {
      res.status(404).json({ error: 'Unknown payment method' });
      return;
    }

    const input = setManualPaymentMethodSchema.parse(req.body);
    const updatedBy = req.header('x-super-admin-actor')?.trim() || undefined;

    res.status(200).json({
      manualPaymentMethods: await platformSettingsService.setManualPaymentMethod(method, input, updatedBy)
    });
  }
};
