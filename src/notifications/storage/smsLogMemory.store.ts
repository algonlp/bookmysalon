import type { SmsLogRecord } from '../smsLog.types';
import { createDefaultSmsLogState, type SmsLogState, type SmsLogStore } from '../smsLog.store';

export class SmsLogMemoryStore implements SmsLogStore {
  private state: SmsLogState = createDefaultSmsLogState();

  async listSmsLogs(): Promise<SmsLogRecord[]> {
    return [...this.state.smsLogs];
  }

  async saveSmsLog(record: SmsLogRecord): Promise<SmsLogRecord> {
    this.state.smsLogs.push(record);
    return record;
  }

  async reset(): Promise<void> {
    this.state = createDefaultSmsLogState();
  }
}
