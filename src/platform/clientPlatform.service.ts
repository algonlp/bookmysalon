import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { HttpError } from '../shared/errors/httpError';
import { clientPlatformRepository } from './clientPlatform.repository';
import { appointmentService } from '../appointments/appointment.service';
import type { AppointmentRecord } from '../appointments/appointment.types';
import {
  createSeededBusinessServices,
  normalizeBusinessServices,
  syncBusinessServicesWithTypes
} from './businessServices';
import type {
  AccountTypeInput,
  BusinessProfileInput,
  BusinessSettingsRecord,
  ClientRecord,
  CustomerProfileRecord,
  CreateBusinessServiceInput,
  CreateClientInput,
  CreatePackagePlanInput,
  CreateTeamMemberInput,
  DashboardAppointmentViewModel,
  DashboardCommerceViewModel,
  DashboardViewModel,
  LaunchLinksViewModel,
  LoyaltyProgramRecord,
  PackagePlanRecord,
  PublicClientRecord,
  PublicSalonShowcaseItem,
  PreferredLanguage,
  ReportMetadataRecord,
  ServiceLocationInput,
  ServiceTypesInput,
  TeamMemberRecord,
  UpdateTeamMemberInput,
  UpdateBusinessSettingsInput,
  UpdatePreferredLanguageInput,
  UpdateLoyaltyProgramInput,
  VenueLocationInput
} from './clientPlatform.types';

const DEFAULT_BUSINESS_SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

const DEFAULT_REPORT_METADATA: ReportMetadataRecord = {
  pageTitle: 'Reporting and analytics',
  pageSubtitle: 'Access all of your business reports in one workspace.'
};

const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsRecord = {
  currencyCode: 'PKR',
  currencyLocale: 'en-PK',
  slotTimes: DEFAULT_BUSINESS_SLOT_TIMES,
  useServiceTemplates: true,
  reportMetadata: DEFAULT_REPORT_METADATA
};

const buildFallbackEmail = (provider: CreateClientInput['provider']): string =>
  `${provider}-${randomUUID().slice(0, 8)}@platform.local`;

const normalizeCurrencyCode = (value: unknown): string => {
  const normalizedValue =
    typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z]/g, '') : '';
  return normalizedValue.length === 3 ? normalizedValue : DEFAULT_BUSINESS_SETTINGS.currencyCode;
};

const normalizeCurrencyLocale = (value: unknown): string => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue.length > 0
    ? normalizedValue
    : DEFAULT_BUSINESS_SETTINGS.currencyLocale;
};

const normalizeSlotTimes = (value: unknown): string[] => {
  const slotPattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const rawValues = Array.isArray(value) ? value : [];
  const uniqueSlots = new Set<string>();

  for (const slotValue of rawValues) {
    const normalizedValue = typeof slotValue === 'string' ? slotValue.trim() : '';

    if (!slotPattern.test(normalizedValue)) {
      continue;
    }

    uniqueSlots.add(normalizedValue);
  }

  return uniqueSlots.size > 0
    ? [...uniqueSlots].sort((left, right) => left.localeCompare(right))
    : [...DEFAULT_BUSINESS_SETTINGS.slotTimes];
};

const normalizeReportMetadata = (
  value: Partial<ReportMetadataRecord> | null | undefined
): ReportMetadataRecord => ({
  pageTitle:
    typeof value?.pageTitle === 'string' && value.pageTitle.trim().length > 0
      ? value.pageTitle.trim()
      : DEFAULT_REPORT_METADATA.pageTitle,
  pageSubtitle:
    typeof value?.pageSubtitle === 'string' && value.pageSubtitle.trim().length > 0
      ? value.pageSubtitle.trim()
      : DEFAULT_REPORT_METADATA.pageSubtitle
});

const normalizeBusinessSettings = (
  value: Partial<BusinessSettingsRecord> | null | undefined
): BusinessSettingsRecord => ({
  currencyCode: normalizeCurrencyCode(value?.currencyCode),
  currencyLocale: normalizeCurrencyLocale(value?.currencyLocale),
  slotTimes: normalizeSlotTimes(value?.slotTimes),
  useServiceTemplates:
    typeof value?.useServiceTemplates === 'boolean'
      ? value.useServiceTemplates
      : DEFAULT_BUSINESS_SETTINGS.useServiceTemplates,
  reportMetadata: normalizeReportMetadata(value?.reportMetadata)
});

const getServiceTemplateOptions = (
  businessSettings: BusinessSettingsRecord | null | undefined
): {
  currencyCode: string;
  currencyLocale: string;
  useServiceTemplates: boolean;
} => {
  const normalizedSettings = normalizeBusinessSettings(businessSettings);

  return {
    currencyCode: normalizedSettings.currencyCode,
    currencyLocale: normalizedSettings.currencyLocale,
    useServiceTemplates: normalizedSettings.useServiceTemplates
  };
};

const formatOwnerName = (email: string): string => {
  const localPart = email.split('@')[0] ?? 'owner';
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
};

const getDefaultTeamMemberRole = (client: Pick<ClientRecord, 'serviceTypes'>): string =>
  client.serviceTypes.some(
    (serviceType) => typeof serviceType === 'string' && serviceType.trim().toLowerCase() === 'barber'
  )
    ? 'Barber'
    : 'Team member';

const getAvatarInitial = (label: string): string => label.trim().charAt(0).toLowerCase() || 'm';

const sanitizeTeamMember = (
  teamMember: Partial<TeamMemberRecord>,
  fallbackIndex: number
): TeamMemberRecord | undefined => {
  const name = typeof teamMember.name === 'string' ? teamMember.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();

  return {
    id:
      typeof teamMember.id === 'string' && teamMember.id.trim().length > 0
        ? teamMember.id.trim()
        : `team-${fallbackIndex + 1}`,
    name,
    role:
      typeof teamMember.role === 'string' && teamMember.role.trim().length > 0
        ? teamMember.role.trim()
        : 'Barber',
    phone: typeof teamMember.phone === 'string' ? teamMember.phone.trim() : '',
    expertise:
      typeof teamMember.expertise === 'string' ? teamMember.expertise.trim() : '',
    isActive: teamMember.isActive !== false,
    createdAt:
      typeof teamMember.createdAt === 'string' && teamMember.createdAt.trim().length > 0
        ? teamMember.createdAt
        : timestamp,
    updatedAt:
      typeof teamMember.updatedAt === 'string' && teamMember.updatedAt.trim().length > 0
        ? teamMember.updatedAt
        : timestamp
  };
};

const normalizeTeamMembers = (teamMembers: TeamMemberRecord[] = []): TeamMemberRecord[] =>
  teamMembers
    .map((teamMember, index) => sanitizeTeamMember(teamMember, index))
    .filter((teamMember): teamMember is TeamMemberRecord => !!teamMember);

const sanitizePackagePlan = (
  packagePlan: Partial<PackagePlanRecord>,
  fallbackIndex: number
): PackagePlanRecord | undefined => {
  const name = typeof packagePlan.name === 'string' ? packagePlan.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const totalUses = Number(packagePlan.totalUses);

  return {
    id:
      typeof packagePlan.id === 'string' && packagePlan.id.trim().length > 0
        ? packagePlan.id.trim()
        : `package-${fallbackIndex + 1}`,
    name,
    includedServiceIds: Array.isArray(packagePlan.includedServiceIds)
      ? packagePlan.includedServiceIds.filter(
          (serviceId): serviceId is string =>
            typeof serviceId === 'string' && serviceId.trim().length > 0
        )
      : [],
    totalUses: Number.isFinite(totalUses) && totalUses > 0 ? Math.floor(totalUses) : 1,
    priceLabel: typeof packagePlan.priceLabel === 'string' ? packagePlan.priceLabel.trim() : '',
    isActive: packagePlan.isActive !== false,
    createdAt:
      typeof packagePlan.createdAt === 'string' && packagePlan.createdAt.trim().length > 0
        ? packagePlan.createdAt
        : timestamp,
    updatedAt:
      typeof packagePlan.updatedAt === 'string' && packagePlan.updatedAt.trim().length > 0
        ? packagePlan.updatedAt
        : timestamp
  };
};

const normalizePackagePlans = (packagePlans: PackagePlanRecord[] = []): PackagePlanRecord[] =>
  packagePlans
    .map((packagePlan, index) => sanitizePackagePlan(packagePlan, index))
    .filter((packagePlan): packagePlan is PackagePlanRecord => !!packagePlan);

const normalizeLoyaltyProgram = (
  loyaltyProgram: LoyaltyProgramRecord | null | undefined
): LoyaltyProgramRecord | null => {
  if (!loyaltyProgram || typeof loyaltyProgram !== 'object') {
    return null;
  }

  const timestamp = new Date().toISOString();
  const triggerCompletedVisits = Number(loyaltyProgram.triggerCompletedVisits);
  const rewardValue = Number(loyaltyProgram.rewardValue);

  return {
    id:
      typeof loyaltyProgram.id === 'string' && loyaltyProgram.id.trim().length > 0
        ? loyaltyProgram.id.trim()
        : 'loyalty-program',
    isEnabled: loyaltyProgram.isEnabled === true,
    triggerCompletedVisits:
      Number.isFinite(triggerCompletedVisits) && triggerCompletedVisits > 0
        ? Math.floor(triggerCompletedVisits)
        : 5,
    rewardType: 'discount_percent',
    rewardValue: Number.isFinite(rewardValue) && rewardValue > 0 ? rewardValue : 10,
    includedServiceIds: Array.isArray(loyaltyProgram.includedServiceIds)
      ? loyaltyProgram.includedServiceIds.filter(
          (serviceId): serviceId is string =>
            typeof serviceId === 'string' && serviceId.trim().length > 0
        )
      : [],
    createdAt:
      typeof loyaltyProgram.createdAt === 'string' && loyaltyProgram.createdAt.trim().length > 0
        ? loyaltyProgram.createdAt
        : timestamp,
    updatedAt:
      typeof loyaltyProgram.updatedAt === 'string' && loyaltyProgram.updatedAt.trim().length > 0
        ? loyaltyProgram.updatedAt
        : timestamp
  };
};

const normalizeServiceLocations = (value: unknown): Array<'physical' | 'mobile' | 'virtual'> => {
  const allowedValues = new Set(['physical', 'mobile', 'virtual']);
  const rawValues = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  return rawValues.filter(
    (item): item is 'physical' | 'mobile' | 'virtual' =>
      typeof item === 'string' && allowedValues.has(item)
  );
};

const normalizePreferredLanguage = (value: unknown): PreferredLanguage | null => {
  return value === 'english' || value === 'urdu' || value === 'arabic' ? value : null;
};

const buildCustomerProfileId = (appointment: AppointmentRecord): string => {
  const phoneKey = typeof appointment.customerPhone === 'string' ? appointment.customerPhone.trim() : '';

  if (phoneKey) {
    return `phone:${phoneKey}`;
  }

  const emailKey =
    typeof appointment.customerEmail === 'string' ? appointment.customerEmail.trim().toLowerCase() : '';

  if (emailKey) {
    return `email:${emailKey}`;
  }

  return `name:${appointment.customerName.trim().toLowerCase()}`;
};

const sanitizeCustomerProfile = (
  customerProfile: Partial<CustomerProfileRecord>,
  fallbackIndex: number
): CustomerProfileRecord | undefined => {
  const customerName =
    typeof customerProfile.customerName === 'string' ? customerProfile.customerName.trim() : '';

  if (!customerName) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const totalVisits = Number(customerProfile.totalVisits);
  const bookedVisits = Number(customerProfile.bookedVisits);
  const completedVisits = Number(customerProfile.completedVisits);
  const cancelledVisits = Number(customerProfile.cancelledVisits);

  return {
    id:
      typeof customerProfile.id === 'string' && customerProfile.id.trim().length > 0
        ? customerProfile.id.trim()
        : `customer-${fallbackIndex + 1}`,
    customerName,
    customerPhone:
      typeof customerProfile.customerPhone === 'string' ? customerProfile.customerPhone.trim() : '',
    customerEmail:
      typeof customerProfile.customerEmail === 'string' ? customerProfile.customerEmail.trim() : '',
    totalVisits: Number.isFinite(totalVisits) && totalVisits >= 0 ? Math.floor(totalVisits) : 0,
    bookedVisits: Number.isFinite(bookedVisits) && bookedVisits >= 0 ? Math.floor(bookedVisits) : 0,
    completedVisits:
      Number.isFinite(completedVisits) && completedVisits >= 0 ? Math.floor(completedVisits) : 0,
    cancelledVisits:
      Number.isFinite(cancelledVisits) && cancelledVisits >= 0 ? Math.floor(cancelledVisits) : 0,
    lastService:
      typeof customerProfile.lastService === 'string' ? customerProfile.lastService.trim() : '',
    lastAppointmentDate:
      typeof customerProfile.lastAppointmentDate === 'string'
        ? customerProfile.lastAppointmentDate.trim()
        : '',
    lastAppointmentTime:
      typeof customerProfile.lastAppointmentTime === 'string'
        ? customerProfile.lastAppointmentTime.trim()
        : '',
    firstSeenAt:
      typeof customerProfile.firstSeenAt === 'string' && customerProfile.firstSeenAt.trim().length > 0
        ? customerProfile.firstSeenAt
        : timestamp,
    lastSeenAt:
      typeof customerProfile.lastSeenAt === 'string' && customerProfile.lastSeenAt.trim().length > 0
        ? customerProfile.lastSeenAt
        : timestamp,
    createdAt:
      typeof customerProfile.createdAt === 'string' && customerProfile.createdAt.trim().length > 0
        ? customerProfile.createdAt
        : timestamp,
    updatedAt:
      typeof customerProfile.updatedAt === 'string' && customerProfile.updatedAt.trim().length > 0
        ? customerProfile.updatedAt
        : timestamp
  };
};

const normalizeCustomerProfiles = (customerProfiles: CustomerProfileRecord[] = []): CustomerProfileRecord[] =>
  customerProfiles
    .map((customerProfile, index) => sanitizeCustomerProfile(customerProfile, index))
    .filter((customerProfile): customerProfile is CustomerProfileRecord => !!customerProfile)
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));

const buildCustomerProfilesFromAppointments = (
  appointments: AppointmentRecord[]
): CustomerProfileRecord[] => {
  const customerProfiles = new Map<string, CustomerProfileRecord>();

  for (const appointment of [...appointments].sort((left, right) =>
    left.startAt.localeCompare(right.startAt)
  )) {
    const profileId = buildCustomerProfileId(appointment);
    const seenAt = appointment.updatedAt || appointment.createdAt || appointment.startAt;
    const createdAt = appointment.createdAt || appointment.startAt;
    const existingProfile = customerProfiles.get(profileId);

    if (!existingProfile) {
      customerProfiles.set(profileId, {
        id: profileId,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
        totalVisits: 1,
        bookedVisits: appointment.status === 'booked' ? 1 : 0,
        completedVisits: appointment.status === 'completed' ? 1 : 0,
        cancelledVisits: appointment.status === 'cancelled' ? 1 : 0,
        lastService: appointment.serviceName,
        lastAppointmentDate: appointment.appointmentDate,
        lastAppointmentTime: appointment.appointmentTime,
        firstSeenAt: createdAt,
        lastSeenAt: seenAt,
        createdAt,
        updatedAt: seenAt
      });
      continue;
    }

    existingProfile.totalVisits += 1;
    if (appointment.status === 'booked') {
      existingProfile.bookedVisits += 1;
    }
    if (appointment.status === 'completed') {
      existingProfile.completedVisits += 1;
    }
    if (appointment.status === 'cancelled') {
      existingProfile.cancelledVisits += 1;
    }

    if (
      `${appointment.appointmentDate}T${appointment.appointmentTime}`.localeCompare(
        `${existingProfile.lastAppointmentDate}T${existingProfile.lastAppointmentTime}`
      ) >= 0
    ) {
      existingProfile.customerName = appointment.customerName;
      existingProfile.customerPhone = appointment.customerPhone;
      existingProfile.customerEmail = appointment.customerEmail;
      existingProfile.lastService = appointment.serviceName;
      existingProfile.lastAppointmentDate = appointment.appointmentDate;
      existingProfile.lastAppointmentTime = appointment.appointmentTime;
    }

    if (seenAt.localeCompare(existingProfile.lastSeenAt) > 0) {
      existingProfile.lastSeenAt = seenAt;
      existingProfile.updatedAt = seenAt;
    }

    if (createdAt.localeCompare(existingProfile.firstSeenAt) < 0) {
      existingProfile.firstSeenAt = createdAt;
      existingProfile.createdAt = createdAt;
    }
  }

  return [...customerProfiles.values()].sort((left, right) =>
    right.lastSeenAt.localeCompare(left.lastSeenAt)
  );
};

const toPublicClientRecord = (client: ClientRecord): PublicClientRecord => ({
  id: client.id,
  email: client.email,
  mobileNumber: client.mobileNumber,
  provider: client.provider,
  businessName: client.businessName,
  website: client.website,
  profileImageUrl: client.profileImageUrl ?? '',
  serviceTypes: client.serviceTypes,
  services: normalizeBusinessServices(
    client.serviceTypes,
    client.services ?? [],
    getServiceTemplateOptions(client.businessSettings)
  ),
  packagePlans: normalizePackagePlans(client.packagePlans ?? []),
  loyaltyProgram: normalizeLoyaltyProgram(client.loyaltyProgram),
  businessSettings: normalizeBusinessSettings(client.businessSettings),
  customerProfiles: normalizeCustomerProfiles(client.customerProfiles ?? []),
  teamMembers: normalizeTeamMembers(client.teamMembers ?? []),
  accountType: client.accountType,
  serviceLocation: normalizeServiceLocations(client.serviceLocation),
  venueAddress: client.venueAddress,
  preferredLanguage: normalizePreferredLanguage(client.preferredLanguage),
  onboardingCompleted: client.onboardingCompleted,
  createdAt: client.createdAt,
  updatedAt: client.updatedAt
});

const shouldSeedDemoSalons = (): boolean => env.APP_ENV === 'dev';

const DEMO_SALONS: ClientRecord[] = [
  {
    id: 'demo-luna-luxe',
    adminToken: 'demo-admin-luna-luxe',
    email: 'hello@lunaluxe.demo',
    mobileNumber: '',
    provider: 'email',
    businessName: 'Luna Luxe Salon',
    website: 'www.lunaluxe.demo',
    profileImageUrl: '',
    serviceTypes: ['Hair salon', 'Beauty salon'],
    services: createSeededBusinessServices(
      ['Hair salon', 'Beauty salon'],
      getServiceTemplateOptions(DEFAULT_BUSINESS_SETTINGS)
    ),
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [
      {
        id: 'team-luna-1',
        name: 'Mina',
        role: 'Stylist',
        phone: '+923001110001',
        expertise: 'Colour and blow-dry',
        isActive: true,
        createdAt: '2026-03-01T09:00:00.000Z',
        updatedAt: '2026-03-12T08:30:00.000Z'
      }
    ],
    accountType: 'team',
    serviceLocation: ['physical'],
    venueAddress: 'Clifton Block 5, Schon Circle, Karachi, Sindh, Pakistan',
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-12T08:30:00.000Z'
  },
  {
    id: 'demo-urban-trim',
    adminToken: 'demo-admin-urban-trim',
    email: 'hello@urbantrim.demo',
    mobileNumber: '',
    provider: 'email',
    businessName: 'Urban Trim Studio',
    website: 'www.urbantrim.demo',
    profileImageUrl: '',
    serviceTypes: ['Barber'],
    services: createSeededBusinessServices(['Barber'], getServiceTemplateOptions(DEFAULT_BUSINESS_SETTINGS)),
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [],
    accountType: 'independent',
    serviceLocation: ['physical'],
    venueAddress: 'MM Alam Road, Gulberg III, Lahore, Punjab, Pakistan',
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-12T08:00:00.000Z'
  },
  {
    id: 'demo-serene-glow',
    adminToken: 'demo-admin-serene-glow',
    email: 'hello@sereneglow.demo',
    mobileNumber: '',
    provider: 'email',
    businessName: 'Serene Glow Spa',
    website: 'www.sereneglow.demo',
    profileImageUrl: '',
    serviceTypes: ['Massage', 'Spa & sauna'],
    services: createSeededBusinessServices(
      ['Massage', 'Spa & sauna'],
      getServiceTemplateOptions(DEFAULT_BUSINESS_SETTINGS)
    ),
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [
      {
        id: 'team-serene-1',
        name: 'Hira',
        role: 'Therapist',
        phone: '+923001110002',
        expertise: 'Deep tissue massage',
        isActive: true,
        createdAt: '2026-03-03T11:00:00.000Z',
        updatedAt: '2026-03-12T07:30:00.000Z'
      }
    ],
    accountType: 'team',
    serviceLocation: ['physical'],
    venueAddress: 'Blue Area, Jinnah Avenue, Islamabad, Islamabad Capital Territory, Pakistan',
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: '2026-03-03T11:00:00.000Z',
    updatedAt: '2026-03-12T07:30:00.000Z'
  }
];

const ensureDemoSalons = async (): Promise<void> => {
  if (!shouldSeedDemoSalons()) {
    return;
  }

  const existingClients = await clientPlatformRepository.listClients();
  const existingIds = new Set(existingClients.map((client) => client.id));

  await Promise.all(
    DEMO_SALONS.filter((client) => !existingIds.has(client.id)).map((client) =>
      clientPlatformRepository.saveClient(hydrateClientRecord(client))
    )
  );
};

const formatDashboardDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
    .format(date)
    .replace(',', '');

const formatDashboardTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);

const buildDashboardLink = (clientId: string, origin: string): string =>
  `${origin}/calendar?clientId=${encodeURIComponent(clientId)}`;

const buildQrCodeImageLink = (clientId: string, origin: string): string =>
  `${origin}/api/public/book/${encodeURIComponent(clientId)}/qr`;

const buildLaunchLinks = async (
  clientId: string,
  origin: string
): Promise<LaunchLinksViewModel> => {
  const [
    bookingPageLink,
    instagramBookingLink,
    facebookBookingLink,
    appleMapsBookingLink,
    qrBookingPageLink
  ] = await Promise.all([
    appointmentService.getBookingUrl(clientId, origin, 'direct'),
    appointmentService.getBookingUrl(clientId, origin, 'instagram'),
    appointmentService.getBookingUrl(clientId, origin, 'facebook'),
    appointmentService.getBookingUrl(clientId, origin, 'applemaps'),
    appointmentService.getBookingUrl(clientId, origin, 'qr')
  ]);

  return {
    dashboardLink: buildDashboardLink(clientId, origin),
    bookingPageLink,
    instagramBookingLink,
    facebookBookingLink,
    appleMapsBookingLink,
    qrCodeImageLink: buildQrCodeImageLink(clientId, origin),
    qrBookingPageLink
  };
};

const buildClientDrawerItems = (appointments: AppointmentRecord[]) => {
  const uniqueClients = new Map<string, AppointmentRecord>();

  for (const appointment of [...appointments].sort((left, right) =>
    right.startAt.localeCompare(left.startAt)
  )) {
    const key = appointment.customerPhone || appointment.customerEmail || appointment.customerName;

    if (!uniqueClients.has(key)) {
      uniqueClients.set(key, appointment);
    }
  }

  const recentClients = [...uniqueClients.values()].slice(0, 6);

  if (recentClients.length === 0) {
    return [
      {
        label: 'No booked clients yet',
        subtitle: 'Customer details from new bookings will appear here.'
      }
    ];
  }

  return recentClients.map((appointment) => ({
    label: appointment.customerName,
    subtitle: `${appointment.customerPhone}${appointment.customerEmail ? ` • ${appointment.customerEmail}` : ''} • ${appointment.serviceName}`
  }));
};

const buildStoredClientDrawerItems = (customerProfiles: CustomerProfileRecord[]) => {
  const recentClients = normalizeCustomerProfiles(customerProfiles).slice(0, 6);

  if (recentClients.length === 0) {
    return [
      {
        label: 'No clients yet',
        subtitle: 'Customers from bookings and completed visits will appear here.'
      }
    ];
  }

  return recentClients.map((customerProfile) => ({
    label: customerProfile.customerName,
    subtitle:
      `${customerProfile.customerPhone}${customerProfile.customerEmail ? ` â€¢ ${customerProfile.customerEmail}` : ''} â€¢ ` +
      `${customerProfile.totalVisits} visit${customerProfile.totalVisits === 1 ? '' : 's'}`
  }));
};

const buildTeamDrawerSections = (client: ClientRecord) => {
  const activeTeamMembers = normalizeTeamMembers(client.teamMembers ?? []).filter(
    (teamMember) => teamMember.isActive
  );
  const teamRoleLabel = client.serviceTypes.includes('Barber') ? 'barber' : 'team member';

  return [
    {
      items: [
        {
          label: 'Team members',
          subtitle: `${activeTeamMembers.length} active ${teamRoleLabel}${activeTeamMembers.length === 1 ? '' : 's'}`
        },
        { label: 'Scheduled shifts' },
        { label: 'Timesheets', meta: { type: 'dot' as const } },
        { label: 'Pay runs', meta: { type: 'dot' as const } }
      ]
    },
    {
      title: activeTeamMembers.length > 0 ? 'Current team' : 'Team setup',
      items:
        activeTeamMembers.length > 0
          ? activeTeamMembers.map((teamMember) => ({
              label: teamMember.name,
              subtitle: `${teamMember.expertise || teamMember.role}${teamMember.phone ? ` • ${teamMember.phone}` : ''}`
            }))
          : [
              {
                label: 'No team members yet',
                subtitle: `Add your first ${teamRoleLabel} from the team panel.`
              }
            ]
    }
  ];
};

const buildDashboardViewModel = (
  client: ClientRecord,
  appointments: DashboardAppointmentViewModel[],
  bookedAppointments: AppointmentRecord[],
  launchLinks: LaunchLinksViewModel,
  commerce: DashboardCommerceViewModel
): DashboardViewModel => {
  const businessName = client.businessName || 'fresha';
  const ownerName = client.businessName || formatOwnerName(client.email) || 'Owner';
  const businessSettings = normalizeBusinessSettings(client.businessSettings);
  const now = new Date();

  return {
    businessName,
    ownerName,
    avatarInitial: getAvatarInitial(ownerName),
    profileImageUrl: client.profileImageUrl ?? '',
    setupButtonLabel: client.onboardingCompleted ? 'Setup complete' : 'Continue setup',
    setupButtonPath: '/guides/legendary-learner',
    bookingLink: `/book/${client.id}`,
    launchLinks,
    commerce,
    currentDateLabel: formatDashboardDate(now),
    currentTimeLabel: formatDashboardTime(now),
    appointments,
    sideDrawers: {
      sales: {
        title: 'Sales',
        sections: [
          {
            items: [
              { label: 'Daily sales summary' },
              { label: 'Appointments' },
              { label: 'Sales' },
              { label: 'Payments' },
              { label: 'Gift cards sold' },
              { label: 'Packages sold' }
            ]
          }
        ]
      },
      clients: {
        title: 'Clients',
        sections: [
          {
            items: [{ label: 'Clients list' }, { label: 'Client loyalty' }]
          },
          {
            title: 'Clients',
            items: buildStoredClientDrawerItems(client.customerProfiles ?? [])
          }
        ]
      },
      catalog: {
        title: 'Catalog',
        sections: [
          {
            items: [
              { label: 'Service menu' },
              { label: 'Packages' },
              { label: 'Products' }
            ]
          },
          {
            title: 'Inventory',
            items: [
              { label: 'Stocktakes' },
              { label: 'Stock orders' },
              { label: 'Suppliers' }
            ]
          }
        ]
      },
      team: {
        title: 'Team',
        sections: buildTeamDrawerSections(client)
      }
    },
    reportsView: {
      sidebarTitle: 'Reports',
      menu: [
        { label: 'All reports', active: true, meta: { type: 'count', value: '0' } },
        { label: 'Favourites', meta: { type: 'count', value: '0' } },
        { label: 'Dashboards', meta: { type: 'count', value: '0' } },
        { label: 'Standard', meta: { type: 'count', value: '0' } },
        { label: 'Premium', meta: { type: 'count', value: '0' } },
        { label: 'Custom', meta: { type: 'count', value: '0' } },
        { label: 'Targets', meta: { type: 'count', value: '0' } }
      ],
      folderTitle: 'Folders',
      folderActionLabel: 'Add folder',
      connectorLabel: 'Data connector',
      pageTitle: businessSettings.reportMetadata.pageTitle,
      pageSubtitle: businessSettings.reportMetadata.pageSubtitle,
      totalLabel: '0',
      searchPlaceholder: 'Search by report name or description',
      filters: ['Created by', 'Category'],
      tabs: [
        { label: 'All reports', active: true },
        { label: 'Sales' },
        { label: 'Finance' },
        { label: 'Appointments' },
        { label: 'Team' },
        { label: 'Clients' },
        { label: 'Inventory' }
      ],
      cards: [
        {
          title: 'Performance dashboard',
          description: 'Dashboard of your business performance.'
        },
        {
          title: 'Online presence dashboard',
          description: 'Online sales and online client performance.'
        },
        {
          title: 'Loyalty dashboard',
          description: 'Dashboard of your loyalty program performance.'
        }
      ]
    }
  };
};

const getClientOrThrow = async (clientId: string): Promise<ClientRecord> => {
  const client = await clientPlatformRepository.getClientById(clientId);

  if (!client) {
    throw new HttpError(404, 'Client not found');
  }

  return hydrateClientRecord(client);
};

const hydrateClientRecord = (client: ClientRecord): ClientRecord => {
  const businessSettings = normalizeBusinessSettings(client.businessSettings);

  return {
    ...client,
    mobileNumber: typeof client.mobileNumber === 'string' ? client.mobileNumber.trim() : '',
    businessSettings,
    serviceLocation: normalizeServiceLocations(client.serviceLocation),
    services: normalizeBusinessServices(
      client.serviceTypes,
      client.services ?? [],
      getServiceTemplateOptions(businessSettings)
    ),
    packagePlans: normalizePackagePlans(client.packagePlans ?? []),
    loyaltyProgram: normalizeLoyaltyProgram(client.loyaltyProgram),
    customerProfiles: normalizeCustomerProfiles(client.customerProfiles ?? []),
    teamMembers: normalizeTeamMembers(client.teamMembers ?? []),
    preferredLanguage: normalizePreferredLanguage(client.preferredLanguage)
  };
};

const updateClient = async (
  clientId: string,
  updater: (client: ClientRecord) => ClientRecord
): Promise<ClientRecord> => {
  const updatedClient = hydrateClientRecord(updater(await getClientOrThrow(clientId)));
  await clientPlatformRepository.saveClient(updatedClient);
  return updatedClient;
};

export const clientPlatformService = {
  async createClient(input: CreateClientInput): Promise<ClientRecord> {
    const now = new Date().toISOString();

    const client: ClientRecord = {
      id: randomUUID(),
      adminToken: randomUUID(),
      email: input.email?.trim().toLowerCase() || buildFallbackEmail(input.provider),
      mobileNumber: input.mobileNumber?.trim() ?? '',
      provider: input.provider,
      businessName: '',
      website: '',
      profileImageUrl: '',
      serviceTypes: [],
      services: [],
      packagePlans: [],
      loyaltyProgram: null,
      businessSettings: normalizeBusinessSettings(undefined),
      customerProfiles: [],
      teamMembers: [],
      accountType: null,
      serviceLocation: [],
      venueAddress: '',
      preferredLanguage: null,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now
    };

    await clientPlatformRepository.saveClient(client);
    return client;
  },

  getClient(clientId: string): Promise<ClientRecord> {
    return getClientOrThrow(clientId);
  },

  async getPublicSalons(): Promise<PublicSalonShowcaseItem[]> {
    await ensureDemoSalons();
    const clients = await clientPlatformRepository.listClients();
    const visibleClients = clients
      .map(hydrateClientRecord)
      .filter((client) => client.onboardingCompleted && client.businessName.trim().length > 0)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return Promise.all(
      visibleClients.map(async (client) => {
        const services = await appointmentService.getServiceCatalogForBusiness(client.id);
        const reviews = await appointmentService.listReviewsForBusiness(client.id);

        return {
          clientId: client.id,
          businessName: client.businessName,
          serviceTypes: client.serviceTypes,
          serviceLocation: client.serviceLocation,
          venueAddress: client.venueAddress,
          bookingLink: `/book/${client.id}`,
          reviewSummary: reviews.summary,
          services: services.slice(0, 3).map((service) => ({
            name: service.name,
            durationMinutes: service.durationMinutes,
            priceLabel: service.priceLabel
          }))
        };
      })
    );
  },

  updateBusinessProfile(clientId: string, input: BusinessProfileInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      businessName: input.businessName.trim(),
      website: input.website?.trim() ?? '',
      profileImageUrl: input.profileImageUrl?.trim() ?? '',
      updatedAt: new Date().toISOString()
    }));
  },

  updateServiceTypes(clientId: string, input: ServiceTypesInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      serviceTypes: input.serviceTypes,
      services: syncBusinessServicesWithTypes(
        input.serviceTypes,
        client.services,
        getServiceTemplateOptions(client.businessSettings)
      ),
      updatedAt: new Date().toISOString()
    }));
  },

  updateBusinessSettings(
    clientId: string,
    input: UpdateBusinessSettingsInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const businessSettings = normalizeBusinessSettings({
        ...client.businessSettings,
        ...input,
        reportMetadata: {
          ...client.businessSettings?.reportMetadata,
          ...input.reportMetadata
        }
      });
      const nextServices =
        client.services.length === 0
          ? normalizeBusinessServices(
              client.serviceTypes,
              [],
              getServiceTemplateOptions(businessSettings)
            )
          : normalizeBusinessServices(
              client.serviceTypes,
              client.services,
              getServiceTemplateOptions(businessSettings)
            );

      return {
        ...client,
        businessSettings,
        services: nextServices,
        updatedAt: new Date().toISOString()
      };
    });
  },

  updateAccountType(clientId: string, input: AccountTypeInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      accountType: input.accountType,
      updatedAt: new Date().toISOString()
    }));
  },

  updateServiceLocation(
    clientId: string,
    input: ServiceLocationInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      serviceLocation: normalizeServiceLocations(input.serviceLocation),
      updatedAt: new Date().toISOString()
    }));
  },

  updateVenueLocation(clientId: string, input: VenueLocationInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      venueAddress: input.venueAddress.trim(),
      updatedAt: new Date().toISOString()
    }));
  },

  updatePreferredLanguage(
    clientId: string,
    input: UpdatePreferredLanguageInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      preferredLanguage: input.preferredLanguage,
      updatedAt: new Date().toISOString()
    }));
  },

  addTeamMember(clientId: string, input: CreateTeamMemberInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();
      const nextTeamMember = sanitizeTeamMember(
        {
          id: randomUUID(),
          name: input.name,
          role: input.role?.trim() || getDefaultTeamMemberRole(client),
          phone: input.phone,
          expertise: input.expertise,
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        client.teamMembers.length
      );

      return {
        ...client,
        teamMembers: nextTeamMember
          ? [...client.teamMembers, nextTeamMember]
          : [...client.teamMembers],
        updatedAt: now
      };
    });
  },

  updateTeamMember(
    clientId: string,
    teamMemberId: string,
    input: UpdateTeamMemberInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingTeamMember = client.teamMembers.find((teamMember) => teamMember.id === teamMemberId);

      if (!existingTeamMember) {
        throw new HttpError(404, 'Team member not found');
      }

      const now = new Date().toISOString();
      const nextTeamMember = sanitizeTeamMember(
        {
          ...existingTeamMember,
          name: input.name,
          role: input.role?.trim() || existingTeamMember.role || getDefaultTeamMemberRole(client),
          phone: input.phone,
          expertise: input.expertise,
          updatedAt: now
        },
        client.teamMembers.findIndex((teamMember) => teamMember.id === teamMemberId)
      );

      if (!nextTeamMember) {
        throw new HttpError(400, 'Team member name is required');
      }

      return {
        ...client,
        teamMembers: client.teamMembers.map((teamMember) =>
          teamMember.id === teamMemberId ? nextTeamMember : teamMember
        ),
        updatedAt: now
      };
    });
  },

  removeTeamMember(clientId: string, teamMemberId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingTeamMember = client.teamMembers.find((teamMember) => teamMember.id === teamMemberId);

      if (!existingTeamMember) {
        throw new HttpError(404, 'Team member not found');
      }

      const now = new Date().toISOString();

      return {
        ...client,
        teamMembers: client.teamMembers.map((teamMember) =>
          teamMember.id === teamMemberId
            ? {
                ...teamMember,
                isActive: false,
                updatedAt: now
              }
            : teamMember
        ),
        updatedAt: now
      };
    });
  },

  addService(clientId: string, input: CreateBusinessServiceInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      services: normalizeBusinessServices(
        client.serviceTypes,
        [
          ...client.services,
          {
            id: randomUUID(),
            name: input.name.trim(),
            durationMinutes: input.durationMinutes,
            categoryName: input.categoryName?.trim() || client.serviceTypes[0]?.trim() || 'General',
            priceLabel: input.priceLabel.trim(),
            description: input.description?.trim() ?? '',
            isActive: true
          }
        ],
        getServiceTemplateOptions(client.businessSettings)
      ),
      updatedAt: new Date().toISOString()
    }));
  },

  createPackagePlan(clientId: string, input: CreatePackagePlanInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();

      return {
        ...client,
        packagePlans: normalizePackagePlans([
          ...(client.packagePlans ?? []),
          {
            id: randomUUID(),
            name: input.name.trim(),
            includedServiceIds: input.includedServiceIds ?? [],
            totalUses: input.totalUses,
            priceLabel: input.priceLabel.trim(),
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
        ]),
        updatedAt: now
      };
    });
  },

  updateLoyaltyProgram(
    clientId: string,
    input: UpdateLoyaltyProgramInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();

      return {
        ...client,
        loyaltyProgram: normalizeLoyaltyProgram({
          id: client.loyaltyProgram?.id ?? 'loyalty-program',
          isEnabled: input.isEnabled,
          triggerCompletedVisits: input.triggerCompletedVisits,
          rewardType: 'discount_percent',
          rewardValue: input.rewardValue,
          includedServiceIds: input.includedServiceIds ?? [],
          createdAt: client.loyaltyProgram?.createdAt ?? now,
          updatedAt: now
        }),
        updatedAt: now
      };
    });
  },

  completeOnboarding(clientId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString()
    }));
  },

  async getLaunchLinks(clientId: string, origin: string): Promise<LaunchLinksViewModel> {
    await getClientOrThrow(clientId);
    return buildLaunchLinks(clientId, origin);
  },

  async getDashboard(clientId: string, origin: string): Promise<{
    client: ClientRecord;
    dashboard: DashboardViewModel;
  }> {
    const client = await getClientOrThrow(clientId);
    const [appointmentsForBusiness, launchLinks, commerce] = await Promise.all([
      appointmentService.listAppointmentsForBusiness(clientId),
      buildLaunchLinks(clientId, origin),
      appointmentService.getDashboardCommerce(clientId)
    ]);
    const customerProfiles = buildCustomerProfilesFromAppointments(appointmentsForBusiness);
    const hasCustomerProfileChanges =
      JSON.stringify(customerProfiles) !== JSON.stringify(client.customerProfiles ?? []);
    const syncedClient = hasCustomerProfileChanges
      ? hydrateClientRecord({
          ...client,
          customerProfiles,
          updatedAt: new Date().toISOString()
        })
      : client;

    if (hasCustomerProfileChanges) {
      await clientPlatformRepository.saveClient(syncedClient);
    }

    const appointments = appointmentsForBusiness.map(
      (appointment) => ({
        id: appointment.id,
        customerName: appointment.customerName,
        serviceName: appointment.serviceName,
        teamMemberName: appointment.teamMemberName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        source: appointment.source
      })
    );

    return {
      client: syncedClient,
      dashboard: buildDashboardViewModel(
        syncedClient,
        appointments,
        appointmentsForBusiness,
        launchLinks,
        commerce
      )
    };
  }
};

export const serializeClientForResponse = (client: ClientRecord): PublicClientRecord =>
  toPublicClientRecord(hydrateClientRecord(client));
