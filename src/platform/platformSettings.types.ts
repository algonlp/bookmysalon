export const MANUAL_PAYMENT_METHOD_KEYS = ['easypaisa', 'jazzcash', 'bank_transfer'] as const;

export type ManualPaymentMethodKey = (typeof MANUAL_PAYMENT_METHOD_KEYS)[number];

export interface ManualPaymentMethodDetails {
  qrImageUrl?: string;
  instructions?: string;
}

export interface PlatformSettingsRecord {
  // null = no override saved yet; falls back to the STRIPE_ENABLED env var.
  stripeEnabled: boolean | null;
  // null/undefined = no override saved yet; falls back to the WALLET_*_COST_CENTS env vars.
  campaignSmsCostCents?: number | null;
  campaignEmailCostCents?: number | null;
  // Per-method QR/instructions for the manual payment picker (Easypaisa,
  // JazzCash, Bank Transfer). A method with no entry (or empty fields) still
  // shows as a selectable option - the buyer can submit proof and ALGONLP
  // shares/verifies details manually.
  manualPaymentMethods?: Partial<Record<ManualPaymentMethodKey, ManualPaymentMethodDetails>> | null;
  updatedAt: string;
  updatedBy?: string;
}
