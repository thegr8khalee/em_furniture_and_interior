# Concept Note

> Business concept, market analysis, and technology pillars for EM Furniture and Interior.

---

## 1. Executive Summary

EM Furniture and Interior is a digital commerce platform purpose-built for the Nigerian furniture and interior design market. It merges online product sales with personalised interior design consultations, loyalty rewards, and multi-channel payment support — all in one responsive web application.

---

## 2. Market Context

### 2.1 Industry Landscape

The Nigerian furniture and interior decor market is growing rapidly, driven by:

- **Urbanisation** — Lagos, Abuja, and Port Harcourt driving demand for modern living spaces.
- **Rising middle class** — Increasing disposable income directed toward home improvement.
- **Digital adoption** — Smartphone penetration enabling mobile-first shopping.
- **Unmet demand** — Few local platforms combine product sales with design services.

### 2.2 Target Audience

| Segment | Description |
|---------|------------|
| **Homeowners** | First-time buyers and renovators seeking quality furniture online |
| **Interior enthusiasts** | Style-conscious shoppers who browse by design aesthetic (Modern, Antique/Royal, etc.) |
| **Business clients** | Offices, hotels, and restaurants furnishing spaces in bulk |
| **Design clients** | Customers needing full consultation — room photos, floor plans, designer assignment |

### 2.3 Competitive Gap

Existing Nigerian e-commerce platforms (Jumia, Konga) provide generic marketplaces. EM Furniture fills the gap by:

- Offering **style-based browsing** (Modern, Antique/Royal, Minimalist, etc.)
- Integrating **interior design consultations** directly into the shopping experience
- Supporting **Nigerian payment rails** (Paystack, Flutterwave, bank transfer with proof upload) alongside international gateways (Stripe)
- Providing **curated collections** — pre-assembled product bundles for room setups

---

## 3. Product Vision

### 3.1 Core Value Propositions

1. **Shop + Design in one platform** — Browse products, book a consultation, and get a professionally designed room.
2. **Style-first discovery** — Filter the entire catalog by interior design styles, not just categories.
3. **Nigerian payment ecosystem** — Paystack, Flutterwave, manual bank transfer proof, and pay-on-delivery.
4. **Guest-friendly** — Full cart, wishlist, and checkout without account creation.
5. **Loyalty programme** — Earn and redeem points across purchases.

### 3.2 Module Map

```
┌─────────────────────────────────────────────────────────┐
│                    EM FURNITURE PLATFORM                  │
├──────────────┬──────────────┬──────────────┬────────────┤
│   Storefront │  Consultations│   Accounts   │   Admin    │
├──────────────┼──────────────┼──────────────┼────────────┤
│ Products     │ Book consult │ Auth/Profile │ Products   │
│ Collections  │ Upload photos│ Orders       │ Orders     │
│ Cart         │ Floor plans  │ Notifications│ Reviews    │
│ Wishlist     │ Select style │ Loyalty      │ Coupons    │
│ Checkout     │ Pick designer│ Track orders │ Marketing  │
│ Payments     │ Budget range │ Invoices     │ Inventory  │
│ Reviews      │              │              │ Finance    │
│ Comparison   │              │              │ Analytics  │
│ Blog / FAQ   │              │              │ Security   │
└──────────────┴──────────────┴──────────────┴────────────┘
```

---

## 4. Technology Pillars

### 4.1 Architecture

- **Monolithic modular backend** — Single Express.js server with 25 domain-specific controllers following the Controller-Service-Model (CSM) pattern.
- **React SPA frontend** — Vite-powered, Zustand state management, Tailwind CSS + DaisyUI component library.
- **MongoDB** — Document database with Mongoose ODM, embedded sub-documents for cart/wishlist/reviews.

### 4.2 Security

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT in HTTP-only cookies, bcryptjs password hashing |
| Admin RBAC | 5 roles, 14 permissions, per-route permission guards |
| Guest sessions | UUID-based anonymous IDs, 7-day TTL, server-side storage |
| Audit trail | Every admin action logged via `auditLogger` middleware wired to 9 CRUD route files, with before/after change diffs |
| Activity tracking | User behaviour logged via `activityTracker` middleware on user-facing routes (views, cart, wishlist, orders, reviews, consultations, auth) with 90-day TTL |
| Rate limiting | 6 limiter presets fully wired to all routes (API gateway, auth, resource creation, password reset, export, search) |

### 4.3 Payment Infrastructure

| Gateway | Type | Use Case |
|---------|------|----------|
| Paystack | Hosted checkout | Primary Nigerian gateway |
| Flutterwave | Hosted checkout | Alternative Nigerian gateway |
| Stripe | Hosted checkout | International payments |
| Bank transfer | Proof upload | Manual verification for unbanked/preference |

### 4.4 Content & Media

| Service | Purpose |
|---------|---------|
| Cloudinary | Product images, consultation room photos, designer avatars |
| Gmail API | Transactional emails (contact form, password reset) |
| pdfkit | Invoice, receipt, and quotation PDF generation |
| TinyMCE | Rich text editing for blog posts (admin) |
| Google Maps Embed | Showroom location display |

---

## 5. Business Model

| Revenue Stream | Description |
|----------------|------------|
| Product sales | Furniture and decor sold through the platform |
| Collections | Curated room bundles at premium pricing |
| Consultation fees | Paid interior design consultations |
| Loyalty programme | Encourages repeat purchases via points |

---

## 6. Success Metrics

| KPI | Tracked Via |
|-----|------------|
| Total revenue | Finance module (admin dashboard) |
| Orders per period | Analytics overview |
| Average order value | Analytics overview |
| Sales by category/region | Analytics dashboards |
| Product performance | Top products by revenue |
| Customer lifetime value | Top customers by spend |
| Conversion funnel | Registration → Order → Payment rates |
| Designer performance | Consultation completion rates |

---

## 7. Regulatory Considerations

- **Data privacy** — Privacy policy page, cookie consent banner, session-based storage with user opt-in.
- **Payment compliance** — Gateway-managed PCI compliance (Paystack, Flutterwave, Stripe handle card data).
- **Consumer protection** — Order tracking, invoice generation, clear terms & conditions.
