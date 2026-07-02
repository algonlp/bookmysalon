import { emailService, type EmailSendResult } from './email.service';
import { renderEmailLayout } from './emailTemplate';

export const emailOtpService = {
  async sendOtp(toEmail: string, code: string): Promise<EmailSendResult> {
    return emailService.sendEmail({
      to: toEmail,
      subject: 'Your QR Schedule verification code',
      text: `Your QR Schedule verification code is ${code}. It expires in 10 minutes.`,
      html: renderEmailLayout({
        preheader: `Your verification code is ${code}`,
        eyebrow: 'Verify your identity',
        heading: 'Your verification code',
        bodyHtml: `
          <p style="margin:0 0 22px">Use this code to continue. It expires in 10 minutes.</p>
          <div style="font-size:2rem;font-weight:800;letter-spacing:0.2em;color:#1f1a17;
                      background:#f5f3ff;border:1px solid #e4defc;border-radius:14px;
                      padding:18px 0;text-align:center">
            ${code}
          </div>
          <p style="margin:22px 0 0;font-size:0.85rem;color:#9c9490">
            If you didn't request this code, you can safely ignore this email.
          </p>
        `
      })
    });
  }
};
