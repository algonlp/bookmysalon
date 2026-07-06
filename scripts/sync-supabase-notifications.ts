import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { getSupabaseClient } from '../src/shared/supabase/client';
import type { EmailLogState } from '../src/notifications/emailLog.store';
import type { SmsLogState } from '../src/notifications/smsLog.store';
import { toJsonValue } from '../src/shared/supabase/jsonbTable';

// This business id is stale test/demo data that predates the current live
// Supabase businesses (see git history: "Reset demo and test data ahead of
// real salon launches"). Records referencing it must not be migrated.
const STALE_TEST_BUSINESS_ID = '4a3b9419-7244-4fb5-99f8-771afb24ce7f';

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
  const emailLogsPath = resolve(process.cwd(), 'data', 'email-logs.json');
  const smsLogsPath = resolve(process.cwd(), 'data', 'sms-logs.json');

  const [emailLogState, smsLogState] = await Promise.all([
    loadJsonFile<EmailLogState>(emailLogsPath),
    loadJsonFile<SmsLogState>(smsLogsPath)
  ]);

  const liveEmailLogs = emailLogState.emailLogs.filter(
    (record) => record.businessId !== STALE_TEST_BUSINESS_ID
  );
  const liveSmsLogs = smsLogState.smsLogs.filter(
    (record) => record.businessId !== STALE_TEST_BUSINESS_ID
  );

  const skippedEmailLogs = emailLogState.emailLogs.length - liveEmailLogs.length;
  const skippedSmsLogs = smsLogState.smsLogs.length - liveSmsLogs.length;

  const totals = await Promise.all([
    upsertRows(
      'email_log_records',
      liveEmailLogs.map((record) => ({
        id: record.id,
        business_id: record.businessId,
        appointment_id: record.appointmentId ?? '',
        payload: toJsonValue(record)
      }))
    ),
    upsertRows(
      'sms_log_records',
      liveSmsLogs.map((record) => ({
        id: record.id,
        business_id: record.businessId,
        appointment_id: record.appointmentId ?? '',
        waitlist_entry_id: record.waitlistEntryId ?? '',
        payload: toJsonValue(record)
      }))
    )
  ]);

  console.log('Supabase notification sync complete.');
  console.log(`Email logs synced: ${totals[0]} (skipped ${skippedEmailLogs} stale test records)`);
  console.log(`SMS logs synced: ${totals[1]} (skipped ${skippedSmsLogs} stale test records)`);
  console.log(
    'Customer accounts skipped entirely: data/customer-accounts.json only contains the stale test account.'
  );
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
