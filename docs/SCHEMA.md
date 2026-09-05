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

**Writes** live in `src/services/catalogAdmin.js`. The validation rules carried
over from `admin.controller.js` unchanged, including the ones the database now
also enforces — the constraint is the guarantee, the check is the error message.
A 400 saying "discounted price must be less than the original price" is usable;
a raw constraint violation is not. One rule the database does *not* have: a
discounted price must be strictly **below** list price. The schema permits
equal, so that stays an application rule rather than being quietly relaxed by
the migration.

Cloudinary moved behind `src/services/imageStore.js`, which is injectable. The
old controller had upload and destroy calls inlined in four places with small
differences each time, which made the write path untestable without live
credentials. With a fake store the business logic is covered and only the two
HTTP calls it replaces are not.

Image uploads happen **before** the transaction opens and deletions happen
**after** it commits. Holding a database transaction across a network round trip
keeps row locks for its duration, and deleting a file before the record commits
loses it if the transaction then rolls back.

Migration 0009 makes "a product belongs to at most one collection" a unique
index. Mongo held that fact twice — a `collectionId` on the product and a
`productIds` array on the collection, kept in sync by hand — which is why the
old controller carried code to remove a product from its previous collection.
`collection_products` holds it once. Dropping that index is the whole change if
the business ever wants multi-collection membership.

### Carts and wishlists — one path, not two

`src/services/cart.js` is the second slice. Mongo stored these twice: an
embedded array on the user document and a near-identical array on a separate
guest-session collection, with two sets of handlers kept in sync by hand. They
had drifted:

- The guest wishlist answered **400** where the user wishlist answered **200**
  for the same request. The storefront rolls its optimistic update back on any
  non-2xx, so a guest tapping the heart on something they had already saved
  watched it disappear.
- The guest cart keyed lines by `productId`, the user cart by `item` +
  `itemType`. A guest could not put a collection in their cart at all.

There is now one `carts` table with an owner arc — exactly one of `customer_id`
or `guest_session_id`, per `carts_exactly_one_owner` — and the same SQL runs for
both, so the two cannot drift again. `resolveOwner` (`src/lib/owner.js`) turns
whichever principal the request carries into that single shape.

The response shape is unchanged: cart entries are
`{ _id, item, itemType, quantity }` and wishlist entries are
`{ _id, item, itemType }`. `_id` is now the item's own id, because a line here
*is* (cart, item) and there is no subdocument id to report. That incidentally
fixes the cart page's delete button, which passed the subdocument id where an
item id was expected and answered 404 under Mongo.

Two loops the controllers ran on every read are gone, replaced by the schema:

- Sweeping up lines whose product had been deleted — `ON DELETE CASCADE`.
- Stopping the same item appearing twice in one cart — the `cart_items` primary
  key, not a `findIndex` over an array.

**Two routing fixes came with it.** The cart and wishlist routes were mounted as
`identifyGuest, protectRoute`, and `protectRoute` answers 401 without a `jwt`
cookie — that is every guest, so the guest cart these routes exist to serve was
unreachable and the storefront silently fell back to browser storage. They now
run `identifyGuest` alone and the handlers refuse a request that resolves to no
principal. And `identifyGuest` no longer writes a session row on the way past:
it used to create one for every request without a cookie, so every crawler left
a row behind. The row is created by the first write that needs one.

`/api/guestAuth/*` is deleted. It duplicated the cart and wishlist routes under
an incompatible shape, no frontend called it, and it was mounted at a path that
did not match its own documentation.

`mergeGuestIntoCustomer` folds a guest's cart and wishlist into the account they
just created: quantities add, wishlist entries de-duplicate, and the session row
goes — taking its cart with it, because `carts.guest_session_id` cascades. All
in one transaction, since a half-finished merge either duplicates a shopper's
cart or loses it.

### Accounts — customers and staff

`src/services/identity.js` is the third slice: registration, sign-in, profile
edits, password changes and password resets, for both kinds of principal.

**Two tables, not one.** A shopper has a cart, a phone number and loyalty
points; an operator has a role, a permission set and an audit trail; the overlap
is an email and a password. They were two Mongo collections already, but every
handler reached for whichever it needed and the two flows were copies of each
other.

Things the database now decides that application code used to:

- **Duplicate emails.** `INSERT ... ON CONFLICT (email) DO NOTHING` returning no
  row is the duplicate check. The previous `findOne`-then-`create` let two
  simultaneous registrations both pass the check, and the loser got a 500 from
  the index it had just violated.
- **Case.** `email` is `citext`, so `Ada@example.com` and `ada@example.com` are
  one account. Under Mongo's case-sensitive unique index they were two.
- **A reset link is spent once.** Matching the token and clearing it are one
  `UPDATE`. Read-then-write let the same link be redeemed twice if both requests
  read before either wrote.
- **Loyalty points cannot go negative** — a check constraint, not a caller who
  remembered to look.

Two behaviours that are new because the schema has the columns for them:

- **`staff.is_active`** is enforced at sign-in *and* on every console request.
  Mongo's admin document had no such field, so the only way to revoke console
  access was to delete the account — which also orphaned every audit-log entry
  pointing at it.
- **Permissions are resolved from the row on every request**, never carried in
  the token, so revoking one takes effect on the next request rather than at the
  token's fifteen-day expiry.

The published shapes are unchanged except for two fields that had stopped being
true: `cart` and `wishlist` no longer appear on a sign-in response. They were the
embedded Mongo arrays, which stopped being the cart when carts moved; neither
frontend read them. A customer's display name is `full_name` in the database and
is still published as `username`, because that is what both frontends read and
send back.

**`POST /api/admin/signup` no longer signs the caller in as the account it just
created.** Creating a support user used to end the owner's session and replace it
with that support user's, silently narrowing their permissions. It also asked
only for `admin.dashboard.view`, which `support` holds — so a support account
could mint a colleague with more access than itself. It now requires
`staff.manage`, a new permission no role list grants, which means only
`super_admin` has it. The first console account comes from
`npm run bootstrap:staff`, which reads its password from the environment rather
than a command line, and is idempotent.

The audit logger records the request body as `changes`, so putting operator
creation behind it would have written the new password into a log the console
displays. Credential fields are redacted there now — for every route, not just
this one.

**One rule pair still disagrees.** `orders.customer_id` is `ON DELETE SET NULL`,
while `orders_has_a_buyer` requires one of customer or guest session to be
present — so nulling the only one fails, and a shopper who has ordered cannot
close their account. It is not reachable yet, because nothing writes `orders`
until order creation moves off Mongo, and it is that slice's call which rule
gives way: erasure and keeping a financial record are both defensible, and the
order already snapshots the buyer's name and email in `shipping_address`.
Silently doing neither is not defensible, so a schema test pins the current
behaviour and will fail when the decision is made.

**This is the existing password scheme moved to PostgreSQL, not Supabase Auth.**
`customers.password_hash` and `staff.password_hash` are nullable precisely so a
Supabase-managed identity needs no local password; that migration is still ahead,
and is now unblocked rather than done.

Collections still in Mongo reference an account by its UUID, so those fields are
`String` and no longer `ObjectId`. `.populate('user', ...)` cannot cross
databases: the audit and activity log listings resolve their accounts with one
batched query per page (`findStaffByIds`, `findCustomersByIds`), and the order
listing simply dropped it — the console renders the buyer from `shippingAddress`,
which is captured on the order itself.

### Orders, payments and coupons

`src/services/orders.js`, `src/services/payments.js` and `src/services/coupons.js`
are the fourth slice, and the one that makes the ledger do anything.

**The money on an order is computed, not accepted.** The Mongo handler took
`subtotal`, `taxAmount` and `totalAmount` from the request body — the schema
comment on `orders_total_is_the_sum_of_its_parts` is about exactly that. Now line
prices come from `sellable_items` (at the promotional price where there is one),
the discount from the coupon row, and the tax from `TAX_RATE_PERCENTAGE`; the
only figure still taken from the caller is shipping, because there is no
shipping-rate table to derive it from. The database refuses the insert if the
parts do not add up.

**A double-submitted checkout produces one order.** `orders.idempotency_key` is
unique; the same `Idempotency-Key` header returns the first order and does not
send a second confirmation email.

**A coupon is claimed in one statement.** `UPDATE coupons SET times_used =
times_used + 1 WHERE ... AND (usage_limit IS NULL OR times_used < usage_limit)`
— the check and the increment cannot be separated, so a single-use code cannot
be spent by two simultaneous checkouts. It happens inside the order's
transaction, so an order that fails after the claim gives the use back.
`services/coupons.js` holds both the claim and the arithmetic, and the
storefront's "check this code" endpoint quotes from the same function that
checkout charges from.

Coupon targeting — the five `applicable*` and `excluded*` arrays on the Mongo
model — is not carried over. The console sends empty arrays on every create,
nothing read them, and the schema has no columns for them. It comes back as a
join table if anyone asks for it.

**The ledger is wired.** Confirming an order posts the sale
(`postOrderConfirmed`), a successful charge posts the receipt
(`postPaymentReceived`), and both happen in the same transaction as the thing
they describe — an order that says "confirmed" with no entry behind it is a hole
nobody finds until a reconciliation fails months later. Paying also writes the
negative `sale` rows in `stock_movements`, guarded by what is already in the
ledger rather than by a flag, so a status flipped back and forth does not ship
the goods twice.

**A charge is applied exactly once.** It arrives twice by design — the redirect
and the webhook — and often at the same instant. The transaction is claimed with
`UPDATE ... WHERE id = :id AND status <> 'success' RETURNING id`, and only the
winner touches the order. `already_applied` is a success, not an error: replying
non-2xx to a webhook makes Paystack retry for days over an order that is already
paid. Amounts are kobo end to end, since Paystack works in minor units and so
does the database.

**Status history is a trigger.** `orders_record_status` writes
`order_status_events`, so a bulk update is recorded too; the handler only
attributes the row to the operator and attaches their note. The Mongoose version
pushed onto an array and recorded nothing that did not go through it.

Two bugs fixed in passing: the customer-facing invoice, receipt and quotation
routes looked the order up by id and printed it with **no ownership check at
all**, so anyone who guessed an id could print anyone's order; and
`delivered_at`, which the schema requires on a delivered order, is now set by
the service rather than expected from the caller.

The account number the bank-transfer form collected is no longer stored. The
transfer is identified by its reference, and a bank account number sitting in an
admin list is a liability rather than a record.

### Reviews

`src/services/reviews.js` is one table for both kinds of item, so the eight
handlers — the same four written twice, once for products and once for
collections — are four with the kind as a parameter. "Everything awaiting
moderation" is a query rather than two collection scans merged in JavaScript.

Three things the database decides:

- **One review per customer per item**, by unique index. The embedded array
  allowed duplicates and the handler checked first, which is a race.
- **The rating**, by `reviews_refresh_rating`. It was a `pre('save')` hook, so
  approving through anything but that one path left the average stale. Only
  approved reviews count, so posting one cannot move the number.
- **An approval says when**, by `reviews_approval_is_attributed`.

`is_verified_purchase` is the result of the purchase check that gates the
endpoint, not a field the caller sends — which is the only thing that makes the
badge mean anything. The check reads `order_items`, so one query covers products
and collections, and a pending order does not count: an unpaid order anyone can
create would otherwise be a way to review anything.

Approve and reject take the review's own id. The routes still carry the parent
item, because both frontends build the URL that way, but a review was a
subdocument and is now a row.

### Stock, reports and the accounting calendar

`src/services/inventory.js` and `src/services/reporting.js` finish the reads the
console depends on.

**There is no quantity to set.** `stock_movements` is the ledger and the balance
is derived from it, so "set the count to 12" is recorded as the movement that
takes it to 12. The Mongo version assigned `product.stockQuantity` and wrote a
parallel `InventoryAdjustment` document describing what it had just done, so the
count and its explanation could disagree — and did, after any correction applied
by hand. `stock_adjustment_needs_a_note` refuses an adjustment nobody explained.
The list publishes `stockQuantity` as what is *sellable* — on hand less what is
held for confirmed orders — with `onHand` and `reserved` beside it, so the
difference is visible rather than surprising.

**The reports are joins**, because that is what the aggregation pipelines were.
One rule runs through all of them and is stated once: a sale counts when it is
paid and not cancelled or refunded. It had already drifted — the conversion
funnel counted every order regardless, which is right for a funnel and wrong
everywhere else, and nothing said so. Customer lifetime value now shows a name:
the old pipeline concatenated `firstName` and `lastName`, which the user document
never had, so every row said "undefined undefined".

**A fresh installation could not record its first sale.** `assert_period_open`
refuses a journal entry whose date falls in no accounting period, and nothing
created any — so confirming an order raised "no accounting period covers
2026-09-05" and took the order down with it. It was invisible until the posting
rules were wired to their callers, because until then nothing posted.
`0010_accounting_calendar.sql` opens a month at a time from 2024 to 2035. The
range is deliberately finite: a calendar that ran forever would let a posting
mistyped as 2099 land in a period nobody ever looks at, where running out is a
loud failure with an obvious fix.

The seeder places its orders through the ordering service rather than inserting
them, so a seeded database has priced, numbered orders, a balanced ledger and a
stock history to look at. It skips the sections whose collections are still in
Mongo when no Mongo is configured, so a developer with only a PostgreSQL still
gets a working shop.

## What is not built yet

**The system is mid-migration and not deployable in this state.** The catalog —
reads and writes — carts and wishlists, accounts, orders, payments, coupons,
reviews, stock, the sales reports and the sitemap are on PostgreSQL. What is left
in Mongo has no table yet: blog, FAQs, projects, designers, consultations,
notifications, the loyalty ledger, promo banners, flash sales, and the activity
and audit logs.

In order —

1. **Everything with no table yet** — blog, FAQs, projects, designers,
   consultations, notifications, the loyalty ledger, promo banners, flash sales,
   and the activity and audit logs. Each needs a migration first. The seed
   script goes with them.
2. **Supabase Auth.** Accounts are in `customers` and `staff` now, and both
   tables carry a nullable `supabase_user_id` for it, but sign-in is still the
   local bcrypt password. The bootstrap step exists: `npm run bootstrap:staff`.
3. **Expenses, vendors and purchase orders**, each a form plus a posting rule.
4. **Reports** — P&L, balance sheet, VAT return — queries over the ledger.
