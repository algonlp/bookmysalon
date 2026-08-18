import type { PlatformSettingsRecord } from '../platformSettings.types';
import type { PlatformSettingsStore } from '../platformSettings.store';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';

const GLOBAL_ROW_ID = 'global';

type StoredRecord = PlatformSettingsRecord & { id: string };

const platformSettingsTable = new SupabaseJsonbTable<StoredRecord>({
  tableName: 'platform_settings',
  mapToRow: (record) => ({
    id: record.id,
    payload: toJsonValue(record)
  })
});

export class PlatformSettingsSupabaseStore implements PlatformSettingsStore {
  async get(): Promise<PlatformSettingsRecord | null> {
    const record = await platformSettingsTable.getById(GLOBAL_ROW_ID);
    return record ?? null;
  }

  async save(record: PlatformSettingsRecord): Promise<PlatformSettingsRecord> {
    await platformSettingsTable.upsert({ ...record, id: GLOBAL_ROW_ID });
    return record;
  }

  async reset(): Promise<void> {
    await platformSettingsTable.deleteById(GLOBAL_ROW_ID);
  }
}
