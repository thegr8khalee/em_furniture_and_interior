import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Supabase access-token verification.
 *
 * Tokens are signed with an asymmetric key (ES256) and verified against the
 * project's published JWKS. The server therefore never holds a signing secret —
 * unlike the outgoing JWT_SECRET scheme, where anything able to read the secret
 * could mint a valid admin token.
 *
 * The key set is fetched lazily and cached by `jose`, which also handles
 * rotation: an unknown `kid` triggers a re-fetch, rate-limited so a bad token
 * cannot be used to hammer the JWKS endpoint.
 */

let jwks;
let jwksUrl;

const resolveJwksUrl = () => {
  const explicit = process.env.SUPABASE_JWKS_URL;
  if (explicit) return explicit;

  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL or SUPABASE_JWKS_URL must be configured');
  return `${base.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
};

const getJwks = () => {
  const url = resolveJwksUrl();
  // Rebuild only if the URL changed, so the cache survives between requests.
  if (!jwks || jwksUrl !== url) {
    jwksUrl = url;
    jwks = createRemoteJWKSet(new URL(url), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }
  return jwks;
};

/** Test seam: drop the cached key set between cases. */
export const resetJwksCache = () => {
  jwks = undefined;
  jwksUrl = undefined;
};

/**
 * Verify a Supabase access token.
 *
 * @returns {Promise<{ payload: object } | { error: string }>}
 */
export const verifySupabaseToken = async (token) => {
  if (!token || typeof token !== 'string') {
    return { error: 'No token provided' };
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      // Supabase sets `aud: 'authenticated'` on user tokens and issues them
      // from <project>/auth/v1. Checking both stops a token minted by another
      // Supabase project from being accepted here.
      audience: 'authenticated',
      issuer: `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1`,
      clockTolerance: 5,
    });
    return { payload };
  } catch (error) {
    if (error?.code === 'ERR_JWT_EXPIRED') return { error: 'Token expired' };
    if (error?.code === 'ERR_JWKS_NO_MATCHING_KEY') return { error: 'Unknown signing key' };
    return { error: 'Invalid token' };
  }
};

/** Extract a bearer token from the Authorization header. */
export const bearerToken = (req) => {
  const header = req.get?.('authorization') || req.headers?.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim();
};
