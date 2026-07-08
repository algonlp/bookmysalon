import type { NextFunction, Request, Response } from 'express';
import { billingService } from '../../billing/billing.service';

export const requireBillingFeature =
  (featureKey: string) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const businessId = req.params.clientId;

    if (!businessId) {
      res.status(400).json({ error: 'Business id is required' });
      return;
    }

    const overview = await billingService.getBillingOverview(businessId);

    if (overview.lockedFeatureKeys.includes(featureKey)) {
      res.status(403).json({ error: 'This feature requires a higher plan' });
      return;
    }

    next();
  };
