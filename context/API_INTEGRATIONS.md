# API Integrations

> External services and third-party APIs used by EM Furniture and Interior.

---

## Payment Gateways

### Paystack

| Property | Value |
|----------|-------|
| Purpose | Primary Nigerian payment gateway |
| Flow | Server-side initialization → hosted checkout → server-side verification |
| Endpoints | `POST /api/payments/paystack/initialize`, `GET /api/payments/paystack/verify` |
| Package | Direct HTTP calls (Paystack REST API) |
| Config | `PAYSTACK_SECRET_KEY` environment variable |
| Docs | https://paystack.com/docs/api |

### Flutterwave

| Property | Value |
|----------|-------|
| Purpose | Alternative Nigerian payment gateway |
| Flow | Server-side initialization → hosted checkout → server-side verification |
| Endpoints | `POST /api/payments/flutterwave/initialize`, `GET /api/payments/flutterwave/verify` |
| Package | Direct HTTP calls (Flutterwave REST API) |
| Config | `FLUTTERWAVE_SECRET_KEY` environment variable |
| Docs | https://developer.flutterwave.com/docs |

### Stripe

| Property | Value |
|----------|-------|
| Purpose | International payment gateway |
| Flow | Server-side session creation → hosted checkout → server-side verification |
| Endpoints | `POST /api/payments/stripe/initialize`, `GET /api/payments/stripe/verify` |
| Package | Stripe Node.js SDK (implied) |
| Config | `STRIPE_SECRET_KEY` environment variable |
| Docs | https://stripe.com/docs/api |

### Bank Transfer (Manual)

| Property | Value |
|----------|-------|
| Purpose | Manual payment for customers preferring direct bank transfer |
| Flow | Customer uploads proof of payment → admin verifies manually |
| Endpoint | `POST /api/payments/bank-transfer/proof` |
| Storage | Proof image uploaded to Cloudinary |

---

## Image & Media Storage

### Cloudinary

| Property | Value |
|----------|-------|
| Purpose | Image upload, hosting, and transformation |
| Usage | Product images, collection covers, consultation room photos, floor plans, designer avatars, bank transfer proofs, project images, blog cover images, promo banners |
| Package | `cloudinary` v2.7.0 |
| Config | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Wrapper | `backend/src/lib/cloudinary.js` |
| Docs | https://cloudinary.com/documentation |

---

## Email

### Gmail API (via Google OAuth)

| Property | Value |
|----------|-------|
| Purpose | Send transactional emails (contact form, password reset) |
| Package | `googleapis` v160.0.0, `nodemailer` v7.0.5 |
| Flow | OAuth2 client → Gmail API transport → Nodemailer send |
| Service | `backend/src/services/gmail.service.js` |
| Config | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER` |
| Docs | https://developers.google.com/gmail/api |

---

## Maps

### Google Maps Embed API

| Property | Value |
|----------|-------|
| Purpose | Display showroom location on the Showroom page |
| Usage | Embedded iframe with coordinates for physical store location |
| Config | `VITE_GOOGLE_MAPS_API_KEY` (frontend env variable) |
| Page | `/showroom` route |
| Docs | https://developers.google.com/maps/documentation/embed |

---

## Rich Text Editing

### TinyMCE

| Property | Value |
|----------|-------|
| Purpose | Rich text editor for blog post creation/editing (admin) |
| Package | `@tinymce/tinymce-react` v6.2.1 |
| Usage | Admin blog management (AddProductPage also uses for descriptions) |
| Config | Inline — no API key required for self-hosted |

---

## PDF Generation

### pdfkit

| Property | Value |
|----------|-------|
| Purpose | Generate invoice, receipt, and quotation PDFs |
| Package | `pdfkit` v0.17.2 |
| Wrapper | `backend/src/lib/invoiceGenerator.js` |
| Endpoints | `/api/orders/:orderId/invoice`, `/api/orders/:orderId/receipt`, `/api/orders/:orderId/quotation` |

---

## Communication

### WhatsApp (Deep Links)

| Property | Value |
|----------|-------|
| Purpose | Quick customer communication via floating button |
| Implementation | Frontend `wa.me` deep link with pre-filled message |
| Config | Phone number hardcoded in `App.jsx` |
| No backend | Pure client-side integration |

---

## Authentication

### JSON Web Tokens (JWT)

| Property | Value |
|----------|-------|
| Purpose | Stateless authentication for users and admins |
| Package | `jsonwebtoken` v9.0.2 |
| Storage | HTTP-only cookies |
| Config | `JWT_SECRET` environment variable |

### bcryptjs

| Property | Value |
|----------|-------|
| Purpose | Password hashing |
| Package | `bcryptjs` v3.0.2 |

---

## Frontend Libraries (Key Integrations)

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.1.0 | UI framework |
| React Router DOM | 7.6.3 | Client-side routing |
| Zustand | 5.0.6 | State management |
| Axios | 1.10.0 | HTTP client |
| Framer Motion | 12.20.1 | Page/component animations |
| Tailwind CSS | 4.1.11 | Utility-first CSS |
| DaisyUI | 5.0.43 | Tailwind component library |
| Lucide React | — | Icon library |
| js-cookie | 3.0.5 | Cookie management (consent, anonymousId) |
| react-hot-toast | 2.5.2 | Toast notifications |

---

## Environment Variables Summary

### Backend (`.env`)

| Variable | Service |
|----------|---------|
| `MONGODB_URI` | MongoDB connection |
| `JWT_SECRET` | JWT signing |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary |
| `CLOUDINARY_API_KEY` | Cloudinary |
| `CLOUDINARY_API_SECRET` | Cloudinary |
| `PAYSTACK_SECRET_KEY` | Paystack |
| `FLUTTERWAVE_SECRET_KEY` | Flutterwave |
| `STRIPE_SECRET_KEY` | Stripe |
| `GMAIL_CLIENT_ID` | Gmail API |
| `GMAIL_CLIENT_SECRET` | Gmail API |
| `GMAIL_REFRESH_TOKEN` | Gmail API |
| `GMAIL_USER` | Gmail API |
| `NODE_ENV` | Environment mode |
| `PORT` | Server port (default 5000) |

### Frontend (`.env`)

| Variable | Service |
|----------|---------|
| `VITE_BACKEND_URL` | API base URL |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps Embed |
