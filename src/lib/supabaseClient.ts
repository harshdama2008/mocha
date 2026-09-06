import { createClient } from '@supabase/supabase-js';

// On-device client — anon key only. The service-role key in
// src/server/supabaseAdmin.ts must never be reachable from this bundle.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(url, anonKey);
