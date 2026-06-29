import { getSupabaseClient } from '../src/shared/supabase/client';
import { hashAdminToken, isHashedToken } from '../src/shared/hashToken';

const run = async (): Promise<void> => {
  const client = getSupabaseClient();

  const { data: clients, error } = await client
    .from('client_platform_clients')
    .select('id, payload');

  if (error) {
    throw new Error(`Failed to read clients: ${error.message}`);
  }

  if (!clients || clients.length === 0) {
    console.log('No clients found.');
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const row of clients) {
    const payload = row.payload as Record<string, unknown>;
    const adminToken = payload.adminToken as string | undefined;

    if (!adminToken || isHashedToken(adminToken)) {
      skipped++;
      continue;
    }

    const hashedToken = hashAdminToken(adminToken);
    payload.adminToken = hashedToken;

    const { error: updateError } = await client
      .from('client_platform_clients')
      .update({ payload })
      .eq('id', row.id);

    if (updateError) {
      console.error(`Failed to update client ${row.id}: ${updateError.message}`);
      continue;
    }

    const { error: relationalError } = await client
      .from('businesses')
      .update({ admin_token: hashedToken })
      .eq('id', row.id);

    if (relationalError) {
      console.error(`Failed to update business ${row.id}: ${relationalError.message}`);
    }

    migrated++;
    console.log(`Migrated: ${row.id}`);
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
