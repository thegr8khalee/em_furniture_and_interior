# 05 — ERP Readiness Assessment

> Full codebase audit against ERP requirements. Findings F-01 … F-13.
> Audited at commit `8db2e2b`. Every finding was confirmed by reading the referenced source.

---

## 1. Verdict

**Broader than expected on surface area, weaker than expected on foundations.**

The admin panel already covers catalog, orders, coupons, marketing, consultations, reviews, inventory,
audit logging and document generation, organised behind a permission system that resolves per request.
That is a real product, and the RBAC design in particular does not need rewriting.

But it is a **store back-office, not an ERP**. An ERP's defining property is that every business event
lands in one place that always balances. Nothing in the system does that today. Three structural
absences block the entire category:

1. **No cost price anywhere.** `product.model.js` has `price` and `discountedPrice` and nothing else.
   Margin, COGS and inventory valuation are not "unbuilt" — they are *uncomputable* from stored data.
2. **No ledger.** `finance.controller.js` is 170 lines that sum orders and emit CSV. No accounts, no
   journal, no expenses, no payables or receivables.
3. **Stock never moves.** Selling something does not decrement it.

And one operational finding that is not about ERP at all and outranks everything above in urgency:
**payments are confirmed only by the customer's browser**, so paid orders can stay marked unpaid forever.

---

## 2. Findings

Ranked by cost in money and data integrity, not by difficulty.

### F-01 · ~~Critical~~ · RESOLVED · Paid orders can stay marked unpaid forever

> **Closed** by the R0 webhook work. Signature-verified webhooks for all three gateways now confirm
> payment independently of the browser. Covered by `__tests__/integration/webhooks.test.js`.

There are no payment webhooks. `payments.routes.js` mounts only `initialize` and `verify` endpoints, and
all three gateways are confirmed solely when the customer's browser returns to the verify callback
(`payments.controller.js:175`, `:344`, `:522`). If the customer pays and then closes the tab, loses
signal, or the redirect fails, the money reaches the gateway and the database never learns: the order sits
at `paymentStatus: 'pending'` permanently and is excluded from every revenue and analytics query, all of
which filter on `paymentStatus: 'paid'`.

**Impact:** silent, unbounded revenue under-reporting. Live today.
**Fix:** signature-verified webhook endpoints per gateway; treat the browser callback as a UX
convenience only, never as the source of truth.

### F-02 · Critical · Selling a product never reduces its stock

`createOrder` (`order.controller.js:13–140`) reads product prices but never touches `stockQuantity`. The
only thing that changes stock is an admin typing a number into the Inventory screen
(`inventory.controller.js:62–81`). Inventory is therefore a manual spreadsheet with an audit trail,
permanently drifting from reality. There is also no availability check — twenty units of a
single-unit item can be sold.

**Fix:** stock movements as append-only events; reserve on order confirmation, decrement on dispatch.

### F-03 · Critical · No cost price — margin is unknowable

`product.model.js:26` defines `price`; there is no cost, landed cost, or supplier price on any model.
Every "finance" number the system produces is revenue, never profit.

**Fix:** add cost fields during the Postgres migration and backfill. Cheap now, expensive later — the
data needs history before the reports exist.

### F-04 · ~~Critical~~ · MOSTLY RESOLVED · The test suite tests nothing

`backend/TESTING.md` advertises 73 passing tests as "comprehensive". In reality `core.test.js` and
`features.test.js` import no application code — they construct a plain object and assert on that same
object:

```js
// __tests__/integration/core.test.js:26
expect(mockUser.username).toBe('John Doe');
```

Only `payments.test.js` imports a real module. `supertest` is a declared dependency and is used zero
times; not one of the 140 routes is exercised. Effective backend coverage is roughly **2%**. The frontend
has one test file for 26,378 lines. There is no `.github/` directory, so nothing runs on push regardless.

> **Largely closed.** The placeholder suites are deleted and `TESTING.md` corrected. A real harness
> exists — `supertest` against the actual Express app, `mongodb-memory-server` for the database — with
> 40 backend tests covering the payment webhooks end to end. CI now runs on every push
> (`.github/workflows/ci.yml`). **Still open:** the remaining ~130 routes are uncovered, and the backend
> has no lint script or ESLint config.

### F-05 · ~~High~~ · RESOLVED · Tax and shipping are whatever the client says they are

Line prices are correctly re-fetched server-side — that part is right. But `shippingCost` and `taxAmount`
are read straight from the request body (`order.controller.js:21–22`) and folded into `totalAmount`
(`:103`, `:131–132`) with no recalculation or validation. A modified request sets its own tax.

**Impact:** a discount exploit for a shop; for an ERP whose tax reports must survive an audit, it means
the tax figures are not evidence of anything.

> **Closed.** `lib/orderPricing.js` derives subtotal, discount, shipping, tax and total from catalog
> prices and server configuration. `shippingCost` and `taxAmount` are no longer read from the request
> body. The tax quote endpoint shares the same helpers, so the figure shown at checkout is the figure
> charged. Covered by `__tests__/integration/orderPricing.test.js`.

### F-06 · High · PARTLY RESOLVED · Order creation is neither atomic nor idempotent

Coupon usage is incremented and saved at `order.controller.js:97`; the order is saved at `:140`. No
transaction spans them, so a failure in between burns a coupon use against an order that does not exist.
Separately there is no idempotency key, so a double-clicked checkout creates two real orders.

### F-07 · High · Every quotation and invoice generated is thrown away

`document.controller.js` renders a PDF and returns it. There is no document model, no persisted record,
no sequential numbering. You cannot list quotations issued, see which converted, chase an unpaid invoice,
or reissue a copy.

**Impact:** for a business running interior projects on quotes and deposits, this is the largest missing
piece of day-to-day value — and it is where accounts receivable would have to live.

### F-08 · ~~High~~ · RESOLVED · Analytics counts line items as orders

**Correction to the original finding.** It claimed four aggregations were affected. On checking, only
**two** are: `getSalesByCategory` and `getProductPerformance` `$unwind` the items array before counting
with `$sum: 1`, so they count line items rather than orders — a category on a three-line order was
credited with three orders. `getSalesByRegion` and `getCustomerLifetimeValue` group by order without
unwinding, so their counts were always correct. Region reports were **not** wrong.

`getSalesByCategory` additionally `$lookup`ed only against `products`, so `Collection` line items
resolved to null and their revenue accumulated silently under an unnamed category.

> **Closed.** Both pipelines now collect distinct order ids with `$addToSet` and size them. Collection
> lines get an explicit `Collections` bucket rather than a null one — collections carry no `category`
> field of their own, so they cannot be folded into the product categories. Covered by
> `__tests__/integration/analytics.test.js`, whose three bug-specific tests were confirmed to fail
> against the previous implementation.

### F-09 · ~~High~~ · RESOLVED · Payment verification never checks the amount

All three verify handlers checked that gateway status was `success` and immediately set
`paymentStatus: 'paid'`. None compared the amount the gateway reported against `order.totalAmount`, so a
partial or mismatched settlement marked the order fully paid.

> **Closed.** Both the webhook and the browser callback now route through
> `lib/paymentConfirmation.js`, which reconciles amount and currency in integer minor units before
> confirming. A mismatch leaves the order unpaid and flags it for review rather than auto-confirming.

### F-10 · High · IN PROGRESS · Admins and customers share one cookie

`lib/utils.js:6–22` issues both admin and customer sessions as a cookie named `jwt` on the same domain,
distinguished only by a `role` claim. Logging into the storefront clobbers an active admin session and
vice versa. Tokens live 15 days with no refresh, no revocation list, and no way to force-logout a
compromised admin. There is no 2FA on admin accounts.

**Credit where due:** `protectAdminRoute.js` re-reads the admin from the database on every request, so
permission changes take effect immediately. That is the right design, and it is preserved.

> **Server side closed (R2).** `middleware/authenticate.js` resolves the caller from a Supabase bearer
> token verified against the project JWKS — no shared cookie name, no shared signing secret, and no
> collision between a storefront and a console session. Staff and customers share one Supabase user
> pool; which one a caller is comes from a database lookup, never from a token claim, and there is a
> test proving a smuggled `role` claim is ignored.
>
> **Still open:** the two frontends still sign in through the legacy cookie endpoints. Switching them
> over, and retiring `protectRoute`/`protectAdminRoute`, is the remaining half of R2.

### F-11 · Medium · Money is stored as floating point

Every amount is a JavaScript `Number` (`order.model.js`, `product.model.js`). Tolerable at storefront
scale; not tolerable once thousands of lines sum into a ledger that must balance to the kobo.

**Fix during the migration, not after.** Retrofitting integer minor units means a second pass over every
row and every controller.

### F-12 · Medium · The most-queried collection has no indexes

Twelve models declare indexes; eight do not — including `product`, filtered by category and style on
every shop page, and `user`. `sku` (`product.model.js:64`) is a plain trimmed string with no unique
constraint, so duplicate SKUs are possible, which quietly breaks any stock or purchasing module keyed on
them.

### F-13 · Medium · Housekeeping

No charting library is installed; the Analytics dashboard is tables and CSS bars — workable now, a real
constraint for ERP reporting. `changes.diff` (2.1 MB) is tracked in git and should be deleted.
`admin.controller.js` is 1,402 lines and should be split along the boundaries its routes already imply.
`backend/package.json` declares no `engines` field, so Node version parity between dev, CI and production
is unenforced. The frontend carries **68 ESLint errors** and the backend has no lint configuration at
all; CI now holds the frontend count with a per-file ratchet (`.github/lint-baseline.json`) that lets it
fall but never rise.

### F-14 · Low · The desktop navbar has no landmark element

Found while writing the visual-regression structural checks. The only `<nav>` on a storefront page is the
mobile bottom bar (`lg:hidden`); the desktop navigation is built from plain `<div>`s
(`components/Navbar.jsx:247`). Screen-reader users get no navigation landmark at desktop widths, and
`page.locator('nav')` finds nothing visible — which is how it surfaced.

Cheap to fix (one element rename) but it is a markup change, so it is excluded from R1–R4 by the
UI-parity constraint. Schedule it as its own commit after the replatform, where it can be reviewed on its
own.

---

## 3. Module gap matrix

| Module | State | What exists | What is missing |
|---|---|---|---|
| **CMS** | Partial | Blog, FAQs, projects, banners, per-product SEO with JSON-LD | Media library, draft/publish/scheduling, revision history, reusable blocks, editable static pages |
| **Sales & orders** | Solid | Full lifecycle, status history, guest checkout, coupons, invoices, tracking | Returns/RMA, credit notes, partial refunds, backorders, order→stock link |
| **Finance** | **Absent** | Revenue rollup + CSV export. That is the entire module. | Chart of accounts, double-entry journal, AR, AP, bank reconciliation, period close, trial balance, P&L, balance sheet, cash flow |
| **Expenses** | **Absent** | Nothing — no expense, supplier, vendor or bill model exists | Expense entry with categories, receipt capture, approval workflow, recurring costs, supplier bills, payment runs |
| **Purchasing** | **Absent** | Nothing | Suppliers, purchase orders, goods receipt, three-way match, landed cost, reorder points |
| **Inventory** | Nominal | One number per product, manual adjustment with audit trail, low-stock threshold | Multi-location, reservations, movements as events, valuation, stock takes, transfers, BOM for bespoke pieces |
| **Analytics** | Partial | Revenue, category, region, product, designer, CLV, funnel — with F-08 | Margin and profitability, cash position, aged receivables, budget vs actual, cohorts, saved views, scheduled reports, charts |
| **Projects / CRM** | Partial | Consultations, designer assignment, scheduling, portfolio | Project as a financial object: budget, quote, deposit, milestones, labour, cost-to-complete, profit per job |
| **Access & audit** | **Good** | 14 permissions, 5 roles, per-request resolution, audit log, activity log, rate limiting | Finer permissions per module, approval limits, 2FA, session revocation |
| **HR / payroll** | Absent | Nothing — designers are catalog entries, not employees | Out of scope by decision |

---

## 4. Effort

Assuming one experienced full-stack developer, and **excluding** the replatform in `06`:

| Phase | Scope | Effort |
|---|---|---|
| 0 | Stop the bleeding — webhooks, tests, CI, server-side tax, atomic orders, stock decrement, indexes | 3–4 weeks |
| 1 | Financial spine — minor units, chart of accounts, journal, posting rules, cost price, trial balance, period close | 6–8 weeks |
| 2 | Expenses and payables — suppliers, bills, expense entry with approval, recurring costs, aged payables | 4–5 weeks |
| 3 | Documents, receivables, projects — persistence, numbering, quote→invoice, AR, project profitability | 5–6 weeks |
| 4 | Inventory and purchasing — movement events, multi-location, reservations, POs, goods receipt, valuation | 5–6 weeks |
| 5 | Reporting and CMS finish — statutory reports, saved views, charts, media library, drafts, revisions | 4–5 weeks |

**Total 27–34 weeks solo**, roughly 4–5 months with two developers. Phases 0–2 alone (13–17 weeks) reach
the point where the dashboard shows profit rather than takings, which is where most of the value lands.

These figures assume the current stack. `07-implementation-roadmap.md` gives the revised sequencing and
effort once the replatform in `06` is folded in — Postgres and Supabase remove an estimated 6–8 weeks
from phases 1–3.

---

## 5. Immediate actions

1. ~~**Ship payment webhooks this week, on the current stack.**~~ **Done** — see `07` phase R0.
   Closes F-01 and F-09.
2. **Add a cost field to products and backfill it.** Small, dependency-free, and it unblocks every margin
   number you will ever want. Early means the data has history by the time reports exist.
3. ~~**Make the tests real and turn on CI.**~~ **Done** — real harness in place, CI running on every
   push. Extending coverage to the remaining routes is ongoing.
4. **Correct `TESTING.md` and `FEATURES.md`.** Documentation that overstates delivery is how the wrong
   thing gets built next.
