import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type {
  WalletRecord,
  WalletTopupRequestRecord,
  WalletTransactionRecord,
  WalletTransactionType
} from '../wallet.types';
import type { WalletStore } from '../wallet.store';

interface WalletFileState {
  wallets: WalletRecord[];
  transactions: WalletTransactionRecord[];
  topupRequests: WalletTopupRequestRecord[];
}

const createDefaultState = (): WalletFileState => ({
  wallets: [],
  transactions: [],
  topupRequests: []
});

export class WalletFileStore implements WalletStore {
  private readonly storagePath: string;
  private state: WalletFileState = createDefaultState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'wallets.json')) {
    this.storagePath = storagePath;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(this.storagePath, JSON.stringify(createDefaultState(), null, 2), 'utf-8');
    }
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();
    const raw = await readFile(this.storagePath, 'utf-8');
    const parsed = raw.trim() ? (JSON.parse(raw) as Partial<WalletFileState>) : createDefaultState();
    this.state = {
      wallets: parsed.wallets ?? [],
      transactions: parsed.transactions ?? [],
      topupRequests: parsed.topupRequests ?? []
    };
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.loadStateFromDisk();
    }
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.writeChain.then(operation, operation);
    this.writeChain = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.storagePath), { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  async getWallet(businessId: string): Promise<WalletRecord | null> {
    await this.ensureLoaded();
    return this.state.wallets.find((entry) => entry.businessId === businessId) ?? null;
  }

  async saveWallet(wallet: WalletRecord): Promise<WalletRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      const index = this.state.wallets.findIndex((entry) => entry.businessId === wallet.businessId);

      if (index === -1) {
        this.state.wallets.push(wallet);
      } else {
        this.state.wallets[index] = wallet;
      }

      await this.persist();
      return wallet;
    });
  }

  async listTransactions(businessId: string): Promise<WalletTransactionRecord[]> {
    await this.ensureLoaded();
    return this.state.transactions
      .filter((entry) => entry.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveTransaction(transaction: WalletTransactionRecord): Promise<WalletTransactionRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      this.state.transactions.push(transaction);
      await this.persist();
      return transaction;
    });
  }

  async findTransactionByReference(
    businessId: string,
    referenceId: string,
    type: WalletTransactionType
  ): Promise<WalletTransactionRecord | undefined> {
    await this.ensureLoaded();
    return this.state.transactions.find(
      (entry) =>
        entry.businessId === businessId && entry.referenceId === referenceId && entry.type === type
    );
  }

  async listTopupRequests(businessId?: string): Promise<WalletTopupRequestRecord[]> {
    await this.ensureLoaded();
    const filtered = businessId
      ? this.state.topupRequests.filter((entry) => entry.businessId === businessId)
      : this.state.topupRequests;
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTopupRequestById(id: string): Promise<WalletTopupRequestRecord | undefined> {
    await this.ensureLoaded();
    return this.state.topupRequests.find((entry) => entry.id === id);
  }

  async saveTopupRequest(request: WalletTopupRequestRecord): Promise<WalletTopupRequestRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      const index = this.state.topupRequests.findIndex((entry) => entry.id === request.id);

      if (index === -1) {
        this.state.topupRequests.push(request);
      } else {
        this.state.topupRequests[index] = request;
      }

      await this.persist();
      return request;
    });
  }

  async reset(): Promise<void> {
    return this.withWriteLock(async () => {
      this.state = createDefaultState();
      this.loaded = true;
      await this.persist();
    });
  }
}
