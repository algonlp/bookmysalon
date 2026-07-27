/**
 * One-off migration: relabel any salon whose stored currency is not PKR so
 * services, packages, and products all display in PKR. Only the currency label
 * is changed - the numeric amount is preserved (no exchange-rate conversion).
 *
 * Usage:
 *   npx tsx scripts/migrate-currency-to-pkr.ts            # dry run (no writes)
 *   npx tsx scripts/migrate-currency-to-pkr.ts --apply    # apply changes
 */
import { clientPlatformRepository } from '../src/platform/clientPlatform.repository';
import type { ClientRecord } from '../src/platform/clientPlatform.types';

const TARGET_CURRENCY_CODE = 'PKR';
const TARGET_CURRENCY_LOCALE = 'en-PK';

const pkrFormatter = new Intl.NumberFormat(TARGET_CURRENCY_LOCALE, {
  style: 'currency',
  currency: TARGET_CURRENCY_CODE,
  maximumFractionDigits: 0
});

const FOREIGN_CURRENCY_PATTERN = /[$£€]|\b(usd|gbp|eur|aed|sar)\b/i;
const BARE_AMOUNT_PATTERN = /^[\d.,\s]+$/;
const ALREADY_PKR_PATTERN = /\b(pkr|rs)\b/i;

/**
 * Convert a free-text price label to a PKR label when it carries a foreign
 * currency marker or is a bare number. Labels that are already PKR/Rs or are
 * non-numeric descriptive text are left untouched.
 */
const relabelToPkr = (priceLabel: unknown): { value: string; changed: boolean } => {
  if (typeof priceLabel !== 'string' || !priceLabel.trim()) {
    return { value: typeof priceLabel === 'string' ? priceLabel : '', changed: false };
  }

  const trimmed = priceLabel.trim();

  if (ALREADY_PKR_PATTERN.test(trimmed)) {
    return { value: priceLabel, changed: false };
  }

  const isForeign = FOREIGN_CURRENCY_PATTERN.test(trimmed);
  const isBareAmount = BARE_AMOUNT_PATTERN.test(trimmed);

  if (!isForeign && !isBareAmount) {
    return { value: priceLabel, changed: false };
  }

  const amount = Number(trimmed.replace(/[^\d.]/g, ''));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { value: priceLabel, changed: false };
  }

  const next = pkrFormatter.format(Math.round(amount));
  return { value: next, changed: next !== priceLabel };
};

const migrateClient = (client: ClientRecord): { client: ClientRecord; changes: string[] } => {
  const changes: string[] = [];
  const next: ClientRecord = { ...client };

  const currentCode = client.businessSettings?.currencyCode;
  if (currentCode && currentCode.toUpperCase() !== TARGET_CURRENCY_CODE) {
    next.businessSettings = {
      ...client.businessSettings,
      currencyCode: TARGET_CURRENCY_CODE,
      currencyLocale: TARGET_CURRENCY_LOCALE
    };
    changes.push(`currency ${currentCode} -> ${TARGET_CURRENCY_CODE}`);
  }

  const relabelCollection = <T extends { name?: string; priceLabel?: string }>(
    items: T[] | undefined,
    label: string
  ): T[] | undefined => {
    if (!Array.isArray(items)) {
      return items;
    }

    return items.map((item) => {
      const result = relabelToPkr(item.priceLabel);
      if (result.changed) {
        changes.push(`${label} "${item.name ?? ''}": ${item.priceLabel} -> ${result.value}`);
        return { ...item, priceLabel: result.value };
      }
      return item;
    });
  };

  next.services = relabelCollection(client.services, 'service') ?? client.services;
  next.products = relabelCollection(client.products, 'product') ?? client.products;
  next.packagePlans = relabelCollection(client.packagePlans, 'package') ?? client.packagePlans;

  return { client: next, changes };
};

const main = async (): Promise<void> => {
  const apply = process.argv.includes('--apply');
  const clients = await clientPlatformRepository.listClients();

  console.log(`Scanning ${clients.length} salon(s)...`);
  console.log(apply ? 'MODE: APPLY (writing changes)\n' : 'MODE: DRY RUN (no writes)\n');

  let changedCount = 0;

  for (const client of clients) {
    const { client: nextClient, changes } = migrateClient(client);

    if (changes.length === 0) {
      continue;
    }

    changedCount += 1;
    console.log(`- ${client.businessName || '(unnamed)'} [${client.id}]`);
    for (const change of changes) {
      console.log(`    ${change}`);
    }

    if (apply) {
      await clientPlatformRepository.saveClient({ ...nextClient, updatedAt: new Date().toISOString() });
      console.log('    saved.');
    }
  }

  console.log(
    `\n${changedCount} salon(s) ${apply ? 'updated' : 'would be updated'}. ` +
      (apply ? 'Done.' : 'Re-run with --apply to write changes.')
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
