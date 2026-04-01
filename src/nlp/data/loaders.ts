export type TextRecord = {
  text: string;
  label?: string;
};

export const loadRecords = (rows: Array<Record<string, unknown>>): TextRecord[] => {
  return rows.map((row) => ({
    text: String(row.text ?? ''),
    label: row.label ? String(row.label) : undefined
  }));
};
