import type { AppointmentSource, BusinessService } from '../appointments/appointment.types';
import type { ServiceLocation } from './serviceLocation.constants';

export type { ServiceLocation } from './serviceLocation.constants';

export type AuthProvider = 'email' | 'facebook' | 'google' | 'apple';

export type AccountType = 'independent' | 'team';

export const preferredLanguageOptions = [
  { value: 'english', label: 'English' },
  { value: 'urdu', label: 'Urdu' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'turkish', label: 'Turkish' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'chinese', label: 'Chinese' }
] as const;

export type PreferredLanguage = (typeof preferredLanguageOptions)[number]['value'];

export const preferredLanguageValues = preferredLanguageOptions.map((option) => option.value) as [
  PreferredLanguage,
  ...PreferredLanguage[]
];

export type WeekdayId =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface ReportMetadataRecord {
  pageTitle: string;
  pageSubtitle: string;
}

export interface BusinessSettingsRecord {
  currencyCode: string;
  currencyLocale: string;
  slotTimes: string[];
  useServiceTemplates: boolean;
  reportMetadata: ReportMetadataRecord;
}

export interface TeamMemberRecord {
  id: string;
  name: string;
  role: string;
  phone: string;
  expertise: string;
  openingTime: string;
  closingTime: string;
  offDays: WeekdayId[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  categoryName: string;
  sku: string;
  priceLabel: string;
  stockQuantity: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSaleRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceLabel: string;
  totalPriceLabel: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  soldAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackagePlanRecord {
  id: string;
  name: string;
  includedServiceIds: string[];
  totalUses: number;
  priceLabel: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyProgramRecord {
  id: string;
  isEnabled: boolean;
  triggerCompletedVisits: number;
  rewardType: 'discount_percent';
  rewardValue: number;
  includedServiceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfileRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalVisits: number;
  bookedVisits: number;
  completedVisits: number;
  cancelledVisits: number;
  lastService: string;
  lastAppointmentDate: string;
  lastAppointmentTime: string;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRecord {
  id: string;
  adminToken: string;
  email: string;
  mobileNumber: string;
  businessPhoneNumber: string;
  provider: AuthProvider;
  businessName: string;
  website: string;
  profileImageUrl: string;
  serviceTypes: string[];
  services: BusinessService[];
  products: ProductRecord[];
  productSales: ProductSaleRecord[];
  packagePlans: PackagePlanRecord[];
  loyaltyProgram: LoyaltyProgramRecord | null;
  businessSettings: BusinessSettingsRecord;
  customerProfiles: CustomerProfileRecord[];
  teamMembers: TeamMemberRecord[];
  accountType: AccountType | null;
  serviceLocation: ServiceLocation[];
  venueAddress: string;
  preferredLanguage: PreferredLanguage | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicClientRecord {
  id: string;
  email: string;
  mobileNumber: string;
  businessPhoneNumber: string;
  provider: AuthProvider;
  businessName: string;
  website: string;
  profileImageUrl: string;
  serviceTypes: string[];
  services: BusinessService[];
  products: ProductRecord[];
  productSales: ProductSaleRecord[];
  packagePlans: PackagePlanRecord[];
  loyaltyProgram: LoyaltyProgramRecord | null;
  businessSettings: BusinessSettingsRecord;
  customerProfiles: CustomerProfileRecord[];
  teamMembers: TeamMemberRecord[];
  accountType: AccountType | null;
  serviceLocation: ServiceLocation[];
  venueAddress: string;
  preferredLanguage: PreferredLanguage | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientInput {
  email?: string;
  mobileNumber?: string;
  provider: AuthProvider;
}

export interface BusinessProfileInput {
  businessName: string;
  website?: string;
  businessPhoneNumber?: string;
  profileImageUrl?: string;
  venueAddress?: string;
}

export interface ServiceTypesInput {
  serviceTypes: string[];
}

export interface AccountTypeInput {
  accountType: AccountType;
}

export interface ServiceLocationInput {
  serviceLocation: ServiceLocation[];
}

export interface VenueLocationInput {
  venueAddress: string;
}

export interface UpdatePreferredLanguageInput {
  preferredLanguage: PreferredLanguage;
}

export interface UpdateBusinessSettingsInput {
  currencyCode?: string;
  currencyLocale?: string;
  slotTimes?: string[];
  useServiceTemplates?: boolean;
  reportMetadata?: Partial<ReportMetadataRecord>;
}

export interface CreateTeamMemberInput {
  name: string;
  role?: string;
  phone?: string;
  expertise?: string;
  openingTime?: string;
  closingTime?: string;
  offDays?: WeekdayId[];
  isActive?: boolean;
}

export interface UpdateTeamMemberInput {
  name: string;
  role?: string;
  phone?: string;
  expertise?: string;
  openingTime?: string;
  closingTime?: string;
  offDays?: WeekdayId[];
  isActive?: boolean;
}

export interface CreateBusinessServiceInput {
  name: string;
  categoryName?: string;
  durationMinutes: number;
  priceLabel: string;
  description?: string;
}

export interface CreateProductInput {
  name: string;
  categoryName?: string;
  sku?: string;
  priceLabel: string;
  stockQuantity: number;
  description?: string;
}

export interface UpdateProductInput {
  name: string;
  categoryName?: string;
  sku?: string;
  priceLabel: string;
  stockQuantity: number;
  description?: string;
}

export interface UpdateBusinessServiceInput {
  name: string;
  categoryName?: string;
  durationMinutes: number;
  priceLabel: string;
  description?: string;
}

export interface CreatePackagePlanInput {
  name: string;
  includedServiceIds?: string[];
  totalUses: number;
  priceLabel: string;
}

export interface UpdatePackagePlanInput {
  name: string;
  includedServiceIds?: string[];
  totalUses: number;
  priceLabel: string;
}

export interface SellProductInput {
  productId: string;
  quantity: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}

export interface UpdateLoyaltyProgramInput {
  isEnabled: boolean;
  triggerCompletedVisits: number;
  rewardValue: number;
  includedServiceIds?: string[];
}

export interface DashboardMeta {
  type: 'count' | 'dot';
  value?: string;
}

export interface DashboardListItem {
  label: string;
  subtitle?: string;
  active?: boolean;
  meta?: DashboardMeta;
}

export interface DashboardDrawerSection {
  title?: string;
  items: DashboardListItem[];
}

export interface DashboardDrawer {
  title: string;
  sections: DashboardDrawerSection[];
}

export interface DashboardReportCard {
  title: string;
  description: string;
}

export interface DashboardUiCopy {
  locale: string;
  bookingSourceLabels: {
    qr: string;
    direct: string;
    instagram: string;
    facebook: string;
    applemaps: string;
  };
  appointmentStatusLabels: {
    booked: string;
    completed: string;
    cancelled: string;
  };
  bookedAppointmentActionLabels: {
    edit: string;
    runningLate: string;
    complete: string;
    cancel: string;
  };
  calendar: {
    today: string;
    day: string;
    agenda: string;
    dateTimeConnector?: string;
    bookingSourceTemplate?: string;
    add: string;
    addMenuAria: string;
    bookAppointment: string;
    showQrCode: string;
    groupAppointment: string;
    blockedTime: string;
    sale: string;
    quickPayment: string;
    onlineBookingsTitle: string;
    onlineBookingsDescription: string;
    bookingLinkLabel: string;
    filterAll: string;
    filterBooked: string;
    filterQr: string;
    overviewSelectedDayLabel: string;
    overviewSelectedDayMeta: string;
    overviewComingAppointmentLabel: string;
    overviewComingAppointmentMeta: string;
    overviewNextClientLabel: string;
    overviewNextClientMeta: string;
    overviewNextClientEmpty: string;
    appointmentsEmptyTitle: string;
    appointmentsEmptyDescription: string;
    qrEyebrow: string;
    qrTitle: string;
    qrDescription: string;
    qrPrint: string;
  };
  reports: {
    allFolders: string;
    rangeToday: string;
    range7Days: string;
    range30Days: string;
    range90Days: string;
    lastDaysTemplate: string;
    exportCsv: string;
    print: string;
    newCustomReport: string;
    revenue: string;
    appointments: string;
    completed: string;
    clients: string;
    bookedInRangeTemplate: string;
    completionFlowTemplate: string;
    repeatClientsTeamTemplate: string;
  };
}

export interface DashboardReportsView {
  sidebarTitle: string;
  menu: DashboardListItem[];
  folderTitle: string;
  folderActionLabel: string;
  connectorLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  totalLabel: string;
  searchPlaceholder: string;
  filters: string[];
  tabs: DashboardListItem[];
  cards: DashboardReportCard[];
}

export interface DashboardAppointmentViewModel {
  id: string;
  customerName: string;
  serviceName: string;
  teamMemberName?: string;
  appointmentDate: string;
  appointmentTime: string;
  status: 'booked' | 'cancelled' | 'completed';
  source: AppointmentSource;
}

export interface LaunchLinksViewModel {
  dashboardLink: string;
  bookingPageLink: string;
  instagramBookingLink: string;
  facebookBookingLink: string;
  appleMapsBookingLink: string;
  qrCodeImageLink: string;
  qrBookingPageLink: string;
}

export interface DashboardViewModel {
  businessName: string;
  ownerName: string;
  avatarInitial: string;
  profileImageUrl: string;
  setupButtonLabel: string;
  setupButtonPath: string;
  bookingLink: string;
  launchLinks: LaunchLinksViewModel;
  commerce: DashboardCommerceViewModel;
  currentDateLabel: string;
  currentTimeLabel: string;
  appointments: DashboardAppointmentViewModel[];
  uiCopy: DashboardUiCopy;
  sideDrawers: {
    sales: DashboardDrawer;
    clients: DashboardDrawer;
    catalog: DashboardDrawer;
    team: DashboardDrawer;
  };
  reportsView: DashboardReportsView;
}

export interface DashboardCommerceViewModel {
  activePackagePlans: number;
  packagesSold: number;
  activePackageBalances: number;
  availableLoyaltyRewards: number;
  loyaltyProgramEnabled: boolean;
  activeProducts: number;
  productsSold: number;
  productUnitsSold: number;
  lowStockProducts: number;
}

export interface PublicSalonShowcaseItem {
  clientId: string;
  businessName: string;
  serviceTypes: string[];
  serviceLocation: ServiceLocation[];
  venueAddress: string;
  bookingLink: string;
  onlineTeamMembersCount: number;
  onlineTeamMemberNames: string[];
  reviewSummary: {
    averageRating: number | null;
    totalReviews: number;
  };
  services: Array<{
    name: string;
    durationMinutes: number;
    priceLabel: string;
  }>;
}
