import { getSupabaseClient } from '../../shared/supabase/client';
import type {
  WalletRecord,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
  WalletTransactionType
} from '../wallet.types';
import type { WalletStore } from '../wallet.store';

type Row = Record<string, unknown>;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asNullableText = (value: unknown): string | undefined => {
  const text = asText(value);
  return text ? text : undefined;
};
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asTimestamp = (value: unknown): string => asNullableText(value) ?? new Date().toISOString();

const walletToRow = (wallet: WalletRecord): Row => ({
  business_id: wallet.businessId,
  balance_cents: wallet.balanceCents,
  promotional_balance_cents: wallet.promotionalBalanceCents,
  promotional_credit_expires_at: wallet.promotionalCreditExpiresAt ?? null,
  currency_code: wallet.currencyCode,
  created_at: wallet.createdAt,
  updated_at: wallet.updatedAt
});

const rowToWallet = (row: Row): WalletRecord => ({
  businessId: asText(row.business_id),
  balanceCents: asNumber(row.balance_cents),
  promotionalBalanceCents: asNumber(row.promotional_balance_cents),
  promotionalCreditExpiresAt: asNullableText(row.promotional_credit_expires_at),
  currencyCode: asText(row.currency_code) || 'PKR',
  createdAt: asTimestamp(row.created_at),
  updatedAt: asTimestamp(row.updated_at)
});

const transactionToRow = (transaction: WalletTransactionRecord): Row => ({
  id: transaction.id,
  business_id: transaction.businessId,
  type: transaction.type,
  amount_cents: transaction.amountCents,
  balance_before_cents: transaction.balanceBeforeCents,
  balance_after_cents: transaction.balanceAfterCents,
  source: transaction.source,
  operator: transaction.operator ?? null,
  reference_id: transaction.referenceId ?? null,
  note: transaction.note ?? null,
  created_at: transaction.createdAt
});

const rowToTransaction = (row: Row): WalletTransactionRecord => ({
  id: asText(row.id),
  businessId: asText(row.business_id),
  type: asText(row.type) as WalletTransactionType,
  amountCents: asNumber(row.amount_cents),
  balanceBeforeCents: asNumber(row.balance_before_cents),
  balanceAfterCents: asNumber(row.balance_after_cents),
  source: asText(row.source),
  operator: asNullableText(row.operator),
  referenceId: asNullableText(row.reference_id),
  note: asNullableText(row.note),
  createdAt: asTimestamp(row.created_at)
});

const topupToRow = (request: WalletTopupRequestRecord): Row => ({
  id: request.id,
  business_id: request.businessId,
  amount_cents: request.amountCents,
  payment_method: request.paymentMethod,
  payment_proof_data_url: request.paymentProofDataUrl,
  transaction_reference: request.transactionReference,
  status: request.status,
  verification_token_hash: request.verificationTokenHash ?? null,
  verification_token_expires_at: request.verificationTokenExpiresAt ?? null,
  reviewed_by: request.reviewedBy ?? null,
  reviewed_at: request.reviewedAt ?? null,
  rejection_reason: request.rejectionReason ?? null,
  created_at: request.createdAt,
  updated_at: request.updatedAt
});

const rowToTopup = (row: Row): WalletTopupRequestRecord => ({
  id: asText(row.id),
  businessId: asText(row.business_id),
  amountCents: asNumber(row.amount_cents),
  paymentMethod: (asText(row.payment_method) || 'bank_transfer') as WalletTopupRequestRecord['paymentMethod'],
  paymentProofDataUrl: asText(row.payment_proof_data_url),
  transactionReference: asText(row.transaction_reference),
  status: asText(row.status) as WalletTopupRequestRecord['status'],
  verificationTokenHash: asNullableText(row.verification_token_hash),
  verificationTokenExpiresAt: asNullableText(row.verification_token_expires_at),
  reviewedBy: asNullableText(row.reviewed_by),
  reviewedAt: asNullableText(row.reviewed_at),
  rejectionReason: asNullableText(row.rejection_reason),
  createdAt: asTimestamp(row.created_at),
  updatedAt: asTimestamp(row.updated_at)
});

export class WalletSupabaseStore implements WalletStore {
  async getWallet(businessId: string): Promise<WalletRecord | null> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('communication_wallets')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load wallet for ${businessId}: ${error.message}`);
    }

    return data ? rowToWallet(data as Row) : null;
  }

  async saveWallet(wallet: WalletRecord): Promise<WalletRecord> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('communication_wallets')
      .upsert(walletToRow(wallet), { onConflict: 'business_id' });

    if (error) {
      throw new Error(`Failed to save wallet for ${wallet.businessId}: ${error.message}`);
    }

    return wallet;
  }

  async listTransactions(businessId: string): Promise<WalletTransactionRecord[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('wallet_transactions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list wallet transactions for ${businessId}: ${error.message}`);
    }

    return (data ?? []).map((row) => rowToTransaction(row as Row));
  }

  async saveTransaction(transaction: WalletTransactionRecord): Promise<WalletTransactionRecord> {
    const client = getSupabaseClient();
    const { error } = await client.from('wallet_transactions').insert(transactionToRow(transaction));

    if (error) {
      throw new Error(`Failed to save wallet transaction: ${error.message}`);
    }

    return transaction;
  }

  async findTransactionByReference(
    businessId: string,
    referenceId: string,
    type: WalletTransactionType
  ): Promise<WalletTransactionRecord | undefined> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('wallet_transactions')
      .select('*')
      .eq('business_id', businessId)
      .eq('reference_id', referenceId)
      .eq('type', type)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to look up wallet transaction by reference: ${error.message}`);
    }

    return data ? rowToTransaction(data as Row) : undefined;
  }

  async listTopupRequests(businessId?: string): Promise<WalletTopupRequestRecord[]> {
    const client = getSupabaseClient();
    let query = client.from('wallet_topup_requests').select('*').order('created_at', { ascending: false });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list wallet top-up requests: ${error.message}`);
    }

    return (data ?? []).map((row) => rowToTopup(row as Row));
  }

  async getTopupRequestById(id: string): Promise<WalletTopupRequestRecord | undefined> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('wallet_topup_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load wallet top-up request ${id}: ${error.message}`);
    }

    return data ? rowToTopup(data as Row) : undefined;
  }

  async saveTopupRequest(request: WalletTopupRequestRecord): Promise<WalletTopupRequestRecord> {
    const client = getSupabaseClient();
    const { error } = await client
      .from('wallet_topup_requests')
      .upsert(topupToRow(request), { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save wallet top-up request: ${error.message}`);
    }

    return request;
  }

  async reset(): Promise<void> {
    const client = getSupabaseClient();
    await client.from('wallet_transactions').delete().neq('id', '');
    await client.from('wallet_topup_requests').delete().neq('id', '');
    await client.from('communication_wallets').delete().neq('business_id', '');
  }
}
