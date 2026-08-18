import type { PlatformSettingsRecord } from '../platformSettings.types';
import type { PlatformSettingsStore } from '../platformSettings.store';

export class PlatformSettingsMemoryStore implements PlatformSettingsStore {
  private record: PlatformSettingsRecord | null = null;

  async get(): Promise<PlatformSettingsRecord | null> {
    return this.record;
  }

  async save(record: PlatformSettingsRecord): Promise<PlatformSettingsRecord> {
    this.record = record;
    return record;
  }

  async reset(): Promise<void> {
    this.record = null;
  }
}
