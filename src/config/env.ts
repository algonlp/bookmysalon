import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const normalizeBaseUrl = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  return value.trim().replace(/\/+$/, '');
};

const parseCorsOrigins = (value: string | undefined): string[] => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  APP_ENV: z.enum(['dev', 'prod', 'test']).default('dev'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CLIENT_PLATFORM_STORAGE: z.enum(['file', 'memory']).default('file'),
  WAITLIST_OFFER_WINDOW_MINUTES: z.coerce.number().int().positive().default(10),
  TRUST_PROXY: z.boolean().default(false),
  PUBLIC_BASE_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.array(z.string().url()).default([]),
  ENABLE_PUBLIC_CUSTOMER_LOOKUPS: z.boolean().default(false),
  PLATFORM_ADMIN_COOKIE_NAME: z.string().trim().min(1).default('platform_admin_session'),
  ADMIN_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  SALON_ADMIN_PHONE: z.string().optional()
});

const appEnv = process.env.APP_ENV ?? 'dev';

const resolvedEnv = {
  ...process.env,
  TRUST_PROXY: parseBooleanEnv(process.env.TRUST_PROXY, appEnv === 'prod'),
  PUBLIC_BASE_URL: normalizeBaseUrl(process.env.PUBLIC_BASE_URL),
  CORS_ALLOWED_ORIGINS: parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ENABLE_PUBLIC_CUSTOMER_LOOKUPS: parseBooleanEnv(
    process.env.ENABLE_PUBLIC_CUSTOMER_LOOKUPS,
    appEnv !== 'prod'
  ),
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? process.env.TWILIO_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? process.env.TWILIO_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_FROM
};

export const env = envSchema.parse(resolvedEnv);
