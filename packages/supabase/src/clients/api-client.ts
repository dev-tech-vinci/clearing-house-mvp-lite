import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { Database } from '../database.types';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

/**
 * @name getSupabaseApiClient
 * @description Creates a Supabase client bound to a caller-supplied
 * access token (Bearer JWT), for /api/v1/* routes serving non-browser
 * clients (e.g. the Phase 9 Python test client) that can't carry a
 * Next.js SSR cookie session. Always built with the anon key + the
 * caller's own token -- RLS resolves auth.uid() from that token exactly
 * as it would from a cookie session, so this grants no more access than
 * the token's own user already has. Never uses the service-role key.
 */
export function getSupabaseApiClient<GenericSchema = Database>(accessToken: string) {
  const keys = getSupabaseClientKeys();

  return createClient<GenericSchema>(keys.url, keys.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
