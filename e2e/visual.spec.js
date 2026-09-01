import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES } from './routes.js';
import { visit } from './support/harness.js';

/**
 * Baselines for the R1 monorepo split.
 *
 * These are change detectors, not design review. A diff here after moving files
 * between workspaces means the split altered rendering, which the UI-parity
 * constraint forbids.
 *
 * Update a baseline only for a change you intended, in its own commit:
 *   npm run test:visual -- --update-snapshots
 */
test.describe('storefront visual baselines', () => {
  for (const { name, path } of PUBLIC_ROUTES) {
    test(name, async ({ page }) => {
      await visit(page, path);
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
  }
});
