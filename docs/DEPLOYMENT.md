# Deployment

Three deployables from one repository.

| Workspace | Deploys to | What it is |
| --- | --- | --- |
| `apps/api` | Render (web service) | Express API. Serves no HTML. |
| `apps/web` | Vercel | Public storefront. |
| `apps/erp` | Vercel (separate project) | Operations console. Access-restricted. |

`packages/shared`, `packages/domain`, `packages/ui` and `packages/config` are
internal workspaces. They are not published and not deployed; npm links them
into `node_modules/@em/*` at install time.

## Render — apps/api

| Setting | Value |
| --- | --- |
| Root directory | *(repository root, not `apps/api`)* |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/healthz` |

The root directory is the repository root because npm workspaces resolve from
there — installing inside `apps/api` alone would not link `@em/shared`.

Use `/healthz` as the health check, never `/readyz`. Liveness must not fail
because the database blipped; restarting the container turns a database incident
into an outage. `/readyz` exists for a load balancer to drain an instance, and
reports 503 while Mongo is unreachable.

Puppeteer's Chromium is cached at `<repo>/.cache/puppeteer` via the root
`.puppeteerrc.cjs`, because Render wipes `~/.cache` between deploys. If PDF
generation starts failing after a deploy, check that directory survived the
build. `npm ci --ignore-scripts` skips the download entirely — correct for CI,
wrong for Render.

Note that PDF rendering holds a browser process in the API's memory for the
lifetime of the service. On a small instance a document render competes with
request handling; moving it to its own service is tracked as follow-up work.

### Required environment

```
NODE_ENV=production
MONGODB_URI=...
JWT_SECRET=...
PAYSTACK_SECRET_KEY=...          # also the webhook HMAC key
STOREFRONT_URL=https://<storefront domain>
ERP_URL=https://<console domain>
FRONTEND_URL=https://<storefront domain>   # payment callback URLs still read this
CLOUDINARY_CLOUD_NAME= / _API_KEY= / _API_SECRET=
```

`STOREFRONT_URL` and `ERP_URL` are the CORS allowlist. An origin that is not
listed is refused — not reflected back — so a missing value shows up as every
browser request failing, and the API logs `Blocked a cross-origin request from
an unlisted origin` with the origin it saw. No trailing slashes.

The service **exits non-zero** if it cannot reach the database at startup.
A failed deploy is the intended outcome; the previous version keeps serving.

### Paystack webhook

Register `https://<api domain>/api/payments/paystack/webhook` in the Paystack
dashboard under Settings → API Keys & Webhooks. Until that is done the webhook
exists but is never called, and payment confirmation falls back to depending on
the customer's browser completing the redirect.

## Vercel — apps/web and apps/erp

Two projects, both with the repository root as the root directory.

| | Storefront | Console |
| --- | --- | --- |
| Build command | `npm run build:web` | `npm run build:erp` |
| Output directory | `apps/web/dist` | `apps/erp/dist` |
| Install command | `npm ci` | `npm ci` |

Both are single-page apps: add a rewrite of `/(.*)` to `/index.html` so a
refresh on a deep link does not 404.

### Storefront environment

```
VITE_API_URL=https://<api domain>/api
VITE_ERP_URL=https://<console domain>/admin/dashboard
```

### Console environment

```
VITE_API_URL=https://<api domain>/api
VITE_STOREFRONT_URL=https://<storefront domain>
```

Everything `VITE_`-prefixed is compiled into the bundle and readable by any
visitor. Never put a secret in one.

The console should also be access-restricted at the platform level — Vercel
password protection or an IP allowlist. It is `noindex, nofollow` and its login
is gated, but a console reachable by anyone on the internet is a larger attack
surface than it needs to be.

## The cookie problem — decide before going live

Sessions are still httpOnly cookies signed with `JWT_SECRET`. That worked when
Express served the frontend from the same origin. It does not survive
`*.vercel.app` calling `*.onrender.com`: those are unrelated registrable
domains, so the session cookie is a **third-party cookie**, which Safari blocks
by default and Chrome restricts. Staff will appear to sign in successfully and
then be signed out on the next request.

Two ways out:

1. **One parent domain.** Point `api.emfurniture.com`, `erp.emfurniture.com` and
   the storefront apex at the three deployments via custom domains, and scope
   the cookie to `.emfurniture.com`. The cookie becomes first-party and nothing
   in the auth code has to change. Both platforms support custom domains.
2. **Bearer tokens.** Move the session out of a cookie into an `Authorization`
   header held by each app. This works regardless of domain topology, but trades
   CSRF exposure for XSS token-theft exposure and is a real change to the auth
   path — it belongs with the Supabase migration, not before it.

Until one is chosen, run the three deployments under one parent domain. The
`withCredentials: true` in `packages/domain/src/lib/axios.js` and
`credentials: true` in the API's CORS config both assume it.
