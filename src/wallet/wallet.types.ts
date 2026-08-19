import type { ManualPaymentMethodKey } from '../platform/platformSettings.types';

export type WalletTransactionType =
  | 'paid_topup'
  | 'promotional_credit'
  | 'usage'
  | 'refund'
  | 'adjustment';

export type WalletTopupStatus = 'pending_review' | 'approved' | 'rejected';

// Rs500 / Rs1,000 / Rs2,500 / Rs5,000 preset top-up amounts.
export const WALLET_TOPUP_PRESET_AMOUNTS_CENTS = [50000, 100000, 250000, 500000];
export const WALLET_TOPUP_MIN_CENTS = 10000; // Rs100 floor for custom amounts
export const WALLET_TOPUP_MAX_CENTS = 100000000; // Rs1,000,000 ceiling for custom amounts

// One-time campaign credit is only usable for this many days after it is
// granted (first paid activation) - see wallet.service.ts#grantPromotionalCredit.
export const PROMOTIONAL_CREDIT_EXPIRY_DAYS = 30;

export interface WalletRecord {
  businessId: string;
  balanceCents: number;
  currencyCode: string;
  // Tracks the still-usable portion of the one-time promotional (campaign)
  // credit separately from balanceCents, so it can be told apart from paid
  // top-up funds and forfeited once promotionalCreditExpiresAt passes.
  // balanceCents already includes this amount - it is not spendable on top.
  promotionalBalanceCents: number;
  promotionalCreditExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransactionRecord {
  id: string;
  businessId: string;
  type: WalletTransactionType;
  // Signed: positive = credit to the wallet, negative = debit.
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
  source: string;
  operator?: string;
  // Used for idempotency (e.g. campaignId for a usage debit, topupId for a
  // credit) so retries/double-clicks never double-charge or double-credit.
  referenceId?: string;
  note?: string;
  createdAt: string;
}

export interface WalletTopupRequestRecord {
  id: string;
  businessId: string;
  amountCents: number;
  paymentMethod: ManualPaymentMethodKey;
  paymentProofDataUrl: string;
  transactionReference: string;
  status: WalletTopupStatus;
  // Cleared once the token has been used (or the request decided), so a
  // replayed email link can never re-approve/re-reject.
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletOverview {
  balanceCents: number;
  currencyCode: string;
  // Still-usable, not-yet-expired portion of the one-time campaign credit
  // (already included in balanceCents above, shown separately so the salon
  // can tell it apart from paid top-up funds).
  promotionalBalanceCents: number;
  promotionalCreditExpiresAt?: string;
  transactions: WalletTransactionRecord[];
  pendingTopupRequests: WalletTopupRequestRecord[];
}

export interface CampaignCostPreview {
  smsCostCents: number;
  emailCostCents: number;
  estimatedTotalCents: number;
  balanceCents: number;
  balanceAfterCents: number;
  hasSufficientBalance: boolean;
  topupNeededCents: number;
}
