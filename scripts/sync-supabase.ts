import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { getSupabaseClient } from '../src/shared/supabase/client';
import type { AppointmentState } from '../src/appointments/appointment.store';
import type { ClientPlatformState } from '../src/platform/clientPlatform.store';
import { toJsonValue } from '../src/shared/supabase/jsonbTable';

const loadJsonFile = async <T>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
};

const upsertRows = async (
  tableName: string,
  rows: Array<Record<string, unknown>>
): Promise<number> => {
  if (rows.length === 0) {
    return 0;
  }

  const client = getSupabaseClient();
  const { error } = await client.from(tableName).upsert(rows, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to sync ${tableName}: ${error.message}`);
  }

  return rows.length;
};

const main = async (): Promise<void> => {
  const appointmentsPath = resolve(process.cwd(), 'data', 'appointments.json');
  const clientsPath = resolve(process.cwd(), 'data', 'client-platform.json');

  const [appointmentState, clientPlatformState] = await Promise.all([
    loadJsonFile<AppointmentState>(appointmentsPath),
    loadJsonFile<ClientPlatformState>(clientsPath)
  ]);

  const totals = await Promise.all([
    upsertRows(
      'client_platform_clients',
      clientPlatformState.clients.map((client) => ({
        id: client.id,
        email: client.email,
        business_name: client.businessName,
        mobile_number: client.mobileNumber,
        payload: toJsonValue(client)
      }))
    ),
    upsertRows(
      'product_sale_records',
      clientPlatformState.clients.flatMap((client) =>
        client.productSales.map((productSale) => ({
          id: productSale.id,
          business_id: client.id,
          product_id: productSale.productId,
          customer_phone: productSale.customerPhone,
          sold_at: productSale.soldAt,
          payload: toJsonValue(productSale)
        }))
      )
    ),
    upsertRows(
      'appointment_records',
      appointmentState.appointments.map((appointment) => ({
        id: appointment.id,
        business_id: appointment.businessId,
        customer_phone: appointment.customerPhone,
        appointment_date: appointment.appointmentDate,
        payload: toJsonValue(appointment)
      }))
    ),
    upsertRows(
      'payment_records',
      appointmentState.paymentRecords.map((paymentRecord) => ({
        id: paymentRecord.id,
        business_id: paymentRecord.businessId,
        appointment_id: paymentRecord.appointmentId,
        payload: toJsonValue(paymentRecord)
      }))
    ),
    upsertRows(
      'review_records',
      appointmentState.reviews.map((review) => ({
        id: review.id,
        business_id: review.businessId,
        appointment_id: review.appointmentId,
        payload: toJsonValue(review)
      }))
    ),
    upsertRows(
      'package_purchase_records',
      appointmentState.packagePurchases.map((packagePurchase) => ({
        id: packagePurchase.id,
        business_id: packagePurchase.businessId,
        customer_phone: packagePurchase.customerPhone,
        payload: toJsonValue(packagePurchase)
      }))
    ),
    upsertRows(
      'loyalty_reward_records',
      appointmentState.loyaltyRewards.map((loyaltyReward) => ({
        id: loyaltyReward.id,
        business_id: loyaltyReward.businessId,
        customer_phone: loyaltyReward.customerPhone,
        payload: toJsonValue(loyaltyReward)
      }))
    ),
    upsertRows(
      'waitlist_records',
      appointmentState.waitlistEntries.map((waitlistEntry) => ({
        id: waitlistEntry.id,
        business_id: waitlistEntry.businessId,
        customer_phone: waitlistEntry.customerPhone,
        appointment_date: waitlistEntry.appointmentDate,
        payload: toJsonValue(waitlistEntry)
      }))
    )
  ]);

  console.log('Supabase sync complete.');
  console.log(`Clients synced: ${totals[0]}`);
  console.log(`Product sales synced: ${totals[1]}`);
  console.log(`Appointments synced: ${totals[2]}`);
  console.log(`Payments synced: ${totals[3]}`);
  console.log(`Reviews synced: ${totals[4]}`);
  console.log(`Package purchases synced: ${totals[5]}`);
  console.log(`Loyalty rewards synced: ${totals[6]}`);
  console.log(`Waitlist entries synced: ${totals[7]}`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
