import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { HttpError } from '../shared/errors/httpError';
import { clientPlatformRepository } from './clientPlatform.repository';
import { appointmentService } from '../appointments/appointment.service';
import {
  buildPlatformClientPagePath,
  platformClientAuthMessages,
  platformClientPagePaths
} from './clientPlatform.paths';
import {
  defaultServiceLocation,
  normalizeServiceLocations
} from './serviceLocation.constants';
import { preferredLanguageValues } from './clientPlatform.types';
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
  CreateProductInput,
  CustomerProfileRecord,
  CreateBusinessServiceInput,
  CreateClientInput,
  CreatePackagePlanInput,
  CreateTeamMemberInput,
  DashboardAppointmentViewModel,
  DashboardCommerceViewModel,
  DashboardUiCopy,
  DashboardViewModel,
  LaunchLinksViewModel,
  LoyaltyProgramRecord,
  PackagePlanRecord,
  ProductRecord,
  ProductSaleRecord,
  PublicClientRecord,
  PublicSalonShowcaseItem,
  PreferredLanguage,
  ReportMetadataRecord,
  ServiceLocationInput,
  SellProductInput,
  ServiceTypesInput,
  TeamMemberRecord,
  UpdateTeamMemberInput,
  UpdateBusinessSettingsInput,
  UpdateBusinessServiceInput,
  UpdateProductInput,
  UpdatePackagePlanInput,
  UpdatePreferredLanguageInput,
  UpdateLoyaltyProgramInput,
  VenueLocationInput,
  WeekdayId
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

const WEEKDAY_IDS: WeekdayId[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DASHBOARD_UI_COPY_BY_LANGUAGE: Record<'english' | 'chinese', DashboardUiCopy> = {
  english: {
    locale: 'en-GB',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Direct',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Maps'
    },
    appointmentStatusLabels: {
      booked: 'BOOKED',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED'
    },
    bookedAppointmentActionLabels: {
      edit: 'Edit',
      runningLate: 'Running late',
      complete: 'Complete',
      cancel: 'Cancel'
    },
    calendar: {
      today: 'Today',
      day: 'Day',
      agenda: 'Agenda',
      add: 'Add',
      addMenuAria: 'Add menu',
      bookAppointment: 'Book appointment',
      showQrCode: 'Show QR code',
      groupAppointment: 'Group appointment',
      blockedTime: 'Blocked time',
      sale: 'Sale',
      quickPayment: 'Quick payment',
      onlineBookingsTitle: 'Online bookings',
      onlineBookingsDescription:
        'Appointments booked through your public salon links, social links, and QR code.',
      bookingLinkLabel: 'Open booking page',
      filterAll: 'All',
      filterBooked: 'Booked',
      filterQr: 'QR source',
      overviewSelectedDayLabel: 'Selected day',
      overviewSelectedDayMeta: 'appointments on this date',
      overviewComingAppointmentLabel: 'Coming appointment',
      overviewComingAppointmentMeta: 'currently active appointments',
      overviewNextClientLabel: 'Next client',
      overviewNextClientMeta: 'upcoming on the selected day',
      overviewNextClientEmpty: 'No bookings yet',
      appointmentsEmptyTitle: 'No bookings yet',
      appointmentsEmptyDescription:
        'Share your booking page, social links, or QR code to start collecting appointments.',
      qrEyebrow: 'Share booking QR',
      qrTitle: 'Scan to book',
      qrDescription:
        'Place this QR code on your salon door so clients can scan and book instantly.',
      qrPrint: 'Print QR code'
    },
    reports: {
      allFolders: 'All folders',
      rangeToday: 'Today',
      range7Days: '7 days',
      range30Days: '30 days',
      range90Days: '90 days',
      lastDaysTemplate: 'Last {days} days',
      exportCsv: 'Export CSV',
      print: 'Print',
      newCustomReport: 'New custom report',
      revenue: 'Revenue',
      appointments: 'Appointments',
      completed: 'Completed',
      clients: 'Clients',
      bookedInRangeTemplate: '{count} booked in range',
      completionFlowTemplate: '{label} completion flow',
      repeatClientsTeamTemplate: '{repeat} repeat • {team} team'
    }
  },
  chinese: {
    locale: 'zh-CN',
    bookingSourceLabels: {
      qr: '二维码',
      direct: '直接',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple 地图'
    },
    appointmentStatusLabels: {
      booked: '已预约',
      completed: '已完成',
      cancelled: '已取消'
    },
    bookedAppointmentActionLabels: {
      edit: '编辑',
      runningLate: '延迟通知',
      complete: '完成',
      cancel: '取消'
    },
    calendar: {
      today: '今天',
      day: '日视图',
      agenda: '列表视图',
      add: '新增',
      addMenuAria: '新增菜单',
      bookAppointment: '预约服务',
      showQrCode: '显示二维码',
      groupAppointment: '团体预约',
      blockedTime: '封锁时间',
      sale: '销售',
      quickPayment: '快速收款',
      onlineBookingsTitle: '在线预约',
      onlineBookingsDescription: '这里显示通过公开预约页、社交链接和二维码产生的预约。',
      bookingLinkLabel: '打开预约页面',
      filterAll: '全部',
      filterBooked: '已预约',
      filterQr: '二维码来源',
      overviewSelectedDayLabel: '所选日期',
      overviewSelectedDayMeta: '该日期的预约数量',
      overviewComingAppointmentLabel: '即将开始',
      overviewComingAppointmentMeta: '当前有效预约',
      overviewNextClientLabel: '下一位客户',
      overviewNextClientMeta: '所选日期内的下一个预约',
      overviewNextClientEmpty: '暂无预约',
      appointmentsEmptyTitle: '暂无预约',
      appointmentsEmptyDescription: '分享你的预约页面、社交链接或二维码来开始接收预约。',
      qrEyebrow: '分享预约二维码',
      qrTitle: '扫码预约',
      qrDescription: '把这个二维码放在店门口，客户扫码后就能立即预约。',
      qrPrint: '打印二维码'
    },
    reports: {
      allFolders: '全部文件夹',
      rangeToday: '今天',
      range7Days: '7天',
      range30Days: '30天',
      range90Days: '90天',
      lastDaysTemplate: '最近 {days} 天',
      exportCsv: '导出 CSV',
      print: '打印',
      newCustomReport: '新建自定义报表',
      revenue: '收入',
      appointments: '预约',
      completed: '已完成',
      clients: '客户',
      bookedInRangeTemplate: '区间内已预约 {count} 个',
      completionFlowTemplate: '{label} 完成趋势',
      repeatClientsTeamTemplate: '回头客 {repeat} • 团队 {team}'
    }
  }
};

const getDashboardLocaleKey = (
  preferredLanguage: PreferredLanguage | null | undefined
): 'english' | 'chinese' => (preferredLanguage === 'chinese' ? 'chinese' : 'english');

const getDashboardUiCopyForLanguage = (
  preferredLanguage: PreferredLanguage | null | undefined
): DashboardUiCopy => DASHBOARD_UI_COPY_BY_LANGUAGE[getDashboardLocaleKey(preferredLanguage)];

const buildFallbackEmail = (provider: CreateClientInput['provider']): string =>
  `${provider}-${randomUUID().slice(0, 8)}@platform.local`;

const normalizeClientEmail = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeClientMobileNumber = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

const isInsecureAdminLoginAllowed = (): boolean => env.APP_ENV !== 'prod';

const getNextIncompleteOnboardingPath = (
  client: ClientRecord
): string | null => {
  const hydratedClient = hydrateClientRecord(client);

  if (!hydratedClient.businessName.trim()) {
    return platformClientPagePaths.onboarding.businessName;
  }

  if (hydratedClient.serviceTypes.length === 0) {
    return platformClientPagePaths.onboarding.serviceTypes;
  }

  if (!hydratedClient.accountType) {
    return platformClientPagePaths.onboarding.accountType;
  }

  if (hydratedClient.serviceLocation.length === 0) {
    return platformClientPagePaths.onboarding.serviceLocation;
  }

  if (!hydratedClient.venueAddress.trim()) {
    return platformClientPagePaths.onboarding.venueLocation;
  }

  if (!hydratedClient.preferredLanguage) {
    return platformClientPagePaths.onboarding.launchLinks;
  }

  return null;
};

const getNextClientStep = (client: ClientRecord): string => {
  const hydratedClient = hydrateClientRecord(client);
  const incompleteOnboardingPath = getNextIncompleteOnboardingPath(hydratedClient);

  if (incompleteOnboardingPath) {
    return buildPlatformClientPagePath(incompleteOnboardingPath, hydratedClient.id);
  }

  if (hydratedClient.onboardingCompleted) {
    return buildPlatformClientPagePath(platformClientPagePaths.calendar, hydratedClient.id);
  }

  return buildPlatformClientPagePath(platformClientPagePaths.onboarding.complete, hydratedClient.id);
};

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

const parseMoneyLabel = (
  priceLabel: string,
  fallbackCurrencyCode = DEFAULT_BUSINESS_SETTINGS.currencyCode
): { amountValue: number; currencyCode: string } => {
  const trimmedLabel = typeof priceLabel === 'string' ? priceLabel.trim() : '';
  const currencyMatch = trimmedLabel.match(/\b([A-Za-z]{3})\b/);
  const normalizedValue = Number(trimmedLabel.replace(/[^\d.]/g, ''));

  return {
    amountValue: Number.isFinite(normalizedValue) ? normalizedValue : 0,
    currencyCode: currencyMatch?.[1]?.toUpperCase() ?? fallbackCurrencyCode
  };
};

const formatMoneyLabel = (
  amountValue: number,
  currencyCode: string,
  currencyLocale: string
): string => {
  const normalizedAmountValue = Number.isFinite(amountValue) ? amountValue : 0;

  try {
    return new Intl.NumberFormat(currencyLocale || DEFAULT_BUSINESS_SETTINGS.currencyLocale, {
      style: 'currency',
      currency: currencyCode || DEFAULT_BUSINESS_SETTINGS.currencyCode,
      maximumFractionDigits: normalizedAmountValue % 1 === 0 ? 0 : 2
    }).format(normalizedAmountValue);
  } catch (_error) {
    return `${currencyCode || DEFAULT_BUSINESS_SETTINGS.currencyCode} ${normalizedAmountValue}`;
  }
};

const normalizeSlotTimes = (value: unknown): string[] => {
  const rawValues = Array.isArray(value) ? value : [];
  const uniqueSlots = new Set<string>();

  for (const slotValue of rawValues) {
    const normalizedValue = typeof slotValue === 'string' ? slotValue.trim() : '';

    if (!TIME_PATTERN.test(normalizedValue)) {
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

const parseTimeToMinutes = (value: string): number => {
  const [hoursValue, minutesValue] = value.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  return hours * 60 + minutes;
};

const formatMinutesAsTime = (value: number): string => {
  const normalizedValue = Math.max(0, Math.min(24 * 60 - 1, Math.round(value)));
  const hours = Math.floor(normalizedValue / 60);
  const minutes = normalizedValue % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getDefaultTeamMemberTimeRange = (
  businessSettings: BusinessSettingsRecord | null | undefined
): { openingTime: string; closingTime: string } => {
  const normalizedSettings = normalizeBusinessSettings(businessSettings);
  const slotTimes = normalizedSettings.slotTimes;
  const openingTime = slotTimes[0] ?? '09:00';
  const lastSlot = slotTimes[slotTimes.length - 1] ?? '17:00';
  const slotMinutes = slotTimes.map(parseTimeToMinutes);
  const fallbackGapMinutes =
    slotMinutes.length > 1
      ? Math.max(
          15,
          slotMinutes
            .slice(1)
            .map((slotMinute, index) => slotMinute - slotMinutes[index])
            .find((gapMinutes) => gapMinutes > 0) ?? 60
        )
      : 60;
  const closingTime = formatMinutesAsTime(parseTimeToMinutes(lastSlot) + fallbackGapMinutes);
  return { openingTime, closingTime };
};

const normalizeTeamMemberOffDays = (value: unknown): WeekdayId[] => {
  const offDays = Array.isArray(value) ? value : [];
  const uniqueOffDays = new Set<WeekdayId>();

  for (const offDay of offDays) {
    const normalizedOffDay = typeof offDay === 'string' ? offDay.trim().toLowerCase() : '';

    if (WEEKDAY_IDS.includes(normalizedOffDay as WeekdayId)) {
      uniqueOffDays.add(normalizedOffDay as WeekdayId);
    }
  }

  return WEEKDAY_IDS.filter((weekdayId) => uniqueOffDays.has(weekdayId));
};

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
  fallbackIndex: number,
  businessSettings: BusinessSettingsRecord | null | undefined
): TeamMemberRecord | undefined => {
  const name = typeof teamMember.name === 'string' ? teamMember.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const defaultTimeRange = getDefaultTeamMemberTimeRange(businessSettings);
  const openingTime =
    typeof teamMember.openingTime === 'string' && TIME_PATTERN.test(teamMember.openingTime.trim())
      ? teamMember.openingTime.trim()
      : defaultTimeRange.openingTime;
  const closingTime =
    typeof teamMember.closingTime === 'string' && TIME_PATTERN.test(teamMember.closingTime.trim())
      ? teamMember.closingTime.trim()
      : defaultTimeRange.closingTime;
  const normalizedOpeningTimeMinutes = parseTimeToMinutes(openingTime);
  const normalizedClosingTimeMinutes = parseTimeToMinutes(closingTime);
  const hasValidTimeRange = normalizedClosingTimeMinutes > normalizedOpeningTimeMinutes;

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
    openingTime: hasValidTimeRange ? openingTime : defaultTimeRange.openingTime,
    closingTime: hasValidTimeRange ? closingTime : defaultTimeRange.closingTime,
    offDays: normalizeTeamMemberOffDays(teamMember.offDays),
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

const normalizeTeamMembers = (
  teamMembers: TeamMemberRecord[] = [],
  businessSettings: BusinessSettingsRecord | null | undefined
): TeamMemberRecord[] =>
  teamMembers
    .map((teamMember, index) => sanitizeTeamMember(teamMember, index, businessSettings))
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

const sanitizeProduct = (
  product: Partial<ProductRecord>,
  fallbackIndex: number
): ProductRecord | undefined => {
  const name = typeof product.name === 'string' ? product.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const stockQuantity = Number(product.stockQuantity);

  return {
    id:
      typeof product.id === 'string' && product.id.trim().length > 0
        ? product.id.trim()
        : `product-${fallbackIndex + 1}`,
    name,
    categoryName:
      typeof product.categoryName === 'string' && product.categoryName.trim().length > 0
        ? product.categoryName.trim()
        : 'Retail',
    sku: typeof product.sku === 'string' ? product.sku.trim() : '',
    priceLabel: typeof product.priceLabel === 'string' ? product.priceLabel.trim() : '',
    stockQuantity: Number.isFinite(stockQuantity) && stockQuantity >= 0 ? Math.floor(stockQuantity) : 0,
    description: typeof product.description === 'string' ? product.description.trim() : '',
    isActive: product.isActive !== false,
    createdAt:
      typeof product.createdAt === 'string' && product.createdAt.trim().length > 0
        ? product.createdAt
        : timestamp,
    updatedAt:
      typeof product.updatedAt === 'string' && product.updatedAt.trim().length > 0
        ? product.updatedAt
        : timestamp
  };
};

const normalizeProducts = (products: ProductRecord[] = []): ProductRecord[] =>
  products
    .map((product, index) => sanitizeProduct(product, index))
    .filter((product): product is ProductRecord => !!product);

const sanitizeProductSale = (
  productSale: Partial<ProductSaleRecord>,
  fallbackIndex: number
): ProductSaleRecord | undefined => {
  const productId = typeof productSale.productId === 'string' ? productSale.productId.trim() : '';
  const productName = typeof productSale.productName === 'string' ? productSale.productName.trim() : '';
  const customerName =
    typeof productSale.customerName === 'string' ? productSale.customerName.trim() : '';
  const quantity = Number(productSale.quantity);

  if (!productId || !productName || !customerName) {
    return undefined;
  }

  const timestamp = new Date().toISOString();

  return {
    id:
      typeof productSale.id === 'string' && productSale.id.trim().length > 0
        ? productSale.id.trim()
        : `product-sale-${fallbackIndex + 1}`,
    productId,
    productName,
    sku: typeof productSale.sku === 'string' ? productSale.sku.trim() : '',
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
    unitPriceLabel: typeof productSale.unitPriceLabel === 'string' ? productSale.unitPriceLabel.trim() : '',
    totalPriceLabel:
      typeof productSale.totalPriceLabel === 'string' ? productSale.totalPriceLabel.trim() : '',
    customerName,
    customerPhone:
      typeof productSale.customerPhone === 'string' ? productSale.customerPhone.trim() : '',
    customerEmail:
      typeof productSale.customerEmail === 'string' ? productSale.customerEmail.trim() : '',
    soldAt:
      typeof productSale.soldAt === 'string' && productSale.soldAt.trim().length > 0
        ? productSale.soldAt
        : timestamp,
    createdAt:
      typeof productSale.createdAt === 'string' && productSale.createdAt.trim().length > 0
        ? productSale.createdAt
        : timestamp,
    updatedAt:
      typeof productSale.updatedAt === 'string' && productSale.updatedAt.trim().length > 0
        ? productSale.updatedAt
        : timestamp
  };
};

const normalizeProductSales = (productSales: ProductSaleRecord[] = []): ProductSaleRecord[] =>
  productSales
    .map((productSale, index) => sanitizeProductSale(productSale, index))
    .filter((productSale): productSale is ProductSaleRecord => !!productSale)
    .sort((left, right) => right.soldAt.localeCompare(left.soldAt));

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

const normalizePreferredLanguage = (value: unknown): PreferredLanguage | null => {
  return typeof value === 'string' && preferredLanguageValues.includes(value as PreferredLanguage)
    ? (value as PreferredLanguage)
    : null;
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

const buildProductCommerceView = (
  client: Pick<ClientRecord, 'products' | 'productSales'>
): Pick<
  DashboardCommerceViewModel,
  'activeProducts' | 'productsSold' | 'productUnitsSold' | 'lowStockProducts'
> => {
  const activeProducts = normalizeProducts(client.products ?? []).filter(
    (product) => product.isActive !== false
  );
  const productSales = normalizeProductSales(client.productSales ?? []);

  return {
    activeProducts: activeProducts.length,
    productsSold: productSales.length,
    productUnitsSold: productSales.reduce((sum, productSale) => sum + productSale.quantity, 0),
    lowStockProducts: activeProducts.filter((product) => product.stockQuantity <= 3).length
  };
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
  products: normalizeProducts(client.products ?? []),
  productSales: normalizeProductSales(client.productSales ?? []),
  packagePlans: normalizePackagePlans(client.packagePlans ?? []),
  loyaltyProgram: normalizeLoyaltyProgram(client.loyaltyProgram),
  businessSettings: normalizeBusinessSettings(client.businessSettings),
  customerProfiles: normalizeCustomerProfiles(client.customerProfiles ?? []),
  teamMembers: normalizeTeamMembers(client.teamMembers ?? [], client.businessSettings),
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
    products: [],
    productSales: [],
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
        openingTime: '09:00',
        closingTime: '18:00',
        offDays: [],
        isActive: true,
        createdAt: '2026-03-01T09:00:00.000Z',
        updatedAt: '2026-03-12T08:30:00.000Z'
      }
    ],
    accountType: 'team',
    serviceLocation: [defaultServiceLocation],
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
    products: [],
    productSales: [],
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [],
    accountType: 'independent',
    serviceLocation: [defaultServiceLocation],
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
    products: [],
    productSales: [],
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
        openingTime: '09:00',
        closingTime: '18:00',
        offDays: [],
        isActive: true,
        createdAt: '2026-03-03T11:00:00.000Z',
        updatedAt: '2026-03-12T07:30:00.000Z'
      }
    ],
    accountType: 'team',
    serviceLocation: [defaultServiceLocation],
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

const formatDashboardDate = (
  date: Date,
  preferredLanguage: PreferredLanguage | null | undefined
): string =>
  new Intl.DateTimeFormat(getDashboardUiCopyForLanguage(preferredLanguage).locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
    .format(date)
    .replace(',', '');

const formatDashboardTime = (
  date: Date,
  preferredLanguage: PreferredLanguage | null | undefined
): string =>
  new Intl.DateTimeFormat(getDashboardUiCopyForLanguage(preferredLanguage).locale, {
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

const buildStoredClientDrawerItems = (
  customerProfiles: CustomerProfileRecord[],
  preferredLanguage: PreferredLanguage | null
) => {
  const recentClients = normalizeCustomerProfiles(customerProfiles).slice(0, 6);
  const isChinese = getDashboardLocaleKey(preferredLanguage) === 'chinese';

  if (recentClients.length === 0) {
    return [
      {
        label: isChinese ? '暂无客户' : 'No clients yet',
        subtitle: isChinese
          ? '预约产生的客户和已完成服务记录会显示在这里。'
          : 'Customers from bookings and completed visits will appear here.'
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
  const activeTeamMembers = normalizeTeamMembers(client.teamMembers ?? [], client.businessSettings).filter(
    (teamMember) => teamMember.isActive
  );
  const isChinese = getDashboardLocaleKey(client.preferredLanguage) === 'chinese';
  const teamRoleLabel = client.serviceTypes.includes('Barber')
    ? isChinese
      ? '理发师'
      : 'barber'
    : isChinese
      ? '团队成员'
      : 'team member';

  return [
    {
      items: [
        {
          label: isChinese ? '团队成员' : 'Team members',
          subtitle: isChinese
            ? `${activeTeamMembers.length} 位在岗${teamRoleLabel}`
            : `${activeTeamMembers.length} active ${teamRoleLabel}${activeTeamMembers.length === 1 ? '' : 's'}`
        },
        { label: isChinese ? '排班' : 'Scheduled shifts' },
        { label: isChinese ? '工时表' : 'Timesheets', meta: { type: 'dot' as const } },
        { label: isChinese ? '薪资发放' : 'Pay runs', meta: { type: 'dot' as const } }
      ]
    },
    {
      title: activeTeamMembers.length > 0
        ? isChinese
          ? '当前团队'
          : 'Current team'
        : isChinese
          ? '团队设置'
          : 'Team setup',
      items:
        activeTeamMembers.length > 0
          ? activeTeamMembers.map((teamMember) => ({
              label: teamMember.name,
              subtitle: `${teamMember.expertise || teamMember.role}${teamMember.phone ? ` • ${teamMember.phone}` : ''}`
            }))
          : [
              {
                label: isChinese ? '还没有团队成员' : 'No team members yet',
                subtitle: isChinese
                  ? `请在团队面板中添加第一位${teamRoleLabel}。`
                  : `Add your first ${teamRoleLabel} from the team panel.`
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
  const uiCopy = getDashboardUiCopyForLanguage(client.preferredLanguage);
  const isChinese = getDashboardLocaleKey(client.preferredLanguage) === 'chinese';
  const businessName = client.businessName || 'fresha';
  const ownerName = client.businessName || formatOwnerName(client.email) || (isChinese ? '店主' : 'Owner');
  const businessSettings = normalizeBusinessSettings(client.businessSettings);
  const now = new Date();
  const reportPageTitle =
    businessSettings.reportMetadata.pageTitle === DEFAULT_REPORT_METADATA.pageTitle
      ? isChinese
        ? '报表与分析'
        : businessSettings.reportMetadata.pageTitle
      : businessSettings.reportMetadata.pageTitle;
  const reportPageSubtitle =
    businessSettings.reportMetadata.pageSubtitle === DEFAULT_REPORT_METADATA.pageSubtitle
      ? isChinese
        ? '在一个工作区中查看你的全部业务报表。'
        : businessSettings.reportMetadata.pageSubtitle
      : businessSettings.reportMetadata.pageSubtitle;

  return {
    businessName,
    ownerName,
    avatarInitial: getAvatarInitial(ownerName),
    profileImageUrl: client.profileImageUrl ?? '',
    setupButtonLabel: client.onboardingCompleted
      ? isChinese
        ? '设置完成'
        : 'Setup complete'
      : isChinese
        ? '继续设置'
        : 'Continue setup',
    setupButtonPath: '/guides/legendary-learner',
    bookingLink: `/book/${client.id}`,
    launchLinks,
    commerce,
    currentDateLabel: formatDashboardDate(now, client.preferredLanguage),
    currentTimeLabel: formatDashboardTime(now, client.preferredLanguage),
    appointments,
    uiCopy,
    sideDrawers: {
      sales: {
        title: isChinese ? '销售' : 'Sales',
        sections: [
          {
            items: [
              { label: isChinese ? '今日销售摘要' : 'Daily sales summary' },
              { label: isChinese ? '预约' : 'Appointments' },
              { label: isChinese ? '销售' : 'Sales' },
              { label: isChinese ? '收款' : 'Payments' },
              { label: isChinese ? '礼品卡销售' : 'Gift cards sold' },
              { label: isChinese ? '套餐销售' : 'Packages sold' }
            ]
          }
        ]
      },
      clients: {
        title: isChinese ? '客户' : 'Clients',
        sections: [
          {
            items: [
              { label: isChinese ? '客户列表' : 'Clients list' },
              { label: isChinese ? '客户忠诚度' : 'Client loyalty' }
            ]
          },
          {
            title: isChinese ? '客户' : 'Clients',
            items: buildStoredClientDrawerItems(client.customerProfiles ?? [], client.preferredLanguage)
          }
        ]
      },
      catalog: {
        title: isChinese ? '目录' : 'Catalog',
        sections: [
          {
            items: [
              { label: isChinese ? '服务菜单' : 'Service menu' },
              { label: isChinese ? '套餐' : 'Packages' },
              {
                label: isChinese ? '产品' : 'Products',
                subtitle:
                  commerce.activeProducts > 0
                    ? isChinese
                      ? `${commerce.activeProducts} 个在售产品`
                      : `${commerce.activeProducts} active product${commerce.activeProducts === 1 ? '' : 's'}`
                    : isChinese
                      ? '还没有添加产品'
                      : 'No products added yet'
              }
            ]
          },
          {
            title: isChinese ? '库存' : 'Inventory',
            items: [
              { label: isChinese ? '盘点' : 'Stocktakes' },
              { label: isChinese ? '采购订单' : 'Stock orders' },
              { label: isChinese ? '供应商' : 'Suppliers' }
            ]
          }
        ]
      },
      team: {
        title: isChinese ? '团队' : 'Team',
        sections: buildTeamDrawerSections(client)
      }
    },
    reportsView: {
      sidebarTitle: isChinese ? '报表' : 'Reports',
      menu: [
        { label: isChinese ? '全部报表' : 'All reports', active: true, meta: { type: 'count', value: '0' } },
        { label: isChinese ? '收藏' : 'Favourites', meta: { type: 'count', value: '0' } },
        { label: isChinese ? '仪表板' : 'Dashboards', meta: { type: 'count', value: '0' } },
        { label: isChinese ? '标准' : 'Standard', meta: { type: 'count', value: '0' } },
        { label: isChinese ? '高级' : 'Premium', meta: { type: 'count', value: '0' } },
        { label: isChinese ? '自定义' : 'Custom', meta: { type: 'count', value: '0' } },
        { label: isChinese ? '目标' : 'Targets', meta: { type: 'count', value: '0' } }
      ],
      folderTitle: isChinese ? '文件夹' : 'Folders',
      folderActionLabel: isChinese ? '添加文件夹' : 'Add folder',
      connectorLabel: isChinese ? '数据连接器' : 'Data connector',
      pageTitle: reportPageTitle,
      pageSubtitle: reportPageSubtitle,
      totalLabel: '0',
      searchPlaceholder: isChinese ? '按报表名称或描述搜索' : 'Search by report name or description',
      filters: isChinese ? ['创建者', '分类'] : ['Created by', 'Category'],
      tabs: [
        { label: isChinese ? '全部报表' : 'All reports', active: true },
        { label: isChinese ? '销售' : 'Sales' },
        { label: isChinese ? '财务' : 'Finance' },
        { label: isChinese ? '预约' : 'Appointments' },
        { label: isChinese ? '团队' : 'Team' },
        { label: isChinese ? '客户' : 'Clients' },
        { label: isChinese ? '库存' : 'Inventory' }
      ],
      cards: [
        {
          title: isChinese ? '经营表现仪表板' : 'Performance dashboard',
          description: isChinese ? '查看你的业务表现总览。' : 'Dashboard of your business performance.'
        },
        {
          title: isChinese ? '线上表现仪表板' : 'Online presence dashboard',
          description: isChinese ? '查看线上销售和线上客户表现。' : 'Online sales and online client performance.'
        },
        {
          title: isChinese ? '会员忠诚度仪表板' : 'Loyalty dashboard',
          description: isChinese ? '查看忠诚度计划的表现。' : 'Dashboard of your loyalty program performance.'
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
    products: normalizeProducts(client.products ?? []),
    productSales: normalizeProductSales(client.productSales ?? []),
    packagePlans: normalizePackagePlans(client.packagePlans ?? []),
    loyaltyProgram: normalizeLoyaltyProgram(client.loyaltyProgram),
    customerProfiles: normalizeCustomerProfiles(client.customerProfiles ?? []),
    teamMembers: normalizeTeamMembers(client.teamMembers ?? [], businessSettings),
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

const findClientByLoginInput = async (
  input: Pick<CreateClientInput, 'email' | 'mobileNumber'>
): Promise<ClientRecord | null> => {
  const normalizedEmail = normalizeClientEmail(input.email);
  const normalizedMobileNumber = normalizeClientMobileNumber(input.mobileNumber);

  if (!normalizedEmail && !normalizedMobileNumber) {
    return null;
  }

  const clients = (await clientPlatformRepository.listClients()).map(hydrateClientRecord);

  if (normalizedEmail) {
    const emailMatch = clients.find((client) => client.email === normalizedEmail);

    if (emailMatch) {
      return emailMatch;
    }
  }

  if (normalizedMobileNumber) {
    const mobileMatch = clients.find((client) => client.mobileNumber === normalizedMobileNumber);

    if (mobileMatch) {
      return mobileMatch;
    }
  }

  return null;
};

export const clientPlatformService = {
  async createClient(input: CreateClientInput): Promise<ClientRecord> {
    const now = new Date().toISOString();
    const normalizedEmail = normalizeClientEmail(input.email);
    const normalizedMobileNumber = normalizeClientMobileNumber(input.mobileNumber);

    if (normalizedEmail || normalizedMobileNumber) {
      const existingClient = await findClientByLoginInput({
        email: normalizedEmail,
        mobileNumber: normalizedMobileNumber
      });

      if (existingClient) {
        throw new HttpError(409, platformClientAuthMessages.accountExists);
      }
    }

    const client: ClientRecord = {
      id: randomUUID(),
      adminToken: randomUUID(),
      email: normalizedEmail || buildFallbackEmail(input.provider),
      mobileNumber: normalizedMobileNumber,
      provider: input.provider,
      businessName: '',
      website: '',
      profileImageUrl: '',
      serviceTypes: [],
      services: [],
      products: [],
      productSales: [],
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

  async loginClient(
    input: Pick<CreateClientInput, 'email' | 'mobileNumber'>
  ): Promise<{ client: ClientRecord; nextStep: string }> {
    // Temporary testing-only login flow. Production must use a stronger auth mechanism.
    if (!isInsecureAdminLoginAllowed()) {
      throw new HttpError(403, 'Admin login by email or mobile is disabled in production');
    }

    const client = await findClientByLoginInput(input);

    if (!client) {
      throw new HttpError(404, platformClientAuthMessages.accountNotFound);
    }

    return {
      client,
      nextStep: getNextClientStep(client)
    };
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
      venueAddress: input.venueAddress?.trim() ?? client.venueAddress,
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
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          offDays: input.offDays,
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        client.teamMembers.length,
        client.businessSettings
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
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          offDays: input.offDays,
          updatedAt: now
        },
        client.teamMembers.findIndex((teamMember) => teamMember.id === teamMemberId),
        client.businessSettings
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

  updateService(
    clientId: string,
    serviceId: string,
    input: UpdateBusinessServiceInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingService = client.services.find((service) => service.id === serviceId);

      if (!existingService) {
        throw new HttpError(404, 'Service not found');
      }

      return {
        ...client,
        services: normalizeBusinessServices(
          client.serviceTypes,
          client.services.map((service) =>
            service.id === serviceId
              ? {
                  ...service,
                  name: input.name.trim(),
                  durationMinutes: input.durationMinutes,
                  categoryName:
                    input.categoryName?.trim() || existingService.categoryName || client.serviceTypes[0]?.trim() || 'General',
                  priceLabel: input.priceLabel.trim(),
                  description: input.description?.trim() ?? '',
                  isActive: service.isActive !== false
                }
              : service
          ),
          getServiceTemplateOptions(client.businessSettings)
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  removeService(clientId: string, serviceId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingService = client.services.find((service) => service.id === serviceId);

      if (!existingService) {
        throw new HttpError(404, 'Service not found');
      }

      return {
        ...client,
        services: normalizeBusinessServices(
          client.serviceTypes,
          client.services.map((service) =>
            service.id === serviceId
              ? {
                  ...service,
                  isActive: false
                }
              : service
          ),
          getServiceTemplateOptions(client.businessSettings)
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  createProduct(clientId: string, input: CreateProductInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();

      return {
        ...client,
        products: normalizeProducts([
          ...(client.products ?? []),
          {
            id: randomUUID(),
            name: input.name.trim(),
            categoryName: input.categoryName?.trim() || client.serviceTypes[0]?.trim() || 'Retail',
            sku: input.sku?.trim() ?? '',
            priceLabel: input.priceLabel.trim(),
            stockQuantity: Math.max(0, Math.floor(input.stockQuantity)),
            description: input.description?.trim() ?? '',
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
        ]),
        updatedAt: now
      };
    });
  },

  updateProduct(clientId: string, productId: string, input: UpdateProductInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingProduct = client.products.find((product) => product.id === productId);

      if (!existingProduct) {
        throw new HttpError(404, 'Product not found');
      }

      const now = new Date().toISOString();

      return {
        ...client,
        products: normalizeProducts(
          client.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  name: input.name.trim(),
                  categoryName:
                    input.categoryName?.trim() || existingProduct.categoryName || client.serviceTypes[0]?.trim() || 'Retail',
                  sku: input.sku?.trim() ?? '',
                  priceLabel: input.priceLabel.trim(),
                  stockQuantity: Math.max(0, Math.floor(input.stockQuantity)),
                  description: input.description?.trim() ?? '',
                  isActive: product.isActive !== false,
                  updatedAt: now
                }
              : product
          )
        ),
        updatedAt: now
      };
    });
  },

  removeProduct(clientId: string, productId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingProduct = client.products.find((product) => product.id === productId);

      if (!existingProduct) {
        throw new HttpError(404, 'Product not found');
      }

      const now = new Date().toISOString();

      return {
        ...client,
        products: normalizeProducts(
          client.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  isActive: false,
                  updatedAt: now
                }
              : product
          )
        ),
        updatedAt: now
      };
    });
  },

  sellProduct(clientId: string, input: SellProductInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingProduct = normalizeProducts(client.products ?? []).find(
        (product) => product.id === input.productId
      );

      if (!existingProduct || existingProduct.isActive === false) {
        throw new HttpError(404, 'Product not found');
      }

      const quantity = Math.max(1, Math.floor(input.quantity));

      if (existingProduct.stockQuantity < quantity) {
        throw new HttpError(409, 'Not enough stock available for this product');
      }

      const now = new Date().toISOString();
      const businessSettings = normalizeBusinessSettings(client.businessSettings);
      const unitMoney = parseMoneyLabel(existingProduct.priceLabel, businessSettings.currencyCode);
      const totalAmountValue = unitMoney.amountValue * quantity;
      const totalPriceLabel = formatMoneyLabel(
        totalAmountValue,
        unitMoney.currencyCode,
        businessSettings.currencyLocale
      );

      return {
        ...client,
        products: normalizeProducts(
          client.products.map((product) =>
            product.id === existingProduct.id
              ? {
                  ...product,
                  stockQuantity: Math.max(0, product.stockQuantity - quantity),
                  updatedAt: now
                }
              : product
          )
        ),
        productSales: normalizeProductSales([
          ...(client.productSales ?? []),
          {
            id: randomUUID(),
            productId: existingProduct.id,
            productName: existingProduct.name,
            sku: existingProduct.sku,
            quantity,
            unitPriceLabel: existingProduct.priceLabel,
            totalPriceLabel,
            customerName: input.customerName.trim(),
            customerPhone: input.customerPhone.trim(),
            customerEmail: input.customerEmail?.trim() ?? '',
            soldAt: now,
            createdAt: now,
            updatedAt: now
          }
        ]),
        updatedAt: now
      };
    });
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

  updatePackagePlan(
    clientId: string,
    packagePlanId: string,
    input: UpdatePackagePlanInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingPackagePlan = client.packagePlans.find((packagePlan) => packagePlan.id === packagePlanId);

      if (!existingPackagePlan) {
        throw new HttpError(404, 'Package plan not found');
      }

      return {
        ...client,
        packagePlans: normalizePackagePlans(
          client.packagePlans.map((packagePlan) =>
            packagePlan.id === packagePlanId
              ? {
                  ...packagePlan,
                  name: input.name.trim(),
                  includedServiceIds: input.includedServiceIds ?? [],
                  totalUses: input.totalUses,
                  priceLabel: input.priceLabel.trim(),
                  isActive: packagePlan.isActive !== false,
                  updatedAt: new Date().toISOString()
                }
              : packagePlan
          )
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  removePackagePlan(clientId: string, packagePlanId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingPackagePlan = client.packagePlans.find((packagePlan) => packagePlan.id === packagePlanId);

      if (!existingPackagePlan) {
        throw new HttpError(404, 'Package plan not found');
      }

      return {
        ...client,
        packagePlans: normalizePackagePlans(
          client.packagePlans.map((packagePlan) =>
            packagePlan.id === packagePlanId
              ? {
                  ...packagePlan,
                  isActive: false,
                  updatedAt: new Date().toISOString()
                }
              : packagePlan
          )
        ),
        updatedAt: new Date().toISOString()
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
    return updateClient(clientId, (client) => {
      const incompleteOnboardingPath = getNextIncompleteOnboardingPath(client);

      if (incompleteOnboardingPath) {
        throw new HttpError(409, 'Complete the required onboarding steps before finishing setup');
      }

      return {
        ...client,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      };
    });
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
        {
          ...commerce,
          ...buildProductCommerceView(syncedClient)
        }
      )
    };
  }
};

export const serializeClientForResponse = (client: ClientRecord): PublicClientRecord =>
  toPublicClientRecord(hydrateClientRecord(client));
