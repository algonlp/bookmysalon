import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { HttpError } from '../../shared/errors/httpError';
import { emailService } from '../../notifications/email.service';

const supportRequestSchema = z.object({
  salonName: z.string().trim().min(2, 'Salon name is required'),
  name: z.string().trim().min(2, 'Your name is required'),
  contact: z.string().trim().min(3, 'Email or phone is required'),
  issue: z.string().trim().min(2, 'Select an issue type'),
  priority: z.string().trim().default('Normal'),
  message: z.string().trim().min(8, 'Add a short message about the issue')
});

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getReplyTo = (contact: string): string | undefined =>
  emailPattern.test(contact.trim()) ? contact.trim() : undefined;

export const supportController = {
  async submitSupportRequest(req: Request, res: Response): Promise<void> {
    const input = supportRequestSchema.parse(req.body);
    const supportEmail = env.PUBLIC_SUPPORT_EMAIL?.trim() || env.SMTP_USER?.trim();

    if (!supportEmail) {
      throw new HttpError(500, 'Support email is not configured');
    }

    const subject = `QR Schedule support: ${input.salonName} - ${input.issue}`;
    const text = [
      'New QR Schedule support request',
      '',
      `Salon name: ${input.salonName}`,
      `Requester: ${input.name}`,
      `Contact: ${input.contact}`,
      `Issue: ${input.issue}`,
      `Priority: ${input.priority}`,
      '',
      'Message:',
      input.message
    ].join('\n');
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
        <h2>New QR Schedule support request</h2>
        <p><strong>Salon name:</strong> ${escapeHtml(input.salonName)}</p>
        <p><strong>Requester:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Contact:</strong> ${escapeHtml(input.contact)}</p>
        <p><strong>Issue:</strong> ${escapeHtml(input.issue)}</p>
        <p><strong>Priority:</strong> ${escapeHtml(input.priority)}</p>
        <hr />
        <p><strong>Message</strong></p>
        <p>${escapeHtml(input.message).replaceAll('\n', '<br />')}</p>
      </div>
    `;

    const result = await emailService.sendEmail(
      {
        to: supportEmail,
        subject,
        text,
        html,
        replyTo: getReplyTo(input.contact)
      },
      'admin'
    );

    if (result.status !== 'sent') {
      throw new HttpError(
        502,
        result.reason
          ? `Support email could not be sent: ${result.reason}`
          : 'Support email could not be sent'
      );
    }

    res.status(200).json({
      status: 'sent',
      message: 'Support request sent'
    });
  }
};
