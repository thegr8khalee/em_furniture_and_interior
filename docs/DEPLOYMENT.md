# Deployment

> Vercel (two frontends) + Render (API and cron) + Supabase (database, auth, storage).
> Readiness checklist is `context/09-operational-setup-checklist.md`.

---

## 1. Topology `[TARGET]`

| Tier | Platform | Notes |
|---|---|---|
| `apps/storefront` | Vercel | Public, indexed, custom domain |
| `apps/erp` | Vercel | Separate project, access-restricted, `noindex` |
| `apps/api` | Render — **Docker web service** | One deployment, `/api/shop` and `/api/erp` |
| Nightly backup | Render Cron | See `BACKUP_RUNBOOK.md` |
| Retention job | Render Cron or `pg_cron` | Drops activity-log partitions |
| Postgres, Auth, Storage | Supabase | PITR enabled on production |

The API stops serving frontend assets. `backend/src/index.js`'s production static block and `app.get('*')`
SPA catch-all are removed once both clients live on Vercel.

---

## 2. Vercel

Two projects from one repository, root directories `apps/storefront` and `apps/erp`.

```
Build command:   npm run build -w apps/storefront
Output:          apps/storefront/dist
Install:         npm ci            # at the repo root, workspaces resolve
Node:            22.x
```

**Ignored build step.** Without one, every commit rebuilds both apps. Use Vercel's
`git diff HEAD^ HEAD --quiet -- apps/storefront packages` idiom so a console-only change does not redeploy
the storefront and vice versa.

**ERP access restriction.** The console must not be publicly reachable. Vercel Authentication (SSO
protection) is the least-effort option; an IP allowlist at the edge works if staff have stable addresses.
Also set `X-Robots-Tag: noindex, nofollow` in `vercel.json`, and do not choose a hostname that advertises
what it is.

**Environment variables.** Everything prefixed `VITE_` is compiled into the bundle and publicly readable.
The Supabase service-role key and every gateway secret must never appear in a Vercel project. Preview
deployments point at staging API and staging Supabase — never production.

**`sitemap.xml` and `robots.txt`** are currently served by the API at the site root
(`backend/src/routes/sitemap.routes.js`). After the split they must either move into the storefront build
or be proxied through a Vercel rewrite, or search engines will 404 them.

---

## 3. Render

**Docker, not a native Node service.** `lib/invoiceGenerator.js` launches headless Chromium via Puppeteer;
a native environment will not have its system libraries. The Dockerfile installs them explicitly and sets
`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` appropriately if using a system Chromium.

**Memory: 1 GB minimum.** Headless Chromium reliably OOMs on 512 MB, and it fails at PDF generation time —
which is to say, when someone is trying to send a customer an invoice.

**Keep `app.set('trust proxy', 1)`.** Render terminates TLS at a proxy and forwards the client IP in
`X-Forwarded-For`; `express-rate-limit` refuses to run without the opt-in. This is already correct in
`index.js` and must survive the move.

**No free tier for production.** Free instances spin down when idle, and a spun-down service drops
inbound gateway webhooks — reintroducing F-01 by a different route. Gateways retry, but not indefinitely.

**Health check** endpoint configured so Render restarts a wedged instance.

**Database connections.** The service uses `DATABASE_URL` (Supabase pooler). Migrations use
`DIRECT_DATABASE_URL`. Pool size × instance count must stay under the pooler's limit.

---

## 4. Supabase

Separate projects for staging and production — not separate schemas. Auth configuration, RLS policies and
storage buckets are project-scoped, so a shared project means staging tokens are valid against production
data.

- Point-in-time recovery on production
- Anonymous sign-ins enabled (guest carts)
- Redirect allowlist limited to the two known origins
- RLS enabled deny-all on every application table; the API uses the service role
  (`context/06-replatform-plan.md` §4 explains why authorization does not live in RLS)
- Private storage bucket for rendered documents, signed-URL access only

---

## 5. Release procedure

Ordinary release:

1. Merge to `main` → CI runs lint, tests, migration idempotency, OpenAPI drift, visual regression
2. Migrations apply against `DIRECT_DATABASE_URL` as a pre-deploy step
3. Render deploys the API; health check gates the switchover
4. Vercel deploys whichever apps changed

**Migrations run before the new API code, so every migration must be backward-compatible with the
currently-running version.** Additive changes only in a single release: add a column, deploy code that
writes it, backfill, then remove the old column in a *later* release. A migration that drops or renames a
column in the same release as the code depending on it guarantees errors during the rollover window.

---

## 6. The R3 cutover

The only release requiring a maintenance window. Gate conditions in
`context/09-operational-setup-checklist.md` §9 — all of them, including two completed rehearsals and one
executed rollback.

1. Announce the window; enable maintenance mode on both Vercel apps
2. Final MongoDB backup; verify it restores
3. Run the migration against production Supabase
4. Reconcile: row counts **and financial totals**. A migration that moves 100% of rows and 99.98% of
   revenue has failed
5. Deploy the Postgres-backed API to Render; smoke-test the critical paths — login, product page,
   checkout, order list, document generation
6. Disable maintenance mode
7. Keep MongoDB running, read-only, for at least 30 days. `legacy_mongo_id` makes reconciliation possible
   for as long as it is retained

**Rollback** is: re-enable maintenance mode, redeploy the previous API image, point back at MongoDB,
disable maintenance mode. It works only while MongoDB is still authoritative — which is why no writes go
to Postgres before the window and MongoDB is not decommissioned for a month.
