import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { clientPlatformRepository } from '../../platform/clientPlatform.repository';
import { clearAdminSessionCookie, getCookieValue } from '../../shared/http';

export const requirePlatformAdminAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const clientId = req.params.clientId;
  const adminToken =
    req.header('x-admin-token')?.trim() ??
    getCookieValue(req, env.PLATFORM_ADMIN_COOKIE_NAME)?.trim();

  if (!clientId || !adminToken) {
    if (clientId) {
      clearAdminSessionCookie(res, clientId);
    }

    res.status(403).json({ error: 'Admin access is required' });
    return;
  }

  const client = await clientPlatformRepository.getClientById(clientId);

  const isTokenValid =
    !!client && (client.adminToken ? client.adminToken === adminToken : client.id === adminToken);

  if (!isTokenValid) {
    clearAdminSessionCookie(res, clientId);
    res.status(403).json({ error: 'Admin access is required' });
    return;
  }

  next();
};
