import type { SubscriptionPlan } from './billing.types';

const timestamp = '2026-07-27T00:00:00.000Z';

export const billingFeatureCatalog = [
  {
    key: 'online_booking',
    label: 'Online bookings'
  },
  {
    key: 'qr_booking',
    label: 'QR booking links'
  },
  {
    key: 'payments',
    label: 'Payments and checkout',
    requiredPlanKey: 'growth'
  },
  {
    key: 'service_packages',
    label: 'Prepaid service packages',
    requiredPlanKey: 'growth'
  },
  {
    key: 'products',
    label: 'Products and inventory',
    requiredPlanKey: 'growth'
  },
  {
    key: 'client_crm',
    label: 'Full client CRM',
    requiredPlanKey: 'growth'
  },
  {
    key: 'advanced_reports',
    label: 'Advanced reports',
    requiredPlanKey: 'growth'
  },
  {
    key: 'team_management',
    label: 'Team calendars and staff tools',
    requiredPlanKey: 'multi_branch'
  },
  {
    key: 'marketing',
    label: 'Marketing campaigns',
    requiredPlanKey: 'lite'
  },
  {
    key: 'csv_upload',
    label: 'Upload CSV/XLSX customer lists',
    requiredPlanKey: 'growth'
  },
  {
    key: 'customer_segmentation',
    label: 'Customer segmentation',
    requiredPlanKey: 'growth'
  },
  {
    key: 'loyalty_tools',
    label: 'Loyalty and win-back tools',
    requiredPlanKey: 'professional'
  },
  {
    key: 'premium_support',
    label: 'Premium support',
    requiredPlanKey: 'growth'
  }
] as const;

const allFeatureKeys = billingFeatureCatalog.map((feature) => feature.key);

// Lite: unlimited bookings/QR/marketplace listing are always on (not gated
// by a feature key); Inventory, full CRM, CSV/XLSX upload, segmentation,
// advanced analytics and loyalty tools are all "No" on this plan per spec.
const liteFeatureKeys = [
  'online_booking',
  'qr_booking',
  'payments',
  'service_packages',
  'team_management',
  'marketing'
];

const growthFeatureKeys = [
  'online_booking',
  'qr_booking',
  'team_management',
  'payments',
  'service_packages',
  'products',
  'client_crm',
  'advanced_reports',
  'marketing',
  'csv_upload',
  'customer_segmentation',
  'premium_support'
];

// Bookable Staff Member = a person who can be selected by customers or
// assigned to services/appointments and has bookable availability. A
// receptionist/manager/owner account that only manages the salon does not
// consume this allowance (see clientPlatform TeamMemberRecord.isBookableStaffMember).
export const defaultSubscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'plan_solo',
    key: 'lite',
    name: 'Lite',
    summary: 'For getting started with online bookings and client messaging.',
    amountCents: 199900,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 30,
    badgeLabel: 'First month free',
    isActive: true,
    displayOrder: 10,
    entitlements: {
      maxTeamMembers: 2,
      maxBookableStaffCap: 4,
      extraBookableStaffPriceCents: 40000,
      maxLocations: 1,
      campaignCreditCents: 30000,
      whatsappUtilityMessageAllowance: 50,
      maxActiveMarketplaceOffers: 1,
      includedMessages: 100,
      includedMarketingEmails: 50,
      includedAppointmentCredits: 50,
      featureKeys: liteFeatureKeys
    },
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: 'plan_single',
    key: 'growth',
    name: 'Growth',
    summary: 'For a growing business that needs checkout, packages, clients, and reports.',
    amountCents: 499900,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 30,
    badgeLabel: 'Most popular',
    isActive: true,
    displayOrder: 20,
    entitlements: {
      maxTeamMembers: 8,
      maxBookableStaffCap: 12,
      extraBookableStaffPriceCents: 40000,
      maxLocations: 1,
      campaignCreditCents: 75000,
      whatsappUtilityMessageAllowance: 150,
      maxActiveMarketplaceOffers: 3,
      includedMessages: 180,
      includedMarketingEmails: 500,
      includedAppointmentCredits: 150,
      featureKeys: growthFeatureKeys
    },
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: 'plan_professional',
    key: 'professional',
    name: 'Professional',
    summary: 'For established salons that need advanced analytics, loyalty tools, and more staff.',
    amountCents: 799900,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 30,
    badgeLabel: 'First month free',
    isActive: true,
    displayOrder: 30,
    entitlements: {
      maxTeamMembers: 20,
      maxBookableStaffCap: 30,
      extraBookableStaffPriceCents: 30000,
      maxLocations: 1,
      campaignCreditCents: 150000,
      whatsappUtilityMessageAllowance: 400,
      maxActiveMarketplaceOffers: 10,
      includedMessages: 400,
      includedMarketingEmails: 500,
      includedAppointmentCredits: 500,
      featureKeys: allFeatureKeys
    },
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: 'plan_team_premium',
    key: 'multi_branch',
    name: 'Multi-Branch',
    summary: 'For multi-location teams that need staff calendars, marketing, premium support, and more limits.',
    amountCents: 1499900,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 30,
    badgeLabel: 'First month free',
    isActive: true,
    displayOrder: 40,
    entitlements: {
      maxTeamMembers: 40,
      // Admin-configurable per spec - no fixed ceiling until super-admin
      // configuration exists, so treat as effectively uncapped for now.
      maxBookableStaffCap: null,
      extraBookableStaffPriceCents: 25000,
      maxLocations: 3,
      campaignCreditCents: 300000,
      whatsappUtilityMessageAllowance: 1000,
      maxActiveMarketplaceOffers: 20,
      includedMessages: 400,
      includedMarketingEmails: 500,
      includedAppointmentCredits: 500,
      featureKeys: allFeatureKeys
    },
    createdAt: timestamp,
    updatedAt: timestamp
  }
];

export const normalizeSubscriptionPlans = (
  plans: SubscriptionPlan[]
): SubscriptionPlan[] => {
  const normalizedPlans = plans.map((plan) => {
    const defaultPlan = defaultSubscriptionPlans.find(
      (entry) => entry.id === plan.id || entry.key === plan.key
    );

    if (!defaultPlan) {
      return plan;
    }

    // Plan pricing and entitlements are defined in code (there is no longer a
    // manual editor), so the code defaults are authoritative. Only the stored
    // identity and original timestamps are preserved.
    return {
      ...defaultPlan,
      id: plan.id,
      key: defaultPlan.key,
      createdAt: plan.createdAt || defaultPlan.createdAt,
      updatedAt: plan.updatedAt || defaultPlan.updatedAt
    };
  });

  const missingDefaultPlans = defaultSubscriptionPlans.filter(
    (defaultPlan) =>
      !normalizedPlans.some(
        (plan) => plan.id === defaultPlan.id || plan.key === defaultPlan.key
      )
  );

  return [...normalizedPlans, ...missingDefaultPlans];
};

export const getNextPlanRecommendation = (
  currentPlanKey: SubscriptionPlan['key'] | null | undefined
): SubscriptionPlan | null => {
  const orderedPlans = [...defaultSubscriptionPlans].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );
  const currentIndex = orderedPlans.findIndex((plan) => plan.key === currentPlanKey);

  if (currentIndex === -1) {
    return orderedPlans[0] ?? null;
  }

  return orderedPlans[currentIndex + 1] ?? null;
};
