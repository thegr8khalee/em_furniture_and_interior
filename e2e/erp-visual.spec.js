import { test, expect } from '@playwright/test';
import { ERP_ROUTES } from './routes.js';
import { visit } from './support/harness.js';

/**
 * Console baselines.
 *
 * Runs against the ERP app's own preview server, since after the R1 split it is
 * a separate deployment. Only the login screen is reachable without an
 * authenticated admin; the protected routes redirect, and covering them needs a
 * seeded session.
 */
test.describe('erp visual baselines', () => {
  test.use({ baseURL: process.env.E2E_ERP_BASE_URL || 'http://127.0.0.1:4174' });

  for (const { name, path } of ERP_ROUTES) {
    test(name, async ({ page }) => {
      await visit(page, path);
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
  }
});
