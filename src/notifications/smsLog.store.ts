import type { SmsLogRecord } from './smsLog.types';

export interface SmsLogState {
  smsLogs: SmsLogRecord[];
}

export interface SmsLogStore {
  listSmsLogs(): Promise<SmsLogRecord[]>;
  saveSmsLog(record: SmsLogRecord): Promise<SmsLogRecord>;
  reset(): Promise<void>;
}

export const createDefaultSmsLogState = (): SmsLogState => ({
  smsLogs: []
});
