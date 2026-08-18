import { env } from '../config/env';
import { logger } from '../shared/logger';
import { platformSettingsRepository } from './platformSettings.repository';
import {
  MANUAL_PAYMENT_METHOD_KEYS,
  type ManualPaymentMethodKey,
  type PlatformSettingsRecord
} from './platformSettings.types';

export interface StripeSettingsOverview {
  stripeEnabled: boolean;
  // 'override' = an admin has toggled this from the platform-admin page.
  // 'env' = no override saved yet, using the STRIPE_ENABLED env var default.
  source: 'override' | 'env';
  updatedAt?: string;
  updatedBy?: string;
}

export interface CampaignPricing {
  smsCostCents: number;
  emailCostCents: number;
  source: 'override' | 'env';
}

export interface ManualPaymentMethod {
  key: ManualPaymentMethodKey;
  label: string;
  qrImageUrl: string;
  instructions: string;
}

export const MANUAL_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethodKey, string> = {
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  bank_transfer: 'Bank Transfer'
};

// Deterministic placeholder QR pattern (finder squares + a hash-derived
// checker grid + a "SAMPLE" watermark) so the buyer-facing picker never
// looks broken while a method has no real QR uploaded yet. Clearly marked as
// a sample so nobody mistakes it for a scannable payment code. Real images
// set via the admin panel (setManualPaymentMethod) always take priority.
const buildDummyQrImageUrl = (label: string): string => {
  const cell = 18;
  const grid = 9;
  const size = cell * grid;
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }

  const isFinder = (row: number, col: number) =>
    (row < 3 && col < 3) || (row < 3 && col >= grid - 3) || (row >= grid - 3 && col < 3);

  let squares = '';
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      if (isFinder(row, col)) {
        continue;
      }
      const bit = (hash >> ((row * grid + col) % 24)) & 1;
      if (bit === 1) {
        squares += `<rect x="${col * cell}" y="${row * cell}" width="${cell}" height="${cell}" fill="#111827"/>`;
      }
    }
  }

  const finderSquare = (x: number, y: number) => `
    <rect x="${x}" y="${y}" width="${cell * 3}" height="${cell * 3}" fill="#111827"/>
    <rect x="${x + cell * 0.6}" y="${y + cell * 0.6}" width="${cell * 1.8}" height="${cell * 1.8}" fill="#fff"/>
    <rect x="${x + cell * 1.1}" y="${y + cell * 1.1}" width="${cell * 0.8}" height="${cell * 0.8}" fill="#111827"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 34}" viewBox="0 0 ${size} ${size + 34}">
    <rect width="${size}" height="${size + 34}" fill="#ffffff"/>
    ${finderSquare(0, 0)}
    ${finderSquare(size - cell * 3, 0)}
    ${finderSquare(0, size - cell * 3)}
    ${squares}
    <rect x="0" y="${size}" width="${size}" height="34" fill="#111827"/>
    <text x="${size / 2}" y="${size + 22}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#ffffff">SAMPLE QR - ${label}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

// Only Easypaisa/JazzCash get a placeholder - bank transfer has no QR
// concept and stays blank (label/instructions only) until an admin fills it in.
const DUMMY_MANUAL_PAYMENT_QR_IMAGE_URLS: Partial<Record<ManualPaymentMethodKey, string>> = {
  easypaisa: buildDummyQrImageUrl('Easypaisa'),
  jazzcash: buildDummyQrImageUrl('JazzCash')
};

const getRecordOrNull = async (): Promise<PlatformSettingsRecord | null> => {
  try {
    return await platformSettingsRepository.get();
  } catch (error) {
    logger.error('Failed to read platform settings, using env defaults', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

const mergeAndSave = async (
  patch: Partial<PlatformSettingsRecord>,
  updatedBy?: string
): Promise<PlatformSettingsRecord> => {
  const existing = await platformSettingsRepository.get().catch(() => null);
  const record: PlatformSettingsRecord = {
    stripeEnabled: existing?.stripeEnabled ?? null,
    campaignSmsCostCents: existing?.campaignSmsCostCents ?? null,
    campaignEmailCostCents: existing?.campaignEmailCostCents ?? null,
    manualPaymentMethods: existing?.manualPaymentMethods ?? null,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy
  };

  await platformSettingsRepository.save(record);
  return record;
};

export const platformSettingsService = {
  // Falls back to the env default on any storage error (e.g. the
  // platform_settings table not existing yet). This is read on nearly every
  // request (public-config, booking, checkout gates), so a storage hiccup
  // here must never take down unrelated flows - see the "booking should
  // never fail because an optional provider is unavailable" principle.
  async isStripeEnabled(): Promise<boolean> {
    const record = await getRecordOrNull();

    if (record && record.stripeEnabled !== null && record.stripeEnabled !== undefined) {
      return record.stripeEnabled;
    }

    return env.STRIPE_ENABLED || Boolean(env.STRIPE_SECRET_KEY?.trim());
  },

  async getStripeOverview(): Promise<StripeSettingsOverview> {
    const record = await platformSettingsRepository.get();

    if (record && record.stripeEnabled !== null && record.stripeEnabled !== undefined) {
      return {
        stripeEnabled: record.stripeEnabled,
        source: 'override',
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy
      };
    }

    return {
      stripeEnabled: env.STRIPE_ENABLED || Boolean(env.STRIPE_SECRET_KEY?.trim()),
      source: 'env'
    };
  },

  async setStripeEnabled(enabled: boolean, updatedBy?: string): Promise<StripeSettingsOverview> {
    const record = await mergeAndSave({ stripeEnabled: enabled }, updatedBy);

    return {
      stripeEnabled: enabled,
      source: 'override' as const,
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy
    };
  },

  // Falls back to env defaults on any storage error, for the same reason as
  // isStripeEnabled - this gates campaign sends and must never itself be the
  // cause of a campaign failing to send.
  async getCampaignPricing(): Promise<CampaignPricing> {
    const record = await getRecordOrNull();
    const hasOverride =
      record &&
      ((record.campaignSmsCostCents !== null && record.campaignSmsCostCents !== undefined) ||
        (record.campaignEmailCostCents !== null && record.campaignEmailCostCents !== undefined));

    return {
      smsCostCents: record?.campaignSmsCostCents ?? env.WALLET_SMS_COST_CENTS,
      emailCostCents: record?.campaignEmailCostCents ?? env.WALLET_EMAIL_COST_CENTS,
      source: hasOverride ? 'override' : 'env'
    };
  },

  async setCampaignPricing(
    input: { smsCostCents?: number; emailCostCents?: number },
    updatedBy?: string
  ): Promise<CampaignPricing> {
    const patch: Partial<PlatformSettingsRecord> = {};

    if (typeof input.smsCostCents === 'number') {
      patch.campaignSmsCostCents = input.smsCostCents;
    }

    if (typeof input.emailCostCents === 'number') {
      patch.campaignEmailCostCents = input.emailCostCents;
    }

    await mergeAndSave(patch, updatedBy);
    return platformSettingsService.getCampaignPricing();
  },

  // Always returns all three methods (even unconfigured ones, with empty
  // qrImageUrl/instructions) so the buyer-facing picker can show all of them
  // as selectable options regardless of admin setup progress.
  async getManualPaymentMethods(): Promise<ManualPaymentMethod[]> {
    const record = await getRecordOrNull();
    const overrides = record?.manualPaymentMethods ?? {};

    return MANUAL_PAYMENT_METHOD_KEYS.map((key) => ({
      key,
      label: MANUAL_PAYMENT_METHOD_LABELS[key],
      qrImageUrl: overrides[key]?.qrImageUrl?.trim() || DUMMY_MANUAL_PAYMENT_QR_IMAGE_URLS[key] || '',
      instructions: overrides[key]?.instructions?.trim() ?? ''
    }));
  },

  async setManualPaymentMethod(
    key: ManualPaymentMethodKey,
    input: { qrImageUrl?: string; instructions?: string },
    updatedBy?: string
  ): Promise<ManualPaymentMethod[]> {
    const existing = await platformSettingsRepository.get().catch(() => null);
    const methods = { ...(existing?.manualPaymentMethods ?? {}) };

    methods[key] = {
      qrImageUrl: typeof input.qrImageUrl === 'string' ? input.qrImageUrl.trim() : methods[key]?.qrImageUrl,
      instructions:
        typeof input.instructions === 'string' ? input.instructions.trim() : methods[key]?.instructions
    };

    await mergeAndSave({ manualPaymentMethods: methods }, updatedBy);
    return platformSettingsService.getManualPaymentMethods();
  }
};
