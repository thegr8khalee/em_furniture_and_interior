# Layout & Navigation

> App shell, chrome, navigation maps, and route guards.
> Sources: `frontend/src/App.jsx`, `components/Navbar.jsx`, `BottomNavbar.jsx`, `Footer.jsx`, `components/admin/`.

---

## 1. Two Shells

The app has exactly two shells, switched on a single boolean in `App.jsx`:

```js
const isAdminRoute = location.pathname.startsWith('/admin');
```

| | Public shell | Admin shell |
|---|---|---|
| Condition | `!isAdminRoute` | `/admin/*` |
| Chrome | `Navbar`, `BottomNavbar`, `Footer`, WhatsApp FAB, `CookieConsentBanner` | `AdminLayout` (sidebar + header) |
| Page container | `<main>` inside `min-h-screen bg-base-100` | `flex h-screen w-screen overflow-hidden bg-base-200` |
| Scrolling | Whole document | Only `<main>` (`overflow-y-auto`) |
| Transitions | `AnimatePresence mode="wait"` keyed on `location.pathname` | Nested `AnimatePresence` inside `AdminLayout` |

`/admin/login` sits **outside** `AdminLayout` (it is its own route under `AdminLoginProtectedRoute`),
so it renders with no admin chrome and no public chrome either.

---

## 2. Public Shell (`App.jsx`)

Render order:

```
<div className="min-h-screen bg-base-100">
  <Navbar />            ← if !isAdminRoute
  <BottomNavbar />      ← if !isAdminRoute
  <main>
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}> … </Routes>
  <Footer />            ← if !isAdminRoute
  <WhatsApp FAB />      ← if !isAdminRoute
  <CookieConsentBanner /> ← if !authUser && isAuthReady
  <Toaster />           ← react-hot-toast, always
</div>
```

`RouteFallback` is a full-screen centred `Loader2` spinning in `text-secondary` on `bg-base-100`.

### Mount-time bootstrap

One `useEffect` in `App.jsx` fires `checkAuth()`, `getProducts()`, and `getCollections()`
so the catalogue and session are warm before the first route renders.

### WhatsApp floating action button

Fixed, `z-40`, `size-16`, green circle (`bg-green-600`, `hover:bg-green-700`), Cloudinary PNG glyph,
`aria-label="Chat on WhatsApp"`. Position: `bottom-25 right-5`, moving to `lg:bottom-6` so it clears
the mobile bottom nav. Number and preset message are **hard-coded in `App.jsx`** (`2349037691860`).

---

## 3. Navbar (desktop + mobile drawer)

### Structure, top to bottom

1. **Promo bar** — only when `!isAdminRoute && !isPromoDismissed && promoItems.length > 0`.
   Items are built from `useMarketingStore`: active banners with `position === 'home'`
   (sorted by `priority` descending, labelled "Featured Offer") followed by active flash sales
   (labelled "Flash Sale", subtitle rendered as `{n}% off…` or `Save ₦{n} today`).
   Rotates every **4500ms** via `setInterval`, dismissible, click navigates (internal paths
   through the router, external via `window.location.href`).
2. **Main bar** — logo, desktop links, icon cluster.
3. **Mobile drawer** — checkbox-driven (`isDrawerChecked`), with a `categories`/`styles` tab switch.

### Desktop links (in order)

`/shop` · `/projects` · `/showroom` · `/e-catalog` · `/blog` · `/consultation` · `/aboutUs`

Link styling — `getNavLinkClass(isActive)`:
`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] border-b`,
active → `border-secondary text-secondary`, idle → `border-transparent text-neutral/75 hover:text-secondary`.

The mobile drawer additionally exposes `/faqs`.

### Icon cluster

`getIconButtonClass(hasItems)` → `relative h-9 w-9`, gold-tinted (`border-secondary/40 text-secondary`)
when the underlying list is non-empty, otherwise `border-base-300 text-neutral/75`.
Covers search, wishlist, cart, and notifications. The notification bell opens an in-nav dropdown
showing `notifications.slice(0, 4)` with a "view all" link to `/notifications`;
it closes on outside click and on <kbd>Esc</kbd> (both wired with refs + document listeners).

### Drawer taxonomy (hard-coded in `Navbar.jsx`)

**Categories** → `/shop?category=…`: Sofas (`Living Room`), Armchairs, Living Rooms, Bedrooms,
Dining Rooms, Center Tables, Wardrobe, TV unit, Carpets.

**Styles** → `/styles/:style`: Antique/Royal, Bespoke, Contemporary, Glam, Minimalist, Modern
(the source array is `.sort()`ed).

### Admin quick menu

When an admin is signed in, the navbar renders a dropdown of admin links, each gated by
`hasPermission(...)` and filtered with `.filter(item => item.show)`: Dashboard, Orders, Coupons,
Reviews, Consultations, Designers, Marketing, Inventory, Finance, Analytics, Security Logs.

### Scroll state

`scrolled` flips at `window.scrollY > 20` and drives the condensed/elevated navbar treatment.

---

## 4. BottomNavbar (mobile only)

`fixed bottom-0 inset-x-0 z-50 lg:hidden`, white with a `border-t border-base-300/50`,
sliding up on mount (`y: 80 → 0`, `delay: 0.3`, `luxuryEase`).

**Four slots, contents depend on `isAdmin`:**

| Slot | Customer | Admin |
|------|----------|-------|
| 1 | Shop → `/shop` | Shop → `/shop` |
| 2 | Cart → `/cart` | Product → `/admin/products/new` |
| 3 | Wishlist → `/wishlist` | Collection → `/admin/collections/new` |
| 4 | Profile → `/profile` | Dashboard → `/admin/dashboard` |

- Cart and Wishlist show a gold count bubble (`w-4 h-4 rounded-full text-[9px]`) when non-empty.
- Active tab: `text-secondary`, `strokeWidth: 2`, semibold label, plus a shared-layout
  indicator bar (`layoutId="bottomNavIndicator"`, spring 400/30).
- Navigation goes through `handleClick`, which calls `navigate()` then
  `setTimeout(() => window.scrollTo(0, 0), 10)` — the codebase's standard scroll-reset idiom.
- Cart/wishlist are fetched only when `isAuthReady && !isAdmin`.

---

## 5. Footer

Sections: a CTA band (heading + "Book a consultation" `elegant` button in gold + "Visit showroom"
`elegant-outline` in gold), then link columns, socials, and legal line.

| Column | Links |
|--------|-------|
| Quick Links | Shop, E-Catalog, Showroom, Projects, Blog, Track Order |
| Company | About Us, Contact Us, Consultation |
| Legal | Terms & Conditions, Privacy Policy, FAQs |

Column headings: `text-xs font-semibold uppercase tracking-[0.2em] text-secondary`.
Socials (Cloudinary PNGs): WhatsApp, Instagram, TikTok, X.

---

## 6. Admin Shell

### AdminLayout

```
<div className="flex h-screen w-screen overflow-hidden bg-base-200">
  {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={closeSidebar} />}
  <AdminSidebar />
  <div className="flex flex-1 flex-col overflow-hidden">
    <AdminHeader />
    <main className="flex-1 overflow-y-auto p-4 lg:p-8">
      <AnimatePresence mode="wait">
        <motion.div key={location.pathname} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                    transition={{duration:0.2, ease:'easeOut'}}>
          <Outlet />
```

Note the admin transition is deliberately **fast and flat** (0.2s, `easeOut`, 6px) — the
luxury easings are reserved for the storefront. Sidebar open state lives in `useAdminStore`
(`isSidebarOpen`, `toggleSidebar`, `closeSidebar`); below `lg` it becomes an overlay drawer
dismissed by the `bg-black/20` scrim.

### Sidebar navigation map

Every item carries a `permission` and is hidden unless `hasPermission(...)` passes.
Groups are collapsible (local `collapsed` state keyed by group label).

| Group | Item | Target | Permission |
|-------|------|--------|-----------|
| — | Dashboard | `?section=dashboard` | `admin.dashboard.view` |
| Catalog | Products | `?section=products` | `products.manage` |
| Catalog | Collections | `?section=collections` | `collections.manage` |
| Catalog | Projects | `?section=projects` | `projects.manage` |
| Content | Blog | `?section=blog` | `blog.manage` |
| Content | FAQs | `?section=faqs` | `faq.manage` |
| Content | Designers | `/admin/designers` | `designers.manage` |
| Sales | Orders | `/admin/orders` | `orders.view` |
| Sales | Coupons | `/admin/coupons` | `marketing.manage` |
| Sales | Inventory | `/admin/inventory` | `inventory.manage` |
| Sales | Document Builder | `/admin/documents` | `finance.view` |
| Marketing | Promo & Flash Sales | `/admin/marketing` | `marketing.manage` |
| Marketing | Reviews | `/admin/reviews` | `reviews.manage` |
| Reports | Analytics | `/admin/analytics` | `admin.dashboard.view` |
| Reports | Finance | `/admin/finance` | `finance.view` |
| Reports | Security Logs | `/admin/security-logs` | `admin.dashboard.view` |
| Customer | Consultations | `/admin/consultations` | `consultations.manage` |

**The `section` pattern:** Catalog and Content items are not separate routes. They all point at
`/admin/dashboard` with a `?section=` query param; `Dashboard.jsx` reads it with `useSearchParams`
and switches between `AdminDashboardContent`, `ProductManagement`, `CollectionManagement`,
`ProjectManagement`, `BlogManagement`, and `FAQManagement`. Blog and FAQ re-check their permission
inside the switch and render `Access denied.` if it fails — defence in depth behind the sidebar filter.

The sidebar footer shows the admin's initials (derived from `username` or `email`, uppercased,
first two characters), their role with underscores replaced by spaces, and a logout action.

---

## 7. Route Guards

| Guard | Applies to | Behaviour |
|-------|-----------|-----------|
| `AdminProtectedRoute` | Every `/admin/*` page except login | Wraps `AdminLayout`; non-admins redirected to the admin login |
| `AdminLoginProtectedRoute` | `/admin/login` | Already-authenticated admins redirected to the dashboard |
| Inline ternary in `App.jsx` | `/profile` | `isAdmin` → `/admin/dashboard`; `authUser` → `ProfilePage`; else render `LoginPage` |
| Inline ternary in `App.jsx` | `/signup` | `!authUser` → `SignupPage`; else `LoginPage` |
| Permission checks | Sidebar items, admin quick links, dashboard sections | `hasPermission(PERMISSIONS.X)` from `useAuthStore` |

Cart, wishlist, checkout, orders, and loyalty are **not** route-guarded — they work for guests
(identified by an `anonymousId` cookie) and simply show different content when signed out.

---

## 8. Code-Splitting Strategy

`App.jsx` splits deliberately:

- **Eager:** `HomePage`, `Shop`, `ProductPage`, `CollectionDetailPage`, `Styles`, `NotFoundPage`
  — "so the home page has no splash on first paint".
- **Lazy:** all remaining public pages (auth, cart, checkout, content, legal, orders).
- **Lazy:** every admin page *and* `AdminLayout` — "so public visitors never download admin code".

When adding a page: storefront-critical → eager; everything else → `lazy()`.

---

## 9. Scroll Behaviour

- `html { scroll-behavior: smooth }` globally.
- `overflow-x: hidden` on `html`, `body`, and `#root` to contain wide hero/parallax sections.
- Manual scroll reset after navigation uses `setTimeout(() => window.scrollTo(0, 0), 10)`
  (in `BottomNavbar`, `Navbar` category/style handlers, and promo clicks). There is no global
  scroll-restoration component — replicate the idiom on any new programmatic navigation.
