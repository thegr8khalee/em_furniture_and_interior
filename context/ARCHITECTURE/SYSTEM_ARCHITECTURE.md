# System Architecture

> The topology, as it stands. The data model is in
> [`docs/SCHEMA.md`](../../docs/SCHEMA.md); the API's internals are in
> [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md).

> High-level topology and integration map for EM Furniture and Interior.

---

## 1. Architecture Overview

EM Furniture and Interior is a **modular monolith**: one Express server
serving every API domain, against one PostgreSQL database, with two React
applications in front of it — the storefront (`apps/web`) and the operations
console (`apps/erp`) — deployed separately and sharing `packages/ui`,
`packages/domain` and `packages/shared`.

The database is PostgreSQL, hosted on Supabase. The API connects through the
pooler in transaction mode for requests, and through a session-mode
connection for migrations, which need one.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                                                              │
│   React SPA (Vite)     Mobile Browser      WhatsApp         │
│   └─ Zustand stores    └─ Responsive UI    └─ Deep links    │
│                                                              │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS (Axios)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
│                                                              │
│   Express.js Server (single process)                         │
│   ├─ CORS middleware                                         │
│   ├─ Cookie parser                                           │
│   ├─ JSON body parser                                        │
│   ├─ Rate limiters (apiLimiter on all /api routes)              │
│   └─ Static file serving (production)                        │
│                                                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE LAYER                           │
│                                                              │
│   ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐     │
│   │ protectRoute │ │protectAdmin  │ │ identifyGuest   │     │
│   │ (user JWT)   │ │Route (+RBAC) │ │ (anon sessions) │     │
│   └─────────────┘ └──────────────┘ └─────────────────┘     │
│   ┌──────────────┐ ┌───────────────┐                        │
│   │ auditLogger  │ │activityTracker│                        │
│   │ (admin ops)  │ │(user actions) │                        │
│   └──────────────┘ └───────────────┘                        │
│                                                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│                                                              │
│   25 Controllers organised by domain:                        │
│   ┌──────────┬──────────┬──────────┬──────────┐            │
│   │  Auth    │ Products │  Orders  │  Admin   │            │
│   │  Guest   │ Collect. │ Payments │ Analytics│            │
│   │  Cart    │ Projects │ Coupons  │ Finance  │            │
│   │  Wishlist│ Blog/FAQ │ Tax      │ Logs     │            │
│   │  Reviews │ Design   │ Loyalty  │ Market.  │            │
│   │  Notif.  │ Email    │ Consult. │ Inventory│            │
│   └──────────┴──────────┴──────────┴──────────┘            │
│                                                              │
└──────┬──────────────────────────────────────┬───────────────┘
       │                                      │
       ▼                                      ▼
┌──────────────┐                   ┌───────────────────────┐
│   DATA LAYER │                   │  EXTERNAL SERVICES    │
│              │                   │                       │
│  PostgreSQL     │                   │  Cloudinary (images)  │
│  └─ Sequelize │                   │  Paystack (payments)  │
│  └─ 20 models│                   │  Flutterwave (pay.)   │
│  └─ Embedded │                   │  Stripe (payments)    │
│    documents │                   │  Gmail API (email)    │
│  └─ TTL idx  │                   │  Google Maps (embed)  │
│              │                   │  pdfkit (local PDFs)  │
└──────────────┘                   └───────────────────────┘
```

---

## 2. Request Flow

### Authenticated User Request

```
Browser → Cookie (JWT) → Express
  → protectRoute (verify JWT, load user)
  → activityTracker (fire-and-forget user action logging)
  → Controller (business logic)
  → Model (PostgreSQL query)
  → Response (JSON)
```

### Admin Request

```
Browser → Cookie (admin JWT) → Express
  → protectAdminRoute (verify JWT, check role, resolve permissions)
  → requirePermissions([...]) (check specific permissions)
  → auditLogger (intercept response for logging)
  → Controller (business logic)
  → Model (PostgreSQL query)
  → Response (JSON) → auditLogger captures result
```

### Guest Request

```
Browser → Cookie (anonymousId) → Express
  → identifyGuest (check JWT first, then anonymousId → load/create GuestSession)
  → Controller (business logic with req.guestSession)
  → Model (PostgreSQL query)
  → Response (JSON)
```

---

## 3. Data Flow

### Cart Update Flow

```
Frontend (Zustand useCartStore)
  → PUT /api/cart/add { itemId, itemType, quantity }
  → identifyGuest middleware (user or guest)
  → protectRoute middleware (verify auth)
  → cartController.addToCart
  → User.findById / GuestSession.findOne
  → Update embedded cart array
  → Return updated cart
  → Zustand updates local state
  → localStorage/sessionStorage sync
```

### Payment Flow

```
Frontend (CheckoutPage)
  → POST /api/payments/paystack/initialize { orderId, email, amount }
  → identifyGuest middleware
  → paymentsController.initializePaystackPayment
  → Paystack API → authorization_url
  → Frontend redirects to Paystack
  → Customer pays on Paystack
  → Paystack redirects to /payment/verify?reference=...
  → GET /api/payments/paystack/verify?reference=...
  → Verify with Paystack API
  → Update PaymentTransaction + Order status
  → Frontend shows OrderConfirmationPage
```

---

## 4. Deployment Topology

### Development

```
┌─────────────────────┐    ┌─────────────────────┐
│ Vite Dev Server     │    │ Express Dev Server   │
│ localhost:5173      │───►│ localhost:5000       │
│ (hot reload)        │    │ (nodemon)            │
└─────────────────────┘    └─────────┬────────────┘
                                     │
                              ┌──────▼──────┐
                              │  PostgreSQL    │
                              │ (local/Atlas)│
                              └─────────────┘
```

### Production

```
┌─────────────────────────────────────────┐
│          Express Server (PORT)           │
│                                          │
│  /api/*  → API routes                   │
│  /*      → frontend/dist/index.html     │
│          (static file serving)           │
└──────────────────┬──────────────────────┘
                   │
            ┌──────▼──────┐
            │ PostgreSQL│
            └─────────────┘
```

---

## 5. Security Layers

```
┌─ TRANSPORT ──────────────────────────────────┐
│  HTTPS (in production)                        │
│  CORS (origin-restricted)                     │
├─ AUTHENTICATION ─────────────────────────────┤
│  JWT in HTTP-only cookies (not localStorage)  │
│  bcryptjs password hashing (salt rounds)      │
│  Separate user/admin auth flows               │
├─ AUTHORIZATION ──────────────────────────────┤
│  protectRoute (user verification)             │
│  protectAdminRoute (admin + role check)       │
│  requirePermissions (granular RBAC)           │
│  identifyGuest (anonymous session handling)   │
├─ MONITORING ─────────────────────────────────┤
│  auditLogger (admin action trail)             │
│  activityTracker (user behaviour)             │
│  Rate limiters (fully wired to all route categories)  │
├─ DATA ───────────────────────────────────────┤
│  Sequelize schema validation                   │
│  Input sanitisation via Express middleware     │
│  TTL indexes for auto-expiration              │
└──────────────────────────────────────────────┘
```

---

## 6. Integration Map

| External Service | Protocol | Direction | Auth Method |
|-----------------|----------|-----------|-------------|
| PostgreSQL | TCP/TLS | Bidirectional | Connection string |
| Cloudinary | HTTPS REST | Outbound | API key + secret |
| Paystack | HTTPS REST | Outbound + redirect | Secret key |
| Flutterwave | HTTPS REST | Outbound + redirect | Secret key |
| Stripe | HTTPS REST | Outbound + redirect | Secret key |
| Gmail API | HTTPS REST | Outbound | OAuth2 (client ID + secret + refresh token) |
| Google Maps | HTTPS iframe | Frontend embed | API key (restricted) |
