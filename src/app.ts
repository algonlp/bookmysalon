import cors from 'cors';
import express from 'express';
import { resolve } from 'path';
import { env } from './config/env';
import { apiRouter } from './api/routes';
import { errorHandler } from './api/middlewares/errorHandler';
import { notFoundHandler } from './api/middlewares/notFound';
import { requirePlatformAdminPageAccess } from './api/middlewares/requirePlatformAdminAccess';

export const app = express();

const publicDir = resolve(process.cwd(), 'public');
const shouldEnforceHttps = env.APP_ENV === 'prod' && env.PUBLIC_BASE_URL?.startsWith('https://');

const isSecureRequest = (req: express.Request): boolean =>
  req.secure || req.header('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';

if (env.TRUST_PROXY) {
  app.set('trust proxy', true);
}

app.use((req, res, next) => {
  if (shouldEnforceHttps && !isSecureRequest(req)) {
    res.redirect(308, `${env.PUBLIC_BASE_URL}${req.originalUrl}`);
    return;
  }

  next();
});

if (env.CORS_ALLOWED_ORIGINS.length > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        callback(null, env.CORS_ALLOWED_ORIGINS.includes(origin));
      },
      credentials: true
    })
  );
}

app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

  if (shouldEnforceHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
});

app.use(express.json({ limit: '8mb' }));
app.use(express.static(publicDir, { index: false }));

app.use('/api', apiRouter);

app.get('/', (_req, res) => {
  res.sendFile(resolve(publicDir, 'index.html'));
});

app.get('/login', (_req, res) => {
  res.sendFile(resolve(publicDir, 'signup.html'));
});

app.get('/for-businesses', (_req, res) => {
  res.sendFile(resolve(publicDir, 'for-businesses.html'));
});

app.get('/pricing', (_req, res) => {
  res.sendFile(resolve(publicDir, 'pricing.html'));
});

app.get('/help', (_req, res) => {
  res.sendFile(resolve(publicDir, 'help.html'));
});

app.get('/signup', (_req, res) => {
  res.sendFile(resolve(publicDir, 'signup.html'));
});

app.get('/onboarding/business-name', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-business-name.html'));
});

app.get('/onboarding/service-types', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-service-types.html'));
});

app.get('/onboarding/account-type', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-account-type.html'));
});

app.get('/onboarding/service-location', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-service-location.html'));
});

app.get('/onboarding/venue-location', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-venue-location.html'));
});

app.get('/onboarding/launch-links', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-launch-links.html'));
});

app.get('/onboarding/language', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-language.html'));
});

app.get('/onboarding/complete', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-complete.html'));
});

app.get('/guides/legendary-learner', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'guide-legendary-learner.html'));
});

app.get('/calendar', requirePlatformAdminPageAccess, (_req, res) => {
  res.sendFile(resolve(publicDir, 'calendar.html'));
});

app.get('/book/:clientId', (_req, res) => {
  res.sendFile(resolve(publicDir, 'book.html'));
});

app.get('/book/:clientId/manage/:appointmentId', (_req, res) => {
  res.sendFile(resolve(publicDir, 'manage-booking.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
