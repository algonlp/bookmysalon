import type { ClientRecord } from '../clientPlatform.types';
import type { ClientPlatformStore } from '../clientPlatform.store';
import { getSupabaseClient } from '../../shared/supabase/client';
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

const syncProductSaleRecords = async (client: ClientRecord): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase
    .from('product_sale_records')
    .delete()
    .eq('business_id', client.id);

  if (deleteError) {
    throw new Error(`Failed to clear product_sale_records for ${client.id}: ${deleteError.message}`);
  }

  if (client.productSales.length === 0) {
    return;
  }

  const rows = client.productSales.map((productSale) => ({
    id: productSale.id,
    business_id: client.id,
    product_id: productSale.productId,
    customer_phone: productSale.customerPhone,
    sold_at: productSale.soldAt,
    payload: toJsonValue(productSale)
  }));

  const { error } = await supabase.from('product_sale_records').upsert(rows, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to sync product_sale_records for ${client.id}: ${error.message}`);
  }
};

const resetProductSaleRecords = async (): Promise<void> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('product_sale_records').delete().neq('id', '');

  if (error) {
    throw new Error(`Failed to clear product_sale_records: ${error.message}`);
  }
};

export class ClientPlatformSupabaseStore implements ClientPlatformStore {
  getClientById(clientId: string): Promise<ClientRecord | undefined> {
    return clientTable.getById(clientId);
  }

  listClients(): Promise<ClientRecord[]> {
    return clientTable.list();
  }

  async saveClient(client: ClientRecord): Promise<ClientRecord> {
    await clientTable.upsert(client);
    await syncProductSaleRecords(client);
    await syncClientRecordToRelational(client);
    return client;
  }

  async reset(): Promise<void> {
    await clientTable.reset();
    await resetProductSaleRecords();
  }
}
