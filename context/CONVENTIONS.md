# Coding Conventions

> Standards and patterns enforced across the EM Furniture and Interior codebase.

---

## 1. Language & Module System

| Rule | Detail |
|------|--------|
| Module system | **ES Modules** (`import`/`export`) — both backend and frontend |
| Backend runtime | Node.js with `"type": "module"` in package.json |
| Frontend bundler | Vite 7 with React plugin |
| JavaScript standard | ECMAScript 2020+ |
| JSX | Used in all React components |

---

## 2. Architecture Pattern — CSM (Controller-Service-Model)

```
Route  →  Controller  →  Service (optional)  →  Model
  │           │                │                    │
  │     Request handling   Business logic     DB operations
  │     + response format  + external APIs    + schema validation
  │
  Middleware chain (auth, logging, rate limiting)
```

### Layer Responsibilities

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Route** | HTTP method + path + middleware chain | `router.get('/products', getProducts)` |
| **Controller** | Parse request, call service/model, format response | `products.controller.js` |
| **Service** | Business logic, external API calls (optional — not all domains need one) | `gmail.service.js` |
| **Migration** | The schema itself: tables, constraints, triggers | `0004_commerce.sql` |
| **Service** | The rules and the SQL, in a transaction, taking a database handle | `orders.js` |
| **Middleware** | Cross-cutting concerns (auth, logging, rate limiting) | `protectRoute.js` |
| **Lib** | Shared utilities (DB connection, Cloudinary, JWT, permissions) | `lib/utils.js` |

---

## 3. Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Backend controller | `{domain}.controller.js` | `products.controller.js` |
| Backend model | `{domain}.model.js` | `product.model.js` |
| Backend route | `{domain}.routes.js` | `product.routes.js` |
| Backend middleware | `camelCase.js` | `protectRoute.js` |
| Backend lib | `camelCase.js` | `invoiceGenerator.js` |
| Frontend page | `PascalCase.jsx` | `ProductPage.jsx` |
| Frontend component | `PascalCase.jsx` | `Navbar.jsx` |
| Frontend store | `use{Domain}Store.js` | `useProductsStore.js` |
| Frontend lib | `camelCase.js` | `animations.js` |
| Test file | `{domain}.test.js` | `core.test.js` |

### Variables & Functions

| Context | Convention | Example |
|---------|-----------|---------|
| Functions | camelCase | `getProducts`, `addToCart` |
| Tables and columns | snake_case, tables plural | `order_items`, `total_amount` |
| Constants / permissions | SCREAMING_SNAKE_CASE | `PRODUCTS_MANAGE`, `FINANCE_VIEW` |
| Environment variables | SCREAMING_SNAKE_CASE | `JWT_SECRET`, `DATABASE_URL` |
| React components | PascalCase | `<ProductPage />`, `<Navbar />` |
| Zustand store hooks | `use{Domain}Store` | `useAuthStore()` |
| Route paths (backend) | kebab-case | `/api/flash-sales/active` |
| Route paths (frontend) | kebab-case | `/track-order`, `/order-confirmation/:orderId` |

---

## 4. Project Structure Rules

### Backend

```
backend/src/
├── index.js              # Entry point — middleware + route mounting
├── controllers/          # One file per domain
├── db/migrations/        # The schema, one numbered .sql file at a time
├── routes/               # One file per domain (+ admin variants)
├── middleware/            # Cross-cutting concerns
├── lib/                  # Shared utilities
├── services/             # External API integrations
└── seed/                 # Database seeding scripts
```

### Frontend

```
frontend/src/
├── App.jsx               # Route definitions
├── main.jsx              # React DOM render + providers
├── index.css             # Global styles (Tailwind directives)
├── pages/                # One file per route page
│   └── admin/            # Admin-specific pages
├── components/           # Shared + admin components
│   └── admin/            # Admin-specific components
├── store/                # One Zustand store per domain
└── lib/                  # Axios, animations, permissions
```

---

## 5. State Management (Frontend)

| Rule | Detail |
|------|--------|
| Library | Zustand 5 |
| Pattern | One store per domain (`useAuthStore`, `useCartStore`, etc.) |
| State shape | Flat object with `{ data, isLoading, error }` pattern |
| Async actions | Defined inside `create((set, get) => ({ ... }))` |
| Persistence | localStorage (with cookie consent) or sessionStorage (default) |
| API calls | Via Axios instance (`lib/axios.js`) inside store actions |

---

## 6. Styling

| Rule | Detail |
|------|--------|
| Framework | Tailwind CSS 4 + DaisyUI 5 |
| Approach | Utility-first classes in JSX |
| Theme | DaisyUI theme system |
| Animations | Framer Motion 12 with shared presets (`lib/animations.js`) |
| Icons | Lucide React |
| Responsive | Mobile-first breakpoints (`sm:`, `md:`, `lg:`, `xl:`) |

---

## 7. Authentication & Authorization

### User Auth

| Step | Implementation |
|------|---------------|
| Signup/Login | bcryptjs hash → JWT issued → HTTP-only cookie |
| Session check | `GET /api/auth/check` on app mount |
| Protected routes | `protectRoute` middleware verifies JWT, loads `req.user` |
| Password reset | Token-based flow via email |

### Admin Auth

| Step | Implementation |
|------|---------------|
| Login | Separate JWT with `role: 'admin'` claim |
| Route protection | `protectAdminRoute` middleware + `requirePermissions([...])` |
| Roles | `super_admin`, `admin`, `editor`, `support`, `social_media_manager` |
| Permissions | 14 keys (e.g., `products.manage`, `finance.view`) |
| Resolution | `super_admin` gets all; others get role defaults or explicit overrides |

### Guest Sessions

| Step | Implementation |
|------|---------------|
| Identification | `identifyGuest` middleware checks JWT first, then `anonymousId` cookie |
| Storage | A `guest_sessions` row. Expired by a job rather than a TTL index — Postgres has none, so the statement lives in the migration |
| Capabilities | Cart, wishlist, checkout, order placement |
| Merge | Guest data merges into user account on signup |

---

## 8. API Conventions

| Rule | Detail |
|------|--------|
| Base path | `/api/{domain}` |
| Auth header | JWT via HTTP-only cookie (not Bearer header) |
| Response format | `{ success: true, data: ... }` or `{ message: "error" }` |
| Pagination | Query params: `page`, `limit` |
| Filtering | Query params domain-specific: `search`, `category`, `style`, `priceMin`, `priceMax`, `rating` |
| Admin prefix | `/api/admin/...` or `/api/{domain}/admin/...` |
| Error codes | Standard HTTP (400, 401, 403, 404, 500) |
| Rate limiting | All `/api` routes protected by rate limiters appropriate to their function (see Backend Architecture for wiring details) |

---

## 9. Testing

| Aspect | Backend | Frontend |
|--------|---------|----------|
| Framework | Jest (ESM with `--experimental-vm-modules`) | Vitest + React Testing Library |
| Environment | Node | jsdom |
| Test location | `__tests__/integration/` | `src/__tests__/` |
| Mocking | Cloudinary, the payment gateways and outbound email only — the database is real | Vitest mocks |
| Coverage | Collected (excludes seed, index, tests) | v8 provider (text, json, html) |
| Test count | 72 (3 suites) | 43 (1 suite) |
| Status | ✅ All passing | ✅ All passing |

---

## 10. Git & Environment

| Rule | Detail |
|------|--------|
| `.env` files | Never committed — use `.env.example` as template |
| CORS | Environment-aware — `localhost:5173` in dev, configured origin in prod |
| Static serving | Frontend `dist/` served by Express in production |
| Dev servers | `npm run dev` in both `/backend` and `/frontend` |

---

## 11. Code Quality

| Tool | Config |
|------|--------|
| ESLint | v9.29 with React Hooks + React Refresh plugins |
| Unused vars | Warning level (ignores `^` and `A-Z` patterns) |
| Formatting | Tailwind class sorting via plugin (frontend) |
