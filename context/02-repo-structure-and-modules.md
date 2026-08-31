# 02 — Repository Structure & Modules

> Codebase map, module catalog, and the RBAC matrix.

---

## 1. Current structure `[NOW]`

Two workspaces under a thin root `package.json`. 12,744 lines of backend, 26,378 of frontend.

```
em_furniture_and_interior/
├── backend/
│   ├── src/
│   │   ├── index.js                 # Express bootstrap, 29 route mounts, CSP, CORS
│   │   ├── controllers/   (26)      # admin.controller.js is 1,402 lines [GAP]
│   │   ├── models/        (20)      # Mongoose schemas
│   │   ├── routes/        (29)      # 140 routes total
│   │   ├── middleware/    (6)       # auth, permissions, rate limit, audit, activity
│   │   ├── lib/           (6)       # db, permissions, cloudinary, PDF, templates, jwt
│   │   ├── services/      (1)       # gmail
│   │   ├── seed/
│   │   └── swagger.js               # serves docs/swagger.json at /api-docs
│   ├── docs/                        # swagger.json (122 paths), Postman (132 requests)
│   └── __tests__/                   # 73 tests, ~2% real coverage [GAP]
├── frontend/
│   └── src/
│       ├── App.jsx                  # all routes; admin routes already lazy-loaded
│       ├── pages/         (39)      # storefront pages
│       ├── pages/admin/   (11)      # console pages
│       ├── components/              # ui/ kit, admin/ shells, animations/
│       ├── store/         (15)      # Zustand domain stores
│       └── lib/                     # axios, permissions, seo, animations
├── context/                         # this knowledge base
├── docs/                            # formal deliverables
└── changes.diff                     # 2.1 MB tracked artefact — delete [GAP]
```

## 2. Target structure `[TARGET]`

npm workspaces. No Turborepo or Nx at this size — the shared surface is small and already identified.

```
em_furniture_and_interior/
├── apps/
│   ├── api/            # Express — one deployment, two namespaces
│   │   ├── src/
│   │   │   ├── modules/<domain>/    # route + controller + service + schema, colocated
│   │   │   ├── db/migrations/       # numbered, idempotent SQL
│   │   │   ├── db/models/           # Sequelize models
│   │   │   └── platform/            # auth, errors, logging, openapi generation
│   │   └── test/                    # unit · integration · contract
│   ├── storefront/     # public site → Vercel
│   └── erp/            # operations console → Vercel, access-restricted
├── packages/
│   ├── ui/             # Button, Modal, Table, Badge, Pagination, Input, Select…
│   ├── api-client/     # generated from openapi.json
│   ├── domain/         # shared enums, permission constants, money helpers
│   └── config/         # eslint, tailwind, tsconfig presets
└── e2e/                # Playwright
```

**Why this split is cheap.** Every admin route in `App.jsx` is already `lazy()`-loaded, so public visitors
never download console code today. The only shared surface the console actually uses is
`components/ui/*` and `lib/axios` — both become packages. The split is a build and deploy
reorganisation, not a rewrite.

---

## 3. Module catalog

| Module | `[NOW]` | Models / tables | Notes |
|---|---|---|---|
| Catalog | Complete | product, collection | No cost price `[GAP F-03]`; no indexes `[GAP F-12]` |
| CMS | Partial | blogPost, faq, project, promoBanner | No media library, drafts, or revisions |
| Cart & wishlist | Complete | embedded in user, guest | Becomes proper tables in Postgres |
| Orders | Solid | order (+ embedded items, history) | No stock link `[GAP F-02]`; not atomic `[GAP F-06]` |
| Payments | Partial | paymentTransaction | No webhooks `[GAP F-01]`; no amount check `[GAP F-09]` |
| Coupons & marketing | Complete | coupon, flashSale, promoBanner | Polymorphic scope — hard to migrate |
| Loyalty | Complete | loyaltyTransaction | |
| Reviews | Complete | review (in product) | Moderation implemented |
| Consultations | Complete | consultationRequest, designer | Not yet a financial object |
| Inventory | Nominal | product.stockQuantity, inventoryAdjustment | Manual only `[GAP F-02]` |
| Documents | **Stateless** | none `[GAP F-07]` | Generates a PDF and forgets it |
| Finance | **Revenue only** | none — aggregates orders | No ledger, no expenses `[GAP]` |
| Analytics | Partial | none — aggregates orders | Counting bug `[GAP F-08]`; no charts |
| Audit & activity | Good | auditLog, activityLog | Mongo TTL has no Postgres equivalent |
| Notifications | Basic | notification | See `10-notifications-and-trigger-matrix.md` |
| Auth & RBAC | Good design, flawed transport | user, admin, guest | Shared cookie name `[GAP F-10]` |
| Purchasing | **Absent** | none | `[TARGET]` |
| Expenses | **Absent** | none | `[TARGET]` |
| Ledger | **Absent** | none | `[TARGET]` |

---

## 4. RBAC matrix

### Current `[NOW]`

`backend/src/lib/permissions.js` defines **14 permissions** across **5 roles**, resolved per request from
the database (so permission changes take effect immediately — this part is well built).

| Role | Permissions |
|---|---|
| `super_admin` | all 14 |
| `admin` | all 14 in practice |
| `editor` | `blog.manage`, `faq.manage` |
| `support` | `admin.dashboard.view` |
| `social_media_manager` | `blog.manage` |

**Problems.** `admin` is indistinguishable from `super_admin`. `finance.view` is a single permission
gating revenue reports, the analytics dashboard, security logs *and* the document builder — far too
coarse once real money is involved. There is no separation between viewing and posting.

### Target `[TARGET]`

Ten roles. The principle is that **every financial mutation has an approver who is not the initiator**.

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Unrestricted, except self-approval of any request they initiated |
| `MANAGING_DIRECTOR` | Cross-function reporting, final approval authority, margin visibility |
| `OPERATIONS_MANAGER` | Fulfilment, delivery scheduling, purchasing approval |
| `ACCOUNTANT` | Ledger postings, expenses, receipting, credit notes, reconciliation, period close |
| `SALES_OFFICER` | Enquiries, quotations, order registration — **cannot** approve discounts beyond threshold |
| `INTERIOR_DESIGNER` | Assigned consultations and project phases, room submissions |
| `WAREHOUSE_OFFICER` | Goods receipt, stock counts, picking — **cannot** approve write-offs |
| `CONTENT_EDITOR` | Blog, FAQ, banners, product copy, SEO |
| `CUSTOMER_SERVICE` | Enquiries, order status, returns intake — read-only on money |
| `MARKETING_OFFICER` | Campaigns, coupons, flash sales, loyalty rules |

Permissions split along `view` / `create` / `approve` lines per domain, e.g.
`finance.expense.create`, `finance.expense.approve`, `finance.period.close`.

### Segregation of duties `[TARGET]`

| Action | Initiator | Required approver |
|---|---|---|
| Refund / credit note | `SALES_OFFICER`, `CUSTOMER_SERVICE` | `ACCOUNTANT` or `MANAGING_DIRECTOR` |
| Expense above threshold | any | `ACCOUNTANT` |
| Purchase order issue | `OPERATIONS_MANAGER` | `ACCOUNTANT` |
| Stock write-off | `WAREHOUSE_OFFICER` | `OPERATIONS_MANAGER` |
| Discount above threshold | `SALES_OFFICER` | `MANAGING_DIRECTOR` |
| Period close / reopen | `ACCOUNTANT` | `MANAGING_DIRECTOR` |

**No self-approval.** The check is on actor identity, not role — a `SUPER_ADMIN` who raised a refund
request cannot approve it. This must be enforced in the service layer and covered by a test, because it
is the control an auditor will ask about first.
