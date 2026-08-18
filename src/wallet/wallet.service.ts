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

const getOrCreateWallet = async (businessId: string): Promise<WalletRecord> => {
  const existing = await walletRepository.getWallet(businessId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const wallet: WalletRecord = {
    businessId,
    balanceCents: 0,
    currencyCode: DEFAULT_CURRENCY_CODE,
    createdAt: now,
    updatedAt: now
  };

  return walletRepository.saveWallet(wallet);
};

// Credits or debits the wallet and writes a matching ledger entry in one
// place, so every balance change is always recorded with before/after
// amounts, source, and (when applicable) the operator who approved it.
const applyLedgerEntry = async (input: {
  businessId: string;
  type: WalletTransactionRecord['type'];
  amountCents: number;
  source: string;
  operator?: string;
  referenceId?: string;
  note?: string;
}): Promise<{ wallet: WalletRecord; transaction: WalletTransactionRecord }> => {
  const wallet = await getOrCreateWallet(input.businessId);
  const balanceBeforeCents = wallet.balanceCents;
  const balanceAfterCents = balanceBeforeCents + input.amountCents;

  const updatedWallet: WalletRecord = {
    ...wallet,
    balanceCents: balanceAfterCents,
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

  async grantPromotionalCredit(
    businessId: string,
    amountCents: number,
    note: string,
    operator?: string
  ): Promise<WalletRecord> {
    const { wallet } = await applyLedgerEntry({
      businessId,
      type: 'promotional_credit',
      amountCents,
      source: 'promotional_credit',
      operator,
      note
    });

    return wallet;
  },

  async previewCampaignCost(
    businessId: string,
    smsEligibleCount: number,
    emailEligibleCount: number
  ): Promise<CampaignCostPreview> {
    const [wallet, pricing] = await Promise.all([
      getOrCreateWallet(businessId),
      platformSettingsService.getCampaignPricing()
    ]);

    const smsCostCents = Math.max(0, smsEligibleCount) * pricing.smsCostCents;
    const emailCostCents = Math.max(0, emailEligibleCount) * pricing.emailCostCents;
    const estimatedTotalCents = smsCostCents + emailCostCents;
    const balanceAfterCents = wallet.balanceCents - estimatedTotalCents;

    return {
      smsCostCents,
      emailCostCents,
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

    const { transaction } = await applyLedgerEntry({
      businessId,
      type: 'usage',
      amountCents: -amountCents,
      source: `campaign_send:${campaignId}`,
      referenceId: campaignId
    });

    return transaction;
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
