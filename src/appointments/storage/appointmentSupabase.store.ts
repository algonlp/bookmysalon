import type {
  AppointmentRecord,
  LoyaltyRewardRecord,
  PackagePurchaseRecord,
  PaymentRecord,
  ReviewRecord,
  WaitlistRecord
} from '../appointment.types';
import type { AppointmentStore } from '../appointment.store';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';
import {
  syncAppointmentToRelational,
  syncLoyaltyRewardToRelational,
  syncPackagePurchaseToRelational,
  syncPaymentRecordToRelational,
  syncReviewToRelational,
  syncWaitlistEntryToRelational
} from '../../shared/supabase/relationalMirror';

const appointmentTable = new SupabaseJsonbTable<AppointmentRecord>({
  tableName: 'appointment_records',
  mapToRow: (appointment) => ({
    id: appointment.id,
    business_id: appointment.businessId,
    customer_phone: appointment.customerPhone,
    appointment_date: appointment.appointmentDate,
    payload: toJsonValue(appointment)
  })
});

const paymentTable = new SupabaseJsonbTable<PaymentRecord>({
  tableName: 'payment_records',
  mapToRow: (paymentRecord) => ({
    id: paymentRecord.id,
    business_id: paymentRecord.businessId,
    appointment_id: paymentRecord.appointmentId,
    payload: toJsonValue(paymentRecord)
  })
});

const reviewTable = new SupabaseJsonbTable<ReviewRecord>({
  tableName: 'review_records',
  mapToRow: (review) => ({
    id: review.id,
    business_id: review.businessId,
    appointment_id: review.appointmentId,
    payload: toJsonValue(review)
  })
});

const packagePurchaseTable = new SupabaseJsonbTable<PackagePurchaseRecord>({
  tableName: 'package_purchase_records',
  mapToRow: (packagePurchase) => ({
    id: packagePurchase.id,
    business_id: packagePurchase.businessId,
    customer_phone: packagePurchase.customerPhone,
    payload: toJsonValue(packagePurchase)
  })
});

const loyaltyRewardTable = new SupabaseJsonbTable<LoyaltyRewardRecord>({
  tableName: 'loyalty_reward_records',
  mapToRow: (loyaltyReward) => ({
    id: loyaltyReward.id,
    business_id: loyaltyReward.businessId,
    customer_phone: loyaltyReward.customerPhone,
    payload: toJsonValue(loyaltyReward)
  })
});

const waitlistTable = new SupabaseJsonbTable<WaitlistRecord>({
  tableName: 'waitlist_records',
  mapToRow: (waitlistEntry) => ({
    id: waitlistEntry.id,
    business_id: waitlistEntry.businessId,
    customer_phone: waitlistEntry.customerPhone,
    appointment_date: waitlistEntry.appointmentDate,
    payload: toJsonValue(waitlistEntry)
  })
});

export class AppointmentSupabaseStore implements AppointmentStore {
  listAppointments(): Promise<AppointmentRecord[]> {
    return appointmentTable.list();
  }

  listPaymentRecords(): Promise<PaymentRecord[]> {
    return paymentTable.list();
  }

  listReviews(): Promise<ReviewRecord[]> {
    return reviewTable.list();
  }

  listPackagePurchases(): Promise<PackagePurchaseRecord[]> {
    return packagePurchaseTable.list();
  }

  listLoyaltyRewards(): Promise<LoyaltyRewardRecord[]> {
    return loyaltyRewardTable.list();
  }

  listWaitlistEntries(): Promise<WaitlistRecord[]> {
    return waitlistTable.list();
  }

  async saveAppointment(appointment: AppointmentRecord): Promise<AppointmentRecord> {
    await appointmentTable.upsert(appointment);
    await syncAppointmentToRelational(appointment);
    return appointment;
  }

  async savePaymentRecord(paymentRecord: PaymentRecord): Promise<PaymentRecord> {
    await paymentTable.upsert(paymentRecord);
    await syncPaymentRecordToRelational(paymentRecord);
    return paymentRecord;
  }

  async saveReview(review: ReviewRecord): Promise<ReviewRecord> {
    await reviewTable.upsert(review);
    await syncReviewToRelational(review);
    return review;
  }

  async savePackagePurchase(packagePurchase: PackagePurchaseRecord): Promise<PackagePurchaseRecord> {
    await packagePurchaseTable.upsert(packagePurchase);
    await syncPackagePurchaseToRelational(packagePurchase);
    return packagePurchase;
  }

  async saveLoyaltyReward(loyaltyReward: LoyaltyRewardRecord): Promise<LoyaltyRewardRecord> {
    await loyaltyRewardTable.upsert(loyaltyReward);
    await syncLoyaltyRewardToRelational(loyaltyReward);
    return loyaltyReward;
  }

  async saveWaitlistEntry(waitlistEntry: WaitlistRecord): Promise<WaitlistRecord> {
    await waitlistTable.upsert(waitlistEntry);
    await syncWaitlistEntryToRelational(waitlistEntry);
    return waitlistEntry;
  }

  async reset(): Promise<void> {
    await Promise.all([
      appointmentTable.reset(),
      paymentTable.reset(),
      reviewTable.reset(),
      packagePurchaseTable.reset(),
      loyaltyRewardTable.reset(),
      waitlistTable.reset()
    ]);
  }
}
