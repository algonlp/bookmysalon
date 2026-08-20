import { randomUUID } from 'crypto';
import { HttpError } from '../shared/errors/httpError';
import { clientPlatformRepository } from '../platform/clientPlatform.repository';
import { platformSettingsService, MANUAL_PAYMENT_METHOD_LABELS } from '../platform/platformSettings.service';
import { walletRepository } from './wallet.repository';
import type {
  CampaignCostPreview,
  WalletOverview,
  WalletRecord,
  WalletTopupRequestRecord,
  WalletTransactionRecord
} from './wallet.types';
import {
  PROMOTIONAL_CREDIT_EXPIRY_DAYS,
  WALLET_TOPUP_MAX_CENTS,
  WALLET_TOPUP_MIN_CENTS,
  WALLET_TOPUP_PRESET_AMOUNTS_CENTS
} from './wallet.types';
import {
  issueVerificationToken,
  sendAdminVerificationEmail,
  sendBuyerDecisionEmail,
  type PaymentVerificationAdapter
} from '../notifications/paymentVerification';

const DEFAULT_CURRENCY_CODE = 'PKR';

const formatAmountCentsLabel = (amountCents: number): string => `Rs${(amountCents / 100).toFixed(0)}`;

const getBusinessOrThrow = async (businessId: string): Promise<{ businessName: string; email: string }> => {
  const business = await clientPlatformRepository.getClientById(businessId);

  if (!business) {
    throw new HttpError(404, 'Business not found');
  }

  return { businessName: business.businessName, email: business.email };
};

// Once the one-time campaign credit's 30-day window has passed, whatever of
// it is still unspent is forfeited: it comes out of balanceCents (so the
// salon's displayed total balance drops accordingly) with its own ledger
// entry, and promotionalBalanceCents is zeroed so it can't be drawn on again.
// Idempotent per business via a fixed referenceId, so re-running this on
// every wallet read never double-forfeits.
const sweepExpiredPromotionalCredit = async (wallet: WalletRecord): Promise<WalletRecord> => {
  if (
    !wallet.promotionalCreditExpiresAt ||
    wallet.promotionalBalanceCents <= 0 ||
    new Date(wallet.promotionalCreditExpiresAt).getTime() > Date.now()
  ) {
    return wallet;
  }

  const referenceId = `promo_expiry:${wallet.businessId}:${wallet.promotionalCreditExpiresAt}`;
  const existingSweep = await walletRepository.findTransactionByReference(
    wallet.businessId,
    referenceId,
    'adjustment'
  );

  if (existingSweep) {
    // Already forfeited on a previous read - just clear the stale pool fields.
    return walletRepository.saveWallet({
      ...wallet,
      promotionalBalanceCents: 0,
      promotionalCreditExpiresAt: undefined,
      updatedAt: new Date().toISOString()
    });
  }

  const forfeitedCents = wallet.promotionalBalanceCents;
  const balanceAfterCents = wallet.balanceCents - forfeitedCents;
  const updatedWallet: WalletRecord = {
    ...wallet,
    balanceCents: balanceAfterCents,
    promotionalBalanceCents: 0,
    promotionalCreditExpiresAt: undefined,
    updatedAt: new Date().toISOString()
  };

  await walletRepository.saveWallet(updatedWallet);
  await walletRepository.saveTransaction({
    id: randomUUID(),
    businessId: wallet.businessId,
    type: 'adjustment',
    amountCents: -forfeitedCents,
    balanceBeforeCents: wallet.balanceCents,
    balanceAfterCents,
    source: 'promotional_credit_expired',
    referenceId,
    note: 'Unused one-time campaign credit expired after 30 days',
    createdAt: new Date().toISOString()
  });

  return updatedWallet;
};

const getOrCreateWallet = async (businessId: string): Promise<WalletRecord> => {
  const existing = await walletRepository.getWallet(businessId);

  if (existing) {
    return sweepExpiredPromotionalCredit(existing);
  }

  const now = new Date().toISOString();
  const wallet: WalletRecord = {
    businessId,
    balanceCents: 0,
    promotionalBalanceCents: 0,
    currencyCode: DEFAULT_CURRENCY_CODE,
    createdAt: now,
    updatedAt: now
  };

  return walletRepository.saveWallet(wallet);
};

// The still-usable (not yet expired) portion of the one-time campaign credit.
const getValidPromotionalBalanceCents = (wallet: WalletRecord): number =>
  wallet.promotionalCreditExpiresAt && new Date(wallet.promotionalCreditExpiresAt).getTime() > Date.now()
    ? wallet.promotionalBalanceCents
    : 0;

// Credits or debits the wallet and writes a matching ledger entry in one
// place, so every balance change is always recorded with before/after
// amounts, source, and (when applicable) the operator who approved it.
// promotionalDeltaCents (when given) additionally adjusts the ring-fenced
// promotional-credit pool - positive when granting it, negative when a debit
// draws from it - independently of the overall balanceCents delta.
const applyLedgerEntry = async (input: {
  businessId: string;
  type: WalletTransactionRecord['type'];
  amountCents: number;
  source: string;
  operator?: string;
  referenceId?: string;
  note?: string;
  promotionalDeltaCents?: number;
  promotionalCreditExpiresAt?: string;
}): Promise<{ wallet: WalletRecord; transaction: WalletTransactionRecord }> => {
  const wallet = await getOrCreateWallet(input.businessId);
  const balanceBeforeCents = wallet.balanceCents;
  const balanceAfterCents = balanceBeforeCents + input.amountCents;
  const promotionalBalanceCents = Math.max(
    0,
    wallet.promotionalBalanceCents + (input.promotionalDeltaCents ?? 0)
  );

  const updatedWallet: WalletRecord = {
    ...wallet,
    balanceCents: balanceAfterCents,
    promotionalBalanceCents,
    promotionalCreditExpiresAt: input.promotionalCreditExpiresAt ?? wallet.promotionalCreditExpiresAt,
    updatedAt: new Date().toISOString()
  };

  const transaction: WalletTransactionRecord = {
    id: randomUUID(),
    businessId: input.businessId,
    type: input.type,
    amountCents: input.amountCents,
    balanceBeforeCents,
    balanceAfterCents,
    source: input.source,
    operator: input.operator,
    referenceId: input.referenceId,
    note: input.note,
    createdAt: new Date().toISOString()
  };

  await walletRepository.saveWallet(updatedWallet);
  await walletRepository.saveTransaction(transaction);

  return { wallet: updatedWallet, transaction };
};

export const walletService = {
  async getOverview(businessId: string): Promise<WalletOverview> {
    await getBusinessOrThrow(businessId);
    const wallet = await getOrCreateWallet(businessId);
    const [transactions, pendingTopupRequests] = await Promise.all([
      walletRepository.listTransactions(businessId),
      walletRepository.listTopupRequests(businessId)
    ]);

    return {
      balanceCents: wallet.balanceCents,
      currencyCode: wallet.currencyCode,
      promotionalBalanceCents: wallet.promotionalBalanceCents,
      promotionalCreditExpiresAt: wallet.promotionalCreditExpiresAt,
      transactions,
      pendingTopupRequests: pendingTopupRequests.filter((entry) => entry.status === 'pending_review')
    };
  },

  async requestTopup(
    businessId: string,
    input: {
      amountCents: number;
      paymentMethod: WalletTopupRequestRecord['paymentMethod'];
      paymentProofDataUrl: string;
      transactionReference: string;
    },
    origin: string
  ): Promise<WalletTopupRequestRecord> {
    await getBusinessOrThrow(businessId);

    const isPresetAmount = WALLET_TOPUP_PRESET_AMOUNTS_CENTS.includes(input.amountCents);
    const isValidCustomAmount =
      Number.isInteger(input.amountCents) &&
      input.amountCents >= WALLET_TOPUP_MIN_CENTS &&
      input.amountCents <= WALLET_TOPUP_MAX_CENTS;

    if (!isPresetAmount && !isValidCustomAmount) {
      throw new HttpError(
        400,
        `Top-up amount must be one of the preset amounts or between Rs${WALLET_TOPUP_MIN_CENTS / 100} and Rs${WALLET_TOPUP_MAX_CENTS / 100}`
      );
    }

    if (!input.paymentProofDataUrl?.trim()) {
      throw new HttpError(400, 'Upload payment proof before submitting a top-up request');
    }

    const { tokenHash, expiresAt, plainToken } = issueVerificationToken();
    const now = new Date().toISOString();
    const request: WalletTopupRequestRecord = {
      id: randomUUID(),
      businessId,
      amountCents: input.amountCents,
      paymentMethod: input.paymentMethod,
      paymentProofDataUrl: input.paymentProofDataUrl.trim(),
      transactionReference: input.transactionReference?.trim() ?? '',
      status: 'pending_review',
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
      createdAt: now,
      updatedAt: now
    };

    const saved = await walletRepository.saveTopupRequest(request);
    await sendAdminVerificationEmail(walletTopupAdapter, saved, plainToken, origin);
    return saved;
  },

  async listPendingTopupRequests(): Promise<WalletTopupRequestRecord[]> {
    const all = await walletRepository.listTopupRequests();
    return all.filter((entry) => entry.status === 'pending_review');
  },

  async approveTopup(topupId: string, operator?: string): Promise<WalletTopupRequestRecord> {
    const request = await walletRepository.getTopupRequestById(topupId);

    if (!request) {
      throw new HttpError(404, 'Top-up request not found');
    }

    if (request.status !== 'pending_review') {
      // Idempotent: approving an already-decided request just returns it
      // as-is instead of erroring, so a double-click never double-credits.
      return request;
    }

    await applyLedgerEntry({
      businessId: request.businessId,
      type: 'paid_topup',
      amountCents: request.amountCents,
      source: 'manual_topup',
      operator,
      referenceId: request.id,
      note: request.transactionReference || undefined
    });

    const updated: WalletTopupRequestRecord = {
      ...request,
      status: 'approved',
      verificationTokenHash: undefined,
      verificationTokenExpiresAt: undefined,
      reviewedBy: operator,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await walletRepository.saveTopupRequest(updated);
    await sendBuyerDecisionEmail(walletTopupAdapter, saved, 'approved');
    return saved;
  },

  async rejectTopup(topupId: string, operator: string | undefined, reason: string): Promise<WalletTopupRequestRecord> {
    const request = await walletRepository.getTopupRequestById(topupId);

    if (!request) {
      throw new HttpError(404, 'Top-up request not found');
    }

    if (request.status !== 'pending_review') {
      return request;
    }

    const updated: WalletTopupRequestRecord = {
      ...request,
      status: 'rejected',
      verificationTokenHash: undefined,
      verificationTokenExpiresAt: undefined,
      reviewedBy: operator,
      reviewedAt: new Date().toISOString(),
      rejectionReason: reason.trim(),
      updatedAt: new Date().toISOString()
    };

    const saved = await walletRepository.saveTopupRequest(updated);
    await sendBuyerDecisionEmail(walletTopupAdapter, saved, 'rejected', reason);
    return saved;
  },

  // Grants the one-time campaign credit. Only meant to be called once per
  // business (on first paid activation - see billing.service.ts), but is
  // idempotent via a fixed referenceId regardless, so a retry never grants it
  // twice. Expires PROMOTIONAL_CREDIT_EXPIRY_DAYS days after this call.
  async grantPromotionalCredit(
    businessId: string,
    amountCents: number,
    note: string,
    operator?: string
  ): Promise<WalletRecord> {
    if (amountCents <= 0) {
      return getOrCreateWallet(businessId);
    }

    const existing = await walletRepository.findTransactionByReference(
      businessId,
      'first_activation_credit',
      'promotional_credit'
    );

    if (existing) {
      return getOrCreateWallet(businessId);
    }

    const expiresAt = new Date(
      Date.now() + PROMOTIONAL_CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { wallet } = await applyLedgerEntry({
      businessId,
      type: 'promotional_credit',
      amountCents,
      source: 'promotional_credit',
      operator,
      referenceId: 'first_activation_credit',
      note,
      promotionalDeltaCents: amountCents,
      promotionalCreditExpiresAt: expiresAt
    });

    return wallet;
  },

  async previewCampaignCost(
    businessId: string,
    smsEligibleCount: number,
    emailEligibleCount: number,
    whatsappEligibleCount = 0
  ): Promise<CampaignCostPreview> {
    const [wallet, pricing] = await Promise.all([
      getOrCreateWallet(businessId),
      platformSettingsService.getCampaignPricing()
    ]);

    const smsCostCents = Math.max(0, smsEligibleCount) * pricing.promotionalMessageCostCents;
    const emailCostCents = Math.max(0, emailEligibleCount) * pricing.promotionalMessageCostCents;
    const whatsappCostCents = Math.max(0, whatsappEligibleCount) * pricing.promotionalMessageCostCents;
    const estimatedTotalCents = smsCostCents + emailCostCents + whatsappCostCents;
    const balanceAfterCents = wallet.balanceCents - estimatedTotalCents;

    return {
      smsCostCents,
      emailCostCents,
      whatsappCostCents,
      estimatedTotalCents,
      balanceCents: wallet.balanceCents,
      balanceAfterCents,
      hasSufficientBalance: balanceAfterCents >= 0,
      topupNeededCents: balanceAfterCents < 0 ? Math.abs(balanceAfterCents) : 0
    };
  },

  // Reserves/deducts the campaign's estimated cost in one atomic ledger
  // write, keyed by campaignId so a retry or double-click on Send can never
  // deduct twice for the same campaign.
  async reserveAndDeductForCampaign(
    businessId: string,
    campaignId: string,
    amountCents: number
  ): Promise<WalletTransactionRecord> {
    if (amountCents <= 0) {
      // Nothing to charge (e.g. a campaign with only free/included channels).
      const wallet = await getOrCreateWallet(businessId);
      return {
        id: randomUUID(),
        businessId,
        type: 'usage',
        amountCents: 0,
        balanceBeforeCents: wallet.balanceCents,
        balanceAfterCents: wallet.balanceCents,
        source: `campaign_send:${campaignId}`,
        referenceId: campaignId,
        createdAt: new Date().toISOString()
      };
    }

    const existing = await walletRepository.findTransactionByReference(businessId, campaignId, 'usage');

    if (existing) {
      return existing;
    }

    const wallet = await getOrCreateWallet(businessId);

    if (wallet.balanceCents < amountCents) {
      throw new HttpError(
        402,
        `Insufficient wallet balance. This campaign needs Rs${(amountCents / 100).toFixed(0)} but only Rs${(wallet.balanceCents / 100).toFixed(0)} is available. Top up your wallet to continue.`
      );
    }

    const promotionalDrawnCents = Math.min(amountCents, getValidPromotionalBalanceCents(wallet));
    const { transaction } = await applyLedgerEntry({
      businessId,
      type: 'usage',
      amountCents: -amountCents,
      source: `campaign_send:${campaignId}`,
      referenceId: campaignId,
      promotionalDeltaCents: promotionalDrawnCents > 0 ? -promotionalDrawnCents : undefined
    });

    return transaction;
  },

  // Best-effort charge for a single transactional/utility message (booking
  // confirmation, reminder, etc.) that the plan's included allowance no
  // longer covers. Never throws and never blocks the notification itself -
  // per the launch principle that booking/notifications must not fail
  // because of billing - it simply skips the charge when funds are short.
  async chargeUtilityMessage(businessId: string, source: string): Promise<boolean> {
    const pricing = await platformSettingsService.getCampaignPricing();
    const costCents = pricing.utilityMessageCostCents;

    if (costCents <= 0) {
      return false;
    }

    const wallet = await getOrCreateWallet(businessId);

    if (wallet.balanceCents < costCents) {
      return false;
    }

    const promotionalDrawnCents = Math.min(costCents, getValidPromotionalBalanceCents(wallet));

    await applyLedgerEntry({
      businessId,
      type: 'usage',
      amountCents: -costCents,
      source: `utility_message:${source}`,
      promotionalDeltaCents: promotionalDrawnCents > 0 ? -promotionalDrawnCents : undefined
    });

    return true;
  },

  async refundForCampaign(businessId: string, campaignId: string, amountCents: number): Promise<void> {
    if (amountCents <= 0) {
      return;
    }

    const existingRefund = await walletRepository.findTransactionByReference(
      businessId,
      `${campaignId}:refund`,
      'refund'
    );

    if (existingRefund) {
      return;
    }

    await applyLedgerEntry({
      businessId,
      type: 'refund',
      amountCents,
      source: `campaign_refund:${campaignId}`,
      referenceId: `${campaignId}:refund`
    });
  }
};

export const walletTopupAdapter: PaymentVerificationAdapter<WalletTopupRequestRecord> = {
  kind: 'wallet_topup',
  getById: (id) => walletRepository.getTopupRequestById(id).then((entry) => entry ?? null),
  approve: (id, operator) => walletService.approveTopup(id, operator),
  reject: (id, operator, reason) => walletService.rejectTopup(id, operator, reason),
  async describe(request) {
    const business = await getBusinessOrThrow(request.businessId).catch(() => null);

    return {
      businessName: business?.businessName ?? 'Unknown business',
      businessEmail: business?.email ?? '',
      kindLabel: 'Wallet credit top-up',
      amountLabel: formatAmountCentsLabel(request.amountCents),
      proofUrl: request.paymentProofDataUrl,
      extraLines: [
        `Method: ${MANUAL_PAYMENT_METHOD_LABELS[request.paymentMethod]}`,
        request.transactionReference ? `Reference: ${request.transactionReference}` : ''
      ].filter(Boolean)
    };
  }
};
