import type {
  PaymentRecord,
  AppointmentRecord,
  LoyaltyRewardRecord,
  PackagePurchaseRecord,
  ReviewRecord,
  WaitlistRecord
} from './appointment.types';

export interface AppointmentState {
  appointments: AppointmentRecord[];
  paymentRecords: PaymentRecord[];
  reviews: ReviewRecord[];
  packagePurchases: PackagePurchaseRecord[];
  loyaltyRewards: LoyaltyRewardRecord[];
  waitlistEntries: WaitlistRecord[];
}

export interface AppointmentStore {
  listAppointments(): Promise<AppointmentRecord[]>;
  listAppointmentsByBusinessId(businessId: string): Promise<AppointmentRecord[]>;
  listPaymentRecords(): Promise<PaymentRecord[]>;
  listPaymentRecordsByBusinessId(businessId: string): Promise<PaymentRecord[]>;
  listReviews(): Promise<ReviewRecord[]>;
  listReviewsByBusinessId(businessId: string): Promise<ReviewRecord[]>;
  listPackagePurchases(): Promise<PackagePurchaseRecord[]>;
  listPackagePurchasesByBusinessId(businessId: string): Promise<PackagePurchaseRecord[]>;
  listLoyaltyRewards(): Promise<LoyaltyRewardRecord[]>;
  listLoyaltyRewardsByBusinessId(businessId: string): Promise<LoyaltyRewardRecord[]>;
  listWaitlistEntries(): Promise<WaitlistRecord[]>;
  listWaitlistEntriesByBusinessId(businessId: string): Promise<WaitlistRecord[]>;
  saveAppointment(appointment: AppointmentRecord): Promise<AppointmentRecord>;
  savePaymentRecord(paymentRecord: PaymentRecord): Promise<PaymentRecord>;
  saveReview(review: ReviewRecord): Promise<ReviewRecord>;
  savePackagePurchase(packagePurchase: PackagePurchaseRecord): Promise<PackagePurchaseRecord>;
  saveLoyaltyReward(loyaltyReward: LoyaltyRewardRecord): Promise<LoyaltyRewardRecord>;
  saveWaitlistEntry(waitlistEntry: WaitlistRecord): Promise<WaitlistRecord>;
  reset(): Promise<void>;
}

export const createDefaultAppointmentState = (): AppointmentState => ({
  appointments: [],
  paymentRecords: [],
  reviews: [],
  packagePurchases: [],
  loyaltyRewards: [],
  waitlistEntries: []
});
