import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import { HttpError } from '../../shared/errors/httpError';
import { getRequestOrigin } from '../../shared/http';
import { marketingService } from '../../marketing/marketing.service';
import { parseContactCsvRecords } from '../../marketing/marketingRecipients.util';

const getBusinessId = (req: Request): string => {
  const businessId = req.params.clientId;

  if (!businessId) {
    throw new HttpError(400, 'Business id is required');
  }

  return businessId;
};

const templateTypeSchema = z.enum([
  'percent_off',
  'flat_amount_off',
  'free_service',
  'happy_hour',
  'last_minute_fill'
]);

const csvContactSchema = z.object({
  name: z.string().trim().default(''),
  phone: z.string().trim().default(''),
  email: z.string().trim().default('')
});

const createCampaignSchema = z
  .object({
    name: z.string().trim().default(''),
    templateType: templateTypeSchema,
    discountPercent: z.number().min(1).max(100).optional(),
    discountAmountCents: z.number().int().positive().optional(),
    currencyCode: z.string().trim().optional().or(z.literal('')),
    targetServiceId: z.string().trim().optional().or(z.literal('')),
    freeServiceId: z.string().trim().optional().or(z.literal('')),
    happyHourStartTime: z.string().trim().optional().or(z.literal('')),
    happyHourEndTime: z.string().trim().optional().or(z.literal('')),
    offerName: z.string().trim().optional().or(z.literal('')),
    originalPriceCents: z.number().int().positive().optional(),
    discountedPriceCents: z.number().int().positive().optional(),
    smsBody: z.string().trim().min(1, 'SMS message is required'),
    emailSubject: z.string().trim().min(1, 'Email subject is required'),
    emailBodyText: z.string().trim().min(1, 'Email body is required'),
    channel: z.enum(['sms', 'email', 'both']),
    recipientSource: z.enum(['existing_clients', 'csv_upload', 'both', 'random_batch'])
  });

const recipientSourceInputSchema = z.object({
  recipientSource: z.enum(['existing_clients', 'csv_upload', 'both', 'random_batch']),
  csvContacts: z.array(csvContactSchema).default([])
});

const updateTemplateSchema = z.object({
  smsBody: z.string().trim().optional(),
  emailSubject: z.string().trim().optional(),
  emailBodyText: z.string().trim().optional(),
  defaultDiscountPercent: z.number().min(1).max(100).optional()
});

const campaignIdSchema = z.string().uuid('Valid campaign id is required');

export const marketingController = {
  async listCampaigns(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({
      campaigns: await marketingService.listCampaignsWithStats(getBusinessId(req))
    });
  },

  async createCampaign(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const origin = getRequestOrigin(req);
    const campaign = await marketingService.createCampaign(
      getBusinessId(req),
      createCampaignSchema.parse(req.body),
      origin
    );
    res.status(201).json({ campaign });
  },

  async getCampaign(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const businessId = getBusinessId(req);
    const campaignId = campaignIdSchema.parse(req.params.campaignId);
    const [campaign, recipients] = await Promise.all([
      marketingService.getCampaignStats(businessId, campaignId),
      marketingService.listCampaignRecipients(businessId, campaignId)
    ]);
    res.status(200).json({ campaign, recipients });
  },

  async previewRecipients(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const businessId = getBusinessId(req);
    campaignIdSchema.parse(req.params.campaignId);
    const input = recipientSourceInputSchema.parse(req.body);
    const preview = await marketingService.previewRecipients(businessId, input.recipientSource, input.csvContacts);
    res.status(200).json(preview);
  },

  async uploadContactsCsv(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const file = (req as Request & { file?: { buffer: Buffer } }).file;

    if (!file) {
      throw new HttpError(400, 'A CSV file is required');
    }

    let records: string[][];

    try {
      records = parse(file.buffer, { skip_empty_lines: true, trim: true }) as string[][];
    } catch (_error) {
      throw new HttpError(400, 'Unable to read this file. Please upload a valid CSV.');
    }

    const { rows, rejectedCount } = parseContactCsvRecords(records);
    res.status(200).json({ contacts: rows, rejectedCount });
  },

  async sendCampaign(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const businessId = getBusinessId(req);
    const campaignId = campaignIdSchema.parse(req.params.campaignId);
    const input = recipientSourceInputSchema.parse(req.body);
    const campaign = await marketingService.confirmAndDispatchCampaign(
      businessId,
      campaignId,
      input.recipientSource,
      input.csvContacts
    );
    res.status(200).json({ campaign });
  },

  async getTemplate(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const templateType = templateTypeSchema.parse(req.params.templateType);
    const template = await marketingService.getEffectiveTemplate(getBusinessId(req), templateType);
    res.status(200).json({ template });
  },

  async updateTemplate(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const templateType = templateTypeSchema.parse(req.params.templateType);
    const template = await marketingService.updateTemplate(
      getBusinessId(req),
      templateType,
      updateTemplateSchema.parse(req.body)
    );
    res.status(200).json({ template });
  },

  async trackLinkOpen(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const campaignId = z.string().uuid().safeParse(req.params.campaignId);

    if (campaignId.success) {
      await marketingService.recordLinkOpen(campaignId.data);
    }

    res.status(204).end();
  }
};
