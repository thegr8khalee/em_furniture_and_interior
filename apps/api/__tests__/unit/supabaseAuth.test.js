import { jest } from '@jest/globals';
import { generateKeyPair, exportJWK, SignJWT, calculateJwkThumbprint } from 'jose';
import { verifySupabaseToken, resetJwksCache, bearerToken } from '../../src/lib/supabaseAuth.js';

/**
 * Token verification, without touching the network.
 *
 * A local ES256 keypair stands in for the project's signing key and `fetch` is
 * stubbed to serve its public half as a JWKS, so these run in CI with no
 * credentials. A separate opt-in suite exercises the real project.
 */

const PROJECT = 'https://test-project.supabase.co';
let privateKey;
let jwks;

const sign = async (claims = {}, { key = privateKey, kid } = {}) =>
  new SignJWT({ role: 'authenticated', ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: kid ?? jwks.keys[0].kid })
    .setIssuedAt()
    .setIssuer(`${PROJECT}/auth/v1`)
    .setAudience('authenticated')
    .setSubject(claims.sub ?? '11111111-1111-1111-1111-111111111111')
    .setExpirationTime('1h')
    .sign(key);

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  privateKey = pair.privateKey;
  const pub = await exportJWK(pair.publicKey);
  pub.kid = await calculateJwkThumbprint(pub);
  pub.alg = 'ES256';
  jwks = { keys: [pub] };
});

beforeEach(() => {
  process.env.SUPABASE_URL = PROJECT;
  process.env.SUPABASE_JWKS_URL = `${PROJECT}/auth/v1/.well-known/jwks.json`;
  resetJwksCache();
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => jwks,
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

describe('verifySupabaseToken', () => {
  test('accepts a correctly signed token and returns its claims', async () => {
    const { payload, error } = await verifySupabaseToken(await sign({ email: 'ada@example.com' }));
    expect(error).toBeUndefined();
    expect(payload.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.email).toBe('ada@example.com');
  });

  test('rejects a token signed by a different key', async () => {
    const { privateKey: other } = await generateKeyPair('ES256');
    const { error } = await verifySupabaseToken(await sign({}, { key: other }));
    expect(error).toBeTruthy();
  });

  test('rejects a tampered signature', async () => {
    const token = await sign();
    const { error } = await verifySupabaseToken(`${token.slice(0, -4)}AAAA`);
    expect(error).toBeTruthy();
  });

  // A token minted by someone else's Supabase project is correctly signed —
  // by their key. The issuer check is what stops it being accepted here.
  test('rejects a token from another project', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: jwks.keys[0].kid })
      .setIssuedAt()
      .setIssuer('https://someone-else.supabase.co/auth/v1')
      .setAudience('authenticated')
      .setSubject('22222222-2222-2222-2222-222222222222')
      .setExpirationTime('1h')
      .sign(privateKey);
    const { error } = await verifySupabaseToken(token);
    expect(error).toBe('Invalid token');
  });

  test('rejects a token with the wrong audience', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: jwks.keys[0].kid })
      .setIssuedAt()
      .setIssuer(`${PROJECT}/auth/v1`)
      .setAudience('some-other-audience')
      .setSubject('33333333-3333-3333-3333-333333333333')
      .setExpirationTime('1h')
      .sign(privateKey);
    expect((await verifySupabaseToken(token)).error).toBeTruthy();
  });

  test('reports an expired token distinctly', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: jwks.keys[0].kid })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setIssuer(`${PROJECT}/auth/v1`)
      .setAudience('authenticated')
      .setSubject('44444444-4444-4444-4444-444444444444')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey);
    expect((await verifySupabaseToken(token)).error).toBe('Token expired');
  });

  test('rejects an unknown signing key', async () => {
    const { error } = await verifySupabaseToken(await sign({}, { kid: 'no-such-kid' }));
    expect(error).toBe('Unknown signing key');
  });

  test('rejects absent or malformed input', async () => {
    expect((await verifySupabaseToken('')).error).toBe('No token provided');
    expect((await verifySupabaseToken(undefined)).error).toBe('No token provided');
    expect((await verifySupabaseToken(null)).error).toBe('No token provided');
    expect((await verifySupabaseToken('not.a.jwt')).error).toBeTruthy();
  });

  // The key set is cached; a burst of requests must not become a burst of
  // fetches against the JWKS endpoint.
  test('caches the key set across verifications', async () => {
    const token = await sign();
    await verifySupabaseToken(token);
    await verifySupabaseToken(token);
    await verifySupabaseToken(token);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('bearerToken', () => {
  const req = (authorization) => ({ get: (h) => (h.toLowerCase() === 'authorization' ? authorization : undefined), headers: { authorization } });

  test('extracts a bearer token, case-insensitively on the scheme', () => {
    expect(bearerToken(req('Bearer abc.def.ghi'))).toBe('abc.def.ghi');
    expect(bearerToken(req('bearer abc.def.ghi'))).toBe('abc.def.ghi');
  });

  test('ignores other schemes and malformed headers', () => {
    expect(bearerToken(req('Basic abc'))).toBeNull();
    expect(bearerToken(req('Bearer'))).toBeNull();
    expect(bearerToken(req(''))).toBeNull();
    expect(bearerToken({ headers: {} })).toBeNull();
  });
});
