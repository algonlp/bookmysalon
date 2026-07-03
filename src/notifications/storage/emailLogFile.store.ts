import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { EmailLogRecord } from '../emailLog.types';
import {
  createDefaultEmailLogState,
  type EmailLogState,
  type EmailLogStore
} from '../emailLog.store';

export class EmailLogFileStore implements EmailLogStore {
  private readonly storagePath: string;
  private state: EmailLogState = createDefaultEmailLogState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'email-logs.json')) {
    this.storagePath = storagePath;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(
        this.storagePath,
        JSON.stringify(createDefaultEmailLogState(), null, 2),
        'utf-8'
      );
    }
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();

    const rawState = await readFile(this.storagePath, 'utf-8');
    const parsedState = rawState.trim()
      ? (JSON.parse(rawState) as Partial<EmailLogState>)
      : createDefaultEmailLogState();
    this.state = {
      emailLogs: parsedState.emailLogs ?? []
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

  async listEmailLogs(): Promise<EmailLogRecord[]> {
    await this.ensureLoaded();
    return [...this.state.emailLogs];
  }

  async saveEmailLog(record: EmailLogRecord): Promise<EmailLogRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      this.state.emailLogs.push(record);
      await this.persist();
      return record;
    });
  }

  async reset(): Promise<void> {
    await this.withWriteLock(async () => {
      this.state = createDefaultEmailLogState();
      this.loaded = true;
      await this.persist();
    });
  }
}
