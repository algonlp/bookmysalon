import type { CustomerAccount } from '../customerAccount.types';
import {
  createDefaultCustomerAccountState,
  type CustomerAccountState,
  type CustomerAccountStore
} from '../customerAccount.store';

export class CustomerAccountMemoryStore implements CustomerAccountStore {
  private state: CustomerAccountState = createDefaultCustomerAccountState();

  async listCustomers(): Promise<CustomerAccount[]> {
    return [...this.state.customers];
  }

  async getCustomerById(customerId: string): Promise<CustomerAccount | undefined> {
    return this.state.customers.find((customer) => customer.id === customerId);
  }

  async getCustomerByPhone(phone: string): Promise<CustomerAccount | undefined> {
    return this.state.customers.find((customer) => customer.phone === phone);
  }

  async getCustomerBySessionToken(sessionToken: string): Promise<CustomerAccount | undefined> {
    return this.state.customers.find((customer) => customer.sessionToken === sessionToken);
  }

  async saveCustomer(customer: CustomerAccount): Promise<CustomerAccount> {
    const existingIndex = this.state.customers.findIndex((entry) => entry.id === customer.id);
    if (existingIndex >= 0) {
      this.state.customers[existingIndex] = customer;
    } else {
      this.state.customers.push(customer);
    }
    return customer;
  }

  async reset(): Promise<void> {
    this.state = createDefaultCustomerAccountState();
  }
}
