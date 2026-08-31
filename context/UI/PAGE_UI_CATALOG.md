# Page UI Catalog

> Every screen in the app: its route, file, size, and what is actually on it.
> Source: `frontend/src/pages/` (51 page components, ~17,900 LOC).

Legend for the **Primitives** column: which shared components the page composes.
Every page renders `<SEO>` — that is not repeated below.

---

## 1. Storefront — Discovery

### `/` — HomePage · `HomePage.jsx` · 947 LOC · eager

The longest storefront page; a stack of full-bleed sections:

| # | Section | Contents |
|---|---------|----------|
| 1 | Hero | `h-[85vh] lg:h-screen` image carousel with `nextSlide`, overlay scrim, hero copy, and slide indicators |
| 2 | Trust bar | Value-proposition strip |
| 3 | Featured Projects | Portfolio strip using `ProjectCardHome` |
| 4 | Browse Categories | Category tiles into `/shop?category=…` |
| 5 | Promotions | Promo/flash-sale content from `useMarketingStore` |
| 6 | Best Sellers | Product grid |
| 7 | Collections | Collection grid |
| 8 | Featured Styles | Style tiles into `/styles/:style` |
| 9 | Interior Design | Split image-grid + copy block |
| 10 | Room Showcases | Room-by-room imagery |
| 11 | Brand Statement | Closing editorial band |

An early `<section className="content-shell section-shell">` renders the loading state.
Promotions also surface in the navbar's rotating promo bar rather than only here.

### `/shop` — Shop · `Shop.jsx` · 1125 LOC · eager

The most stateful page in the app. A `viewMode` toggle switches the whole body between
**products** and **collections**, and each mode keeps its own parallel filter state.

| Concern | Products state | Collections state |
|---------|----------------|-------------------|
| Search | `productSearchQuery` | `collectionSearchQuery` |
| Price | `minPriceProduct` / `maxPriceProduct` | `minPriceCollection` / `maxPriceCollection` |
| Flags | best-seller, promo, foreign | best-seller, promo, foreign |
| Applied flag | `isPriceFilterAppliedProduct` | `isPriceFilterAppliedCollection` |
| Modal | own `FilterModal` instance | own `FilterModal` instance |
| Paging | `localPageProduct` | `localPageCollection` |

Also: hero banner, a searchable category dropdown (`isCategoryDropdownOpen`,
`categorySearchQuery`, populated from fetched products), and shop banners from marketing.

### `/styles/:style` — Styles · `Styles.jsx` · 1095 LOC

Style-filtered catalogue; mirrors `Shop`'s structure and filter machinery for a single design style.

### `/product/:productId` — ProductPage · `ProductPage.jsx` · 881 LOC · eager

Image gallery with thumbnail previews → product detail column (price, variants, quantity,
add-to-cart, wishlist, WhatsApp enquiry, compare) → product banners.

### `/collection/:collectionId` — CollectionDetailPage · 719 LOC · eager

Collection header → products-in-collection grid → collection banners.

### `/compare` — CompareProducts · 191 LOC

Side-by-side comparison of up to **4** products (cap enforced by `useCompareStore.maxItems`).

### `/projects` — ProjectsPage · 197 LOC → `/project/:id` — ProjectDetailPage · 232 LOC

Portfolio listing using `ProjectCard`, and a detail page per project.

---

## 2. Storefront — Commerce

### `/cart` — Cart · `Cart.jsx` · 603 LOC

Hero banner, then two columns: the item list (quantity steppers, remove) and an order summary
containing the **coupon code input** (`useCouponStore.validateCoupon`). WhatsApp order placement
composes a message with item links and the total.

### `/checkout` — CheckoutPage · 675 LOC

Two-column checkout.

| Left column (forms) | Right column (summary) |
|---|---|
| Shipping address | Item lines |
| "Billing same as shipping" toggle | Pricing breakdown |
| Billing address (conditional, same fields) | Payment method selection |
| Additional notes | Terms acceptance |
| | Place Order button |

### `/payment/verify` — PaymentVerify · Gateway return handler.
### `/order-confirmation/:orderId` — OrderConfirmationPage · 357 LOC · Post-purchase summary + invoice download.
### `/orders` — OrderHistoryPage · 256 LOC · Past orders list.
### `/track-order` — TrackOrderPage · Guest-accessible order lookup.
### `/wishlist` — Wishlist · 383 LOC · Uses `PageHeader`, `EmptyState`, and skeletons; move-to-cart actions.
### `/loyalty` — LoyaltyPage · Points summary + transaction history (`useLoyaltyStore`).
### `/notifications` — NotificationsPage · Full list behind the navbar bell dropdown.

---

## 3. Storefront — Content & Info

| Route | File | LOC | Notes |
|-------|------|-----|-------|
| `/blog` | `Blog.jsx` | — | Paginated post listing |
| `/blog/:slug` | `BlogPost.jsx` | — | Rendered post (HTML authored in TinyMCE) |
| `/faqs` | `FAQ.jsx` | — | Accordion of published FAQs |
| `/consultation` | `Consultation.jsx` | 352 | `PageHeader` + booking request form |
| `/e-catalog` | `ECatalog.jsx` | — | Embedded PDF catalogue viewer |
| `/showroom` | `Showroom.jsx` | — | Google Maps `iframe` at the Kaduna showroom |
| `/aboutUs` | `AboutUs.jsx` | — | Brand story |
| `/contact` | `Contact.jsx` | 293 | Contact form → transactional email |
| `/terms` | `Terms.jsx` | — | Legal copy |
| `/privacy` | `Privacy.jsx` | 294 | Legal copy |
| `*` | `NotFoundPage.jsx` | — | 404 |

---

## 4. Account

| Route | File | LOC | Notes |
|-------|------|-----|-------|
| `/signup` | `Signup.jsx` | 249 | Renders `LoginPage` instead when already authenticated |
| `/login` | `LoginPage.jsx` | 286 | Reached via the `/signup` and `/profile` fallbacks |
| `/profile` | `Profile.jsx` | 434 | Profile edit, an inline collapsible **change-password** form with per-field validation (old / new / confirm), logout, delete account. Feedback is via `react-hot-toast` raised from store actions, not local message state |
| `/reset-password/:token` | `ResetPasswordPage.jsx` | — | Token-based reset |

---

## 5. Admin — Dashboard Sections

All reached at `/admin/dashboard?section=…` and rendered by `Dashboard.jsx` (46 LOC), which is
pure routing logic — it returns `renderContent()` with no wrapper of its own.

| `section` | Component | LOC | Permission re-checked in-page |
|-----------|-----------|-----|-------------------------------|
| `dashboard` (default) | `AdminDashboardContent` | 341 | — |
| `products` | `ProductManagement` | 168 | — |
| `collections` | `CollectionManagement` | 169 | — |
| `projects` | `ProjectManagement` | 167 | — |
| `blog` | `BlogManagement` | 178 | `blog.manage` → else `Access denied.` |
| `faqs` | `FAQManagement` | 152 | `faq.manage` → else `Access denied.` |

**`AdminDashboardContent`** renders clickable `StatCard`s (Products / Collections / Projects, each
navigating to its section), order stats (total + pending), quick actions, and recent-entity strips
built from `ProductMiniCard` / `CollectionMiniCard` / `ProjectMiniCard`, with `SkeletonGrid`
while loading. Recent orders come from a direct
`axiosInstance.get('/orders/admin/all?page=1&limit=5')` call.

---

## 6. Admin — Entity Editors (own routes)

| Route | File | LOC |
|-------|------|-----|
| `/admin/products/new` | `AddProductPage.jsx` | 571 |
| `/admin/products/edit/:productId` | `EditProductPage.jsx` | 812 |
| `/admin/collections/new` | `AddCollection.jsx` | 511 |
| `/admin/collections/edit/:collectionId` | `EditCollection.jsx` | 567 |
| `/admin/addProject` | `AddProject.jsx` | 318 |
| `/admin/editProject/:projectId` | `EditProject.jsx` | 390 |

These are long multi-part forms (details, pricing, imagery via Cloudinary upload, flags, relations).
Note the route-naming inconsistency: products/collections use `new` / `edit/:id`, while projects
use `addProject` / `editProject/:id`.

---

## 7. Admin — Management Screens

Every one of these is built as `AdminPageShell` + content. The Primitives column records what each
actually composes.

| Route | File | LOC | Primitives |
|-------|------|-----|-----------|
| `/admin/orders` | `admin/OrderManagement.jsx` | 414 | Shell, Badge, Modal, Pagination, EmptyState |
| `/admin/inventory` | `admin/InventoryManagement.jsx` | — | Shell, Badge, Modal, Pagination, EmptyState |
| `/admin/coupons` | `admin/CouponManagement.jsx` | 340 | Shell, Badge, Modal, EmptyState |
| `/admin/marketing` | `admin/MarketingManagement.jsx` | 363 | Shell, Badge, Modal, EmptyState |
| `/admin/consultations` | `admin/ConsultationManagement.jsx` | — | Shell, Badge, Modal, EmptyState |
| `/admin/reviews` | `admin/ReviewModeration.jsx` | — | Shell, Badge, EmptyState |
| `/admin/designers` | `admin/DesignerManagement.jsx` | — | Shell, Badge, EmptyState |
| `/admin/analytics` | `admin/AnalyticsDashboard.jsx` | 471 | Shell, EmptyState |
| `/admin/finance` | `admin/FinanceReports.jsx` | — | Shell, EmptyState |
| `/admin/security-logs` | `admin/SecurityLogs.jsx` | 439 | Shell, Badge, Pagination, EmptyState |
| `/admin/documents` | `admin/DocumentBuilder.jsx` | 610 | Shell |
| `/admin/login` | `AdminLoginPage.jsx` | — | Standalone — no admin chrome |

**Pattern:** list screens pair `Badge` (status) with `Modal` (create/edit) and add `Pagination`
once the dataset is unbounded (orders, inventory, security logs). Reporting screens
(analytics, finance) use `EmptyState` but no modals — they are read-only.

**`DocumentBuilder`** is the odd one out: a single-purpose builder for quotations, invoices, and
receipts, with options for project fee, deposit, discount, and miscellaneous fees. It renders inside
the shell without a table, and posts to the backend document/PDF generation pipeline
(`backend/src/lib/documentTemplates.js`, `invoiceGenerator.js`, Puppeteer).

---

## 8. Page Authoring Checklist

When adding a page:

1. Create it in `src/pages/` (public) or `src/pages/admin/` (admin), `PascalCase.jsx`.
2. Render `<SEO title=… description=… />` as the first element — with `jsonLd` if the page
   represents a product, article, or the business.
3. Register the route in `App.jsx`; `lazy()` it unless it is storefront-critical.
4. Admin pages go inside the `AdminProtectedRoute` → `AdminLayout` nesting, and wrap their body
   in `<AdminPageShell>`.
5. Add the sidebar entry with its `permission` if the page needs navigation.
6. Handle all four states explicitly: loading (skeletons), empty (`EmptyState`),
   error (toast), and populated. See `UI_PATTERNS.md`.
