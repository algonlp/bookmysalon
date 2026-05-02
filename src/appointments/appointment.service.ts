import { randomUUID } from 'crypto';
import { appointmentRepository } from './appointment.repository';
import type {
  AppointmentPaymentBalance,
  AppointmentRunningLateInput,
  AppointmentRecord,
  AppointmentServiceOption,
  AppointmentSource,
  AppointmentTeamMemberOption,
  CreateAppointmentPaymentInput,
  CreateReviewInput,
  CreateAppointmentInput,
  CreateWaitlistInput,
  LoyaltyRewardRecord,
  NotificationDispatchResult,
  PaymentRecord,
  PaymentSnapshot,
  PackagePurchaseRecord,
  PublicBookingHistoryItem,
  PublicBookingPage,
  PublicBenefitOption,
  PublicManagedAppointment,
  PublicWaitlistOffer,
  ReviewRecord,
  ReviewSummary,
  RescheduleAppointmentInput,
  SellPackageInput,
  WaitlistRecord
} from './appointment.types';
import { clientPlatformRepository } from '../platform/clientPlatform.repository';
import { HttpError } from '../shared/errors/httpError';
import { twilioSmsService } from '../notifications/twilioSms.service';
import type { DashboardCommerceViewModel } from '../platform/clientPlatform.types';
import {
  createUtcDateFromTimeZone,
  formatDateValueInTimeZone,
  getTimeMinutesInTimeZone
} from '../shared/time';
import {
  createFallbackAppointmentService,
  normalizeBusinessServices,
  toAppointmentServiceOptions
} from '../platform/businessServices';
import {
  defaultBookingAddressRequiredMessage,
  defaultServiceLocation,
  getDefaultBookingServiceLocation,
  type ServiceLocation,
  serviceLocationRequiresAddress
} from '../platform/serviceLocation.constants';
import { env } from '../config/env';
import { billingService } from '../billing/billing.service';

const DEFAULT_SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const WEEKDAY_IDS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface OpenSlotContext {
  businessId: string;
  serviceId?: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  teamMemberId?: string;
  teamMemberName?: string;
  sourceAppointmentId?: string;
}

interface WaitlistOfferDispatch {
  waitlistEntryId: string;
  appointmentDate: string;
  appointmentTime: string;
  offerExpiresAt: string;
  claimLink: string;
  notification: NotificationDispatchResult;
}

const getBusinessOrThrow = async (businessId: string) => {
  const business = await clientPlatformRepository.getClientById(businessId);

  if (!business) {
    throw new HttpError(404, 'Business not found');
  }

  return business;
};

const getBusinessDisplayName = (
  business: Awaited<ReturnType<typeof getBusinessOrThrow>>
): string => {
  const businessName =
    typeof business.businessName === 'string' ? business.businessName.trim() : '';

  if (businessName) {
    return businessName;
  }

  const emailLabel =
    typeof business.email === 'string' ? business.email.split('@')[0]?.trim() ?? '' : '';

  return emailLabel || business.id;
};

const getAvailableBookingServiceLocations = (
  business: Awaited<ReturnType<typeof getBusinessOrThrow>>
): ServiceLocation[] =>
  Array.isArray(business.serviceLocation) && business.serviceLocation.length > 0
    ? business.serviceLocation
    : [defaultServiceLocation];

const getActiveTeamMembersForBusiness = (
  business: Awaited<ReturnType<typeof getBusinessOrThrow>>
): AppointmentTeamMemberOption[] => {
  const slotTimes = getBusinessSlotTimes(business);
  const openingTime = slotTimes[0] ?? '09:00';
  const closingTime = addMinutesToTimeValue(slotTimes[slotTimes.length - 1] ?? '17:00', 60);

  return (business.teamMembers ?? [])
    .filter((teamMember) => teamMember.isActive !== false)
    .map((teamMember) => ({
      id: teamMember.id,
      name: teamMember.name,
      role: teamMember.role,
      openingTime:
        typeof teamMember.openingTime === 'string' && /^\d{2}:\d{2}$/.test(teamMember.openingTime)
          ? teamMember.openingTime
          : openingTime,
      closingTime:
        typeof teamMember.closingTime === 'string' && /^\d{2}:\d{2}$/.test(teamMember.closingTime)
          ? teamMember.closingTime
          : closingTime,
      offDays: Array.isArray(teamMember.offDays) ? teamMember.offDays : []
    }));
};

const getBusinessServiceTemplateOptions = (
  business: Awaited<ReturnType<typeof getBusinessOrThrow>>
): {
  currencyCode: string;
  currencyLocale: string;
  useServiceTemplates: boolean;
} => ({
  currencyCode:
    business.businessSettings?.currencyCode?.trim() || env.DEFAULT_BUSINESS_CURRENCY_CODE,
  currencyLocale:
    business.businessSettings?.currencyLocale?.trim() || env.DEFAULT_BUSINESS_CURRENCY_LOCALE,
  useServiceTemplates: business.businessSettings?.useServiceTemplates !== false
});

const getBusinessSlotTimes = (business: Awaited<ReturnType<typeof getBusinessOrThrow>>): string[] => {
  const slotTimes = Array.isArray(business.businessSettings?.slotTimes)
    ? business.businessSettings.slotTimes.filter(
        (slotTime): slotTime is string => typeof slotTime === 'string' && slotTime.trim().length > 0
      )
    : [];

  return slotTimes.length > 0 ? slotTimes : DEFAULT_SLOT_TIMES;
};

function addMinutesToTimeValue(timeValue: string, minutesToAdd: number): string {
  const [hoursValue, minutesValue] = timeValue.split(':');
  const totalMinutes = Number(hoursValue) * 60 + Number(minutesValue) + minutesToAdd;
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const getServiceCatalogForBusiness = async (businessId: string): Promise<AppointmentServiceOption[]> => {
  const business = await getBusinessOrThrow(businessId);
  const configuredServices = normalizeBusinessServices(
    business.serviceTypes,
    business.services ?? [],
    getBusinessServiceTemplateOptions(business)
  );
  const activeServices = toAppointmentServiceOptions(configuredServices);

  if (activeServices.length > 0) {
    return activeServices;
  }

  if (configuredServices.length > 0) {
    return [];
  }

  return [createFallbackAppointmentService(business.serviceTypes[0], getBusinessServiceTemplateOptions(business))];
};

const listBusinessAppointments = async (businessId: string): Promise<AppointmentRecord[]> => {
  const appointments = await appointmentRepository.listAppointments();

  return appointments
    .filter((appointment) => appointment.businessId === businessId)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
};

const listBusinessPaymentRecords = async (businessId: string): Promise<PaymentRecord[]> => {
  const paymentRecords = await appointmentRepository.listPaymentRecords();

  return paymentRecords
    .filter((paymentRecord) => paymentRecord.businessId === businessId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const normalizePhoneLookup = (phoneValue: string): string =>
  phoneValue.replace(/[^\d]/g, '');

const normalizeEmailLookup = (emailValue: string): string =>
  typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';

const buildCustomerKey = (phoneValue: string, emailValue = ''): string =>
  normalizePhoneLookup(phoneValue) || normalizeEmailLookup(emailValue);

const parseMoneyValue = (
  priceLabel: string,
  fallbackCurrencyCode = ''
): { amountValue: number; currencyCode: string } => {
  if (typeof priceLabel !== 'string') {
    return {
      amountValue: 0,
      currencyCode: fallbackCurrencyCode
    };
  }

  const trimmedLabel = priceLabel.trim();
  const currencyMatch = trimmedLabel.match(/\b([A-Za-z]{3})\b/);
  const normalizedValue = Number(trimmedLabel.replace(/[^\d.]/g, ''));

  return {
    amountValue: Number.isFinite(normalizedValue) ? normalizedValue : 0,
    currencyCode: currencyMatch?.[1]?.toUpperCase() ?? fallbackCurrencyCode
  };
};

const normalizeAppointmentFinancials = (
  appointment: AppointmentRecord,
  servicesByName: Map<string, AppointmentServiceOption>,
  fallbackCurrencyCode = ''
): AppointmentRecord => {
  const matchedService = servicesByName.get(appointment.serviceName);
  const matchedMoney = parseMoneyValue(matchedService?.priceLabel ?? appointment.servicePriceLabel ?? '', fallbackCurrencyCode);
  const serviceMoney =
    Number.isFinite(appointment.serviceAmountValue) && Number(appointment.serviceAmountValue) >= 0
      ? {
          amountValue: Number(appointment.serviceAmountValue),
          currencyCode: appointment.currencyCode?.trim() || matchedMoney.currencyCode
        }
      : matchedMoney;

  return {
    ...appointment,
    servicePriceLabel:
      typeof appointment.servicePriceLabel === 'string' && appointment.servicePriceLabel.trim().length > 0
        ? appointment.servicePriceLabel
        : matchedService?.priceLabel ?? '',
    serviceAmountValue: serviceMoney.amountValue,
    currencyCode: serviceMoney.currencyCode
  };
};

const getPaymentNetAmount = (paymentRecord: PaymentRecord): number => {
  if (paymentRecord.status !== 'posted') {
    return 0;
  }

  return paymentRecord.entryType === 'refund' ? -paymentRecord.amountValue : paymentRecord.amountValue;
};

const hasPotentialFutureSlots = (appointmentDate: string, slotTimes: string[]): boolean =>
  slotTimes.some((slot) => !isPastSlot(appointmentDate, slot));

const clearWaitlistOfferState = (
  waitlistEntry: WaitlistRecord,
  status: WaitlistRecord['status'],
  updatedAt: string
): WaitlistRecord => ({
  ...waitlistEntry,
  status,
  offeredAppointmentDate: undefined,
  offeredAppointmentTime: undefined,
  offerSentAt: undefined,
  offerExpiresAt: undefined,
  offerClaimToken: undefined,
  updatedAt
});

const normalizeWaitlistStatus = (
  waitlistEntry: WaitlistRecord,
  slotTimes: string[],
  now = new Date()
): WaitlistRecord => {
  const nowIso = now.toISOString();
  const hasFutureSlots = hasPotentialFutureSlots(waitlistEntry.appointmentDate, slotTimes);

  if (!hasFutureSlots && !['claimed', 'removed'].includes(waitlistEntry.status)) {
    return clearWaitlistOfferState(waitlistEntry, 'expired', nowIso);
  }

  if (
    waitlistEntry.status === 'offered' &&
    waitlistEntry.offerExpiresAt &&
    new Date(waitlistEntry.offerExpiresAt).getTime() <= now.getTime()
  ) {
    return clearWaitlistOfferState(waitlistEntry, 'active', nowIso);
  }

  return waitlistEntry;
};

const normalizePackagePurchaseStatus = (
  packagePurchase: PackagePurchaseRecord,
  now = new Date()
): PackagePurchaseRecord => {
  const nowIso = now.toISOString();
  const isExpired =
    Boolean(packagePurchase.expiresAt) &&
    new Date(packagePurchase.expiresAt ?? '').getTime() <= now.getTime();

  if (packagePurchase.remainingUses <= 0) {
    return {
      ...packagePurchase,
      status: 'fully_used',
      updatedAt: nowIso
    };
  }

  if (isExpired) {
    return {
      ...packagePurchase,
      status: 'expired',
      updatedAt: nowIso
    };
  }

  return {
    ...packagePurchase,
    status: 'active',
    updatedAt: packagePurchase.updatedAt || nowIso
  };
};

const completeBookedAppointment = async (
  appointment: AppointmentRecord,
  completedAt = new Date().toISOString()
): Promise<AppointmentRecord> => {
  const completedAppointment: AppointmentRecord = {
    ...appointment,
    status: 'completed',
    updatedAt: completedAt
  };

  await appointmentRepository.saveAppointment(completedAppointment);
  await finalizeReservedLoyaltyReward(completedAppointment);
  await issueLoyaltyRewardForCompletedAppointment(completedAppointment);
  return completedAppointment;
};

const listBusinessPackagePurchases = async (
  businessId: string
): Promise<PackagePurchaseRecord[]> => {
  const now = new Date();
  const packagePurchases = (await appointmentRepository.listPackagePurchases())
    .filter((packagePurchase) => packagePurchase.businessId === businessId)
    .map((packagePurchase) => normalizePackagePurchaseStatus(packagePurchase, now));

  await Promise.all(
    packagePurchases.map(async (packagePurchase) => {
      const original = (await appointmentRepository.listPackagePurchases()).find(
        (entry) => entry.id === packagePurchase.id
      );

      if (
        original &&
        (original.status !== packagePurchase.status ||
          original.remainingUses !== packagePurchase.remainingUses ||
          original.updatedAt !== packagePurchase.updatedAt)
      ) {
        await appointmentRepository.savePackagePurchase(packagePurchase);
      }
    })
  );

  return packagePurchases.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const listBusinessWaitlistEntries = async (businessId: string): Promise<WaitlistRecord[]> => {
  const now = new Date();
  const business = await getBusinessOrThrow(businessId);
  const slotTimes = getBusinessSlotTimes(business);
  const waitlistEntries = (await appointmentRepository.listWaitlistEntries())
    .filter((waitlistEntry) => waitlistEntry.businessId === businessId)
    .map((waitlistEntry) => normalizeWaitlistStatus(waitlistEntry, slotTimes, now));

  await Promise.all(
    waitlistEntries.map(async (waitlistEntry) => {
      const original = (await appointmentRepository.listWaitlistEntries()).find(
        (entry) => entry.id === waitlistEntry.id
      );

      if (
        original &&
        (original.status !== waitlistEntry.status ||
          original.offeredAppointmentDate !== waitlistEntry.offeredAppointmentDate ||
          original.offeredAppointmentTime !== waitlistEntry.offeredAppointmentTime ||
          original.offerSentAt !== waitlistEntry.offerSentAt ||
          original.offerExpiresAt !== waitlistEntry.offerExpiresAt ||
          original.offerClaimToken !== waitlistEntry.offerClaimToken ||
          original.updatedAt !== waitlistEntry.updatedAt)
      ) {
        await appointmentRepository.saveWaitlistEntry(waitlistEntry);
      }
    })
  );

  return waitlistEntries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
};

const listBusinessLoyaltyRewards = async (businessId: string): Promise<LoyaltyRewardRecord[]> => {
  const loyaltyRewards = await appointmentRepository.listLoyaltyRewards();

  return loyaltyRewards
    .filter((loyaltyReward) => loyaltyReward.businessId === businessId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const finalizeReservedLoyaltyReward = async (appointment: AppointmentRecord): Promise<void> => {
  if (!appointment.loyaltyRewardId) {
    return;
  }

  const loyaltyRewards = await appointmentRepository.listLoyaltyRewards();
  const loyaltyReward = loyaltyRewards.find((entry) => entry.id === appointment.loyaltyRewardId);

  if (!loyaltyReward || loyaltyReward.status !== 'reserved') {
    return;
  }

  await appointmentRepository.saveLoyaltyReward({
    ...loyaltyReward,
    status: 'redeemed',
    reservedForAppointmentId: appointment.id,
    updatedAt: new Date().toISOString()
  });
};

const issueLoyaltyRewardForCompletedAppointment = async (
  appointment: AppointmentRecord
): Promise<void> => {
  const business = await getBusinessOrThrow(appointment.businessId);
  const loyaltyProgram = business.loyaltyProgram;

  if (!loyaltyProgram?.isEnabled) {
    return;
  }

  if (
    loyaltyProgram.includedServiceIds.length > 0 &&
    appointment.serviceId &&
    !loyaltyProgram.includedServiceIds.includes(appointment.serviceId)
  ) {
    return;
  }

  const customerKey = buildCustomerKey(appointment.customerPhone, appointment.customerEmail);

  if (!customerKey) {
    return;
  }

  const existingRewards = await listBusinessLoyaltyRewards(appointment.businessId);

  if (existingRewards.some((reward) => reward.earnedFromAppointmentId === appointment.id)) {
    return;
  }

  const appointments = await listBusinessAppointments(appointment.businessId);
  const completedVisits = appointments.filter(
    (entry) =>
      entry.status === 'completed' &&
      buildCustomerKey(entry.customerPhone, entry.customerEmail) === customerKey
  ).length;

  if (
    completedVisits === 0 ||
    completedVisits % loyaltyProgram.triggerCompletedVisits !== 0
  ) {
    return;
  }

  const now = new Date().toISOString();
  await appointmentRepository.saveLoyaltyReward({
    id: randomUUID(),
    businessId: appointment.businessId,
    customerKey,
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    customerEmail: appointment.customerEmail,
    rewardType: 'discount_percent',
    rewardValue: loyaltyProgram.rewardValue,
    includedServiceIds: loyaltyProgram.includedServiceIds,
    label: `${loyaltyProgram.rewardValue}% loyalty reward`,
    status: 'available',
    earnedFromAppointmentId: appointment.id,
    createdAt: now,
    updatedAt: now
  });
};

const normalizeBookedAppointments = async (
  businessId: string
): Promise<AppointmentRecord[]> => {
  const now = new Date();
  const appointments = await listBusinessAppointments(businessId);
  const normalizedAppointments = await Promise.all(
    appointments.map(async (appointment) => {
      if (appointment.status !== 'booked') {
        return appointment;
      }

      if (new Date(appointment.endAt).getTime() > now.getTime()) {
        return appointment;
      }

      return completeBookedAppointment(appointment, now.toISOString());
    })
  );

  return normalizedAppointments.sort((left, right) => left.startAt.localeCompare(right.startAt));
};

const normalizeAppointmentsForBusiness = async (
  businessId: string
): Promise<AppointmentRecord[]> => {
  const [appointments, services] = await Promise.all([
    normalizeBookedAppointments(businessId),
    getServiceCatalogForBusiness(businessId)
  ]);
  const servicesByName = new Map(services.map((service) => [service.name, service]));

  return appointments.map((appointment) =>
    normalizeAppointmentFinancials(appointment, servicesByName)
  );
};

const buildPaymentSnapshotForAppointments = (
  appointments: AppointmentRecord[],
  paymentRecords: PaymentRecord[]
): {
  summary: PaymentSnapshot;
  balances: AppointmentPaymentBalance[];
} => {
  const paymentsByAppointmentId = new Map<string, number>();

  for (const paymentRecord of paymentRecords) {
    const currentAmount = paymentsByAppointmentId.get(paymentRecord.appointmentId) ?? 0;
    paymentsByAppointmentId.set(
      paymentRecord.appointmentId,
      currentAmount + getPaymentNetAmount(paymentRecord)
    );
  }

  const balances = appointments
    .filter((appointment) => appointment.status !== 'cancelled')
    .map((appointment) => {
      const expectedAmountValue =
        Number.isFinite(appointment.serviceAmountValue) && Number(appointment.serviceAmountValue) >= 0
          ? Number(appointment.serviceAmountValue)
          : 0;
      const paidAmountValue = Math.max(0, paymentsByAppointmentId.get(appointment.id) ?? 0);
      const outstandingAmountValue = Math.max(0, expectedAmountValue - paidAmountValue);

      return {
        appointmentId: appointment.id,
        customerName: appointment.customerName,
        serviceName: appointment.serviceName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        currencyCode: appointment.currencyCode?.trim() ?? '',
        expectedAmountValue,
        paidAmountValue,
        outstandingAmountValue
      };
    })
    .sort((left, right) =>
      `${left.appointmentDate}T${left.appointmentTime}`.localeCompare(
        `${right.appointmentDate}T${right.appointmentTime}`
      )
    );

  const expectedAmountValue = balances.reduce(
    (sum, balance) => sum + balance.expectedAmountValue,
    0
  );
  const collectedAmountValue = paymentRecords.reduce(
    (sum, paymentRecord) => sum + getPaymentNetAmount(paymentRecord),
    0
  );
  const pendingAmountValue = balances.reduce(
    (sum, balance) => sum + balance.outstandingAmountValue,
    0
  );
  const overpaidAmountValue = balances.reduce((sum, balance) => {
    const overpaidAmount = balance.paidAmountValue - balance.expectedAmountValue;
    return sum + (overpaidAmount > 0 ? overpaidAmount : 0);
  }, 0);
  const currencyCode =
    balances.find((balance) => balance.currencyCode)?.currencyCode ??
    paymentRecords.find((paymentRecord) => paymentRecord.currencyCode)?.currencyCode ??
    '';

  return {
    summary: {
      currencyCode,
      expectedAmountValue,
      collectedAmountValue,
      pendingAmountValue,
      overpaidAmountValue,
      recordedPaymentsCount: paymentRecords.filter((paymentRecord) => paymentRecord.status === 'posted')
        .length,
      outstandingAppointmentsCount: balances.filter(
        (balance) => balance.outstandingAmountValue > 0
      ).length
    },
    balances
  };
};

const isPastSlot = (appointmentDate: string, slot: string): boolean => {
  const now = new Date();
  const today = formatDateValueInTimeZone(now, env.APP_TIMEZONE);

  if (appointmentDate < today) {
    return true;
  }

  if (appointmentDate > today) {
    return false;
  }

  return parseTimeToMinutes(slot) <= getTimeMinutesInTimeZone(now, env.APP_TIMEZONE);
};

const parseTimeToMinutes = (timeValue: string): number => {
  const [hoursValue, minutesValue] = timeValue.split(':');
  return Number(hoursValue) * 60 + Number(minutesValue);
};

const getDefaultSlotDurationMinutes = (slotTimes: string[]): number => {
  for (let index = 1; index < slotTimes.length; index += 1) {
    const currentMinutes = parseTimeToMinutes(slotTimes[index] ?? '');
    const previousMinutes = parseTimeToMinutes(slotTimes[index - 1] ?? '');
    const difference = currentMinutes - previousMinutes;

    if (Number.isFinite(difference) && difference > 0) {
      return difference;
    }
  }

  return 60;
};

const normalizeDurationMinutes = (durationMinutes: number, fallbackDurationMinutes: number): number =>
  Number.isFinite(durationMinutes) && durationMinutes > 0
    ? Math.round(durationMinutes)
    : fallbackDurationMinutes;

interface TimeRangeBlock {
  startMinutes: number;
  endMinutes: number;
}

const hasTimeRangeOverlap = (
  startTime: string,
  durationMinutes: number,
  blocks: TimeRangeBlock[]
): boolean => {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;

  return blocks.some(
    (block) => startMinutes < block.endMinutes && endMinutes > block.startMinutes
  );
};

const createTimeRangeBlock = (
  startTime: string,
  durationMinutes: number,
  fallbackDurationMinutes: number
): TimeRangeBlock => {
  const startMinutes = parseTimeToMinutes(startTime);
  const normalizedDurationMinutes = normalizeDurationMinutes(
    durationMinutes,
    fallbackDurationMinutes
  );

  return {
    startMinutes,
    endMinutes: startMinutes + normalizedDurationMinutes
  };
};

const addTimeRangeBlockToMap = (
  blockMap: Map<string, TimeRangeBlock[]>,
  mapKey: string,
  block: TimeRangeBlock
): void => {
  const blocks = blockMap.get(mapKey) ?? [];
  blocks.push(block);
  blockMap.set(mapKey, blocks);
};

const buildServiceDurationMaps = (
  services: AppointmentServiceOption[]
): {
  durationsById: Map<string, number>;
  durationsByName: Map<string, number>;
} => ({
  durationsById: new Map(
    services
      .filter((service) => typeof service.id === 'string' && service.id.trim().length > 0)
      .map((service) => [service.id, service.durationMinutes])
  ),
  durationsByName: new Map(
    services
      .filter((service) => typeof service.name === 'string' && service.name.trim().length > 0)
      .map((service) => [service.name, service.durationMinutes])
  )
});

const getIsoDurationMinutes = (startAt: string, endAt: string): number => {
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  const durationMinutes = Math.round((endTime - startTime) / (60 * 1000));

  return Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0;
};

const getServiceDurationMinutes = (
  serviceId: string | undefined,
  serviceName: string | undefined,
  durationMaps: ReturnType<typeof buildServiceDurationMaps>
): number =>
  (serviceId ? durationMaps.durationsById.get(serviceId) : undefined) ??
  (serviceName ? durationMaps.durationsByName.get(serviceName) : undefined) ??
  0;

const getAppointmentDurationMinutes = (
  appointment: AppointmentRecord,
  durationMaps: ReturnType<typeof buildServiceDurationMaps>,
  fallbackDurationMinutes: number
): number =>
  normalizeDurationMinutes(
    getIsoDurationMinutes(appointment.startAt, appointment.endAt) ||
      getServiceDurationMinutes(appointment.serviceId, appointment.serviceName, durationMaps),
    fallbackDurationMinutes
  );

const getWaitlistDurationMinutes = (
  waitlistEntry: WaitlistRecord,
  durationMaps: ReturnType<typeof buildServiceDurationMaps>,
  fallbackDurationMinutes: number
): number =>
  normalizeDurationMinutes(
    getServiceDurationMinutes(waitlistEntry.serviceId, waitlistEntry.serviceName, durationMaps),
    fallbackDurationMinutes
  );

const getWeekdayIdForAppointmentDate = (appointmentDate: string): string =>
  WEEKDAY_IDS[new Date(`${appointmentDate}T00:00:00`).getDay()] ?? 'sunday';

const isTeamMemberWorkingTimeRange = (
  teamMember: AppointmentTeamMemberOption,
  appointmentDate: string,
  slot: string,
  durationMinutes: number
): boolean => {
  const weekdayId = getWeekdayIdForAppointmentDate(appointmentDate);
  const offDays = Array.isArray(teamMember.offDays) ? teamMember.offDays : [];

  if (offDays.includes(weekdayId)) {
    return false;
  }

  const slotStartMinutes = parseTimeToMinutes(slot);
  const slotEndMinutes = slotStartMinutes + durationMinutes;
  const openingMinutes = parseTimeToMinutes(teamMember.openingTime);
  const closingMinutes = parseTimeToMinutes(teamMember.closingTime);

  return slotStartMinutes >= openingMinutes && slotEndMinutes <= closingMinutes;
};

const createSlotBlockSets = (
  appointmentDate: string,
  appointments: AppointmentRecord[],
  waitlistEntries: WaitlistRecord[],
  services: AppointmentServiceOption[],
  fallbackDurationMinutes: number,
  excludeAppointmentId = '',
  waitlistClaim: WaitlistRecord | null = null
): {
  globalBookedRanges: TimeRangeBlock[];
  bookedRangesByTeamMemberId: Map<string, TimeRangeBlock[]>;
  globalReservedOfferRanges: TimeRangeBlock[];
  reservedOfferRangesByTeamMemberId: Map<string, TimeRangeBlock[]>;
} => {
  const durationMaps = buildServiceDurationMaps(services);
  const globalBookedRanges: TimeRangeBlock[] = [];
  const bookedRangesByTeamMemberId = new Map<string, TimeRangeBlock[]>();
  const globalReservedOfferRanges: TimeRangeBlock[] = [];
  const reservedOfferRangesByTeamMemberId = new Map<string, TimeRangeBlock[]>();

  for (const appointment of appointments) {
    if (
      appointment.appointmentDate !== appointmentDate ||
      appointment.status !== 'booked' ||
      appointment.id === excludeAppointmentId
    ) {
      continue;
    }

    const appointmentBlock = createTimeRangeBlock(
      appointment.appointmentTime,
      getAppointmentDurationMinutes(appointment, durationMaps, fallbackDurationMinutes),
      fallbackDurationMinutes
    );

    if (appointment.teamMemberId) {
      addTimeRangeBlockToMap(
        bookedRangesByTeamMemberId,
        appointment.teamMemberId,
        appointmentBlock
      );
      continue;
    }

    globalBookedRanges.push(appointmentBlock);
  }

  for (const waitlistEntry of waitlistEntries) {
    if (
      waitlistEntry.status !== 'offered' ||
      waitlistEntry.offeredAppointmentDate !== appointmentDate ||
      !waitlistEntry.offeredAppointmentTime ||
      (waitlistClaim && waitlistEntry.id === waitlistClaim.id)
    ) {
      continue;
    }

    const waitlistBlock = createTimeRangeBlock(
      waitlistEntry.offeredAppointmentTime,
      getWaitlistDurationMinutes(waitlistEntry, durationMaps, fallbackDurationMinutes),
      fallbackDurationMinutes
    );

    if (waitlistEntry.teamMemberId) {
      addTimeRangeBlockToMap(
        reservedOfferRangesByTeamMemberId,
        waitlistEntry.teamMemberId,
        waitlistBlock
      );
      continue;
    }

    globalReservedOfferRanges.push(waitlistBlock);
  }

  return {
    globalBookedRanges,
    bookedRangesByTeamMemberId,
    globalReservedOfferRanges,
    reservedOfferRangesByTeamMemberId
  };
};

const isSlotAvailableForTeamMember = (
  slot: string,
  durationMinutes: number,
  teamMemberId: string,
  slotBlocks: ReturnType<typeof createSlotBlockSets>
): boolean =>
  !hasTimeRangeOverlap(slot, durationMinutes, slotBlocks.globalBookedRanges) &&
  !hasTimeRangeOverlap(slot, durationMinutes, slotBlocks.globalReservedOfferRanges) &&
  !hasTimeRangeOverlap(
    slot,
    durationMinutes,
    slotBlocks.bookedRangesByTeamMemberId.get(teamMemberId) ?? []
  ) &&
  !hasTimeRangeOverlap(
    slot,
    durationMinutes,
    slotBlocks.reservedOfferRangesByTeamMemberId.get(teamMemberId) ?? []
  );

const findAvailableTeamMemberForSlot = (
  slot: string,
  appointmentDate: string,
  durationMinutes: number,
  teamMembers: AppointmentTeamMemberOption[],
  slotBlocks: ReturnType<typeof createSlotBlockSets>
): AppointmentTeamMemberOption | undefined =>
  teamMembers.find(
    (teamMember) =>
      isTeamMemberWorkingTimeRange(teamMember, appointmentDate, slot, durationMinutes) &&
      isSlotAvailableForTeamMember(slot, durationMinutes, teamMember.id, slotBlocks)
  );

const listAvailableSlotsForBooking = async (
  businessId: string,
  appointmentDate: string,
  excludeAppointmentId = '',
  waitlistClaim: WaitlistRecord | null = null,
  teamMemberId = '',
  serviceName = ''
): Promise<string[]> => {
  const business = await getBusinessOrThrow(businessId);
  const slotTimes = getBusinessSlotTimes(business);
  const fallbackDurationMinutes = getDefaultSlotDurationMinutes(slotTimes);
  const teamMembers = getActiveTeamMembersForBusiness(business);
  const services = await getServiceCatalogForBusiness(businessId);
  const [appointments, waitlistEntries] = await Promise.all([
    normalizeBookedAppointments(businessId),
    listBusinessWaitlistEntries(businessId)
  ]);
  const selectedServiceDurationMinutes = normalizeDurationMinutes(
    services.find((service) => service.name === serviceName)?.durationMinutes ??
      services.find((service) => service.name === waitlistClaim?.serviceName)?.durationMinutes ??
      0,
    fallbackDurationMinutes
  );
  const slotBlocks = createSlotBlockSets(
    appointmentDate,
    appointments,
    waitlistEntries,
    services,
    fallbackDurationMinutes,
    excludeAppointmentId,
    waitlistClaim
  );

  if (teamMemberId) {
    const selectedTeamMember = teamMembers.find((teamMember) => teamMember.id === teamMemberId);

    if (!selectedTeamMember) {
      return [];
    }

    return slotTimes.filter(
      (slot) =>
        !isPastSlot(appointmentDate, slot) &&
        isTeamMemberWorkingTimeRange(
          selectedTeamMember,
          appointmentDate,
          slot,
          selectedServiceDurationMinutes
        ) &&
        isSlotAvailableForTeamMember(
          slot,
          selectedServiceDurationMinutes,
          teamMemberId,
          slotBlocks
        )
    );
  }

  if (teamMembers.length > 0) {
    return slotTimes.filter(
      (slot) =>
        !isPastSlot(appointmentDate, slot) &&
        Boolean(
          findAvailableTeamMemberForSlot(
            slot,
            appointmentDate,
            selectedServiceDurationMinutes,
            teamMembers,
            slotBlocks
          )
        )
    );
  }

  return slotTimes.filter(
    (slot) =>
      !hasTimeRangeOverlap(slot, selectedServiceDurationMinutes, slotBlocks.globalBookedRanges) &&
      !hasTimeRangeOverlap(
        slot,
        selectedServiceDurationMinutes,
        slotBlocks.globalReservedOfferRanges
      ) &&
      !isPastSlot(appointmentDate, slot)
  );
};

const formatSmsDate = (appointmentDate: string, appointmentTime: string): string => {
  return `${appointmentDate} at ${appointmentTime}`;
};

const listBusinessReviews = async (businessId: string): Promise<ReviewRecord[]> => {
  const reviews = await appointmentRepository.listReviews();

  return reviews
    .filter((review) => review.businessId === businessId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

const buildReviewSummary = (reviews: ReviewRecord[]): ReviewSummary => {
  if (reviews.length === 0) {
    return {
      averageRating: null,
      totalReviews: 0
    };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    averageRating: Number((total / reviews.length).toFixed(1)),
    totalReviews: reviews.length
  };
};

const buildAppointmentManagementLink = (
  appointment: AppointmentRecord,
  origin: string,
  action = ''
): string => {
  const baseLink = `${origin}/book/${encodeURIComponent(appointment.businessId)}/manage/${encodeURIComponent(appointment.id)}`;
  const publicAccessToken = appointment.publicAccessToken?.trim();

  if (!publicAccessToken) {
    throw new HttpError(409, 'Appointment access token is not available');
  }

  const searchParams = new URLSearchParams({
    accessToken: publicAccessToken
  });

  if (action) {
    searchParams.set('action', action);
  }

  return `${baseLink}?${searchParams.toString()}`;
};

const buildWaitlistClaimLink = (waitlistEntry: WaitlistRecord, origin: string): string => {
  if (!waitlistEntry.offerClaimToken) {
    throw new HttpError(409, 'Waitlist offer is not currently active');
  }

  const searchParams = new URLSearchParams({
    waitlistEntryId: waitlistEntry.id,
    waitlistOfferToken: waitlistEntry.offerClaimToken
  });

  return `${origin}/book/${encodeURIComponent(waitlistEntry.businessId)}?${searchParams.toString()}`;
};

const toPublicWaitlistOffer = (waitlistEntry: WaitlistRecord): PublicWaitlistOffer | null => {
  if (
    waitlistEntry.status !== 'offered' ||
    !waitlistEntry.offeredAppointmentDate ||
    !waitlistEntry.offeredAppointmentTime ||
    !waitlistEntry.offerExpiresAt
  ) {
    return null;
  }

  return {
    waitlistEntryId: waitlistEntry.id,
    serviceName: waitlistEntry.serviceName,
    teamMemberId: waitlistEntry.teamMemberId,
    teamMemberName: waitlistEntry.teamMemberName,
    appointmentDate: waitlistEntry.offeredAppointmentDate,
    appointmentTime: waitlistEntry.offeredAppointmentTime,
    offerExpiresAt: waitlistEntry.offerExpiresAt
  };
};

const getActiveWaitlistClaim = async (
  businessId: string,
  waitlistEntryId = '',
  waitlistOfferToken = ''
): Promise<WaitlistRecord | null> => {
  if (!waitlistEntryId || !waitlistOfferToken) {
    return null;
  }

  const waitlistEntries = await listBusinessWaitlistEntries(businessId);
  const waitlistEntry = waitlistEntries.find((entry) => entry.id === waitlistEntryId);

  if (!waitlistEntry) {
    return null;
  }

  if (
    waitlistEntry.status !== 'offered' ||
    waitlistEntry.offerClaimToken !== waitlistOfferToken ||
    !waitlistEntry.offerExpiresAt ||
    new Date(waitlistEntry.offerExpiresAt).getTime() <= Date.now()
  ) {
    return null;
  }

  return waitlistEntry;
};

const getAppointmentOrThrow = async (
  businessId: string,
  appointmentId: string
): Promise<AppointmentRecord> => {
  await getBusinessOrThrow(businessId);
  const appointments = await normalizeBookedAppointments(businessId);
  const appointment = appointments.find((entry) => entry.id === appointmentId);

  if (!appointment) {
    throw new HttpError(404, 'Appointment was not found');
  }

  if (!appointment.publicAccessToken) {
    const securedAppointment: AppointmentRecord = {
      ...appointment,
      publicAccessToken: randomUUID(),
      updatedAt: new Date().toISOString()
    };

    await appointmentRepository.saveAppointment(securedAppointment);
    return securedAppointment;
  }

  return appointment;
};

const validatePublicAppointmentAccess = async (
  businessId: string,
  appointmentId: string,
  accessToken: string
): Promise<AppointmentRecord> => {
  const appointment = await getAppointmentOrThrow(businessId, appointmentId);

  if (!accessToken.trim() || appointment.publicAccessToken !== accessToken.trim()) {
    throw new HttpError(403, 'Valid appointment access is required');
  }

  return appointment;
};

const toPublicManagedAppointment = (appointment: AppointmentRecord): PublicManagedAppointment => ({
  id: appointment.id,
  businessId: appointment.businessId,
  businessName: appointment.businessName,
  serviceName: appointment.serviceName,
  teamMemberName: appointment.teamMemberName,
  customerName: appointment.customerName,
  appointmentDate: appointment.appointmentDate,
  appointmentTime: appointment.appointmentTime,
  status: appointment.status,
  bookingLink: `/book/${appointment.businessId}`
});

const matchesWaitlistEntryForOpenSlot = (
  waitlistEntry: WaitlistRecord,
  openSlot: OpenSlotContext
): boolean => {
  if (waitlistEntry.status !== 'active') {
    return false;
  }

  if (waitlistEntry.appointmentDate !== openSlot.appointmentDate) {
    return false;
  }

  if (waitlistEntry.serviceId && openSlot.serviceId && waitlistEntry.serviceId !== openSlot.serviceId) {
    return false;
  }

  if (!waitlistEntry.serviceId && waitlistEntry.serviceName !== openSlot.serviceName) {
    return false;
  }

  if (waitlistEntry.preferredTime && waitlistEntry.preferredTime !== openSlot.appointmentTime) {
    return false;
  }

  if (waitlistEntry.teamMemberId && waitlistEntry.teamMemberId !== openSlot.teamMemberId) {
    return false;
  }

  return true;
};

const sendWaitlistOfferNotification = async (
  waitlistEntry: WaitlistRecord,
  origin: string
): Promise<NotificationDispatchResult> => {
  if (
    waitlistEntry.status !== 'offered' ||
    !waitlistEntry.offeredAppointmentDate ||
    !waitlistEntry.offeredAppointmentTime ||
    !waitlistEntry.offerExpiresAt
  ) {
    return {
      recipient: 'customer',
      channel: 'sms',
      status: 'skipped',
      reason: 'Waitlist offer is not active'
    };
  }

  const expiresInMinutes = Math.max(
    1,
    Math.ceil(
      (new Date(waitlistEntry.offerExpiresAt).getTime() - Date.now()) / (60 * 1000)
    )
  );
  const claimLink = buildWaitlistClaimLink(waitlistEntry, origin);
  const message =
    `A slot opened up at ${waitlistEntry.serviceName ? waitlistEntry.serviceName : 'the salon'} for ` +
    `${formatSmsDate(waitlistEntry.offeredAppointmentDate, waitlistEntry.offeredAppointmentTime)}.` +
    `${waitlistEntry.teamMemberName ? ` Team member: ${waitlistEntry.teamMemberName}.` : ''} ` +
    `Book it here within ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}: ${claimLink}`;

  return twilioSmsService.sendSms(waitlistEntry.customerPhone, message, 'customer', {
    businessId: waitlistEntry.businessId,
    waitlistEntryId: waitlistEntry.id,
    source: 'waitlist_offer'
  });
};

const offerWaitlistEntryForOpenSlot = async (
  waitlistEntry: WaitlistRecord,
  openSlot: OpenSlotContext,
  origin: string
): Promise<WaitlistOfferDispatch> => {
  const now = new Date();
  const offeredWaitlistEntry: WaitlistRecord = {
    ...waitlistEntry,
    status: 'offered',
    offeredAppointmentDate: openSlot.appointmentDate,
    offeredAppointmentTime: openSlot.appointmentTime,
    offerSentAt: now.toISOString(),
    offerExpiresAt: new Date(
      now.getTime() + env.WAITLIST_OFFER_WINDOW_MINUTES * 60 * 1000
    ).toISOString(),
    offerClaimToken: randomUUID(),
    updatedAt: now.toISOString()
  };

  await appointmentRepository.saveWaitlistEntry(offeredWaitlistEntry);
  const notification = await sendWaitlistOfferNotification(offeredWaitlistEntry, origin);

  return {
    waitlistEntryId: offeredWaitlistEntry.id,
    appointmentDate: openSlot.appointmentDate,
    appointmentTime: openSlot.appointmentTime,
    offerExpiresAt: offeredWaitlistEntry.offerExpiresAt as string,
    claimLink: buildWaitlistClaimLink(offeredWaitlistEntry, origin),
    notification
  };
};

const processWaitlistForOpenSlot = async (
  openSlot: OpenSlotContext,
  origin: string
): Promise<WaitlistOfferDispatch[]> => {
  const waitlistEntries = await listBusinessWaitlistEntries(openSlot.businessId);
  const matchingWaitlistEntry = waitlistEntries.find((waitlistEntry) =>
    matchesWaitlistEntryForOpenSlot(waitlistEntry, openSlot)
  );

  if (!matchingWaitlistEntry) {
    return [];
  }

  return [await offerWaitlistEntryForOpenSlot(matchingWaitlistEntry, openSlot, origin)];
};

const sendAppointmentConfirmationNotification = async (
  appointment: AppointmentRecord,
  origin: string,
  mode: 'booked' | 'rescheduled' = 'booked'
): Promise<NotificationDispatchResult[]> => {
  const manageLink = buildAppointmentManagementLink(appointment, origin);
  const statusLabel = mode === 'rescheduled' ? 'has been rescheduled' : 'is confirmed';
  const customerMessage =
    `Your appointment at ${appointment.businessName} ${statusLabel} for ` +
    `${formatSmsDate(appointment.appointmentDate, appointment.appointmentTime)}. ` +
    `Service: ${appointment.serviceName}. Ref: ${appointment.id.slice(0, 8)}. ` +
    `Open your live booking link for the countdown and updates: ${manageLink}`;

  return Promise.all([
    twilioSmsService.sendSms(appointment.customerPhone, customerMessage, 'customer', {
      appointmentId: appointment.id,
      businessId: appointment.businessId,
      source: mode === 'rescheduled' ? 'appointment_rescheduled' : 'appointment_confirmation'
    })
  ]);
};

const sendRunningLateNotification = async (
  appointment: AppointmentRecord,
  origin: string,
  input: AppointmentRunningLateInput = {}
): Promise<NotificationDispatchResult[]> => {
  const manageLink = buildAppointmentManagementLink(appointment, origin);
  const normalizedDelayMinutes =
    Number.isFinite(input.delayMinutes) && Number(input.delayMinutes) > 0
      ? Math.floor(Number(input.delayMinutes))
      : 0;
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  const delayCopy =
    normalizedDelayMinutes > 0
      ? ` We expect to be about ${normalizedDelayMinutes} minute${normalizedDelayMinutes === 1 ? '' : 's'} late.`
      : ' We are running a little late.';
  const noteCopy = note ? ` Note: ${note}.` : '';
  const customerMessage =
    `Update from ${appointment.businessName}: your ${appointment.serviceName} appointment scheduled for ` +
    `${formatSmsDate(appointment.appointmentDate, appointment.appointmentTime)} is delayed.` +
    `${delayCopy}${noteCopy} Open your live booking link for the countdown or to adjust the booking: ${manageLink}`;

  return Promise.all([
    twilioSmsService.sendSms(appointment.customerPhone, customerMessage, 'customer', {
      appointmentId: appointment.id,
      businessId: appointment.businessId,
      source: 'running_late'
    })
  ]);
};

export const appointmentService = {
  getServiceCatalogForBusiness,

  async getBookingUrl(
    businessId: string,
    origin: string,
    source: AppointmentSource = 'direct'
  ): Promise<string> {
    await getBusinessOrThrow(businessId);
    const bookingUrl = `${origin}/book/${businessId}`;
    return source === 'direct'
      ? bookingUrl
      : `${bookingUrl}?source=${encodeURIComponent(source)}`;
  },

  async getPublicBookingPage(businessId: string): Promise<PublicBookingPage> {
    return this.getPublicBookingPageWithWaitlistClaim(businessId);
  },

  async getPublicBookingPageWithWaitlistClaim(
    businessId: string,
    waitlistEntryId = '',
    waitlistOfferToken = ''
  ): Promise<PublicBookingPage> {
    const business = await getBusinessOrThrow(businessId);
    const services = await getServiceCatalogForBusiness(businessId);
    const reviews = await listBusinessReviews(businessId);
    const teamMembers = getActiveTeamMembersForBusiness(business);
    const waitlistOffer = await getActiveWaitlistClaim(
      businessId,
      waitlistEntryId,
      waitlistOfferToken
    );

    return {
      businessId: business.id,
      businessName: getBusinessDisplayName(business),
      businessPhoneNumber: business.businessPhoneNumber ?? '',
      website: business.website ?? '',
      venueAddress: business.venueAddress ?? '',
      serviceTypes: business.serviceTypes,
      serviceLocations: getAvailableBookingServiceLocations(business),
      services,
      teamMembers,
      bookingLink: `/book/${business.id}`,
      reviews: reviews.slice(0, 5),
      reviewSummary: buildReviewSummary(reviews),
      waitlistOffer: waitlistOffer ? toPublicWaitlistOffer(waitlistOffer) : null
    };
  },

  async getAvailableSlots(
    businessId: string,
    appointmentDate: string,
    excludeAppointmentId = '',
    waitlistEntryId = '',
    waitlistOfferToken = '',
    appointmentAccessToken = '',
    teamMemberId = '',
    serviceName = ''
  ): Promise<{ slots: string[] }> {
    await getBusinessOrThrow(businessId);
    const activeWaitlistClaim = await getActiveWaitlistClaim(
      businessId,
      waitlistEntryId,
      waitlistOfferToken
    );

    if (excludeAppointmentId) {
      await validatePublicAppointmentAccess(
        businessId,
        excludeAppointmentId,
        appointmentAccessToken
      );
    }

    return {
      slots: await listAvailableSlotsForBooking(
        businessId,
        appointmentDate,
        excludeAppointmentId,
        activeWaitlistClaim,
        teamMemberId,
        serviceName
      )
    };
  },

  async getPlatformAvailableSlots(
    businessId: string,
    appointmentDate: string,
    excludeAppointmentId = '',
    teamMemberId = '',
    serviceName = ''
  ): Promise<{ slots: string[] }> {
    await getBusinessOrThrow(businessId);

    return {
      slots: await listAvailableSlotsForBooking(
        businessId,
        appointmentDate,
        excludeAppointmentId,
        null,
        teamMemberId,
        serviceName
      )
    };
  },

  async getPublicAppointmentManagement(
    businessId: string,
    appointmentId: string,
    accessToken: string
  ): Promise<{
    appointment: PublicManagedAppointment;
    slots: string[];
  }> {
    const appointment = await validatePublicAppointmentAccess(
      businessId,
      appointmentId,
      accessToken
    );

    return {
      appointment: toPublicManagedAppointment(appointment),
      slots:
        appointment.status === 'booked'
          ? await listAvailableSlotsForBooking(
              businessId,
              appointment.appointmentDate,
              appointment.id,
              null,
              appointment.teamMemberId ?? '',
              appointment.serviceName
            )
          : []
    };
  },

  async createWaitlistEntry(
    businessId: string,
    input: CreateWaitlistInput
  ): Promise<{
    waitlistEntry: WaitlistRecord;
  }> {
    const business = await getBusinessOrThrow(businessId);
    const services = await getServiceCatalogForBusiness(businessId);
    const teamMembers = getActiveTeamMembersForBusiness(business);
    const selectedService = services.find((service) => service.name === input.serviceName);
    const selectedTeamMember = input.teamMemberId
      ? teamMembers.find((teamMember) => teamMember.id === input.teamMemberId)
      : undefined;

    if (!selectedService) {
      throw new HttpError(400, 'Selected service is not available');
    }

    if (input.teamMemberId && !selectedTeamMember) {
      throw new HttpError(400, 'Selected barber is not available');
    }

    if (!hasPotentialFutureSlots(input.appointmentDate, getBusinessSlotTimes(business))) {
      throw new HttpError(409, 'Waitlist requests must use a future appointment date');
    }

    if (input.preferredTime && isPastSlot(input.appointmentDate, input.preferredTime)) {
      throw new HttpError(409, 'Preferred time must be in the future');
    }

    const availableSlots = await listAvailableSlotsForBooking(
      businessId,
      input.appointmentDate,
      '',
      null,
      selectedTeamMember?.id ?? ''
    );

    if (input.preferredTime && availableSlots.includes(input.preferredTime)) {
      throw new HttpError(409, 'That time is already available to book right now');
    }

    if (!input.preferredTime && availableSlots.length > 0) {
      throw new HttpError(409, 'Slots are already available for that date');
    }

    const customerPhone = input.customerPhone.trim();
    const customerEmail = input.customerEmail?.trim() ?? '';
    const customerKey = buildCustomerKey(customerPhone, customerEmail);

    if (!customerKey) {
      throw new HttpError(400, 'Customer phone or email is required');
    }

    const existingWaitlistEntries = await listBusinessWaitlistEntries(businessId);
    const duplicateWaitlistEntry = existingWaitlistEntries.find(
      (waitlistEntry) =>
        ['active', 'offered'].includes(waitlistEntry.status) &&
        waitlistEntry.customerKey === customerKey &&
        waitlistEntry.serviceName === selectedService.name &&
        waitlistEntry.appointmentDate === input.appointmentDate &&
        (waitlistEntry.teamMemberId ?? '') === (selectedTeamMember?.id ?? '') &&
        (waitlistEntry.preferredTime ?? '') === (input.preferredTime?.trim() ?? '')
    );

    if (duplicateWaitlistEntry) {
      throw new HttpError(409, 'A matching waitlist request already exists');
    }

    const now = new Date().toISOString();
    const waitlistEntry: WaitlistRecord = {
      id: randomUUID(),
      businessId,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      teamMemberId: selectedTeamMember?.id,
      teamMemberName: selectedTeamMember?.name,
      appointmentDate: input.appointmentDate,
      preferredTime: input.preferredTime?.trim() || undefined,
      customerKey,
      customerName: input.customerName.trim(),
      customerPhone,
      customerEmail,
      source: input.source ?? 'direct',
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    await appointmentRepository.saveWaitlistEntry(waitlistEntry);

    return {
      waitlistEntry
    };
  },

  async listPublicBookingHistoryByPhone(
    businessId: string,
    customerPhone: string
  ): Promise<{ history: PublicBookingHistoryItem[] }> {
    await getBusinessOrThrow(businessId);

    if (!env.ENABLE_PUBLIC_CUSTOMER_LOOKUPS) {
      return { history: [] };
    }

    const normalizedPhone = normalizePhoneLookup(customerPhone.trim());

    if (!normalizedPhone) {
      return { history: [] };
    }

    const appointments = await normalizeBookedAppointments(businessId);
    const history = appointments
      .filter(
        (appointment) => normalizePhoneLookup(appointment.customerPhone) === normalizedPhone
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 5)
      .map((appointment) => ({
        reference: appointment.id.slice(0, 8),
        serviceName: appointment.serviceName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        customerName: appointment.customerName,
        customerEmail: appointment.customerEmail,
        packageName: appointment.packageName,
        loyaltyRewardLabel: appointment.loyaltyRewardLabel,
        createdAt: appointment.createdAt
      }));

    return { history };
  },

  async createAppointment(
    businessId: string,
    input: CreateAppointmentInput,
    origin: string
  ): Promise<{
    appointment: AppointmentRecord;
    notifications: NotificationDispatchResult[];
    publicAccessToken: string;
    manageLink: string;
  }> {
    const business = await getBusinessOrThrow(businessId);
    const services = await getServiceCatalogForBusiness(businessId);
    const teamMembers = getActiveTeamMembersForBusiness(business);
    const availableServiceLocations = getAvailableBookingServiceLocations(business);
    const selectedService = services.find((service) => service.name === input.serviceName);
    const selectedTeamMember = input.teamMemberId
      ? teamMembers.find((teamMember) => teamMember.id === input.teamMemberId)
      : undefined;
    const selectedServiceLocation =
      input.serviceLocation && availableServiceLocations.includes(input.serviceLocation)
        ? input.serviceLocation
        : getDefaultBookingServiceLocation(availableServiceLocations);
    const activeWaitlistClaim = await getActiveWaitlistClaim(
      businessId,
      input.waitlistEntryId?.trim() ?? '',
      input.waitlistOfferToken?.trim() ?? ''
    );

    if (!selectedService) {
      throw new HttpError(400, 'Selected service is not available');
    }

    if (!availableServiceLocations.includes(selectedServiceLocation)) {
      throw new HttpError(400, 'Selected service location is not available');
    }

    if (
      serviceLocationRequiresAddress(selectedServiceLocation) &&
      !input.customerAddress?.trim()
    ) {
      throw new HttpError(400, defaultBookingAddressRequiredMessage);
    }

    if (input.teamMemberId && !selectedTeamMember) {
      throw new HttpError(400, 'Selected barber is not available');
    }

    const availableSlots = await listAvailableSlotsForBooking(
      businessId,
      input.appointmentDate,
      '',
      activeWaitlistClaim,
      selectedTeamMember?.id ?? '',
      selectedService.name
    );

    if (!availableSlots.includes(input.appointmentTime)) {
      throw new HttpError(409, 'Selected appointment time is no longer available');
    }

    if (input.packagePurchaseId && input.loyaltyRewardId) {
      throw new HttpError(400, 'Choose either a package or a loyalty reward');
    }

    const startAt = createUtcDateFromTimeZone(
      input.appointmentDate,
      input.appointmentTime,
      env.APP_TIMEZONE
    ).toISOString();
    const endAt = new Date(
      new Date(startAt).getTime() + selectedService.durationMinutes * 60 * 1000
    ).toISOString();
    const serviceMoney = parseMoneyValue(selectedService.priceLabel);
    const now = new Date().toISOString();
    const customerPhone = input.customerPhone.trim();
    const customerEmail = input.customerEmail?.trim() ?? '';
    const customerKey = buildCustomerKey(customerPhone, customerEmail);
    let updatedPackagePurchase: PackagePurchaseRecord | null = null;
    let updatedLoyaltyReward: LoyaltyRewardRecord | null = null;

    if (activeWaitlistClaim) {
      if (
        activeWaitlistClaim.serviceName !== selectedService.name ||
        activeWaitlistClaim.offeredAppointmentDate !== input.appointmentDate ||
        activeWaitlistClaim.offeredAppointmentTime !== input.appointmentTime
      ) {
        throw new HttpError(409, 'This waitlist offer only applies to the reserved slot');
      }

      if (activeWaitlistClaim.customerKey !== customerKey) {
        throw new HttpError(409, 'This waitlist offer belongs to a different customer');
      }
    }

    if (input.packagePurchaseId) {
      const packagePurchases = await listBusinessPackagePurchases(businessId);
      const matchedPackagePurchase = packagePurchases.find(
        (packagePurchase) => packagePurchase.id === input.packagePurchaseId
      );

      if (!matchedPackagePurchase) {
        throw new HttpError(404, 'Package was not found');
      }

      if (matchedPackagePurchase.customerKey !== customerKey) {
        throw new HttpError(409, 'This package belongs to a different customer');
      }

      if (matchedPackagePurchase.status !== 'active' || matchedPackagePurchase.remainingUses <= 0) {
        throw new HttpError(409, 'This package no longer has active uses');
      }

      if (
        matchedPackagePurchase.includedServiceIds.length > 0 &&
        !matchedPackagePurchase.includedServiceIds.includes(selectedService.id)
      ) {
        throw new HttpError(409, 'This package does not cover the selected service');
      }

      updatedPackagePurchase = normalizePackagePurchaseStatus(
        {
          ...matchedPackagePurchase,
          remainingUses: matchedPackagePurchase.remainingUses - 1,
          updatedAt: now
        },
        new Date(now)
      );
    }

    if (input.loyaltyRewardId) {
      const loyaltyRewards = await listBusinessLoyaltyRewards(businessId);
      const matchedLoyaltyReward = loyaltyRewards.find(
        (loyaltyReward) => loyaltyReward.id === input.loyaltyRewardId
      );

      if (!matchedLoyaltyReward) {
        throw new HttpError(404, 'Loyalty reward was not found');
      }

      if (matchedLoyaltyReward.customerKey !== customerKey) {
        throw new HttpError(409, 'This loyalty reward belongs to a different customer');
      }

      if (matchedLoyaltyReward.status !== 'available') {
        throw new HttpError(409, 'This loyalty reward is no longer available');
      }

      if (
        matchedLoyaltyReward.includedServiceIds.length > 0 &&
        !matchedLoyaltyReward.includedServiceIds.includes(selectedService.id)
      ) {
        throw new HttpError(409, 'This loyalty reward does not apply to the selected service');
      }

      updatedLoyaltyReward = {
        ...matchedLoyaltyReward,
        status: 'reserved',
        updatedAt: now
      };
    }

    const slotBlocks = createSlotBlockSets(
      input.appointmentDate,
      await normalizeBookedAppointments(businessId),
      await listBusinessWaitlistEntries(businessId),
      services,
      getDefaultSlotDurationMinutes(getBusinessSlotTimes(business)),
      '',
      activeWaitlistClaim
    );
    const assignedTeamMember =
      selectedTeamMember ||
      (activeWaitlistClaim?.teamMemberId
        ? teamMembers.find((teamMember) => teamMember.id === activeWaitlistClaim.teamMemberId)
        : undefined) ||
      findAvailableTeamMemberForSlot(
        input.appointmentTime,
        input.appointmentDate,
        selectedService.durationMinutes,
        teamMembers,
        slotBlocks
      );

    if (teamMembers.length > 0 && !assignedTeamMember) {
      throw new HttpError(409, 'Selected appointment time is no longer available');
    }

    if (
      activeWaitlistClaim?.teamMemberId &&
      activeWaitlistClaim.teamMemberId !== assignedTeamMember?.id
    ) {
      throw new HttpError(409, 'This waitlist offer is reserved for a different team member');
    }

    const appointment: AppointmentRecord = {
      id: randomUUID(),
      businessId,
      businessName: getBusinessDisplayName(business),
      publicAccessToken: randomUUID(),
      serviceId: selectedService.id,
      categoryName: selectedService.categoryName,
      serviceName: selectedService.name,
      teamMemberId: assignedTeamMember?.id,
      teamMemberName: assignedTeamMember?.name,
      customerName: input.customerName.trim(),
      customerPhone,
      customerEmail,
      serviceLocation: selectedServiceLocation,
      customerAddress:
        serviceLocationRequiresAddress(selectedServiceLocation)
          ? input.customerAddress?.trim() ?? ''
          : '',
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      servicePriceLabel: selectedService.priceLabel,
      serviceAmountValue: serviceMoney.amountValue,
      currencyCode: serviceMoney.currencyCode,
      startAt,
      endAt,
      status: 'booked',
      source: input.source ?? 'qr',
      packagePurchaseId: updatedPackagePurchase?.id,
      packageName: updatedPackagePurchase?.packageName,
      loyaltyRewardId: updatedLoyaltyReward?.id,
      loyaltyRewardLabel: updatedLoyaltyReward?.label,
      createdAt: now,
      updatedAt: now
    };

    const consumedSubscription = await billingService.consumeAppointmentCreditForBooking(businessId);

    try {
      await appointmentRepository.saveAppointment(appointment);
    } catch (error) {
      await billingService.restoreAppointmentCreditForBooking(consumedSubscription);
      throw error;
    }

    if (updatedPackagePurchase) {
      await appointmentRepository.savePackagePurchase(updatedPackagePurchase);
    }

    if (updatedLoyaltyReward) {
      await appointmentRepository.saveLoyaltyReward({
        ...updatedLoyaltyReward,
        reservedForAppointmentId: appointment.id
      });
    }

    if (activeWaitlistClaim) {
      await appointmentRepository.saveWaitlistEntry({
        ...activeWaitlistClaim,
        status: 'claimed',
        claimedAppointmentId: appointment.id,
        offerClaimToken: undefined,
        updatedAt: now
      });
    }

    return {
      appointment,
      notifications: await sendAppointmentConfirmationNotification(appointment, origin, 'booked'),
      publicAccessToken: appointment.publicAccessToken ?? '',
      manageLink: buildAppointmentManagementLink(appointment, origin)
    };
  },

  async reschedulePublicAppointment(
    businessId: string,
    appointmentId: string,
    accessToken: string,
    input: RescheduleAppointmentInput,
    origin: string
  ): Promise<{
    appointment: AppointmentRecord;
    notifications: NotificationDispatchResult[];
    waitlistOffers: WaitlistOfferDispatch[];
  }> {
    await validatePublicAppointmentAccess(businessId, appointmentId, accessToken);
    return appointmentService.rescheduleAppointment(businessId, appointmentId, input, origin);
  },

  async rescheduleAppointment(
    businessId: string,
    appointmentId: string,
    input: RescheduleAppointmentInput,
    origin: string
  ): Promise<{
    appointment: AppointmentRecord;
    notifications: NotificationDispatchResult[];
    waitlistOffers: WaitlistOfferDispatch[];
  }> {
    const appointment = await getAppointmentOrThrow(businessId, appointmentId);
    const previousSlot: OpenSlotContext = {
      businessId,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      teamMemberId: appointment.teamMemberId,
      teamMemberName: appointment.teamMemberName,
      sourceAppointmentId: appointment.id
    };

    if (appointment.status !== 'booked') {
      throw new HttpError(409, 'Only booked appointments can be rescheduled');
    }

    const availableSlots = await listAvailableSlotsForBooking(
      businessId,
      input.appointmentDate,
      appointment.id,
      null,
      appointment.teamMemberId ?? '',
      appointment.serviceName
    );

    if (!availableSlots.includes(input.appointmentTime)) {
      throw new HttpError(409, 'Selected appointment time is no longer available');
    }

    const selectedService = (await getServiceCatalogForBusiness(businessId)).find(
      (service) => service.name === appointment.serviceName
    );

    if (!selectedService) {
      throw new HttpError(404, 'Appointment service is no longer available');
    }

    const startAt = createUtcDateFromTimeZone(
      input.appointmentDate,
      input.appointmentTime,
      env.APP_TIMEZONE
    ).toISOString();
    const endAt = new Date(
      new Date(startAt).getTime() + selectedService.durationMinutes * 60 * 1000
    ).toISOString();

    const updatedAppointment: AppointmentRecord = {
      ...appointment,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      startAt,
      endAt,
      updatedAt: new Date().toISOString()
    };

    await appointmentRepository.saveAppointment(updatedAppointment);
    const notifications = await sendAppointmentConfirmationNotification(
      updatedAppointment,
      origin,
      'rescheduled'
    );
    const waitlistOffers = await processWaitlistForOpenSlot(previousSlot, origin);

    return {
      appointment: updatedAppointment,
      notifications,
      waitlistOffers
    };
  },

  async cancelAppointment(
    businessId: string,
    appointmentId: string,
    origin: string
  ): Promise<{
    appointment: AppointmentRecord;
    waitlistOffers: WaitlistOfferDispatch[];
  }> {
    const appointment = await getAppointmentOrThrow(businessId, appointmentId);
    const openSlot: OpenSlotContext = {
      businessId,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      teamMemberId: appointment.teamMemberId,
      teamMemberName: appointment.teamMemberName,
      sourceAppointmentId: appointment.id
    };

    if (appointment.status !== 'booked') {
      throw new HttpError(409, 'Only booked appointments can be cancelled');
    }

    const updatedAppointment: AppointmentRecord = {
      ...appointment,
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    };

    await appointmentRepository.saveAppointment(updatedAppointment);

    if (appointment.packagePurchaseId) {
      const packagePurchases = await listBusinessPackagePurchases(businessId);
      const matchedPackagePurchase = packagePurchases.find(
        (packagePurchase) => packagePurchase.id === appointment.packagePurchaseId
      );

      if (matchedPackagePurchase) {
        await appointmentRepository.savePackagePurchase(
          normalizePackagePurchaseStatus({
            ...matchedPackagePurchase,
            remainingUses: matchedPackagePurchase.remainingUses + 1,
            updatedAt: new Date().toISOString()
          })
        );
      }
    }

    if (appointment.loyaltyRewardId) {
      const loyaltyRewards = await listBusinessLoyaltyRewards(businessId);
      const matchedLoyaltyReward = loyaltyRewards.find(
        (loyaltyReward) => loyaltyReward.id === appointment.loyaltyRewardId
      );

      if (matchedLoyaltyReward && matchedLoyaltyReward.status === 'reserved') {
        await appointmentRepository.saveLoyaltyReward({
          ...matchedLoyaltyReward,
          status: 'available',
          reservedForAppointmentId: undefined,
          updatedAt: new Date().toISOString()
        });
      }
    }

    const waitlistOffers = await processWaitlistForOpenSlot(openSlot, origin);

    return {
      appointment: updatedAppointment,
      waitlistOffers
    };
  },

  async cancelPublicAppointment(
    businessId: string,
    appointmentId: string,
    accessToken: string,
    origin: string
  ): Promise<{
    appointment: AppointmentRecord;
    waitlistOffers: WaitlistOfferDispatch[];
  }> {
    await validatePublicAppointmentAccess(businessId, appointmentId, accessToken);
    return appointmentService.cancelAppointment(businessId, appointmentId, origin);
  },

  async completeAppointment(
    businessId: string,
    appointmentId: string
  ): Promise<{
    appointment: AppointmentRecord;
  }> {
    const appointment = await getAppointmentOrThrow(businessId, appointmentId);

    if (appointment.status !== 'booked') {
      throw new HttpError(409, 'Only booked appointments can be completed');
    }

    return {
      appointment: await completeBookedAppointment(appointment, new Date().toISOString())
    };
  },

  async sendAppointmentRunningLateNotification(
    businessId: string,
    appointmentId: string,
    input: AppointmentRunningLateInput,
    origin: string
  ): Promise<{
    appointment: AppointmentRecord;
    notifications: NotificationDispatchResult[];
  }> {
    const appointment = await getAppointmentOrThrow(businessId, appointmentId);

    if (appointment.status !== 'booked') {
      throw new HttpError(409, 'Only booked appointments can send running-late updates');
    }

    return {
      appointment,
      notifications: await sendRunningLateNotification(appointment, origin, input)
    };
  },

  async listPaymentsForBusiness(
    businessId: string
  ): Promise<{
    summary: PaymentSnapshot;
    balances: AppointmentPaymentBalance[];
    payments: PaymentRecord[];
  }> {
    await getBusinessOrThrow(businessId);
    const [appointments, paymentRecords] = await Promise.all([
      normalizeAppointmentsForBusiness(businessId),
      listBusinessPaymentRecords(businessId)
    ]);
    const { summary, balances } = buildPaymentSnapshotForAppointments(appointments, paymentRecords);

    return {
      summary,
      balances,
      payments: paymentRecords.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    };
  },

  async recordPaymentForAppointment(
    businessId: string,
    appointmentId: string,
    input: CreateAppointmentPaymentInput
  ): Promise<{
    payment: PaymentRecord;
    appointment: AppointmentRecord;
    balance: AppointmentPaymentBalance;
    summary: PaymentSnapshot;
  }> {
    await getBusinessOrThrow(businessId);
    const [appointments, paymentRecords] = await Promise.all([
      normalizeAppointmentsForBusiness(businessId),
      listBusinessPaymentRecords(businessId)
    ]);
    const appointment = appointments.find((entry) => entry.id === appointmentId);

    if (!appointment) {
      throw new HttpError(404, 'Appointment was not found');
    }

    if (appointment.status === 'cancelled') {
      throw new HttpError(409, 'Cancelled appointments cannot accept payments');
    }

    const { balances } = buildPaymentSnapshotForAppointments(appointments, paymentRecords);
    const balance = balances.find((entry) => entry.appointmentId === appointmentId);

    if (!balance) {
      throw new HttpError(404, 'Appointment balance was not found');
    }

    if (!Number.isFinite(input.amountValue) || input.amountValue <= 0) {
      throw new HttpError(400, 'Payment amount must be greater than zero');
    }

    if (balance.outstandingAmountValue <= 0) {
      throw new HttpError(409, 'This appointment is already fully paid');
    }

    if (input.amountValue - balance.outstandingAmountValue > 0.0001) {
      throw new HttpError(409, 'Payment amount cannot exceed the outstanding balance');
    }

    const now = new Date().toISOString();
    const paymentRecord: PaymentRecord = {
      id: randomUUID(),
      businessId,
      appointmentId,
      customerName: appointment.customerName,
      serviceName: appointment.serviceName,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      currencyCode: balance.currencyCode,
      amountValue: input.amountValue,
      entryType: 'payment',
      method: input.method,
      status: 'posted',
      note: input.note?.trim() ?? '',
      createdAt: now,
      updatedAt: now
    };

    await appointmentRepository.savePaymentRecord(paymentRecord);

    const nextSnapshot = buildPaymentSnapshotForAppointments(
      appointments,
      [paymentRecord, ...paymentRecords]
    );
    const nextBalance = nextSnapshot.balances.find((entry) => entry.appointmentId === appointmentId);

    if (!nextBalance) {
      throw new HttpError(500, 'Payment balance could not be recalculated');
    }

    return {
      payment: paymentRecord,
      appointment,
      balance: nextBalance,
      summary: nextSnapshot.summary
    };
  },

  async listPublicBenefitsByPhone(
    businessId: string,
    customerPhone: string
  ): Promise<{ benefits: PublicBenefitOption[] }> {
    await getBusinessOrThrow(businessId);

    if (!env.ENABLE_PUBLIC_CUSTOMER_LOOKUPS) {
      return { benefits: [] };
    }

    const customerKey = buildCustomerKey(customerPhone.trim());

    if (!customerKey) {
      return { benefits: [] };
    }

    const [packagePurchases, loyaltyRewards] = await Promise.all([
      listBusinessPackagePurchases(businessId),
      listBusinessLoyaltyRewards(businessId)
    ]);

    const packageBenefits = packagePurchases
      .filter(
        (packagePurchase) =>
          packagePurchase.customerKey === customerKey && packagePurchase.status === 'active'
      )
      .map((packagePurchase) => ({
        type: 'package' as const,
        id: packagePurchase.id,
        title: packagePurchase.packageName,
        description: `${packagePurchase.remainingUses} of ${packagePurchase.totalUses} uses remaining`
      }));

    const loyaltyBenefits = loyaltyRewards
      .filter(
        (loyaltyReward) =>
          loyaltyReward.customerKey === customerKey && loyaltyReward.status === 'available'
      )
      .map((loyaltyReward) => ({
        type: 'loyalty' as const,
        id: loyaltyReward.id,
        title: loyaltyReward.label,
        description: 'Available to use on your next eligible booking'
      }));

    return {
      benefits: [...packageBenefits, ...loyaltyBenefits]
    };
  },

  async sellPackageToCustomer(
    businessId: string,
    input: SellPackageInput
  ): Promise<{ packagePurchase: PackagePurchaseRecord }> {
    const business = await getBusinessOrThrow(businessId);
    const packagePlan = (business.packagePlans ?? []).find(
      (entry) => entry.id === input.packagePlanId && entry.isActive
    );

    if (!packagePlan) {
      throw new HttpError(404, 'Package plan was not found');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const customerPhone = input.customerPhone.trim();
    const customerEmail = input.customerEmail?.trim() ?? '';
    const customerKey = buildCustomerKey(customerPhone, customerEmail);

    if (!customerKey) {
      throw new HttpError(400, 'Customer phone or email is required');
    }

    const packagePurchase = normalizePackagePurchaseStatus({
      id: randomUUID(),
      businessId,
      packagePlanId: packagePlan.id,
      packageName: packagePlan.name,
      includedServiceIds: packagePlan.includedServiceIds,
      customerKey,
      customerName: input.customerName.trim(),
      customerPhone,
      customerEmail,
      totalUses: packagePlan.totalUses,
      remainingUses: packagePlan.totalUses,
      priceLabel: packagePlan.priceLabel,
      status: 'active',
      purchasedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    }, now);

    await appointmentRepository.savePackagePurchase(packagePurchase);

    return {
      packagePurchase
    };
  },

  async getDashboardCommerce(businessId: string): Promise<DashboardCommerceViewModel> {
    const business = await getBusinessOrThrow(businessId);
    const [packagePurchases, loyaltyRewards] = await Promise.all([
      listBusinessPackagePurchases(businessId),
      listBusinessLoyaltyRewards(businessId)
    ]);

    return {
      activePackagePlans: (business.packagePlans ?? []).filter((packagePlan) => packagePlan.isActive)
        .length,
      packagesSold: packagePurchases.length,
      activePackageBalances: packagePurchases.filter(
        (packagePurchase) => packagePurchase.status === 'active'
      ).length,
      availableLoyaltyRewards: loyaltyRewards.filter(
        (loyaltyReward) => loyaltyReward.status === 'available'
      ).length,
      loyaltyProgramEnabled: business.loyaltyProgram?.isEnabled === true,
      activeProducts: 0,
      productsSold: 0,
      productUnitsSold: 0,
      lowStockProducts: 0
    };
  },

  async listAppointmentsForBusiness(businessId: string): Promise<AppointmentRecord[]> {
    await getBusinessOrThrow(businessId);
    return normalizeAppointmentsForBusiness(businessId);
  },

  async listWaitlistForBusiness(
    businessId: string,
    origin: string
  ): Promise<{
    waitlist: Array<
      Omit<WaitlistRecord, 'offerClaimToken'> & {
        claimLink?: string;
      }
    >;
  }> {
    await getBusinessOrThrow(businessId);
    const waitlistEntries = await listBusinessWaitlistEntries(businessId);

    return {
      waitlist: waitlistEntries.map((waitlistEntry) => ({
        ...waitlistEntry,
        offerClaimToken: undefined,
        claimLink:
          waitlistEntry.status === 'offered' && waitlistEntry.offerClaimToken
            ? buildWaitlistClaimLink(
                waitlistEntry,
                origin
              )
            : undefined
      }))
    };
  },

  async listReviewsForBusiness(businessId: string): Promise<{
    reviews: ReviewRecord[];
    summary: ReviewSummary;
  }> {
    await getBusinessOrThrow(businessId);
    const reviews = await listBusinessReviews(businessId);

    return {
      reviews,
      summary: buildReviewSummary(reviews)
    };
  },

  async createReview(
    businessId: string,
    input: CreateReviewInput
  ): Promise<{
    review: ReviewRecord;
    summary: ReviewSummary;
  }> {
    await getBusinessOrThrow(businessId);

    const appointments = await normalizeBookedAppointments(businessId);
    const appointment = appointments.find(
      (entry) => entry.businessId === businessId && entry.id === input.appointmentId
    );

    if (!appointment) {
      throw new HttpError(404, 'Appointment was not found');
    }

    if (
      normalizePhoneLookup(appointment.customerPhone) !==
      normalizePhoneLookup(input.customerPhone)
    ) {
      throw new HttpError(403, 'Customer phone does not match this appointment');
    }

    if (appointment.status !== 'completed') {
      throw new HttpError(409, 'Reviews can only be submitted after a completed appointment');
    }

    const existingReviews = await listBusinessReviews(businessId);
    const duplicateReview = existingReviews.find(
      (review) => review.appointmentId === appointment.id
    );

    if (duplicateReview) {
      throw new HttpError(409, 'A review has already been submitted for this appointment');
    }

    const review: ReviewRecord = {
      id: randomUUID(),
      appointmentId: appointment.id,
      businessId,
      customerName: input.reviewerName?.trim() || appointment.customerName,
      rating: input.rating,
      comment: input.comment?.trim() ?? '',
      createdAt: new Date().toISOString()
    };

    await appointmentRepository.saveReview(review);

    const nextReviews = await listBusinessReviews(businessId);

    return {
      review,
      summary: buildReviewSummary(nextReviews)
    };
  }
};
