import type { NextFunction, Request, Response } from 'express';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { env } from '../../config/env';
import { HttpError } from '../../shared/errors/httpError';
import {
  clientPlatformService,
  serializeClientForResponse
} from '../../platform/clientPlatform.service';
import { serviceLocationValues } from '../../platform/serviceLocation.constants';
import {
  buildPlatformClientPagePath,
  platformClientAuthMessages,
  platformClientPagePaths
} from '../../platform/clientPlatform.paths';
import { preferredLanguageValues } from '../../platform/clientPlatform.types';
import { appointmentService } from '../../appointments/appointment.service';
import { twilioSmsService } from '../../notifications/twilioSms.service';
import { emailOtpService } from '../../notifications/emailOtp.service';
import { emailService } from '../../notifications/email.service';
import { renderEmailLayout } from '../../notifications/emailTemplate';
import { hashPassword, verifyPassword } from '../../shared/hashToken';
import { clearAdminSessionCookie, getRequestOrigin, setAdminSessionCookie } from '../../shared/http';

interface AdminOtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  clientId: string;
  rememberMe: boolean;
}

const adminOtpStore = new Map<string, AdminOtpRecord>();

interface SignupOtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  email: string;
  mobileNumber: string;
  password: string;
  businessName: string;
  provider: 'email' | 'facebook' | 'google' | 'apple';
}

const signupOtpStore = new Map<string, SignupOtpRecord>();
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

const createOtpCode = (): string => String(randomInt(100000, 1000000));

const maskPhone = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length > 4
    ? '****' + digits.slice(-4)
    : '****' + digits;
};

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) {
    return email;
  }
  const visible = local.slice(0, 2) || local;
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
};

const isPlaceholderEmail = (email: string): boolean => email.endsWith('@platform.local');

const sendWelcomeEmail = async (client: { id: string; email: string; businessName: string }, origin: string): Promise<void> => {
  if (!client.email || isPlaceholderEmail(client.email)) {
    return;
  }

  const dashboardLink = `${origin}${buildPlatformClientPagePath(platformClientPagePaths.calendar, client.id)}`;
  const businessLabel = client.businessName || 'your workspace';

  await emailService.sendEmail({
    to: client.email,
    subject: `Welcome to QR Schedule, ${businessLabel}!`,
    text:
      `Your workspace for ${businessLabel} is ready. ` +
      `Open your dashboard to manage bookings, services and your team: ${dashboardLink}`,
    html: renderEmailLayout({
      preheader: `Your workspace for ${businessLabel} is ready.`,
      eyebrow: 'Welcome',
      heading: `You're all set, ${businessLabel}!`,
      bodyHtml: `
        <p style="margin:0 0 14px">Your QR Schedule workspace is live. From your dashboard you can:</p>
        <ul style="margin:0 0 4px;padding-left:20px">
          <li style="margin:0 0 6px">Manage bookings and your calendar</li>
          <li style="margin:0 0 6px">Add services, pricing and team members</li>
          <li style="margin:0 0 6px">Share your booking link and QR code with customers</li>
        </ul>
      `,
      button: { label: 'Open your dashboard', url: dashboardLink }
    })
  });
};

const isValidProfileImageValue = (value: string): boolean => {
  if (!value) {
    return true;
  }

  if (/^https?:\/\/\S+$/i.test(value)) {
    return true;
  }

  return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value);
};

const shouldExposeAdminTokenForTests = (): boolean =>
  env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const createClientSchema = z.object({
  email: z.string().trim().email().optional(),
  mobileNumber: z.string().trim().min(7, 'Mobile number is required').optional(),
  password: z.string().trim().min(6, 'Password must be at least 6 characters').optional(),
  businessName: z.string().trim().min(1).optional(),
  provider: z.enum(['email', 'facebook', 'google', 'apple']).default('email')
}).refine(
  (value) => value.provider !== 'email' || Boolean(value.email || value.mobileNumber),
  {
    message: 'Email or mobile number is required',
    path: ['email']
  }
);

const googleAuthSchema = z.object({
  credential: z.string().trim().min(1, 'Google credential is required')
});

const loginClientSchema = z.object({
  email: z.string().trim().email().optional(),
  mobileNumber: z.string().trim().min(7, 'Mobile number is required').optional(),
  password: z.string().trim().optional(),
  rememberMe: z.boolean().default(true)
}).refine(
  (value) => Boolean(value.email || value.mobileNumber),
  {
    message: 'Email or mobile number is required',
    path: ['email']
  }
);

const verifyAdminOtpSchema = z.object({
  clientId: z.string().trim().min(1, 'Client id is required'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code')
});

const verifySignupOtpSchema = z.object({
  phone: z.string().trim().min(7).optional(),
  email: z.string().trim().email().optional(),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6 digit code')
}).refine((value) => Boolean(value.phone || value.email), {
  message: 'Phone or email is required'
});

const businessProfileSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  website: z.string().trim().optional(),
  businessPhoneNumber: z.string().trim().optional(),
  venueAddress: z.string().trim().optional(),
  profileImageUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => isValidProfileImageValue(value ?? ''), 'Valid image URL or uploaded image is required')
});

const salonImagesSchema = z.object({
  galleryImageUrls: z
    .array(
      z
        .string()
        .trim()
        .refine((value) => isValidProfileImageValue(value), 'Valid image URL or uploaded image is required')
    )
    .max(6)
    .default([])
});

const serviceTypesSchema = z.object({
  serviceTypes: z.array(z.string().trim().min(1)).min(1)
});

const businessSettingsSchema = z.object({
  currencyCode: z.string().trim().length(3).optional(),
  currencyLocale: z.string().trim().min(2).max(32).optional(),
  slotTimes: z
    .array(z.string().trim().regex(/^([01]\d|2[0-3]):([0-5]\d)$/))
    .min(1)
    .optional(),
  useServiceTemplates: z.boolean().optional(),
  reportMetadata: z
    .object({
      pageTitle: z.string().trim().min(1).optional(),
      pageSubtitle: z.string().trim().min(1).optional()
    })
    .optional()
});

const stripeConnectOnboardingSchema = z.object({
  countryCode: z.string().trim().length(2).toUpperCase().optional()
});

const accountTypeSchema = z.object({
  accountType: z.enum(['independent', 'team'])
});

const serviceLocationSchema = z.object({
  serviceLocation: z.array(z.enum(serviceLocationValues)).min(1)
});

const venueLocationSchema = z.object({
  venueAddress: z.string().trim().min(3, 'Venue address is required')
});

const preferredLanguageSchema = z.object({
  preferredLanguage: z.enum(preferredLanguageValues)
});

const weekdayEnum = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]);

const teamMemberTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Valid time is required')
  .optional();

const createTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Team member name is required'),
  role: z.string().trim().min(1, 'Role is required').optional(),
  phone: z.string().trim().optional(),
  expertise: z.string().trim().optional(),
  openingTime: teamMemberTimeSchema,
  closingTime: teamMemberTimeSchema,
  offDays: z.array(weekdayEnum).optional().default([]),
  isActive: z.boolean().optional()
}).refine(
  (value) =>
    !value.openingTime ||
    !value.closingTime ||
    value.openingTime.localeCompare(value.closingTime) < 0,
  {
    message: 'Closing time must be later than opening time',
    path: ['closingTime']
  }
);

const updateTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Team member name is required'),
  role: z.string().trim().min(1, 'Role is required').optional(),
  phone: z.string().trim().optional(),
  expertise: z.string().trim().optional(),
  openingTime: teamMemberTimeSchema,
  closingTime: teamMemberTimeSchema,
  offDays: z.array(weekdayEnum).optional().default([]),
  isActive: z.boolean().optional()
}).refine(
  (value) =>
    !value.openingTime ||
    !value.closingTime ||
    value.openingTime.localeCompare(value.closingTime) < 0,
  {
    message: 'Closing time must be later than opening time',
    path: ['closingTime']
  }
);

const createBusinessServiceSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required'),
  categoryName: z.string().trim().optional(),
  durationMinutes: z.number().int().min(15).max(480),
  priceLabel: z.string().trim().min(1, 'Price is required'),
  description: z.string().trim().optional()
});

const updateBusinessServiceSchema = createBusinessServiceSchema;

const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  categoryName: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  priceLabel: z.string().trim().min(1, 'Product price is required'),
  stockQuantity: z.number().int().min(0).max(100000),
  description: z.string().trim().optional()
});

const updateProductSchema = createProductSchema;

const createPackagePlanSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required'),
  includedServiceIds: z.array(z.string().trim().min(1)).optional().default([]),
  totalUses: z.number().int().min(1).max(100),
  priceLabel: z.string().trim().min(1, 'Package price is required'),
  amountCents: z.number().int().positive().optional(),
  currencyCode: z.string().trim().length(3).optional(),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Expiry date must use YYYY-MM-DD format'
    )
});

const updatePackagePlanSchema = createPackagePlanSchema;

const updateLoyaltyProgramSchema = z.object({
  isEnabled: z.boolean(),
  triggerCompletedVisits: z.number().int().min(1).max(50),
  rewardValue: z.number().min(1).max(100),
  includedServiceIds: z.array(z.string().trim().min(1)).optional().default([])
});

const sellPackageSchema = z.object({
  packagePlanId: z.string().trim().min(1, 'Package plan is required'),
  customerName: z.string().trim().min(2, 'Customer name is required'),
  customerPhone: z.string().trim().min(7, 'Customer phone is required'),
  customerEmail: z.string().trim().email().optional().or(z.literal(''))
});

const sellProductSchema = z.object({
  productId: z.string().trim().min(1, 'Product is required'),
  quantity: z.number().int().min(1).max(1000),
  customerName: z.string().trim().min(2, 'Customer name is required'),
  customerPhone: z.string().trim().min(7, 'Customer phone is required'),
  customerEmail: z.string().trim().email().optional().or(z.literal(''))
});

const getClientId = (req: Request): string => {
  if (!req.params.clientId) {
    throw new HttpError(400, 'Client id is required');
  }

  return req.params.clientId;
};

const getTeamMemberId = (req: Request): string => {
  if (!req.params.teamMemberId) {
    throw new HttpError(400, 'Team member id is required');
  }

  return req.params.teamMemberId;
};

const getServiceId = (req: Request): string => {
  if (!req.params.serviceId) {
    throw new HttpError(400, 'Service id is required');
  }

  return req.params.serviceId;
};

const getProductId = (req: Request): string => {
  if (!req.params.productId) {
    throw new HttpError(400, 'Product id is required');
  }

  return req.params.productId;
};

const getPackagePlanId = (req: Request): string => {
  if (!req.params.packagePlanId) {
    throw new HttpError(400, 'Package plan id is required');
  }

  return req.params.packagePlanId;
};

export const clientPlatformController = {
  async createClient(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = createClientSchema.parse(req.body);
    const mobileNumber = input.mobileNumber?.trim();

    if (mobileNumber) {
      const existing = await clientPlatformService.findClientForLogin({
        email: input.email,
        mobileNumber
      });

      if (existing) {
        throw new HttpError(409, 'An account with this email or mobile number already exists. Please log in instead.');
      }

      const code = createOtpCode();
      const phoneKey = mobileNumber.replace(/[^\d+]/g, '');

      signupOtpStore.set(phoneKey, {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
        email: input.email?.trim() || '',
        mobileNumber,
        password: input.password?.trim() || '',
        businessName: input.businessName?.trim() || '',
        provider: input.provider
      });

      const smsResult = await twilioSmsService.sendSms(
        mobileNumber,
        `Your QR Schedule verification code is ${code}. It expires in 10 minutes.`,
        'customer'
      );

      res.status(200).json({
        otpRequired: true,
        maskedPhone: maskPhone(mobileNumber),
        smsStatus: smsResult.status,
        ...(shouldExposeAdminTokenForTests() ? { otpCode: code } : {})
      });
      return;
    }

    const email = input.email?.trim();

    if (email) {
      const existing = await clientPlatformService.findClientForLogin({ email });

      if (existing) {
        throw new HttpError(409, platformClientAuthMessages.accountExists);
      }

      const code = createOtpCode();
      const emailKey = email.toLowerCase();

      signupOtpStore.set(emailKey, {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
        email,
        mobileNumber: '',
        password: input.password?.trim() || '',
        businessName: input.businessName?.trim() || '',
        provider: input.provider
      });

      const emailResult = await emailOtpService.sendOtp(email, code);

      res.status(200).json({
        otpRequired: true,
        maskedEmail: maskEmail(email),
        emailStatus: emailResult.status,
        ...(shouldExposeAdminTokenForTests() ? { otpCode: code } : {})
      });
      return;
    }

    const { client, plainAdminToken } = await clientPlatformService.createClient(input);
    setAdminSessionCookie(res, plainAdminToken);
    res.status(201).json({
      client: serializeClientForResponse(client),
      ...(shouldExposeAdminTokenForTests() ? { adminToken: plainAdminToken } : {}),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.businessName, client.id)
    });
  },

  async verifySignupOtp(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = verifySignupOtpSchema.parse(req.body);
    const storeKey = input.phone
      ? input.phone.replace(/[^\d+]/g, '')
      : (input.email as string).trim().toLowerCase();
    const record = signupOtpStore.get(storeKey);

    if (!record || record.expiresAt < Date.now()) {
      signupOtpStore.delete(storeKey);
      res.status(400).json({ error: 'Verification code expired. Request a new code.' });
      return;
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      signupOtpStore.delete(storeKey);
      res.status(429).json({ error: 'Too many attempts. Request a new code.' });
      return;
    }

    if (record.code !== input.code.trim()) {
      record.attempts += 1;
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    signupOtpStore.delete(storeKey);

    const { client, plainAdminToken } = await clientPlatformService.createClient({
      email: record.email || undefined,
      mobileNumber: record.mobileNumber,
      password: record.password || undefined,
      businessName: record.businessName || undefined,
      provider: record.provider
    });

    setAdminSessionCookie(res, plainAdminToken);
    res.status(201).json({
      client: serializeClientForResponse(client),
      ...(shouldExposeAdminTokenForTests() ? { adminToken: plainAdminToken } : {}),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.businessName, client.id)
    });
  },

  async authenticateGoogleClient(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const payload = await clientPlatformService.authenticateGoogleClient({
      idToken: googleAuthSchema.parse(req.body).credential
    });
    setAdminSessionCookie(res, payload.plainAdminToken);
    res.status(payload.created ? 201 : 200).json({
      client: serializeClientForResponse(payload.client),
      ...(shouldExposeAdminTokenForTests() ? { adminToken: payload.plainAdminToken } : {}),
      googleProfile: payload.googleIdentity,
      nextStep: payload.nextStep
    });
  },

  async loginClient(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = loginClientSchema.parse(req.body);
    const client = await clientPlatformService.findClientForLogin(input);

    if (!client) {
      throw new HttpError(404, 'Account not found. Sign up to create a new workspace.');
    }

    if (!client.mobileNumber) {
      const payload = await clientPlatformService.loginClient(input);
      setAdminSessionCookie(res, payload.plainAdminToken, input.rememberMe);
      res.status(200).json({
        client: serializeClientForResponse(payload.client),
        ...(shouldExposeAdminTokenForTests() ? { adminToken: payload.plainAdminToken } : {}),
        nextStep: payload.nextStep
      });
      return;
    }

    const code = createOtpCode();
    adminOtpStore.set(client.id, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      clientId: client.id,
      rememberMe: input.rememberMe
    });

    const smsResult = await twilioSmsService.sendSms(
      client.mobileNumber,
      `Your QR Schedule verification code is ${code}. It expires in 10 minutes.`,
      'customer'
    );

    res.status(200).json({
      otpRequired: true,
      clientId: client.id,
      maskedPhone: maskPhone(client.mobileNumber),
      smsStatus: smsResult.status
    });
  },

  async verifyAdminOtp(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const input = verifyAdminOtpSchema.parse(req.body);
    const record = adminOtpStore.get(input.clientId);

    if (!record || record.expiresAt < Date.now()) {
      adminOtpStore.delete(input.clientId);
      res.status(400).json({ error: 'Verification code expired. Request a new code.' });
      return;
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      adminOtpStore.delete(input.clientId);
      res.status(429).json({ error: 'Too many attempts. Request a new code.' });
      return;
    }

    if (record.code !== input.code.trim()) {
      record.attempts += 1;
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    adminOtpStore.delete(input.clientId);

    const payload = await clientPlatformService.loginClientById(input.clientId);
    setAdminSessionCookie(res, payload.plainAdminToken, record.rememberMe);
    res.status(200).json({
      client: serializeClientForResponse(payload.client),
      ...(shouldExposeAdminTokenForTests() ? { adminToken: payload.plainAdminToken } : {}),
      nextStep: payload.nextStep
    });
  },

  async logoutClient(req: Request, res: Response, _next: NextFunction): Promise<void> {
    await clientPlatformService.logoutClient(getClientId(req));
    clearAdminSessionCookie(res);
    res.status(200).json({
      success: true,
      nextStep: '/login'
    });
  },

  async getClient(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      client: serializeClientForResponse(await clientPlatformService.getClient(getClientId(req)))
    });
  },

  async updateBusinessProfile(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateBusinessProfile(
      getClientId(req),
      businessProfileSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.serviceTypes, client.id)
    });
  },

  async updateSalonImages(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateSalonImages(
      getClientId(req),
      salonImagesSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.launchLinks, client.id)
    });
  },

  async updateServiceTypes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateServiceTypes(
      getClientId(req),
      serviceTypesSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.accountType, client.id)
    });
  },

  async updateBusinessSettings(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateBusinessSettings(
      getClientId(req),
      businessSettingsSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.accountType, client.id)
    });
  },

  async updateAccountType(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateAccountType(
      getClientId(req),
      accountTypeSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.serviceLocation, client.id)
    });
  },

  async updateServiceLocation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateServiceLocation(
      getClientId(req),
      serviceLocationSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.venueLocation, client.id)
    });
  },

  async updateVenueLocation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateVenueLocation(
      getClientId(req),
      venueLocationSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.salonImages, client.id)
    });
  },

  async updatePreferredLanguage(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updatePreferredLanguage(
      getClientId(req),
      preferredLanguageSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.complete, client.id)
    });
  },

  async addTeamMember(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.addTeamMember(
      getClientId(req),
      createTeamMemberSchema.parse(req.body)
    );

    res.status(201).json({
      client: serializeClientForResponse(client)
    });
  },

  async updateTeamMember(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateTeamMember(
      getClientId(req),
      getTeamMemberId(req),
      updateTeamMemberSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async removeTeamMember(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.removeTeamMember(
      getClientId(req),
      getTeamMemberId(req)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async addService(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.addService(
      getClientId(req),
      createBusinessServiceSchema.parse(req.body)
    );

    res.status(201).json({
      client: serializeClientForResponse(client)
    });
  },

  async updateService(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateService(
      getClientId(req),
      getServiceId(req),
      updateBusinessServiceSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async removeService(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.removeService(getClientId(req), getServiceId(req));

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async createProduct(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.createProduct(
      getClientId(req),
      createProductSchema.parse(req.body)
    );

    res.status(201).json({
      client: serializeClientForResponse(client)
    });
  },

  async updateProduct(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateProduct(
      getClientId(req),
      getProductId(req),
      updateProductSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async removeProduct(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.removeProduct(getClientId(req), getProductId(req));

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async createPackagePlan(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.createPackagePlan(
      getClientId(req),
      createPackagePlanSchema.parse(req.body)
    );

    res.status(201).json({
      client: serializeClientForResponse(client)
    });
  },

  async updatePackagePlan(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updatePackagePlan(
      getClientId(req),
      getPackagePlanId(req),
      updatePackagePlanSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async removePackagePlan(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.removePackagePlan(
      getClientId(req),
      getPackagePlanId(req)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async updateLoyaltyProgram(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateLoyaltyProgram(
      getClientId(req),
      updateLoyaltyProgramSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async sellPackage(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(201).json(
      await appointmentService.sellPackageToCustomer(
        getClientId(req),
        sellPackageSchema.parse(req.body)
      )
    );
  },

  async createStripeConnectOnboarding(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    res.status(201).json(
      await clientPlatformService.createStripeConnectOnboarding(
        getClientId(req),
        getRequestOrigin(req),
        stripeConnectOnboardingSchema.parse(req.body ?? {}).countryCode
      )
    );
  },

  async getStripeConnectStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      stripeConnectAccount: await clientPlatformService.refreshStripeConnectAccount(getClientId(req))
    });
  },

  async createPackageCheckout(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(201).json(
      await appointmentService.createPackageCheckoutSession(
        getClientId(req),
        sellPackageSchema.parse(req.body),
        getRequestOrigin(req),
        `/calendar?clientId=${encodeURIComponent(getClientId(req))}&packageCheckout=success`,
        `/calendar?clientId=${encodeURIComponent(getClientId(req))}&packageCheckout=cancelled`
      )
    );
  },

  async sellProduct(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.sellProduct(
      getClientId(req),
      sellProductSchema.parse(req.body)
    );

    res.status(201).json({
      client: serializeClientForResponse(client)
    });
  },

  async completeOnboarding(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.completeOnboarding(getClientId(req));
    await sendWelcomeEmail(client, getRequestOrigin(req));
    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: buildPlatformClientPagePath(platformClientPagePaths.onboarding.complete, client.id)
    });
  },

  async getLaunchLinks(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      launchLinks: await clientPlatformService.getLaunchLinks(getClientId(req), getRequestOrigin(req))
    });
  },

  async getDashboard(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const payload = await clientPlatformService.getDashboard(getClientId(req), getRequestOrigin(req));
    res.status(200).json({
      ...payload,
      client: serializeClientForResponse(payload.client)
    });
  },

  async getSmsLogs(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      logs: await clientPlatformService.getSmsLogs(getClientId(req))
    });
  },

  async listPublicSalons(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.status(200).json({
      salons: await clientPlatformService.getPublicSalons()
    });
  }
};
