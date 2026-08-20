import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { logger } from '../shared/logger';
import { isTestEnvironment } from '../shared/runtimeEnv';
import type { NotificationDispatchResult } from '../appointments/appointment.types';
import { smsLogRepository } from './smsLog.repository';
import type { SmsDispatchContext } from './smsLog.types';
import { isValidE164PhoneNumber, normalizeSmsDestination } from './twilioSms.service';

const getMissingWhatsappConfigParts = (): string[] => {
  const missingParts: string[] = [];

  if (!env.WHATSAPP_ACCESS_TOKEN?.trim()) {
    missingParts.push('WHATSAPP_ACCESS_TOKEN');
  }

  if (!env.WHATSAPP_PHONE_NUMBER_ID?.trim()) {
    missingParts.push('WHATSAPP_PHONE_NUMBER_ID');
  }

  return missingParts;
};

const isWhatsappEnabled = (): boolean =>
  getMissingWhatsappConfigParts().length === 0 && !isTestEnvironment();

// The dynamic "Visit Website" button on an approved WhatsApp template is
// configured in Meta Business Manager as a fixed base URL (this app's own
// public origin) plus a {{1}} suffix — so only the part after that origin is
// sent as the button parameter, not the full link.
export const toWhatsappButtonSuffix = (fullUrl: string, origin: string): string =>
  origin && fullUrl.startsWith(`${origin}/`) ? fullUrl.slice(origin.length + 1) : fullUrl;

export interface WhatsappTemplateSendInput {
  // Must match an approved Meta template name exactly (see docs/whatsapp-templates.md).
  templateName: string;
  // Positional body variables ({{1}}, {{2}}, ...) in order.
  bodyParams?: string[];
  // Text for a single dynamic "Visit Website" URL button at index 0.
  buttonUrlParam?: string;
  // Code for a single AUTHENTICATION "Copy code" button at index 0.
  buttonCopyCode?: string;
  languageCode?: string;
}

const buildComponents = (input: WhatsappTemplateSendInput): Record<string, unknown>[] => {
  const components: Record<string, unknown>[] = [];

  if (input.bodyParams && input.bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: input.bodyParams.map((text) => ({ type: 'text', text }))
    });
  }

  if (input.buttonUrlParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: input.buttonUrlParam }]
    });
  }

  if (input.buttonCopyCode) {
    components.push({
      type: 'button',
      sub_type: 'copy_code',
      index: '0',
      parameters: [{ type: 'copy_code', copy_code: input.buttonCopyCode }]
    });
  }

  return components;
};

const describeTemplateForLog = (input: WhatsappTemplateSendInput): string =>
  `[whatsapp:${input.templateName}] ${(input.bodyParams ?? []).join(' | ')}`;

export const whatsappService = {
  async persistWhatsappLog(
    result: NotificationDispatchResult,
    to: string,
    input: WhatsappTemplateSendInput,
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
        body: describeTemplateForLog(input),
        messageId: result.messageId,
        reason: result.reason,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to persist WhatsApp log', {
        error: error instanceof Error ? error.message : String(error),
        businessId: context.businessId
      });
    }
  },

  async sendTemplate(
    to: string,
    input: WhatsappTemplateSendInput,
    recipient: NotificationDispatchResult['recipient'],
    context?: SmsDispatchContext
  ): Promise<NotificationDispatchResult> {
    const normalizedDestination = normalizeSmsDestination(to);

    if (!to.trim()) {
      const result: NotificationDispatchResult = {
        recipient,
        channel: 'whatsapp',
        status: 'skipped',
        reason: 'Recipient phone number is missing'
      };
      await this.persistWhatsappLog(result, to, input, context);
      return result;
    }

    if (!isValidE164PhoneNumber(normalizedDestination)) {
      const result: NotificationDispatchResult = {
        recipient,
        channel: 'whatsapp',
        status: 'failed',
        reason:
          'Recipient phone number must include a valid country code, for example +923001234567'
      };
      await this.persistWhatsappLog(result, normalizedDestination || to, input, context);
      return result;
    }

    if (!isWhatsappEnabled()) {
      const missingConfigParts = getMissingWhatsappConfigParts();

      const result: NotificationDispatchResult = {
        recipient,
        channel: 'whatsapp',
        status: 'skipped',
        reason:
          missingConfigParts.length > 0
            ? `WhatsApp is not configured for this environment. Missing: ${missingConfigParts.join(', ')}`
            : 'WhatsApp is disabled in the current test environment'
      };
      await this.persistWhatsappLog(result, normalizedDestination, input, context);
      return result;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15000);

    try {
      const apiVersion = env.WHATSAPP_API_VERSION;
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizedDestination.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: input.templateName,
              language: { code: input.languageCode ?? env.WHATSAPP_TEMPLATE_LANGUAGE },
              components: buildComponents(input)
            }
          })
        }
      );
      clearTimeout(timeout);

      const payload = (await response.json()) as {
        error?: { message?: string; code?: number; error_subcode?: number };
        messages?: { id?: string }[];
      };

      if (!response.ok || payload.error) {
        const failureReason = payload.error
          ? `WhatsApp error ${payload.error.code ?? ''}: ${payload.error.message ?? 'Request failed'}`.trim()
          : 'WhatsApp template send failed';

        logger.error('WhatsApp template send failed', {
          status: response.status,
          error: payload.error,
          recipient,
          to: normalizedDestination,
          templateName: input.templateName
        });

        const result: NotificationDispatchResult = {
          recipient,
          channel: 'whatsapp',
          status: 'failed',
          reason: failureReason
        };
        await this.persistWhatsappLog(result, normalizedDestination, input, context);
        return result;
      }

      const result: NotificationDispatchResult = {
        recipient,
        channel: 'whatsapp',
        status: 'sent',
        messageId: payload.messages?.[0]?.id
      };
      await this.persistWhatsappLog(result, normalizedDestination, input, context);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      logger.error('WhatsApp network failure', {
        error: error instanceof Error ? error.message : String(error),
        recipient,
        to: normalizedDestination,
        templateName: input.templateName
      });

      const result: NotificationDispatchResult = {
        recipient,
        channel: 'whatsapp',
        status: 'failed',
        reason:
          error instanceof Error && error.name === 'AbortError'
            ? 'WhatsApp network error: request timed out after 15 seconds'
            : error instanceof Error
              ? `WhatsApp network error: ${error.message}`
              : 'WhatsApp network error'
      };
      await this.persistWhatsappLog(result, normalizedDestination, input, context);
      return result;
    }
  }
};
