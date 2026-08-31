# Component Library

> Every reusable UI component, its props, and how to use it.
> Sources: `frontend/src/components/ui/`, `components/animations/`, `components/`, `components/admin/`.

---

## 1. Primitives — `components/ui/`

Barrel export: `import { Button, Input, Card } from '@/components/ui'`
(in practice imported by relative path — see the alias note at the bottom of this doc).

`ui/index.js` re-exports: `Button`, `Input`, `Select`, `Textarea`, `Card`, `EmptyState`,
`PageHeader`, `Badge`, `Modal`, `Pagination`, and `export * from './Skeleton'`.

Each primitive uses a local `cn` helper — `(...classes) => classes.filter(Boolean).join(' ')`.
There is no `clsx`/`tailwind-merge` dependency.

---

### Button

Polymorphic: renders `<Link>` when `to` is set, `<a>` when `href` is set, otherwise `<button>`.

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `variant` | see table below | `'elegant'` | Falls back to `elegant` for unknown values |
| `size` | `sm \| md \| lg \| icon` | `'md'` | Forced to `icon` sizing when `variant="icon"` |
| `leftIcon` / `rightIcon` | Lucide component | — | Passed as a component, not an element |
| `isLoading` | boolean | `false` | Swaps left icon for a spinning `Loader2`, hides right icon, disables the button |
| `fullWidth` | boolean | `false` | Adds `w-full` |
| `to` | string | — | Renders a router `Link` |
| `href` | string | — | Renders an anchor |
| `ariaLabel` | string | — | Required in practice for icon-only buttons |
| `disabled` | boolean | — | Adds `cursor-not-allowed opacity-70` |
| `className` | string | `''` | Appended last, so it wins |

**Variants**

| Variant | Rendering |
|---------|-----------|
| `elegant` | `.btn-elegant` — solid green, hovers gold (default CTA) |
| `elegant-outline` | `.btn-elegant-outline` — bordered, inverts on hover |
| `primary` | DaisyUI `btn btn-primary rounded-none shadow-none` |
| `secondary` | DaisyUI `btn btn-secondary rounded-none shadow-none` |
| `ghost` | DaisyUI `btn btn-ghost rounded-none shadow-none` |
| `danger` | `btn btn-error text-white rounded-none shadow-none` |
| `icon` | Square bordered icon button; hovers to gold border + gold icon, gold focus ring |

**Sizes** — `sm` `min-h-9 px-3 text-xs` · `md` `min-h-11 px-4 text-sm` · `lg` `min-h-12 px-6 text-sm` · `icon` `h-10 w-10 p-0`.
Icon glyph sizes track the size: 16 / 18 / 18 / 18.

```jsx
<Button to="/consultation" leftIcon={CalendarDays}>Book a consultation</Button>
<Button variant="danger" isLoading={isDeleting} onClick={remove}>Delete</Button>
<Button variant="icon" ariaLabel="Add to wishlist" onClick={fav}><Heart size={18} /></Button>
```

---

### Input / Select / Textarea

The three share an identical contract and identical field styling.

| Prop | Type | Notes |
|------|------|-------|
| `label` | string | Rendered as a stacked uppercase micro-label |
| `required` | boolean | Appends a gold `*` to the label |
| `error` | string | Red border + red ring + the message below the field |
| `hint` | string | Muted helper text below — **suppressed when `error` is set** |
| `id` | string | Falls back to `props.name` for the label's `htmlFor` |
| `icon` | Lucide component | **`Input` only** — 16px glyph at `left-4`, adds `pl-11` to the field |
| `wrapperClassName` | string | On the outer `div` |
| `inputClassName` | string | **`Input` only** — applied before `className` |
| `className` | string | On the control itself |

Field styling (all three): `w-full border border-base-300 bg-white px-4 py-3 text-sm`,
focus → `border-secondary` + `ring-2 ring-secondary/30`, error → `border-error` + `ring-error/25`.

```jsx
<Input label="Email" name="email" type="email" required icon={Mail} error={errors.email} />
<Select label="Category" name="category" hint="Filters the catalogue">
  <option value="">All</option>
</Select>
<Textarea label="Notes" name="notes" rows={4} />
```

---

### Card

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `as` | element type | `'div'` | Rendered via `createElement` — use `'section'`, `'article'`, `Link`, … |
| `hover` | boolean | `false` | Adds `.card-hover` lift |
| `padding` | string | `'p-6'` | Pass `'p-0'` for flush content (tables, images) |
| `className` | string | `''` | |

Base: `border border-base-300 bg-white`. All remaining props spread onto the element.

---

### Badge

Status pill: `inline-flex border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]`.

| Prop | Notes |
|------|-------|
| `variant` | `neutral \| primary \| secondary \| success \| warning \| error \| info` |
| `status` | A status string; auto-maps to a variant and is used as the label when no children |
| `children` | Overrides `status` as the label |

**Status → variant map** (case-insensitive): `pending`→warning · `confirmed`→primary ·
`processing`→secondary · `shipped`→info · `delivered`→success · `cancelled`→error ·
`refunded`→error · `paid`→success · `failed`→error · `unread`→primary · `read`→neutral.
Anything unmapped falls back to `neutral`.

```jsx
<Badge status={order.status} />          {/* label + colour both derived */}
<Badge variant="secondary">Featured</Badge>
```

---

### Modal

| Prop | Notes |
|------|-------|
| `isOpen` | Returns `null` when false — nothing mounts |
| `onClose` | Fired by backdrop click and by <kbd>Esc</kbd> |
| `title` | Rendered as `font-heading text-2xl`; also becomes the `aria-label` |
| `className` | On the panel (override `max-w-2xl` here) |

Behaviour: fixed `z-[100]` backdrop at `bg-black/50`; sets `document.body.style.overflow = 'hidden'`
while open and restores it on unmount; panel stops click propagation; `role="dialog"` + `aria-modal="true"`.
There is no focus trap and no built-in close button — pages supply their own.

---

### Pagination

| Prop | Default |
|------|---------|
| `currentPage` | `1` |
| `totalPages` | `1` |
| `onPageChange(page)` | — |

Renders `null` when `totalPages <= 1`. Shows a sliding window of page numbers
(`slice(currentPage - 3, currentPage + 2)`) between Previous/Next ghost buttons;
the active page renders as `variant="primary"`.

---

### Skeleton (named exports)

| Export | Shape |
|--------|-------|
| `SkeletonBlock` | Bare `animate-pulse bg-base-200` div; size it with `className` |
| `ProductCardSkeleton` | Bordered card: `h-60` image + title/price/button bars |
| `ListItemSkeleton` | 16×16 thumb + two text bars in a bordered row |
| `TableRowSkeleton` | `columns` prop (default 4) — a CSS-grid row of bars |

---

### EmptyState

| Prop | Notes |
|------|-------|
| `icon` | Lucide component, rendered at 60px in `text-neutral/30` |
| `title` | `font-heading text-2xl` |
| `description` | Muted, `max-w-md`, centred |
| `actionLabel` | Renders a `Button` only when present |
| `actionTo` / `onAction` | Link target / click handler for that button |

Container: `border border-base-300 bg-white px-6 py-14 text-center`.

---

### PageHeader

The public-site hero band. Animated on mount (not scroll).

| Prop | Default | Notes |
|------|---------|-------|
| `title` | — | Blur-to-sharp entrance, `text-3xl sm:text-4xl lg:text-5xl` white |
| `subtitle` | — | Fades in at `delay: 0.25` |
| `image` | — | `motion.img` scaling `1.08 → 1` over 1.2s; falls back to a flat `bg-primary` block |
| `alt` | `title` | |
| `heightClass` | `'h-48 sm:h-56 lg:h-64'` | |
| `overlayClassName` | `'bg-primary/80'` | Scrim over the image |

Includes a `GoldDivider` above the title.

---

## 2. Animation Wrappers — `components/animations/`

Barrel: `components/animations/index.js`.

| Component | Behaviour | Key props |
|-----------|-----------|-----------|
| `FadeIn` | Scroll-triggered fade | — |
| `SlideIn` | Scroll-triggered directional slide | — |
| `StaggerContainer` | `whileInView` parent that staggers children | `staggerDelay` (0.12), `delayChildren` (0.1), `once` (true), `amount` (0.2) |
| `StaggerItem` | Child variant partner for the above | — |
| `SectionReveal` | Section-level entrance | — |
| `AnimatedCard` | Card entrance + hover | — |
| `AnimatedText` | Blur-to-sharp text reveal via `motion.create(Component)` | `as` (`'h2'`), `delay`, `blur` (true), `once` |
| `PageWrapper` | Opacity-only page transition with an `exit` — pair with `AnimatePresence` | `className` |
| `GoldDivider` | The gold rule, drawn `scaleX 0 → 1` from centre | `delay` (0.2), `once` |
| `ScrollReveal` | **Scroll-linked** (not triggered): maps `scrollYProgress` to opacity, `y` 60→0, scale 0.96→1 over `['start end','center center']` | — |
| `ParallaxSection` | Scroll-linked parallax `y` translate over `['start end','end start']` | `speed` (0.15) |

`ScrollReveal` and `ParallaxSection` use `useScroll`/`useTransform` and therefore track the
scroll position continuously; the rest fire once on entry.

---

## 3. Shared Site Components — `components/`

| Component | LOC | Role |
|-----------|-----|------|
| `Navbar` | 754 | Full site chrome — see `LAYOUT_AND_NAVIGATION.md` |
| `BottomNavbar` | 112 | Mobile tab bar (`lg:hidden`) |
| `Footer` | 191 | CTA band, link columns, socials |
| `CookieConsentBanner` | 74 | Consent gate that decides `localStorage` vs `sessionStorage` |
| `FilterModal` | 183 | Shop/collection filter sheet |
| `ProjectCard` | 156 | Portfolio card (listing pages) |
| `ProjectCardHome` | 156 | Compact portfolio card (homepage strip) |
| `SEO` | 91 | Per-page meta via `react-helmet-async` |
| `AdminProtectedRoutes` | 24 | Guard — non-admins bounced to login |
| `AdminLoginProtectedRoute` | 32 | Guard — logged-in admins bounced to dashboard |

### SEO

Wraps `<Helmet prioritizeSeoTags>`. Constants live in `lib/seo.js`
(`SITE_URL`, `SITE_NAME`, `SITE_LEGAL_NAME`, `DEFAULT_OG_IMAGE`, `DEFAULT_DESCRIPTION`, `BUSINESS`,
plus `absoluteUrl`, `stripHtml`, `truncate` helpers).

| Prop | Default | Emits |
|------|---------|-------|
| `title` | — | `{title} \| EM Furniture & Interior`, or the full brand strapline when omitted |
| `description` | `DEFAULT_DESCRIPTION` | `description`, `og:description`, `twitter:description` |
| `image` | `DEFAULT_OG_IMAGE` | `og:image` / `twitter:image`; relative paths are absolutised |
| `imageAlt` | `SITE_NAME` | `og:image:alt`, `twitter:image:alt` |
| `type` | `'website'` | `og:type` |
| `canonical` | current pathname | `<link rel="canonical">` |
| `noindex` | `false` | `noindex, nofollow` vs `index, follow, max-image-preview:large, max-snippet:-1` |
| `keywords` | — | `<meta name="keywords">` |
| `jsonLd` | — | One or many `application/ld+json` blocks (accepts an object or array) |

`og:locale` is fixed to `en_NG`; Twitter card type is `summary_large_image`.
**Every page in `src/pages/` renders `<SEO>`** — treat it as mandatory on any new page.

### FilterModal

Controlled from the parent but keeps **temp state internally** (`tempMinPrice`, `tempIsPromoFilter`, …),
re-syncing from props on open. `handleApply` pushes temps up and calls `onApplyFilters`;
`handleClear` resets both temps and parent state, then calls `onClearFilters`.
Filters: min price, max price, best-seller, promo, foreign. Returns `null` when closed.

---

## 4. Admin Components — `components/admin/`

| Component | LOC | Role |
|-----------|-----|------|
| `AdminLayout` | 46 | Route-level shell: sidebar + header + animated `<Outlet />` |
| `AdminSideBar` | 249 | Permission-filtered grouped navigation |
| `AdminHeader` | 52 | Top bar with sidebar toggle |
| `AdminBreadcrumb` | 68 | Path trail |
| `AdminPageShell` | 20 | Per-page title / gold rule / subtitle / actions header |
| `AdminTable` | 68 | Table wrapper with loading + empty states |
| `AdminDashboardContent` | 341 | Dashboard home: stat cards, quick actions, recent entities |
| `ProductManagement` / `ProductList` | 168 / 224 | Product CRUD section + listing |
| `CollectionManagement` / `CollectionList` | 169 / 222 | Collection CRUD section + listing |
| `ProjectManagement` / `ProjectList` | 167 / 172 | Project CRUD section + listing |
| `BlogManagement` | 178 | Blog post CRUD (TinyMCE editor) |
| `FAQManagement` | 152 | FAQ CRUD |

### AdminPageShell

```jsx
<AdminPageShell title="Orders" subtitle="Fulfilment queue" actions={<Button size="sm">Export</Button>}>
  {content}
</AdminPageShell>
```
Renders an `h1` (`font-heading text-2xl lg:text-3xl`), a `h-0.5 w-12 bg-secondary` gold rule beneath it,
the optional subtitle, and a right-aligned actions cluster that wraps on mobile. Content spacing is `space-y-6`.

### AdminTable

```jsx
<AdminTable
  columns={[{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total', align: 'right' }]}
  data={rows}
  renderRow={(row) => <tr key={row._id}><td className="px-6 py-3">{row.name}</td>…</tr>}
  emptyMessage="No orders found"
  loading={isLoading}
/>
```

| Prop | Default | Notes |
|------|---------|-------|
| `columns` | `[]` | `{ key, label, align?: 'left' \| 'center' \| 'right' }` |
| `data` | `[]` | |
| `renderRow` | — | You own the `<tr>`, including its `key` and cell padding (`px-6 py-3`) |
| `emptyMessage` | `'No data'` | Rendered in a full-width centred cell |
| `loading` | `false` | Renders 5 pulse rows instead of data |

Wrapped in `<Card padding="p-0">` with `overflow-x-auto`, so wide tables scroll rather than
breaking the layout. Header row: `text-[10px] uppercase tracking-[0.14em] text-neutral/40`.

### AdminDashboardContent

Internal (non-exported) sub-components: `StatCard`, `ProductMiniCard`, `CollectionMiniCard`,
`ProjectMiniCard`, `SkeletonGrid`. Stat cards are clickable and navigate to
`/admin/dashboard?section=…`. Recent orders are fetched directly with
`axiosInstance.get('/orders/admin/all?page=1&limit=5')` rather than through a store.

---

## 5. Conventions for New Components

1. **Compose the primitives.** New admin screens should be `AdminPageShell` + `AdminTable` +
   `Modal` + `Badge`; new public screens `PageHeader` + `Card` + `EmptyState`.
2. **Square corners.** Never introduce a border radius outside the documented exceptions.
3. **Borders, not shadows,** for structure: `border border-base-300 bg-white`.
4. **Gold is the only accent.** Active/hover/focus states go gold.
5. **Uppercase micro-labels** for every field label, badge, and table header.
6. **Always render `<SEO>`** on a page component.
7. **Icons come from `lucide-react`** and are passed as components (`icon={Mail}`), not elements.
8. **`className` last** so callers can override; keep the `cn` helper local to the file.

### Import-path note

`frontend/vite.config.js` declares **no** path alias — only `vitest.config.js` maps `@` to `./src`.
Application code therefore uses relative imports (`../../lib/animations`). Do not write `@/…`
in `src/` until the alias is added to the Vite config; it will build-fail even though tests pass.
