/**
 * Shared HTTP client.
 *
 * Both applications talk to the same API, so the base URL, credential handling
 * and (later) auth header belong in one place rather than being configured
 * twice and drifting.
 *
 * Note the production base URL is still same-origin `/api`. That holds while
 * the API serves the built storefront; it stops being true once the apps are
 * deployed to Vercel and the API to Render, at which point this becomes an
 * explicit VITE_API_BASE_URL. See context/06-replatform-plan.md section 4.
 */
export { axiosInstance } from './axios.js';
