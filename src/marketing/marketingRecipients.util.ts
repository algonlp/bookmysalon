import { isValidE164PhoneNumber, normalizeSmsDestination } from '../notifications/twilioSms.service';
import type { CsvContactRow } from './marketing.types';

export const normalizeContactPhone = (phone: string): string => {
  const normalized = normalizeSmsDestination(phone);
  return isValidE164PhoneNumber(normalized) ? normalized : '';
};

export const normalizeContactEmail = (email: string): string => {
  const trimmed = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
};

export const buildDedupeKey = (phone: string, email: string): string => `${phone}|${email}`;

export interface ParsedCsvResult {
  rows: CsvContactRow[];
  rejectedCount: number;
}

const findColumnIndex = (header: string[], candidates: string[]): number =>
  header.findIndex((column) => candidates.includes(column.trim().toLowerCase()));

// records: array of raw string arrays (first row assumed to be a header row).
export const parseContactCsvRecords = (records: string[][]): ParsedCsvResult => {
  if (records.length === 0) {
    return { rows: [], rejectedCount: 0 };
  }

  const [header, ...dataRows] = records;
  const nameIndex = findColumnIndex(header, ['name', 'customer name', 'customer_name', 'full name']);
  const phoneIndex = findColumnIndex(header, ['phone', 'phone number', 'mobile', 'mobile number', 'customer_phone']);
  const emailIndex = findColumnIndex(header, ['email', 'email address', 'customer_email']);

  const rows: CsvContactRow[] = [];
  let rejectedCount = 0;

  for (const record of dataRows) {
    if (record.every((cell) => !cell?.trim())) {
      continue;
    }

    const name = nameIndex >= 0 ? (record[nameIndex] ?? '').trim() : '';
    const phone = phoneIndex >= 0 ? normalizeContactPhone(record[phoneIndex] ?? '') : '';
    const email = emailIndex >= 0 ? normalizeContactEmail(record[emailIndex] ?? '') : '';

    if (!name || (!phone && !email)) {
      rejectedCount += 1;
      continue;
    }

    rows.push({ name, phone, email });
  }

  return { rows, rejectedCount };
};
