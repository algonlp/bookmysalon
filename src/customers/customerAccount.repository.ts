import { env } from '../config/env';
import type { CustomerAccount } from './customerAccount.types';
import type { CustomerAccountStore } from './customerAccount.store';
import { CustomerAccountFileStore } from './storage/customerAccountFile.store';
import { CustomerAccountMemoryStore } from './storage/customerAccountMemory.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const createStore = (): CustomerAccountStore => {
  if (isTestEnvironment() || env.CLIENT_PLATFORM_STORAGE === 'memory' || isVercelRuntime()) {
    return new CustomerAccountMemoryStore();
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
