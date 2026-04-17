import type { AppointmentState } from '../../appointments/appointment.store';
import type {
  AppointmentRecord,
  LoyaltyRewardRecord,
  PackagePurchaseRecord,
  PaymentRecord,
  ReviewRecord,
  WaitlistRecord
} from '../../appointments/appointment.types';
import type { ClientPlatformState } from '../../platform/clientPlatform.store';
import type {
  ClientRecord,
  CustomerProfileRecord,
  LoyaltyProgramRecord,
  PackagePlanRecord,
  ProductRecord,
  ProductSaleRecord,
  TeamMemberRecord
} from '../../platform/clientPlatform.types';
import { defaultServiceLocation, serviceLocationValues } from '../../platform/serviceLocation.constants';
import { getSupabaseClient } from './client';

type Row = Record<string, unknown>;

const asNullableText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

const asNumber = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const asTime = (value: unknown, fallback: string | null = null): string | null => {
  const normalizedValue = asNullableText(value);
  return normalizedValue ?? fallback;
};

const asDate = (value: unknown): string | null => {
  return asNullableText(value);
};

const asTimestamp = (value: unknown): string => {
  const normalizedValue = asNullableText(value);
  return normalizedValue ?? new Date().toISOString();
};

const asStringArray = (value: unknown): string[] => {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
};

const asServiceLocation = (value: unknown) => {
  return typeof value === 'string' && serviceLocationValues.includes(value as typeof serviceLocationValues[number])
    ? value
    : defaultServiceLocation;
};

const knownBusinessNames = new Map<string, string>();

const ensureBusinessExists = async (
  businessId: unknown,
  businessName?: unknown
): Promise<void> => {
  const normalizedBusinessId = asText(businessId);

  if (!normalizedBusinessId) {
    return;
  }

  const normalizedBusinessName = asText(businessName);
  const knownBusinessName = knownBusinessNames.get(normalizedBusinessId);

  if (typeof knownBusinessName === 'string' && (knownBusinessName || !normalizedBusinessName)) {
    return;
  }

  await upsertRows(
    'businesses',
    [
      {
        id: normalizedBusinessId,
        admin_token: `legacy-${normalizedBusinessId}`,
        email: '',
        mobile_number: '',
        business_phone_number: '',
        provider: 'email',
        business_name: normalizedBusinessName,
        website: '',
        profile_image_url: '',
        account_type: null,
        venue_address: '',
        preferred_language: null,
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    'id'
  );

  knownBusinessNames.set(normalizedBusinessId, normalizedBusinessName);
};

const upsertRows = async (
  tableName: string,
  rows: Row[],
  onConflict: string
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from(tableName).upsert(rows, { onConflict });

  if (error) {
    throw new Error(`Failed to upsert ${tableName}: ${error.message}`);
  }
};

const deleteByColumnValue = async (
  tableName: string,
  column: string,
  value: string
): Promise<void> => {
  const client = getSupabaseClient();
  const { error } = await client.from(tableName).delete().eq(column, value);

  if (error) {
    throw new Error(`Failed to delete ${tableName}: ${error.message}`);
  }
};

const deleteMissingRows = async (
  tableName: string,
  scopeColumn: string,
  scopeValue: string,
  idColumn: string,
  retainedIds: string[]
): Promise<void> => {
  const client = getSupabaseClient();
  const { data, error: selectError } = await client.from(tableName).select(idColumn).eq(scopeColumn, scopeValue);

  if (selectError) {
    throw new Error(`Failed to inspect ${tableName}: ${selectError.message}`);
  }

  const retainedIdSet = new Set(retainedIds);
  const idsToDelete = (data ?? [])
    .map((row) => (row as unknown as Record<string, unknown>)[idColumn])
    .filter((value): value is string => typeof value === 'string' && !retainedIdSet.has(value));

  if (idsToDelete.length === 0) {
    return;
  }

  const { error } = await client
    .from(tableName)
    .delete()
    .eq(scopeColumn, scopeValue)
    .in(idColumn, idsToDelete);

  if (error) {
    throw new Error(`Failed to prune ${tableName}: ${error.message}`);
  }
};

const syncBusinessSettings = async (clientRecord: ClientRecord): Promise<void> => {
  await upsertRows(
    'business_settings',
    [
      {
        business_id: clientRecord.id,
        currency_code: asText(clientRecord.businessSettings.currencyCode) || 'PKR',
        currency_locale: asText(clientRecord.businessSettings.currencyLocale) || 'en-PK',
        slot_times: asStringArray(clientRecord.businessSettings.slotTimes),
        use_service_templates: asBoolean(clientRecord.businessSettings.useServiceTemplates, true),
        report_page_title: asText(clientRecord.businessSettings.reportMetadata.pageTitle),
        report_page_subtitle: asText(clientRecord.businessSettings.reportMetadata.pageSubtitle),
        created_at: asTimestamp(clientRecord.createdAt),
        updated_at: asTimestamp(clientRecord.updatedAt)
      }
    ],
    'business_id'
  );
};

const syncBusinessServiceTypes = async (clientRecord: ClientRecord): Promise<void> => {
  await deleteByColumnValue('business_service_types', 'business_id', clientRecord.id);
  await upsertRows(
    'business_service_types',
    asStringArray(clientRecord.serviceTypes).map((serviceType) => ({
      business_id: clientRecord.id,
      service_type: serviceType,
      created_at: asTimestamp(clientRecord.updatedAt)
    })),
    'business_id,service_type'
  );
};

const syncBusinessServiceLocations = async (clientRecord: ClientRecord): Promise<void> => {
  await deleteByColumnValue('business_service_locations', 'business_id', clientRecord.id);
  await upsertRows(
    'business_service_locations',
    asStringArray(clientRecord.serviceLocation).map((serviceLocation) => ({
      business_id: clientRecord.id,
      service_location: serviceLocation,
      created_at: asTimestamp(clientRecord.updatedAt)
    })),
    'business_id,service_location'
  );
};

const syncTeamMembers = async (businessId: string, teamMembers: TeamMemberRecord[]): Promise<void> => {
  await upsertRows(
    'team_members',
    teamMembers.map((teamMember) => ({
      id: teamMember.id,
      business_id: businessId,
      name: asText(teamMember.name),
      role: asText(teamMember.role),
      phone: asText(teamMember.phone),
      expertise: asText(teamMember.expertise),
      opening_time: asTime(teamMember.openingTime, '09:00'),
      closing_time: asTime(teamMember.closingTime, '18:00'),
      off_days: asStringArray(teamMember.offDays),
      is_active: asBoolean(teamMember.isActive, true),
      created_at: asTimestamp(teamMember.createdAt),
      updated_at: asTimestamp(teamMember.updatedAt)
    })),
    'id'
  );
};

const syncServices = async (businessId: string, services: ClientRecord['services']): Promise<void> => {
  await upsertRows(
    'services',
    services.map((service) => ({
      id: service.id,
      business_id: businessId,
      name: asText(service.name),
      duration_minutes: asNumber(service.durationMinutes, 1),
      category_name: asText(service.categoryName),
      price_label: asText(service.priceLabel),
      description: asText(service.description),
      is_active: asBoolean(service.isActive, true),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })),
    'id'
  );
};

const syncProducts = async (businessId: string, products: ProductRecord[]): Promise<void> => {
  await upsertRows(
    'products',
    products.map((product) => ({
      id: product.id,
      business_id: businessId,
      name: asText(product.name),
      category_name: asText(product.categoryName),
      sku: asText(product.sku),
      price_label: asText(product.priceLabel),
      stock_quantity: asNumber(product.stockQuantity),
      description: asText(product.description),
      is_active: asBoolean(product.isActive, true),
      created_at: asTimestamp(product.createdAt),
      updated_at: asTimestamp(product.updatedAt)
    })),
    'id'
  );
};

const syncProductSales = async (businessId: string, productSales: ProductSaleRecord[]): Promise<void> => {
  await deleteMissingRows(
    'product_sales',
    'business_id',
    businessId,
    'id',
    productSales.map((productSale) => productSale.id)
  );

  await upsertRows(
    'product_sales',
    productSales.map((productSale) => ({
      id: productSale.id,
      business_id: businessId,
      product_id: asText(productSale.productId),
      product_name: asText(productSale.productName),
      sku: asText(productSale.sku),
      quantity: asNumber(productSale.quantity, 1),
      unit_price_label: asText(productSale.unitPriceLabel),
      total_price_label: asText(productSale.totalPriceLabel),
      customer_name: asText(productSale.customerName),
      customer_phone: asText(productSale.customerPhone),
      customer_email: asText(productSale.customerEmail),
      sold_at: asTimestamp(productSale.soldAt),
      created_at: asTimestamp(productSale.createdAt),
      updated_at: asTimestamp(productSale.updatedAt)
    })),
    'id'
  );
};

const syncPackagePlanServices = async (packagePlan: PackagePlanRecord): Promise<void> => {
  await deleteByColumnValue('package_plan_services', 'package_plan_id', packagePlan.id);
  await upsertRows(
    'package_plan_services',
    asStringArray(packagePlan.includedServiceIds).map((serviceId) => ({
      package_plan_id: packagePlan.id,
      service_id: serviceId,
      created_at: asTimestamp(packagePlan.updatedAt)
    })),
    'package_plan_id,service_id'
  );
};

const syncPackagePlans = async (businessId: string, packagePlans: PackagePlanRecord[]): Promise<void> => {
  await upsertRows(
    'package_plans',
    packagePlans.map((packagePlan) => ({
      id: packagePlan.id,
      business_id: businessId,
      name: asText(packagePlan.name),
      total_uses: asNumber(packagePlan.totalUses, 1),
      price_label: asText(packagePlan.priceLabel),
      is_active: asBoolean(packagePlan.isActive, true),
      created_at: asTimestamp(packagePlan.createdAt),
      updated_at: asTimestamp(packagePlan.updatedAt)
    })),
    'id'
  );

  for (const packagePlan of packagePlans) {
    await syncPackagePlanServices(packagePlan);
  }
};

const syncLoyaltyProgramServices = async (loyaltyProgram: LoyaltyProgramRecord): Promise<void> => {
  await deleteByColumnValue('loyalty_program_services', 'loyalty_program_id', loyaltyProgram.id);
  await upsertRows(
    'loyalty_program_services',
    asStringArray(loyaltyProgram.includedServiceIds).map((serviceId) => ({
      loyalty_program_id: loyaltyProgram.id,
      service_id: serviceId,
      created_at: asTimestamp(loyaltyProgram.updatedAt)
    })),
    'loyalty_program_id,service_id'
  );
};

const syncLoyaltyProgram = async (
  businessId: string,
  loyaltyProgram: LoyaltyProgramRecord | null
): Promise<void> => {
  if (!loyaltyProgram) {
    await deleteByColumnValue('loyalty_programs', 'business_id', businessId);
    return;
  }

  await upsertRows(
    'loyalty_programs',
    [
      {
        id: loyaltyProgram.id,
        business_id: businessId,
        is_enabled: asBoolean(loyaltyProgram.isEnabled),
        trigger_completed_visits: asNumber(loyaltyProgram.triggerCompletedVisits),
        reward_type: loyaltyProgram.rewardType,
        reward_value: asNumber(loyaltyProgram.rewardValue),
        created_at: asTimestamp(loyaltyProgram.createdAt),
        updated_at: asTimestamp(loyaltyProgram.updatedAt)
      }
    ],
    'id'
  );

  await syncLoyaltyProgramServices(loyaltyProgram);
};

const syncCustomerProfiles = async (
  businessId: string,
  customerProfiles: CustomerProfileRecord[]
): Promise<void> => {
  await deleteMissingRows(
    'customer_profiles',
    'business_id',
    businessId,
    'id',
    customerProfiles.map((customerProfile) => customerProfile.id)
  );

  await upsertRows(
    'customer_profiles',
    customerProfiles.map((customerProfile) => ({
      id: customerProfile.id,
      business_id: businessId,
      customer_name: asText(customerProfile.customerName),
      customer_phone: asText(customerProfile.customerPhone),
      customer_email: asText(customerProfile.customerEmail),
      total_visits: asNumber(customerProfile.totalVisits),
      booked_visits: asNumber(customerProfile.bookedVisits),
      completed_visits: asNumber(customerProfile.completedVisits),
      cancelled_visits: asNumber(customerProfile.cancelledVisits),
      last_service: asText(customerProfile.lastService),
      last_appointment_date: asDate(customerProfile.lastAppointmentDate),
      last_appointment_time: asTime(customerProfile.lastAppointmentTime),
      first_seen_at: asTimestamp(customerProfile.firstSeenAt),
      last_seen_at: asTimestamp(customerProfile.lastSeenAt),
      created_at: asTimestamp(customerProfile.createdAt),
      updated_at: asTimestamp(customerProfile.updatedAt)
    })),
    'id'
  );
};

export const syncClientRecordToRelational = async (clientRecord: ClientRecord): Promise<void> => {
  await upsertRows(
    'businesses',
    [
      {
        id: clientRecord.id,
        admin_token: asText(clientRecord.adminToken),
        email: asText(clientRecord.email),
        mobile_number: asText(clientRecord.mobileNumber),
        business_phone_number: asText(clientRecord.businessPhoneNumber),
        provider: clientRecord.provider,
        business_name: asText(clientRecord.businessName),
        website: asText(clientRecord.website),
        profile_image_url: asText(clientRecord.profileImageUrl),
        account_type: clientRecord.accountType,
        venue_address: asText(clientRecord.venueAddress),
        preferred_language: clientRecord.preferredLanguage,
        onboarding_completed: asBoolean(clientRecord.onboardingCompleted),
        created_at: asTimestamp(clientRecord.createdAt),
        updated_at: asTimestamp(clientRecord.updatedAt)
      }
    ],
    'id'
  );

  knownBusinessNames.set(clientRecord.id, asText(clientRecord.businessName));

  await syncBusinessSettings(clientRecord);
  await syncBusinessServiceTypes(clientRecord);
  await syncBusinessServiceLocations(clientRecord);
  await syncTeamMembers(clientRecord.id, clientRecord.teamMembers);
  await syncServices(clientRecord.id, clientRecord.services);
  await syncProducts(clientRecord.id, clientRecord.products);
  await syncProductSales(clientRecord.id, clientRecord.productSales);
  await syncPackagePlans(clientRecord.id, clientRecord.packagePlans);
  await syncLoyaltyProgram(clientRecord.id, clientRecord.loyaltyProgram);
  await syncCustomerProfiles(clientRecord.id, clientRecord.customerProfiles);
};

const syncPackagePurchaseServices = async (
  packagePurchase: PackagePurchaseRecord
): Promise<void> => {
  await deleteByColumnValue('package_purchase_services', 'package_purchase_id', packagePurchase.id);
  await upsertRows(
    'package_purchase_services',
    asStringArray(packagePurchase.includedServiceIds).map((serviceId) => ({
      package_purchase_id: packagePurchase.id,
      service_id: serviceId,
      created_at: asTimestamp(packagePurchase.updatedAt)
    })),
    'package_purchase_id,service_id'
  );
};

export const syncPackagePurchaseToRelational = async (
  packagePurchase: PackagePurchaseRecord
): Promise<void> => {
  await ensureBusinessExists(packagePurchase.businessId);

  await upsertRows(
    'package_purchases',
    [
      {
        id: packagePurchase.id,
        business_id: asText(packagePurchase.businessId),
        package_plan_id: asText(packagePurchase.packagePlanId),
        package_name: asText(packagePurchase.packageName),
        customer_key: asText(packagePurchase.customerKey),
        customer_name: asText(packagePurchase.customerName),
        customer_phone: asText(packagePurchase.customerPhone),
        customer_email: asText(packagePurchase.customerEmail),
        total_uses: asNumber(packagePurchase.totalUses),
        remaining_uses: asNumber(packagePurchase.remainingUses),
        price_label: asText(packagePurchase.priceLabel),
        status: packagePurchase.status,
        purchased_at: asTimestamp(packagePurchase.purchasedAt),
        expires_at: asNullableText(packagePurchase.expiresAt),
        created_at: asTimestamp(packagePurchase.createdAt),
        updated_at: asTimestamp(packagePurchase.updatedAt)
      }
    ],
    'id'
  );

  await syncPackagePurchaseServices(packagePurchase);
};

const syncLoyaltyRewardServices = async (
  loyaltyReward: LoyaltyRewardRecord
): Promise<void> => {
  await deleteByColumnValue('loyalty_reward_services', 'loyalty_reward_id', loyaltyReward.id);
  await upsertRows(
    'loyalty_reward_services',
    asStringArray(loyaltyReward.includedServiceIds).map((serviceId) => ({
      loyalty_reward_id: loyaltyReward.id,
      service_id: serviceId,
      created_at: asTimestamp(loyaltyReward.updatedAt)
    })),
    'loyalty_reward_id,service_id'
  );
};

export const syncLoyaltyRewardToRelational = async (
  loyaltyReward: LoyaltyRewardRecord
): Promise<void> => {
  await ensureBusinessExists(loyaltyReward.businessId);

  await upsertRows(
    'loyalty_rewards',
    [
      {
        id: loyaltyReward.id,
        business_id: asText(loyaltyReward.businessId),
        customer_key: asText(loyaltyReward.customerKey),
        customer_name: asText(loyaltyReward.customerName),
        customer_phone: asText(loyaltyReward.customerPhone),
        customer_email: asText(loyaltyReward.customerEmail),
        reward_type: loyaltyReward.rewardType,
        reward_value: asNumber(loyaltyReward.rewardValue),
        label: asText(loyaltyReward.label),
        status: loyaltyReward.status,
        earned_from_appointment_id: asNullableText(loyaltyReward.earnedFromAppointmentId),
        reserved_for_appointment_id: asNullableText(loyaltyReward.reservedForAppointmentId),
        created_at: asTimestamp(loyaltyReward.createdAt),
        updated_at: asTimestamp(loyaltyReward.updatedAt)
      }
    ],
    'id'
  );

  await syncLoyaltyRewardServices(loyaltyReward);
};

export const syncAppointmentToRelational = async (
  appointment: AppointmentRecord
): Promise<void> => {
  await ensureBusinessExists(appointment.businessId, appointment.businessName);

  await upsertRows(
    'appointments',
    [
      {
        id: appointment.id,
        business_id: asText(appointment.businessId),
        business_name: asText(appointment.businessName),
        public_access_token: asNullableText(appointment.publicAccessToken),
        service_id: asNullableText(appointment.serviceId),
        category_name: asText(appointment.categoryName),
        service_name: asText(appointment.serviceName),
        team_member_id: asNullableText(appointment.teamMemberId),
        team_member_name: asText(appointment.teamMemberName),
        customer_name: asText(appointment.customerName),
        customer_phone: asText(appointment.customerPhone),
        customer_email: asText(appointment.customerEmail),
        service_location: asServiceLocation(appointment.serviceLocation),
        customer_address: asText(appointment.customerAddress),
        appointment_date: asText(appointment.appointmentDate),
        appointment_time: asText(appointment.appointmentTime),
        service_price_label: asText(appointment.servicePriceLabel),
        service_amount_value: appointment.serviceAmountValue ?? null,
        currency_code: asNullableText(appointment.currencyCode),
        start_at: asTimestamp(appointment.startAt),
        end_at: asTimestamp(appointment.endAt),
        status: appointment.status,
        source: appointment.source,
        package_purchase_id: asNullableText(appointment.packagePurchaseId),
        package_name: asText(appointment.packageName),
        loyalty_reward_id: asNullableText(appointment.loyaltyRewardId),
        loyalty_reward_label: asText(appointment.loyaltyRewardLabel),
        created_at: asTimestamp(appointment.createdAt),
        updated_at: asTimestamp(appointment.updatedAt)
      }
    ],
    'id'
  );
};

export const syncPaymentRecordToRelational = async (
  paymentRecord: PaymentRecord
): Promise<void> => {
  await ensureBusinessExists(paymentRecord.businessId);

  await upsertRows(
    'payments',
    [
      {
        id: paymentRecord.id,
        business_id: asText(paymentRecord.businessId),
        appointment_id: asText(paymentRecord.appointmentId),
        customer_name: asText(paymentRecord.customerName),
        service_name: asText(paymentRecord.serviceName),
        appointment_date: asText(paymentRecord.appointmentDate),
        appointment_time: asText(paymentRecord.appointmentTime),
        currency_code: asText(paymentRecord.currencyCode),
        amount_value: asNumber(paymentRecord.amountValue),
        entry_type: paymentRecord.entryType,
        method: paymentRecord.method,
        status: paymentRecord.status,
        note: asText(paymentRecord.note),
        created_at: asTimestamp(paymentRecord.createdAt),
        updated_at: asTimestamp(paymentRecord.updatedAt)
      }
    ],
    'id'
  );
};

export const syncReviewToRelational = async (review: ReviewRecord): Promise<void> => {
  await ensureBusinessExists(review.businessId);

  await upsertRows(
    'reviews',
    [
      {
        id: review.id,
        appointment_id: asText(review.appointmentId),
        business_id: asText(review.businessId),
        customer_name: asText(review.customerName),
        rating: asNumber(review.rating, 5),
        comment: asText(review.comment),
        created_at: asTimestamp(review.createdAt)
      }
    ],
    'id'
  );
};

export const syncWaitlistEntryToRelational = async (
  waitlistEntry: WaitlistRecord
): Promise<void> => {
  await ensureBusinessExists(waitlistEntry.businessId);

  await upsertRows(
    'waitlist_entries',
    [
      {
        id: waitlistEntry.id,
        business_id: asText(waitlistEntry.businessId),
        service_id: asNullableText(waitlistEntry.serviceId),
        service_name: asText(waitlistEntry.serviceName),
        team_member_id: asNullableText(waitlistEntry.teamMemberId),
        team_member_name: asText(waitlistEntry.teamMemberName),
        appointment_date: asText(waitlistEntry.appointmentDate),
        preferred_time: asTime(waitlistEntry.preferredTime),
        customer_key: asText(waitlistEntry.customerKey),
        customer_name: asText(waitlistEntry.customerName),
        customer_phone: asText(waitlistEntry.customerPhone),
        customer_email: asText(waitlistEntry.customerEmail),
        source: waitlistEntry.source,
        status: waitlistEntry.status,
        offered_appointment_date: asDate(waitlistEntry.offeredAppointmentDate),
        offered_appointment_time: asTime(waitlistEntry.offeredAppointmentTime),
        offer_sent_at: asNullableText(waitlistEntry.offerSentAt),
        offer_expires_at: asNullableText(waitlistEntry.offerExpiresAt),
        offer_claim_token: asNullableText(waitlistEntry.offerClaimToken),
        claimed_appointment_id: asNullableText(waitlistEntry.claimedAppointmentId),
        created_at: asTimestamp(waitlistEntry.createdAt),
        updated_at: asTimestamp(waitlistEntry.updatedAt)
      }
    ],
    'id'
  );
};

export const syncClientPlatformStateToRelational = async (
  state: ClientPlatformState
): Promise<void> => {
  for (const clientRecord of state.clients) {
    await syncClientRecordToRelational(clientRecord);
  }
};

export const syncAppointmentStateToRelational = async (
  state: AppointmentState
): Promise<void> => {
  for (const packagePurchase of state.packagePurchases) {
    await syncPackagePurchaseToRelational(packagePurchase);
  }

  for (const loyaltyReward of state.loyaltyRewards) {
    await syncLoyaltyRewardToRelational(loyaltyReward);
  }

  for (const appointment of state.appointments) {
    await syncAppointmentToRelational(appointment);
  }

  for (const paymentRecord of state.paymentRecords) {
    await syncPaymentRecordToRelational(paymentRecord);
  }

  for (const review of state.reviews) {
    await syncReviewToRelational(review);
  }

  for (const waitlistEntry of state.waitlistEntries) {
    await syncWaitlistEntryToRelational(waitlistEntry);
  }
};
