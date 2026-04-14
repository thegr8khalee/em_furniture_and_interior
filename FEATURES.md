# EM Furniture and Interior - Feature List

This document lists the available features in the EM Furniture and Interior web app.

## Customer-facing features
- Browse products with detail pages.
- Browse curated collections with detail pages.
- Browse portfolio/projects with detail pages.
- Book interior design consultations with budget, style, and file uploads.
- Estimated delivery dates on product pages.
- Product comparison list and compare view.
- Recently viewed products on product pages.
- Filter products by style and category (e.g., Modern, Antique/Royal).
- View shop and styles pages for catalog exploration.
- View an e-catalog PDF.
- View showroom location on a Google Maps embed.
- Add items to cart, update quantities, remove items, and clear cart.
- Add items to wishlist, remove items, and clear wishlist.
- Persist cart and wishlist for authenticated and guest users.
- Apply discount coupons at checkout with validation.
- Leave reviews for products and collections.
- Place orders with full checkout flow (shipping/billing address).
- Guest checkout capability (order without account).
- View order history and track orders.
- Order confirmation page with detailed order summary.
- Download PDF invoices for placed orders.
- WhatsApp quick chat from the floating button.
- Contact form for inquiries.
- About, Terms, and Privacy informational pages.
- Responsive UI for desktop, tablet, and mobile.

## Account and authentication
- User signup and login.
- Session/auth status check.
- Profile update.
- Change password.
- Forgot/reset password flow (token-based).
- Delete account.

## Customer account features
- Order history with item previews.
- Track orders by order number and email.
- Notification center for order updates.
- Loyalty points balance and history.

## Guest experience
- Guest sessions with cart and wishlist support.
- Guest cart item add, update, and remove.
- Guest wishlist item add and remove.

## Admin features
- Moderate reviews (approve/reject).
- Manage consultation requests (assign designer, schedule, update status).
- Manage designers (add, activate/deactivate, delete).
- Manage product SEO metadata (title, description, keywords, schema JSON-LD).
- Manage promo banners (homepage, shop, product pages).
- Manage flash sales (discount scheduling, product/collection targeting).
- Track inventory (stock quantity, low stock threshold, warehouse location).
- View revenue reports and export finance data (CSV, daily breakdown).

## E-Commerce Features (Phase 3)
- **Coupon System**: Apply discount codes with validation (percentage/fixed, minimum purchase, usage limits, date validity, category-specific).
- **Order Management**: Complete order system with status tracking (pending, confirmed, processing, shipped, delivered, cancelled, refunded).
- **Guest Checkout**: Place orders without creating an account.
- **Order History**: View past orders with detailed information and tracking.
- **Order Summary**: Detailed pricing breakdown (subtotal, discount, shipping, tax, total).
- **Multiple Payment Methods**: Support for WhatsApp orders, cash on delivery, bank transfer, card payments.
- **Invoice Generation**: Download PDF invoices for orders with complete pricing and tracking details.
- **Admin Order Dashboard**: Comprehensive order management interface with filters, search, status updates, and payment tracking.

## Integrations
- Email delivery for contact form submissions.
- Cloudinary-hosted assets.
- WhatsApp deep link with prefilled message.
- Paystack payment initialization and verification with hosted checkout.
- Flutterwave hosted checkout with verification callback.
- Stripe hosted checkout with verification callback.
- Bank transfer proof upload for manual payment verification.
- TaxJar live tax calculation during checkout.

## Analytics and Reporting (Phase 7)
- **Overview Dashboard**: Real-time KPIs (total revenue, orders, customers, average order value, consultations).
- **Sales by Category**: Revenue breakdown by product category with order count and item count.
- **Sales by Region**: Geographic sales analysis by city and state (top 50 regions).
- **Product Performance**: Top 20 products by revenue with units sold and order count.
- **Designer Performance**: Consultation completion rates, total/scheduled/completed/cancelled counts per designer.
- **Customer Lifetime Value**: Top 50 customers by total spend with order history and average order value.
- **Conversion Funnel**: User journey tracking from registration → order creation → confirmation → payment with conversion rates at each stage.
- **Date Range Filtering**: Flexible date range selection for all analytics (default: last 30 days).
- **Permission-Based Access**: Analytics dashboard protected by FINANCE_VIEW permission.

## Security and System Features (Phase 8)
- **Audit Logs**: Complete trail of admin actions (CREATE, UPDATE, DELETE, LOGIN, STATUS_CHANGE, PERMISSION_CHANGE, EXPORT, BULK_ACTION) with actor, resource type, resource ID, changes, metadata, IP address, user agent, and status tracking.
- **Activity Logs**: User activity tracking (PRODUCT_VIEW, ADD_TO_CART, SEARCH, ORDER_PLACED, etc.) with automatic 90-day TTL expiration, session tracking, and analytics insights.
- **Rate Limiting**: Multiple rate limiters for different endpoints - General API (100/15min), Auth (5/15min), Create operations (20/hour), Password reset (3/hour), Exports (5/hour), Search (30/min).
- **Audit Logger Middleware**: Automatic audit logging for admin actions with before/after change tracking and error logging.
- **Activity Tracker Middleware**: Fire-and-forget activity tracking for user actions without impacting request performance.
- **Security Dashboard**: Admin UI with tabbed interface for audit logs and activity logs, filtering by action/resource/date, statistics panels showing top actions/resources/actors/users, pagination, and cleanup tools.
- **Log Statistics**: Aggregated analytics for audit logs (by action, resource, actor, status) and activity logs (by activity type, resource, top users, hourly distribution).
- **Role-Based Log Access**: Security logs protected by FINANCE_VIEW permission for authorized admin access only.
