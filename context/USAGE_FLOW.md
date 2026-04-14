# Usage Flow

> End-to-end user journeys through the EM Furniture and Interior platform.

---

## 1. Guest Browsing & Shopping

```
Landing (HomePage)
  │
  ├─► Browse Shop (/shop)
  │     ├─ Filter by category, style, price
  │     ├─ Load more (pagination)
  │     └─► Product Detail (/product/:id)
  │           ├─ View gallery, description, reviews
  │           ├─ Check estimated delivery
  │           ├─ Add to Compare (max 4)
  │           ├─ Add to Cart ──► Cart Page
  │           └─ Add to Wishlist ──► Wishlist Page
  │
  ├─► Browse Collections (/collection/:id)
  │     ├─ View bundled products
  │     ├─ Add collection to cart
  │     └─ Leave review (if purchased)
  │
  ├─► Browse by Style (/styles/:style)
  │     └─ Modern, Antique/Royal, Minimalist, etc.
  │
  └─► Compare Products (/compare)
        └─ Side-by-side comparison of up to 4 items
```

---

## 2. Cart → Checkout → Payment

```
Cart Page (/cart)
  │
  ├─ Update quantities
  ├─ Remove items
  ├─ Apply coupon code ──► Validate ──► Discount applied
  │
  └─► Checkout (/checkout)
        │
        ├─ Enter shipping address
        ├─ Enter billing address (optional)
        ├─ Select payment method:
        │     ├─ Paystack ──► Hosted checkout ──► /payment/verify?gateway=paystack
        │     ├─ Flutterwave ──► Hosted checkout ──► /payment/verify?gateway=flutterwave
        │     ├─ Stripe ──► Hosted checkout ──► /payment/verify?gateway=stripe
        │     ├─ Bank Transfer ──► Upload proof of payment
        │     ├─ Cash on Delivery
        │     └─ WhatsApp Order
        │
        └─► Order Created
              │
              └─► Order Confirmation (/order-confirmation/:orderId)
                    ├─ Order summary
                    ├─ Download invoice (PDF)
                    └─ Track order link
```

---

## 3. Guest Experience

```
First Visit (no account)
  │
  ├─ identifyGuest middleware creates anonymousId cookie
  ├─ Guest session stored in MongoDB (7-day TTL)
  │
  ├─ Cart persisted (server-side via guest session)
  ├─ Wishlist persisted (server-side via guest session)
  │
  ├─► Checkout as Guest ──► Order placed with guest ref
  │
  └─► Sign Up (/signup)
        └─ Guest cart/wishlist merged into new user account
```

---

## 4. User Account Lifecycle

```
Sign Up (/signup)
  │
  ├─ Create account (username, email, password)
  ├─ Merge any existing guest data
  ├─ JWT issued → HTTP-only cookie
  │
  └─► Profile (/profile)
        ├─ Edit username, email, phone
        ├─ Change password
        └─ Delete account

Login (/login) ──► JWT cookie set ──► Redirect to home

Forgot Password ──► Email with reset link
  └─► Reset Password (/reset-password/:token) ──► New password saved

Check Auth (on app mount) ──► GET /api/auth/check ──► Restore session
```

---

## 5. Order Management (Customer)

```
Order History (/orders)
  │
  ├─ View list of past orders
  ├─ Click order ──► Order detail
  └─ Download invoice (PDF)

Track Order (/track-order)
  │
  ├─ Enter order number + email
  └─► View order status:
        pending → confirmed → processing → shipped → delivered
```

---

## 6. Notifications & Loyalty

```
Notifications (/notifications)
  │
  ├─ View unread count (badge on nav)
  ├─ List all notifications (order, promo, system)
  ├─ Mark individual as read
  ├─ Mark all as read
  └─ Delete notification

Loyalty (/loyalty)
  │
  ├─ View points balance
  └─ View transaction history (earn, redeem, adjustment)
```

---

## 7. Interior Design Consultation

```
Consultation (/consultation)
  │
  ├─ Fill form:
  │     ├─ Full name, email, phone
  │     ├─ Budget range (min/max)
  │     ├─ Style preferences
  │     ├─ Upload room photos (Cloudinary)
  │     ├─ Upload floor plan (Cloudinary)
  │     └─ Select preferred designer
  │
  └─► Request submitted ──► Admin manages via ConsultationManagement
        │
        ├─ Assign designer
        ├─ Schedule consultation
        └─ Update status: new → scheduled → completed/cancelled
```

---

## 8. Content Exploration

```
Blog (/blog)
  ├─ Paginated post listing
  └─► Blog Post (/blog/:slug) ──► Full article

FAQ (/faqs)
  └─ Accordion Q&A list

Projects (/projects)
  ├─ Portfolio grid (paginated)
  └─► Project Detail (/project/:id) ──► Image carousel + details

E-Catalog (/e-catalog)
  └─ PDF viewer (product catalog)

Showroom (/showroom)
  └─ Google Maps embed with store location

About Us (/aboutUs)
  └─ Company info, team showcase

Contact (/contact)
  └─ Form → Gmail API → email sent

Terms (/terms) + Privacy (/privacy)
  └─ Static legal pages
```

---

## 9. Admin Workflows

### 9.1 Product Management

```
Admin Login (/admin/login) ──► Dashboard (/admin/dashboard)
  │
  ├─► Add Product (/admin/products/new)
  │     ├─ Name, description (TinyMCE), items, price
  │     ├─ Category, style, images (Cloudinary upload)
  │     ├─ Inventory: stock quantity, low stock threshold, SKU, warehouse
  │     ├─ Promo: discounted price, isBestSeller, isPromo
  │     └─ SEO: title, description, keywords, JSON-LD
  │
  ├─► Edit Product (/admin/products/edit/:id)
  └─► Delete Product (from dashboard)
```

### 9.2 Order Management

```
Admin Orders (/admin/orders)
  │
  ├─ Filter by status, payment status, date
  ├─ Search by order number
  ├─ Update order status
  ├─ Update payment status
  ├─ Generate invoice/receipt/quotation (PDF)
  └─ Delete order
```

### 9.3 Marketing & Inventory

```
Marketing (/admin/marketing)
  ├─ Promo Banners: create, edit, activate, schedule
  └─ Flash Sales: create, edit, target products/collections

Inventory (/admin/inventory)
  ├─ View all products with stock levels
  ├─ Filter low-stock items
  └─ Adjust inventory (delta + reason ──► audit trail)
```

### 9.4 Finance, Analytics & Security

```
Finance (/admin/finance)
  ├─ Revenue summary (total, daily breakdown)
  └─ Export CSV

Analytics (/admin/analytics)
  ├─ Overview KPIs (revenue, orders, customers, AOV)
  ├─ Sales by category / region
  ├─ Product performance (top 20)
  ├─ Designer performance
  ├─ Customer lifetime value (top 50)
  └─ Conversion funnel

Security Logs (/admin/security-logs)
  ├─ Audit logs (admin actions with filter/stats)
  ├─ Activity logs (user behaviour with filter/stats)
  └─ Cleanup tools
```
