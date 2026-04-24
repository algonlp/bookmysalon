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
  deleteAppointmentFromRelational,
  deleteBusinessFromRelational,
  deleteLoyaltyRewardFromRelational,
  deletePackagePurchaseFromRelational,
  deletePaymentRecordFromRelational,
  deleteReviewFromRelational,
  deleteWaitlistEntryFromRelational,
  relationalBusinessExists,
  syncAppointmentToRelational,
  syncLoyaltyRewardToRelational,
  syncPackagePurchaseToRelational,
  syncPaymentRecordToRelational,
  syncReviewToRelational,
  syncWaitlistEntryToRelational
} from '../../shared/supabase/relationalMirror';
import { logger } from '../../shared/logger';

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

interface BusinessScopedRecord {
  id: string;
  businessId: string;
}

const asErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const saveWithAutomaticRollback = async <TRecord extends BusinessScopedRecord>(
  table: SupabaseJsonbTable<TRecord>,
  record: TRecord,
  label: string,
  syncRelational: (value: TRecord) => Promise<void>,
  deleteRelational: (recordId: string) => Promise<void>
): Promise<TRecord> => {
  const previousRecord = await table.getById(record.id);
  const businessExisted = await relationalBusinessExists(record.businessId);

  try {
    await table.upsert(record);
    await syncRelational(record);
    return record;
  } catch (error) {
    try {
      if (previousRecord) {
        await table.upsert(previousRecord);
        await syncRelational(previousRecord);
      } else {
        await table.deleteById(record.id);
        await deleteRelational(record.id);

        if (!businessExisted) {
          await deleteBusinessFromRelational(record.businessId);
        }
      }
    } catch (rollbackError) {
      logger.error('Failed to rollback Supabase persistence after relational sync error', {
        label,
        recordId: record.id,
        businessId: record.businessId,
        error: asErrorMessage(error),
        rollbackError: asErrorMessage(rollbackError)
      });

      throw new Error(
        `Failed to save ${label} ${record.id}: ${asErrorMessage(error)}. Rollback failed: ${asErrorMessage(rollbackError)}`
      );
    }

    throw error;
  }
};

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
    return saveWithAutomaticRollback(
      appointmentTable,
      appointment,
      'appointment',
      syncAppointmentToRelational,
      deleteAppointmentFromRelational
    );
  }

  async savePaymentRecord(paymentRecord: PaymentRecord): Promise<PaymentRecord> {
    return saveWithAutomaticRollback(
      paymentTable,
      paymentRecord,
      'payment record',
      syncPaymentRecordToRelational,
      deletePaymentRecordFromRelational
    );
  }

  async saveReview(review: ReviewRecord): Promise<ReviewRecord> {
    return saveWithAutomaticRollback(
      reviewTable,
      review,
      'review',
      syncReviewToRelational,
      deleteReviewFromRelational
    );
  }

  async savePackagePurchase(packagePurchase: PackagePurchaseRecord): Promise<PackagePurchaseRecord> {
    return saveWithAutomaticRollback(
      packagePurchaseTable,
      packagePurchase,
      'package purchase',
      syncPackagePurchaseToRelational,
      deletePackagePurchaseFromRelational
    );
  }

  async saveLoyaltyReward(loyaltyReward: LoyaltyRewardRecord): Promise<LoyaltyRewardRecord> {
    return saveWithAutomaticRollback(
      loyaltyRewardTable,
      loyaltyReward,
      'loyalty reward',
      syncLoyaltyRewardToRelational,
      deleteLoyaltyRewardFromRelational
    );
  }

  async saveWaitlistEntry(waitlistEntry: WaitlistRecord): Promise<WaitlistRecord> {
    return saveWithAutomaticRollback(
      waitlistTable,
      waitlistEntry,
      'waitlist entry',
      syncWaitlistEntryToRelational,
      deleteWaitlistEntryFromRelational
    );
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
