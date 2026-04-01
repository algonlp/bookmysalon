import { env } from '../config/env';
import { logger } from '../shared/logger';
import type { NotificationDispatchResult } from '../appointments/appointment.types';

const isTestEnvironment = (): boolean =>
  env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isSmsEnabled = (): boolean => {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_PHONE_NUMBER &&
      !isTestEnvironment()
  );
};

const buildAuthHeader = (): string => {
  const authToken = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
    'utf-8'
  ).toString('base64');

  return `Basic ${authToken}`;
};

export const twilioSmsService = {
  async sendSms(
    to: string,
    body: string,
    recipient: NotificationDispatchResult['recipient']
  ): Promise<NotificationDispatchResult> {
    if (!to.trim()) {
      return {
        recipient,
        channel: 'sms',
        status: 'skipped',
        reason: 'Recipient phone number is missing'
      };
    }

    if (!isSmsEnabled()) {
      return {
        recipient,
        channel: 'sms',
        status: 'skipped',
        reason: 'Twilio SMS is not configured for this environment'
      };
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: buildAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: to,
          From: env.TWILIO_PHONE_NUMBER ?? '',
          Body: body
        }).toString()
      }
    );

    const payload = (await response.json()) as { sid?: string; message?: string };

    if (!response.ok) {
      logger.error('Twilio SMS failed', payload);

      return {
        recipient,
        channel: 'sms',
        status: 'failed',
        reason: payload.message ?? 'Twilio SMS request failed'
      };
    }

    return {
      recipient,
      channel: 'sms',
      status: 'sent',
      messageId: payload.sid
    };
  }
};
