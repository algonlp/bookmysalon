import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../shared/errors/httpError';
import { customerAccountService } from '../../customers/customerAccount.service';

const profileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().min(7).optional(),
  dateOfBirth: z.string().trim().max(40).optional().or(z.literal('')),
  gender: z.string().trim().max(40).optional().or(z.literal(''))
});

const favoriteSchema = z.object({
  salonId: z.string().trim().min(1)
});

const settingsSchema = z.object({
  notifications: z.object({
    appointmentTextMessage: z.boolean(),
    appointmentWhatsapp: z.boolean(),
    marketingEmail: z.boolean(),
    marketingTextMessage: z.boolean(),
    marketingWhatsapp: z.boolean()
  }),
  socialLogins: z.object({
    facebookConnected: z.boolean(),
    googleConnected: z.boolean()
  })
});

const getCustomerSessionToken = (req: Request): string => {
  const authorization = req.header('authorization')?.trim() ?? '';
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1]?.trim() ?? req.header('x-customer-session')?.trim() ?? '';

  if (!token) {
    throw new HttpError(401, 'Customer login is required');
  }

  return token;
};

export const customerAccountController = {
  async getMe(req: Request, res: Response): Promise<void> {
    const customer = await customerAccountService.getCustomerBySessionToken(getCustomerSessionToken(req));
    res.status(200).json({ customer: customerAccountService.serializeCustomer(customer) });
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const customer = await customerAccountService.updateProfile(
      getCustomerSessionToken(req),
      profileUpdateSchema.parse(req.body)
    );
    res.status(200).json({ customer: customerAccountService.serializeCustomer(customer) });
  },

  async addFavorite(req: Request, res: Response): Promise<void> {
    const { salonId } = favoriteSchema.parse(req.body);
    const customer = await customerAccountService.addFavorite(getCustomerSessionToken(req), salonId);
    res.status(200).json({ customer: customerAccountService.serializeCustomer(customer) });
  },

  async removeFavorite(req: Request, res: Response): Promise<void> {
    const { salonId } = favoriteSchema.parse(req.body);
    const customer = await customerAccountService.removeFavorite(getCustomerSessionToken(req), salonId);
    res.status(200).json({ customer: customerAccountService.serializeCustomer(customer) });
  },

  async updateSettings(req: Request, res: Response): Promise<void> {
    const { notifications, socialLogins } = settingsSchema.parse(req.body);
    const customer = await customerAccountService.updateSettings(
      getCustomerSessionToken(req),
      notifications,
      socialLogins
    );
    res.status(200).json({ customer: customerAccountService.serializeCustomer(customer) });
  }
};
