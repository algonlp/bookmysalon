import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { SmsLogRecord } from '../smsLog.types';
import {
  createDefaultSmsLogState,
  type SmsLogState,
  type SmsLogStore
} from '../smsLog.store';

export class SmsLogFileStore implements SmsLogStore {
  private readonly storagePath: string;
  private state: SmsLogState = createDefaultSmsLogState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'sms-logs.json')) {
    this.storagePath = storagePath;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(
        this.storagePath,
        JSON.stringify(createDefaultSmsLogState(), null, 2),
        'utf-8'
      );
    }
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();

    const rawState = await readFile(this.storagePath, 'utf-8');
    const parsedState = rawState.trim()
      ? (JSON.parse(rawState) as Partial<SmsLogState>)
      : createDefaultSmsLogState();
    this.state = {
      smsLogs: parsedState.smsLogs ?? []
    };
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await this.loadStateFromDisk();
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.writeChain.then(operation, operation);
    this.writeChain = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.storagePath), { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  async listSmsLogs(): Promise<SmsLogRecord[]> {
    await this.ensureLoaded();
    return [...this.state.smsLogs];
  }

  async saveSmsLog(record: SmsLogRecord): Promise<SmsLogRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      this.state.smsLogs.push(record);
      await this.persist();
      return record;
    });
  }

  async reset(): Promise<void> {
    await this.withWriteLock(async () => {
      this.state = createDefaultSmsLogState();
      this.loaded = true;
      await this.persist();
    });
  }
}
