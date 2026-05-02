import { env } from '../config/env';
import type { SmsLogRecord } from './smsLog.types';
import type { SmsLogStore } from './smsLog.store';
import { SmsLogFileStore } from './storage/smsLogFile.store';
import { SmsLogMemoryStore } from './storage/smsLogMemory.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const getConfiguredStoreType = (): 'file' | 'memory' => {
  if (isTestEnvironment()) {
    return 'memory';
  }

  if (env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return 'memory';
  }

  return isVercelRuntime() ? 'memory' : 'file';
};

const createStore = (): SmsLogStore => {
  const storeType = getConfiguredStoreType();
  return storeType === 'memory' ? new SmsLogMemoryStore() : new SmsLogFileStore();
};

class SmsLogRepository {
  private readonly store: SmsLogStore;

  constructor(store: SmsLogStore = createStore()) {
    this.store = store;
  }

  listSmsLogs(): Promise<SmsLogRecord[]> {
    return this.store.listSmsLogs();
  }

  saveSmsLog(record: SmsLogRecord): Promise<SmsLogRecord> {
    return this.store.saveSmsLog(record);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const smsLogRepository = new SmsLogRepository();

export const resetSmsLogRepositoryForTests = (): Promise<void> => smsLogRepository.resetForTests();
