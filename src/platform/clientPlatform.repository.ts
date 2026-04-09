import type { ClientRecord } from './clientPlatform.types';
import type { ClientPlatformStore } from './clientPlatform.store';
import { ClientPlatformFileStore } from './storage/clientPlatformFile.store';
import { ClientPlatformMemoryStore } from './storage/clientPlatformMemory.store';

const isTestEnvironment = (): boolean =>
  process.env.APP_ENV === 'test' ||
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true';

const isVercelRuntime = (): boolean =>
  process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const getConfiguredStoreType = (): 'file' | 'memory' => {
  if (isTestEnvironment() || isVercelRuntime()) {
    return 'memory';
  }

  return process.env.CLIENT_PLATFORM_STORAGE === 'memory' ? 'memory' : 'file';
};

const createStore = (): ClientPlatformStore => {
  const storeType = getConfiguredStoreType();
  return storeType === 'memory'
    ? new ClientPlatformMemoryStore()
    : new ClientPlatformFileStore();
};

class ClientPlatformRepository {
  private readonly store: ClientPlatformStore;

  constructor(store: ClientPlatformStore = createStore()) {
    this.store = store;
  }

  getClientById(clientId: string): Promise<ClientRecord | undefined> {
    return this.store.getClientById(clientId);
  }

  listClients(): Promise<ClientRecord[]> {
    return this.store.listClients();
  }

  saveClient(client: ClientRecord): Promise<ClientRecord> {
    return this.store.saveClient(client);
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const clientPlatformRepository = new ClientPlatformRepository();

export const resetClientPlatformRepositoryForTests = (): Promise<void> => {
  return clientPlatformRepository.resetForTests();
};
