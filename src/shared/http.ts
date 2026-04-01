import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

const secureCookies = env.APP_ENV === 'prod';

export const getRequestOrigin = (req: Request): string => {
  if (env.PUBLIC_BASE_URL) {
    return env.PUBLIC_BASE_URL;
  }

  const host = req.get('host') ?? `localhost:${env.PORT}`;
  return `${req.protocol}://${host}`;
};

export const getCookieValue = (req: Request, cookieName: string): string | undefined => {
  const cookieHeader = req.header('cookie');

  if (!cookieHeader) {
    return undefined;
  }

  for (const pair of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = pair.trim().split('=');

    if (rawName !== cookieName) {
      continue;
    }

    return decodeURIComponent(rawValueParts.join('='));
  }

  return undefined;
};

export const getAdminSessionCookiePath = (clientId: string): string =>
  `/api/platform/clients/${encodeURIComponent(clientId)}`;

export const getAdminSessionCookieOptions = (clientId: string): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: secureCookies,
  path: getAdminSessionCookiePath(clientId),
  maxAge: env.ADMIN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
});

export const setAdminSessionCookie = (
  res: Response,
  clientId: string,
  adminToken: string
): void => {
  res.cookie(
    env.PLATFORM_ADMIN_COOKIE_NAME,
    adminToken,
    getAdminSessionCookieOptions(clientId)
  );
};

export const clearAdminSessionCookie = (res: Response, clientId: string): void => {
  const { maxAge: _maxAge, ...cookieOptions } = getAdminSessionCookieOptions(clientId);
  res.clearCookie(
    env.PLATFORM_ADMIN_COOKIE_NAME,
    cookieOptions
  );
};
