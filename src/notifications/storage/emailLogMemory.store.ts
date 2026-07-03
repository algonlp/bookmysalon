import type { EmailLogRecord } from '../emailLog.types';
import { createDefaultEmailLogState, type EmailLogState, type EmailLogStore } from '../emailLog.store';

export class EmailLogMemoryStore implements EmailLogStore {
  private state: EmailLogState = createDefaultEmailLogState();

  async listEmailLogs(): Promise<EmailLogRecord[]> {
    return [...this.state.emailLogs];
  }

  async saveEmailLog(record: EmailLogRecord): Promise<EmailLogRecord> {
    this.state.emailLogs.push(record);
    return record;
  }

  async reset(): Promise<void> {
    this.state = createDefaultEmailLogState();
  }
}
