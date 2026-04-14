# Frontend Architecture

> React SPA patterns, folder structure, and conventions for EM Furniture and Interior.

---

## 1. Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 19.1.0 |
| Bundler | Vite | 7.0.0 |
| Routing | React Router DOM | 7.6.3 |
| State | Zustand | 5.0.6 |
| HTTP client | Axios | 1.10.0 |
| Styling | Tailwind CSS + DaisyUI | 4.1.11 / 5.0.43 |
| Animations | Framer Motion | 12.20.1 |
| Icons | Lucide React | — |
| Rich text | TinyMCE React | 6.2.1 |
| Toast | react-hot-toast | 2.5.2 |
| Cookies | js-cookie | 3.0.5 |
| Testing | Vitest + React Testing Library | 3.2.4 |
| Linting | ESLint | 9.29.0 |

---

## 2. Project Structure

```
frontend/
├── index.html              # Vite entry HTML
├── package.json            # Dependencies, scripts
├── vite.config.js          # Vite + React + Tailwind plugins, @/ alias
├── vitest.config.js        # Test configuration (jsdom, v8 coverage)
├── eslint.config.js        # ESLint 9 flat config
├── public/
│   └── site.webmanifest    # PWA manifest
└── src/
    ├── main.jsx            # ReactDOM.createRoot + BrowserRouter
    ├── App.jsx             # Route definitions (40+ routes)
    ├── index.css           # Tailwind directives + global styles
    ├── pages/              # One component per route
    │   └── admin/          # Admin-specific pages
    ├── components/         # Shared UI components
    │   └── admin/          # Admin-specific components
    ├── store/              # Zustand stores (one per domain)
    ├── lib/                # Shared utilities
    │   ├── axios.js        # Axios instance with env-based baseURL
    │   ├── animations.js   # Framer Motion presets
    │   └── permissions.js  # Permission constants (mirrors backend)
    └── __tests__/          # Vitest test suites
```

---

## 3. Routing (App.jsx)

### Public Routes

| Path | Component | Auth |
|------|-----------|------|
| `/` | HomePage | None |
| `/shop` | Shop | None |
| `/styles/:style` | Styles | None |
| `/product/:productId` | ProductPage | None |
| `/compare` | CompareProducts | None |
| `/collection/:collectionId` | CollectionDetailPage | None |
| `/cart` | CartPage | None |
| `/wishlist` | WishlistPage | None |
| `/checkout` | CheckoutPage | None |
| `/payment/verify` | PaymentVerify | None |
| `/order-confirmation/:orderId` | OrderConfirmationPage | None |
| `/orders` | OrderHistoryPage | None |
| `/track-order` | TrackOrderPage | None |
| `/notifications` | NotificationsPage | None |
| `/loyalty` | LoyaltyPage | None |
| `/blog` | Blog | None |
| `/blog/:slug` | BlogPost | None |
| `/faqs` | FAQ | None |
| `/consultation` | Consultation | None |
| `/projects` | ProjectsPage | None |
| `/project/:id` | ProjectDetailPage | None |
| `/e-catalog` | ECatalog | None |
| `/showroom` | Showroom | None |
| `/aboutUs` | AboutUs | None |
| `/contact` | Contact | None |
| `/terms` | Terms | None |
| `/privacy` | Privacy | None |

### Auth Routes

| Path | Component | Behaviour |
|------|-----------|-----------|
| `/signup` | SignupPage | Redirects to LoginPage if already authed |
| `/profile` | ProfilePage | Requires auth (redirects admin to dashboard) |
| `/login` | LoginPage | (via signup redirect) |
| `/reset-password/:token` | ResetPasswordPage | Token-based reset |

### Admin Routes (Protected by `AdminProtectedRoute`)

| Path | Component |
|------|-----------|
| `/admin/login` | AdminLoginPage (guarded by `AdminLoginProtectedRoute`) |
| `/admin/dashboard` | Dashboard |
| `/admin/products/new` | AddProductPage |
| `/admin/products/edit/:productId` | EditProductPage |
| `/admin/collections/new` | AddCollection |
| `/admin/collections/edit/:collectionId` | EditCollection |
| `/admin/addProject` | AddProjectPage |
| `/admin/editProject/:projectId` | EditProjectPage |
| `/admin/coupons` | CouponManagement |
| `/admin/orders` | OrderManagement |
| `/admin/reviews` | ReviewModeration |
| `/admin/consultations` | ConsultationManagement |
| `/admin/designers` | DesignerManagement |
| `/admin/marketing` | MarketingManagement |
| `/admin/inventory` | InventoryManagement |
| `/admin/finance` | FinanceReports |
| `/admin/analytics` | AnalyticsDashboard |
| `/admin/security-logs` | SecurityLogs |

---

## 4. State Management — Zustand Stores (15)

Each store follows the pattern:
```javascript
export const useDomainStore = create((set, get) => ({
  // State
  data: [],
  isLoading: false,
  error: null,

  // Actions
  fetchData: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get('/endpoint');
      set({ data: res.data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      toast.error(error.response?.data?.message || 'Error');
    }
  },
}));
```

### Store Catalogue

| Store | State | Key Actions |
|-------|-------|------------|
| `useAuthStore` | authUser, isLoading, isAdmin, isAuthReady, permissions | checkAuth, signup, login, logout, forgotPassword, resetPassword, changePassword, updateProfile, deleteAccount |
| `useProductsStore` | products[], currentPage, hasMoreProducts, currentFilters | getProducts (paginated + filtered), getProductsByIds |
| `useCollectionStore` | collections[], currentPage, hasMoreCollections | getCollections (paginated + filtered) |
| `useCartStore` | cart[], isGettingCart, isAddingToCart | getCart, addToCart, removeFromCart, updateCartItemQuantity |
| `useWishlistStore` | wishlist[], isGettingWishlist | getWishlist, addToWishlist, removeFromWishlist |
| `useCouponStore` | appliedCoupon, couponCode, discount, isValidating | validateCoupon, removeCoupon |
| `useOrderStore` | orders[], currentOrder, isCreatingOrder | createOrder, getMyOrders, getOrderById, trackOrder, downloadInvoice |
| `useCompareStore` | compareIds[], maxItems (4) | addToCompare, removeFromCompare |
| `useNotificationStore` | notifications[], unreadCount, isLoading | getNotifications, markAsRead, markAllRead, deleteNotification |
| `useLoyaltyStore` | summary, history[], isLoading | getSummary, getHistory |
| `useBlogStore` | posts[], total, page, limit, activePost | getBlogPosts, getBlogPostBySlug, admin CRUD |
| `useFaqStore` | faqs[], isLoading | getFAQs, admin CRUD |
| `useAdminStore` | isSidebarOpen, loading states | toggleSidebar, adminLogin, product/collection/project CRUD |
| `useMarketingStore` | banners[], flashSales[], isLoading | getActiveBanners (filtered by position), getActiveFlashSales (active only with countdown data). Used on public pages: HomePage, Shop, ProductPage, CollectionDetailPage |

### Persistence Strategy

| Data | Storage | Condition |
|------|---------|-----------|
| Cart | localStorage | Cookie consent accepted |
| Cart | sessionStorage | Default (no consent) |
| Wishlist | localStorage | Cookie consent accepted |
| Wishlist | sessionStorage | Default (no consent) |
| Compare list | localStorage | Cookie consent accepted |
| Compare list | sessionStorage | Default (no consent) |
| Auth | HTTP-only cookie | Always (server-managed) |

---

## 5. Component Patterns

### Page Components

- Located in `src/pages/` (public) and `src/pages/admin/` (admin)
- Each renders a full page for a route
- Wrapped in Framer Motion `<motion.div>` for page transitions
- Access stores via hooks: `const { data, fetchData } = useDomainStore()`

### Shared Components

| Component | Purpose |
|-----------|---------|
| `Navbar` | Top navigation, auth-aware, responsive |
| `BottomNavbar` | Mobile bottom navigation bar |
| `Footer` | Site footer with links |
| `CookieConsentBanner` | GDPR-style cookie consent |
| `FilterModal` | Product filtering (category, style, price) |
| `ProjectCard` | Portfolio project card |
| `ProjectCardHome` | Compact project card for homepage |
| `AdminProtectedRoutes` | Route guard — redirects non-admins |
| `AdminLoginProtectedRoute` | Redirects already-logged-in admins |
| `AdminSidebar` | Admin panel navigation sidebar |

### Admin Components (`components/admin/`)

Dedicated admin UI components for management pages (product forms, order tables, etc.).

---

## 6. Styling System

### Tailwind CSS 4 + DaisyUI 5

- **Global styles** in `src/index.css` (Tailwind directives)
- **Component styling** via utility classes in JSX
- **DaisyUI theme** for consistent design tokens
- **Responsive** via Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`

### Animation System (Framer Motion)

Shared presets defined in `lib/animations.js`:

| Preset | Type | Use |
|--------|------|-----|
| `luxuryEase` | Easing curve | Page transitions |
| `elegantEase` | Easing curve | Component entrances |
| `softBounce` | Easing curve | Interactive elements |
| `silkEase` | Easing curve | Subtle animations |
| Fade/slide variants | Animation variants | Route transitions |
| AnimatePresence | React component | Enables exit animations |

---

## 7. API Client (`lib/axios.js`)

```javascript
const axiosInstance = axios.create({
  baseURL: import.meta.env.MODE === 'development'
    ? 'http://localhost:5000/api'
    : '/api',
  withCredentials: true,  // Send cookies with every request
});
```

- All stores use this shared instance
- Cookies sent automatically (JWT, anonymousId)
- Environment-aware base URL

---

## 8. Authentication Flow (Frontend)

### On App Mount

```
App.jsx useEffect
  → useAuthStore.checkAuth()
  → GET /api/auth/check (with cookie)
  → If valid: set authUser, isAdmin, permissions
  → If invalid: set authUser = null
```

### Route Guards

| Guard | Component | Behaviour |
|-------|-----------|-----------|
| Admin pages | `<AdminProtectedRoute />` | Checks `isAdmin` from auth store, redirects to login |
| Admin login | `<AdminLoginProtectedRoute />` | Redirects to dashboard if already admin |
| Profile | Inline check in `App.jsx` | Admin → dashboard, authed → profile, else → login |

---

## 9. Testing

| Aspect | Detail |
|--------|--------|
| Framework | Vitest 3.2.4 |
| Environment | jsdom |
| UI Tools | React Testing Library |
| Coverage | v8 provider (text, json, html reports) |
| Setup | `src/__tests__/setup.js` |
| Total tests | 43 |
| Pass rate | 100% |
| Duration | ~2.2 seconds |
| Excludes | node_modules, __tests__, config files, main.jsx |
