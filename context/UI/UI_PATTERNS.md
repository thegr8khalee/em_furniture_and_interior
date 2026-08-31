# UI Patterns

> The recurring interaction and state patterns every screen follows.
> Read this before building a new page — most decisions are already made.

---

## 1. The Four States

Every data-driven surface handles four states explicitly. Skipping one is a review finding.

| State | Public pages | Admin pages |
|-------|--------------|-------------|
| **Loading** | `ProductCardSkeleton` / `ListItemSkeleton` grids, or `SkeletonBlock` | `AdminTable loading` (5 pulse rows), `SkeletonGrid` |
| **Empty** | `<EmptyState icon title description actionLabel actionTo />` | `<EmptyState />` or `AdminTable emptyMessage` |
| **Error** | `toast.error(...)` raised inside the store action | same |
| **Populated** | grid / list / table | `AdminTable` + `renderRow` |

Skeletons are never spinners in content areas — full-screen spinners are reserved for
route-level `Suspense` (`RouteFallback` in `App.jsx`) and inline button loading (`Button isLoading`).

---

## 2. Feedback: toasts, not inline banners

`<Toaster />` from `react-hot-toast` is mounted once in `App.jsx`. Store actions own the
messaging — the standard store `catch` block is:

```js
catch (error) {
  set({ error: error.message, isLoading: false });
  toast.error(error.response?.data?.message || 'Error');
}
```

Consequences for page code:

- Do **not** keep local `successMessage` / `errorMessage` state. `Profile.jsx` documents this
  explicitly in a comment: messages "are now handled by react-hot-toast directly from store actions".
- Field-level validation is the exception — that belongs on the control via
  `<Input error="…" />`, which renders the message beneath the field in `text-error`.

---

## 3. Forms

| Rule | Detail |
|------|--------|
| Labels stack above fields | Enforced globally by the `.label` override in `index.css`, and by the primitives |
| Label style | `text-xs font-semibold uppercase tracking-[0.16em] text-neutral/65` |
| Required marker | Gold `*` appended by the primitive when `required` |
| Field id | Falls back to `name` — always pass `name` so the label associates |
| Error vs hint | `error` suppresses `hint`; only one line renders |
| Focus | Gold border + `ring-2 ring-secondary/30` |
| Submit | `<Button isLoading={isSubmitting}>` — never a separate spinner |

Long editors (`AddProductPage`, `CheckoutPage`) group fields into titled sections rather than
using a multi-step wizard.

**Rich text:** blog content uses `@tinymce/tinymce-react` in `BlogManagement`; its HTML output is
rendered on `/blog/:slug`, and `stripHtml`/`truncate` from `lib/seo.js` derive meta descriptions from it.

---

## 4. Modals

Two distinct patterns coexist:

1. **`ui/Modal`** — the standard. Backdrop click and <kbd>Esc</kbd> close it, body scroll locks
   while open, `role="dialog"` + `aria-modal="true"`. Used across admin create/edit flows.
2. **`FilterModal`** — a bespoke sheet with internal temp state. It re-syncs from props on open,
   commits on Apply, and resets both temp and parent state on Clear. This "temp state + explicit
   apply" pattern is the right one for any filter surface; do not live-apply filters as the user types.

Neither implements a focus trap. If you add one, add it to `ui/Modal` so every consumer benefits.

---

## 5. Tables (admin)

Always `AdminTable`. It supplies the `Card padding="p-0"` wrapper, `overflow-x-auto`,
the styled header row, the loading skeleton, and the empty cell. The page supplies `columns`
and a `renderRow` that owns its `<tr key>` and `px-6 py-3` cells.

- Right-align numeric columns with `align: 'right'`.
- Status cells render `<Badge status={row.status} />` — never a hand-coloured span.
- Row actions go last, as `Button variant="ghost" size="sm"` or `variant="icon"`.
- Add `<Pagination>` beneath the table once the dataset is unbounded.

---

## 6. Lists & Grids (storefront)

- Product/collection grids are responsive Tailwind grids of bordered cards.
- Cards lift on hover with `.card-hover`; images zoom inside `.img-zoom`.
- Horizontal scroll strips (featured rows) use `.no-scrollbar`.
- Grid entrances use `StaggerContainer` + `StaggerItem` with `cardItem` / `cardItemScale`,
  `once: true` so content does not re-animate on scroll-back.

---

## 7. Status Vocabulary

Drive colour from `Badge`'s `status` map rather than inventing variants:

| Domain | Values |
|--------|--------|
| Order lifecycle | `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded` |
| Payment | `paid`, `failed` |
| Notification | `unread`, `read` |

A new status needs a new entry in `statusToVariant` in `ui/Badge.jsx` — add it there, not at the call site.

---

## 8. Motion Discipline

| Context | Treatment |
|---------|-----------|
| Route change (public) | `AnimatePresence mode="wait"` keyed on pathname; `PageWrapper` / `pageTransition` |
| Route change (admin) | Fast and flat: 0.2s `easeOut`, 6px rise |
| Section entrance | `whileInView` with `viewport={{ once: true, amount: 0.2 }}` |
| Headings | Blur-to-sharp (`heroText`, `AnimatedText`) |
| Grids | Stagger 0.08–0.2s |
| Scroll-linked | Only `ScrollReveal` and `ParallaxSection` — use sparingly, they run every frame |
| Interaction | `whileTap={{ scale: 0.9 }}` on nav buttons; `luxuryHover` / `luxuryTap` elsewhere |

Rules of thumb: **never** animate the same element on every scroll pass (`once: true`);
keep admin motion under 250ms; storefront reveals sit in the 0.6–1.2s range.

There is currently **no `prefers-reduced-motion` handling** — a known gap worth closing centrally
in `lib/animations.js` rather than per component.

---

## 9. Responsive Rules

| Concern | Rule |
|---------|------|
| Breakpoint that matters most | `lg` (1024px) — bottom nav appears below it, admin sidebar collapses below it |
| Page padding | Prefer `.section-shell` / `.content-shell` over ad-hoc `px-*` |
| Wide content | Must scroll inside its own container (`overflow-x-auto`), never widen the page — `html`/`body`/`#root` clip horizontal overflow |
| Mobile FAB clearance | Fixed bottom-right elements need `bottom-25 lg:bottom-6` to clear the tab bar |
| Admin actions | `AdminPageShell` actions wrap with `flex-wrap` on narrow screens |
| Tables on mobile | Scroll horizontally inside `AdminTable`; do not build a separate card view |

---

## 10. Accessibility — current state

Implemented:

- `aria-label` on every icon-only button and nav item (`Button ariaLabel`, `BottomNavbar`, the WhatsApp FAB).
- `role="dialog"` + `aria-modal="true"` + `Esc` handling on `ui/Modal`.
- `htmlFor` / `id` association on all form primitives.
- `focus-visible` rings (gold) on buttons and fields; native outlines are replaced, not removed.
- Semantic headings — `PageHeader` and `AdminPageShell` both emit a real `h1`.
- `alt` text on images; `PageHeader` falls back to `title`.

Known gaps (document them, don't silently work around them):

- No focus trap or focus restoration in `ui/Modal`.
- No `prefers-reduced-motion` support.
- No skip-to-content link.
- Gold `#c9a84c` on white is below WCAG AA for small body text — it is used for accents,
  borders, and large/uppercase micro-labels rather than paragraph copy. Keep it that way.

---

## 11. Persistence & Consent

`CookieConsentBanner` gates storage choice. Once consent is granted, cart, wishlist, and compare
state persist in `localStorage`; without it they fall back to `sessionStorage`. Auth is always an
HTTP-only cookie, server-managed. The banner shows only when `!authUser && isAuthReady`.

Any new client-persisted state must respect the same consent switch.

---

## 12. Data Access from the UI

- Pages read and mutate through **Zustand stores** (`src/store/use*Store.js`), one per domain.
- Stores share the single `axiosInstance` from `lib/axios.js` (`withCredentials: true`,
  base URL `http://localhost:5000/api` in dev, `/api` in production).
- Calling `axiosInstance` directly from a component is a deliberate exception, not the norm —
  it currently happens only in `AdminDashboardContent` for the recent-orders strip.
- Permission checks in the UI use `hasPermission(PERMISSIONS.X)` from `useAuthStore`, with
  `PERMISSIONS` imported from `lib/permissions.js` (which mirrors `backend/src/lib/permissions.js`).
  UI gating is cosmetic; the backend re-checks every request.
