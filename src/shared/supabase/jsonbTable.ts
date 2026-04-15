import { getSupabaseClient } from './client';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface JsonbTableDefinition<TRecord> {
  tableName: string;
  mapToRow: (record: TRecord) => {
    id: string;
    payload: JsonValue;
    [key: string]: JsonValue;
  };
}

export const toJsonValue = (value: unknown): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

const deleteAllRows = async (tableName: string): Promise<void> => {
  const client = getSupabaseClient();
  const { error } = await client.from(tableName).delete().neq('id', '');

  if (error) {
    throw new Error(`Failed to clear ${tableName}: ${error.message}`);
  }
};

export class SupabaseJsonbTable<TRecord extends { id: string }> {
  constructor(private readonly definition: JsonbTableDefinition<TRecord>) {}

  async list(): Promise<TRecord[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(this.definition.tableName)
      .select('payload')
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Failed to list ${this.definition.tableName}: ${error.message}`);
    }

    return (data ?? []).map((row) => row.payload as TRecord);
  }

  async getById(id: string): Promise<TRecord | undefined> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from(this.definition.tableName)
      .select('payload')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read ${this.definition.tableName}/${id}: ${error.message}`);
    }

    return data?.payload as TRecord | undefined;
  }

  async upsert(record: TRecord): Promise<TRecord> {
    const client = getSupabaseClient();
    const row = toJsonValue(this.definition.mapToRow(record)) as Record<string, JsonValue>;
    const { error } = await client
      .from(this.definition.tableName)
      .upsert(row, { onConflict: 'id' });

    if (error) {
      throw new Error(`Failed to save ${this.definition.tableName}/${record.id}: ${error.message}`);
    }

    return record;
  }

  async reset(): Promise<void> {
    await deleteAllRows(this.definition.tableName);
  }
}
