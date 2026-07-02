import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../shared/logger';
import { isTestEnvironment } from '../shared/runtimeEnv';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSendResult {
  status: 'sent' | 'skipped' | 'failed';
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

const sendViaSendgrid = async (message: EmailMessage): Promise<{ status: 'sent' | 'failed' }> => {
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
      return { status: 'failed' };
    }

    return { status: 'sent' };
  } catch (error) {
    clearTimeout(timeout);
    logger.error('SendGrid network error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return { status: 'failed' };
  }
};

const sendViaSmtp = async (message: EmailMessage): Promise<{ status: 'sent' | 'failed' }> => {
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
    logger.error('SMTP email failed', {
      error: error instanceof Error ? error.message : String(error),
      to: message.to
    });
    return { status: 'failed' };
  }
};

export const emailService = {
  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    if (!message.to.trim()) {
      return { status: 'skipped' };
    }

    if (isSmtpEnabled()) {
      return sendViaSmtp(message);
    }

    if (isSendgridEnabled()) {
      return sendViaSendgrid(message);
    }

    logger.info('Email skipped: no SMTP or SendGrid configured', { to: message.to });
    return { status: 'skipped' };
  }
};
