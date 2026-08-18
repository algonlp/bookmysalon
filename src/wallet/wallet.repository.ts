import { env } from '../config/env';
import type { WalletStore } from './wallet.store';
import { WalletFileStore } from './storage/walletFile.store';
import { WalletMemoryStore } from './storage/walletMemory.store';
import { WalletSupabaseStore } from './storage/walletSupabase.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const hasSupabaseConfiguration = (): boolean =>
  Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY));

const createStore = (): WalletStore => {
  if (isTestEnvironment()) {
    return new WalletMemoryStore();
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'supabase' && hasSupabaseConfiguration()) {
    return new WalletSupabaseStore();
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return new WalletMemoryStore();
  }

  return new WalletFileStore();
};

class WalletRepository {
  private readonly store: WalletStore;

  constructor(store: WalletStore = createStore()) {
    this.store = store;
  }

  getWallet(businessId: string) {
    return this.store.getWallet(businessId);
  }

  saveWallet(wallet: Parameters<WalletStore['saveWallet']>[0]) {
    return this.store.saveWallet(wallet);
  }

  listTransactions(businessId: string) {
    return this.store.listTransactions(businessId);
  }

  saveTransaction(transaction: Parameters<WalletStore['saveTransaction']>[0]) {
    return this.store.saveTransaction(transaction);
  }

  findTransactionByReference(...args: Parameters<WalletStore['findTransactionByReference']>) {
    return this.store.findTransactionByReference(...args);
  }

  listTopupRequests(businessId?: string) {
    return this.store.listTopupRequests(businessId);
  }

  getTopupRequestById(id: string) {
    return this.store.getTopupRequestById(id);
  }

  saveTopupRequest(request: Parameters<WalletStore['saveTopupRequest']>[0]) {
    return this.store.saveTopupRequest(request);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const walletRepository = new WalletRepository();

export const resetWalletRepositoryForTests = (): Promise<void> => walletRepository.resetForTests();
