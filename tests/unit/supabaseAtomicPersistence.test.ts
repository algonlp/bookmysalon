import { beforeEach, describe, expect, it, vi } from 'vitest';

type JsonbTableMock<TRecord> = {
  getById: ReturnType<typeof vi.fn<() => Promise<TRecord | undefined>>>;
  list: ReturnType<typeof vi.fn<() => Promise<TRecord[]>>>;
  upsert: ReturnType<typeof vi.fn<(record: TRecord) => Promise<TRecord>>>;
  deleteById: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>;
  reset: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

const createJsonbTableModule = () => {
  const instances: Array<JsonbTableMock<unknown>> = [];

  class MockSupabaseJsonbTable<TRecord extends { id: string }> {
    getById = vi.fn<() => Promise<TRecord | undefined>>();
    list = vi.fn<() => Promise<TRecord[]>>();
    upsert = vi.fn<(record: TRecord) => Promise<TRecord>>();
    deleteById = vi.fn<(id: string) => Promise<void>>();
    reset = vi.fn<() => Promise<void>>();

    constructor() {
      instances.push(this as unknown as JsonbTableMock<unknown>);
    }
  }

  return {
    module: {
      SupabaseJsonbTable: MockSupabaseJsonbTable,
      toJsonValue: <TValue>(value: TValue): TValue => value
    },
    instances
  };
};

describe('Supabase atomic persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('restores the previous client JSONB and relational state when client mirror sync fails', async () => {
    const jsonbTables = createJsonbTableModule();
    const deleteProductSaleRows = vi.fn<(column: string, value: string) => Promise<{ error: null }>>();
    const upsertProductSaleRows = vi.fn<() => Promise<{ error: null }>>();
    const syncClientRecordToRelational = vi
      .fn<(record: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('relational sync failed'))
      .mockResolvedValueOnce();
    const deleteBusinessFromRelational = vi.fn<(businessId: string) => Promise<void>>();
    const loggerError = vi.fn();

    vi.doMock('../../src/shared/supabase/jsonbTable', () => jsonbTables.module);
    vi.doMock('../../src/shared/supabase/client', () => ({
      getSupabaseClient: () => ({
        from: (tableName: string) => {
          if (tableName !== 'product_sale_records') {
            throw new Error(`Unexpected table ${tableName}`);
          }

          return {
            delete: () => ({
              eq: deleteProductSaleRows.mockResolvedValue({ error: null })
            }),
            upsert: upsertProductSaleRows.mockResolvedValue({ error: null })
          };
        }
      })
    }));
    vi.doMock('../../src/shared/supabase/relationalMirror', () => ({
      deleteBusinessFromRelational,
      syncClientRecordToRelational
    }));
    vi.doMock('../../src/shared/logger', () => ({
      logger: {
        info: vi.fn(),
        error: loggerError
      }
    }));

    const { ClientPlatformSupabaseStore } = await import(
      '../../src/platform/storage/clientPlatformSupabase.store'
    );

    const clientTable = jsonbTables.instances[0] as JsonbTableMock<{
      id: string;
      productSales: Array<{ id: string }>;
    }>;

    const previousClient = {
      id: 'client-1',
      productSales: []
    };

    const nextClient = {
      id: 'client-1',
      productSales: [{ id: 'sale-1' }]
    };

    clientTable.getById.mockResolvedValue(previousClient);
    clientTable.upsert
      .mockResolvedValueOnce(nextClient)
      .mockResolvedValueOnce(previousClient);

    const store = new ClientPlatformSupabaseStore();

    await expect(store.saveClient(nextClient)).rejects.toThrow('relational sync failed');

    expect(clientTable.upsert).toHaveBeenNthCalledWith(1, nextClient);
    expect(clientTable.upsert).toHaveBeenNthCalledWith(2, previousClient);
    expect(clientTable.deleteById).not.toHaveBeenCalled();
    expect(syncClientRecordToRelational).toHaveBeenNthCalledWith(1, nextClient);
    expect(syncClientRecordToRelational).toHaveBeenNthCalledWith(2, previousClient);
    expect(deleteProductSaleRows).toHaveBeenCalledTimes(2);
    expect(upsertProductSaleRows).toHaveBeenCalledTimes(1);
    expect(deleteBusinessFromRelational).not.toHaveBeenCalled();
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('removes a new appointment from both stores when the relational sync fails', async () => {
    const jsonbTables = createJsonbTableModule();
    const syncAppointmentToRelational = vi
      .fn<(record: unknown) => Promise<void>>()
      .mockRejectedValue(new Error('appointment sync failed'));
    const deleteAppointmentFromRelational = vi.fn<(appointmentId: string) => Promise<void>>();
    const deleteBusinessFromRelational = vi.fn<(businessId: string) => Promise<void>>();
    const relationalBusinessExists = vi.fn<(businessId: string) => Promise<boolean>>().mockResolvedValue(false);
    const loggerError = vi.fn();

    vi.doMock('../../src/shared/supabase/jsonbTable', () => jsonbTables.module);
    vi.doMock('../../src/shared/supabase/relationalMirror', () => ({
      deleteAppointmentFromRelational,
      deleteBusinessFromRelational,
      deleteLoyaltyRewardFromRelational: vi.fn(),
      deletePackagePurchaseFromRelational: vi.fn(),
      deletePaymentRecordFromRelational: vi.fn(),
      deleteReviewFromRelational: vi.fn(),
      deleteWaitlistEntryFromRelational: vi.fn(),
      relationalBusinessExists,
      syncAppointmentToRelational,
      syncLoyaltyRewardToRelational: vi.fn(),
      syncPackagePurchaseToRelational: vi.fn(),
      syncPaymentRecordToRelational: vi.fn(),
      syncReviewToRelational: vi.fn(),
      syncWaitlistEntryToRelational: vi.fn()
    }));
    vi.doMock('../../src/shared/logger', () => ({
      logger: {
        info: vi.fn(),
        error: loggerError
      }
    }));

    const { AppointmentSupabaseStore } = await import(
      '../../src/appointments/storage/appointmentSupabase.store'
    );

    const appointmentTable = jsonbTables.instances[0] as JsonbTableMock<{
      id: string;
      businessId: string;
    }>;

    const appointment = {
      id: 'appointment-1',
      businessId: 'business-1'
    };

    appointmentTable.getById.mockResolvedValue(undefined);
    appointmentTable.upsert.mockResolvedValue(appointment);
    appointmentTable.deleteById.mockResolvedValue();

    const store = new AppointmentSupabaseStore();

    await expect(store.saveAppointment(appointment)).rejects.toThrow('appointment sync failed');

    expect(appointmentTable.upsert).toHaveBeenCalledWith(appointment);
    expect(appointmentTable.deleteById).toHaveBeenCalledWith(appointment.id);
    expect(syncAppointmentToRelational).toHaveBeenCalledWith(appointment);
    expect(deleteAppointmentFromRelational).toHaveBeenCalledWith(appointment.id);
    expect(deleteBusinessFromRelational).toHaveBeenCalledWith(appointment.businessId);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('logs the missing product_sale_records table once and disables future sync attempts', async () => {
    const jsonbTables = createJsonbTableModule();
    const deleteProductSaleRows = vi
      .fn<(column: string, value: string) => Promise<{ error: { message: string } }>>()
      .mockResolvedValue({
        error: {
          message: "Could not find the table 'public.product_sale_records' in the schema cache"
        }
      });
    const fromSpy = vi.fn<(tableName: string) => unknown>((tableName: string) => {
      if (tableName !== 'product_sale_records') {
        throw new Error(`Unexpected table ${tableName}`);
      }

      return {
        delete: () => ({
          eq: deleteProductSaleRows
        }),
        upsert: vi.fn()
      };
    });
    const syncClientRecordToRelational = vi.fn<(record: unknown) => Promise<void>>().mockResolvedValue();
    const loggerError = vi.fn();

    vi.doMock('../../src/shared/supabase/jsonbTable', () => jsonbTables.module);
    vi.doMock('../../src/shared/supabase/client', () => ({
      getSupabaseClient: () => ({
        from: fromSpy
      })
    }));
    vi.doMock('../../src/shared/supabase/relationalMirror', () => ({
      deleteBusinessFromRelational: vi.fn(),
      syncClientRecordToRelational
    }));
    vi.doMock('../../src/shared/logger', () => ({
      logger: {
        info: vi.fn(),
        error: loggerError
      }
    }));

    const { ClientPlatformSupabaseStore } = await import(
      '../../src/platform/storage/clientPlatformSupabase.store'
    );

    const clientTable = jsonbTables.instances[0] as JsonbTableMock<{
      id: string;
      productSales: Array<{ id: string }>;
    }>;

    const client = {
      id: 'client-1',
      productSales: []
    };

    clientTable.getById.mockResolvedValue(client);
    clientTable.upsert.mockResolvedValue(client);

    const store = new ClientPlatformSupabaseStore();

    await store.saveClient(client);
    await store.saveClient(client);

    expect(deleteProductSaleRows).toHaveBeenCalledTimes(1);
    expect(fromSpy).toHaveBeenCalledTimes(1);
    expect(syncClientRecordToRelational).toHaveBeenCalledTimes(2);
    expect(loggerError).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledWith(
      'Disabling product_sale_records sync because the table is missing',
      expect.objectContaining({
        businessId: 'client-1'
      })
    );
  });
});
