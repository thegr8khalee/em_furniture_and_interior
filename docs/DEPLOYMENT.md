# Production Deployment Guide

EM Furniture & Interior is architected as an npm workspaces monorepo containing three production deployables:

| Deployable | Workspace | Hosting Target | Description |
| :--- | :--- | :--- | :--- |
| **Backend API** | `apps/api` | **Render** (Web Service or Blueprint) | Node.js Express REST API & PDF engine |
| **Storefront** | `apps/web` | **Vercel** (Project 1) | Public customer-facing e-commerce SPA |
| **Operations Console** | `apps/erp` | **Vercel** (Project 2) | Protected administrative & ERP portal |

Internal packages (`packages/shared`, `packages/domain`, `packages/ui`, `packages/config`) are linked automatically into `node_modules/@em/*` via workspace resolution.

---

## 1. Backend API Deployment on Render (`apps/api`)

You can deploy the API to Render in one of two ways: using the automated **Render Blueprint (`render.yaml`)** or by manually creating a **Web Service**.

### Option A: 1-Click Blueprint (Recommended)

1. Push this repository to GitHub/GitLab.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Select your repository. Render will automatically detect [`render.yaml`](file:///c:/Users/USER/em_furniture_and_interior/em_furniture_and_interior/render.yaml) at the root.
4. Render will prompt you to enter the required secrets (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `STOREFRONT_URL`, `ERP_URL`, `PAYSTACK_SECRET_KEY`, etc.).
5. Click **Apply**. Render will provision and launch the service with health checks and auto-migrations enabled.

### Option B: Manual Web Service Setup

1. In the Render Dashboard, click **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the following settings:
   - **Name**: `em-furniture-api`
   - **Region**: Frankfurt (or nearest to your PostgreSQL database)
   - **Root Directory**: *(leave blank — repository root is required for monorepo workspaces)*
   - **Environment / Runtime**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run start:prod`
     *(This runs pending database migrations before starting the Express server)*
   - **Health Check Path**: `/healthz`
     *(Use `/healthz` for process liveness; do not use `/readyz` as liveness checks)*

### Option C: Docker Container on Render

If you prefer containerized deployment with bundled Chromium and system libraries, Render supports deploying via Docker:
- Set **Runtime** to `Docker`
- Set **DockerfilePath** to `./Dockerfile`
- The bundled multi-stage Dockerfile includes pre-configured Chromium, non-root `node` user, and `dumb-init` signal handling.

---

### Backend Environment Variables (Render)

Configure these in the Render Dashboard under **Environment**:

| Variable | Required | Example / Description |
| :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Set automatically by Render (default `10000`) |
| `DATABASE_URL` | Yes | `postgres://...:6543/postgres?sslmode=require` (Pooled connection) |
| `DIRECT_DATABASE_URL` | Yes | `postgres://...:5432/postgres?sslmode=require` (Direct connection for migrations) |
| `DB_POOL_MAX` | No | `10` (Max database pool size) |
| `JWT_SECRET` | Yes | Strong random secret (auto-generated in Blueprint) |
| `STOREFRONT_URL` | Yes | `https://emfurniture.ng` or `https://your-storefront.vercel.app` |
| `ERP_URL` | Yes | `https://erp.emfurniture.ng` or `https://your-erp.vercel.app` |
| `FRONTEND_URL` | Yes | Same as `STOREFRONT_URL` (used for payment redirect callbacks) |
| `ALLOWED_ORIGINS` | No | Comma-separated extra origins (e.g. `https://custom.com,https://preview.com`) |
| `COOKIE_DOMAIN` | Recommended | `.emfurniture.ng` (when using custom root domain for apex & subdomains) |
| `ALLOW_VERCEL_PREVIEWS` | No | `true` to allow Vercel PR branch preview deployments (`*.vercel.app`) |
| `PAYSTACK_SECRET_KEY` | Yes | `sk_live_...` (Also validates webhook HMAC signatures) |
| `CLOUDINARY_CLOUD_NAME`| Yes | Cloudinary cloud identifier for product & media uploads |
| `CLOUDINARY_API_KEY`   | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET`| Yes | Cloudinary API secret |
| `EMAIL_USER`           | No  | `emfurnitureandinterior@gmail.com` |
| `GOOGLE_CLIENT_ID`     | No  | Google OAuth2 Client ID for Gmail sending |
| `GOOGLE_CLIENT_SECRET` | No  | Google OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | No  | Gmail OAuth2 Refresh Token |
| `TAX_RATE_PERCENTAGE`  | No  | `7.5` (VAT rate in %) |
| `LOG_LEVEL`            | No  | `info` |
| `LOG_FORMAT`           | No  | `json` |

---

### Initial Staff Account Setup

Once the API and database are running, create the first owner/operator account by running the bootstrap script against the production database:

```bash
# Locally with production credentials in .env:
npm run bootstrap:staff --workspace=@em/api
```
*(Or invoke via the Render **Shell** tab: `npm run bootstrap:staff`)*

### Paystack Webhook Configuration

1. Log into your [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks**.
2. Set the **Live Webhook URL** to:
   ```
   https://<your-render-api-host>/api/payments/paystack/webhook
   ```
3. Ensure `PAYSTACK_SECRET_KEY` in Render matches your Paystack Live Secret Key so HMAC-SHA512 webhook signatures verify correctly.

---

## 2. Frontend Deployments on Vercel (`apps/web` & `apps/erp`)

Deploy both applications as **two separate projects** in Vercel pointing to the same Git repository.

### Project 1: Storefront (`apps/web`)

1. In [Vercel Dashboard](https://vercel.com/), click **Add New...** → **Project**.
2. Select your repository.
3. Configure the project:
   - **Project Name**: `em-furniture-storefront`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`apps/web`**
   - **Build Command**: Defaults to `vite build` (or leave default with `apps/web/vercel.json`)
   - **Output Directory**: Defaults to `dist`
4. **Environment Variables**:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://<your-render-api-host>/api` |
   | `VITE_ERP_URL` | `https://<your-erp-vercel-host>/admin/dashboard` |
   | `VITE_REACT_APP_GOOGLE_MAPS_API_KEY` | *(Optional: Google Maps Embed Key)* |
   | `VITE_SUPABASE_URL` | *(Optional: Supabase Project URL)* |
   | `VITE_SUPABASE_ANON_KEY` | *(Optional: Supabase Anon Key)* |
5. Click **Deploy**.
   *Note: `apps/web/vercel.json` automatically configures SPA routing rewrites to `/index.html` and 1-year immutable caching for `/assets/*`.*

---

### Project 2: Operations Console ERP (`apps/erp`)

1. In Vercel Dashboard, click **Add New...** → **Project** again.
2. Select the same repository.
3. Configure the project:
   - **Project Name**: `em-furniture-erp`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`apps/erp`**
   - **Build Command**: Defaults to `vite build`
   - **Output Directory**: Defaults to `dist`
4. **Environment Variables**:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://<your-render-api-host>/api` |
   | `VITE_STOREFRONT_URL` | `https://<your-storefront-vercel-host>` |
   | `VITE_SUPABASE_URL` | *(Optional: Supabase Project URL)* |
   | `VITE_SUPABASE_ANON_KEY` | *(Optional: Supabase Anon Key)* |
5. Click **Deploy**.
   *Note: `apps/erp/vercel.json` includes `X-Robots-Tag: noindex, nofollow` and SPA rewrites.*

> [!TIP]
> **Recommended ERP Console Protection**:
> In Vercel Project Settings for `em-furniture-erp` → **Deployment Protection**, enable **Vercel Authentication** or **Password Protection** to restrict external public access to your internal operations portal.

---

## 3. Domain Topology & First-Party Authentication Cookies

Both frontends use `withCredentials: true` and the backend uses `httpOnly` secure cookies for authentication.

### Modern Browser Third-Party Cookie Policy
If you run on default free subdomains (e.g. `store.vercel.app` calling `api.onrender.com`), browsers treat the cookies as **third-party cookies**, which are blocked by default in Safari and restricted in Chrome.

### Solution: Unified Parent Custom Domain
Configure custom domains under one root domain:

```
emfurniture.ng           ──► Vercel (apps/web Storefront)
erp.emfurniture.ng       ──► Vercel (apps/erp Console)
api.emfurniture.ng       ──► Render (apps/api Web Service)
```

1. In your DNS provider (e.g. Cloudflare, Namecheap):
   - Add `CNAME` or `A` records pointing `emfurniture.ng` to Vercel.
   - Add `CNAME` pointing `erp.emfurniture.ng` to Vercel.
   - Add `CNAME` pointing `api.emfurniture.ng` to Render (`<service-id>.onrender.com`).
2. Set `COOKIE_DOMAIN=.emfurniture.ng` in the Render environment variables.
3. Cookies will now be scoped as **first-party cookies** across all three endpoints with `SameSite=None; Secure`.

---

## 4. Verification & Health Probes

Once deployed, verify the installation:

| Check | URL | Expected Result |
| :--- | :--- | :--- |
| **API Root Status** | `GET https://<api-host>/` | JSON summary with `status: "online"` |
| **API Liveness** | `GET https://<api-host>/healthz` | `{"status":"ok","uptime":...}` |
| **API Readiness** | `GET https://<api-host>/readyz` | `{"status":"ok","database":"connected"}` |
| **API Documentation** | `GET https://<api-host>/api-docs` | Interactive Swagger UI |
| **Storefront Deep Link** | `GET https://<web-host>/products` | 200 OK (Rendered via SPA rewrite) |
| **ERP Deep Link** | `GET https://<erp-host>/admin/dashboard` | 200 OK (Rendered via SPA rewrite) |
| **CORS Validation** | Browser DevTools Network tab | No CORS header errors |
