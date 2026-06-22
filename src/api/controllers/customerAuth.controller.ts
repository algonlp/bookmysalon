import type { Request, Response } from 'express';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { twilioSmsService } from '../../notifications/twilioSms.service';
import { customerAccountService } from '../../customers/customerAccount.service';

const requestOtpSchema = z.object({
  phone: z.string().trim().min(7, 'Phone number is required'),
  name: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal(''))
});

const verifyOtpSchema = z.object({
  phone: z.string().trim().min(7, 'Phone number is required'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code')
});

interface CustomerOtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  name: string;
  email: string;
}

const otpStore = new Map<string, CustomerOtpRecord>();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const normalizePhoneKey = (phone: string): string => phone.replace(/[^\d+]/g, '');

const createOtpCode = (): string => String(randomInt(100000, 1000000));

export const customerAuthController = {
  async requestOtp(req: Request, res: Response): Promise<void> {
    const input = requestOtpSchema.parse(req.body);
    const phoneKey = normalizePhoneKey(input.phone);
    const code = createOtpCode();

    otpStore.set(phoneKey, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      name: input.name?.trim() ?? '',
      email: input.email?.trim() ?? ''
    });

    const smsResult = await twilioSmsService.sendSms(
      input.phone,
      `Your QR Schedule verification code is ${code}. It expires in 10 minutes.`,
      'customer'
    );

    res.status(200).json({
      message:
        smsResult.status === 'sent'
          ? 'Verification code sent.'
          : 'Verification code created. SMS delivery is not available right now.',
      smsStatus: smsResult.status
    });
  },

  async verifyOtp(req: Request, res: Response): Promise<void> {
    const input = verifyOtpSchema.parse(req.body);
    const phoneKey = normalizePhoneKey(input.phone);
    const record = otpStore.get(phoneKey);

    if (!record || record.expiresAt < Date.now()) {
      otpStore.delete(phoneKey);
      res.status(400).json({ error: 'Verification code expired. Request a new code.' });
      return;
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(phoneKey);
      res.status(429).json({ error: 'Too many attempts. Request a new code.' });
      return;
    }

    if (record.code !== input.code.trim()) {
      record.attempts += 1;
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    otpStore.delete(phoneKey);
    const customer = await customerAccountService.upsertVerifiedCustomer({
      phone: input.phone.trim(),
      name: record.name,
      email: record.email
    });

    res.status(200).json({
      customer: customerAccountService.serializeCustomer(customer),
      sessionToken: customer.sessionToken
    });
  }
};
