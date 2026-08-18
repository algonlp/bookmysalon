import type {
  BillingInvoice,
  BusinessSubscription,
  SubscriptionPaymentRequestRecord,
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

  async listBusinessSubscriptionsByBusinessId(businessId: string): Promise<BusinessSubscription[]> {
    return this.state.businessSubscriptions.filter((record) => record.businessId === businessId);
  }

  async listBillingInvoices(): Promise<BillingInvoice[]> {
    return [...this.state.billingInvoices];
  }

  async listBillingInvoicesByBusinessId(businessId: string): Promise<BillingInvoice[]> {
    return this.state.billingInvoices.filter((record) => record.businessId === businessId);
  }

  async saveSubscriptionPlan(plan: SubscriptionPlan): Promise<SubscriptionPlan> {
    const existingIndex = this.state.subscriptionPlans.findIndex(
      (entry) => entry.id === plan.id
    );

    if (existingIndex >= 0) {
      this.state.subscriptionPlans[existingIndex] = plan;
    } else {
      this.state.subscriptionPlans.push(plan);
    }

    return plan;
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

  async listSubscriptionPaymentRequests(businessId?: string): Promise<SubscriptionPaymentRequestRecord[]> {
    const requests = this.state.subscriptionPaymentRequests;
    return businessId ? requests.filter((entry) => entry.businessId === businessId) : [...requests];
  }

  async getSubscriptionPaymentRequestById(id: string): Promise<SubscriptionPaymentRequestRecord | undefined> {
    return this.state.subscriptionPaymentRequests.find((entry) => entry.id === id);
  }

  async saveSubscriptionPaymentRequest(
    request: SubscriptionPaymentRequestRecord
  ): Promise<SubscriptionPaymentRequestRecord> {
    const existingIndex = this.state.subscriptionPaymentRequests.findIndex(
      (entry) => entry.id === request.id
    );

    if (existingIndex >= 0) {
      this.state.subscriptionPaymentRequests[existingIndex] = request;
    } else {
      this.state.subscriptionPaymentRequests.push(request);
    }

    return request;
  }

  async reset(): Promise<void> {
    this.state = createDefaultBillingState();
  }
}
