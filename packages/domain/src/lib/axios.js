import axios from 'axios';

/**
 * The API runs on its own host (Render) while both frontends are served from
 * Vercel, so the base URL has to be configured per deployment. It was
 * previously a bare '/api' in any non-development build, which only ever
 * resolved when Express served the frontend itself.
 */
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const axiosInstance = axios.create({
  baseURL,
  // Session cookies are cross-origin now, so this is required rather than
  // incidental. See docs/DEPLOYMENT.md on why the origins must share a parent
  // domain in production.
  withCredentials: true,
});
