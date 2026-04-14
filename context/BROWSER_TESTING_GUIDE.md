# Browser Testing Guide

> Manual QA walkthrough for EM Furniture and Interior.

---

## 1. Prerequisites

### Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd em_furniture_and_interior
   ```

2. **Install dependencies**
   ```bash
   npm install --prefix backend
   npm install --prefix frontend
   ```

3. **Configure environment variables**

   Create `backend/.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/em_furniture
   JWT_SECRET=your_jwt_secret
   NODE_ENV=development
   PORT=5000
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   PAYSTACK_SECRET_KEY=your_paystack_key
   FLUTTERWAVE_SECRET_KEY=your_flutterwave_key
   STRIPE_SECRET_KEY=your_stripe_key
   GMAIL_CLIENT_ID=your_gmail_client_id
   GMAIL_CLIENT_SECRET=your_gmail_client_secret
   GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
   GMAIL_USER=your_email@gmail.com
   ```

   Create `frontend/.env`:
   ```env
   VITE_BACKEND_URL=http://localhost:5000/api
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
   ```

4. **Seed the database**
   ```bash
   cd backend && npm run seed
   ```

5. **Start dev servers**
   ```bash
   # Terminal 1
   cd backend && npm run dev

   # Terminal 2
   cd frontend && npm run dev
   ```

6. **Open browser** → `http://localhost:5173`

---

## 2. Test Scenarios

### 2.1 Public Browsing (No Auth Required)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Homepage loads | Navigate to `/` | Hero, featured products, collections, projects visible |
| 2 | Shop page | Navigate to `/shop` | Product grid loads, "Load more" works |
| 3 | Filter products | Open filter modal → select category/style/price | Products filter correctly |
| 4 | Product detail | Click any product | Gallery, description, price, reviews section visible |
| 5 | Collection detail | Click any collection | Collection info with product list visible |
| 6 | Browse by style | Navigate to `/styles/Modern` | Style-filtered products display |
| 7 | Compare products | Add 2-4 products to compare → navigate to `/compare` | Side-by-side comparison table |
| 8 | Blog | Navigate to `/blog` → click a post | Post list → full article display |
| 9 | FAQ | Navigate to `/faqs` | Accordion opens/closes |
| 10 | Projects | Navigate to `/projects` → click a project | Portfolio grid → detail with images |
| 11 | Showroom | Navigate to `/showroom` | Google Maps embed visible |
| 12 | Contact form | Navigate to `/contact` → fill and submit | Success toast (requires Gmail config) |
| 13 | Static pages | Check `/aboutUs`, `/terms`, `/privacy` | Content renders |

### 2.2 Guest Shopping

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 14 | Guest cart | Add item to cart (not logged in) | Item appears in cart, anonymousId cookie set |
| 15 | Guest wishlist | Add item to wishlist (not logged in) | Item appears in wishlist |
| 16 | Cart persistence | Add item → refresh page | Cart items persist |
| 17 | Guest checkout | Fill checkout form → select payment method | Order created with guest reference |

### 2.3 User Authentication

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 18 | Sign up | Navigate to `/signup` → fill form → submit | Account created, redirected, guest data merged |
| 19 | Login | Navigate to `/login` → enter credentials | Logged in, navbar updates |
| 20 | Profile update | Navigate to `/profile` → edit fields → save | Profile updated toast |
| 21 | Change password | Profile → change password section | Password updated |
| 22 | Forgot password | Login page → "Forgot password" → enter email | Reset email sent (requires Gmail config) |
| 23 | Logout | Click logout in navbar | Session cleared, redirected |

### 2.4 E-Commerce Flow

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 24 | Add to cart | Product page → "Add to Cart" | Item added, cart count updates |
| 25 | Update quantity | Cart page → change quantity | Quantity and totals update |
| 26 | Remove from cart | Cart page → remove item | Item removed |
| 27 | Apply coupon | Cart page → enter valid coupon code | Discount applied, total recalculated |
| 28 | Invalid coupon | Enter expired/invalid code | Error message displayed |
| 29 | Checkout flow | Cart → Checkout → fill address → select Paystack | Redirected to Paystack hosted checkout |
| 30 | Payment verify | Complete Paystack payment | Redirected to `/payment/verify`, order confirmed |
| 31 | Order confirmation | After successful payment | Order summary with invoice download link |
| 32 | Order history | Navigate to `/orders` | List of past orders |
| 33 | Track order | Navigate to `/track-order` → enter order number + email | Order status displayed |
| 34 | Download invoice | Order history → click invoice | PDF downloads |

### 2.5 Customer Features

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 35 | Leave review | Product page (purchased item) → write review → submit | Review submitted for moderation |
| 36 | Notifications | Navigate to `/notifications` | List of notifications with read/unread |
| 37 | Mark all read | Notifications page → "Mark all read" | All notifications marked |
| 38 | Loyalty page | Navigate to `/loyalty` | Points balance and history |

### 2.6 Consultation

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 39 | Book consultation | Navigate to `/consultation` → fill form → upload photos → submit | Request created, success message |

### 2.7 Admin Panel

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 40 | Admin login | Navigate to `/admin/login` → enter admin credentials | Redirected to `/admin/dashboard` |
| 41 | Add product | Dashboard → Products → New → fill form → submit | Product created |
| 42 | Edit product | Dashboard → Products → Edit → modify → save | Product updated |
| 43 | Delete product | Dashboard → Products → Delete → confirm | Product removed |
| 44 | Manage collections | Add/edit/delete collections | CRUD works |
| 45 | Manage orders | `/admin/orders` → update status, payment status | Status updates reflected |
| 46 | Moderate reviews | `/admin/reviews` → approve/reject | Review approved/removed |
| 47 | Manage coupons | `/admin/coupons` → create/edit/delete | Coupon CRUD works |
| 48 | Marketing | `/admin/marketing` → create banner, create flash sale | Marketing items created |
| 49 | Inventory | `/admin/inventory` → view stock → adjust | Inventory updated with reason logged |
| 50 | Finance | `/admin/finance` → view revenue → export CSV | Data displays, CSV downloads |
| 51 | Analytics | `/admin/analytics` → check all tabs | All 7 analytics views render with data |
| 52 | Security logs | `/admin/security-logs` → audit + activity tabs | Logs display with filters and stats |
| 53 | Consultations | `/admin/consultations` → assign designer, update status | Workflow works |
| 54 | Designers | `/admin/designers` → add/edit/deactivate | Designer management works |

---

## 3. Cross-Browser Checklist

| Browser | Test |
|---------|------|
| Chrome (latest) | Full feature walkthrough |
| Firefox (latest) | Full feature walkthrough |
| Safari (latest) | Full feature walkthrough |
| Mobile Chrome (Android) | Responsive layout, bottom nav, touch interactions |
| Mobile Safari (iOS) | Responsive layout, bottom nav, touch interactions |

---

## 4. Responsive Breakpoints

| Breakpoint | Width | Check |
|------------|-------|-------|
| Mobile | < 640px | Bottom nav visible, hamburger menu, single-column layouts |
| Tablet | 640–1024px | Two-column grids, condensed navbar |
| Desktop | > 1024px | Full navbar, multi-column grids, sidebar visible (admin) |

---

## 5. Automated Tests

Run before manual testing to catch regressions:

```bash
# Backend tests (73 tests)
cd backend && npm test

# Frontend tests (43 tests)
cd frontend && npm test
```

All 116 tests should pass before starting manual QA.
