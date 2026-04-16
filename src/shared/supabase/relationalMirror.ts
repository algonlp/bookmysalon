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

const syncBusinessSettings = async (clientRecord: ClientRecord): Promise<void> => {
  await upsertRows(
    'business_settings',
    [
      {
        business_id: clientRecord.id,
        currency_code: clientRecord.businessSettings.currencyCode,
        currency_locale: clientRecord.businessSettings.currencyLocale,
        slot_times: clientRecord.businessSettings.slotTimes,
        use_service_templates: clientRecord.businessSettings.useServiceTemplates,
        report_page_title: clientRecord.businessSettings.reportMetadata.pageTitle,
        report_page_subtitle: clientRecord.businessSettings.reportMetadata.pageSubtitle,
        created_at: clientRecord.createdAt,
        updated_at: clientRecord.updatedAt
      }
    ],
    'business_id'
  );
};

const syncBusinessServiceTypes = async (clientRecord: ClientRecord): Promise<void> => {
  await deleteByColumnValue('business_service_types', 'business_id', clientRecord.id);
  await upsertRows(
    'business_service_types',
    clientRecord.serviceTypes.map((serviceType) => ({
      business_id: clientRecord.id,
      service_type: serviceType,
      created_at: clientRecord.updatedAt
    })),
    'business_id,service_type'
  );
};

const syncBusinessServiceLocations = async (clientRecord: ClientRecord): Promise<void> => {
  await deleteByColumnValue('business_service_locations', 'business_id', clientRecord.id);
  await upsertRows(
    'business_service_locations',
    clientRecord.serviceLocation.map((serviceLocation) => ({
      business_id: clientRecord.id,
      service_location: serviceLocation,
      created_at: clientRecord.updatedAt
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
      name: teamMember.name,
      role: teamMember.role,
      phone: teamMember.phone,
      expertise: teamMember.expertise,
      opening_time: asTime(teamMember.openingTime, '09:00'),
      closing_time: asTime(teamMember.closingTime, '18:00'),
      off_days: teamMember.offDays,
      is_active: teamMember.isActive,
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
      name: service.name,
      duration_minutes: service.durationMinutes,
      category_name: service.categoryName,
      price_label: service.priceLabel,
      description: service.description,
      is_active: service.isActive,
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
      name: product.name,
      category_name: product.categoryName,
      sku: product.sku,
      price_label: product.priceLabel,
      stock_quantity: product.stockQuantity,
      description: product.description,
      is_active: product.isActive,
      created_at: asTimestamp(product.createdAt),
      updated_at: asTimestamp(product.updatedAt)
    })),
    'id'
  );
};

const syncProductSales = async (businessId: string, productSales: ProductSaleRecord[]): Promise<void> => {
  await upsertRows(
    'product_sales',
    productSales.map((productSale) => ({
      id: productSale.id,
      business_id: businessId,
      product_id: productSale.productId,
      product_name: productSale.productName,
      sku: productSale.sku,
      quantity: productSale.quantity,
      unit_price_label: productSale.unitPriceLabel,
      total_price_label: productSale.totalPriceLabel,
      customer_name: productSale.customerName,
      customer_phone: productSale.customerPhone,
      customer_email: productSale.customerEmail,
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
    packagePlan.includedServiceIds.map((serviceId) => ({
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
      name: packagePlan.name,
      total_uses: packagePlan.totalUses,
      price_label: packagePlan.priceLabel,
      is_active: packagePlan.isActive,
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
    loyaltyProgram.includedServiceIds.map((serviceId) => ({
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
        is_enabled: loyaltyProgram.isEnabled,
        trigger_completed_visits: loyaltyProgram.triggerCompletedVisits,
        reward_type: loyaltyProgram.rewardType,
        reward_value: loyaltyProgram.rewardValue,
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
  await upsertRows(
    'customer_profiles',
    customerProfiles.map((customerProfile) => ({
      id: customerProfile.id,
      business_id: businessId,
      customer_name: customerProfile.customerName,
      customer_phone: customerProfile.customerPhone,
      customer_email: customerProfile.customerEmail,
      total_visits: customerProfile.totalVisits,
      booked_visits: customerProfile.bookedVisits,
      completed_visits: customerProfile.completedVisits,
      cancelled_visits: customerProfile.cancelledVisits,
      last_service: customerProfile.lastService,
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
        admin_token: clientRecord.adminToken,
        email: clientRecord.email,
        mobile_number: clientRecord.mobileNumber,
        business_phone_number: clientRecord.businessPhoneNumber,
        provider: clientRecord.provider,
        business_name: clientRecord.businessName,
        website: clientRecord.website,
        profile_image_url: clientRecord.profileImageUrl,
        account_type: clientRecord.accountType,
        venue_address: clientRecord.venueAddress,
        preferred_language: clientRecord.preferredLanguage,
        onboarding_completed: clientRecord.onboardingCompleted,
        created_at: asTimestamp(clientRecord.createdAt),
        updated_at: asTimestamp(clientRecord.updatedAt)
      }
    ],
    'id'
  );

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
    packagePurchase.includedServiceIds.map((serviceId) => ({
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
  await upsertRows(
    'package_purchases',
    [
      {
        id: packagePurchase.id,
        business_id: packagePurchase.businessId,
        package_plan_id: packagePurchase.packagePlanId,
        package_name: packagePurchase.packageName,
        customer_key: packagePurchase.customerKey,
        customer_name: packagePurchase.customerName,
        customer_phone: packagePurchase.customerPhone,
        customer_email: packagePurchase.customerEmail,
        total_uses: packagePurchase.totalUses,
        remaining_uses: packagePurchase.remainingUses,
        price_label: packagePurchase.priceLabel,
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
    loyaltyReward.includedServiceIds.map((serviceId) => ({
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
  await upsertRows(
    'loyalty_rewards',
    [
      {
        id: loyaltyReward.id,
        business_id: loyaltyReward.businessId,
        customer_key: loyaltyReward.customerKey,
        customer_name: loyaltyReward.customerName,
        customer_phone: loyaltyReward.customerPhone,
        customer_email: loyaltyReward.customerEmail,
        reward_type: loyaltyReward.rewardType,
        reward_value: loyaltyReward.rewardValue,
        label: loyaltyReward.label,
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
  await upsertRows(
    'appointments',
    [
      {
        id: appointment.id,
        business_id: appointment.businessId,
        business_name: appointment.businessName,
        public_access_token: asNullableText(appointment.publicAccessToken),
        service_id: asNullableText(appointment.serviceId),
        category_name: appointment.categoryName,
        service_name: appointment.serviceName,
        team_member_id: asNullableText(appointment.teamMemberId),
        team_member_name: appointment.teamMemberName ?? '',
        customer_name: appointment.customerName,
        customer_phone: appointment.customerPhone,
        customer_email: appointment.customerEmail,
        service_location: appointment.serviceLocation,
        customer_address: appointment.customerAddress,
        appointment_date: appointment.appointmentDate,
        appointment_time: appointment.appointmentTime,
        service_price_label: appointment.servicePriceLabel ?? '',
        service_amount_value: appointment.serviceAmountValue ?? null,
        currency_code: asNullableText(appointment.currencyCode),
        start_at: asTimestamp(appointment.startAt),
        end_at: asTimestamp(appointment.endAt),
        status: appointment.status,
        source: appointment.source,
        package_purchase_id: asNullableText(appointment.packagePurchaseId),
        package_name: appointment.packageName ?? '',
        loyalty_reward_id: asNullableText(appointment.loyaltyRewardId),
        loyalty_reward_label: appointment.loyaltyRewardLabel ?? '',
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
  await upsertRows(
    'payments',
    [
      {
        id: paymentRecord.id,
        business_id: paymentRecord.businessId,
        appointment_id: paymentRecord.appointmentId,
        customer_name: paymentRecord.customerName,
        service_name: paymentRecord.serviceName,
        appointment_date: paymentRecord.appointmentDate,
        appointment_time: paymentRecord.appointmentTime,
        currency_code: paymentRecord.currencyCode,
        amount_value: paymentRecord.amountValue,
        entry_type: paymentRecord.entryType,
        method: paymentRecord.method,
        status: paymentRecord.status,
        note: paymentRecord.note,
        created_at: asTimestamp(paymentRecord.createdAt),
        updated_at: asTimestamp(paymentRecord.updatedAt)
      }
    ],
    'id'
  );
};

export const syncReviewToRelational = async (review: ReviewRecord): Promise<void> => {
  await upsertRows(
    'reviews',
    [
      {
        id: review.id,
        appointment_id: review.appointmentId,
        business_id: review.businessId,
        customer_name: review.customerName,
        rating: review.rating,
        comment: review.comment,
        created_at: asTimestamp(review.createdAt)
      }
    ],
    'id'
  );
};

export const syncWaitlistEntryToRelational = async (
  waitlistEntry: WaitlistRecord
): Promise<void> => {
  await upsertRows(
    'waitlist_entries',
    [
      {
        id: waitlistEntry.id,
        business_id: waitlistEntry.businessId,
        service_id: asNullableText(waitlistEntry.serviceId),
        service_name: waitlistEntry.serviceName,
        team_member_id: asNullableText(waitlistEntry.teamMemberId),
        team_member_name: waitlistEntry.teamMemberName ?? '',
        appointment_date: waitlistEntry.appointmentDate,
        preferred_time: asTime(waitlistEntry.preferredTime),
        customer_key: waitlistEntry.customerKey,
        customer_name: waitlistEntry.customerName,
        customer_phone: waitlistEntry.customerPhone,
        customer_email: waitlistEntry.customerEmail,
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

