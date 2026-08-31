# Design System

> Brand tokens, typography, colour, spacing, motion, and global utilities.
> Source of truth: `frontend/src/index.css` and `frontend/src/lib/animations.js`.

---

## 1. Design Language

The visual identity is **quiet luxury**: deep forest green, brushed gold, warm off-white
paper tones, serif display headings over a geometric sans body, and — critically —
**zero border radius everywhere**. Nothing in this UI is rounded except badges on
nav icons and the scrollbar thumb. Sharp corners are the signature.

| Principle | Implementation |
|-----------|---------------|
| Sharp, architectural edges | All DaisyUI radius tokens set to `0rem` |
| Gold as the single accent | `#c9a84c` for active states, dividers, focus rings, hovers |
| Generous breathing room | Fluid `--section-x` / `--section-y` clamps |
| Serif/sans pairing | Playfair Display headings, Montserrat body |
| Motion as polish, never noise | Long easings (0.6–1.2s), scroll-triggered, `once: true` |
| Uppercase micro-labels | `text-xs`, `font-semibold`, `tracking-[0.16em]`, uppercase |

---

## 2. Colour Tokens

Defined as a custom DaisyUI theme named `light` (the only theme; no dark mode).

| Token | Hex | Role |
|-------|-----|------|
| `--color-primary` | `#151f19` | Deep forest green — buttons, headers, hero overlays |
| `--color-primary-content` | `#ffffff` | Text on primary |
| `--color-secondary` | `#c9a84c` | Brushed gold — the accent; active nav, dividers, focus |
| `--color-secondary-content` | `#151f19` | Text on gold |
| `--color-accent` | `#e8d5a3` | Pale gold — gradient stops, hover fills |
| `--color-accent-content` | `#151f19` | Text on accent |
| `--color-neutral` | `#2d2d44` | Body text ink (a deep desaturated indigo) |
| `--color-neutral-content` | `#f5f0e8` | Text on neutral |
| `--color-base-100` | `#fdfbf7` | Page background — warm paper white |
| `--color-base-200` | `#f5f0e6` | Raised surface / skeleton fill |
| `--color-base-300` | `#ebe3d5` | Borders — the default border colour everywhere |
| `--color-base-content` | `#2d2d44` | Default content colour |
| `--color-info` | `#3b82f6` | Informational states |
| `--color-success` | `#22c55e` | Delivered / paid |
| `--color-warning` | `#f59e0b` | Pending |
| `--color-error` | `#ef4444` | Cancelled / failed / validation errors |

### Opacity conventions

Text and borders are routinely dimmed with slash opacity rather than new tokens:

| Usage | Class |
|-------|-------|
| Secondary body copy | `text-neutral/60` |
| Form labels | `text-neutral/65` |
| Muted hints | `text-neutral/55` |
| Placeholder text | `placeholder:text-neutral/40` |
| Table column headers | `text-neutral/40` |
| Empty-state icons | `text-neutral/30` |
| Nav links (idle) | `text-neutral/75` |
| Badge tints | `bg-{variant}/10`, `border-{variant}/20` |

---

## 3. Radius

| Token | Value |
|-------|-------|
| `--radius-box`, `--radius-field`, `--radius-selector` | `0rem` |
| `--rounded-btn`, `--rounded-box`, `--rounded-badge` | `0rem` |

Every DaisyUI-derived component is squared off. Where a Tailwind class might reintroduce
a radius, components explicitly pass `rounded-none` (see `Button` variants).
**Exceptions:** cart/wishlist count bubbles in `Navbar`/`BottomNavbar` (`rounded-full`),
the WhatsApp floating action button (`rounded-full`), and the scrollbar thumb.

---

## 4. Typography

| Role | Family | Applied by |
|------|--------|-----------|
| Headings `h1`–`h6` | `'Playfair Display', serif` | Global element selector in `index.css` |
| Body / UI | `'Montserrat', sans-serif` | `body` rule |
| Helper class | `.font-heading` | Playfair Display |
| Helper class | `.font-body` | Montserrat |

### Scale in practice

| Use | Classes |
|-----|---------|
| Hero title | `font-heading text-3xl sm:text-4xl lg:text-5xl font-bold` |
| Page/section title | `font-heading text-2xl lg:text-3xl font-bold` |
| Modal title | `font-heading text-2xl font-semibold` |
| Body | `text-sm` (the default UI size) |
| Micro-label / eyebrow | `text-xs font-semibold uppercase tracking-[0.16em]` |
| Badge text | `text-[11px] font-semibold uppercase tracking-[0.14em]` |
| Table header | `text-[10px] font-semibold uppercase tracking-[0.14em]` |
| Extra small | `.text-xxs` (`0.6rem`) |

Letter-spacing is the workhorse of the luxury feel: `0.14em`–`0.2em` on anything uppercase.

---

## 5. Spacing & Layout Tokens

Declared on `:root`:

| Token | Value | Meaning |
|-------|-------|---------|
| `--section-x` | `clamp(1.5rem, 4vw, 5rem)` | Horizontal section padding |
| `--section-y` | `clamp(4rem, 7vw, 5.5rem)` | Vertical section padding |
| `--container-max` | `80rem` | Max content width |

### Layout helper classes

| Class | Effect |
|-------|--------|
| `.section-shell` | Applies `--section-x` inline / `--section-y` block padding |
| `.content-shell` | `width: min(100%, 80rem)` + auto inline margins |

Typical page section: `<section className="content-shell section-shell">`.

---

## 6. Elevation

| Token | Value | Helper class |
|-------|-------|-------------|
| `--shadow-soft` | `0 10px 30px rgba(21,31,25,.06)` | `.surface-elevated` |
| `--shadow-elevated` | `0 16px 40px rgba(21,31,25,.1)` | `.surface-luxury` |
| `--shadow-luxury` | `0 22px 60px rgba(21,31,25,.14)` | (token only) |

Shadows are tinted with the primary green, never neutral black — they read as depth
in a warm room rather than a drop shadow.

---

## 7. Global Utility Classes

Defined in `index.css` and used throughout the app.

| Class | Effect |
|-------|--------|
| `.btn-elegant` | Solid primary CTA: green fill, white text, uppercase `0.1em` tracking, squared, `min-height 2.75rem`, hovers to gold fill with dark text |
| `.btn-elegant-outline` | Ghost CTA: transparent with `1.5px` green border, inverts to solid green on hover |
| `.link-elegant` | Gold underline that grows from `width: 0` to `100%` on hover via `::after` |
| `.card-hover` | `translateY(-4px)` + softened shadow on hover |
| `.img-zoom` | Wrapper that scales its child `img` to `1.05` over `0.6s` on hover |
| `.text-gold-gradient` | `135deg` gold→pale-gold→gold gradient clipped to text |
| `.divider-gold` | `60×2px` centred gold rule |
| `.no-scrollbar` | Hides scrollbars on horizontal scroll strips |
| `.text-xxs` | `0.6rem` |

### Focus treatment

`.btn-elegant` and `.btn-elegant-outline` drop the native outline and use
`box-shadow: 0 0 0 3px rgba(201,168,76,.28)` on `:focus-visible`.
Form controls use `focus:border-secondary` + `focus-visible:ring-2 focus-visible:ring-secondary/30`.

---

## 8. Global Base Rules

| Rule | Detail |
|------|--------|
| Smooth scrolling | `html { scroll-behavior: smooth }` |
| Horizontal overflow | Clipped on `html`, `body`, and `#root` |
| Font smoothing | `-webkit-font-smoothing: antialiased` |
| Images | `img { display: block }` |
| Transitions | `button, a, input, select, textarea` all transition colour/bg/border/shadow/transform at `0.25s ease` |
| Scrollbar | 6px track `#f9f6f0`, gold thumb `#c9a84c`, hover `#f9e971` |
| DaisyUI `.label` override | Forced to `display: block` so labels stack **above** inputs, with uppercase `0.16em` micro-label styling |

---

## 9. Motion Tokens

From `frontend/src/lib/animations.js`. All are Framer Motion values.

### Easing curves

| Name | Cubic-bezier | Character |
|------|--------------|-----------|
| `luxuryEase` | `[0.25, 0.1, 0.25, 1]` | Smooth deceleration — the default |
| `elegantEase` | `[0.6, 0.01, 0.05, 0.95]` | Dramatic slow-in/slow-out — headings, reveals |
| `softBounce` | `[0.34, 1.56, 0.64, 1]` | Subtle overshoot — counters, numbers |
| `silkEase` | `[0.43, 0.13, 0.23, 0.96]` | Silk-like — slow image reveals |

### Transition presets

| Name | Config |
|------|--------|
| `luxuryTransition` | `0.8s luxuryEase` |
| `elegantTransition` | `1s elegantEase` |
| `slowReveal` | `1.2s silkEase` |
| `springTransition` | spring, stiffness 100, damping 15, mass 0.8 |
| `gentleSpring` | spring, stiffness 60, damping 20, mass 1 |

### Variant catalogue

| Group | Variants |
|-------|----------|
| Fade | `fadeIn`, `fadeInUp` (y 40), `fadeInDown` (y −40), `fadeInLeft` (x −60), `fadeInRight` (x 60) |
| Scale | `scaleIn` (0.9), `scaleInSoft` (0.95) |
| Slide / reveal | `slideUp` (y 80), `slideDown` (y −60), `curtainReveal` (`scaleY` from origin bottom) |
| Stagger containers | `staggerContainer` (0.12s), `staggerContainerSlow` (0.2s), `staggerContainerFast` (0.08s) |
| Grid items | `cardItem` (y 30), `cardItemScale` (y 20 + scale 0.96) |
| Hero | `heroText` (y 50 + blur 4px), `heroSubtext` (delay 0.3), `heroButtons` (delay 0.6) |
| Section headers | `sectionLabel` (animates letter-spacing 0.1em→0.2em), `sectionTitle`, `dividerExpand` |
| Chrome | `navbarSlide` (y −100), `footerReveal`, `footerStagger`, `footerItem` |
| Page | `pageTransition` (in: y 20 / out: y −10) |
| Media | `imageReveal` (opacity + scale 1.05→1 over 1s) |
| Hover helpers | `luxuryHover` (scale 1.02), `luxuryTap` (scale 0.98) |
| Ambient | `floatingAnimation` (y 0→−8→0, infinite 4s), `goldLineDraw`, `numberReveal` |

**Signature move:** headings enter with a blur-to-sharp transition
(`filter: 'blur(4px)' → 'blur(0px)'`) — see `heroText` and `PageHeader`.

---

## 10. Iconography & Imagery

| Aspect | Detail |
|--------|--------|
| Icon set | `lucide-react`, stroke-only |
| Default icon sizes | 16 (inline/input), 18 (button), 20 (nav), 60 (empty state) |
| Active nav icons | `strokeWidth: 2`; idle `1.5` |
| Product/collection images | Cloudinary-hosted, `object-cover` |
| Social & WhatsApp glyphs | Cloudinary-hosted PNGs, not Lucide |
| Hover behaviour | Wrapped in `.img-zoom` for the 1.05 scale |

---

## 11. Responsive Breakpoints

Standard Tailwind scale. Notable thresholds in this codebase:

| Breakpoint | Behaviour change |
|-----------|-----------------|
| `< lg` (1024px) | `BottomNavbar` visible; admin sidebar collapses to an overlay drawer |
| `lg+` | Desktop nav links visible; bottom nav hidden (`lg:hidden`); WhatsApp FAB moves from `bottom-25` to `bottom-6` |
| `sm` | Page headers step from `text-3xl` to `text-4xl`; admin header rows go row-wise |

There is no dark mode and no theme switcher — `light` is the DaisyUI default and only theme.
