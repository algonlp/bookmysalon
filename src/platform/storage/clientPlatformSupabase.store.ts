import type { ClientRecord } from '../clientPlatform.types';
import type { ClientPlatformStore } from '../clientPlatform.store';
import { getSupabaseClient } from '../../shared/supabase/client';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';
import {
  deleteBusinessFromRelational,
  syncClientRecordToRelational
} from '../../shared/supabase/relationalMirror';
import { logger } from '../../shared/logger';

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

let productSaleRecordsTableState: 'unknown' | 'available' | 'missing' = 'unknown';
let hasLoggedMissingProductSaleRecordsTable = false;

const isMissingTableError = (message: string | undefined): boolean => {
  if (!message) {
    return false;
  }

  return (
    message.includes('Could not find the table') ||
    message.includes('relation') && message.includes('does not exist')
  );
};

const asErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const markProductSaleRecordsTableAvailable = (): void => {
  productSaleRecordsTableState = 'available';
};

const markProductSaleRecordsTableMissing = (
  message: string,
  businessId?: string
): void => {
  productSaleRecordsTableState = 'missing';

  if (hasLoggedMissingProductSaleRecordsTable) {
    return;
  }

  hasLoggedMissingProductSaleRecordsTable = true;
  logger.error('Disabling product_sale_records sync because the table is missing', {
    businessId,
    message
  });
};

const deleteProductSaleRecordsForBusiness = async (businessId: string): Promise<boolean> => {
  if (productSaleRecordsTableState === 'missing') {
    return false;
  }

  const supabase = getSupabaseClient();
  const { error: deleteError } = await supabase
    .from('product_sale_records')
    .delete()
    .eq('business_id', businessId);

  if (deleteError) {
    if (isMissingTableError(deleteError.message)) {
      markProductSaleRecordsTableMissing(deleteError.message, businessId);
      return false;
    }

    throw new Error(`Failed to clear product_sale_records for ${businessId}: ${deleteError.message}`);
  }

  markProductSaleRecordsTableAvailable();
  return true;
};

const syncProductSaleRecords = async (client: ClientRecord): Promise<void> => {
  if (productSaleRecordsTableState === 'missing') {
    return;
  }

  const supabase = getSupabaseClient();
  const canSyncProductSaleRecords = await deleteProductSaleRecordsForBusiness(client.id);

  if (!canSyncProductSaleRecords) {
    return;
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
    if (isMissingTableError(error.message)) {
      markProductSaleRecordsTableMissing(error.message, client.id);
      return;
    }

    throw new Error(`Failed to sync product_sale_records for ${client.id}: ${error.message}`);
  }

  markProductSaleRecordsTableAvailable();
};

const rollbackClientPersistence = async (
  client: ClientRecord,
  previousClient: ClientRecord | undefined
): Promise<void> => {
  if (previousClient) {
    await clientTable.upsert(previousClient);
    await syncProductSaleRecords(previousClient);
    await syncClientRecordToRelational(previousClient);
    return;
  }

  await clientTable.deleteById(client.id);
  await deleteProductSaleRecordsForBusiness(client.id);
  await deleteBusinessFromRelational(client.id);
};

const resetProductSaleRecords = async (): Promise<void> => {
  if (productSaleRecordsTableState === 'missing') {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('product_sale_records').delete().neq('id', '');

  if (error) {
    if (isMissingTableError(error.message)) {
      markProductSaleRecordsTableMissing(error.message);
      return;
    }

    throw new Error(`Failed to clear product_sale_records: ${error.message}`);
  }

  markProductSaleRecordsTableAvailable();
};

export class ClientPlatformSupabaseStore implements ClientPlatformStore {
  getClientById(clientId: string): Promise<ClientRecord | undefined> {
    return clientTable.getById(clientId);
  }

  listClients(): Promise<ClientRecord[]> {
    return clientTable.list();
  }

  async saveClient(client: ClientRecord): Promise<ClientRecord> {
    const previousClient = await clientTable.getById(client.id);

    try {
      await clientTable.upsert(client);
      await syncProductSaleRecords(client);
      await syncClientRecordToRelational(client);
    } catch (error) {
      try {
        await rollbackClientPersistence(client, previousClient);
      } catch (rollbackError) {
        logger.error('Failed to rollback client persistence after relational sync error', {
          clientId: client.id,
          error: asErrorMessage(error),
          rollbackError: asErrorMessage(rollbackError)
        });

        throw new Error(
          `Failed to save client ${client.id}: ${asErrorMessage(error)}. Rollback failed: ${asErrorMessage(rollbackError)}`
        );
      }

      throw error;
    }

    return client;
  }

  async reset(): Promise<void> {
    await clientTable.reset();
    await resetProductSaleRecords();
  }
}
