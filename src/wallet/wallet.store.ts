import type {
  WalletRecord,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
  WalletTransactionType
} from './wallet.types';

export interface WalletStore {
  getWallet(businessId: string): Promise<WalletRecord | null>;
  saveWallet(wallet: WalletRecord): Promise<WalletRecord>;

  listTransactions(businessId: string): Promise<WalletTransactionRecord[]>;
  saveTransaction(transaction: WalletTransactionRecord): Promise<WalletTransactionRecord>;
  findTransactionByReference(
    businessId: string,
    referenceId: string,
    type: WalletTransactionType
  ): Promise<WalletTransactionRecord | undefined>;

  listTopupRequests(businessId?: string): Promise<WalletTopupRequestRecord[]>;
  getTopupRequestById(id: string): Promise<WalletTopupRequestRecord | undefined>;
  saveTopupRequest(request: WalletTopupRequestRecord): Promise<WalletTopupRequestRecord>;

  reset(): Promise<void>;
}
