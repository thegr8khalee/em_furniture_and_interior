# Backend Architecture

> Deep dive into the Node.js / Express backend of EM Furniture and Interior.

---

## 1. Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | LTS |
| Framework | Express.js | 4.19.2 |
| Database | MongoDB | (Atlas or local) |
| ODM | Mongoose | 8.16.1 |
| Auth | jsonwebtoken + bcryptjs | 9.0.2 / 3.0.2 |
| Images | Cloudinary | 2.7.0 |
| Email | googleapis + Nodemailer | 160.0.0 / 7.0.5 |
| PDF | pdfkit | 0.17.2 |
| Rate limiting | express-rate-limit | 7.2.0 |
| Testing | Jest | (with --experimental-vm-modules) |

---

## 2. Entry Point (`src/index.js`)

The server initializes in this order:

1. Load environment variables (`dotenv`)
2. Create Express app
3. Apply global middleware: `cookieParser`, CORS, `express.json`, `apiLimiter` (rate limiter on all `/api` routes)
4. Mount 28 route groups under `/api/` prefix
5. Serve frontend static files in production
6. Connect to MongoDB
7. Start listening on `PORT`

### Route Mount Table

| Prefix | Route File |
|--------|-----------|
| `/api/auth` | auth.routes.js |
| `/api/guestAuth` | guest.routes.js |
| `/api/admin` | admin.routes.js |
| `/api/products` | product.routes.js |
| `/api/collections` | collection.routes.js |
| `/api/review` | review.routes.js |
| `/api/cart` | cart.routes.js |
| `/api/wishlist` | wishlist.routes.js |
| `/api/contact` | contact.routes.js |
| `/api/projects` | project.routes.js |
| `/api/blog` | blog.routes.js |
| `/api/faqs` | faq.routes.js |
| `/api/admin/blog` | adminBlog.routes.js |
| `/api/admin/faqs` | adminFaq.routes.js |
| `/api/coupons` | coupon.routes.js |
| `/api/orders` | order.routes.js |
| `/api/notifications` | notification.routes.js |
| `/api/loyalty` | loyalty.routes.js |
| `/api/consultations` | consultation.routes.js |
| `/api/designers` | designer.routes.js |
| `/api/marketing` | marketing.routes.js |
| `/api/inventory` | inventory.routes.js |
| `/api/finance` | finance.routes.js |
| `/api/analytics` | analytics.routes.js |
| `/api/logs` | logs.routes.js |
| `/api/payments` | payments.routes.js |
| `/api/taxes` | tax.routes.js |

---

## 3. Project Structure

```
backend/
├── package.json            # Dependencies, scripts, "type": "module"
├── jest.config.js          # Test configuration
├── TESTING.md              # Test documentation
├── __tests__/
│   ├── helpers/
│   │   └── mockData.js     # Mock payment responses, Cloudinary, TaxJar
│   └── integration/
│       ├── core.test.js    # Auth controller tests
│       ├── features.test.js # Coupon, consultation, analytics, order tests
│       └── payments.test.js # Payment gateway + tax + document tests
└── src/
    ├── index.js            # Express app entry point
    ├── controllers/        # 25 domain controllers
    ├── models/             # 20 Mongoose models
    ├── routes/             # 27 route files
    ├── middleware/          # 7 middleware modules
    ├── lib/                # Shared utilities
    ├── services/           # External API services
    └── seed/               # Database seeder
```

---

## 4. Controllers (25)

| Controller | Functions | Domain |
|-----------|----------|--------|
| `admin.controller.js` | adminSignup, adminLogin, adminLogout, addProduct, updateProduct, delProduct, addCollection, updateCollection, delCollection, addProject, updateProject, delProject | Admin auth + CRUD |
| `analytics.controller.js` | getOverviewStats, getSalesByCategory, getSalesByRegion, getProductPerformance, getDesignerPerformance, getCustomerLifetimeValue, getConversionFunnel | Analytics |
| `auth.controller.js` | signup, login, logout, checkAuth, updateProfile, deleteAccount, forgotPassword, resetPassword, changePassword | User auth |
| `blog.controller.js` | getBlogPosts, getBlogPostBySlug, adminListBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost | Blog |
| `cart.controller.js` | getCart, addToCart, removeFromCart, clearCart, updateCartItemQuantity, checkItemExistence | Cart |
| `collection.controller.js` | getCollections, getCollectionsCount, getCollectionById | Collections |
| `consultation.controller.js` | createConsultationRequest, getConsultations, updateConsultation | Consultations |
| `coupon.controller.js` | validateCoupon, applyCoupon, createCoupon, updateCoupon, deleteCoupon, getCoupons, getCouponById | Coupons |
| `designer.controller.js` | getActiveDesigners, getAllDesigners, createDesigner, updateDesigner, deleteDesigner | Designers |
| `email.controller.js` | sendContactEmail | Contact |
| `faq.controller.js` | getFAQs, adminListFAQs, createFAQ, updateFAQ, deleteFAQ | FAQs |
| `finance.controller.js` | getRevenueSummary, exportRevenueCsv | Finance |
| `guest.controller.js` | getGuestSession, addGuestCartItem, updateGuestCartItemQuantity, removeGuestCartItem, addGuestWishlistItem, removeGuestWishlistItem | Guest sessions |
| `inventory.controller.js` | getInventoryProducts, adjustInventory | Inventory |
| `logs.controller.js` | getAuditLogs, getAuditLogStats, cleanupAuditLogs, getActivityLogs, getActivityLogStats | Logging |
| `loyalty.controller.js` | getLoyaltySummary, getLoyaltyHistory | Loyalty |
| `marketing.controller.js` | getActiveBanners, getActiveFlashSales, getAdminBanners, createBanner, updateBanner, deleteBanner, getAdminFlashSales, createFlashSale, updateFlashSale, deleteFlashSale | Marketing |
| `notification.controller.js` | getMyNotifications, markAsRead, markAllRead, deleteNotification | Notifications |
| `order.controller.js` | createOrder, getMyOrders, getOrderById, getOrderByNumber, generateInvoice, generateReceipt, generateQuotation, getAllOrders, updateOrderStatus, updatePaymentStatus, deleteOrder | Orders |
| `payments.controller.js` | initializePaystackPayment, verifyPaystackPayment, initializeFlutterwavePayment, verifyFlutterwavePayment, initializeStripePayment, verifyStripePayment, uploadBankTransferProof | Payments |
| `products.controller.js` | getProducts, getProductsCount, getProductsByIds, getProductById | Products |
| `project.controller.js` | getProjects, getProjectsCount, getProjectById | Projects |
| `review.controller.js` | addReviewToProduct, addReviewToCollection, getPendingProductReviews, getPendingCollectionReviews, approveProductReview, rejectProductReview, approveCollectionReview, rejectCollectionReview | Reviews |
| `tax.controller.js` | calculateTax | Tax |
| `wishlist.controller.js` | getWishlist, addToWishlist, removeFromWishlist, clearWishlist | Wishlist |

---

## 5. Middleware Stack (7)

### Authentication

| Middleware | Purpose | Sets on Request |
|-----------|---------|----------------|
| `protectRoute` | Verify user JWT from cookie | `req.user` |
| `protectAdminRoute` | Verify admin JWT + role check, resolve permissions | `req.admin`, `req.adminPermissions`, `req.adminRole` |
| `requirePermissions(perms[])` | Check admin has all required permissions | (rejects with 403) |
| `identifyGuest` | Try JWT first → user; else anonymousId → guest session | `req.user` or `req.guestSession` |

### Logging

| Middleware | Purpose | Behaviour |
|-----------|---------|-----------|
| `auditLogger(action, resourceType)` | Log admin CRUD operations | Intercepts `res.json`/`res.send`, logs on `res.finish` with before/after diffs. Wired to 9 admin CRUD route files: admin, adminBlog, adminFaq, coupon, designer, marketing, inventory, order, review |
| `activityTracker(activityType, resourceType)` | Track user behaviour | Fire-and-forget — does not block request. Wired to user-facing routes: auth (signup/login), product view, collection view, cart ops, wishlist ops, order creation, review submission, consultation submission |

### Rate Limiting

| Middleware | Window | Max | Purpose |
|-----------|--------|-----|---------|
| `apiLimiter` | 15 min | 100 | General API |
| `authLimiter` | 15 min | 5 | Auth routes (skips on success) |
| `createLimiter` | 1 hr | 20 | Resource creation |
| `passwordResetLimiter` | 1 hr | 3 | Password reset |
| `exportLimiter` | 1 hr | 5 | Heavy exports |
| `searchLimiter` | 1 min | 30 | Search operations |

> **Rate limiter wiring:** `apiLimiter` is applied globally on all `/api` routes in `index.js`. Endpoint-specific limiters are wired per route file: `authLimiter` on auth login/signup and admin login; `passwordResetLimiter` on forgot/reset password; `createLimiter` on POST consultation, contact, review, and order creation; `exportLimiter` on finance CSV export; `searchLimiter` on GET product, collection, and blog list endpoints.

---

## 6. Library Modules

| Module | Purpose |
|--------|---------|
| `lib/db.js` | MongoDB connection via Mongoose |
| `lib/cloudinary.js` | Cloudinary SDK configuration and upload wrapper |
| `lib/utils.js` | JWT token generation (`generateToken`), cookie options |
| `lib/permissions.js` | Permission constants (14 keys), role defaults, `resolvePermissions()` |
| `lib/invoiceGenerator.js` | PDF generation via pdfkit for invoices, receipts, quotations |

---

## 7. Services

| Service | Purpose |
|---------|---------|
| `services/gmail.service.js` | Gmail API email sending with OAuth2 authentication |

---

## 8. RBAC System

### Roles

| Role | Permissions |
|------|------------|
| `super_admin` | All 14 permissions |
| `admin` | All 14 permissions (explicitly listed) |

> **Note:** The `super_admin` role is seeded in the database seed script (`seed/seed.js`) for initial setup.
| `editor` | `blog.manage`, `faq.manage` |
| `support` | `admin.dashboard.view` |
| `social_media_manager` | `blog.manage` |

### Permission Resolution

```javascript
resolvePermissions(role, explicitPermissions)
  → if super_admin: return ALL permissions
  → if explicitPermissions provided: return those
  → else: return ROLE_DEFAULTS[role]
```

### Permission Keys

| Key | Controls |
|-----|----------|
| `admin.dashboard.view` | Dashboard access |
| `products.manage` | Product CRUD |
| `collections.manage` | Collection CRUD |
| `projects.manage` | Project CRUD |
| `blog.manage` | Blog CRUD |
| `faq.manage` | FAQ CRUD |
| `marketing.manage` | Banners, flash sales, coupons |
| `orders.view` | Read-only order access |
| `orders.manage` | Order status updates, deletion |
| `reviews.manage` | Review approve/reject |
| `consultations.manage` | Consultation management |
| `designers.manage` | Designer CRUD |
| `inventory.manage` | Stock adjustments |
| `finance.view` | Finance, analytics, security logs |

---

## 9. Testing

| Aspect | Detail |
|--------|--------|
| Framework | Jest with `--experimental-vm-modules` (ESM) |
| Environment | Node |
| Location | `__tests__/integration/` |
| Suites | 3 (core, features, payments) |
| Total tests | 72 |
| Pass rate | 100% |
| Duration | ~9.6 seconds |
| Mocking | Mongoose models, Cloudinary, payment gateways (Paystack, Flutterwave, Stripe), pdfkit |
| Coverage | Collected via Jest (excludes seed, index.js, __tests__) |

### Test Suites

| Suite | File | Tests | Covers |
|-------|------|-------|--------|
| Core | `core.test.js` | 23 | Auth (signup, login, hashing, JWT, guest merge, password reset) |
| Features | `features.test.js` | 33 | Coupons, consultations, analytics, orders, designers, marketing |
| Payments | `payments.test.js` | 17 | Paystack, Flutterwave, Stripe integration, tax calculation, PDF generation |
