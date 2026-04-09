import type { AppointmentStore } from './appointment.store';
import type {
  AppointmentRecord,
  LoyaltyRewardRecord,
  PaymentRecord,
  PackagePurchaseRecord,
  ReviewRecord,
  WaitlistRecord
} from './appointment.types';
import { AppointmentFileStore } from './storage/appointmentFile.store';
import { AppointmentMemoryStore } from './storage/appointmentMemory.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const createStore = (): AppointmentStore => {
  const useMemory =
    isTestEnvironment() ||
    isVercelRuntime() ||
    process.env.CLIENT_PLATFORM_STORAGE === 'memory';

  return useMemory ? new AppointmentMemoryStore() : new AppointmentFileStore();
};

class AppointmentRepository {
  private readonly store: AppointmentStore;

  constructor(store: AppointmentStore = createStore()) {
    this.store = store;
  }

  listAppointments(): Promise<AppointmentRecord[]> {
    return this.store.listAppointments();
  }

  listPaymentRecords(): Promise<PaymentRecord[]> {
    return this.store.listPaymentRecords();
  }

  listReviews(): Promise<ReviewRecord[]> {
    return this.store.listReviews();
  }

  listPackagePurchases(): Promise<PackagePurchaseRecord[]> {
    return this.store.listPackagePurchases();
  }

  listLoyaltyRewards(): Promise<LoyaltyRewardRecord[]> {
    return this.store.listLoyaltyRewards();
  }

  listWaitlistEntries(): Promise<WaitlistRecord[]> {
    return this.store.listWaitlistEntries();
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
