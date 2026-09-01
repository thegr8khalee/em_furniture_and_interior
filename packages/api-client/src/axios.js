import axios from 'axios';
import { getAccessToken } from './supabase.js';

export const axiosInstance = axios.create({
  // An explicit base URL wins; it is required once the apps and API are on
  // different origins (Vercel + Render). Same-origin '/api' remains the default
  // while the API serves the built client.
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.MODE === 'development' ? 'http://localhost:5000/api' : '/api'),
  withCredentials: true,
});

/**
 * Attach the Supabase access token to every request.
 *
 * `withCredentials` stays on so the legacy `jwt` cookie still authenticates
 * anything not yet migrated — both schemes run side by side during R2, and the
 * server accepts either. A failure to read the session must not block the
 * request: it simply means there is no bearer token to send.
 */
axiosInstance.interceptors.request.use(async (config) => {
  try {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // Unconfigured or storage unavailable — fall through to cookie auth.
  }
  return config;
});
