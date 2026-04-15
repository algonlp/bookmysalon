import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

let supabaseClient: SupabaseClient | undefined;

const resolveSupabaseApiKey = (): string | undefined =>
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY;

export const getSupabaseClient = (): SupabaseClient => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const apiKey = resolveSupabaseApiKey();

  if (!env.SUPABASE_URL || !apiKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  supabaseClient = createClient(env.SUPABASE_URL, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return supabaseClient;
};
