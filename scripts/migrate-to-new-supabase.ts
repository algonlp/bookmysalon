/**
 * One-time migration: copy every row from the old Supabase project to a new
 * one running supabase/schema-v2.sql. Tables are copied in dependency order
 * (parents before children) so foreign keys never fail. Upserts by primary
 * key, so it is safe to re-run if it stops partway through.
 *
 * Requires four env vars (not the app's normal SUPABASE_URL/KEY, so this can
 * never accidentally point at the wrong project):
 *   OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY
 *   NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/migrate-to-new-supabase.ts            # dry run (counts only, no writes)
 *   npx tsx scripts/migrate-to-new-supabase.ts --apply     # copy the data
 *   npx tsx scripts/migrate-to-new-supabase.ts --apply --only=businesses,team_members
 */
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 500;

// Dependency order matters: every table is listed after every table it has a
// foreign key to, matching the create-table order in supabase/schema-v2.sql.
const TABLES_IN_DEPENDENCY_ORDER = [
  'businesses',
  'business_gallery_images',
  'business_settings',
  'business_stripe_connect_accounts',
  'business_service_types',
  'business_service_locations',
  'team_members',
  'services',
  'products',
  'product_sales',
  'package_plans',
  'package_plan_services',
  'loyalty_programs',
  'loyalty_program_services',
  'customer_profiles',
  'package_purchases',
  'package_purchase_services',
  'loyalty_rewards',
  'loyalty_reward_services',
  'marketing_campaign_templates',
  'marketing_campaigns',
  'appointments',
  'reviews',
  'payments',
  'waitlist_entries',
  'marketing_campaign_recipients',
  // subscription_plan_records is intentionally NOT copied - the app seeds it
  // fresh from src/billing/defaultPlans.ts (see schema-v2.sql Part 5), and
  // the old project's rows are stale (pre Bookable Staff Member pricing).
  'business_subscription_records',
  'billing_invoice_records',
  'client_platform_clients',
  'product_sale_records',
  'appointment_records',
  'payment_records',
  'review_records',
  'package_purchase_records',
  'loyalty_reward_records',
  'waitlist_records',
  'customer_account_records',
  'email_log_records',
  'sms_log_records'
];

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value.trim();
};

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const onlyTables = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((entry) => entry.trim()))
  : null;

const oldClient = createClient(
  requireEnv('OLD_SUPABASE_URL'),
  requireEnv('OLD_SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
);

const newClient = createClient(
  requireEnv('NEW_SUPABASE_URL'),
  requireEnv('NEW_SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
);

const migrateTable = async (tableName: string): Promise<{ read: number; written: number }> => {
  let read = 0;
  let written = 0;
  let from = 0;

  for (;;) {
    const { data, error } = await oldClient
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to read ${tableName} from old project: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    read += data.length;

    if (shouldApply) {
      const { error: upsertError } = await newClient.from(tableName).upsert(data);

      if (upsertError) {
        throw new Error(`Failed to write ${tableName} to new project: ${upsertError.message}`);
      }

      written += data.length;
    }

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return { read, written };
};

const main = async (): Promise<void> => {
  console.log(shouldApply ? 'Running migration (writes enabled)...' : 'Dry run (no writes) - pass --apply to copy data.');
  console.log('');

  const results: Array<{ table: string; read: number; written: number }> = [];

  for (const tableName of TABLES_IN_DEPENDENCY_ORDER) {
    if (onlyTables && !onlyTables.has(tableName)) {
      continue;
    }

    process.stdout.write(`  ${tableName.padEnd(36, ' ')} `);

    try {
      const { read, written } = await migrateTable(tableName);
      results.push({ table: tableName, read, written });
      console.log(shouldApply ? `read ${read}, wrote ${written}` : `would read ${read}`);
    } catch (error) {
      console.log('FAILED');
      throw error;
    }
  }

  console.log('');
  const totalRead = results.reduce((sum, entry) => sum + entry.read, 0);
  const totalWritten = results.reduce((sum, entry) => sum + entry.written, 0);
  console.log(`Total rows read: ${totalRead}`);

  if (shouldApply) {
    console.log(`Total rows written: ${totalWritten}`);

    if (totalWritten !== totalRead) {
      console.warn('WARNING: written count does not match read count - check the log above.');
      process.exitCode = 1;
    }
  } else {
    console.log('Dry run only - nothing was written. Re-run with --apply to copy data.');
  }
};

main().catch((error) => {
  console.error('');
  console.error('Migration aborted:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
