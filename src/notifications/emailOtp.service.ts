import { env } from '../config/env';
import { logger } from '../shared/logger';

const isEmailEnabled = (): boolean => Boolean(env.SENDGRID_API_KEY?.trim());

export const emailOtpService = {
  async sendOtp(toEmail: string, code: string): Promise<{ status: 'sent' | 'skipped' | 'failed' }> {
    if (!isEmailEnabled()) {
      return { status: 'skipped' };
    }

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
      logger.error('SendGrid email network error', {
        error: error instanceof Error ? error.message : String(error),
        to: toEmail
      });
      return { status: 'failed' };
    }
  }
};
