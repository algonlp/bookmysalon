import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type {
  BillingInvoice,
  BusinessSubscription,
  SubscriptionPlan
} from '../billing.types';
import {
  createDefaultBillingState,
  type BillingState,
  type BillingStore
} from '../billing.store';

export class BillingFileStore implements BillingStore {
  private readonly storagePath: string;
  private state: BillingState = createDefaultBillingState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'billing.json')) {
    this.storagePath = storagePath;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(
        this.storagePath,
        JSON.stringify(createDefaultBillingState(), null, 2),
        'utf-8'
      );
    }
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();

    const rawState = await readFile(this.storagePath, 'utf-8');
    const parsedState = rawState.trim()
      ? (JSON.parse(rawState) as Partial<BillingState>)
      : createDefaultBillingState();

    this.state = {
      subscriptionPlans:
        parsedState.subscriptionPlans && parsedState.subscriptionPlans.length > 0
          ? parsedState.subscriptionPlans
          : createDefaultBillingState().subscriptionPlans,
      businessSubscriptions: parsedState.businessSubscriptions ?? [],
      billingInvoices: parsedState.billingInvoices ?? []
    };
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await this.loadStateFromDisk();
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

  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    await this.ensureLoaded();
    return [...this.state.subscriptionPlans];
  }

  async listBusinessSubscriptions(): Promise<BusinessSubscription[]> {
    await this.ensureLoaded();
    return [...this.state.businessSubscriptions];
  }

  async listBillingInvoices(): Promise<BillingInvoice[]> {
    await this.ensureLoaded();
    return [...this.state.billingInvoices];
  }

  async saveBusinessSubscription(
    subscription: BusinessSubscription
  ): Promise<BusinessSubscription> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      const existingIndex = this.state.businessSubscriptions.findIndex(
        (entry) => entry.id === subscription.id
      );

      if (existingIndex >= 0) {
        this.state.businessSubscriptions[existingIndex] = subscription;
      } else {
        this.state.businessSubscriptions.push(subscription);
      }

      await this.persist();
      return subscription;
    });
  }

  async saveBillingInvoice(invoice: BillingInvoice): Promise<BillingInvoice> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      const existingIndex = this.state.billingInvoices.findIndex((entry) => entry.id === invoice.id);

      if (existingIndex >= 0) {
        this.state.billingInvoices[existingIndex] = invoice;
      } else {
        this.state.billingInvoices.push(invoice);
      }

      await this.persist();
      return invoice;
    });
  }

  async reset(): Promise<void> {
    await this.withWriteLock(async () => {
      this.state = createDefaultBillingState();
      this.loaded = true;
      await this.persist();
    });
  }
}
