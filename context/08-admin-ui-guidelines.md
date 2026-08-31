# 08 — ERP Console UI Guidelines

> Design tokens, layout shells, and the component kit for `apps/erp`.

---

## 0. Hard constraint: the UI does not change

**The replatform must be visually invisible.** Splitting the apps, moving to Supabase auth, and migrating
to PostgreSQL are infrastructure changes. A user opening the storefront or the console the day after
cutover must not be able to tell that anything happened.

This is a requirement, not a preference, and it governs every decision in this document:

1. **No redesign, no re-theming, no component rewrites during R1–R4.** Files move between workspaces;
   their contents do not change except for import paths.
2. **`index.css` moves verbatim.** The daisyUI theme block in §1 is copied byte-for-byte into
   `packages/config`. Both apps import the same token source, so they cannot drift apart.
3. **`packages/ui` is an extraction, not a rewrite.** Every component in `frontend/src/components/ui/`
   moves as-is. If a component needs changing to be shared, that is a signal the boundary is wrong —
   fix the boundary, not the component.
4. **Tailwind config, fonts, spacing scale and daisyUI version are pinned** across both apps. A version
   bump during the split is a change to the UI by another name.
5. **Visual regression is part of the exit criteria.** Capture reference screenshots of every storefront
   and console page *before* R1 begins, and diff against them after. Playwright's screenshot comparison
   is already available and is the cheapest possible insurance here.
6. **Any deliberate visual change ships as its own separate commit, after R4**, so it can be reviewed,
   attributed, and reverted independently of the migration.

The additions in §2 below are **new screens only** — components required by ERP modules that do not exist
yet. They adopt the existing tokens and shells. Nothing in §2 alters an existing screen.

---

## 1. Design tokens `[NOW]`

Defined in `frontend/src/index.css` as a daisyUI 5 theme plugin block. These carry over to the split
console unchanged — the identity is already established and does not need revisiting.

| Token | Value | Role |
|---|---|---|
| `--color-primary` | `#151f19` | Deep forest green — primary actions, headers |
| `--color-primary-content` | `#ffffff` | On-primary text |
| `--color-secondary` | `#c9a84c` | Brass — accents, the rule under page titles |
| `--color-accent` | `#e8d5a3` | Pale gold — highlights, selected states |
| `--color-neutral` | `#2d2d44` | Ink — body text |
| `--color-base-100` | `#fdfbf7` | Page ground |
| `--color-base-200` / `300` | `#f5f0e6` / `#ebe3d5` | Surfaces, borders |
| `--color-info` / `success` / `warning` / `error` | `#3b82f6` / `#22c55e` / `#f59e0b` / `#ef4444` | Semantic only |

**Rule:** semantic colours are for state, never for decoration. A brass accent on a KPI tile is
decoration; a red pill on an overdue invoice is state. Financial screens depend on that distinction being
reliable.

**Note `[GAP]`:** the theme declares `themes: light --default` with no dark variant. An operations console
is looked at all day, so a dark theme is worth having eventually — but it is a **visual change and
therefore out of scope for R1–R4** under §0. If it is wanted, structure new ERP screens to read every
colour from a token (never a literal) so the theme can be added later without touching components, and
ship the theme itself as a separate, reviewable change after the replatform lands.

---

## 2. Component kit `[NOW]`

`frontend/src/components/ui/` → `packages/ui` after the split. Barrel-exported via `index.js`.

`Badge` · `Button` · `Card` · `EmptyState` · `Input` · `Modal` · `PageHeader` · `Pagination` · `Select` ·
`Skeleton` · `Textarea`

Console-specific shells in `frontend/src/components/admin/` → `apps/erp`:

`AdminLayout` · `AdminHeader` · `AdminSideBar` · `AdminPageShell` · `AdminBreadcrumb` · `AdminTable`

`AdminPageShell` establishes the standing page pattern — title, brass rule, optional subtitle, right-aligned
action cluster, then content. Every console page uses it; new ERP screens must not invent their own header.

### Additions required for ERP `[TARGET]`

| Component | Why |
|---|---|
| `DataTable` | Server-side sort, filter, pagination, column visibility, CSV export. `AdminTable` is presentational only and will not carry a 50,000-row ledger. |
| `MoneyInput` / `Money` | Integer minor units in, formatted NGN out. Money must never be typed into a bare `Input` — that is how float bugs re-enter. |
| `DateRangePicker` | Every financial report is date-scoped. Currently reimplemented per page. |
| `StatusPill` | One mapping from lifecycle status to semantic colour, shared across orders, documents, projects, POs. |
| `ApprovalBanner` | Standing affordance for the segregation-of-duties flow: who raised it, what is needed, approve/reject. |
| `AuditTrail` | Append-only event list, used on every record with a history. |
| Charts | No charting library is installed `[GAP F-13]`. ERP reporting is unreadable without one. |

---

## 3. Layout

Sidebar navigation is grouped and permission-filtered (`AdminSideBar.jsx`), which is the right structure —
groups collapse, and items the actor lacks permission for are not rendered. Current groups: Catalog,
Content, Sales, Marketing, Reports, Customer.

`[TARGET]` groups, adding: **Finance** (ledger, invoices, expenses, payables, receivables, reconciliation,
period close), **Purchasing** (suppliers, purchase orders, goods receipt), **Projects**.

`[GAP]` — six sidebar items route to `/admin/dashboard` with a `section` query rather than to real URLs.
That breaks deep linking, browser history and bookmarking for Products, Collections, Projects, Blog and
FAQs. Fix during the split: every console screen gets its own route.

---

## 4. Conventions for financial screens

1. **Tabular numerals everywhere digits align.** `font-variant-numeric: tabular-nums` on every money
   column, or the eye cannot scan a ledger.
2. **Right-align amounts, left-align labels, and show the currency once** in the column header.
3. **Never render a computed total the server did not send.** Client-side arithmetic on money is how the
   UI and the ledger disagree.
4. **Immutable records must look immutable.** Posted entries, receipts and credit notes get no edit
   affordance — the action is "reverse", not "edit".
5. **Every destructive or financial action states its consequence in the button.** "Post to ledger", not
   "Save". "Approve refund of ₦120,000", not "Confirm".
6. **Empty states carry the next action**, using `EmptyState`. An accountant landing on an empty
   reconciliation screen should see how to import a statement.
