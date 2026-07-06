import type { SmsLogRecord } from '../smsLog.types';
import type { SmsLogStore } from '../smsLog.store';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';

const smsLogTable = new SupabaseJsonbTable<SmsLogRecord>({
  tableName: 'sms_log_records',
  mapToRow: (record) => ({
    id: record.id,
    business_id: record.businessId,
    appointment_id: record.appointmentId ?? '',
    waitlist_entry_id: record.waitlistEntryId ?? '',
    payload: toJsonValue(record)
  })
});

export class SmsLogSupabaseStore implements SmsLogStore {
  listSmsLogs(): Promise<SmsLogRecord[]> {
    return smsLogTable.list();
  }

  saveSmsLog(record: SmsLogRecord): Promise<SmsLogRecord> {
    return smsLogTable.upsert(record);
  }

  reset(): Promise<void> {
    return smsLogTable.reset();
  }
}
