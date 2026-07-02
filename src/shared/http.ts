import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

const secureCookies = env.APP_ENV === 'prod';
const defaultPublicOrigin = `http://localhost:${env.PORT}`;

export const getRequestOrigin = (_req: Request): string => {
  if (env.PUBLIC_BASE_URL) {
    return env.PUBLIC_BASE_URL;
  }

  return defaultPublicOrigin;
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

export const getAdminSessionCookieOptions = (persistent = true): CookieOptions => {
  const baseOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    path: '/'
  };

  if (!persistent) {
    return baseOptions;
  }

  return {
    ...baseOptions,
    maxAge: env.ADMIN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  };
};

export const setAdminSessionCookie = (res: Response, adminToken: string, persistent = true): void => {
  res.cookie(
    env.PLATFORM_ADMIN_COOKIE_NAME,
    adminToken,
    getAdminSessionCookieOptions(persistent)
  );
};

export const clearAdminSessionCookie = (res: Response): void => {
  const { maxAge: _maxAge, ...cookieOptions } = getAdminSessionCookieOptions();
  res.clearCookie(
    env.PLATFORM_ADMIN_COOKIE_NAME,
    cookieOptions
  );
};
