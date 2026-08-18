import type {
  WalletRecord,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
  WalletTransactionType
} from '../wallet.types';
import type { WalletStore } from '../wallet.store';

export class WalletMemoryStore implements WalletStore {
  private wallets = new Map<string, WalletRecord>();
  private transactions: WalletTransactionRecord[] = [];
  private topupRequests: WalletTopupRequestRecord[] = [];

  async getWallet(businessId: string): Promise<WalletRecord | null> {
    return this.wallets.get(businessId) ?? null;
  }

  async saveWallet(wallet: WalletRecord): Promise<WalletRecord> {
    this.wallets.set(wallet.businessId, wallet);
    return wallet;
  }

  async listTransactions(businessId: string): Promise<WalletTransactionRecord[]> {
    return this.transactions
      .filter((entry) => entry.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveTransaction(transaction: WalletTransactionRecord): Promise<WalletTransactionRecord> {
    this.transactions.push(transaction);
    return transaction;
  }

  async findTransactionByReference(
    businessId: string,
    referenceId: string,
    type: WalletTransactionType
  ): Promise<WalletTransactionRecord | undefined> {
    return this.transactions.find(
      (entry) =>
        entry.businessId === businessId && entry.referenceId === referenceId && entry.type === type
    );
  }

  async listTopupRequests(businessId?: string): Promise<WalletTopupRequestRecord[]> {
    const filtered = businessId
      ? this.topupRequests.filter((entry) => entry.businessId === businessId)
      : this.topupRequests;
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTopupRequestById(id: string): Promise<WalletTopupRequestRecord | undefined> {
    return this.topupRequests.find((entry) => entry.id === id);
  }

  async saveTopupRequest(request: WalletTopupRequestRecord): Promise<WalletTopupRequestRecord> {
    const index = this.topupRequests.findIndex((entry) => entry.id === request.id);

    if (index === -1) {
      this.topupRequests.push(request);
    } else {
      this.topupRequests[index] = request;
    }

    return request;
  }

  async reset(): Promise<void> {
    this.wallets.clear();
    this.transactions = [];
    this.topupRequests = [];
  }
}
