import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { logger } from '../shared/logger';
import type { NotificationDispatchResult } from '../appointments/appointment.types';
import { smsLogRepository } from './smsLog.repository';
import type { SmsDispatchContext } from './smsLog.types';

const isTestEnvironment = (): boolean =>
  env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const getMissingSmsConfigParts = (): string[] => {
  const missingParts: string[] = [];

  if (!env.TWILIO_ACCOUNT_SID?.trim()) {
    missingParts.push('TWILIO_ACCOUNT_SID');
  }

  if (!env.TWILIO_AUTH_TOKEN?.trim()) {
    missingParts.push('TWILIO_AUTH_TOKEN');
  }

  if (!env.TWILIO_PHONE_NUMBER?.trim()) {
    missingParts.push('TWILIO_PHONE_NUMBER');
  }

  return missingParts;
};

const isSmsEnabled = (): boolean => {
  return getMissingSmsConfigParts().length === 0 && !isTestEnvironment();
};

const normalizePhoneCountryCode = (phoneValue: string | undefined): string => {
  if (typeof phoneValue !== 'string') {
    return '';
  }

  const compactValue = phoneValue.trim().replace(/[^\d+]/g, '');

  if (!compactValue) {
    return '';
  }

  if (compactValue.startsWith('00')) {
    return `+${compactValue.slice(2).replace(/[^\d]/g, '')}`;
  }

  const digitsOnly = compactValue.replace(/[^\d]/g, '');

  if (!digitsOnly) {
    return '';
  }

  return compactValue.startsWith('+') ? `+${digitsOnly}` : `+${digitsOnly}`;
};

const normalizeSmsDestination = (phoneValue: string): string => {
  const compactValue =
    typeof phoneValue === 'string' ? phoneValue.trim().replace(/[^\d+]/g, '') : '';

  if (!compactValue) {
    return '';
  }

  if (compactValue.startsWith('+')) {
    return `+${compactValue.slice(1).replace(/[^\d]/g, '')}`;
  }

  if (compactValue.startsWith('00')) {
    return `+${compactValue.slice(2).replace(/[^\d]/g, '')}`;
  }

  const digitsOnly = compactValue.replace(/[^\d]/g, '');

  if (!digitsOnly) {
    return '';
  }

  const defaultCountryCode = normalizePhoneCountryCode(env.PUBLIC_BOOKING_PHONE_COUNTRY_CODE);

  if (!defaultCountryCode) {
    return digitsOnly;
  }

  return `${defaultCountryCode}${digitsOnly.replace(/^0+/, '')}`;
};

const isValidE164PhoneNumber = (phoneValue: string): boolean => /^\+[1-9]\d{7,14}$/.test(phoneValue);

const buildAuthHeader = (): string => {
  const authToken = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
    'utf-8'
  ).toString('base64');

  return `Basic ${authToken}`;
};

export const twilioSmsService = {
  async persistSmsLog(
    result: NotificationDispatchResult,
    to: string,
    body: string,
    context?: SmsDispatchContext
  ): Promise<void> {
    if (!context?.businessId) {
      return;
    }

    try {
      await smsLogRepository.saveSmsLog({
        id: randomUUID(),
        businessId: context.businessId,
        appointmentId: context.appointmentId,
        waitlistEntryId: context.waitlistEntryId,
        recipient: result.recipient,
        channel: result.channel,
        destination: to.trim(),
        status: result.status,
        source: context.source ?? 'unknown',
        body,
        messageId: result.messageId,
        reason: result.reason,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to persist SMS log', {
        error: error instanceof Error ? error.message : String(error),
        businessId: context.businessId
      });
    }
  },

  async sendSms(
    to: string,
    body: string,
    recipient: NotificationDispatchResult['recipient'],
    context?: SmsDispatchContext
  ): Promise<NotificationDispatchResult> {
    const normalizedDestination = normalizeSmsDestination(to);

    if (!to.trim()) {
      const result: NotificationDispatchResult = {
        recipient,
        channel: 'sms',
        status: 'skipped',
        reason: 'Recipient phone number is missing'
      };
      await this.persistSmsLog(result, to, body, context);
      return result;
    }

    if (!isValidE164PhoneNumber(normalizedDestination)) {
      const result: NotificationDispatchResult = {
        recipient,
        channel: 'sms',
        status: 'failed',
        reason:
          'Recipient phone number must include a valid country code, for example +923001234567'
      };
      await this.persistSmsLog(result, normalizedDestination || to, body, context);
      return result;
    }

    if (!isSmsEnabled()) {
      const missingConfigParts = getMissingSmsConfigParts();

      const result: NotificationDispatchResult = {
        recipient,
        channel: 'sms',
        status: 'skipped',
        reason:
          missingConfigParts.length > 0
            ? `Twilio SMS is not configured for this environment. Missing: ${missingConfigParts.join(', ')}`
            : 'Twilio SMS is disabled in the current test environment'
      };
      await this.persistSmsLog(result, normalizedDestination, body, context);
      return result;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000);

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            Authorization: buildAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: normalizedDestination,
            From: env.TWILIO_PHONE_NUMBER ?? '',
            Body: body
          }).toString()
        }
      );
      clearTimeout(timeout);

      const payload = (await response.json()) as { code?: number; sid?: string; message?: string };

      if (!response.ok) {
        const failureReason = payload.code
          ? `Twilio error ${payload.code}: ${payload.message ?? 'Request failed'}`
          : payload.message ?? 'Twilio SMS request failed';

        logger.error('Twilio SMS failed', {
          status: response.status,
          code: payload.code,
          message: payload.message,
          recipient,
          to: normalizedDestination
        });

        const result: NotificationDispatchResult = {
          recipient,
          channel: 'sms',
          status: 'failed',
          reason: failureReason
        };
        await this.persistSmsLog(result, normalizedDestination, body, context);
        return result;
      }

      const result: NotificationDispatchResult = {
        recipient,
        channel: 'sms',
        status: 'sent',
        messageId: payload.sid
      };
      await this.persistSmsLog(result, normalizedDestination, body, context);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      logger.error('Twilio SMS network failure', {
        error: error instanceof Error ? error.message : String(error),
        recipient,
        to: normalizedDestination
      });

      const result: NotificationDispatchResult = {
        recipient,
        channel: 'sms',
        status: 'failed',
        reason:
          error instanceof Error && error.name === 'AbortError'
            ? 'Twilio network error: request timed out after 15 seconds'
            : error instanceof Error
              ? `Twilio network error: ${error.message}`
            : 'Twilio network error'
      };
      await this.persistSmsLog(result, normalizedDestination, body, context);
      return result;
    }
  }
};
