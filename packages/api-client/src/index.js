/**
 * Shared HTTP client and auth session.
 *
 * Both applications talk to the same API, so the base URL, the bearer token
 * attachment and the Supabase client belong in one place rather than being
 * configured twice and drifting.
 *
 * The production base URL is still same-origin `/api`, which holds while the
 * API serves a built client. It becomes an explicit VITE_API_BASE_URL once the
 * apps deploy to Vercel and the API to Render.
 */
export { axiosInstance } from './axios.js';
export {
  getSupabase,
  isSupabaseConfigured,
  getAccessToken,
  __resetSupabaseClient,
} from './supabase.js';
