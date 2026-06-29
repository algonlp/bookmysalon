import type { AppointmentStore } from './appointment.store';
import type {
  AppointmentRecord,
  LoyaltyRewardRecord,
  PaymentRecord,
  PackagePurchaseRecord,
  ReviewRecord,
  WaitlistRecord
} from './appointment.types';
import { env } from '../config/env';
import { AppointmentFileStore } from './storage/appointmentFile.store';
import { AppointmentMemoryStore } from './storage/appointmentMemory.store';
import { AppointmentSupabaseStore } from './storage/appointmentSupabase.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const hasSupabaseConfiguration = (): boolean =>
  Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY));

const getConfiguredStoreType = (): 'file' | 'memory' | 'supabase' => {
  if (isTestEnvironment()) {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'supabase') {
    return hasSupabaseConfiguration() ? 'supabase' : 'file';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'file') {
    return 'file';
  }

  return isVercelRuntime() ? 'memory' : 'file';
};

const createStore = (): AppointmentStore => {
  const storeType = getConfiguredStoreType();
  if (storeType === 'memory') {
    return new AppointmentMemoryStore();
  }

  if (storeType === 'supabase') {
    return new AppointmentSupabaseStore();
  }

  return new AppointmentFileStore();
};

class AppointmentRepository {
  private readonly store: AppointmentStore;

  constructor(store: AppointmentStore = createStore()) {
    this.store = store;
  }

  listAppointments(): Promise<AppointmentRecord[]> {
    return this.store.listAppointments();
  }

  listAppointmentsByBusinessId(businessId: string): Promise<AppointmentRecord[]> {
    return this.store.listAppointmentsByBusinessId(businessId);
  }

  listPaymentRecords(): Promise<PaymentRecord[]> {
    return this.store.listPaymentRecords();
  }

  listPaymentRecordsByBusinessId(businessId: string): Promise<PaymentRecord[]> {
    return this.store.listPaymentRecordsByBusinessId(businessId);
  }

  listReviews(): Promise<ReviewRecord[]> {
    return this.store.listReviews();
  }

  listReviewsByBusinessId(businessId: string): Promise<ReviewRecord[]> {
    return this.store.listReviewsByBusinessId(businessId);
  }

  listPackagePurchases(): Promise<PackagePurchaseRecord[]> {
    return this.store.listPackagePurchases();
  }

  listPackagePurchasesByBusinessId(businessId: string): Promise<PackagePurchaseRecord[]> {
    return this.store.listPackagePurchasesByBusinessId(businessId);
  }

  listLoyaltyRewards(): Promise<LoyaltyRewardRecord[]> {
    return this.store.listLoyaltyRewards();
  }

  listLoyaltyRewardsByBusinessId(businessId: string): Promise<LoyaltyRewardRecord[]> {
    return this.store.listLoyaltyRewardsByBusinessId(businessId);
  }

  listWaitlistEntries(): Promise<WaitlistRecord[]> {
    return this.store.listWaitlistEntries();
  }

  listWaitlistEntriesByBusinessId(businessId: string): Promise<WaitlistRecord[]> {
    return this.store.listWaitlistEntriesByBusinessId(businessId);
  }

  saveAppointment(appointment: AppointmentRecord): Promise<AppointmentRecord> {
    return this.store.saveAppointment(appointment);
  }

  savePaymentRecord(paymentRecord: PaymentRecord): Promise<PaymentRecord> {
    return this.store.savePaymentRecord(paymentRecord);
  }

  saveReview(review: ReviewRecord): Promise<ReviewRecord> {
    return this.store.saveReview(review);
  }

  savePackagePurchase(packagePurchase: PackagePurchaseRecord): Promise<PackagePurchaseRecord> {
    return this.store.savePackagePurchase(packagePurchase);
  }

  saveLoyaltyReward(loyaltyReward: LoyaltyRewardRecord): Promise<LoyaltyRewardRecord> {
    return this.store.saveLoyaltyReward(loyaltyReward);
  }

  saveWaitlistEntry(waitlistEntry: WaitlistRecord): Promise<WaitlistRecord> {
    return this.store.saveWaitlistEntry(waitlistEntry);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const appointmentRepository = new AppointmentRepository();

export const resetAppointmentRepositoryForTests = (): Promise<void> => {
  return appointmentRepository.resetForTests();
};
