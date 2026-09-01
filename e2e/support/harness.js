import { ROUTES } from './fixtures.js';

/**
 * Makes a page deterministic enough to screenshot.
 *
 * Three sources of pixel variance have to go, or the baselines produce false
 * diffs on every run and people learn to ignore them:
 *
 *   1. Live data      — every /api call is served from fixtures.
 *   2. The network    — fonts, Cloudinary images and map embeds are blocked and
 *                       replaced with stable local stand-ins.
 *   3. Motion and time— animations are disabled and the clock is pinned.
 *
 * Blocking web fonts means these screenshots render in the fallback stack, not
 * Montserrat/Playfair. That is deliberate: the baselines exist to detect change
 * across a refactor, not to review design. The font *configuration* is asserted
 * separately in structure.spec.js, so a split that drops the stylesheet link is
 * still caught.
 */

// 1x1 transparent PNG — stands in for every remote image at a stable size.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export const FIXED_TIME = new Date('2026-06-01T12:00:00.000Z');

export async function stubApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    for (const [pattern, response] of ROUTES) {
      if (pattern.test(url)) {
        return route.fulfill({
          status: response.status ?? 200,
          contentType: 'application/json',
          body: JSON.stringify(response.body ?? {}),
        });
      }
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

/**
 * Stub Supabase so the clients' auth bootstrap is deterministic.
 *
 * The stores now call supabase-js on mount, and those requests go to
 * <project>.supabase.co — not to /api — so the API stub does not catch them.
 * Left unstubbed they would reach the real project over the network, making
 * the baselines depend on it. Everything here answers "signed out".
 */
export async function stubSupabase(page) {
  await page.route(/https:\/\/[a-z0-9-]+\.supabase\.co\/.*/, async (route) => {
    const url = route.request().url();
    if (url.includes('/auth/v1/token') || url.includes('/auth/v1/user')) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Signed out fixture' }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

export async function blockExternal(page) {
  // Remote images (Cloudinary, placeholders) -> a fixed pixel, so layout is
  // driven by CSS rather than by whatever the CDN returns today.
  await page.route(/https:\/\/(res\.cloudinary\.com|placehold\.co)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
  );

  // Web fonts and third-party embeds: abort rather than fulfil, so the page
  // falls back consistently instead of waiting on a request that may or may
  // not resolve in CI.
  await page.route(
    /https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.google\.com|maps\.googleapis\.com|www\.gstatic\.com)\/.*/,
    (route) => route.abort()
  );
}

export async function freezeMotion(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      /* Carousels and marquees settle at their first frame. */
      [class*="animate-"] { animation: none !important; }
    `,
  });
}

/**
 * Navigate and settle. Framer Motion mounts with opacity/transform, so a
 * screenshot taken too early catches a half-faded page — hence the explicit
 * wait for the app root plus a short settle.
 */
/**
 * Wait until the DOM stops mutating, so JS-driven animation has finished.
 *
 * Framer Motion animates with requestAnimationFrame and inline styles, not CSS
 * animations, so the stylesheet in freezeMotion() does not stop it and neither
 * does Playwright's `animations: 'disabled'`. The entrance transitions on these
 * pages run up to 1.4s; screenshotting earlier catches a half-faded element,
 * and catches it at a slightly different point each run.
 */
async function waitForDomQuiet(page, { quietMs = 800, timeoutMs = 15000 } = {}) {
  await page.evaluate(
    ({ quietMs, timeoutMs }) =>
      new Promise((resolve) => {
        let timer;
        const done = () => {
          observer.disconnect();
          clearTimeout(deadline);
          resolve();
        };
        const bump = () => {
          clearTimeout(timer);
          timer = setTimeout(done, quietMs);
        };
        const observer = new MutationObserver(bump);
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['style', 'class'],
        });
        const deadline = setTimeout(done, timeoutMs);
        bump();
      }),
    { quietMs, timeoutMs }
  );
}

/**
 * Wait until no element is mid-fade.
 *
 * Framer Motion writes an inline `opacity` while a transition runs and removes
 * or settles it at the end. An element sitting strictly between 0 and 1 means
 * the animation is still in flight. DOM-quiet alone proved insufficient under
 * load: on a busy machine a run could go quiet during a slow transition and
 * screenshot a page that was very slightly different from the baseline.
 */
async function waitForOpacitySettled(page, { timeoutMs = 10000 } = {}) {
  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll('[style*="opacity"]')].some((el) => {
          const o = parseFloat(el.style.opacity);
          return Number.isFinite(o) && o > 0.001 && o < 0.999;
        }),
      undefined,
      { timeout: timeoutMs }
    )
    .catch(() => {});
}

/** Every <img> has either loaded or failed — never mid-decode. */
async function waitForImages(page) {
  await page
    .evaluate(() =>
      Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((r) => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
              })
        )
      )
    )
    .catch(() => {});
}

/**
 * Navigate and settle into a state that is the same on every run.
 *
 * The scroll pass exists because scroll-triggered reveals (whileInView) only
 * mount their content once seen. It is deliberately unhurried: stepping too
 * fast lets IntersectionObserver miss sections, and a section that reveals on
 * one run and not the next is exactly the false diff these baselines must not
 * produce.
 */
export async function visit(page, path) {
  await stubApi(page);
  await stubSupabase(page);
  await blockExternal(page);
  await page.clock.install({ time: FIXED_TIME });

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root > *', { state: 'attached', timeout: 15000 });
  await freezeMotion(page);
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.75);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 250));
    window.scrollTo(0, 0);
  });

  await waitForImages(page);
  await waitForOpacitySettled(page);
  await waitForDomQuiet(page);
}
