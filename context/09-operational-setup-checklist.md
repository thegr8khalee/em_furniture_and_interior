# 09 — Operational Setup Checklist

> Environment configuration, secret management, and cron setup across Vercel, Render and Supabase.
> Deployment procedure is in `docs/DEPLOYMENT.md`; this file is the readiness checklist.

---

## 1. Environments

| Environment | Storefront | ERP | API | Database |
|---|---|---|---|---|
| Local | Vite `:5173` | Vite `:5174` | `:5000` | PostgreSQL in Docker |
| Staging | Vercel preview | Vercel preview (restricted) | Render staging | Supabase staging project |
| Production | Vercel | Vercel (restricted) | Render | Supabase production project, PITR on |

**Use a separate Supabase project for staging, not a separate schema.** Auth configuration, RLS policies
and storage buckets are project-scoped; sharing a project means staging can issue tokens valid against
production data.

---

## 2. Environment variables

### `apps/api` — current `[NOW]`

Per `backend/.env.example`: `NODE_ENV`, `PORT`, `FRONTEND_URL`, `MONGODB_URI`, `JWT_SECRET`,
`CLOUDINARY_*`, `GOOGLE_*` + `EMAIL_USER`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`,
`FLUTTERWAVE_CURRENCY`, `STRIPE_SECRET_KEY`, `STRIPE_CURRENCY`, `TAX_RATE_PERCENTAGE`,
`SEED_ADMIN_PASSWORD`.

### `apps/api` — target `[TARGET]`

| Variable | Notes |
|---|---|
| `NODE_ENV`, `PORT` | unchanged |
| `STOREFRONT_URL`, `ERP_URL` | replaces `FRONTEND_URL`; both go in the CORS allowlist |
| `DATABASE_URL` | Supabase **pooler** connection, for the running application |
| `DIRECT_DATABASE_URL` | Supabase **direct** connection, for migrations only — see `06` §8 |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | public client configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | server only — never reaches a browser bundle |
| `SUPABASE_JWKS_URL` | token verification |
| `CLOUDINARY_*` | unchanged; now used to mint upload signatures rather than receive uploads |
| `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` | webhook secret is new |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | |
| `TAX_RATE_PERCENTAGE` | server-side computation only (F-05) |
| `RESEND_API_KEY` | after consolidating three email paths to one |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | |
| `BACKUP_ENCRYPTION_KEY` | 256-bit hex, **held outside the cloud provider** |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET` | Backblaze B2 |
| `LOG_LEVEL` | |

`JWT_SECRET` and `MONGODB_URI` are retired at the end of R3.

### `apps/storefront` and `apps/erp` `[TARGET]`

`VITE_API_BASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_CLOUDINARY_CLOUD_NAME` ·
`VITE_SENTRY_DSN`.

**Everything prefixed `VITE_` is public.** It is compiled into the bundle and readable by anyone. The
service-role key and every gateway secret must never appear with that prefix. Worth stating explicitly
because it is the single most common way a Supabase project gets compromised.

---

## 3. Vercel

- [ ] Two projects from one repository, root directories `apps/storefront` and `apps/erp`
- [ ] Build command respects workspaces (`npm run build -w apps/storefront`)
- [ ] Ignored-build step so a storefront-only commit does not rebuild the ERP
- [ ] Storefront: custom domain, `sitemap.xml` and `robots.txt` (currently served by the API — that route
      moves or is proxied)
- [ ] ERP: **Vercel Authentication or IP allowlist enabled**, `X-Robots-Tag: noindex`, no custom domain
      that hints at its purpose
- [ ] Environment variables set per environment, production values not shared with previews
- [ ] Preview deployments point at staging API and staging Supabase, never production

## 4. Render

- [ ] API as a Docker web service — **not** a native Node service; Puppeteer needs Chromium system
      libraries installed in the image
- [ ] Instance with **1 GB+ memory**; headless Chromium will OOM on 512 MB
- [ ] Health check endpoint configured
- [ ] `trust proxy` remains set — `express-rate-limit` depends on it behind Render's TLS terminator
- [ ] Autoscaling or a paid always-on instance; free-tier spin-down loses in-flight webhooks
- [ ] Cron job: nightly encrypted backup (`docs/BACKUP_RUNBOOK.md`)
- [ ] Cron job or `pg_cron`: activity-log retention, replacing the Mongo TTL index (`06` §4)
- [ ] Staging service mirroring production configuration

## 5. Supabase

- [ ] Production and staging projects, separate
- [ ] Point-in-time recovery enabled on production
- [ ] Auth: email/password, password policy, anonymous sign-ins enabled for guest carts
- [ ] Auth redirect allowlist limited to the two known origins
- [ ] RLS enabled and deny-all on every application table (`06` §4)
- [ ] Service-role key stored only in Render, never in Vercel
- [ ] Storage bucket for rendered documents, private, signed-URL access only
- [ ] `pg_cron` enabled if used for retention
- [ ] Connection pool sizes set deliberately for the number of Render instances

## 6. Cloudinary

- [ ] Signed upload preset; unsigned uploads disabled
- [ ] Asset kinds allowlisted server-side (product image, room photo, floor plan, receipt, proof of payment)
- [ ] Receipts and proof-of-payment stored as **authenticated** assets, served by signed delivery URL
- [ ] Upload size and format limits enforced in the signature, not only in the client

## 7. Payment gateways

- [ ] Webhook endpoint registered with each gateway, pointing at the Render API
- [ ] Webhook secrets stored; signature verification tested against a tampered payload
- [ ] Raw-body parser mounted on webhook routes only (`06` §4)
- [ ] Test-mode credentials in staging; production keys never in a preview environment

## 8. Observability

- [ ] Sentry initialised before application code, with PII scrubbing verified against a real order payload
- [ ] Winston structured logs; Morgan request logs
- [ ] Alert on: webhook signature failures, failed migrations, backup job failure, trial balance not netting
      to zero
- [ ] Uptime check on the API health endpoint

## 9. Pre-cutover gate for R3

Nothing proceeds until every item is true:

- [ ] Migration suite runs twice against a clean database with identical results
- [ ] Production-snapshot rehearsal completed **twice**
- [ ] Written rollback procedure executed at least once
- [ ] Row counts and financial totals reconcile between MongoDB and PostgreSQL
- [ ] Backup taken, and a restore from it verified into a scratch database
- [ ] Maintenance window agreed and customers notified
- [ ] A named person is on call with the rollback runbook open
