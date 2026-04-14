# Backend Implementation Plan

> Phased build plan for the EM Furniture and Interior backend (Phases 0–8).

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed |
| 🔲 | Not started |

---

## Phase 0: Foundation

> Project scaffolding, database connection, core middleware.

| # | Task | Status |
|---|------|--------|
| 0.1 | Initialize Node.js project with ES Modules | ✅ |
| 0.2 | Set up Express server with CORS, cookie-parser, JSON parsing | ✅ |
| 0.3 | MongoDB connection via Mongoose (`lib/db.js`) | ✅ |
| 0.4 | Environment variable configuration (`.env`) | ✅ |
| 0.5 | Cloudinary integration (`lib/cloudinary.js`) | ✅ |
| 0.6 | JWT utility functions (`lib/utils.js`) | ✅ |
| 0.7 | `protectRoute` middleware (user auth) | ✅ |
| 0.8 | `protectAdminRoute` middleware (admin auth) | ✅ |
| 0.9 | `requirePermissions` middleware (RBAC) | ✅ |
| 0.10 | Permission constants and role resolution (`lib/permissions.js`) | ✅ |
| 0.11 | User model with embedded cart/wishlist | ✅ |
| 0.12 | Admin model with roles and permissions | ✅ |
| 0.13 | Database seeder (`seed/seed.js`) | ✅ |

---

## Phase 1: Public Website (Customer-Facing)

> Product catalog, collections, content pages, contact form.

| # | Task | Status |
|---|------|--------|
| 1.1 | Product model (categories, styles, pricing, images, SEO fields) | ✅ |
| 1.2 | Product controller — CRUD, filtering (search, category, style, price, rating), pagination | ✅ |
| 1.3 | Product routes (public: list, count, by-ids, detail) | ✅ |
| 1.4 | Collection model (product refs, cover image, reviews) | ✅ |
| 1.5 | Collection controller — list, count, detail with filtering | ✅ |
| 1.6 | Collection routes (public: list, count, detail) | ✅ |
| 1.7 | Project model (portfolio — images, category, location, price) | ✅ |
| 1.8 | Project controller — list, count, detail (paginated) | ✅ |
| 1.9 | Project routes (public) | ✅ |
| 1.10 | Blog model (title, slug, excerpt, content, tags, status) | ✅ |
| 1.11 | Blog controller — public list + slug lookup, admin CRUD | ✅ |
| 1.12 | Blog routes (public + admin) | ✅ |
| 1.13 | FAQ model (question, answer, order, isActive) | ✅ |
| 1.14 | FAQ controller — public list, admin CRUD | ✅ |
| 1.15 | FAQ routes (public + admin) | ✅ |
| 1.16 | Contact email controller (Gmail API via googleapis) | ✅ |
| 1.17 | Gmail service (`services/gmail.service.js`) | ✅ |
| 1.18 | Contact route | ✅ |

---

## Phase 2: Advanced Product Catalog

> Comparison, recently viewed, estimated delivery.

| # | Task | Status |
|---|------|--------|
| 2.1 | Product comparison support (by-ids endpoint for compare view) | ✅ |
| 2.2 | Recently viewed (client-side cache, optional API storage) | ✅ |
| 2.3 | Estimated delivery date fields on product model | ✅ |

---

## Phase 3: E-Commerce Features

> Cart, wishlist, coupons, checkout, orders, invoices.

| # | Task | Status |
|---|------|--------|
| 3.1 | Auth controller (signup, login, logout, profile update, password reset, account deletion) | ✅ |
| 3.2 | Auth routes (public + protected) | ✅ |
| 3.3 | Guest model (anonymousId, embedded cart/wishlist, 7-day TTL) | ✅ |
| 3.4 | Guest controller (session management, cart/wishlist CRUD) | ✅ |
| 3.5 | `identifyGuest` middleware (JWT-first, then anonymousId) | ✅ |
| 3.6 | Guest routes (session, cart, wishlist) | ✅ |
| 3.7 | Cart controller (add, remove, update quantity, clear) | ✅ |
| 3.8 | Cart routes (with identifyGuest + protectRoute) | ✅ |
| 3.9 | Wishlist controller (add, remove, clear) | ✅ |
| 3.10 | Wishlist routes (with identifyGuest + protectRoute) | ✅ |
| 3.11 | Coupon model (code, discount type/value, limits, dates, targeting) | ✅ |
| 3.12 | Coupon controller (validate, apply, admin CRUD) | ✅ |
| 3.13 | Coupon routes (public validate/apply, admin management) | ✅ |
| 3.14 | Tax controller (rate-based calculation, line-item breakdown) | ✅ |
| 3.15 | Tax routes | ✅ |
| 3.16 | Order model (orderNumber, items, addresses, status, payment) | ✅ |
| 3.17 | Order controller (create, list, track, admin management) | ✅ |
| 3.18 | Order routes (user + admin) | ✅ |
| 3.19 | Invoice generator (`lib/invoiceGenerator.js` — PDF via pdfkit) | ✅ |
| 3.20 | Receipt and quotation generation | ✅ |

---

## Phase 4: Customer Account Features

> Order history, tracking, reviews, notifications, loyalty.

| # | Task | Status |
|---|------|--------|
| 4.1 | Order history endpoint (user's past orders) | ✅ |
| 4.2 | Order tracking by order number | ✅ |
| 4.3 | Review controller (product + collection reviews, purchase verification) | ✅ |
| 4.4 | Review routes (user submit, admin moderation — approve/reject) | ✅ |
| 4.5 | Notification model (user ref, type, read tracking) | ✅ |
| 4.6 | Notification controller (create, list, mark read, delete) | ✅ |
| 4.7 | Notification routes (protected) | ✅ |
| 4.8 | Loyalty transaction model (earn/redeem/adjustment) | ✅ |
| 4.9 | Loyalty controller (summary, history) | ✅ |
| 4.10 | Loyalty routes (protected) | ✅ |

---

## Phase 5: Interior Design Module

> Consultation booking, designer management.

| # | Task | Status |
|---|------|--------|
| 5.1 | Consultation request model (details, photos, floor plan, designer, status) | ✅ |
| 5.2 | Consultation controller (create request, admin view/update, image uploads) | ✅ |
| 5.3 | Consultation routes (public create, admin management) | ✅ |
| 5.4 | Designer model (name, title, bio, avatar, isActive) | ✅ |
| 5.5 | Designer controller (public active list, admin CRUD) | ✅ |
| 5.6 | Designer routes (public + admin) | ✅ |

---

## Phase 6: Admin Panel

> Product/collection/order management, marketing, inventory, finance.

| # | Task | Status |
|---|------|--------|
| 6.1 | Admin auth (signup, login, logout) | ✅ |
| 6.2 | Admin product CRUD (add, update, delete with Cloudinary) | ✅ |
| 6.3 | Admin collection CRUD (add, update, delete) | ✅ |
| 6.4 | Admin project CRUD (add, update, delete) | ✅ |
| 6.5 | Admin routes (with permission guards) | ✅ |
| 6.6 | Promo banner model (position, priority, scheduling) | ✅ |
| 6.7 | Flash sale model (discount, targeting, scheduling) | ✅ |
| 6.8 | Marketing controller (banners + flash sales CRUD) | ✅ |
| 6.9 | Marketing routes (public active, admin management) | ✅ |
| 6.10 | Inventory adjustment model (delta, reason, audit trail) | ✅ |
| 6.11 | Inventory controller (list with low-stock filter, adjust) | ✅ |
| 6.12 | Inventory routes (admin only) | ✅ |
| 6.13 | Finance controller (revenue summary, daily breakdown, CSV export) | ✅ |
| 6.14 | Finance routes (admin + FINANCE_VIEW permission) | ✅ |
| 6.15 | SEO metadata fields on product model (title, description, keywords, JSON-LD) | ✅ |

---

## Phase 7: Analytics and Reporting

> Dashboards, performance metrics, conversion funnel.

| # | Task | Status |
|---|------|--------|
| 7.1 | Analytics controller (overview, category, region, product, designer, CLV, funnel) | ✅ |
| 7.2 | Analytics routes (7 endpoints, FINANCE_VIEW permission) | ✅ |
| 7.3 | Date range filtering for all analytics endpoints | ✅ |
| 7.4 | MongoDB aggregation pipelines for analytics | ✅ |

---

## Phase 8: Security and System Features

> Audit logging, activity tracking, rate limiting.

| # | Task | Status |
|---|------|--------|
| 8.1 | Audit log model (actor, action, resource, changes, status) | ✅ |
| 8.2 | Activity log model (user/guest, type, metadata, 90-day TTL) | ✅ |
| 8.3 | `auditLogger` middleware (intercepts response, logs before/after changes) | ✅ |
| 8.4 | `activityTracker` middleware (fire-and-forget tracking) | ✅ |
| 8.5 | Logs controller (audit + activity — list, stats, cleanup) | ✅ |
| 8.6 | Logs routes (admin + FINANCE_VIEW permission) | ✅ |
| 8.7 | Rate limiter presets (6 configurations defined) | ✅ |
| 8.8 | Wire rate limiters to route files | ✅ |

---

## Payment Gateway Integration

> Cross-cutting — supports Phase 3 checkout.

| # | Task | Status |
|---|------|--------|
| P.1 | Payment transaction model (order ref, gateway, status, proof) | ✅ |
| P.2 | Paystack — initialize + verify | ✅ |
| P.3 | Flutterwave — initialize + verify | ✅ |
| P.4 | Stripe — initialize + verify | ✅ |
| P.5 | Bank transfer proof upload (Cloudinary) | ✅ |
| P.6 | Payment routes (initialize + verify per gateway) | ✅ |

---

## Phase 9: Post-MVP Backend Enhancements

> Loyalty, Purchase Verification, Delivery Tracking

| # | Task | Status |
|---|------|--------|
| 9.1 | Update `user.model` with native `loyaltyPoints` attribute | ✅ |
| 9.2 | Add `isVerifiedPurchase` and `isApproved` inside Review schemas | ✅ |
| 9.3 | Enhance `product.model` with `leadTimeDays` and shipping min/max data | ✅ |
| 9.4 | Connect new properties with controllers (admin, auth, cart, review) | ✅ |
| 9.5 | Incorporate fields into seed data/tests | ✅ |

---

## Summary

| Phase | Tasks | Completed | Remaining |
|-------|-------|-----------|-----------|
| Phase 0: Foundation | 13 | 13 | 0 |
| Phase 1: Public Website | 18 | 18 | 0 |
| Phase 2: Advanced Catalog | 3 | 3 | 0 |
| Phase 3: E-Commerce | 20 | 20 | 0 |
| Phase 4: Customer Accounts | 10 | 10 | 0 |
| Phase 5: Interior Design | 6 | 6 | 0 |
| Phase 6: Admin Panel | 15 | 15 | 0 |
| Phase 7: Analytics | 4 | 4 | 0 |
| Phase 8: Security | 8 | 8 | 0 |
| Payments | 6 | 6 | 0 |
| Phase 9: Post-MVP DB Updates | 5 | 5 | 0 |
| **Total** | **108** | **108** | **0** |
