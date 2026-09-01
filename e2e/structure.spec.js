import { test, expect } from '@playwright/test';
import { visit } from './support/harness.js';

/**
 * Structural assertions that the pixel baselines deliberately cannot make.
 *
 * Web fonts are blocked in the harness so screenshots are deterministic, which
 * means a split that dropped the Google Fonts stylesheet would not show up as a
 * pixel diff. These check the configuration directly instead.
 */
test.describe('page shell', () => {
  test('loads the brand typefaces and daisyUI theme', async ({ page }) => {
    await visit(page, '/');

    // Must target the stylesheet link specifically: index.html also carries a
    // <link rel="preconnect"> to the same host, which has no family names.
    const fontHref = await page
      .locator('link[rel="stylesheet"][href*="fonts.googleapis.com"]')
      .first()
      .getAttribute('href');
    expect(fontHref).toContain('Montserrat');
    expect(fontHref).toContain('Playfair+Display');
    expect(fontHref).toContain('Poppins');

    // Theme tokens come from the daisyUI plugin block in index.css. If the
    // split loses that stylesheet these resolve to empty strings.
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        primary: s.getPropertyValue('--color-primary').trim(),
        secondary: s.getPropertyValue('--color-secondary').trim(),
        base100: s.getPropertyValue('--color-base-100').trim(),
      };
    });
    expect(tokens.primary).not.toBe('');
    expect(tokens.secondary).not.toBe('');
    expect(tokens.base100).not.toBe('');
  });

  test('renders the app shell and footer', async ({ page }) => {
    await visit(page, '/');
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('footer').first()).toBeVisible();

    // Deliberately not asserting a navigation landmark. The only <nav> on the
    // page is the mobile bottom bar (lg:hidden); the desktop navbar is built
    // from plain divs. Pinning it by Tailwind class would be brittle, and the
    // visual baselines already cover how the navbar renders — that is their
    // job. The missing landmark is recorded as an accessibility gap instead.
  });

  test('does not ship console code to the storefront bundle', async ({ page }) => {
    const scripts = [];
    page.on('response', (r) => {
      if (r.url().endsWith('.js')) scripts.push(r.url());
    });
    await visit(page, '/');

    // Admin routes are lazy-loaded today and must stay that way after the
    // split, when the console becomes a separate deployment entirely.
    const adminChunks = scripts.filter((u) => /admin|Dashboard|Analytics|Finance/i.test(u));
    expect(adminChunks).toEqual([]);
  });
});
