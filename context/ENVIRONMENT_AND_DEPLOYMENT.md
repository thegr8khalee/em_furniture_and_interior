# Environment & Deployment

> How to run, configure, build, and deploy the application.
> Sources: root `package.json`, `backend/package.json`, `frontend/package.json`,
> `backend/.env.example`, `backend/src/index.js`.

---

## 1. Repository Shape

A single repository containing two npm workspaces-by-convention (not npm workspaces proper):

```
em_furniture_and_interior/
├── package.json      # Orchestrator — delegates via --prefix
├── backend/          # Express + MongoDB API
├── frontend/         # React + Vite SPA
└── context/          # This knowledge base
```

Both `backend` and `frontend` declare a `file:..` dependency on the root package. This is a
self-reference used to make the root scripts resolvable; it is not a shared library.

---

## 2. Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js | LTS; both packages are `"type": "module"` (ES Modules throughout) |
| MongoDB | Local instance or Atlas connection string |
| Cloudinary account | Image hosting for products, collections, projects |
| Google OAuth2 credentials | Gmail API for transactional email |
| Payment gateway keys | Paystack (primary), Flutterwave, Stripe |
| Chromium | Installed automatically by Puppeteer's `postinstall` — needed for PDF generation |

---

## 3. Scripts

### Root (`package.json`)

| Script | Command | Effect |
|--------|---------|--------|
| `npm run dev` | `npm run dev --prefix backend & npm run dev --prefix frontend` | Both dev servers, backgrounded backend |
| `npm run build` | installs both, then `npm run build --prefix frontend` | Production build (the deploy build command) |
| `npm start` | `npm run start --prefix backend` | Production server (also serves the built SPA) |

### Backend

| Script | Command |
|--------|---------|
| `dev` | `nodemon ./src/index.js` |
| `start` | `node src/index.js` |
| `seed` | `node src/seed/seed.js` — seeds an admin and sample data |
| `test` | `cross-env NODE_OPTIONS=--experimental-vm-modules jest` |
| `postinstall` | `node node_modules/puppeteer/install.mjs` — fetches Chromium |

### Frontend

| Script | Command |
|--------|---------|
| `dev` | `vite` (default port 5173) |
| `build` | `vite build` → `frontend/dist` |
| `preview` | `vite preview` |
| `lint` | `eslint .` |
| `test` / `test:ui` / `test:coverage` | Vitest |

---

## 4. Backend Environment Variables

Copy `backend/.env.example` to `backend/.env`. Loaded via `dotenv` **only when
`NODE_ENV !== 'production'`** — in production the platform must inject real env vars.

| Group | Variable | Notes |
|-------|----------|-------|
| App | `NODE_ENV` | `development` \| `production`; switches CORS, dotenv, static serving |
| App | `PORT` | Default `5000` |
| App | `FRONTEND_URL` | The single allowed CORS origin in production |
| Database | `MONGODB_URI` | e.g. `mongodb://localhost:27017/em_furniture` |
| Auth | `JWT_SECRET` | Must be a strong random string |
| Images | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | |
| Email | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `EMAIL_USER` | Gmail OAuth2 sending |
| Payments | `PAYSTACK_SECRET_KEY` | |
| Payments | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_CURRENCY` | Currency defaults to `NGN` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_CURRENCY` | Currency defaults to `NGN` |
| Tax | `TAX_RATE_PERCENTAGE` | Default `7.5` (Nigerian VAT) |
| Seed | `SEED_ADMIN_PASSWORD` | Used by `npm run seed` |

---

## 5. Frontend Environment Variables

The frontend reads almost nothing from the environment — the API base URL is derived from
Vite's mode rather than a variable.

| Variable | Used by | Notes |
|----------|---------|-------|
| `VITE_REACT_APP_GOOGLE_MAPS_API_KEY` | `pages/Showroom.jsx` | Google Maps Embed API key |

```js
// lib/axios.js
baseURL: import.meta.env.MODE === 'development' ? 'http://localhost:5000/api' : '/api'
withCredentials: true
```

**Caveat:** the root `README.md` documents `VITE_BACKEND_URL` and `VITE_GOOGLE_MAPS_API_KEY`.
Neither name is read by the current code — the real name is
`VITE_REACT_APP_GOOGLE_MAPS_API_KEY`, and there is no backend-URL variable at all.
Trust this document over the root README on env names.

---

## 6. Server Bootstrap Order (`backend/src/index.js`)

1. `dotenv.config()` — non-production only.
2. `app.set('trust proxy', 1)` — required by `express-rate-limit` behind a PaaS TLS terminator.
3. **Helmet** with an explicit CSP:
   - `defaultSrc 'self'`; `scriptSrc 'self' 'unsafe-inline'`
   - `styleSrc` + `fontSrc` allow Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`)
   - `imgSrc` allows `data:`, `blob:`, `res.cloudinary.com`, `placehold.co`
   - `connectSrc 'self'`
4. `compression()`, `cookieParser()`.
5. Body parsing at **1mb** globally.
6. **CORS** — production: single origin from `FRONTEND_URL` (fallback `https://emfurniture.com`),
   `credentials: true`, exposing `Content-Disposition` (needed for PDF/invoice downloads).
   Development: `origin: true` (reflect any origin).
7. **50mb** body limit re-applied to the base64-upload routes: `/api/admin`, `/api/consultations`,
   `/api/designers`, `/api/payments`.
8. `apiLimiter` applied to all of `/api`.
9. Route mounting (see below).
10. `sitemapRoutes` mounted at `/` — serves `sitemap.xml` and `robots.txt` at the site root.
11. Swagger UI via `setupSwagger(app)`.
12. `app.all('/api/*')` 404 JSON handler — **after** all API routes.
13. In production, static `frontend/dist` + an `app.get('*')` SPA fallback to `index.html`.
14. Global error handler — logs the error, returns a generic `Internal server error`.
15. `startServer()` — `await connectDB()` **before** `listen`, then `SIGTERM`/`SIGINT` graceful shutdown.

Note the ordering constraint: the API 404 handler must stay above the SPA catch-all, or every
mistyped API path would return the HTML shell.

---

## 7. API Mount Points

| Mount | Router |
|-------|--------|
| `/api/auth` | auth | `/api/guestAuth` | guest |
| `/api/admin` | admin | `/api/admin/blog`, `/api/admin/faqs` | admin content |
| `/api/products`, `/api/collections`, `/api/review` | catalogue |
| `/api/cart`, `/api/wishlist`, `/api/orders`, `/api/coupons` | commerce |
| `/api/payments`, `/api/taxes`, `/api/finance` | money |
| `/api/projects`, `/api/blog`, `/api/faqs`, `/api/designers` | content |
| `/api/consultations`, `/api/contact` | enquiries |
| `/api/marketing`, `/api/inventory`, `/api/analytics`, `/api/logs` | operations |
| `/api/notifications`, `/api/loyalty` | engagement |
| `/` | sitemap + robots |

Full endpoint contract: `ARCHITECTURE/API_REFERENCE.md`. Live docs: Swagger UI, generated from
`backend/src/swagger.js` with a static spec at `backend/docs/swagger.json` and a Postman
collection at `backend/docs/EM_Furniture_API.postman_collection.json`.

---

## 8. Rate Limits (`middleware/rateLimiter.js`)

| Limiter | Window | Max | Applied to |
|---------|--------|-----|-----------|
| `apiLimiter` | 15 min | 100 | All of `/api` |
| `authLimiter` | 15 min | 5 | Login / signup |
| `passwordResetLimiter` | 1 hour | 3 | Password reset requests |
| `createLimiter` | 1 hour | 20 | Resource creation |
| `exportLimiter` | 1 hour | 5 | Report/data exports |
| `searchLimiter` | 1 min | 30 | Search endpoints |

---

## 9. Local Development

```bash
git clone https://github.com/thegr8khalee/em_furniture_and_interior.git
cd em_furniture_and_interior

npm install --prefix backend      # runs puppeteer postinstall (downloads Chromium)
npm install --prefix frontend

cp backend/.env.example backend/.env   # then fill in real values
npm run seed --prefix backend          # optional: seed an admin + sample data

npm run dev                            # backend :5000, frontend :5173
```

The SPA talks to `http://localhost:5000/api` in dev; CORS reflects any origin, and cookies flow
because `withCredentials` is set on the client and `credentials: true` on the server.

---

## 10. Production Deployment

The app deploys as a **single service**: Express serves both the API and the built SPA.

| Setting | Value |
|---------|-------|
| Build command | `npm run build` (installs both packages, builds the frontend) |
| Start command | `npm start` (`node backend/src/index.js`) |
| Static root | `frontend/dist`, served by Express when `NODE_ENV=production` |
| SPA fallback | `app.get('*')` → `frontend/dist/index.html` |
| Required env | `NODE_ENV=production`, plus every backend variable in §4 |
| Proxy | `trust proxy` is set to `1` — one hop (PaaS load balancer) |

Deployment checklist:

1. `NODE_ENV=production` — without it, dotenv loads, CORS opens to all origins, and the SPA is not served.
2. `FRONTEND_URL` must exactly match the public origin, or the browser will block credentialed requests.
3. `JWT_SECRET` rotated away from the example value.
4. Puppeteer's Chromium must be available in the runtime image — PDF generation
   (quotations, invoices, receipts) fails without it. See `backend/.puppeteerrc.cjs`.
5. `MONGODB_URI` pointed at the production cluster with the deploy IP allow-listed.
6. Verify `/sitemap.xml` and `/robots.txt` resolve at the site root.

---

## 11. Testing

| Suite | Runner | Location |
|-------|--------|----------|
| Backend integration | Jest + Supertest (ESM via `--experimental-vm-modules`) | `backend/__tests__/integration/{core,features,payments}.test.js`, fixtures in `__tests__/helpers/mockData.js` |
| Frontend | Vitest + React Testing Library, jsdom | `frontend/src/__tests__/` |
| Coverage | v8 provider — text, json, html | excludes `node_modules`, `__tests__`, `*.config.js`, `main.jsx` |
| Manual QA | See `BROWSER_TESTING_GUIDE.md` | |

Detailed testing notes live in `backend/TESTING.md` and `frontend/TESTING.md`.

**Alias caveat:** `vitest.config.js` maps `@` → `./src`, but `vite.config.js` does **not**.
An `@/…` import will pass tests and fail the production build. Use relative imports, or add the
alias to `vite.config.js` first.
