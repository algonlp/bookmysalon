import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { HttpError } from '../../shared/errors/httpError';
import {
  clientPlatformService,
  serializeClientForResponse
} from '../../platform/clientPlatform.service';
import { appointmentService } from '../../appointments/appointment.service';
import { getRequestOrigin, setAdminSessionCookie } from '../../shared/http';

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
  provider: z.enum(['email', 'facebook', 'google', 'apple']).default('email')
}).refine(
  (value) => value.provider !== 'email' || Boolean(value.email || value.mobileNumber),
  {
    message: 'Email or mobile number is required',
    path: ['email']
  }
);

const businessProfileSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  website: z.string().trim().optional(),
  profileImageUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => isValidProfileImageValue(value ?? ''), 'Valid image URL or uploaded image is required')
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

const accountTypeSchema = z.object({
  accountType: z.enum(['independent', 'team'])
});

const serviceLocationSchema = z.object({
  serviceLocation: z.array(z.enum(['physical', 'mobile', 'virtual'])).min(1)
});

const venueLocationSchema = z.object({
  venueAddress: z.string().trim().min(3, 'Venue address is required')
});

const preferredLanguageSchema = z.object({
  preferredLanguage: z.enum(['english', 'urdu', 'arabic'])
});

const createTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Team member name is required'),
  role: z.string().trim().min(1, 'Role is required').optional(),
  phone: z.string().trim().optional(),
  expertise: z.string().trim().optional()
});

const updateTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Team member name is required'),
  role: z.string().trim().min(1, 'Role is required').optional(),
  phone: z.string().trim().optional(),
  expertise: z.string().trim().optional()
});

const createBusinessServiceSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required'),
  categoryName: z.string().trim().optional(),
  durationMinutes: z.number().int().min(15).max(480),
  priceLabel: z.string().trim().min(1, 'Price is required'),
  description: z.string().trim().optional()
});

const createPackagePlanSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required'),
  includedServiceIds: z.array(z.string().trim().min(1)).optional().default([]),
  totalUses: z.number().int().min(1).max(100),
  priceLabel: z.string().trim().min(1, 'Package price is required')
});

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

export const clientPlatformController = {
  async createClient(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.createClient(createClientSchema.parse(req.body));
    setAdminSessionCookie(res, client.adminToken);
    res.status(201).json({
      client: serializeClientForResponse(client),
      ...(shouldExposeAdminTokenForTests() ? { adminToken: client.adminToken } : {}),
      nextStep: `/onboarding/business-name?clientId=${client.id}`
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
      nextStep: `/onboarding/service-types?clientId=${client.id}`
    });
  },

  async updateServiceTypes(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateServiceTypes(
      getClientId(req),
      serviceTypesSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: `/onboarding/account-type?clientId=${client.id}`
    });
  },

  async updateBusinessSettings(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateBusinessSettings(
      getClientId(req),
      businessSettingsSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async updateAccountType(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateAccountType(
      getClientId(req),
      accountTypeSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: `/onboarding/service-location?clientId=${client.id}`
    });
  },

  async updateServiceLocation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateServiceLocation(
      getClientId(req),
      serviceLocationSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: `/onboarding/venue-location?clientId=${client.id}`
    });
  },

  async updateVenueLocation(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updateVenueLocation(
      getClientId(req),
      venueLocationSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client)
    });
  },

  async updatePreferredLanguage(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.updatePreferredLanguage(
      getClientId(req),
      preferredLanguageSchema.parse(req.body)
    );

    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: `/onboarding/complete?clientId=${client.id}`
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

  async createPackagePlan(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.createPackagePlan(
      getClientId(req),
      createPackagePlanSchema.parse(req.body)
    );

    res.status(201).json({
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

  async completeOnboarding(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const client = await clientPlatformService.completeOnboarding(getClientId(req));
    res.status(200).json({
      client: serializeClientForResponse(client),
      nextStep: `/onboarding/complete?clientId=${client.id}`
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

  async listPublicSalons(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      salons: await clientPlatformService.getPublicSalons()
    });
  }
};
