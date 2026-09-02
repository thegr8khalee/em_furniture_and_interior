import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // These stores are plain JavaScript; nothing here touches the DOM, so the
    // node environment keeps the suite fast.
    environment: 'node',
    setupFiles: ['./__tests__/setup.js'],
  },
});
