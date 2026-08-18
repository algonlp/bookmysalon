import { env } from '../config/env';
import type { PlatformSettingsRecord } from './platformSettings.types';
import type { PlatformSettingsStore } from './platformSettings.store';
import { PlatformSettingsFileStore } from './storage/platformSettingsFile.store';
import { PlatformSettingsMemoryStore } from './storage/platformSettingsMemory.store';
import { PlatformSettingsSupabaseStore } from './storage/platformSettingsSupabase.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const hasSupabaseConfiguration = (): boolean =>
  Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY));

const createStore = (): PlatformSettingsStore => {
  if (isTestEnvironment()) {
    return new PlatformSettingsMemoryStore();
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'supabase' && hasSupabaseConfiguration()) {
    return new PlatformSettingsSupabaseStore();
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return new PlatformSettingsMemoryStore();
  }

  return new PlatformSettingsFileStore();
};

class PlatformSettingsRepository {
  private readonly store: PlatformSettingsStore;

  constructor(store: PlatformSettingsStore = createStore()) {
    this.store = store;
  }

  get(): Promise<PlatformSettingsRecord | null> {
    return this.store.get();
  }

  save(record: PlatformSettingsRecord): Promise<PlatformSettingsRecord> {
    return this.store.save(record);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const platformSettingsRepository = new PlatformSettingsRepository();

export const resetPlatformSettingsRepositoryForTests = (): Promise<void> =>
  platformSettingsRepository.resetForTests();
