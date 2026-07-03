import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../shared/logger';
import { isTestEnvironment } from '../shared/runtimeEnv';
import { emailLogRepository } from './emailLog.repository';
import type { EmailDispatchContext } from './emailLog.types';
import type { NotificationDispatchResult } from '../appointments/appointment.types';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSendResult {
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
}

const isSmtpEnabled = (): boolean =>
  !isTestEnvironment() &&
  Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());

const isSendgridEnabled = (): boolean => !isTestEnvironment() && Boolean(env.SENDGRID_API_KEY?.trim());

let smtpTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

const getSmtpTransport = () => {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }

  return smtpTransport;
};

const sendViaSendgrid = async (message: EmailMessage): Promise<EmailSendResult> => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 10000);

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: env.SENDGRID_FROM_EMAIL ?? 'noreply@qrschedule.com' },
        subject: message.subject,
        content: [
          {
            type: 'text/plain',
            value: message.text
          }
        ]
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('SendGrid email failed', { status: response.status, to: message.to });
      return { status: 'failed', reason: `SendGrid request failed with status ${response.status}` };
    }

    return { status: 'sent' };
  } catch (error) {
    clearTimeout(timeout);
    const reason = error instanceof Error ? error.message : String(error);
    logger.error('SendGrid network error', { error: reason });
    return { status: 'failed', reason };
  }
};

const sendViaSmtp = async (message: EmailMessage): Promise<EmailSendResult> => {
  try {
    const transporter = getSmtpTransport();
    const fromAddress = env.SMTP_FROM ?? env.SMTP_USER ?? 'noreply@qrschedule.com';

    await transporter.sendMail({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    return { status: 'sent' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error('SMTP email failed', { error: reason, to: message.to });
    return { status: 'failed', reason };
  }
};

const persistEmailLog = async (
  result: EmailSendResult,
  message: EmailMessage,
  recipient: NotificationDispatchResult['recipient'],
  context?: EmailDispatchContext
): Promise<void> => {
  if (!context?.businessId) {
    return;
  }

  try {
    await emailLogRepository.saveEmailLog({
      id: randomUUID(),
      businessId: context.businessId,
      appointmentId: context.appointmentId,
      recipient,
      destination: message.to.trim(),
      status: result.status,
      source: context.source ?? 'unknown',
      subject: message.subject,
      reason: result.reason,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to persist email log', {
      error: error instanceof Error ? error.message : String(error),
      businessId: context.businessId
    });
  }
};

export const emailService = {
  async sendEmail(
    message: EmailMessage,
    recipient: NotificationDispatchResult['recipient'] = 'customer',
    context?: EmailDispatchContext
  ): Promise<EmailSendResult> {
    if (!message.to.trim()) {
      const result: EmailSendResult = { status: 'skipped', reason: 'Recipient email is missing' };
      await persistEmailLog(result, message, recipient, context);
      return result;
    }

    let result: EmailSendResult;

    if (isSmtpEnabled()) {
      result = await sendViaSmtp(message);
    } else if (isSendgridEnabled()) {
      result = await sendViaSendgrid(message);
    } else {
      logger.info('Email skipped: no SMTP or SendGrid configured', { to: message.to });
      result = { status: 'skipped', reason: 'No SMTP or SendGrid configured' };
    }

    await persistEmailLog(result, message, recipient, context);
    return result;
  }
};
