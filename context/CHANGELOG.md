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
