# Project Overview

> One-page executive summary of EM Furniture and Interior.

---

## What Is It?

**EM Furniture and Interior** is a full-stack e-commerce web application for selling furniture and interior decor products. It combines a storefront with an interior design consultation module, loyalty programme, multi-gateway payments, and a comprehensive admin panel.

---

## Problem Statement

Small-to-medium furniture businesses lack affordable, feature-rich e-commerce platforms that combine product sales with interior design services. Generic platforms don't support consultations, designer assignment, style-based filtering, or the Nigerian payment ecosystem (Paystack, Flutterwave, bank transfer proof).

---

## Solution

A purpose-built platform delivering **150+ features** across **8 implementation phases**:

| Module | Highlights |
|--------|-----------|
| **Product Catalog** | Filtering by category/style, product comparison, recently viewed, estimated delivery |
| **Collections** | Curated product bundles with reviews and promotions |
| **E-Commerce** | Cart, wishlist, coupons, guest checkout, tax calculation, PDF invoices |
| **Payments** | Paystack, Flutterwave, Stripe, bank transfer with proof upload |
| **Customer Accounts** | Order history, order tracking, notifications, loyalty points |
| **Interior Design** | Consultation booking, designer selection, room photo/floor plan uploads |
| **Content** | Blog, FAQs, portfolio projects, about/contact/terms/privacy pages |
| **Admin Panel** | Product/collection/order management, review moderation, marketing tools, inventory, finance, analytics, security logs |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4 + DaisyUI 5, Zustand 5, Framer Motion 12, React Router 7 |
| **Backend** | Node.js, Express 4, ES Modules |
| **Database** | MongoDB with Mongoose 8 |
| **Auth** | JWT (HTTP-only cookies), bcryptjs |
| **Payments** | Paystack, Flutterwave, Stripe |
| **Storage** | Cloudinary (images), pdfkit (documents) |
| **Email** | Gmail API via googleapis + Nodemailer |
| **Testing** | Jest (backend, 72 tests), Vitest (frontend, 43 tests) — 115 total, 100% pass |

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Backend controllers | 25 |
| Mongoose models | 20 |
| Backend middleware | 7 |
| REST API routes | 27 files, ~120 endpoints |
| Frontend Zustand stores | 15 |
| Frontend pages | 35+ |
| Admin roles | 5 (super_admin, admin, editor, support, social_media_manager) |
| Permissions | 14 granular permission keys |
| Rate limiter presets | 6 (wired to all routes) |

---

## Repo Structure

```
em_furniture_and_interior/
├── package.json          # Root — build + start scripts
├── FEATURES.md           # Full feature list
├── FEATURES_PLAN.md      # Implemented features by phase
├── context/              # ← You are here
├── backend/
│   ├── src/
│   │   ├── index.js          # Express entry point
│   │   ├── controllers/      # 25 controllers
│   │   ├── models/           # 20 Mongoose models
│   │   ├── routes/           # 27 route files
│   │   ├── middleware/       # 7 middleware modules
│   │   ├── lib/              # DB, Cloudinary, utils, permissions, invoices
│   │   ├── services/         # Gmail service
│   │   └── seed/             # Database seeder
│   └── __tests__/            # Jest integration tests
└── frontend/
    ├── src/
    │   ├── App.jsx           # Route definitions (40+ routes)
    │   ├── pages/            # 35+ page components
    │   ├── components/       # Shared + admin components
    │   ├── store/            # 15 Zustand stores
    │   └── lib/              # Axios, animations, permissions
    └── public/               # Static assets
```

---

## License

Proprietary — PixelsPulse © 2025. All rights reserved.
