import type { SubscriptionPlan } from './billing.types';

const timestamp = '2026-01-01T00:00:00.000Z';

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
    requiredPlanKey: 'single'
  },
  {
    key: 'service_packages',
    label: 'Prepaid service packages',
    requiredPlanKey: 'single'
  },
  {
    key: 'products',
    label: 'Products and inventory',
    requiredPlanKey: 'single'
  },
  {
    key: 'client_crm',
    label: 'Client CRM and loyalty',
    requiredPlanKey: 'single'
  },
  {
    key: 'advanced_reports',
    label: 'Advanced reports',
    requiredPlanKey: 'single'
  },
  {
    key: 'team_management',
    label: 'Team calendars and staff tools',
    requiredPlanKey: 'team_premium'
  },
  {
    key: 'marketing',
    label: 'Marketing campaigns',
    requiredPlanKey: 'team_premium'
  },
  {
    key: 'premium_support',
    label: 'Premium support',
    requiredPlanKey: 'team_premium'
  }
] as const;

export const defaultSubscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'plan_solo',
    key: 'solo',
    name: 'Solo',
    summary: 'For one independent professional with full workspace access until appointment credits run out.',
    amountCents: 126000,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 7,
    badgeLabel: '7 day trial',
    isActive: true,
    displayOrder: 10,
    entitlements: {
      maxTeamMembers: 1,
      includedMessages: 20,
      includedMarketingEmails: 50,
      includedAppointmentCredits: 50,
      featureKeys: billingFeatureCatalog.map((feature) => feature.key)
    },
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: 'plan_single',
    key: 'single',
    name: 'Single',
    summary: 'For a growing business that needs checkout, packages, clients, and reports.',
    amountCents: 249000,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 7,
    badgeLabel: 'Popular',
    isActive: true,
    displayOrder: 20,
    entitlements: {
      maxTeamMembers: 3,
      includedMessages: 100,
      includedMarketingEmails: 500,
      includedAppointmentCredits: 150,
      featureKeys: [
        'online_booking',
        'qr_booking',
        'team_management',
        'payments',
        'service_packages',
        'products',
        'client_crm',
        'advanced_reports'
      ]
    },
    createdAt: timestamp,
    updatedAt: timestamp
  },
  {
    id: 'plan_team_premium',
    key: 'team_premium',
    name: 'Team Premium',
    summary: 'For teams that need staff calendars, marketing, premium support, and more limits.',
    amountCents: 84000,
    currencyCode: 'PKR',
    billingInterval: 'month',
    trialDays: 7,
    badgeLabel: 'Per team member',
    isActive: true,
    displayOrder: 30,
    entitlements: {
      maxTeamMembers: 20,
      includedMessages: 20,
      includedMarketingEmails: 50,
      includedAppointmentCredits: 500,
      featureKeys: billingFeatureCatalog.map((feature) => feature.key)
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

    return {
      ...defaultPlan,
      id: plan.id,
      key: plan.key,
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
