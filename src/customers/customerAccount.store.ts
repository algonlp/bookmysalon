import type { CustomerAccount } from './customerAccount.types';

export interface CustomerAccountState {
  customers: CustomerAccount[];
}

export interface CustomerAccountStore {
  listCustomers(): Promise<CustomerAccount[]>;
  getCustomerById(customerId: string): Promise<CustomerAccount | undefined>;
  getCustomerByPhone(phone: string): Promise<CustomerAccount | undefined>;
  getCustomerByEmail(email: string): Promise<CustomerAccount | undefined>;
  getCustomerBySessionToken(sessionToken: string): Promise<CustomerAccount | undefined>;
  saveCustomer(customer: CustomerAccount): Promise<CustomerAccount>;
  reset(): Promise<void>;
}

export const createDefaultCustomerAccountState = (): CustomerAccountState => ({
  customers: []
});
