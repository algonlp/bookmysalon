import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { PlatformSettingsRecord } from '../platformSettings.types';
import type { PlatformSettingsStore } from '../platformSettings.store';

export class PlatformSettingsFileStore implements PlatformSettingsStore {
  private readonly storagePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'platform-settings.json')) {
    this.storagePath = storagePath;
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.writeChain.then(operation, operation);
    this.writeChain = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  async get(): Promise<PlatformSettingsRecord | null> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      return null;
    }

    const raw = await readFile(this.storagePath, 'utf-8');
    return raw.trim() ? (JSON.parse(raw) as PlatformSettingsRecord) : null;
  }

  async save(record: PlatformSettingsRecord): Promise<PlatformSettingsRecord> {
    return this.withWriteLock(async () => {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(this.storagePath, JSON.stringify(record, null, 2), 'utf-8');
      return record;
    });
  }

  async reset(): Promise<void> {
    return this.withWriteLock(async () => {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(this.storagePath, '', 'utf-8');
    });
  }
}
