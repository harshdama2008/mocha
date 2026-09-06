import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from './env.ts';

// Server-only client using the service role key — bypasses RLS, so this
// must never be imported from src/app or src/lib (on-device code uses the
// anon key instead, once client-side reads are needed).
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  // SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are auto-injected into every
  // deployed Edge Function by the platform; EXPO_PUBLIC_SUPABASE_URL is
  // this repo's own Node-side env var name for the same value.
  const url = getEnv('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
