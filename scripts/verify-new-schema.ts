import { createClient } from '@supabase/supabase-js';

const requireEnv = (name: string): string => {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value.trim();
};

const CORE_TABLES = [
  'businesses',
  'team_members',
  'services',
  'appointments',
  'client_platform_clients',
  'subscription_plan_records'
];

const main = async (): Promise<void> => {
  const client = createClient(
    requireEnv('NEW_SUPABASE_URL'),
    requireEnv('NEW_SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );

  for (const table of CORE_TABLES) {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`${table.padEnd(28, ' ')} ERROR: ${error.message}`);
      continue;
    }

    console.log(`${table.padEnd(28, ' ')} OK (${count} rows)`);
  }

  const { data: plans, error: plansError } = await client
    .from('subscription_plan_records')
    .select('plan_key, is_active, display_order')
    .order('display_order');

  if (plansError) {
    console.log('Plan seed check ERROR:', plansError.message);
  } else {
    console.log('Seeded plans:', plans?.map((plan) => plan.plan_key).join(', '));
  }
};

main().catch((error) => {
  console.error('Verification failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
