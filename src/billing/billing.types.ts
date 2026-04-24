export type SubscriptionPlanKey = 'solo' | 'single' | 'team_premium';

export type BillingInterval = 'month' | 'year';

export type BusinessSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled';

export type BillingInvoiceStatus = 'paid' | 'open' | 'void';

export type BillingCardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'unknown';

export interface SubscriptionPlanEntitlements {
  maxTeamMembers: number;
  includedMessages: number;
  includedMarketingEmails: number;
  includedAppointmentCredits: number;
  featureKeys: string[];
}

export interface SubscriptionPlan {
  id: string;
  key: SubscriptionPlanKey;
  name: string;
  summary: string;
  amountCents: number;
  currencyCode: string;
  billingInterval: BillingInterval;
  trialDays: number;
  badgeLabel: string;
  isActive: boolean;
  displayOrder: number;
  entitlements: SubscriptionPlanEntitlements;
  createdAt: string;
  updatedAt: string;
}

export interface DemoBillingCard {
  brand: BillingCardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
}

export interface BusinessSubscription {
  id: string;
  businessId: string;
  planId: string;
  status: BusinessSubscriptionStatus;
  provider: 'demo';
  providerCustomerId: string;
  providerSubscriptionId: string;
  demoCard: DemoBillingCard;
  appointmentCreditsGranted: number;
  appointmentCreditsRemaining: number;
  appointmentCreditsUsed: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingInvoice {
  id: string;
  businessId: string;
  subscriptionId: string;
  planId: string;
  amountCents: number;
  currencyCode: string;
  status: BillingInvoiceStatus;
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoCheckoutInput {
  planId: string;
  cardholderName: string;
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  billingEmail?: string;
}

export interface BillingFeatureAccess {
  key: string;
  label: string;
  isEnabled: boolean;
  requiredPlanKey?: SubscriptionPlanKey;
}

export interface BillingOverview {
  plans: SubscriptionPlan[];
  subscription: BusinessSubscription | null;
  currentPlan: SubscriptionPlan | null;
  latestInvoice: BillingInvoice | null;
  creditBalance: {
    granted: number;
    remaining: number;
    used: number;
  };
  featureAccess: BillingFeatureAccess[];
  lockedFeatureKeys: string[];
}
