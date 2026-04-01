import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { ClientRecord } from '../clientPlatform.types';
import {
  createDefaultClientPlatformState,
  type ClientPlatformState,
  type ClientPlatformStore
} from '../clientPlatform.store';

export class ClientPlatformFileStore implements ClientPlatformStore {
  private readonly storagePath: string;
  private state: ClientPlatformState = createDefaultClientPlatformState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'client-platform.json')) {
    this.storagePath = storagePath;
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();

    const rawState = await readFile(this.storagePath, 'utf-8');
    this.state = rawState.trim()
      ? (JSON.parse(rawState) as ClientPlatformState)
      : createDefaultClientPlatformState();
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await this.loadStateFromDisk();
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.writeChain.then(operation, operation);
    this.writeChain = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  private upsertClient(client: ClientRecord): void {
    const existingIndex = this.state.clients.findIndex((entry) => entry.id === client.id);

    if (existingIndex >= 0) {
      this.state.clients[existingIndex] = client;
      return;
    }

    this.state.clients.push(client);
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(
        this.storagePath,
        JSON.stringify(createDefaultClientPlatformState(), null, 2),
        'utf-8'
      );
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.storagePath), { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  async getClientById(clientId: string): Promise<ClientRecord | undefined> {
    await this.ensureLoaded();
    return this.state.clients.find((client) => client.id === clientId);
  }

  async listClients(): Promise<ClientRecord[]> {
    await this.ensureLoaded();
    return [...this.state.clients];
  }

  async saveClient(client: ClientRecord): Promise<ClientRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      this.upsertClient(client);
      await this.persist();
      return client;
    });
  }

  async reset(): Promise<void> {
    await this.withWriteLock(async () => {
      this.state = createDefaultClientPlatformState();
      this.loaded = true;
      await this.persist();
    });
  }
}
