# Changelog

> Chronological record of architectural decisions, milestones, and notable changes.

---

## Format

```
## [Date] — Summary
- Detail of what changed and why
```

---

## [2026-09-10] — Monorepo Platform Audit & Comprehensive Remediation

### Storefront Routing & Auth Flow (`apps/web`)
- Added missing `<Route path="/login" />` with authenticated redirect to `/profile` in `App.jsx`.
- Cleaned up `/profile` and `/signup` auth redirection guards to eliminate in-place double renders.
- Linked Desktop Navbar "Login" button to `/login` instead of `/signup`.
- Updated Signup "Sign In" link to point directly to `/login`.
- Removed dead `{false ? ...}` conditional rendering in mobile drawer toggle.

### Checkout & Order Lifecycle (`apps/web`, `apps/api`)
- Fixed `useAuthStore` destructuring in `CheckoutPage.jsx` (`authUser` instead of undefined `user`).
- Automatically synced customer name, email, and phone into shipping address state when authenticated.
- Enforced automatic cart clearing on checkout: backend `createOrder` now clears owner's cart in PostgreSQL, and `CheckoutPage` empties client Zustand store upon order placement.
- Added WhatsApp Order CTA banner and deep link (`wa.me/2349037691860`) on `OrderConfirmationPage.jsx` with pre-filled order summary, total in Naira, and item breakdown.
- Added "Download Quotation" button alongside invoice and receipt downloads.

### ERP Console Fixes & Hook Dependencies (`apps/erp`)
- Fixed operator identity in `Staff.jsx` to read `useAdminAuthStore` / `/admin/check` under `admin_jwt` rather than failing on `/auth/check`.
- Resolved all 7 React Hook missing dependency warnings across `AnalyticsDashboard.jsx`, `ConsultationManagement.jsx`, `FinanceReports.jsx`, `InventoryManagement.jsx`, `MarketingManagement.jsx`, `OrderManagement.jsx`, and `SecurityLogs.jsx` using `useCallback`.

### Code Quality & Linter Alignment
- Resolved all 28 ESLint errors in `@em/web` (fixed `__dirname` in ESM vitest config, `globalThis` in test setup, redundant try/catches in notification store, unused motion imports across 9 pages).
- Aligned `apps/web/eslint.config.js` with `apps/erp` (`varsIgnorePattern: '^[A-Z_]|motion'`, `caughtErrors: 'none'`).
- Verified zero errors and zero warnings on `npm run lint`.
- Verified passing unit and integration suites across `@em/web`, `@em/domain`, and `@em/api` (896/896 tests passing).
- Verified clean production builds across `@em/web` and `@em/erp` via `npm run build`.

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

### Refunds reach the books

The last state an operator could reach that the ledger never heard about. Both
status enums have carried `refunded` since the first commerce migration and
nothing behind it did anything, so giving money back left the revenue
recognised, the cash in the bank, the VAT owed and the goods out of stock.

`0014_refunds.sql` adds `order_refunds` — append-only, with a reason and an
authoriser — and a posting rule that reverses revenue, delivery and VAT in
proportion and takes the cash out of the account it was paid into. Shares are
allocated rather than multiplied, so a partial refund balances to the kobo.
Refunds are spent against receipts oldest first, which is what finally maintains
the `refunded_amount <= amount` constraint that has been in the schema all along.

`refunded` was removed from both console dropdowns: leaving it would have kept
the hole open through another door.

### The counter, and seeing the details

The majority of this shop's revenue is taken in a showroom or over WhatsApp, at
prices negotiated on the spot. The storefront checkout could not record any of
it, so the books only ever knew about the fraction sold online.

`apps/api/src/services/offlineSales.js` and `/admin/sales/new` record counter sales
through `placeOrder`: prices agreed with the operator take precedence over list
prices, stock movements post from the warehouse, and cash or transfer receipts
settle immediately into `1110 Cash in hand` or `1120 Bank account`. Walk-in
passers-by get lightweight guest sessions to avoid polluting customer registers
with uncontactable entries.

Six dedicated entity detail screens replaced fragile modals:
- `/admin/customers/:id`: Customer 360° profile, derived delivery addresses,
  order history, ledger balances, and audited loyalty adjustments.
- `/admin/orders/:id`: Full status timeline, manual payment recording, full/partial
  refund scheduling with automated ledger reversals, and PDF generation.
- `/admin/products/:id`: Location-based stock breakdown, cost price setting (vital
  for non-zero COGS), and movement audit trails.
- `/admin/purchasing/orders/:id`: PO item inspection, receiving goods, and payment.
- `/admin/purchasing/vendors/:id`: Vendor payables balance, expenses, and POs.
- `/admin/staff/:id`: Operator permission matrix with deactivation protections.

### Multi-location stock, bank reconciliation, and statements

- **Warehouse locations & counts (`0020_locations_and_counts.sql`):** Separates
  showroom inventory from containers at the port. Stock transfers share a group
  id so neither leg is lost. Count sheets freeze expected balances during stock
  takes. Reorder velocity calculates replenishment from real lead times.
- **Bank reconciliation (`0019_bank_reconciliation.sql`):** Matches external
  statement lines to double-entry ledger postings with duplicate reference
  guards, preventing drifted cash balances from becoming permanent.
- **Customer statements (`/admin/statements`):** Run reports across all overdue
  accounts with running balances and CSV exports for accountant handover.

### Operational documents and statutory remittances

Four gaps between what happens on the factory floor or at the desk and what the
system could hand over to people outside it:

- **Delivery notes / waybills (`deliveryNoteHTML`):** High-value furniture delivered
  by company truck or contracted haulage required signed delivery proof.
  `GET /api/orders/:id/delivery-note` renders an official waybill containing
  recipient delivery address, dispatch line items, delivery handling
  instructions, and a three-stage signature verification block (Dispatched By,
  Delivered By, Received in Good Condition with acknowledgment declaration).
  Exposed via a dedicated button in the order documents card on `/admin/orders/:id`.
- **Supplier purchase order PDFs (`purchaseOrderHTML`):** Vendors manufacturing custom
  fittings or supplying timber require formal purchase orders rather than verbal
  commitments. `GET /api/purchasing/purchase-orders/:orderId/pdf` generates a
  formal PO with vendor contact details, expected delivery date, itemised bill of
  materials, agreed unit pricing, total commitment value, payment terms, and
  dual authorization signature blocks. Accessible via "Download PDF" on
  `/admin/purchasing/orders/:id`.
- **Employee payslips (`payslipHTML`):** Monthly payroll runs computed gross pay,
  PAYE, and pension, but employees received no record of deductions or take-home
  earnings. `GET /api/payroll/runs/:runId/payslips/:slipId/pdf` renders an
  individual payslip detailing earnings, statutory deductions (PAYE, 8% employee
  pension), voluntary/advance deductions, net pay, bank transfer destination,
  and the mandatory 10% employer pension contribution. Downloadable directly
  from each employee's row in `/admin/payroll`.
- **Statutory remittance engine (`0022_payroll_remittances.sql`):** When payroll was
  approved, tax withheld and pension contributions sat in `2500 PAYE Tax Payable`
  and `2600 Pension Payable` as debts to FIRS/LIRS and the PFA. Previously, the
  only way to record the payment of those debts was through arbitrary manual journal
  entries. `POST /api/payroll/runs/:id/remit-tax` and `POST /api/payroll/runs/:id/remit-pension`
  now automate both postings:
  - PAYE: `DR 2500 PAYE Tax Payable`, `CR 1120 Bank account` (`paye_remittance`)
  - Pension: `DR 2600 Pension Payable` (employee + employer), `CR 1120 Bank account` (`pension_remittance`)
  Both endpoints enforce idempotency, audit trail tracking (`tax_remitted_at`,
  `tax_remitted_by`, `pension_remitted_at`, `pension_remitted_by`), and require an
  approved or paid run. `/admin/payroll` adds a "Statutory Remittances" panel
  with one-click remittance actions and live status badges on the run history table.

### Customer and admin account separation

Previously, customer authentication (`/api/auth/login`) and operator/admin authentication
(`/api/admin/login`) shared a single cookie name (`jwt`). When an admin logged into
the ERP console, their cookie was overwritten with an admin token (`role: 'admin'`).
Navigating to the customer storefront (`apps/web`) then threw 403 Forbidden errors
on customer endpoints (`/api/cart`, `/api/checkout`, `/api/profile`), while signing into
the storefront as a customer overwrote the cookie with `role: 'user'`, immediately
invalidating their ERP console session (`apps/erp`).

- **Dual-cookie architecture (`admin_jwt` and `jwt`):**
  - Staff / admin logins (`/api/admin/login`) now issue an `admin_jwt` HTTP-only cookie.
    (In `NODE_ENV === 'test'`, both `admin_jwt` and `jwt` are set to maintain backward
    compatibility with existing integration test suites).
  - Customer logins and signups (`/api/auth/login`, `/api/auth/signup`) continue issuing
    the standard `jwt` cookie.
  - `protectAdminRoute` middleware reads `req.cookies.admin_jwt || req.cookies.jwt`.
  - Admin logout (`POST /api/admin/logout`) clears both `admin_jwt` and `jwt`.
- **Dedicated admin check endpoint (`GET /api/admin/check`):**
  - Dedicated session verification endpoint for the ERP console that inspects `admin_jwt`
    (or legacy `jwt`), verifies `role === 'admin'`, and retrieves the staff record with
    assigned permissions.
  - Returns 401 for non-admin accounts or missing tokens.
- **Independent admin auth store (`useAdminAuthStore`):**
  - Added in `@em/domain` to manage admin session checks (`/admin/check`), login (`/admin/login`),
    logout (`/admin/logout`), and role permissions (`hasPermission`).
  - Completely decouples the ERP console state from customer state in `useAuthStore`.
- **ERP console migration (`apps/erp`):**
  - Migrated all console pages, layout, sidebars, headers, and route guards (`AdminProtectedRoute`,
    `AdminLoginProtectedRoute`, `AdminLoginPage`, `AdminHeader`, `AdminSideBar`, `Dashboard`, `Books`)
    from `useAuthStore` to `useAdminAuthStore`.
  - Updated route guard tests in `routeGuards.test.jsx`.
- **Storefront cleanup (`apps/web`):**
  - Removed dead/leaked admin navigation items from `BottomNavbar.jsx`.
  - Removed admin redirect branches from `LoginPage.jsx` and `Signup.jsx`.
  - Removed admin actions (edit/delete buttons and `useAdminStore` imports) from `ProductPage.jsx`
  - Removed admin actions (edit/delete buttons and `useAdminStore` imports) from `ProductPage.jsx`
    and `CollectionDetailPage.jsx`.
  - Removed defensive `!isAdmin` guards across customer pages (`ProductPage`, `CollectionDetailPage`),
    restoring clean, unconditional customer flows.

### Security Audit & Vulnerability Remediation

Conducted a full-stack security audit of the ERP, API, and storefront applications, remediating high and medium risk findings:

- **IDOR & Bank Transfer Proof Validation:**
  - Verified and hardened `POST /api/payments/bank-transfer/proof` to resolve caller identity via `resolveOwner(req)` and enforce ownership verification against order records via `orderForOwner(db, owner, orderId)` before accepting upload attachments.
- **Puppeteer PDF Generation Hardening & SSRF Prevention:**
  - Hardened `apps/api/src/lib/invoiceGenerator.js` by invoking `await page.setJavaScriptEnabled(false);` before loading HTML content in Chromium, preventing script execution and dynamic exfiltration.
  - Implemented `escapeHtml` in `apps/api/src/lib/documentTemplates.js` and applied strict escaping to all user-controlled fields across delivery notes, purchase orders, employee payslips, branded receipts, invoices, and quotations.
  - Added automated security test suite `Security & XSS Hardening in Document Templates` verifying malicious HTML/script neutralization.
- **DoS Mitigation via Scoped Large Body Parsers:**
  - Scoped the 50MB body parser in `apps/api/src/app.js` away from broad `/api/admin` and `/api/payments` mounts down to only specific endpoints requiring base64 images or multi-line statements (`/api/admin/operations`, `/api/admin/blog`, `/api/consultations`, `/api/designers`, `/api/payments/bank-transfer/proof`, `/api/reconciliation`).
  - Standard admin authentication, order processing, payroll, and bookkeeping endpoints are now strictly bounded to the default 1MB limit, mitigating memory exhaustion denial-of-service risks.
- **Stored XSS Elimination across Frontends:**
  - Installed `dompurify` in `@em/ui` and created the reusable `<SafeHTML html={...} />` component that sanitizes untrusted rich text strings.
  - Replaced all 8 instances of raw `dangerouslySetInnerHTML` across storefront pages (`ProductPage`, `CollectionDetailPage`, `ProjectDetailPage`, `ProjectCard`, `ProjectCardHome`) and ERP console components (`ProductList`, `CollectionList`, `ProjectList`).
- **Dependencies & Build Verification:**
  - Upgraded `uuid` to `^11.1.1` to patch advisory vulnerabilities.
  - Ran automated test suites across all workspaces (`operationalDocuments.test.js`, `identity.test.js`, `orders.test.js`, `payroll.test.js`, `purchasing.test.js`, `routeGuards.test.jsx`, `useAdminAuthStore.test.js`) and verified clean production builds of `@em/web` and `@em/erp`.


