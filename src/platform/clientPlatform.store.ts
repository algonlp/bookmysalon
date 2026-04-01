import type { ClientRecord } from './clientPlatform.types';

export interface ClientPlatformState {
  clients: ClientRecord[];
}

export interface ClientPlatformStore {
  getClientById(clientId: string): Promise<ClientRecord | undefined>;
  listClients(): Promise<ClientRecord[]>;
  saveClient(client: ClientRecord): Promise<ClientRecord>;
  reset(): Promise<void>;
}

export const createDefaultClientPlatformState = (): ClientPlatformState => ({
  clients: []
});
