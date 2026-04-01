import cors from 'cors';
import express from 'express';
import { resolve } from 'path';
import { env } from './config/env';
import { apiRouter } from './api/routes';
import { errorHandler } from './api/middlewares/errorHandler';
import { notFoundHandler } from './api/middlewares/notFound';

export const app = express();

const publicDir = resolve(__dirname, '../public');

if (env.TRUST_PROXY) {
  app.set('trust proxy', true);
}

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

app.use(express.json({ limit: '8mb' }));
app.use(express.static(publicDir, { index: false }));

app.use('/api', apiRouter);

app.get('/', (_req, res) => {
  res.sendFile(resolve(publicDir, 'index.html'));
});

app.get('/login', (_req, res) => {
  res.sendFile(resolve(publicDir, 'login.html'));
});

app.get('/for-businesses', (_req, res) => {
  res.sendFile(resolve(publicDir, 'for-businesses.html'));
});

app.get('/pricing', (_req, res) => {
  res.sendFile(resolve(publicDir, 'pricing.html'));
});

app.get('/signup', (_req, res) => {
  res.sendFile(resolve(publicDir, 'signup.html'));
});

app.get('/onboarding/business-name', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-business-name.html'));
});

app.get('/onboarding/service-types', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-service-types.html'));
});

app.get('/onboarding/account-type', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-account-type.html'));
});

app.get('/onboarding/service-location', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-service-location.html'));
});

app.get('/onboarding/venue-location', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-venue-location.html'));
});

app.get('/onboarding/launch-links', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-launch-links.html'));
});

app.get('/onboarding/language', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-language.html'));
});

app.get('/onboarding/complete', (_req, res) => {
  res.sendFile(resolve(publicDir, 'onboarding-complete.html'));
});

app.get('/guides/legendary-learner', (_req, res) => {
  res.sendFile(resolve(publicDir, 'guide-legendary-learner.html'));
});

app.get('/calendar', (_req, res) => {
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
