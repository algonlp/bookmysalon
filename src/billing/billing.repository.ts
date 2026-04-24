import { env } from '../config/env';
import type {
  BillingInvoice,
  BusinessSubscription
} from './billing.types';
import type { BillingStore } from './billing.store';
import { BillingFileStore } from './storage/billingFile.store';
import { BillingMemoryStore } from './storage/billingMemory.store';
import { BillingSupabaseStore } from './storage/billingSupabase.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const hasSupabaseConfiguration = (): boolean =>
  Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY));

const createStore = (): BillingStore => {
  if (isTestEnvironment()) {
    return new BillingMemoryStore();
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'supabase' && hasSupabaseConfiguration()) {
    return new BillingSupabaseStore();
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return new BillingMemoryStore();
  }

  return new BillingFileStore();
};

class BillingRepository {
  private readonly store: BillingStore;

  constructor(store: BillingStore = createStore()) {
    this.store = store;
  }

  listSubscriptionPlans() {
    return this.store.listSubscriptionPlans();
  }

  listBusinessSubscriptions() {
    return this.store.listBusinessSubscriptions();
  }

  listBillingInvoices() {
    return this.store.listBillingInvoices();
  }

  saveBusinessSubscription(subscription: BusinessSubscription) {
    return this.store.saveBusinessSubscription(subscription);
  }

  saveBillingInvoice(invoice: BillingInvoice) {
    return this.store.saveBillingInvoice(invoice);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const billingRepository = new BillingRepository();

export const resetBillingRepositoryForTests = (): Promise<void> => {
  return billingRepository.resetForTests();
};
