import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression for the R1 monorepo split.
 *
 * The split moves files between workspaces and rewrites import paths; it must
 * change nothing a user can see (context/08-admin-ui-guidelines.md section 0).
 * These baselines are the evidence for that claim.
 *
 * Runs against `vite preview` — the production build, not the dev server, so
 * what is measured is what ships.
 */
export default defineConfig({
  testDir: '.',
  snapshotDir: './snapshots',
  outputDir: './test-results',
  fullyParallel: false,     // screenshots are cheaper serial than flaky parallel
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Framer Motion animates via requestAnimationFrame, so settling is timing
  // sensitive on a loaded machine — different routes flake on different runs.
  // The harness waits for images, in-flight opacity and a quiet DOM, but a
  // shared CI runner can still stall past that. Retries separate the two
  // failure modes cleanly: a settle flake passes on a second attempt, a real
  // rendering regression fails every attempt. Retries never rewrite baselines.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  expect: {
    toHaveScreenshot: {
      // Anti-aliasing differs slightly between machines; this tolerates a few
      // stray pixels while still catching a moved element or a colour change.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    // Some sandboxes ship a pinned Chromium that does not match the browser
    // build this Playwright version would download. CI installs its own, so
    // this override is opt-in via the environment rather than hard-coded.
    ...(process.env.E2E_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
      : {}),
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    timezoneId: 'Africa/Lagos',
    locale: 'en-NG',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'off',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], isMobile: true },
    },
  ],

  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    cwd: '../frontend',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
