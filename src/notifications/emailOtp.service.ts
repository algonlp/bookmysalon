import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../shared/logger';

const isSmtpEnabled = (): boolean =>
  Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());

const isSendgridEnabled = (): boolean => Boolean(env.SENDGRID_API_KEY?.trim());

const createSmtpTransport = () =>
  nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

const sendViaSendgrid = async (toEmail: string, code: string): Promise<{ status: 'sent' | 'failed' }> => {
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
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: env.SENDGRID_FROM_EMAIL ?? 'noreply@qrschedule.com' },
        subject: 'Your QR Schedule verification code',
        content: [
          {
            type: 'text/plain',
            value: `Your QR Schedule verification code is ${code}. It expires in 10 minutes.`
          }
        ]
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('SendGrid email failed', { status: response.status, to: toEmail });
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

const sendViaSmtp = async (toEmail: string, code: string): Promise<{ status: 'sent' | 'failed' }> => {
  try {
    const transporter = createSmtpTransport();
    const fromAddress = env.SMTP_FROM ?? env.SMTP_USER ?? 'noreply@qrschedule.com';

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Your QR Schedule verification code',
      text: `Your QR Schedule verification code is ${code}. It expires in 10 minutes.`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:1.4rem;font-weight:800;color:#111;margin:0 0 8px">
            Your verification code
          </h2>
          <p style="color:#5f5953;margin:0 0 28px">
            Use this code to log in to QR Schedule. It expires in 10 minutes.
          </p>
          <div style="font-size:2.2rem;font-weight:800;letter-spacing:0.15em;color:#111;
                      background:#f5f5f5;border-radius:10px;padding:18px 0;text-align:center">
            ${code}
          </div>
          <p style="color:#9ca3af;font-size:0.82rem;margin:24px 0 0">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `
    });

    return { status: 'sent' };
  } catch (error) {
    logger.error('SMTP email failed', {
      error: error instanceof Error ? error.message : String(error),
      to: toEmail
    });
    return { status: 'failed' };
  }
};

export const emailOtpService = {
  async sendOtp(toEmail: string, code: string): Promise<{ status: 'sent' | 'skipped' | 'failed' }> {
    if (isSmtpEnabled()) {
      return sendViaSmtp(toEmail, code);
    }

    if (isSendgridEnabled()) {
      return sendViaSendgrid(toEmail, code);
    }

    logger.info('Email OTP skipped: no SMTP or SendGrid configured', { to: toEmail });
    return { status: 'skipped' };
  }
};
