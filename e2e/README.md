# End-to-end and visual regression

Baselines that enforce the UI-parity constraint for the R1 monorepo split
(`context/08-admin-ui-guidelines.md` §0): moving files between workspaces must
change nothing a user can see.

## Running

```bash
npm run test:visual          # compare against committed baselines
npm run test:e2e             # visual + structural
npm run test:visual:update   # rewrite baselines — see below
```

Builds the frontend and serves it with `vite preview`, so what is measured is
the production build rather than the dev server.

## Determinism

Screenshots are worthless if they diff on every run, because people learn to
ignore them. Three sources of variance are removed in `support/harness.js`:

| Source | Treatment |
|---|---|
| Live data | Every `/api` call is served from `support/fixtures.js`. A catch-all means nothing reaches a real server. |
| Network | Cloudinary and placeholder images are replaced with a fixed 1×1 PNG; Google Fonts and map embeds are aborted. |
| Motion and time | Animations and transitions are zeroed, `prefers-reduced-motion` is set, and the clock is pinned to a fixed instant. |

The fixture shapes were taken from the Zustand stores, not guessed — several
differ from the obvious guess (`/products/count` returns `totalProducts`,
`/blog` returns `items`, a product detail returns the document itself rather
than a wrapper). If a store's contract changes, update `fixtures.js` or the page
will render its error state and the baseline will silently encode that.

## Why fonts are blocked

Blocking web fonts means these render in the fallback stack, not Montserrat and
Playfair Display. That is deliberate: the baselines detect change across a
refactor, they are not design review, and a network-dependent font fetch is the
most common source of CI flake in visual testing.

The trade-off is that a split which dropped the Google Fonts stylesheet would
not show as a pixel diff — so `structure.spec.js` asserts the stylesheet link
and the daisyUI theme tokens directly.

## Retries

Visual tests retry (twice in CI, once locally). That is not a way to paper over
regressions: a genuine rendering change fails every attempt, while a settle
flake — Framer Motion still mid-transition when the machine is loaded — passes
on the next. Retries never rewrite a baseline.

If a route fails *consistently*, it is a real diff. Look at the image in
`e2e/test-results/` before touching anything.

## Updating baselines

Only for a change you intended, and in its own commit:

```bash
npm run test:visual:update
```

**During R1–R4 the baselines must not move at all.** A diff during the split
means the split changed rendering, which the parity constraint forbids. Updating
them to make CI green defeats the entire purpose of having them.

## Sandboxes with a pinned Chromium

If Playwright's browser build does not match a preinstalled one:

```bash
E2E_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:visual
```

CI installs its own matching browser, so this is local-only. Note that a
different Chromium build renders text slightly differently and will diff every
snapshot — baselines are captured and compared with the same version.

## Coverage

26 storefront routes × 2 viewports (desktop 1280×800, Pixel 7). Console routes
need an authenticated admin and are added when the split introduces the ERP app.
