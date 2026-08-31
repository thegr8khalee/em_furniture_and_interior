# Security & Permissions

> Identity, roles, the permission matrix, middleware chain, and auditing.
> Sources: `backend/src/lib/permissions.js`, `backend/src/middleware/`, `backend/src/models/admin.model.js`,
> `frontend/src/lib/permissions.js`, `frontend/src/store/useAuthStore.js`.

---

## 1. Three Identities

| Identity | Established by | Carried as | Model |
|----------|---------------|-----------|-------|
| **Guest** | First request without a session | `anonymousId` cookie (UUID v4) | `guest.model.js` |
| **User** | Signup / login | `jwt` HTTP-only cookie | `user.model.js` |
| **Admin** | Admin login | `jwt` HTTP-only cookie with `role: 'admin'` in the payload | `admin.model.js` |

Guests are first-class: cart, wishlist, compare, checkout, and order tracking all work without an
account. `identifyGuest` resolves the JWT to a `User` when present and otherwise mints or reuses a
`GuestSession` keyed by `anonymousId`. An invalid or expired JWT is cleared
(`httpOnly`, `secure` in production, `sameSite: 'Lax'`) and the request degrades to a guest.

---

## 2. Admin Roles

`admin.model.js` — `role` is a required enum, defaulting to `admin`:

| Role | Intent |
|------|--------|
| `super_admin` | Everything, always — computed, never stored |
| `admin` | Full operational access |
| `editor` | Content only |
| `support` | Read-only dashboard |
| `social_media_manager` | Blog only |

Admins also carry a `permissions: [String]` array (default `[]`) for per-account overrides.

---

## 3. Permission Catalogue

Fourteen permissions, defined identically in `backend/src/lib/permissions.js` and
`frontend/src/lib/permissions.js`. **These two files must be kept in sync by hand** — there is no
shared package and no test enforcing parity.

| Constant | Value |
|----------|-------|
| `ADMIN_DASHBOARD_VIEW` | `admin.dashboard.view` |
| `PRODUCTS_MANAGE` | `products.manage` |
| `COLLECTIONS_MANAGE` | `collections.manage` |
| `PROJECTS_MANAGE` | `projects.manage` |
| `BLOG_MANAGE` | `blog.manage` |
| `FAQ_MANAGE` | `faq.manage` |
| `MARKETING_MANAGE` | `marketing.manage` |
| `ORDERS_VIEW` | `orders.view` |
| `ORDERS_MANAGE` | `orders.manage` |
| `REVIEWS_MANAGE` | `reviews.manage` |
| `CONSULTATIONS_MANAGE` | `consultations.manage` |
| `DESIGNERS_MANAGE` | `designers.manage` |
| `INVENTORY_MANAGE` | `inventory.manage` |
| `FINANCE_VIEW` | `finance.view` |

---

## 4. Role → Permission Matrix

| Permission | super_admin | admin | editor | support | social_media_manager |
|---|:---:|:---:|:---:|:---:|:---:|
| `admin.dashboard.view` | ✅ | ✅ | — | ✅ | — |
| `products.manage` | ✅ | ✅ | — | — | — |
| `collections.manage` | ✅ | ✅ | — | — | — |
| `projects.manage` | ✅ | ✅ | — | — | — |
| `blog.manage` | ✅ | ✅ | ✅ | — | ✅ |
| `faq.manage` | ✅ | ✅ | ✅ | — | — |
| `marketing.manage` | ✅ | ✅ | — | — | — |
| `orders.view` | ✅ | ✅ | — | — | — |
| `orders.manage` | ✅ | ✅ | — | — | — |
| `reviews.manage` | ✅ | ✅ | — | — | — |
| `consultations.manage` | ✅ | ✅ | — | — | — |
| `designers.manage` | ✅ | ✅ | — | — | — |
| `inventory.manage` | ✅ | ✅ | — | — | — |
| `finance.view` | ✅ | ✅ | — | — | — |

Note `editor` and `social_media_manager` lack `admin.dashboard.view`, and
`social_media_manager` has no `faq.manage` — a `social_media_manager` reaches only the Blog section.

### Resolution order (`resolvePermissions`)

```js
if (role === 'super_admin')        return every permission;   // overrides are ignored
if (explicitPermissions.length)    return explicitPermissions; // account override REPLACES the role
return ROLE_PERMISSIONS[role] || [];                           // unknown role → no permissions
```

The middle branch is the sharp edge: a non-empty `permissions` array **replaces** the role's
defaults rather than adding to them. Granting one extra permission to an `admin` by writing
`permissions: ['finance.view']` silently strips their other thirteen. Always write the complete
intended set when using overrides.

---

## 5. Middleware

| Middleware | Purpose |
|------------|---------|
| `protectRoute` | Requires a valid user JWT; attaches `req.user` |
| `protectAdminRoute` | Requires a JWT with `role === 'admin'`; loads the `Admin`, resolves permissions onto `req.adminPermissions` |
| `requirePermissions([...])` | Every listed permission must be present in `req.adminPermissions`, else `403` with `{ message, requiredPermissions }` |
| `identifyGuest` | Resolves user-or-guest; mints an `anonymousId` for new visitors |
| `auditLogger` (`createAuditLog(action, resourceType)`) | Wraps `res.json`/`res.send` to capture status and payload, writes an `AuditLog` |
| `activityTracker` | Records user activity into `activityLog.model.js` |
| `rateLimiter` | Six named limiters — see `ENVIRONMENT_AND_DEPLOYMENT.md` §8 |

Typical admin route chain:

```js
router.post('/', protectAdminRoute, requirePermissions([PERMISSIONS.PRODUCTS_MANAGE]),
             createAuditLog('CREATE', 'Product'), createProduct);
```

`requirePermissions` uses `.every()`, so multiple permissions are an **AND**, not an OR.
Note that `protectAdminRoute` checks the JWT's `role` claim equals the literal `'admin'`;
the fine-grained role lives on the `Admin` document and drives permission resolution.

---

## 6. Frontend Enforcement (cosmetic only)

`useAuthStore` exposes `authUser`, `isAdmin`, `isAuthReady`, `permissions`, and `hasPermission`.
Checks appear in three places:

1. **Route guards** — `AdminProtectedRoutes` (non-admins out) and `AdminLoginProtectedRoute`
   (signed-in admins away from the login page).
2. **Navigation filtering** — every `AdminSideBar` item and every navbar admin quick-link carries a
   `permission` and is filtered out when it fails.
3. **In-page re-checks** — `Dashboard.jsx` re-validates `blog.manage` and `faq.manage` before
   rendering those sections and otherwise shows `Access denied.`

None of this is a security boundary. The API re-checks every request; the frontend merely avoids
showing controls that would fail. Never rely on hiding a control as the only protection.

`isAuthReady` matters: it distinguishes "not signed in" from "auth not yet resolved", which is why
the cookie banner and the bottom-nav data fetches wait on it.

---

## 7. Transport & Application Hardening

| Control | Implementation |
|---------|---------------|
| Helmet CSP | `defaultSrc 'self'`; Google Fonts allowed for styles/fonts; images limited to self, `data:`, `blob:`, Cloudinary, placehold.co; `connectSrc 'self'` |
| CORS | Production: single origin from `FRONTEND_URL`, `credentials: true`, exposes `Content-Disposition`. Development: any origin |
| Cookies | `httpOnly`, `secure` in production, `sameSite: 'Lax'` |
| Passwords | `bcryptjs` hashes stored as `passwordHash`; never selected in queries (`.select('-passwordHash')`) |
| Body limits | 1mb globally; 50mb only on the four base64-upload mounts |
| Rate limiting | `apiLimiter` over all `/api`, plus targeted limiters on auth, reset, create, export, search |
| Compression | `compression()` |
| Proxy trust | `trust proxy = 1` so limiter keys use the real client IP |
| Error responses | Global handler logs server-side and returns a generic `Internal server error` — no stack leakage |
| Audit trail | `auditLog.model.js` (admin actions) and `activityLog.model.js` (user activity), surfaced at `/admin/security-logs` |

**`'unsafe-inline'` is present in `scriptSrc`.** It is required by the current build output;
treat it as a known weakening of the CSP rather than an intended allowance, and don't add more
inline script surface than already exists.

---

## 8. Adding a Permission — checklist

1. Add the constant to `backend/src/lib/permissions.js` **and** `frontend/src/lib/permissions.js`.
2. Add it to the appropriate role arrays in `ROLE_PERMISSIONS` (`super_admin` picks it up
   automatically via `Object.values`).
3. Apply `requirePermissions([...])` on every route that needs it.
4. Attach `createAuditLog(action, resourceType)` if the action mutates data.
5. Gate the sidebar entry and any navbar quick-link with the same permission.
6. Re-check in-page if the surface is a `?section=` dashboard tab.
7. Update the matrix in §4 of this document.
