import { env } from '../config/env';
import type { CustomerAccount } from './customerAccount.types';
import type { CustomerAccountStore } from './customerAccount.store';
import { CustomerAccountFileStore } from './storage/customerAccountFile.store';
import { CustomerAccountMemoryStore } from './storage/customerAccountMemory.store';
import { CustomerAccountSupabaseStore } from './storage/customerAccountSupabase.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const hasSupabaseConfiguration = (): boolean =>
  Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY));

const getConfiguredStoreType = (): 'file' | 'memory' | 'supabase' => {
  if (isTestEnvironment()) {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'supabase') {
    return hasSupabaseConfiguration() ? 'supabase' : 'file';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'file') {
    return 'file';
  }

  return isVercelRuntime() ? 'memory' : 'file';
};

const createStore = (): CustomerAccountStore => {
  const storeType = getConfiguredStoreType();
  if (storeType === 'memory') {
    return new CustomerAccountMemoryStore();
  }

  if (storeType === 'supabase') {
    return new CustomerAccountSupabaseStore();
  }

  return new CustomerAccountFileStore();
};

class CustomerAccountRepository {
  private readonly store: CustomerAccountStore;

  constructor(store: CustomerAccountStore = createStore()) {
    this.store = store;
  }

  listCustomers(): Promise<CustomerAccount[]> {
    return this.store.listCustomers();
  }

  getCustomerById(customerId: string): Promise<CustomerAccount | undefined> {
    return this.store.getCustomerById(customerId);
  }

  getCustomerByPhone(phone: string): Promise<CustomerAccount | undefined> {
    return this.store.getCustomerByPhone(phone);
  }

  getCustomerByEmail(email: string): Promise<CustomerAccount | undefined> {
    return this.store.getCustomerByEmail(email);
  }

  getCustomerBySessionToken(sessionToken: string): Promise<CustomerAccount | undefined> {
    return this.store.getCustomerBySessionToken(sessionToken);
  }

  saveCustomer(customer: CustomerAccount): Promise<CustomerAccount> {
    return this.store.saveCustomer(customer);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const customerAccountRepository = new CustomerAccountRepository();
