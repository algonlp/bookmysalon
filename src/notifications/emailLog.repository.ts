import { env } from '../config/env';
import { isTestEnvironment } from '../shared/runtimeEnv';
import type { EmailLogRecord } from './emailLog.types';
import type { EmailLogStore } from './emailLog.store';
import { EmailLogFileStore } from './storage/emailLogFile.store';
import { EmailLogMemoryStore } from './storage/emailLogMemory.store';
import { EmailLogSupabaseStore } from './storage/emailLogSupabase.store';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const hasSupabaseConfiguration = (): boolean =>
  Boolean(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY));

const getConfiguredStoreType = (): 'file' | 'memory' | 'supabase' => {
  if (isTestEnvironment()) {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'supabase') {
    return hasSupabaseConfiguration() ? 'supabase' : 'file';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'file') {
    return 'file';
  }

  return isVercelRuntime() ? 'memory' : 'file';
};

const createStore = (): EmailLogStore => {
  const storeType = getConfiguredStoreType();
  if (storeType === 'memory') {
    return new EmailLogMemoryStore();
  }

  if (storeType === 'supabase') {
    return new EmailLogSupabaseStore();
  }

  return new EmailLogFileStore();
};

class EmailLogRepository {
  private readonly store: EmailLogStore;

  constructor(store: EmailLogStore = createStore()) {
    this.store = store;
  }

  listEmailLogs(): Promise<EmailLogRecord[]> {
    return this.store.listEmailLogs();
  }

  saveEmailLog(record: EmailLogRecord): Promise<EmailLogRecord> {
    return this.store.saveEmailLog(record);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const emailLogRepository = new EmailLogRepository();

export const resetEmailLogRepositoryForTests = (): Promise<void> => emailLogRepository.resetForTests();
