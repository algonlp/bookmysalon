import type {
  BillingInvoice,
  BusinessSubscription,
  SubscriptionPlan
} from './billing.types';
import { defaultSubscriptionPlans } from './defaultPlans';

export interface BillingState {
  subscriptionPlans: SubscriptionPlan[];
  businessSubscriptions: BusinessSubscription[];
  billingInvoices: BillingInvoice[];
}

export interface BillingStore {
  listSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  listBusinessSubscriptions(): Promise<BusinessSubscription[]>;
  listBillingInvoices(): Promise<BillingInvoice[]>;
  saveBusinessSubscription(subscription: BusinessSubscription): Promise<BusinessSubscription>;
  saveBillingInvoice(invoice: BillingInvoice): Promise<BillingInvoice>;
  reset(): Promise<void>;
}

export const createDefaultBillingState = (): BillingState => ({
  subscriptionPlans: defaultSubscriptionPlans,
  businessSubscriptions: [],
  billingInvoices: []
});
