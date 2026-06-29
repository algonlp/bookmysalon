import type {
  AppointmentRecord,
  LoyaltyRewardRecord,
  PaymentRecord,
  PackagePurchaseRecord,
  ReviewRecord,
  WaitlistRecord
} from '../appointment.types';
import {
  createDefaultAppointmentState,
  type AppointmentState,
  type AppointmentStore
} from '../appointment.store';

export class AppointmentMemoryStore implements AppointmentStore {
  private state: AppointmentState = createDefaultAppointmentState();

  async listAppointments(): Promise<AppointmentRecord[]> {
    return [...this.state.appointments];
  }

  async listAppointmentsByBusinessId(businessId: string): Promise<AppointmentRecord[]> {
    return this.state.appointments.filter((record) => record.businessId === businessId);
  }

  async listPaymentRecords(): Promise<PaymentRecord[]> {
    return [...this.state.paymentRecords];
  }

  async listPaymentRecordsByBusinessId(businessId: string): Promise<PaymentRecord[]> {
    return this.state.paymentRecords.filter((record) => record.businessId === businessId);
  }

  async listReviews(): Promise<ReviewRecord[]> {
    return [...this.state.reviews];
  }

  async listReviewsByBusinessId(businessId: string): Promise<ReviewRecord[]> {
    return this.state.reviews.filter((record) => record.businessId === businessId);
  }

  async listPackagePurchases(): Promise<PackagePurchaseRecord[]> {
    return [...this.state.packagePurchases];
  }

  async listPackagePurchasesByBusinessId(businessId: string): Promise<PackagePurchaseRecord[]> {
    return this.state.packagePurchases.filter((record) => record.businessId === businessId);
  }

  async listLoyaltyRewards(): Promise<LoyaltyRewardRecord[]> {
    return [...this.state.loyaltyRewards];
  }

  async listLoyaltyRewardsByBusinessId(businessId: string): Promise<LoyaltyRewardRecord[]> {
    return this.state.loyaltyRewards.filter((record) => record.businessId === businessId);
  }

  async listWaitlistEntries(): Promise<WaitlistRecord[]> {
    return [...this.state.waitlistEntries];
  }

  async listWaitlistEntriesByBusinessId(businessId: string): Promise<WaitlistRecord[]> {
    return this.state.waitlistEntries.filter((record) => record.businessId === businessId);
  }

  async saveAppointment(appointment: AppointmentRecord): Promise<AppointmentRecord> {
    const existingIndex = this.state.appointments.findIndex((entry) => entry.id === appointment.id);

    if (existingIndex >= 0) {
      this.state.appointments[existingIndex] = appointment;
    } else {
      this.state.appointments.push(appointment);
    }

    return appointment;
  }

  async savePaymentRecord(paymentRecord: PaymentRecord): Promise<PaymentRecord> {
    const existingIndex = this.state.paymentRecords.findIndex((entry) => entry.id === paymentRecord.id);

    if (existingIndex >= 0) {
      this.state.paymentRecords[existingIndex] = paymentRecord;
    } else {
      this.state.paymentRecords.push(paymentRecord);
    }

    return paymentRecord;
  }

  async saveReview(review: ReviewRecord): Promise<ReviewRecord> {
    const existingIndex = this.state.reviews.findIndex((entry) => entry.id === review.id);

    if (existingIndex >= 0) {
      this.state.reviews[existingIndex] = review;
    } else {
      this.state.reviews.push(review);
    }

    return review;
  }

  async savePackagePurchase(packagePurchase: PackagePurchaseRecord): Promise<PackagePurchaseRecord> {
    const existingIndex = this.state.packagePurchases.findIndex(
      (entry) => entry.id === packagePurchase.id
    );

    if (existingIndex >= 0) {
      this.state.packagePurchases[existingIndex] = packagePurchase;
    } else {
      this.state.packagePurchases.push(packagePurchase);
    }

    return packagePurchase;
  }

  async saveLoyaltyReward(loyaltyReward: LoyaltyRewardRecord): Promise<LoyaltyRewardRecord> {
    const existingIndex = this.state.loyaltyRewards.findIndex(
      (entry) => entry.id === loyaltyReward.id
    );

    if (existingIndex >= 0) {
      this.state.loyaltyRewards[existingIndex] = loyaltyReward;
    } else {
      this.state.loyaltyRewards.push(loyaltyReward);
    }

    return loyaltyReward;
  }

  async saveWaitlistEntry(waitlistEntry: WaitlistRecord): Promise<WaitlistRecord> {
    const existingIndex = this.state.waitlistEntries.findIndex(
      (entry) => entry.id === waitlistEntry.id
    );

    if (existingIndex >= 0) {
      this.state.waitlistEntries[existingIndex] = waitlistEntry;
    } else {
      this.state.waitlistEntries.push(waitlistEntry);
    }

    return waitlistEntry;
  }

  async reset(): Promise<void> {
    this.state = createDefaultAppointmentState();
  }
}
