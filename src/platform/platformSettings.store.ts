import type { PlatformSettingsRecord } from './platformSettings.types';

export interface PlatformSettingsStore {
  get(): Promise<PlatformSettingsRecord | null>;
  save(record: PlatformSettingsRecord): Promise<PlatformSettingsRecord>;
  reset(): Promise<void>;
}
