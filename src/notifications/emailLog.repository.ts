import { env } from '../config/env';
import { isTestEnvironment } from '../shared/runtimeEnv';
import type { EmailLogRecord } from './emailLog.types';
import type { EmailLogStore } from './emailLog.store';
import { EmailLogFileStore } from './storage/emailLogFile.store';
import { EmailLogMemoryStore } from './storage/emailLogMemory.store';

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

const createStore = (): EmailLogStore => {
  const storeType = getConfiguredStoreType();
  return storeType === 'memory' ? new EmailLogMemoryStore() : new EmailLogFileStore();
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
