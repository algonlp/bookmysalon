import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../../config/env';

const timingSafeCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf-8');
  const bufferB = Buffer.from(b, 'utf-8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
};

// Gates the platform-wide admin settings (e.g. the Stripe on/off toggle).
// Deliberately separate from requirePlatformAdminAccess, which authenticates
// an individual salon's owner/manager via their own adminToken - this key is
// held only by ALGONLP staff and controls settings that affect every salon.
export const requireSuperAdminAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!env.PLATFORM_SUPER_ADMIN_KEY) {
    res.status(503).json({ error: 'Super admin access is not configured on this environment' });
    return;
  }

  const providedKey = req.header('x-super-admin-key')?.trim();

  if (!providedKey || !timingSafeCompare(providedKey, env.PLATFORM_SUPER_ADMIN_KEY)) {
    res.status(403).json({ error: 'Super admin access is required' });
    return;
  }

  next();
};
