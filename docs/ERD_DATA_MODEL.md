# Entity-Relationship & Data Model

> MongoDB → PostgreSQL mapping, target schema, and the migration decisions behind it.
> Companion to `context/06-replatform-plan.md`.

---

## 1. Domain schemas

Seven PostgreSQL schemas. The boundary is enforced at runtime by the module rule in
`context/03-backend-architecture.md` §2 — cross-schema access goes through a service, never a model.

| Schema | Contents |
|---|---|
| `core_` | Staff, profiles, addresses, notifications, audit and activity logs, counters |
| `catalog_` | Products, collections, sellable items, images, SEO, categories |
| `cms_` | Blog posts, FAQs, portfolio projects, banners, media library |
| `sales_` | Carts, wishlists, orders, order lines, coupons, loyalty, reviews, returns |
| `crm_` | Consultations, designers, interior projects, phases, variation orders |
| `inv_` | Locations, stock movements, reservations, stock takes, valuation |
| `fin_` | Documents, lines, counters, accounts, journal, payments, expenses, suppliers, bills |

---

## 2. The four migration decisions

### 2.1 Polymorphic references — the hard one

Four Mongoose models use `refPath`: an `item` ObjectId plus an `itemType` of `'Product' | 'Collection'`,
in `user.cart`, `guest.cart`, `order.items` and `coupon` scope. SQL has no equivalent, and Sequelize's own
polymorphic associations produce an untyped column with no foreign key — precisely the integrity this
migration exists to gain.

**Options considered**

| Option | Integrity | Cost | Verdict |
|---|---|---|---|
| Untyped id + type column | None — no FK possible | Lowest | Rejected. Reproduces the Mongo problem in a database that could have prevented it. |
| Two nullable FKs + `CHECK` (exactly one non-null) | Full | Low | Workable, but every consumer writes a `COALESCE` and every new referencing table adds two more columns. |
| **Supertype table** | Full | Moderate | **Chosen.** |

```sql
CREATE TABLE catalog_sellable_items (
  id          uuid PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('product','collection')),
  sku         text UNIQUE,                    -- closes F-12
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE catalog_products (
  id            uuid PRIMARY KEY REFERENCES catalog_sellable_items(id) ON DELETE CASCADE,
  name          text NOT NULL,
  price_minor   bigint NOT NULL CHECK (price_minor >= 0),   -- F-11
  cost_minor    bigint CHECK (cost_minor >= 0),             -- F-03
  category_id   uuid NOT NULL REFERENCES catalog_categories(id),
  …
);
-- catalog_collections follows the same pattern
```

Order lines, cart items, wishlist items, stock movements and ledger references all point at
`catalog_sellable_items.id` — one real foreign key. Every ERP module still to be built needs to reference
"a thing that can be sold" uniformly, which is why the extra table pays for itself immediately.

### 2.2 Identifiers

UUID primary keys, plus `legacy_mongo_id char(24) UNIQUE` on every migrated table. Migration scripts
resolve references through it; reconciliation against MongoDB stays possible for as long as needed; the
column is dropped once confidence is established. No id remapping table, no rewrite of foreign keys after
the fact.

### 2.3 Money

Integer minor units (`bigint`, kobo) with a `CHECK (… >= 0)` wherever negative is meaningless. Never
`float`, never `numeric` for storage — closes F-11. A `Money` helper in `packages/domain` owns all
formatting and arithmetic so the rule cannot be quietly broken in a controller.

### 2.4 Retention — there are no TTL indexes in PostgreSQL

`activityLog` (90-day TTL) and `guest` sessions rely on Mongo TTL indexes with no Postgres equivalent.

`core_activity_logs` becomes **monthly-partitioned**, and retention is a partition drop — far cheaper than
a mass `DELETE`, which would bloat the table and hold locks. A `pg_cron` job drops partitions older than
90 days. Guest sessions disappear entirely, replaced by Supabase anonymous users.

---

## 3. Collection → table mapping

| MongoDB `[NOW]` | PostgreSQL `[TARGET]` | Difficulty | Notes |
|---|---|---|---|
| `user` | `auth.users` + `core_profiles` + `sales_cart_items` + `sales_wishlist_items` | Easy | Embedded arrays lift out; bcrypt hashes import into Supabase |
| `admin` | `auth.users` + `core_staff` | Easy | Merges two login systems; closes F-10 |
| `guest` | anonymous `auth.users` + the same cart/wishlist tables | Care | Guest and user carts unify — a simplification |
| `product` | `catalog_sellable_items` + `catalog_products` + `catalog_product_images` + `catalog_product_seo` | Care | Add `cost_minor`; unique SKU; real indexes |
| `collection` | `catalog_sellable_items` + `catalog_collections` + join to products | Care | |
| `order` | `sales_orders` + `sales_order_lines` + `sales_order_status_history` + `core_addresses` | Care | Keep the price snapshot on lines — ERP needs what was charged, not today's price |
| `coupon` | `sales_coupons` + `sales_coupon_scope` | **Hard** | Polymorphic scope rows |
| `review` | `sales_reviews` | Easy | |
| `loyaltyTransaction` | `sales_loyalty_transactions` | Easy | Append-only |
| `consultationRequest` | `crm_consultations` | Easy | |
| `designer` | `crm_designers` | Easy | |
| `project` (portfolio) | `cms_portfolio_projects` | Easy | Distinct from `crm_interior_projects` — the current name is overloaded |
| `blogPost`, `faq`, `promoBanner`, `flashSale` | `cms_*` | Easy | |
| `notification` | `core_notifications` | Care | Becomes the outbox — see `context/10` |
| `auditLog` | `core_audit_logs` | Easy | Append-only, ideal for Postgres |
| `activityLog` | `core_activity_logs`, partitioned | **Hard** | No TTL — see §2.4 |
| `inventoryAdjustment` | `inv_stock_movements` | Care | Becomes one movement type among many |
| `paymentTransaction` | `fin_payments` | Care | Gains webhook event records |
| — | `fin_documents`, `fin_document_lines`, `fin_document_counters` | New | Closes F-07 |
| — | `fin_accounts`, `fin_journal_entries`, `fin_journal_lines` | New | The ledger |
| — | `fin_expenses`, `fin_suppliers`, `fin_bills` | New | Closes the expenses gap |
| — | `inv_locations`, `inv_reservations`, `inv_stock_takes` | New | |
| — | `crm_interior_projects`, `crm_project_phases`, `crm_variation_orders` | New | |
| — | `purchasing_orders`, `purchasing_receipts` | New | |

---

## 4. The ledger

The one part of the schema where constraints, not application code, must guarantee correctness.

```sql
CREATE TABLE fin_journal_entries (
  id           uuid PRIMARY KEY,
  entry_date   date NOT NULL,
  period_id    uuid NOT NULL REFERENCES fin_periods(id),
  source_type  text NOT NULL,      -- order · payment · expense · movement · adjustment
  source_id    uuid NOT NULL,      -- what caused this entry
  memo         text,
  posted_by    uuid NOT NULL REFERENCES core_staff(id),
  posted_at    timestamptz NOT NULL DEFAULT now(),
  reversed_by  uuid REFERENCES fin_journal_entries(id)
);

CREATE TABLE fin_journal_lines (
  id            uuid PRIMARY KEY,
  entry_id      uuid NOT NULL REFERENCES fin_journal_entries(id) ON DELETE RESTRICT,
  account_id    uuid NOT NULL REFERENCES fin_accounts(id),
  debit_minor   bigint NOT NULL DEFAULT 0 CHECK (debit_minor  >= 0),
  credit_minor  bigint NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  project_id    uuid REFERENCES crm_interior_projects(id),   -- cost attribution
  CONSTRAINT one_side_only CHECK ((debit_minor = 0) <> (credit_minor = 0))
);
```

**Balance enforcement.** A `DEFERRABLE INITIALLY DEFERRED` constraint trigger checks at commit that
`Σ debit = Σ credit` for the entry. Deferred is essential — lines are inserted one at a time and the entry
is only balanced once all of them exist.

**Immutability.** No `UPDATE` or `DELETE` on `fin_journal_entries` or `fin_journal_lines`; revoked at the
role level, not merely avoided in application code. Corrections post a reversing entry that references the
original through `reversed_by`.

**Period locking.** A trigger rejects any insert whose `entry_date` falls inside a period marked closed.
This is what makes last month's P&L stable.

None of this is expressible in Sequelize models — it lives in migration SQL, which is exactly the
trade-off described in `context/06-replatform-plan.md` §1.

---

## 5. Indexing

Beyond primary and foreign keys, at minimum:

- `catalog_products (category_id, style)` — every shop page filters on it, and has no index today (F-12)
- `catalog_sellable_items (sku)` unique — closes the duplicate-SKU hole
- `sales_orders (customer_id, created_at DESC)`, `(status)`, `(payment_status, created_at)`
- `fin_journal_lines (account_id, entry_id)` — the trial balance query
- `fin_documents (type, number)` unique, `(customer_id, status)`, `(status, due_date)` for aged receivables
- `inv_stock_movements (sellable_item_id, location_id, created_at)` — the derived-stock query
- `core_activity_logs` — per-partition index on `(user_id, created_at)`

---

## 6. Migration execution

1. Schema migrations run against `DIRECT_DATABASE_URL`, never the pooler (`context/06` §8).
2. Data migration runs per collection in dependency order, resolving references via `legacy_mongo_id`.
3. Reconciliation asserts row counts and, critically, that financial totals agree between the two
   databases. A migration that moves 100% of rows and 99.98% of the revenue is a failed migration.
4. Full-suite re-run against a clean database must produce an identical result — CI enforces this.
5. Two production-snapshot rehearsals, and a rollback executed at least once, before the real cutover.

**No dual-write.** See `context/06-replatform-plan.md` §8.
