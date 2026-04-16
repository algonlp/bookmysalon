import { getSupabaseClient } from '../src/shared/supabase/client';
import type { AppointmentRecord, LoyaltyRewardRecord, PackagePurchaseRecord, PaymentRecord, ReviewRecord, WaitlistRecord } from '../src/appointments/appointment.types';
import type { AppointmentState } from '../src/appointments/appointment.store';
import type { ClientRecord } from '../src/platform/clientPlatform.types';
import type { ClientPlatformState } from '../src/platform/clientPlatform.store';
import {
  syncAppointmentStateToRelational,
  syncClientPlatformStateToRelational
} from '../src/shared/supabase/relationalMirror';

const loadPayloadRecords = async <TRecord>(tableName: string): Promise<TRecord[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client.from(tableName).select('payload').order('id', { ascending: true });

  if (error) {
    throw new Error(`Failed to read ${tableName}: ${error.message}`);
  }

  return (data ?? []).map((row) => row.payload as TRecord);
};

const main = async (): Promise<void> => {
  const [
    clients,
    appointments,
    paymentRecords,
    reviews,
    packagePurchases,
    loyaltyRewards,
    waitlistEntries
  ] = await Promise.all([
    loadPayloadRecords<ClientRecord>('client_platform_clients'),
    loadPayloadRecords<AppointmentRecord>('appointment_records'),
    loadPayloadRecords<PaymentRecord>('payment_records'),
    loadPayloadRecords<ReviewRecord>('review_records'),
    loadPayloadRecords<PackagePurchaseRecord>('package_purchase_records'),
    loadPayloadRecords<LoyaltyRewardRecord>('loyalty_reward_records'),
    loadPayloadRecords<WaitlistRecord>('waitlist_records')
  ]);

  const clientPlatformState: ClientPlatformState = { clients };
  const appointmentState: AppointmentState = {
    appointments,
    paymentRecords,
    reviews,
    packagePurchases,
    loyaltyRewards,
    waitlistEntries
  };

  await syncClientPlatformStateToRelational(clientPlatformState);
  await syncAppointmentStateToRelational(appointmentState);

  console.log('Supabase relational backfill complete.');
  console.log(`Businesses synced: ${clients.length}`);
  console.log(`Appointments synced: ${appointments.length}`);
  console.log(`Payments synced: ${paymentRecords.length}`);
  console.log(`Reviews synced: ${reviews.length}`);
  console.log(`Package purchases synced: ${packagePurchases.length}`);
  console.log(`Loyalty rewards synced: ${loyaltyRewards.length}`);
  console.log(`Waitlist entries synced: ${waitlistEntries.length}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
