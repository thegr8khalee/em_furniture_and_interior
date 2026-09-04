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
| An order total equals subtotal − discount + shipping + tax | `orders_total_is_the_sum_of_its_parts` |
| A discount does not exceed the subtotal | `orders_discount_within_subtotal` |
| A line total equals price × quantity | `order_items_line_total_is_price_times_quantity` |
| One order per checkout intent | unique `orders.idempotency_key` |
| A cart belongs to a customer **or** a guest | `carts_exactly_one_owner` |
| A percentage coupon is at most 100% | `coupons_percentage_within_range` |
| Coupon usage stays within its limit | `coupons_within_usage_limit` |
| A successful payment was verified | `payment_success_is_verified` |
| One transaction per gateway reference | unique `payment_transactions.gateway_reference` |
| A refund does not exceed the payment | `payment_refund_within_amount` |
| A journal line is a debit **or** a credit | `line_is_debit_xor_credit` |
| An account's normal balance matches its type | `accounts_normal_balance_matches_type` |
| Accounting periods do not overlap | `periods_do_not_overlap` |
| A closed period records when it closed | `period_close_is_dated` |

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

### No legacy id columns

The Mongo database holds no production data, so this is a greenfield schema.
There are no `legacy_mongo_id` columns, no import step, no dual-write period and
no reconciliation script — the cutover is a deploy, not a data migration.

That also means an empty database has no account to sign in with. Seeding the
first operator is a bootstrap step, not an import.

### Stock is a ledger, not a counter

The audit found that placing an order never decremented stock: the only writer
was an admin's manual adjustment endpoint, so inventory became fiction the
moment anyone bought anything.

Decrementing a counter would have replaced that with a worse problem — a number
nobody can explain. *"Why does this say 4?"* has no answer when the number is
the only record. So `stock_movements` is an append-only log, and the balance is
derived from it. Every unit is accounted for by a row saying when it moved, why,
and against which order.

- **Append-only, enforced by triggers.** `UPDATE` and `DELETE` are refused. A
  mistake is corrected by posting the reversing movement, which leaves both the
  error and the correction visible.
- **A movement has to make sense.** A receipt cannot remove stock, a sale cannot
  add it, a sale must name its order, and an adjustment must carry a note — a
  correction with no explanation is how a discrepancy becomes permanent.
- **`product_stock` caches the running total**, maintained by trigger so a
  listing does not sum thousands of rows. Because only the trigger writes it and
  the log cannot be edited, the two cannot drift — and
  `product_stock_discrepancies` returns a row if they ever do, which is asserted
  in the tests rather than assumed.
- **Negative stock is recorded, not refused.** Rejecting an oversell would mean
  the log stops matching the warehouse, which is worse than a number nobody can
  miss.

`stock_reservations` are the soft holds. Stock physically leaves on payment, but
it must stop being *sellable* the moment it is in a confirmed order, or two
customers buy the last sofa. `product_availability` is what the storefront
should publish: `available = on_hand − reserved`, and low-stock is measured
against `available` — five on hand with four reserved is one sellable unit, not
five.

### Order lines are a snapshot

`order_items` carries the name, unit price and unit cost as they were at the
time of sale, and `sellable_item_id` is nulled rather than cascaded when a
product is retired. Reprinting a two-year-old invoice gives back the original
figures, which is what makes it audit-safe.

Addresses are `jsonb` on the order for the same reason: an order must keep
showing where it was actually sent after the customer edits their address.

### The ledger

Everything the audit called "finance" was a `SUM` over the orders collection.
That is a sales report: it cannot express a cost, an expense, a liability or a
bank balance, and nothing reconciles because there is nothing to reconcile
against. This is the spine the remaining modules hang off — once it exists,
expenses, purchase orders and payroll are each a form plus a posting rule.

**It balances, and the database is what says so.** Debits must equal credits per
entry. That cannot be a `CHECK` — a check sees one row and this spans them — so
it is a `CONSTRAINT TRIGGER` that is `DEFERRABLE INITIALLY DEFERRED`. Lines are
inserted one at a time, so the entry only balances once the last one lands, and
the trigger therefore fires at **COMMIT**.

That timing matters for tests: a test that never commits never reaches the
constraint and passes vacuously. `ledger.test.js` bypasses the service and
commits deliberately, to prove the database enforces this and not just the
application.

**Posted history is immutable.** `UPDATE` and `DELETE` on `journal_entries` and
`journal_lines` are refused. A correction is a reversing entry with the debits
and credits mirrored and `reverses_id` set, so both the original and the
correction stay on the record — the difference between a ledger and a
spreadsheet. Reversals are dated today, not on the original's date, which may
sit in a period that is now closed.

**Only leaves take postings.** `accounts.is_postable` is half of a composite
foreign key from `journal_lines`, the same trick as the sellable-item subtypes,
so "you cannot post to a summary account" is a referential fact rather than a
convention.

**A closed period stays closed.** A posting dated inside one is refused, as is a
posting with no period at all — better to refuse than let it land nowhere and
quietly miss every report. Periods cannot overlap, enforced by a GiST exclusion
constraint on the date range.

### Gapless numbering

`next_number()` takes a row lock on a counters table rather than using a
sequence. Sequences do not roll back: a failed transaction burns its number and
leaves a hole. *"Why is there no invoice INV-2026-0041?"* is not a conversation
worth having with an auditor, so the number returns to the pool when the
transaction that claimed it rolls back — which is asserted in the tests.

The cost is serialisation: two concurrent postings queue behind the same row.
For a furniture business's volume that is the right trade; if a table ever needs
throughput more than it needs gaplessness, it should use a sequence and say so.

### Posting rules live in `src/services/ledger.js`

`postEntry` takes an optional transaction so a posting can join a larger unit of
work — confirming a payment should record the payment and its posting together,
or neither. It validates in JavaScript before the database does, purely so the
error names the entry being built instead of surfacing as a deferred trigger
failure with no application context.

Amounts are checked as whole minor units first, because the database rounds a
fractional input silently. A discount computed as 33.333% has to be resolved in
code.

### Posting rules

`src/services/posting.js` is where a business event becomes a journal entry.
Every rule takes an optional transaction, so a posting commits with the thing it
describes or not at all.

| Event | Posting |
| --- | --- |
| Order confirmed | DR receivable (total), DR discounts given, CR sales / delivery / VAT |
| Payment received | DR bank or cash, CR receivable |
| Purchase receipt | DR inventory, CR accounts payable |
| Stock sold | DR cost of goods sold, CR inventory |
| Damage or write-off | DR write-offs, CR inventory |
| Stock transfer | nothing — where stock sits is not a change in value |

**Revenue is recognised at confirmation, not at payment.** The customer owes us
from the moment the order is confirmed, so the debit is receivable and the
payment posting clears it. Recognising on payment instead would leave a
confirmed unpaid order invisible in every report — exactly the gap a
receivables ledger exists to close.

**A discount is contra-revenue, not a smaller sale.** Netting it off would hide
what was given away; debiting 4900 keeps the gross sale and the discount both
visible.

**Cash on delivery lands in the cash box**, not the Paystack settlement account.
The settlement account is chosen by payment method.

**Nothing is posted twice.** A unique index on `(source, source_id)` means a
retried webhook or a re-run job cannot double-count. The service checks first
for a clean result, but check-then-insert is not atomic — two webhook deliveries
arriving together would both find nothing — so the index is what actually holds,
and there is a test that bypasses the service to prove it. A duplicate is
reported as `{ posted: false, reason: 'already_posted' }` rather than raised:
a retry succeeding the second time is normal, not a fault.

**An unknown cost skips the posting.** A stock movement needs a unit cost; it
uses the one recorded on the movement, falls back to the product's cost price,
and if neither exists returns `{ posted: false, reason: 'unknown_cost' }` with a
warning. A cost-of-goods-sold figure invented from nothing is worse than an
absent one, because it looks like a real margin.

### The data-access rewrite

Controllers move off Mongoose module by module, catalog first and payments last.
`src/services/catalog.js` is the first slice: the public product and collection
reads now query PostgreSQL.

**The response shapes are deliberately unchanged.** Both frontends read
`product._id`, `images[].url` and prices in naira, so the service maps the new
storage back onto the old contract. Changing storage and contract in one commit
would be impossible to bisect when something breaks. The tests assert the
contract, not the SQL: `_id` not `id`, naira not kobo, `images` as objects.

Two differences that could not be preserved, and are not bugs:

- Ids are UUIDs rather than ObjectIds. Nothing in either frontend parses an id;
  it passes back whatever the API gave it.
- `collectionId` was a single reference in Mongo and is a many-to-many here, so
  a product reports the first collection it belongs to.

One deliberate behaviour change: `stockQuantity` now publishes **available**
stock rather than what is physically on the floor. Units reserved against a
confirmed order are not sellable, and publishing them as if they were is how a
shop promises what it has already sold.

## What is not built yet

**The system is mid-migration and not deployable in this state.** Catalog reads
come from PostgreSQL; everything else still reads Mongo, which is empty. That is
expected during the rewrite, and it is why nothing has been cut over.

In order —

1. **Catalog writes.** The admin CRUD in `admin.controller.js` still writes
   products and collections to Mongo — 986 lines of it, mostly Cloudinary image
   handling. Until it moves, the console cannot populate the catalog the
   storefront now reads. This is the immediate next step, and it finishes
   "catalog".
2. **Cart, wishlist, orders, payments, reviews** — the remaining controllers,
   payments last. Wiring the posting rules to their callers happens here.
3. **Supabase Auth**, plus a bootstrap step, since an empty database has no
   account to sign in with.
4. **Expenses, vendors and purchase orders**, each a form plus a posting rule.
5. **Reports** — P&L, balance sheet, VAT return — queries over the ledger.
