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

export class BillingMemoryStore implements BillingStore {
  private state: BillingState = createDefaultBillingState();

  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return [...this.state.subscriptionPlans];
  }

  async listBusinessSubscriptions(): Promise<BusinessSubscription[]> {
    return [...this.state.businessSubscriptions];
  }

  async listBillingInvoices(): Promise<BillingInvoice[]> {
    return [...this.state.billingInvoices];
  }

  async saveBusinessSubscription(
    subscription: BusinessSubscription
  ): Promise<BusinessSubscription> {
    const existingIndex = this.state.businessSubscriptions.findIndex(
      (entry) => entry.id === subscription.id
    );

    if (existingIndex >= 0) {
      this.state.businessSubscriptions[existingIndex] = subscription;
    } else {
      this.state.businessSubscriptions.push(subscription);
    }

    return subscription;
  }

  async saveBillingInvoice(invoice: BillingInvoice): Promise<BillingInvoice> {
    const existingIndex = this.state.billingInvoices.findIndex((entry) => entry.id === invoice.id);

    if (existingIndex >= 0) {
      this.state.billingInvoices[existingIndex] = invoice;
    } else {
      this.state.billingInvoices.push(invoice);
    }

    return invoice;
  }

  async reset(): Promise<void> {
    this.state = createDefaultBillingState();
  }
}
