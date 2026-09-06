import { useCallback, useEffect, useState } from 'react';

/**
 * Sign in with whatever the Supabase project has enabled.
 *
 * Rendered only when Supabase is configured, which is what makes this safe to
 * ship ahead of the decision to use it: a build with no `VITE_SUPABASE_URL`
 * shows nothing at all rather than a button that fails when pressed, and never
 * downloads the SDK.
 *
 * The token it obtains is proof of identity, not a session. `onToken` hands it
 * to the API, which verifies it with Supabase and issues the ordinary cookie —
 * so the password path and this one end in exactly the same place, and nothing
 * downstream has to know which door someone came through.
 *
 * The caller supplies `getClient` rather than this package importing it,
 * because @em/ui knows nothing about the API or the environment; that is
 * @em/domain's job.
 */
const SupabaseSignIn = ({
  getClient,
  configured = false,
  onToken,
  provider = 'google',
  label = 'Continue with Google',
  className = '',
}) => {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState(null);

  const client = useCallback(async () => (configured ? getClient?.() : null), [configured, getClient]);

  // Coming back from the provider, the token is in the URL fragment. Exchanging
  // it here means the redirect lands on the page it left from and nobody sees a
  // half-signed-in state.
  useEffect(() => {
    if (!configured) return undefined;

    let cancelled = false;

    const adopt = async () => {
      const supabase = await client();
      if (!supabase || cancelled) return;

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token || cancelled) return;

      // The fragment is a credential in the address bar. It has been read, so
      // it comes out of the history entry.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      setIsWorking(true);
      try {
        await onToken?.(token);
      } finally {
        if (!cancelled) setIsWorking(false);
      }
    };

    adopt();
    return () => {
      cancelled = true;
    };
  }, [configured, client, onToken]);

  if (!configured) return null;

  const start = async () => {
    setError(null);
    setIsWorking(true);

    try {
      const supabase = await client();
      if (!supabase) return;

      const { error: failed } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.href },
      });

      // A provider that is not enabled on the project fails here rather than
      // silently doing nothing, so say so instead of leaving a dead button.
      if (failed) setError(failed.message);
    } catch (thrown) {
      setError(thrown?.message || 'Could not reach the sign-in service.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className={className}>
      <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-neutral/40">
        <span className="h-px flex-1 bg-base-300" />
        or
        <span className="h-px flex-1 bg-base-300" />
      </div>

      <button
        type="button"
        onClick={start}
        disabled={isWorking}
        className="flex w-full items-center justify-center gap-2 border border-base-300 bg-white px-4 py-3 text-sm font-medium text-neutral transition-colors hover:border-secondary disabled:opacity-60"
      >
        {isWorking ? 'Just a moment…' : label}
      </button>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
};

export default SupabaseSignIn;
