import axios from 'axios';

/**
 * The API base URL configuration:
 * 1. If VITE_API_URL is explicitly configured, use it (e.g. direct external host or proxy).
 * 2. In production browser environments, default to '/api' so requests route via Vercel rewrites
 *    to the backend on Render, preserving first-party cookies and avoiding third-party cookie blocks.
 * 3. In local development or tests, default to 'http://localhost:5000/api'.
 */
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    return '/api';
  }
  return 'http://localhost:5000/api';
};

const baseURL = getBaseURL();

export const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});
