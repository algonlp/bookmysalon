import type { ClientRecord } from '../clientPlatform.types';
import type { ClientPlatformStore } from '../clientPlatform.store';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';
import { syncClientRecordToRelational } from '../../shared/supabase/relationalMirror';

const clientTable = new SupabaseJsonbTable<ClientRecord>({
  tableName: 'client_platform_clients',
  mapToRow: (client) => ({
    id: client.id,
    email: client.email,
    business_name: client.businessName,
    mobile_number: client.mobileNumber,
    payload: toJsonValue(client)
  })
});

export class ClientPlatformSupabaseStore implements ClientPlatformStore {
  getClientById(clientId: string): Promise<ClientRecord | undefined> {
    return clientTable.getById(clientId);
  }

  listClients(): Promise<ClientRecord[]> {
    return clientTable.list();
  }

  async saveClient(client: ClientRecord): Promise<ClientRecord> {
    await clientTable.upsert(client);
    await syncClientRecordToRelational(client);
    return client;
  }

  reset(): Promise<void> {
    return clientTable.reset();
  }
}
