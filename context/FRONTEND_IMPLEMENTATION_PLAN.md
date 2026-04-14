# Frontend Implementation Plan

> Phased build plan for the EM Furniture and Interior frontend (Phases F0–F7).

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed |
| 🔲 | Not started |

---

## Phase F0: Foundation & Scaffolding

> Vite project, routing, auth, global layout.

| # | Task | Status |
|---|------|--------|
| F0.1 | Initialize Vite + React project with Tailwind CSS + DaisyUI | ✅ |
| F0.2 | Configure path aliases (`@/` → `./src`) | ✅ |
| F0.3 | Set up Axios instance with environment-based baseURL (`lib/axios.js`) | ✅ |
| F0.4 | Set up React Router v7 with route definitions (`App.jsx`) | ✅ |
| F0.5 | Auth store (`useAuthStore`) — signup, login, logout, checkAuth, password flows | ✅ |
| F0.6 | Navbar component (responsive, auth-aware) | ✅ |
| F0.7 | BottomNavbar component (mobile navigation) | ✅ |
| F0.8 | Footer component | ✅ |
| F0.9 | Cookie consent banner component | ✅ |
| F0.10 | Framer Motion animation presets (`lib/animations.js`) | ✅ |
| F0.11 | Frontend permissions constants (`lib/permissions.js`) | ✅ |
| F0.12 | Toast notification system (react-hot-toast) | ✅ |
| F0.13 | `AdminProtectedRoute` component (route guard) | ✅ |
| F0.14 | `AdminLoginProtectedRoute` component (redirect if already logged in) | ✅ |

---

## Phase F1: Public Pages & Content

> Static pages, blog, FAQ, projects, showroom, contact.

| # | Task | Status |
|---|------|--------|
| F1.1 | HomePage — hero carousel, featured products/collections, projects, promo banners (home position), flash sale countdown timers | ✅ |
| F1.2 | AboutUs page — company info, team, departments | ✅ |
| F1.3 | Contact page — form (name, email, subject, message) | ✅ |
| F1.4 | Terms page (static) | ✅ |
| F1.5 | Privacy page (static) | ✅ |
| F1.6 | Blog store (`useBlogStore`) — list, detail, admin CRUD | ✅ |
| F1.7 | Blog list page (paginated) | ✅ |
| F1.8 | BlogPost page (by slug) | ✅ |
| F1.9 | FAQ store (`useFaqStore`) — list, admin CRUD | ✅ |
| F1.10 | FAQ page (accordion display) | ✅ |
| F1.11 | ProjectsPage — portfolio listing (paginated) | ✅ |
| F1.12 | ProjectDetailPage — image carousel, details | ✅ |
| F1.13 | ProjectCard + ProjectCardHome components | ✅ |
| F1.14 | ECatalog page (PDF viewer placeholder) | ✅ |
| F1.15 | Showroom page (Google Maps embed) | ✅ |

---

## Phase F2: Product Catalog & Browsing

> Product/collection listing, detail, filtering, comparison.

| # | Task | Status |
|---|------|--------|
| F2.1 | Products store (`useProductsStore`) — list, filter, paginate | ✅ |
| F2.2 | Collection store (`useCollectionStore`) — list, filter, paginate | ✅ |
| F2.3 | Compare store (`useCompareStore`) — add/remove (max 4), localStorage | ✅ |
| F2.3b | Marketing store (`useMarketingStore`) — active banners by position, active flash sales with countdown | ✅ |
| F2.4 | Shop page — product grid, load-more pagination, promo banners (shop position), flash sale countdown timers | ✅ |
| F2.5 | Styles page — filter by style parameter | ✅ |
| F2.6 | ProductPage — detail, gallery, reviews, related items, add to cart/wishlist/compare, promo banners (product position) | ✅ |
| F2.7 | CollectionDetailPage — collection with products, reviews, promo banners (collection position) | ✅ |
| F2.8 | CompareProducts page (side-by-side comparison, max 4) | ✅ |
| F2.9 | FilterModal component (category, style, price range, etc.) | ✅ |

---

## Phase F3: E-Commerce Core

> Cart, wishlist, coupons, checkout, orders, payments.

| # | Task | Status |
|---|------|--------|
| F3.1 | Cart store (`useCartStore`) — CRUD, persistence (localStorage/sessionStorage) | ✅ |
| F3.2 | Wishlist store (`useWishlistStore`) — CRUD, persistence | ✅ |
| F3.3 | Coupon store (`useCouponStore`) — validate, apply, remove | ✅ |
| F3.4 | Order store (`useOrderStore`) — create, list, track, download invoice | ✅ |
| F3.5 | Cart page — item list, quantity controls, coupon input, checkout link | ✅ |
| F3.6 | Wishlist page — item list, move to cart | ✅ |
| F3.7 | CheckoutPage — shipping address, payment method selection, coupon, order summary | ✅ |
| F3.8 | PaymentVerify page — gateway callback handling (Paystack, Flutterwave, Stripe) | ✅ |
| F3.9 | OrderConfirmationPage — order summary, invoice download | ✅ |

---

## Phase F4: Customer Account

> Auth UI, profile, order history, tracking, notifications, loyalty.

| # | Task | Status |
|---|------|--------|
| F4.1 | LoginPage — login form with forgot password link | ✅ |
| F4.2 | SignupPage — registration with anonymousId merge | ✅ |
| F4.3 | ProfilePage — edit info, change password, delete account | ✅ |
| F4.4 | ResetPasswordPage — token-based password reset form | ✅ |
| F4.5 | OrderHistoryPage — past orders with invoice download | ✅ |
| F4.6 | TrackOrderPage — self-serve tracking by order number + email | ✅ |
| F4.7 | Notification store (`useNotificationStore`) — list, read, delete | ✅ |
| F4.8 | NotificationsPage — notification list with read/unread status | ✅ |
| F4.9 | Loyalty store (`useLoyaltyStore`) — summary, history | ✅ |
| F4.10 | LoyaltyPage — points balance + transaction history | ✅ |

---

## Phase F5: Interior Design Module

> Consultation booking page.

| # | Task | Status |
|---|------|--------|
| F5.1 | Consultation page — designer selection, budget range, style preferences, photo/floor plan uploads | ✅ |

---

## Phase F6: Admin Panel

> Dashboard, product/collection/project management, all admin tools.

| # | Task | Status |
|---|------|--------|
| F6.1 | AdminLoginPage — separate admin login | ✅ |
| F6.2 | Admin store (`useAdminStore`) — sidebar, CRUD actions, loading states | ✅ |
| F6.3 | Dashboard page — overview, sidebar navigation | ✅ |
| F6.4 | AdminSidebar component | ✅ |
| F6.5 | AddProductPage — form with TinyMCE, image uploads | ✅ |
| F6.6 | EditProductPage — pre-populated edit form | ✅ |
| F6.7 | AddCollection page — product selection, cover image | ✅ |
| F6.8 | EditCollection page | ✅ |
| F6.9 | AddProject page | ✅ |
| F6.10 | EditProject page | ✅ |
| F6.11 | CouponManagement page (admin) | ✅ |
| F6.12 | OrderManagement page (admin — filters, status updates, payment tracking) | ✅ |
| F6.13 | ReviewModeration page (admin — approve/reject) | ✅ |
| F6.14 | ConsultationManagement page (admin — assign designer, schedule, update status) | ✅ |
| F6.15 | DesignerManagement page (admin — add, activate/deactivate, delete) | ✅ |
| F6.16 | MarketingManagement page (admin — banners + flash sales) | ✅ |
| F6.17 | InventoryManagement page (admin — stock tracking, low-stock filter) | ✅ |
| F6.18 | FinanceReports page (admin — revenue summary, CSV export) | ✅ |

---

## Phase F7: Analytics & Security

> Analytics dashboard, security logs.

| # | Task | Status |
|---|------|--------|
| F7.1 | AnalyticsDashboard page — overview, category, region, product, designer, CLV, funnel | ✅ |
| F7.2 | SecurityLogs page — audit logs, activity logs, filtering, stats panels | ✅ |

---

## Summary

| Phase | Tasks | Completed | Remaining |
|-------|-------|-----------|-----------|
| F0: Foundation | 14 | 14 | 0 |
| F1: Public Pages | 15 | 15 | 0 |
| F2: Product Catalog | 10 | 10 | 0 |
| F3: E-Commerce Core | 9 | 9 | 0 |
| F4: Customer Account | 10 | 10 | 0 |
| F5: Interior Design | 1 | 1 | 0 |
| F6: Admin Panel | 18 | 18 | 0 |
| F7: Analytics & Security | 2 | 2 | 0 |
| **Total** | **79** | **79** | **0** |
