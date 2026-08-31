# 03 — Backend Architecture

> Runtime, request pipeline, data layer, and integrations. Current and target.

---

## 1. Current runtime `[NOW]`

`backend/src/index.js` bootstraps a single Express 4 process: Helmet CSP, compression, cookie-parser,
environment-conditional CORS, a 1 MB JSON body limit, a global rate limiter on `/api`, then 29 route
mounts, Swagger UI, an API 404 handler, static serving of the built frontend in production, a global
error handler, and graceful shutdown on `SIGTERM`/`SIGINT`.

Two details worth knowing:

- **`app.set('trust proxy', 1)`** is required because Render terminates TLS at a proxy;
  `express-rate-limit` refuses to run without it.
- **A 50 MB body parser is mounted on four route prefixes** (`/api/admin`, `/api/consultations`,
  `/api/designers`, `/api/payments`) to accept base64 image payloads. This is the mechanism that
  `00-master-context.md` §4 forbids under "zero raw file payloads" — it makes the API a file-transfer
  service and a memory-pressure target. `[GAP]`

### Request pipeline

```
request
  → helmet · compression · cookieParser · cors
  → body parser (1 MB, or 50 MB on four prefixes)
  → apiLimiter                                  (100 / 15 min)
  → route-specific limiter                      (auth 5/15min · create 20/h · export 5/h · search 30/min)
  → identifyGuest | protectRoute | protectAdminRoute
  → requirePermissions([...])
  → activityTracker (fire-and-forget) | auditLogger
  → controller
  → global error handler
```

The middleware design is sound. `protectAdminRoute` re-reads the admin from the database on every
request, so permission changes take effect immediately, and `requirePermissions` is a clean, composable
gate. This is the part of the backend that does not need rewriting.

### Data layer

Mongoose 8 against MongoDB, 20 models. Notable characteristics:

- **Polymorphic references** via `refPath` in `user`, `guest`, `order`, `coupon` — an `item` ObjectId plus
  an `itemType` discriminator of `'Product' | 'Collection'`.
- **Deep embedding** — cart and wishlist inside `user` and `guest`; items, addresses and status history
  inside `order`.
- **TTL indexes** for `activityLog` (90 days) and `guest` sessions.
- **No transactions anywhere.** No `startSession` call exists in the codebase. `[GAP F-06]`
- **Eight of twenty models declare no indexes**, including `product` and `user`. `[GAP F-12]`

### Known structural weaknesses

`admin.controller.js` at 1,402 lines is roughly a fifth of all controller code and mixes catalog, staff,
banner and dashboard concerns. Route files are well separated; the controllers behind them are not.

---

## 2. Target runtime `[TARGET]`

Same Express foundation — there is no reason to change frameworks — with the data layer, auth, and
observability replaced, and modules reorganised by domain rather than by technical layer.

```
apps/api/src/
├── server.js                   # bootstrap only
├── platform/
│   ├── auth/                   # JWKS verification, permission loading, requirePermissions
│   ├── errors/                 # AppError hierarchy, boundary masking
│   ├── logging/                # winston, morgan, Sentry init with PII scrubbing
│   ├── openapi/                # spec generation from Zod schemas
│   └── db/                     # Sequelize instance, pool config, transaction helper
├── db/
│   ├── migrations/             # 0001_*.sql … numbered, idempotent
│   └── models/                 # Sequelize models by schema
└── modules/
    ├── catalog/  cms/  sales/  crm/  inventory/  finance/  purchasing/  core/
        └── <module>/ { routes.js · controller.js · service.js · schema.js · *.test.js }
```

**Module boundary rule.** A module may import from `platform/` and from its own directory. Cross-module
access goes through the other module's `service.js`, never its models directly. This is what makes the
domain-schema separation in `docs/ERD_DATA_MODEL.md` mean something at runtime rather than only in the
database.

### Authentication `[TARGET]`

Supabase issues the token; Express verifies it against the project JWKS and loads authorisation state:

```
request → verifySupabaseJWT (JWKS, cached)
        → load core_staff row by auth user id  → req.actor { id, role, permissions }
        → requirePermissions([...])
        → requireApprover(...)   # segregation of duties, see 02 §4
```

`requirePermissions` carries over from the current codebase essentially unchanged. `requireApprover` is
new and enforces that the approving actor is not the initiating actor.

### Transactions `[TARGET]`

Every write that touches more than one table runs inside a Sequelize managed transaction. Three
operations additionally require row locking: gapless document numbering (`SELECT … FOR UPDATE` on the
counter row), stock reservation, and period close.

### Error handling `[TARGET]`

A typed `AppError` hierarchy. The boundary handler returns `AppError` instances to clients as-is and
replaces everything else with a generic 500 plus a correlation id, so driver messages, stack traces and
connection strings never reach a client. `platform/logging` strips request bodies, auth headers and query
parameters before dispatching to Sentry — order and consultation payloads contain customer addresses and
phone numbers.

---

## 3. Integrations

| Service | `[NOW]` | `[TARGET]` |
|---|---|---|
| Cloudinary | Base64 through the API, 50 MB limit `[GAP]` | `POST /api/uploads/sign` returns a short-lived signature; browser uploads directly; private assets served via signed delivery URLs |
| Paystack / Stripe | Initialize, browser callback, **and HMAC-verified webhooks** on a raw-body route, idempotent, amount-reconciled | unchanged | 
| TaxJar | Called at checkout, but the client supplies the final `taxAmount` `[GAP F-05]` | Server computes and stores; client value ignored |
| Email | Resend + `googleapis` + `nodemailer` — three paths | One provider, one templating layer, delivery status recorded |
| PDF | Puppeteer + PDFKit, generated on demand, discarded `[GAP F-07]` | Rendered once, stored in Supabase Storage, served by reference |
| Sentry | none `[GAP]` | `instrument.js` initialised before app code, PII scrubbed |
| Backblaze B2 | none | Nightly encrypted dump target — `docs/BACKUP_RUNBOOK.md` |

---

## 4. Deployment topology `[TARGET]`

Detail in `docs/DEPLOYMENT.md`.

| Tier | Platform | Notes |
|---|---|---|
| `apps/storefront` | Vercel | Public, indexed, ISR/static where possible |
| `apps/erp` | Vercel | Separate project, access-restricted, `noindex` |
| `apps/api` | Render (Docker) | Chromium system libraries; 1 GB+ memory; direct DB connection for migrations |
| Nightly backup | Render Cron | `pg_dump` → AES-256-GCM → Backblaze B2 |
| Database, Auth, Storage | Supabase | Postgres 15+, PITR enabled |

The API stops serving the frontend build: `index.js`'s production static-file block and SPA catch-all are
removed once both clients live on Vercel.
