import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';

const secureCookies = env.APP_ENV === 'prod';
const defaultPublicOrigin = `http://localhost:${env.PORT}`;

export const getRequestOrigin = (req: Request): string => {
  if (env.PUBLIC_BASE_URL) {
    return env.PUBLIC_BASE_URL;
  }

  return req.secure ? defaultPublicOrigin.replace('http://', 'https://') : defaultPublicOrigin;
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

export const getAdminSessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: secureCookies,
  path: '/',
  maxAge: env.ADMIN_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
});

export const setAdminSessionCookie = (res: Response, adminToken: string): void => {
  res.cookie(
    env.PLATFORM_ADMIN_COOKIE_NAME,
    adminToken,
    getAdminSessionCookieOptions()
  );
};

export const clearAdminSessionCookie = (res: Response): void => {
  const { maxAge: _maxAge, ...cookieOptions } = getAdminSessionCookieOptions();
  res.clearCookie(
    env.PLATFORM_ADMIN_COOKIE_NAME,
    cookieOptions
  );
};
