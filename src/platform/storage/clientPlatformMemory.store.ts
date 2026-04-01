import type { ClientRecord } from '../clientPlatform.types';
import {
  createDefaultClientPlatformState,
  type ClientPlatformState,
  type ClientPlatformStore
} from '../clientPlatform.store';

export class ClientPlatformMemoryStore implements ClientPlatformStore {
  private state: ClientPlatformState = createDefaultClientPlatformState();

  async getClientById(clientId: string): Promise<ClientRecord | undefined> {
    return this.state.clients.find((client) => client.id === clientId);
  }

  async listClients(): Promise<ClientRecord[]> {
    return [...this.state.clients];
  }

  async saveClient(client: ClientRecord): Promise<ClientRecord> {
    const existingIndex = this.state.clients.findIndex((entry) => entry.id === client.id);

    if (existingIndex >= 0) {
      this.state.clients[existingIndex] = client;
    } else {
      this.state.clients.push(client);
    }

    return client;
  }

  async reset(): Promise<void> {
    this.state = createDefaultClientPlatformState();
  }
}
