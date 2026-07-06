import type { EmailLogRecord } from '../emailLog.types';
import type { EmailLogStore } from '../emailLog.store';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';

const emailLogTable = new SupabaseJsonbTable<EmailLogRecord>({
  tableName: 'email_log_records',
  mapToRow: (record) => ({
    id: record.id,
    business_id: record.businessId,
    appointment_id: record.appointmentId ?? '',
    payload: toJsonValue(record)
  })
});

export class EmailLogSupabaseStore implements EmailLogStore {
  listEmailLogs(): Promise<EmailLogRecord[]> {
    return emailLogTable.list();
  }

  saveEmailLog(record: EmailLogRecord): Promise<EmailLogRecord> {
    return emailLogTable.upsert(record);
  }

  reset(): Promise<void> {
    return emailLogTable.reset();
  }
}
