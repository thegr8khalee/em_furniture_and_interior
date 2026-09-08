# Changelog

> Chronological record of architectural decisions, milestones, and notable changes.

---

## Format

```
## [Date] — Summary
- Detail of what changed and why
```

---

## [2025] — Project Inception

### Foundation
- Initialized monorepo with `backend/` and `frontend/` directories
- Chose Node.js + Express + MongoDB (Mongoose) for backend
- Chose React + Vite + Tailwind CSS + DaisyUI for frontend
- Adopted ES Modules throughout (both backend and frontend)
- Implemented Controller-Service-Model (CSM) architecture pattern
- Set up JWT authentication with HTTP-only cookies
- Integrated Cloudinary for image storage

### Phase 1 — Public Website
- Built 25 backend controllers covering all domain areas
- Created 20 Mongoose models with embedded subdocuments for cart/wishlist/reviews
- Implemented product catalog with advanced filtering (category, style, price, rating, search)
- Built collection system with product references and reviews
- Added blog with slug-based routing and admin CRUD
- Added FAQ management with ordering and activation controls
- Implemented contact form via Gmail API (googleapis + Nodemailer)

### Phase 2 — Advanced Catalog
- Added product comparison support (by-ids endpoint)
- Client-side recently viewed tracking
- Estimated delivery date fields on product model

### Phase 3 — E-Commerce
- Built full cart system (add, remove, update quantity, clear) for authenticated and guest users
- Built wishlist system mirroring cart architecture
- Implemented coupon system with percentage/fixed discounts, minimum purchase, usage limits, date validity, category targeting
- Built order system with status tracking (7 statuses) and payment tracking
- Implemented guest checkout with anonymous sessions (7-day TTL)
- Added PDF generation for invoices, receipts, and quotations via pdfkit
- Integrated TaxJar-style tax calculation

### Phase 4 — Customer Accounts
- Order history and self-serve order tracking
- Review system with purchase verification and admin moderation (approve/reject)
- In-app notification centre with read tracking
- Loyalty points system (earn/redeem/adjustment ledger)

### Phase 5 — Interior Design
- Consultation booking with room photo/floor plan uploads
- Designer management (profiles, avatars, active/inactive)
- Admin consultation workflow (assign designer, schedule, status updates)

### Phase 6 — Admin Panel
- Role-based access control (5 roles, 14 permissions)
- Admin product/collection/project CRUD with Cloudinary uploads
- Promo banner management with position targeting and scheduling
- Flash sale system with product/collection targeting
- Inventory tracking with adjustment logging
- Finance module with revenue summary and CSV export
- SEO metadata fields per product (title, description, keywords, JSON-LD)

### Phase 7 — Analytics
- Analytics dashboard with 7 endpoints (overview, category, region, product, designer, CLV, funnel)
- MongoDB aggregation pipelines for all analytics
- Flexible date range filtering

### Phase 8 — Security
- Audit logging middleware capturing all admin actions with before/after diffs — **wired to 9 admin CRUD route files** (admin, adminBlog, adminFaq, coupon, designer, marketing, inventory, order, review)
- Activity tracking middleware (fire-and-forget user behaviour logging) — **wired to user-facing routes** (auth, product, collection, cart, wishlist, order, review, consultation — 10 activity types tracked)
- 6 rate limiter presets defined and **fully wired to all routes**: `apiLimiter` globally on `/api/*`, `authLimiter` on auth/admin login, `passwordResetLimiter` on password reset, `createLimiter` on resource creation, `exportLimiter` on finance export, `searchLimiter` on search endpoints
- Security logs dashboard with filtering, stats panels, and cleanup tools
- Admin signup endpoint now protected with `protectAdminRoute` + `requirePermissions([ADMIN_DASHBOARD_VIEW])`
- `super_admin` role added to database seed script for initial setup

### Payment Integration
- Paystack hosted checkout (initialize + verify)
- Flutterwave hosted checkout (initialize + verify)
- Stripe hosted checkout (initialize + verify)
- Bank transfer proof upload via Cloudinary

### Frontend
- Built 35+ page components with React Router v7
- 15 Zustand stores for state management (including `useMarketingStore` for public banners/flash sales)
- Framer Motion page transitions and animations
- Responsive design (mobile-first with Tailwind breakpoints)
- Admin panel with sidebar navigation and 10+ management pages
- Cookie consent banner with localStorage/sessionStorage fallback
- Marketing integration: promo banners rendered on HomePage, Shop, ProductPage, CollectionDetailPage by position; flash sale countdown timers on HomePage and Shop

### Testing
- Backend: 72 Jest tests across 3 suites (auth, features, payments) — all passing
- Frontend: 43 Vitest tests (payments, tax, coupons) — all passing
- Total: 115 tests, 100% pass rate

### Post-MVP Enhancements & Backend Features (April 2026)
- **Loyalty System & User Schema Updates:** Introduced `loyaltyPoints` logic directly on the `user.model.js` along with supporting logic across auth controllers.
- **Enhanced Product Schema:** Added `leadTimeDays`, `shippingMinDays`, and `shippingMaxDays` to `product.model.js` for better delivery estimation.
- **Review Moderation additions:** Added `isVerifiedPurchase` and `isApproved` flags on product reviews for reliable feedback loops and moderation capability.
- **Widespread Controller/Route modifications:** Implemented the associated controller business logic and updated route handlers to accommodate the schema additions.

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| MongoDB over PostgreSQL | Document model fits embedded cart/wishlist/reviews; flexible schema for product variants |
| Zustand over Redux | Lightweight, minimal boilerplate, sufficient for this app's state needs |
| HTTP-only cookies over localStorage for JWT | XSS protection — tokens not accessible via JavaScript |
| Embedded reviews in Product/Collection models | Co-located reads (no joins needed), acceptable write frequency |
| Guest sessions in MongoDB with TTL | Server-side state enables checkout without account; automatic cleanup |
| Separate admin auth flow | Different JWT claims, different middleware chain, different UI |
| Multiple payment gateways | Paystack/Flutterwave for Nigerian market, Stripe for international, bank transfer for unbanked |
| pdfkit for documents | Server-side PDF generation without external service dependency |
| Gmail API over SMTP | OAuth2 security, avoids "less secure app" issues with Google |
| DaisyUI over custom components | Rapid development with themed, accessible components on top of Tailwind |

---

## [September 2026] — PostgreSQL

The API moved off MongoDB entirely, slice by slice, each one shipping with the
tests for what it moved. `mongoose` and `mongodb` are no longer dependencies and
`src/models/` no longer exists. `docs/SCHEMA.md` carries the reasoning; this is
the order it happened in.

| Slice | What moved |
|-------|------------|
| Schema | 11 migrations, applied by a runner that takes an advisory lock and refuses to run twice |
| Catalog | Product and collection reads, then admin CRUD |
| Carts | One `carts` table for shoppers and guests, replacing two drifted code paths |
| Accounts | `customers` and `staff`, and the bootstrap script for the first operator |
| Orders | Pricing, coupons, the ledger postings and the stock movements |
| Payments | Paystack, claimed once whichever path delivers the charge |
| Reviews | One table for both kinds of item, rating maintained by trigger |
| Stock | Balances derived from the movement ledger, not a counter |
| Reports | Aggregation pipelines rewritten as joins |
| Content | Blog, FAQs, projects, designers, consultations, notifications, loyalty, marketing, logs |

### What the move fixed

Rules that were conventions became constraints: an order's total has to be the
sum of its parts, a coupon cannot be spent past its limit, a review is one per
customer per item, a delivered order earns its points once, a scheduled
consultation has a time and a designer.

Defects found and fixed on the way, in the order they surfaced:

- The customer-facing invoice, receipt and quotation routes had **no ownership
  check**, so anyone who guessed an order id could print anyone's order.
- `POST /api/admin/signup` signed the caller in as the account it had just
  created, and required only `admin.dashboard.view` — which `support` holds — so
  a support account could mint a colleague with more access than itself.
- The audit logger wrote the request body verbatim, so auditing operator
  creation would have logged the new password into a page the console displays.
- A fresh installation could not record its first sale: no accounting period
  existed, so confirming an order raised an exception and took the order with it.
- `trackActivity` read a property nothing sets, so every guest activity was
  dropped; three routes ran it with no `identifyGuest`, so there was nobody to
  attribute anything to.
- Order totals, tax included, were taken from the request body and trusted.
- Marking an order paid cleared a cart that had not existed since the cart slice.

---

## [September 2026] — The ERP the ledger was built for

The double-entry ledger arrived with the PostgreSQL migration but nothing read
it and half the business could not reach it. Four pieces closed that.

### The buying side

`0012_purchasing.sql` and `0013_purchase_order_settlement.sql` add vendors,
expenses and purchase orders. Twelve of the thirty accounts in the chart could
never receive a posting before, because nothing recorded a purchase: payables
stayed empty, input VAT was structurally zero, and rent, salaries and marketing
had no way in. The profit and loss showed revenue less cost of sales and
stopped, which is a gross margin, not a profit.

An expense is approved once — which makes it a cost and a debt — and paid once,
which settles it. A purchase order becomes stock and a liability when the goods
arrive, at the cost that was agreed rather than the product's current cost
price. Every posting commits in the same transaction as the status change.

### The books, on a screen

`/admin/books` and `/admin/purchasing`. Everything on the first derives from
`journal_lines`, so the reports and the postings cannot disagree; every account
code opens that account's ledger with a running balance. The console's only
finance screen before this summed the orders table.

### Signing in through Supabase

`POST /api/auth/supabase` and `POST /api/admin/supabase` exchange a Supabase
access token for the session cookie the password path issues. Verification is
Supabase's job — the token goes to `/auth/v1/user`, the only party that can say
whether it has been revoked. An operator is linked, never created. Both sign-in
pages show the button only when the project is configured.

### Defects found by driving it

- **No product had a cost price.** `sellable_items.cost_price` existed and the
  posting rule read it, but nothing ever wrote one — not the product form, not
  the seeder — so every sale posted revenue and no cost of sales, and the profit
  and loss showed a 100% gross margin on everything. Set on the inventory screen
  now, and deliberately absent from the public product shape: a cost price
  beside a selling price is the margin.
- **Nothing could settle what a receipt owed**, so `2100` accumulated every
  purchase for ever while the payables list showed nothing outstanding.
- **A blank date field is `""`, not null**, and `''::date` is a syntax error —
  so a purchase order with no expected date was a 500.
- **A report with no end date ended its window at the API process's own clock**,
  so an order the database wrote a moment earlier under a clock a second ahead
  fell outside "the last 30 days" and vanished from the dashboard. Found only by
  running the suite against Supabase rather than a local database.
- **The seeded books were unreadable.** Opening stock arrived as `adjustment`
  movements, and a positive adjustment credits stock write-offs, so stocking the
  shop booked tens of millions of negative expense; nothing had put money into
  the business, so paying for that stock overdrew an account that never had
  anything in it; and orders were seeded before stock, so things were sold
  before they were bought.

### The people, and the guards around them

Two tables had rows from the first migration and no way to read them.

`/api/customers` joins an account to its orders, loyalty movements, reviews and
consultations, so the console can answer the three questions somebody on the
phone is asking: who signed up, have they bought before, and where do we deliver.
It is read-only but for a loyalty adjustment, which writes the movement and lets
the balance follow — a balance nobody can explain is worse than a wrong one.
*Spent* counts only what was paid and not refunded, and addresses are derived
from the orders they were used on, because there is no address book: people move,
and an order keeps the address it actually went to.

`/api/admin/staff` lists operators, says whether each permission came from the
role or was granted by hand, and ends access by deactivation. It refuses the two
ways to lose the console — changing your own role or active flag, and standing
down the last active owner — and refuses a permission that is not in
`PERMISSIONS` rather than storing one that silently never matches.

`customers.view` is a new permission held by support as well as admin.
`staff.manage` finally has something behind it.

### Test-run safety, after the leak

Twelve live `super_admin` accounts with this suite's committed password were
found in the real Supabase database, left by early test runs. Two guards:
`TEST_DATABASE_URL` no longer defaults to a local server, and nothing is
created, dropped or written unless it is named `em_test_*`. `setupDatabase` also
repoints `DATABASE_URL` itself, so a suite cannot forget to and reach the live
database by omission.

The worker count is capped against a hosted database for the same reason the
timeout already was — the ceiling is the pooler's connection limit, not the
machine's cores.
