import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Workspace packages ship raw JSX rather than a build step. Aliasing them to
// source guarantees Vite's React transform runs over them; without it, linked
// packages can be treated as pre-built dependencies and the JSX reaches the
// browser untransformed.
const pkg = (name) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.js`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@em/ui': pkg('ui'),
      '@em/api-client': pkg('api-client'),
    },
    // Without this the aliased packages resolve their own copy of React and
    // react-router from the root node_modules while the app uses the one in
    // apps/storefront, and two router instances mean useContext() returns null
    // ("Cannot destructure property 'basename'"). Any library holding module
    // level state must resolve to exactly one instance.
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', 'framer-motion'],
  },
});
