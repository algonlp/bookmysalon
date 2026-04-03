import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { clientPlatformRepository } from '../../platform/clientPlatform.repository';
import { clearAdminSessionCookie, getCookieValue } from '../../shared/http';

const getClientIdFromPageRequest = (req: Request): string | undefined => {
  const clientId = req.query.clientId;

  return typeof clientId === 'string' && clientId.trim().length > 0
    ? clientId.trim()
    : undefined;
};

const getAdminTokenFromRequest = (req: Request): string | undefined =>
  req.header('x-admin-token')?.trim() ??
  getCookieValue(req, env.PLATFORM_ADMIN_COOKIE_NAME)?.trim();

const hasPlatformAdminAccess = async (
  clientId: string,
  adminToken: string
): Promise<boolean> => {
  const client = await clientPlatformRepository.getClientById(clientId);

  return !!client && client.adminToken === adminToken;
};

export const requirePlatformAdminAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const clientId = req.params.clientId;
  const adminToken = getAdminTokenFromRequest(req);

  if (!clientId || !adminToken) {
    clearAdminSessionCookie(res);
    res.status(403).json({ error: 'Admin access is required' });
    return;
  }

  const isTokenValid = await hasPlatformAdminAccess(clientId, adminToken);

  if (!isTokenValid) {
    clearAdminSessionCookie(res);
    res.status(403).json({ error: 'Admin access is required' });
    return;
  }

  next();
};

export const requirePlatformAdminPageAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const clientId = getClientIdFromPageRequest(req);
  const adminToken = getAdminTokenFromRequest(req);

  if (!clientId || !adminToken) {
    clearAdminSessionCookie(res);
    res.redirect('/signup');
    return;
  }

  const isTokenValid = await hasPlatformAdminAccess(clientId, adminToken);

  if (!isTokenValid) {
    clearAdminSessionCookie(res);
    res.redirect('/signup');
    return;
  }

  next();
};
