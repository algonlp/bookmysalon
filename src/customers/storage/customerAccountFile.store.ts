import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { CustomerAccount } from '../customerAccount.types';
import {
  createDefaultCustomerAccountState,
  type CustomerAccountState,
  type CustomerAccountStore
} from '../customerAccount.store';

export class CustomerAccountFileStore implements CustomerAccountStore {
  private readonly storagePath: string;
  private state: CustomerAccountState = createDefaultCustomerAccountState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'customer-accounts.json')) {
    this.storagePath = storagePath;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(
        this.storagePath,
        JSON.stringify(createDefaultCustomerAccountState(), null, 2),
        'utf-8'
      );
    }
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();
    const rawState = await readFile(this.storagePath, 'utf-8');
    const parsedState = rawState.trim()
      ? (JSON.parse(rawState) as Partial<CustomerAccountState>)
      : createDefaultCustomerAccountState();
    this.state = { customers: parsedState.customers ?? [] };
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

  async listCustomers(): Promise<CustomerAccount[]> {
    await this.ensureLoaded();
    return [...this.state.customers];
  }

  async getCustomerById(customerId: string): Promise<CustomerAccount | undefined> {
    await this.ensureLoaded();
    return this.state.customers.find((customer) => customer.id === customerId);
  }

  async getCustomerByPhone(phone: string): Promise<CustomerAccount | undefined> {
    await this.ensureLoaded();
    return this.state.customers.find((customer) => customer.phone === phone);
  }

  async getCustomerBySessionToken(sessionToken: string): Promise<CustomerAccount | undefined> {
    await this.ensureLoaded();
    return this.state.customers.find((customer) => customer.sessionToken === sessionToken);
  }

  async saveCustomer(customer: CustomerAccount): Promise<CustomerAccount> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      const existingIndex = this.state.customers.findIndex((entry) => entry.id === customer.id);
      if (existingIndex >= 0) {
        this.state.customers[existingIndex] = customer;
      } else {
        this.state.customers.push(customer);
      }
      await this.persist();
      return customer;
    });
  }

  async reset(): Promise<void> {
    await this.withWriteLock(async () => {
      this.state = createDefaultCustomerAccountState();
      this.loaded = true;
      await this.persist();
    });
  }
}
