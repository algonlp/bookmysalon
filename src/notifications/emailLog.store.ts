import type { EmailLogRecord } from './emailLog.types';

export interface EmailLogState {
  emailLogs: EmailLogRecord[];
}

export interface EmailLogStore {
  listEmailLogs(): Promise<EmailLogRecord[]>;
  saveEmailLog(record: EmailLogRecord): Promise<EmailLogRecord>;
  reset(): Promise<void>;
}

export const createDefaultEmailLogState = (): EmailLogState => ({
  emailLogs: []
});
