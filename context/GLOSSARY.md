# Glossary

> Domain terms, acronyms, and technical jargon used in the EM Furniture and Interior project.

---

## Business & Domain Terms

| Term | Definition |
|------|-----------|
| **Collection** | A curated bundle of related products sold together (e.g., "Modern Living Room Set") |
| **Consultation** | A paid interior design service where customers submit room details and are matched with a designer |
| **Designer** | An interior design professional registered on the platform to handle consultations |
| **Flash sale** | A time-limited promotional discount applied to specific products or collections |
| **Loyalty points** | Reward currency earned on purchases and redeemable for discounts |
| **Promo banner** | A marketing banner displayed on specific pages (home, shop, collection, product) |
| **Style** | An interior design aesthetic category (Modern, Antique/Royal, Minimalist, etc.) used to filter products |
| **E-catalog** | A downloadable/viewable PDF product catalog |
| **Showroom** | The physical store location displayed on a Google Maps embed |
| **Guest session** | A server-side anonymous user session identified by UUID, with 7-day TTL |
| **Order number** | A unique identifier for each order, used for tracking |
| **Bank transfer proof** | An image uploaded by the customer as evidence of manual payment |

---

## Technical Terms

| Term | Definition |
|------|-----------|
| **CSM** | Controller-Service-Model — the architectural pattern used in the backend |
| **JWT** | JSON Web Token — stateless authentication tokens stored in HTTP-only cookies |
| **RBAC** | Role-Based Access Control — admin permissions system with 5 roles and 14 permission keys |
| **TTL** | Time To Live — automatic expiration (e.g., guest sessions at 7 days, activity logs at 90 days) |
| **ODM** | Object Document Mapper — Mongoose maps JavaScript objects to MongoDB documents |
| **SPA** | Single Page Application — the React frontend runs entirely in the browser |
| **SSR** | Server-Side Rendering — *not used*; the app is a client-rendered SPA |
| **Hosted checkout** | Payment flow where the customer is redirected to the gateway's own page (Paystack, Flutterwave, Stripe) |
| **Aggregation pipeline** | MongoDB's multi-stage data processing framework, used for analytics queries |
| **Embedded document** | A sub-document stored inside a parent document (e.g., cart items inside User, reviews inside Product) |
| **Fire-and-forget** | An async operation that runs without blocking the main request (e.g., activity logging) |

---

## Middleware Terms

| Term | Definition |
|------|-----------|
| **Rate limiter preset** | One of six rate-limiting configurations (`apiLimiter`, `authLimiter`, `createLimiter`, `passwordResetLimiter`, `exportLimiter`, `searchLimiter`) wired to specific route categories to prevent abuse |
| **Audit logger** | Middleware (`auditLogger`) wired to 9 admin CRUD route files that logs all admin operations with before/after state diffs for compliance tracking |
| **Activity tracker** | Middleware (`activityTracker`) wired to user-facing routes that logs user behaviour (views, cart actions, orders, etc.) as fire-and-forget for analytics |

---

## Acronyms

| Acronym | Expansion |
|---------|-----------|
| **API** | Application Programming Interface |
| **AOV** | Average Order Value |
| **CLV** | Customer Lifetime Value |
| **CORS** | Cross-Origin Resource Sharing |
| **CRUD** | Create, Read, Update, Delete |
| **CSV** | Comma-Separated Values (finance export format) |
| **KPI** | Key Performance Indicator |
| **PDF** | Portable Document Format |
| **REST** | Representational State Transfer |
| **SEO** | Search Engine Optimisation |
| **SKU** | Stock Keeping Unit — unique product identifier for inventory |
| **UI** | User Interface |
| **UUID** | Universally Unique Identifier — used for guest anonymousId |

---

## Admin Roles

| Role | Scope |
|------|-------|
| **super_admin** | Full access to all features and settings |
| **admin** | Full access (same as super_admin, explicitly listed) |
| **editor** | Blog and FAQ management only |
| **support** | Dashboard view only |
| **social_media_manager** | Blog management only |

---

## Permission Keys

| Key | Grants Access To |
|-----|-----------------|
| `admin.dashboard.view` | Admin dashboard |
| `products.manage` | Product CRUD |
| `collections.manage` | Collection CRUD |
| `projects.manage` | Project CRUD |
| `blog.manage` | Blog post CRUD |
| `faq.manage` | FAQ CRUD |
| `marketing.manage` | Banners, flash sales, coupons |
| `orders.view` | View orders |
| `orders.manage` | Update/delete orders |
| `reviews.manage` | Approve/reject reviews |
| `consultations.manage` | Manage consultation requests |
| `designers.manage` | Designer CRUD |
| `inventory.manage` | Stock adjustments |
| `finance.view` | Finance reports, analytics, logs |

---

## Order Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Order placed, awaiting confirmation |
| `confirmed` | Order confirmed by admin |
| `processing` | Order being prepared |
| `shipped` | Order dispatched |
| `delivered` | Order received by customer |
| `cancelled` | Order cancelled |
| `refunded` | Payment refunded |

---

## Payment Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Awaiting payment |
| `completed` | Payment successful |
| `failed` | Payment attempt failed |
| `refunded` | Payment refunded |

---

## Payment Methods

| Method | Description |
|--------|------------|
| `paystack` | Online card payment via Paystack |
| `flutterwave` | Online payment via Flutterwave |
| `stripe` | International card payment via Stripe |
| `bank_transfer` | Manual bank transfer with proof upload |
| `cash_on_delivery` | Pay upon delivery |
| `whatsapp` | Order placed via WhatsApp message |
