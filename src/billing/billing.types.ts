import type { ManualPaymentMethodKey } from '../platform/platformSettings.types';

export type SubscriptionPlanKey = 'lite' | 'growth' | 'professional' | 'multi_branch';

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
  /** Bookable Staff Members included in the base monthly price. */
  maxTeamMembers: number;
  /**
   * Hard ceiling on Bookable Staff Members for this plan, including paid
   * add-ons. Creation is blocked past this and an upgrade is recommended.
   * `null` means admin-configurable / no fixed ceiling (Multi-Branch).
   */
  maxBookableStaffCap: number | null;
  /** Monthly price (in cents) per Bookable Staff Member beyond maxTeamMembers. */
  extraBookableStaffPriceCents: number;
  /** Maximum salon locations/branches this plan allows. `null` = admin-configurable. */
  maxLocations: number | null;
  /** One-time campaign wallet credit (in cents) granted on first paid activation. */
  campaignCreditCents: number;
  /** Monthly included WhatsApp utility (transactional) message allowance. */
  whatsappUtilityMessageAllowance: number;
  /** Max campaigns that can be promoted on the marketplace at once. */
  maxActiveMarketplaceOffers: number;
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
  provider: 'demo' | 'stripe' | 'trial' | 'manual';
  providerCustomerId: string;
  providerSubscriptionId: string;
  demoCard?: DemoBillingCard;
  appointmentCreditsGranted: number;
  appointmentCreditsRemaining: number;
  appointmentCreditsUsed: number;
  messageCreditsGranted: number;
  messageCreditsRemaining: number;
  messageCreditsUsed: number;
  marketingEmailCreditsGranted: number;
  marketingEmailCreditsRemaining: number;
  marketingEmailCreditsUsed: number;
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

export interface CreateSubscriptionCheckoutInput {
  planId: string;
}

export type SubscriptionPaymentStatus = 'pending_review' | 'approved' | 'rejected';

// A subscription paid for via manual/offline transfer (e.g. Raast), pending
// admin verification. Mirrors WalletTopupRequestRecord's shape/lifecycle.
export interface SubscriptionPaymentRequestRecord {
  id: string;
  businessId: string;
  planId: string;
  amountCents: number;
  currencyCode: string;
  paymentMethod: ManualPaymentMethodKey;
  paymentProofDataUrl: string;
  transactionReference: string;
  status: SubscriptionPaymentStatus;
  // Cleared once the token has been used (or the request decided), so a
  // replayed email link can never re-approve/re-reject.
  verificationTokenHash?: string;
  verificationTokenExpiresAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoloFreeTrialInput {
  name: string;
  email: string;
}

export interface BillingFeatureAccess {
  key: string;
  label: string;
  isEnabled: boolean;
  requiredPlanKey?: SubscriptionPlanKey;
}

export interface BookableStaffMemberUsage {
  included: number;
  active: number;
  extra: number;
  extraMonthlyCostCents: number;
  cap: number | null;
  capReached: boolean;
}

export interface DowngradePlanEligibility {
  planId: string;
  planName: string;
  // null = no fixed ceiling (e.g. admin-configurable Multi-Branch cap).
  targetCap: number | null;
  activeBookableStaffCount: number;
  excessCount: number;
  // True when the salon must deactivate Bookable Staff Members before this
  // plan can be activated - the caller should let the admin pick who stays
  // active rather than silently dropping anyone.
  requiresStaffSelection: boolean;
  bookableStaffMembers: Array<{ id: string; name: string; role: string }>;
}

export interface BillingOverview {
  plans: SubscriptionPlan[];
  subscription: BusinessSubscription | null;
  currentPlan: SubscriptionPlan | null;
  latestInvoice: BillingInvoice | null;
  bookableStaffMemberUsage: BookableStaffMemberUsage | null;
  creditBalance: {
    granted: number;
    remaining: number;
    used: number;
  };
  messageCreditBalance: {
    granted: number;
    remaining: number;
    used: number;
  };
  marketingEmailCreditBalance: {
    granted: number;
    remaining: number;
    used: number;
  };
  featureAccess: BillingFeatureAccess[];
  lockedFeatureKeys: string[];
}
