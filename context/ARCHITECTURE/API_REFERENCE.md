# API Reference

> The REST contract for EM Furniture and Interior, against PostgreSQL.
> Permission names come from `packages/shared/src/permissions.js`, which the
> API and the console's sidebar both import so they cannot disagree.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:5000/api` |
| Production | `https://<domain>/api` |

## Authentication

All authenticated requests use JWT stored in HTTP-only cookies. Cookies are sent automatically by the browser (Axios `withCredentials: true`).

| Token Type | Cookie Name | Purpose |
|-----------|------------|---------|
| User JWT | `jwt` | User authentication |
| Admin JWT | `jwt` | Admin authentication (separate issuer claim) |
| Guest ID | `anonymousId` | Guest session identification |

---

## Middleware Legend

| Abbreviation | Middleware | Purpose |
|-------------|-----------|---------|
| **auth** | `protectRoute` | Requires valid user JWT |
| **admin** | `protectAdminRoute` | Requires valid admin JWT + resolves permissions |
| **perm(X)** | `requirePermissions([X])` | Requires specific admin permissions |
| **guest** | `identifyGuest` | Identifies user (JWT) or guest (anonymousId) |
| **audit** | `auditLogger` | Logs admin CRUD actions with before/after diffs |
| **activity** | `activityTracker` | Fire-and-forget user behaviour logging |

### Rate Limiter Legend

| Limiter | Window | Max | Applied To |
|---------|--------|-----|------------|
| `apiLimiter` | 15 min | 100 | All `/api` routes (global) |
| `authLimiter` | 15 min | 5 | Auth signup/login, admin login |
| `passwordResetLimiter` | 1 hr | 3 | Forgot/reset password |
| `createLimiter` | 1 hr | 20 | POST consultation, contact, review, order |
| `exportLimiter` | 1 hr | 5 | Finance CSV export |
| `searchLimiter` | 1 min | 30 | GET products, collections, blog |

---

## 1. Authentication (`/api/auth`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/auth/signup` | — | signup | Register new user |
| POST | `/api/auth/login` | — | login | Login, set JWT cookie |
| POST | `/api/auth/supabase` | — | supabaseSession | Exchange a Supabase access token for the session cookie; links or creates the customer |
| POST | `/api/auth/logout` | — | logout | Clear JWT cookie |
| GET | `/api/auth/check` | — | checkAuth | Check current auth status |
| PUT | `/api/auth/update` | auth | updateProfile | Update user profile |
| DELETE | `/api/auth/delete` | auth | deleteAccount | Delete user account |
| PUT | `/api/auth/change-password` | auth | changePassword | Change password |
| POST | `/api/auth/forgot-password` | — | forgotPassword | Request password reset email |
| POST | `/api/auth/reset-password/:token` | — | resetPassword | Reset password with token |

---

## 2. Guest Sessions (`/api/guestAuth`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/guestAuth/session` | — | getGuestSession | Get or create guest session |
| POST | `/api/guestAuth/cart/add` | — | addGuestCartItem | Add item to guest cart |
| PUT | `/api/guestAuth/cart/update/:productId` | — | updateGuestCartItemQuantity | Update guest cart quantity |
| DELETE | `/api/guestAuth/cart/remove/:productId` | — | removeGuestCartItem | Remove from guest cart |
| POST | `/api/guestAuth/wishlist/add` | — | addGuestWishlistItem | Add to guest wishlist |
| DELETE | `/api/guestAuth/wishlist/remove/:itemId` | — | removeGuestWishlistItem | Remove from guest wishlist |

---

## 3. Admin Auth & CRUD (`/api/admin`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/admin/signup` | admin + perm(ADMIN_DASHBOARD_VIEW) | adminSignup | Create admin account (protected) |
| POST | `/api/admin/supabase` | — | adminSupabaseSession | Exchange a Supabase access token for an operator session; links an existing operator, never creates one |
| POST | `/api/admin/login` | — | adminLogin | Admin login |
| POST | `/api/admin/logout` | — | adminLogout | Admin logout |
| POST | `/api/admin/operations/addProduct` | admin + perm(PRODUCTS_MANAGE) | addProduct | Create product |
| PUT | `/api/admin/operations/updateProduct/:productId` | admin + perm(PRODUCTS_MANAGE) | updateProduct | Update product |
| DELETE | `/api/admin/operations/delProduct/:productId` | admin + perm(PRODUCTS_MANAGE) | delProduct | Delete product |
| POST | `/api/admin/operations/addCollection` | admin + perm(COLLECTIONS_MANAGE) | addCollection | Create collection |
| PUT | `/api/admin/operations/updateCollection/:collectionId` | admin + perm(COLLECTIONS_MANAGE) | updateCollection | Update collection |
| DELETE | `/api/admin/operations/delCollection/:collectionId` | admin + perm(COLLECTIONS_MANAGE) | delCollection | Delete collection |
| POST | `/api/admin/operations/addProject` | admin + perm(PROJECTS_MANAGE) | addProject | Create project |
| PUT | `/api/admin/operations/updateProject/:projectId` | admin + perm(PROJECTS_MANAGE) | updateProject | Update project |
| DELETE | `/api/admin/operations/delProject/:projectId` | admin + perm(PROJECTS_MANAGE) | delProject | Delete project |

---

## 4. Products (`/api/products`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/products` | — | getProducts | List products (filtered, paginated) |
| GET | `/api/products/count` | — | getProductsCount | Get total product count |
| GET | `/api/products/by-ids` | — | getProductsByIds | Get products by ID array |
| GET | `/api/products/:productId` | — | getProductById | Get single product |

**Query Parameters (GET /api/products):**

| Param | Type | Description |
|-------|------|-------------|
| search | string | Text search in name/description |
| category | string | Filter by category |
| style | string | Filter by design style |
| priceMin | number | Minimum price |
| priceMax | number | Maximum price |
| rating | number | Minimum average rating |
| isBestSeller | boolean | Best seller filter |
| isPromo | boolean | Promotional items |
| isForeign | boolean | Imported products |
| page | number | Page number |
| limit | number | Items per page |

---

## 5. Collections (`/api/collections`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/collections` | — | getCollections | List collections (filtered) |
| GET | `/api/collections/count` | — | getCollectionsCount | Get total count |
| GET | `/api/collections/:collectionId` | — | getCollectionById | Get single collection |

---

## 6. Cart (`/api/cart`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/cart` | guest + auth | getCart | Get user's cart |
| PUT | `/api/cart/add` | guest + auth | addToCart | Add item to cart |
| PUT | `/api/cart/remove` | guest + auth | removeFromCart | Remove item from cart |
| DELETE | `/api/cart/clear` | guest + auth | clearCart | Clear entire cart |
| PUT | `/api/cart/updatequantity` | guest + auth | updateCartItemQuantity | Update item quantity |
| POST | `/api/cart/check-existence` | — | checkItemExistence | Check if item exists in cart |
| POST | `/api/cart/details-by-ids` | — | (inline) | Get cart item details by IDs |

---

## 7. Wishlist (`/api/wishlist`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/wishlist` | guest + auth | getWishlist | Get user's wishlist |
| PUT | `/api/wishlist/add` | guest + auth | addToWishlist | Add item |
| PUT | `/api/wishlist/remove` | guest + auth | removeFromWishlist | Remove item |
| DELETE | `/api/wishlist/clear` | guest + auth | clearWishlist | Clear wishlist |

---

## 8. Reviews (`/api/review`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/review/products/:productId` | auth | addReviewToProduct | Submit product review |
| POST | `/api/review/collections/:collectionId` | auth | addReviewToCollection | Submit collection review |
| GET | `/api/review/admin/pending/products` | admin + perm(REVIEWS_MANAGE) | getPendingProductReviews | List pending product reviews |
| GET | `/api/review/admin/pending/collections` | admin + perm(REVIEWS_MANAGE) | getPendingCollectionReviews | List pending collection reviews |
| PATCH | `/api/review/admin/products/:productId/reviews/:reviewId/approve` | admin + perm(REVIEWS_MANAGE) | approveProductReview | Approve review |
| DELETE | `/api/review/admin/products/:productId/reviews/:reviewId` | admin + perm(REVIEWS_MANAGE) | rejectProductReview | Reject/delete review |
| PATCH | `/api/review/admin/collections/:collectionId/reviews/:reviewId/approve` | admin + perm(REVIEWS_MANAGE) | approveCollectionReview | Approve review |
| DELETE | `/api/review/admin/collections/:collectionId/reviews/:reviewId` | admin + perm(REVIEWS_MANAGE) | rejectCollectionReview | Reject/delete review |

---

## 9. Coupons (`/api/coupons`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/coupons/validate` | — | validateCoupon | Validate coupon code |
| POST | `/api/coupons/apply` | — | applyCoupon | Apply coupon to cart |
| POST | `/api/coupons/admin/create` | admin + perm(MARKETING_MANAGE) | createCoupon | Create coupon |
| PUT | `/api/coupons/admin/:couponId` | admin + perm(MARKETING_MANAGE) | updateCoupon | Update coupon |
| DELETE | `/api/coupons/admin/:couponId` | admin + perm(MARKETING_MANAGE) | deleteCoupon | Delete coupon |
| GET | `/api/coupons/admin` | admin + perm(MARKETING_MANAGE) | getCoupons | List all coupons |
| GET | `/api/coupons/admin/:couponId` | admin + perm(MARKETING_MANAGE) | getCouponById | Get single coupon |

---

## 10. Orders (`/api/orders`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/orders/create` | guest | createOrder | Place an order |
| GET | `/api/orders/track/:orderNumber` | — | getOrderByNumber | Track by order number |
| GET | `/api/orders/my-orders` | guest | getMyOrders | List user's orders |
| GET | `/api/orders/:orderId` | guest | getOrderById | Get order details |
| GET | `/api/orders/:orderId/invoice` | guest | generateInvoice | Download invoice PDF |
| GET | `/api/orders/:orderId/receipt` | guest | generateReceipt | Download receipt PDF |
| GET | `/api/orders/:orderId/quotation` | guest | generateQuotation | Download quotation PDF |
| GET | `/api/orders/admin/all` | admin + perm(ORDERS_VIEW) | getAllOrders | List all orders |
| PUT | `/api/orders/admin/:orderId/status` | admin + perm(ORDERS_MANAGE) | updateOrderStatus | Update order status |
| PUT | `/api/orders/admin/:orderId/payment` | admin + perm(ORDERS_MANAGE) | updatePaymentStatus | Update payment status |
| DELETE | `/api/orders/admin/:orderId` | admin + perm(ORDERS_MANAGE) | deleteOrder | Delete order |
| GET | `/api/orders/admin/:orderId/invoice` | admin + perm(ORDERS_VIEW) | generateInvoice | Admin invoice download |
| GET | `/api/orders/admin/:orderId/receipt` | admin + perm(ORDERS_VIEW) | generateReceipt | Admin receipt download |
| GET | `/api/orders/admin/:orderId/quotation` | admin + perm(ORDERS_VIEW) | generateQuotation | Admin quotation download |

---

## 11. Payments (`/api/payments`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/payments/paystack/initialize` | guest | initializePaystackPayment | Start Paystack checkout |
| GET | `/api/payments/paystack/verify` | — | verifyPaystackPayment | Verify Paystack payment |
| POST | `/api/payments/flutterwave/initialize` | guest | initializeFlutterwavePayment | Start Flutterwave checkout |
| GET | `/api/payments/flutterwave/verify` | — | verifyFlutterwavePayment | Verify Flutterwave payment |
| POST | `/api/payments/stripe/initialize` | guest | initializeStripePayment | Start Stripe checkout |
| GET | `/api/payments/stripe/verify` | — | verifyStripePayment | Verify Stripe payment |
| POST | `/api/payments/bank-transfer/proof` | guest | uploadBankTransferProof | Upload transfer proof |

---

## 12. Tax (`/api/taxes`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/taxes/calculate` | guest | calculateTax | Calculate tax for order |

---

## 13. Blog (`/api/blog` + `/api/admin/blog`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/blog` | — | getBlogPosts | List published posts |
| GET | `/api/blog/:slug` | — | getBlogPostBySlug | Get post by slug |
| GET | `/api/admin/blog` | admin + perm(BLOG_MANAGE) | adminListBlogPosts | List all posts (admin) |
| POST | `/api/admin/blog` | admin + perm(BLOG_MANAGE) | createBlogPost | Create post |
| PUT | `/api/admin/blog/:id` | admin + perm(BLOG_MANAGE) | updateBlogPost | Update post |
| DELETE | `/api/admin/blog/:id` | admin + perm(BLOG_MANAGE) | deleteBlogPost | Delete post |

---

## 14. FAQs (`/api/faqs` + `/api/admin/faqs`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/faqs` | — | getFAQs | List active FAQs |
| GET | `/api/admin/faqs` | admin + perm(FAQ_MANAGE) | adminListFAQs | List all FAQs |
| POST | `/api/admin/faqs` | admin + perm(FAQ_MANAGE) | createFAQ | Create FAQ |
| PUT | `/api/admin/faqs/:id` | admin + perm(FAQ_MANAGE) | updateFAQ | Update FAQ |
| DELETE | `/api/admin/faqs/:id` | admin + perm(FAQ_MANAGE) | deleteFAQ | Delete FAQ |

---

## 15. Projects (`/api/projects`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/projects` | — | getProjects | List projects (paginated) |
| GET | `/api/projects/count` | — | getProjectsCount | Get total count |
| GET | `/api/projects/get/:projectId` | — | getProjectById | Get single project |

---

## 16. Contact (`/api/contact`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/contact` | — | sendContactEmail | Send contact form email |

---

## 17. Consultations (`/api/consultations`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/consultations` | — | createConsultationRequest | Submit consultation request |
| GET | `/api/consultations/admin` | admin + perm(CONSULTATIONS_MANAGE) | getConsultations | List all requests |
| PUT | `/api/consultations/admin/:consultationId` | admin + perm(CONSULTATIONS_MANAGE) | updateConsultation | Update request |

---

## 18. Designers (`/api/designers`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/designers` | — | getActiveDesigners | List active designers |
| GET | `/api/designers/admin` | admin + perm(DESIGNERS_MANAGE) | getAllDesigners | List all designers |
| POST | `/api/designers/admin` | admin + perm(DESIGNERS_MANAGE) | createDesigner | Create designer |
| PUT | `/api/designers/admin/:designerId` | admin + perm(DESIGNERS_MANAGE) | updateDesigner | Update designer |
| DELETE | `/api/designers/admin/:designerId` | admin + perm(DESIGNERS_MANAGE) | deleteDesigner | Delete designer |

---

## 19. Notifications (`/api/notifications`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/notifications` | auth | getMyNotifications | List user's notifications |
| PATCH | `/api/notifications/:notificationId/read` | auth | markAsRead | Mark as read |
| PATCH | `/api/notifications/read-all` | auth | markAllRead | Mark all as read |
| DELETE | `/api/notifications/:notificationId` | auth | deleteNotification | Delete notification |

---

## 20. Loyalty (`/api/loyalty`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/loyalty/summary` | auth | getLoyaltySummary | Get points balance |
| GET | `/api/loyalty/history` | auth | getLoyaltyHistory | Get transaction history |

---

## 21. Marketing (`/api/marketing`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/marketing/banners/active` | — | getActiveBanners | List active banners |
| GET | `/api/marketing/flash-sales/active` | — | getActiveFlashSales | List active flash sales |
| GET | `/api/marketing/admin/banners` | admin + perm(MARKETING_MANAGE) | getAdminBanners | List all banners |
| POST | `/api/marketing/admin/banners` | admin + perm(MARKETING_MANAGE) | createBanner | Create banner |
| PUT | `/api/marketing/admin/banners/:bannerId` | admin + perm(MARKETING_MANAGE) | updateBanner | Update banner |
| DELETE | `/api/marketing/admin/banners/:bannerId` | admin + perm(MARKETING_MANAGE) | deleteBanner | Delete banner |
| GET | `/api/marketing/admin/flash-sales` | admin + perm(MARKETING_MANAGE) | getAdminFlashSales | List all flash sales |
| POST | `/api/marketing/admin/flash-sales` | admin + perm(MARKETING_MANAGE) | createFlashSale | Create flash sale |
| PUT | `/api/marketing/admin/flash-sales/:flashSaleId` | admin + perm(MARKETING_MANAGE) | updateFlashSale | Update flash sale |
| DELETE | `/api/marketing/admin/flash-sales/:flashSaleId` | admin + perm(MARKETING_MANAGE) | deleteFlashSale | Delete flash sale |

---

## 22. Inventory (`/api/inventory`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/inventory/admin/products` | admin + perm(INVENTORY_MANAGE) | getInventoryProducts | List products with stock info |
| GET | `/api/inventory/admin/products/:productId/history` | admin + perm(INVENTORY_MANAGE) | getInventoryHistory | The movements the balance is derived from |
| PUT | `/api/inventory/admin/products/:productId/adjust` | admin + perm(INVENTORY_MANAGE) | adjustInventory | Record the movement that explains a new count |
| PUT | `/api/inventory/admin/products/:productId/cost` | admin + perm(INVENTORY_MANAGE) | putCostPrice | Set what a piece cost to buy — a sale posts a cost of goods sold only if this is set |

---

## 23. Finance (`/api/finance`)

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/finance/admin/revenue` | admin + perm(FINANCE_VIEW) | getRevenueSummary | Revenue summary |
| GET | `/api/finance/admin/revenue/export` | admin + perm(FINANCE_VIEW) | exportRevenueCsv | Export CSV |

---

## 24. Analytics (`/api/analytics`)

All analytics endpoints require: `admin` + `perm(FINANCE_VIEW)`

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/analytics/overview` | getOverviewStats | KPI summary (revenue, orders, customers, AOV, consultations) |
| GET | `/api/analytics/sales/category` | getSalesByCategory | Revenue by product category |
| GET | `/api/analytics/sales/region` | getSalesByRegion | Sales by city/state (top 50) |
| GET | `/api/analytics/products/performance` | getProductPerformance | Top 20 products by revenue |
| GET | `/api/analytics/designers/performance` | getDesignerPerformance | Consultation completion rates |
| GET | `/api/analytics/customers/lifetime-value` | getCustomerLifetimeValue | Top 50 customers by spend |
| GET | `/api/analytics/customers/conversion-funnel` | getConversionFunnel | Registration → order → payment rates |

**Common Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| startDate | ISO string | 30 days ago | Period start |
| endDate | ISO string | now | Period end |

---

## 25. Security Logs (`/api/logs`)

All log endpoints require: `admin` (router-level) + `perm(FINANCE_VIEW)` (per route)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/logs/audit` | getAuditLogs | List audit logs (paginated, filtered) |
| GET | `/api/logs/audit/stats` | getAuditLogStats | Audit log statistics |
| POST | `/api/logs/audit/cleanup` | cleanupAuditLogs | Delete old audit logs |
| GET | `/api/logs/activity` | getActivityLogs | List activity logs (paginated, filtered) |
| GET | `/api/logs/activity/stats` | getActivityLogStats | Activity log statistics |

---

## 26. The books (`/api/books`)

Everything here derives from `journal_lines`. Nothing recomputes a figure from
orders or payments, which is what makes the reports and the postings incapable of
disagreeing.

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/books/trial-balance` | admin + perm(FINANCE_VIEW) | getTrialBalance | Every account with a balance, `?asOf=` |
| GET | `/api/books/journal` | admin + perm(FINANCE_VIEW) | getJournal | Entries, filterable by source, date and account |
| GET | `/api/books/journal/:entryId` | admin + perm(FINANCE_VIEW) | getJournalEntry | One entry with both its sides |
| GET | `/api/books/accounts` | admin + perm(FINANCE_VIEW) | getAccounts | The chart of accounts and what each holds |
| GET | `/api/books/accounts/:code/ledger` | admin + perm(FINANCE_VIEW) | getAccountLedger | One account, line by line, with a running balance |
| GET | `/api/books/reports/profit-and-loss` | admin + perm(FINANCE_VIEW) | getProfitAndLoss | Revenue, cost of sales, gross profit, operating costs, net |
| GET | `/api/books/reports/balance-sheet` | admin + perm(FINANCE_VIEW) | getBalanceSheet | Assets, liabilities, equity, and its own balanced check |
| GET | `/api/books/reports/vat` | admin + perm(FINANCE_VIEW) | getVatReturn | Output VAT, input VAT, net payable |
| GET | `/api/books/periods` | admin + perm(FINANCE_VIEW) | getPeriods | The accounting calendar |
| POST | `/api/books/periods/:periodId/close` | admin + perm(BOOKS_MANAGE) + audit | postClosePeriod | Stop any further posting into a month |
| POST | `/api/books/periods/:periodId/reopen` | admin + perm(BOOKS_MANAGE) + audit | postReopenPeriod | Let it move again — audited, deliberately |

---

## 27. Purchasing (`/api/purchasing`)

Reading is `finance.view`; spending is `purchasing.manage`. Every status change
posts to the ledger in the same transaction.

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| GET | `/api/purchasing/vendors` | admin + perm(FINANCE_VIEW) | getVendors | Suppliers, each with what is owed |
| POST | `/api/purchasing/vendors` | admin + perm(PURCHASING_MANAGE) + audit | postVendor | Add one |
| PATCH | `/api/purchasing/vendors/:vendorId` | admin + perm(PURCHASING_MANAGE) + audit | patchVendor | Update one |
| DELETE | `/api/purchasing/vendors/:vendorId` | admin + perm(PURCHASING_MANAGE) + audit | deleteVendor | Delete, or deactivate if it has history |
| GET | `/api/purchasing/expenses` | admin + perm(FINANCE_VIEW) | getExpenses | Filter by status, vendor, date |
| GET | `/api/purchasing/expenses/:expenseId` | admin + perm(FINANCE_VIEW) | getOneExpense | One expense |
| POST | `/api/purchasing/expenses` | admin + perm(PURCHASING_MANAGE) + audit | postExpense | Record a cost, as a draft |
| POST | `/api/purchasing/expenses/:expenseId/approve` | admin + perm(PURCHASING_MANAGE) + audit | postExpenseApproval | Book the cost and the debt |
| POST | `/api/purchasing/expenses/:expenseId/pay` | admin + perm(PURCHASING_MANAGE) + audit | postExpensePayment | Settle it; approved only |
| POST | `/api/purchasing/expenses/:expenseId/void` | admin + perm(PURCHASING_MANAGE) + audit | postExpenseVoid | Drafts only — reverse a posted one instead |
| GET | `/api/purchasing/payables` | admin + perm(FINANCE_VIEW) | getPayables | Ageing: approved expenses and received-unpaid orders |
| GET | `/api/purchasing/purchase-orders` | admin + perm(FINANCE_VIEW) | getPurchaseOrders | Filter by status and vendor |
| GET | `/api/purchasing/purchase-orders/:orderId` | admin + perm(FINANCE_VIEW) | getOnePurchaseOrder | One order with its lines |
| POST | `/api/purchasing/purchase-orders` | admin + perm(PURCHASING_MANAGE) + audit | postPurchaseOrder | Create one |
| POST | `/api/purchasing/purchase-orders/:orderId/send` | admin + perm(PURCHASING_MANAGE) + audit | postPurchaseOrderSend | Mark it sent |
| POST | `/api/purchasing/purchase-orders/:orderId/receive` | admin + perm(PURCHASING_MANAGE) + audit | postPurchaseOrderReceipt | Stock in, payable up |
| POST | `/api/purchasing/purchase-orders/:orderId/pay` | admin + perm(PURCHASING_MANAGE) + audit | postPurchaseOrderPayment | Settle what the receipt owed |
| POST | `/api/purchasing/purchase-orders/:orderId/cancel` | admin + perm(PURCHASING_MANAGE) + audit | postPurchaseOrderCancel | Open orders only |

---

## Error Responses

All error responses follow this format:

```json
{
  "message": "Error description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (validation error, missing fields) |
| 401 | Unauthorized (missing or invalid JWT) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Internal server error |
