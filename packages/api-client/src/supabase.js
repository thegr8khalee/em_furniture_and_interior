import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client, shared by both applications.
 *
 * Only the anon key is used here, which is correct: it is designed to be public
 * and is compiled into the bundle. The service-role key must never appear in a
 * client — it bypasses Row Level Security entirely.
 *
 * Returns null when unconfigured rather than throwing, so an environment
 * without Supabase set up still boots on the legacy cookie path. That matters
 * while both schemes run side by side.
 */

let client;

export const getSupabase = () => {
  if (client !== undefined) return client;

  const url = import.meta.env?.VITE_SUPABASE_URL;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  client = url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // The token travels in an Authorization header, not a cookie, so
          // there is no session to detect in a redirect URL and no third-party
          // cookie problem when the apps and API sit on different origins.
          detectSessionInUrl: false,
        },
      })
    : null;

  return client;
};

export const isSupabaseConfigured = () => getSupabase() !== null;

/** Current access token, or null when signed out or unconfigured. */
export const getAccessToken = async () => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
};

/** Test seam. */
export const __resetSupabaseClient = () => {
  client = undefined;
};
