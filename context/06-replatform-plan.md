# 06 — Replatform Plan

> Migration to Supabase Auth, PostgreSQL + Sequelize, a split ERP application, a real test suite,
> generated API documentation, persisted documents, and Vercel + Render hosting.

---

## 1. One correction before anything else

**There is no Sequelize in this project to keep.** `backend/package.json` and every source file were
checked: the project is 100% Mongoose on MongoDB. There is no `sequelize` dependency, no Postgres driver,
no Supabase client anywhere in the repository.

"Keep Sequelize" is therefore read throughout this suite as **"use Sequelize as the ORM for the new
PostgreSQL database"**. If that is not what was meant, it is the one assumption to correct before work
starts, because every schema decision below follows from it.

**What that choice costs.** Sequelize is a capable ORM, but its migration tooling is weaker than Prisma's,
and it has no real support for what a double-entry ledger needs: `CHECK` constraints, `DEFERRABLE`
constraints, partial and expression indexes. Those will be written as raw SQL inside migration files.
That is normal and workable — it just means **Sequelize models are not the complete description of the
schema**, and `sync()` must never be trusted (see `00-master-context.md` §5).

---

## 2. Assessment of the plan

Every one of the six decisions is correct for where this system is going. PostgreSQL in particular is not
a preference: a general ledger that must always balance wants transactions and constraints, and
`05-erp-readiness-assessment.md` flagged exactly this as the decision to make before any finance work.
Vercel + Render + Supabase is a sound, boring, well-supported topology at this scale.

**But this is a replatform, not a refactor.** It touches every data-access path in 12,700 lines of
backend, replaces the auth system, and reorganises the frontend: realistically **12–16 weeks before a
single line of ERP feature work**.

It is not additive to the ERP estimate, though. Postgres and Supabase together remove an estimated 6–8
weeks from the later ERP phases, so the total lands close to the original figure with far better
foundations.

**Do the payment webhooks first, on the current stack.** Finding F-01 is money going unrecorded today. A
replatform is three to four months; a known revenue leak should not stay open that long when the fix is a
week and ports over nearly unchanged.

---

## 3. Order of operations

This matters more than any individual technical choice. These changes are separable, and doing them one
at a time means that when something breaks, you know what broke it.

| # | Phase | Effort | Why here |
|---|---|---|---|
| 0 | **Payment webhooks** on the current stack | 1 week | Live revenue leak. Ships before anything moves. |
| 1 | **Split the apps** into a monorepo | 2–3 weeks | Frontend-only, mechanical, lowest risk — do it while the backend is still familiar. Creates the workspace structure everything else flows through. |
| 2 | **Supabase Auth — still on MongoDB** | 2–3 weeks | Auth is separable from the database. Migrating it alone means debugging one system at a time. |
| 3 | **PostgreSQL + Sequelize** | 6–8 weeks | The big one. Tests and generated docs are written *during* this phase. |
| 4 | **Harden and document** | 2–3 weeks | Close remaining audit findings on the new stack; finish the test pyramid; switch docs to generated. |

Then the ERP phases from `05` §4, at roughly 20–26 weeks instead of 27–34.

Phase 2 is the non-obvious one. The instinct is to move auth and database together because both touch
`user`. Resist it: Supabase Auth can own identity while MongoDB still owns everything else, keyed by the
Supabase user id. That intermediate state is stable, shippable, and halves the size of the hardest phase.

---

## 4. Phase detail

### Phase 0 — Payment webhooks `1 week`

Signature-verified webhook endpoints for Paystack and Stripe. Verify the HMAC against the
raw request body (mount a raw body parser on these routes only — `express.json()` will otherwise have
already consumed and re-serialised it, and the signature will never match). Compare the settled amount
against `order.totalAmount` before marking paid, closing F-09. Make handlers idempotent: gateways retry,
and the same event will arrive more than once.

The browser callback stays, as a UX convenience. It stops being the source of truth.

### Phase 1 — Split the apps `2–3 weeks`

Target layout is in `02-repo-structure-and-modules.md` §2. The work is: create workspaces, extract
`components/ui/*` into `packages/ui`, extract the axios instance into `packages/api-client`, move the 11
console pages and `components/admin/*` into `apps/erp`, move the rest into `apps/storefront`.

**One API, not two.** Both clients hit the same database and the same domain logic; two backends means
two copies of order and pricing rules, which is how they drift. Keep one Express deployment with
`/api/shop` and `/api/erp` namespaces and different middleware on each.

Two things this quietly fixes: the ERP frontend becomes a separate Vercel deployment that can sit behind
access control and out of search indexes, and the console stops shipping in the same origin as the
storefront.

**Watch for:** `frontend/src/lib/axios.js` sets `baseURL: '/api'` in production, which assumes
same-origin. On Vercel + Render that is no longer true — both apps need an explicit API base URL, and
CORS on the API needs both origins.

**The UI must not change.** This phase moves files between workspaces and rewrites import paths; it
changes nothing a user can see. `index.css` and every component in `components/ui/` move verbatim, and
Tailwind, daisyUI and font versions stay pinned. Capture reference screenshots of every page before
starting and diff against them at the end — visual parity is an exit criterion, not a nicety. Full rules
in `08-admin-ui-guidelines.md` §0.

### Phase 2 — Supabase Auth `2–3 weeks`

Cleaner than expected, because Supabase happens to solve three existing problems.

- **Passwords migrate without a reset.** Hashes are bcrypt (`bcryptjs`, `passwordHash`), and Supabase
  Auth accepts bcrypt hashes on user import. Confirm against current Supabase documentation before
  committing to it, but this is a supported path.
- **Admins stop being a separate species.** Today `Admin` is its own collection with its own login, and
  both admins and customers receive a cookie named `jwt` on the same domain (F-10). One Supabase user
  pool plus a `core_staff` table for role and permissions eliminates that entire class of bug.
- **Guest sessions become anonymous sign-ins.** The hand-rolled `anonymousId` cookie and `GuestSession`
  TTL model map onto Supabase anonymous users, which convert to real accounts on signup — carrying the
  cart across, which the current code does manually.
- **Express verifies JWTs via JWKS** instead of a shared secret. `protectRoute` and `protectAdminRoute`
  collapse into one middleware that validates the token and loads permissions from `core_staff`.
  `requirePermissions` and the permission model survive untouched.

**The call that matters: do not express ERP authorization in Row Level Security.** RLS is per-row and
per-user; these rules are per-action and involve business logic — approval limits, period locks, posting
rules, no-self-approval. Keep Express as the only thing that talks to the database, using the service
role. Enable RLS anyway, deny-all on ERP tables, as defence in depth so a leaked anon key is not a breach.

Because Supabase issues bearer tokens rather than cookies, this phase also removes the cross-origin
cookie problem that Phase 1 would otherwise have created. That is why it comes second.

### Phase 3 — PostgreSQL + Sequelize `6–8 weeks`

Four schema decisions, all expensive to reverse once data has landed. Full target schema in
`docs/ERD_DATA_MODEL.md`.

**Polymorphic references are the real problem.** Four models use Mongoose's `refPath` pattern — an `item`
id plus an `itemType` of `'Product' | 'Collection'` — in carts, wishlists, order lines and coupon scopes.
SQL has no equivalent, and Sequelize's own polymorphic associations produce an untyped column with no
foreign key, which is precisely the integrity this migration exists to gain.

*Recommendation:* a `catalog_sellable_item` supertype table that both `catalog_products` and
`catalog_collections` reference. Order lines, cart items, stock movements and ledger references then all
point at one real foreign key. More work than two nullable columns with a `CHECK`, and the right shape —
every ERP module still to be built needs to reference "a thing that can be sold" uniformly.

**IDs.** UUID primary keys throughout.

> **Revised: there is no data to migrate.** MongoDB is empty — no customers, no orders, no catalog. That
> removes the entire migration apparatus this section was built around: no `legacy_mongo_id` columns, no
> reference remapping, no reconciliation pass, no dual-write question, no maintenance window, and no
> rehearsals against a production snapshot. R3 becomes a greenfield schema plus a rewrite of the
> data-access layer — materially smaller, and far less dangerous.

**Money.** Integer minor units from the outset. Closes F-11, and with no existing rows there is nothing to convert.

**There are no TTL indexes in PostgreSQL.** `activityLog` relies on a Mongo TTL index for 90-day expiry,
`GuestSession` on another. Postgres has no equivalent: use `pg_cron` (available on Supabase) or monthly
partitions that get dropped. Easy to miss; discovered when the table is 40 GB.

### Phase 4 — Harden and document `2–3 weeks`

Close F-05 (server-side tax and shipping), F-06 (transactional, idempotent orders), F-02 (stock movement
on order confirmation), F-08 (analytics counting), F-12 (indexes, unique SKU), F-13 (housekeeping). Finish
the test pyramid per `docs/TESTING_STRATEGY.md`. Switch API documentation to generated.

---

## 5. Tests `[TARGET]`

**Start by deleting `core.test.js` and `features.test.js`**, and correct `backend/TESTING.md` — it should
not advertise 73 comprehensive tests when real coverage is near 2% (F-04).

PostgreSQL makes this materially easier than Mongo did. The pattern that works: a real Postgres in
Docker, every test wrapped in a transaction rolled back at teardown. No ORM mocking, no fixture cleanup,
fast enough for every push. See `docs/TESTING_STRATEGY.md` for the full strategy.

---

## 6. API documentation `[TARGET]`

Both artefacts already exist and both are already drifting: **140 routes in code, 122 paths in
`swagger.json`, 132 requests in the Postman collection.** Nothing reconciles them, because both are
hand-written files kept current by remembering to.

That gap is survivable today. After a replatform that rewrites every endpoint and splits the API into two
namespaces, hand-maintained specs become fiction within a month.

Make the spec a build output: define request and response schemas once next to each route (Zod pairs
cleanly with Sequelize), generate `openapi.json` from them, keep serving Swagger UI at `/api-docs` exactly
as `swagger.js` does now, generate the Postman collection *from* the OpenAPI spec so it cannot disagree,
and generate `packages/api-client` from the same source so both frontends match the server by
construction.

**Then fail CI if the generated spec differs from the committed one.** That single check is what keeps
documentation honest; nothing else does.

---

## 7. Persisted documents `[TARGET]`

Closes F-07. Schema and numbering rules in `context/lifecycles/document_lifecycle.md`.

`fin_documents` and `fin_document_lines`, with type (quotation, invoice, receipt, credit note), status,
client reference, and links to the order or project they belong to. Version history so an amended quote
does not overwrite what the client already received. Rendered PDFs stored in Supabase Storage rather than
regenerated on demand — the document handed to an auditor must be byte-identical to the one sent.

**The detail that bites:** do not number invoices with a Postgres sequence. Sequences skip numbers on
rollback, and gapless numbering is a common statutory requirement. Use a counter row per document type
per year, incremented with `SELECT … FOR UPDATE` inside the same transaction that inserts the document.
Slower, correct, and very annoying to retrofit after a few hundred invoices have been issued.

---

## 8. Four traps

**Supabase's connection pooler and migrations.** Supabase exposes a transaction-mode pooler and a direct
connection on different ports. Transaction mode does not support session-level features; while
Sequelize's ordinary queries are generally fine on it, **migrations must run against the direct
connection** — advisory locks and DDL need session state. Set pool sizes deliberately: defaults in a
multi-instance deploy will exhaust the pooler.

**Puppeteer constrains hosting.** `lib/invoiceGenerator.js` launches headless Chromium and `postinstall`
downloads it. Render supports this via Docker, which is one reason Render is the right choice for the
API — but the Dockerfile must install Chromium's system libraries, and the service needs enough memory
(512 MB is not enough; budget 1 GB+). This is why PDF rendering does not move to a serverless function.

**~~Do not dual-write.~~ Moot — the database is empty.** This trap mattered while R3 meant moving live
data. With nothing to move there is no parallel-write period, no cutover window and no rollback drill:
create the schema, rewrite the data layer against it, drop MongoDB. Keep the old path only until the new
one passes its tests.

**Do not build ERP features during the migration.** The strongest pull in a project like this is to add
the expenses module while already rewriting models. Migrating a known-good system is a problem where you
can always tell whether you have broken something, because the old behaviour is the specification. The
moment new features land in the same commits, that property is gone — and so is the ability to debug the
migration.

---

## 9. Where to start

1. **Confirm the Sequelize reading** (§1). One sentence settles the plan.
2. **Ship the payment webhooks this week, on Mongo.**
3. **Do the monorepo split next**, before anything touches the database.
4. **Design the Postgres schema on paper before writing a migration.** The supertype table, UUIDs with
   legacy id columns, integer money, and the TTL replacement are all cheap now and very expensive later.
