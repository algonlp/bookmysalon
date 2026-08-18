import type {
  BillingInvoice,
  BusinessSubscription,
  SubscriptionPaymentRequestRecord,
  SubscriptionPlan
} from './billing.types';
import { defaultSubscriptionPlans } from './defaultPlans';

export interface BillingState {
  subscriptionPlans: SubscriptionPlan[];
  businessSubscriptions: BusinessSubscription[];
  billingInvoices: BillingInvoice[];
  subscriptionPaymentRequests: SubscriptionPaymentRequestRecord[];
}

export interface BillingStore {
  listSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  listBusinessSubscriptions(): Promise<BusinessSubscription[]>;
  listBusinessSubscriptionsByBusinessId(businessId: string): Promise<BusinessSubscription[]>;
  listBillingInvoices(): Promise<BillingInvoice[]>;
  listBillingInvoicesByBusinessId(businessId: string): Promise<BillingInvoice[]>;
  saveSubscriptionPlan(plan: SubscriptionPlan): Promise<SubscriptionPlan>;
  saveBusinessSubscription(subscription: BusinessSubscription): Promise<BusinessSubscription>;
  saveBillingInvoice(invoice: BillingInvoice): Promise<BillingInvoice>;
  listSubscriptionPaymentRequests(businessId?: string): Promise<SubscriptionPaymentRequestRecord[]>;
  getSubscriptionPaymentRequestById(id: string): Promise<SubscriptionPaymentRequestRecord | undefined>;
  saveSubscriptionPaymentRequest(
    request: SubscriptionPaymentRequestRecord
  ): Promise<SubscriptionPaymentRequestRecord>;
  reset(): Promise<void>;
}

export const createDefaultBillingState = (): BillingState => ({
  subscriptionPlans: defaultSubscriptionPlans,
  businessSubscriptions: [],
  billingInvoices: [],
  subscriptionPaymentRequests: []
});
