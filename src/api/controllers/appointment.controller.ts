import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { HttpError } from '../../shared/errors/httpError';
import { appointmentService } from '../../appointments/appointment.service';
import { getRequestOrigin } from '../../shared/http';
import {
  defaultBookingAddressRequiredMessage,
  serviceLocationRequiresAddress,
  serviceLocationValues
} from '../../platform/serviceLocation.constants';

const bookingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid booking date is required');
const bookingHistoryPhoneSchema = z.string().trim().min(7, 'Customer phone is required');
const appointmentIdSchema = z.string().uuid('Valid appointment id is required');
const appointmentAccessTokenSchema = z.string().uuid('Valid appointment access token is required');
const optionalAppointmentAccessTokenSchema = appointmentAccessTokenSchema.optional().or(z.literal(''));
const optionalAppointmentIdSchema = z.string().uuid('Valid appointment id is required').optional();
const optionalWaitlistEntryIdSchema = z.string().uuid('Valid waitlist entry id is required').optional();
const optionalWaitlistOfferTokenSchema = z.string().uuid('Valid waitlist offer token is required').optional();
const optionalTeamMemberIdSchema = z.string().trim().optional().or(z.literal(''));
const optionalServiceNameSchema = z.string().trim().optional().or(z.literal(''));
const optionalServiceLocationSchema = z.enum(serviceLocationValues).optional();

const createAppointmentSchema = z.object({
  serviceName: z.string().trim().min(1, 'Service is required'),
  teamMemberId: z.string().trim().optional().or(z.literal('')),
  serviceLocation: optionalServiceLocationSchema,
  customerAddress: z.string().trim().optional().or(z.literal('')),
  appointmentDate: bookingDateSchema,
  appointmentTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Valid appointment time is required'),
  customerName: z.string().trim().min(2, 'Customer name is required'),
  customerPhone: z.string().trim().min(7, 'Customer phone is required'),
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  source: z
    .enum(['qr', 'direct', 'instagram', 'facebook', 'applemaps'])
    .optional(),
  packagePurchaseId: z.string().trim().optional().or(z.literal('')),
  loyaltyRewardId: z.string().trim().optional().or(z.literal('')),
  waitlistEntryId: z.string().uuid().optional().or(z.literal('')),
  waitlistOfferToken: z.string().uuid().optional().or(z.literal(''))
}).superRefine((value, context) => {
  if (value.serviceLocation && serviceLocationRequiresAddress(value.serviceLocation) && !value.customerAddress?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: defaultBookingAddressRequiredMessage,
      path: ['customerAddress']
    });
  }
});

const createWaitlistSchema = z.object({
  serviceName: z.string().trim().min(1, 'Service is required'),
  teamMemberId: z.string().trim().optional().or(z.literal('')),
  appointmentDate: bookingDateSchema,
  preferredTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Valid preferred time is required')
    .optional()
    .or(z.literal('')),
  customerName: z.string().trim().min(2, 'Customer name is required'),
  customerPhone: z.string().trim().min(7, 'Customer phone is required'),
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  source: z
    .enum(['qr', 'direct', 'instagram', 'facebook', 'applemaps'])
    .optional()
});

const createReviewSchema = z.object({
  appointmentId: z.string().uuid('Valid appointment id is required'),
  customerPhone: z.string().trim().min(7, 'Customer phone is required'),
  reviewerName: z.string().trim().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().or(z.literal(''))
});

const rescheduleAppointmentSchema = z.object({
  appointmentDate: bookingDateSchema,
  appointmentTime: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, 'Valid appointment time is required')
});

const runningLateNotificationSchema = z.object({
  delayMinutes: z.number().int().min(1).max(240).optional(),
  note: z.string().trim().max(240).optional().or(z.literal(''))
});

const createAppointmentPaymentSchema = z.object({
  amountValue: z.number().positive('Payment amount must be greater than zero'),
  method: z.enum(['cash', 'card', 'bank_transfer', 'wallet', 'other']),
  note: z.string().trim().max(240).optional().or(z.literal(''))
});

const publicAppointmentAccessSchema = z.object({
  accessToken: appointmentAccessTokenSchema
});

const getBusinessId = (req: Request): string => {
  const businessId = req.params.clientId;

  if (!businessId) {
    throw new HttpError(400, 'Business id is required');
  }

  return businessId;
};

export const appointmentController = {
  async getPublicBookingPage(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    res.status(200).json(
      await appointmentService.getPublicBookingPageWithWaitlistClaim(
        getBusinessId(req),
        optionalWaitlistEntryIdSchema.parse(req.query.waitlistEntryId),
        optionalWaitlistOfferTokenSchema.parse(req.query.waitlistOfferToken)
      )
    );
  },

  async getAvailableSlots(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const appointmentDate = bookingDateSchema.parse(req.query.date);
    const excludeAppointmentId = optionalAppointmentIdSchema.parse(req.query.excludeAppointmentId);
    const waitlistEntryId = optionalWaitlistEntryIdSchema.parse(req.query.waitlistEntryId);
    const waitlistOfferToken = optionalWaitlistOfferTokenSchema.parse(req.query.waitlistOfferToken);
    const appointmentAccessToken = optionalAppointmentAccessTokenSchema.parse(req.query.accessToken);
    const teamMemberId = optionalTeamMemberIdSchema.parse(req.query.teamMemberId);
    const serviceName = optionalServiceNameSchema.parse(req.query.serviceName);

    res.status(200).json(
      await appointmentService.getAvailableSlots(
        getBusinessId(req),
        appointmentDate,
        excludeAppointmentId,
        waitlistEntryId,
        waitlistOfferToken,
        appointmentAccessToken,
        teamMemberId,
        serviceName
      )
    );
  },

  async getPlatformAvailableSlots(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const appointmentDate = bookingDateSchema.parse(req.query.date);
    const excludeAppointmentId = optionalAppointmentIdSchema.parse(req.query.excludeAppointmentId);
    const teamMemberId = optionalTeamMemberIdSchema.parse(req.query.teamMemberId);
    const serviceName = optionalServiceNameSchema.parse(req.query.serviceName);

    res.status(200).json(
      await appointmentService.getPlatformAvailableSlots(
        getBusinessId(req),
        appointmentDate,
        excludeAppointmentId,
        teamMemberId,
        serviceName
      )
    );
  },

  async listPublicBookingHistory(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const customerPhone = bookingHistoryPhoneSchema.parse(req.query.phone);

    res
      .status(200)
      .json(await appointmentService.listPublicBookingHistoryByPhone(getBusinessId(req), customerPhone));
  },

  async listPublicBenefits(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const customerPhone = bookingHistoryPhoneSchema.parse(req.query.phone);

    res
      .status(200)
      .json(await appointmentService.listPublicBenefitsByPhone(getBusinessId(req), customerPhone));
  },

  async createAppointment(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    res.status(201).json(
      await appointmentService.createAppointment(
        getBusinessId(req),
        createAppointmentSchema.parse(req.body),
        origin
      )
    );
  },

  async createWaitlistEntry(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(201).json(
      await appointmentService.createWaitlistEntry(
        getBusinessId(req),
        createWaitlistSchema.parse(req.body)
      )
    );
  },

  async getPublicAppointmentManagement(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const accessToken = appointmentAccessTokenSchema.parse(req.query.accessToken);
    res.status(200).json(
      await appointmentService.getPublicAppointmentManagement(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        accessToken
      )
    );
  },

  async reschedulePublicAppointment(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const origin = getRequestOrigin(req);
    const { accessToken } = publicAppointmentAccessSchema.parse(req.body);
    res.status(200).json(
      await appointmentService.reschedulePublicAppointment(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        accessToken,
        rescheduleAppointmentSchema.parse(req.body),
        origin
      )
    );
  },

  async rescheduleAppointment(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    res.status(200).json(
      await appointmentService.rescheduleAppointment(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        rescheduleAppointmentSchema.parse(req.body),
        origin
      )
    );
  },

  async cancelPublicAppointment(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    const { accessToken } = publicAppointmentAccessSchema.parse(req.body);
    res.status(200).json(
      await appointmentService.cancelPublicAppointment(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        accessToken,
        origin
      )
    );
  },

  async cancelAppointment(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    res.status(200).json(
      await appointmentService.cancelAppointment(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        origin
      )
    );
  },

  async completeAppointment(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(
      await appointmentService.completeAppointment(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId)
      )
    );
  },

  async sendRunningLateNotification(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const origin = getRequestOrigin(req);
    res.status(200).json(
      await appointmentService.sendAppointmentRunningLateNotification(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        runningLateNotificationSchema.parse(req.body),
        origin
      )
    );
  },

  async listPublicReviews(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(await appointmentService.listReviewsForBusiness(getBusinessId(req)));
  },

  async createReview(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(201).json(
      await appointmentService.createReview(
        getBusinessId(req),
        createReviewSchema.parse(req.body)
      )
    );
  },

  async getBookingQrCode(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    const bookingUrl = await appointmentService.getBookingUrl(getBusinessId(req), origin, 'qr');
    const qrSvg = await QRCode.toString(bookingUrl, {
      type: 'svg',
      margin: 1,
      width: 256
    });

    res.type('image/svg+xml').send(qrSvg);
  },

  async listAppointments(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      appointments: await appointmentService.listAppointmentsForBusiness(getBusinessId(req))
    });
  },

  async listPayments(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(await appointmentService.listPaymentsForBusiness(getBusinessId(req)));
  },

  async createPayment(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(201).json(
      await appointmentService.recordPaymentForAppointment(
        getBusinessId(req),
        appointmentIdSchema.parse(req.params.appointmentId),
        createAppointmentPaymentSchema.parse(req.body)
      )
    );
  },

  async listWaitlist(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    res.status(200).json(
      await appointmentService.listWaitlistForBusiness(getBusinessId(req), origin)
    );
  },

  async listPlatformReviews(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json(await appointmentService.listReviewsForBusiness(getBusinessId(req)));
  }
};
