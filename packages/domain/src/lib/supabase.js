/**
 * Supabase Auth, for the two front ends.
 *
 * Supabase is the identity provider here, not the session. A shopper signs in
 * with Supabase's SDK — Google, a magic link, whatever the project has enabled —
 * and the access token is exchanged at `/api/auth/supabase` for the same
 * httpOnly cookie the password path issues. Nothing else in either app knows
 * the difference, and the API verifies the token with Supabase rather than
 * trusting what the browser sends.
 *
 * The SDK is **imported dynamically, and only when the project is configured**.
 * It is about 60kB gzipped; a build with no `VITE_SUPABASE_URL` should not carry
 * it, and every sign-in button that depends on it is simply not rendered — so
 * this is inert until someone sets it up, rather than a button that fails when
 * pressed or a page that got slower for a feature nobody turned on.
 *
 * Only the anon key belongs in a browser bundle. The service role key bypasses
 * Row Level Security entirely and lives on the API host.
 */

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let pending = null;

/**
 * The Supabase client, or null if this installation has none.
 *
 * Async, because the SDK is fetched on demand. The promise is cached, so two
 * components asking at once get one client and one network request.
 */
export const getSupabase = () => {
  if (!isSupabaseConfigured) return Promise.resolve(null);

  if (!pending) {
    pending = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: {
          // The app's own cookie is the session. Leaving Supabase to persist and
          // refresh a second one would give us two sessions that can disagree
          // about whether someone is signed in.
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: true,
        },
      })
    );
  }

  return pending;
};

/**
 * The token from a completed Supabase sign-in, if there is one.
 *
 * After an OAuth redirect the token is in the URL fragment; `getSession` reads
 * it once `detectSessionInUrl` has done its work.
 */
export const currentSupabaseToken = async () => {
  const supabase = await getSupabase();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
};
