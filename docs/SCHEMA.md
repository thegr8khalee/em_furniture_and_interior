# PostgreSQL schema

Phase 2 of the ERP plan. This document records the modelling decisions and why
they were made — the migrations themselves say *what*, this says *why*.

## Running migrations

```bash
npm run migrate --workspace=@em/api     # applies anything pending
```

Migrations are plain SQL in `apps/api/src/db/migrations`, applied in filename
order, each in its own transaction.

Three properties the runner guarantees:

- **An advisory lock**, so two deploys starting at once do not apply the same
  DDL concurrently. This is why migrations use `DIRECT_DATABASE_URL` and not the
  pooler: transaction-mode pooling gives no session state, so an advisory lock
  taken there silently does nothing.
- **Checksums.** Editing a migration that has already been applied is a hard
  error, not something reconciled silently. The database and the repository
  disagreeing about what was applied is not a state to guess at — fix it with a
  new migration.
- **Per-migration transactions**, so a failure partway through a batch leaves
  the earlier migrations applied and recorded rather than half-done.

## Testing

The schema tests run against a real PostgreSQL 16. There is no in-memory
substitute, deliberately: these tests exist to prove the database *rejects* bad
data, and a fake enforces none of it, so it would report a pass for constraints
nobody verified.

```bash
# a local server on 5432, or point TEST_DATABASE_URL wherever
npm test --workspace=@em/api
```

If no database is reachable the suite **fails**. It must never skip — a suite
that silently skips is indistinguishable from a suite that passes, which is the
failure mode the deleted placebo tests had.

Every schema test asserts that a bad write is refused. Asserting the good case
works would prove almost nothing; Mongo accepted the good case too. What it
*also* accepted is the point.

## Decisions

### Sellable items — replacing `refPath` polymorphism

Mongo stored `{ item: ObjectId, itemType: 'Product' | 'Collection' }` in cart
lines, wishlist entries, order lines, guest sessions and coupon rules. Nothing
enforced that the id existed, or that it existed in the collection the string
named. A typo in `itemType`, or a deleted product, produced a row pointing at
nothing that failed only when something later tried to read it.

`sellable_items` is the supertype: the thing you can put in a cart.
`products` and `collections` are its subtypes, each keyed on
`(id, kind)` against the parent with a `CHECK` pinning its own kind. So a
`products` row cannot attach to an item declared a collection, and everything
referring to "something buyable" points at one real foreign key.

Shared commercial attributes — name, description, style, price, promotional
price, cost, origin, rating — live on the supertype. Subtype tables carry only
what is genuinely specific: category, SKU, stock and lead times for a product;
the cover image for a collection.

### Money is integer minor units

Every amount is `money_minor`, a `bigint` domain holding kobo. Mongo used
floating-point naira, which cannot represent `0.1 + 0.2` exactly. That is
survivable for a product price and fatal for a ledger, where a fraction of a
kobo per row accumulates into a trial balance that does not balance.

**One thing the domain cannot do**, pinned by a test so it is not mistaken for a
guarantee: a fractional *input* is not rejected. The cast to `bigint` happens
before any `CHECK` is evaluated, so Postgres rounds half away from zero and says
nothing — `100.33` becomes `100`, `100.5` becomes `101`.

That is why `apps/api/src/lib/money.js` exists. Everything that produces an
amount — a percentage discount, a tax rate, an instalment split — routes through
it, where rounding is a deliberate act with a stated rule. `allocate()` in
particular distributes the remainder rather than losing it: ₦100 in three parts
is `3334, 3333, 3333`, which reconciles against the invoice, not `3333 × 3`,
which is a kobo short.

Currency travels with every amount rather than being assumed NGN. Imported
furniture means foreign purchase costs, and retrofitting currency onto rows that
already exist is far more work than carrying it from the start.

### Invariants live in the database

Mongo expressed conditional requirements through the ODM (`required: function
() { return this.isPromo }`), which fires only when the write goes through
Mongoose. A migration script, a `updateMany`, or a fix applied by hand bypassed
all of it.

Moved into the schema, so they hold for every writer:

| Invariant | Constraint |
| --- | --- |
| A promotion has a promotional price | `sellable_promo_needs_price` |
| A discount is not above list price | `sellable_discount_below_list` |
| An imported item states its origin | `sellable_foreign_needs_origin` |
| An account can authenticate somehow | `customers_has_credential` |
| A shipping window does not end before it starts | `products_shipping_window_ordered` |
| An approved review records when | `reviews_approval_is_attributed` |
| One review per customer per item | unique `(sellable_item_id, customer_id)` |

### The rating is maintained by the database

`average_rating` was recalculated by a Mongoose `pre('save')` hook, which fires
per document. A moderation endpoint approving reviews in bulk bypassed it and
left the rating stale.

A trigger on `reviews` now recomputes it, counting **only approved reviews** — an
aggregate built from unmoderated reviews would let anyone who can post one move
the number that appears in search results. Tested for single approval, bulk
approval, and withdrawal.

### `updated_at` is a trigger, not an ORM concern

So a write that bypasses Sequelize — a manual fix, a bulk script, psql — still
gets an accurate timestamp.

### Email is `citext`

Mongo's unique index is case-sensitive, so `Ada@example.com` and
`ada@example.com` were two accounts, and whether "email already in use" fired
depended on how the user typed it.

### `legacy_mongo_id`

Nullable, unique when present, on every table that will receive imported rows.
It exists so imported data can be reconciled against Mongo during cutover, and
is dropped once the migration is signed off.

**If the Mongo database turns out to hold no production data**, these columns and
the import step are unnecessary — say so and they come out in one migration.

## What is not built yet

This is the first slice: identity and catalog. Still to come, in order —

1. **Cart, wishlist, orders, payments.** Orders are last because they are the
   highest-risk table and benefit from the patterns settling first.
2. **The stock ledger.** Stock becomes derived from an append-only movement log
   rather than a mutable counter, which is what makes a discrepancy explainable.
   This is also where the audit's "orders never decrement stock" finding gets
   fixed properly rather than patched.
3. **The double-entry ledger**, accounting periods, and period locking.
4. **The data-access rewrite** — controllers move off Mongoose onto a service
   layer, module by module, catalog first and payments last.
5. **Supabase Auth.** `customers.supabase_user_id` and `staff.supabase_user_id`
   are already in place, nullable, so both authentication paths can run side by
   side rather than requiring a big-bang cutover.
