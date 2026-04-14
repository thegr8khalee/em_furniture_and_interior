# Data Models

> Complete database schema — 20 Mongoose models with field specifications.

---

## Overview

| # | Model | Collection | Embedded Docs | References | TTL |
|---|-------|-----------|---------------|------------|-----|
| 1 | User | users | cart[], wishlist[] | — | — |
| 2 | Admin | admins | permissions[] | — | — |
| 3 | Guest | guests | cart[], wishlist[] | — | 7 days |
| 4 | Product | products | reviews[], images[], seoFields | collectionId → Collection | — |
| 5 | Collection | collections | reviews[], productIds[] | productIds → Product | — |
| 6 | Order | orders | items[] | user → User, guest → Guest | — |
| 7 | PaymentTransaction | paymenttransactions | — | order → Order, user → User, guest → Guest | — |
| 8 | Coupon | coupons | — | applicableProductIds, excludedProductIds, etc. | — |
| 9 | BlogPost | blogposts | — | author → Admin | — |
| 10 | FAQ | faqs | — | — | — |
| 11 | Project | projects | images[] | — | — |
| 12 | ConsultationRequest | consultationrequests | roomPhotos[], stylePreferences[] | preferredDesigner → Designer, assignedDesigner → Designer | — |
| 13 | Designer | designers | avatar{} | — | — |
| 14 | Notification | notifications | — | user → User, relatedOrder → Order | — |
| 15 | LoyaltyTransaction | loyaltytransactions | — | user → User, order → Order | — |
| 16 | PromoBanner | promobanners | — | — | — |
| 17 | FlashSale | flashsales | — | productIds → Product, collectionIds → Collection | — |
| 18 | InventoryAdjustment | inventoryadjustments | — | product → Product, adjustedBy → Admin | — |
| 19 | AuditLog | auditlogs | changes{}, metadata{} | actor → Admin | — |
| 20 | ActivityLog | activitylogs | metadata{} | user → User, guest → Guest | 90 days |

---

## Model Details

### 1. User

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| username | String | required | Display name |
| email | String | required, unique | Login email |
| passwordHash | String | required, minlength 6 | bcrypt hash |
| phoneNumber | String | — | Optional contact |
| cart | Array | embedded | `[{ itemId, itemType (Product/Collection), quantity }]` |
| wishlist | Array | embedded | `[{ itemId, itemType (Product/Collection) }]` |
| loyaltyPoints | Number | default 0 | Current balance |
| passwordResetToken | String | — | For password reset flow |
| passwordResetExpires | Date | — | Token expiry |
| timestamps | — | auto | createdAt, updatedAt |

---

### 2. Admin

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| username | String | required | Display name |
| email | String | required, unique | Login email |
| passwordHash | String | required, minlength 6 | bcrypt hash |
| role | String | enum: super_admin, admin, editor, support, social_media_manager | Default: admin |
| permissions | [String] | — | Explicit permission overrides |
| timestamps | — | auto | createdAt, updatedAt |

---

### 3. Guest

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| anonymousId | String | required, unique | UUID identifier |
| cart | Array | embedded | Same structure as User.cart |
| wishlist | Array | embedded | Same structure as User.wishlist |
| expiresAt | Date | TTL index | Auto-delete after 7 days |
| timestamps | — | auto | createdAt, updatedAt |

---

### 4. Product

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| name | String | required | Product name |
| description | String | required | Full description (may contain HTML from TinyMCE) |
| items | String | — | Items included |
| price | Number | required | Base price |
| discountedPrice | Number | — | Sale price |
| category | String | — | Product category (Sofas, Bedrooms, etc.) |
| style | String | — | Design style (Modern, Antique/Royal, etc.) |
| collectionId | ObjectId | ref: Collection | Parent collection |
| images | Array | — | `[{ url, public_id }]` (Cloudinary) |
| isBestSeller | Boolean | default false | Featured flag |
| isPromo | Boolean | default false | Promotional flag |
| isForeign | Boolean | — | Imported product flag |
| reviews | Array | embedded | `[{ user (ref), username, rating, comment, status (pending/approved/rejected) }]` |
| averageRating | Number | default 0 | Computed average |
| stockQuantity | Number | default 0 | Current stock |
| lowStockThreshold | Number | default 5 | Alert threshold |
| sku | String | — | Stock keeping unit |
| warehouseLocation | String | — | Storage location |
| seoFields | Object | — | `{ title, description, keywords, jsonLd }` |
| timestamps | — | auto | createdAt, updatedAt |

---

### 5. Collection

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| name | String | required | Collection name |
| description | String | — | Description |
| price | Number | required | Bundle price |
| discountedPrice | Number | — | Sale price |
| productIds | [ObjectId] | ref: Product | Products in collection |
| coverImage | Object | — | `{ url, public_id }` |
| isBestSeller | Boolean | default false | Featured flag |
| isPromo | Boolean | default false | Promotional flag |
| style | String | — | Design style |
| reviews | Array | embedded | Same structure as Product.reviews |
| averageRating | Number | default 0 | Computed average |
| timestamps | — | auto | createdAt, updatedAt |

---

### 6. Order

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| orderNumber | String | unique | Human-readable ID |
| user | ObjectId | ref: User | Authenticated buyer (nullable) |
| guest | ObjectId | ref: Guest | Guest buyer (nullable) |
| guestEmail | String | — | Guest contact email |
| items | Array | — | `[{ itemId, itemType (Product/Collection), name, price, quantity, image }]` |
| shippingAddress | Object | — | `{ fullName, address, city, state, zipCode, phone }` |
| billingAddress | Object | — | Same structure as shipping |
| couponCode | String | — | Applied coupon |
| subtotal | Number | — | Pre-discount total |
| discountAmount | Number | default 0 | Coupon discount |
| shippingCost | Number | default 0 | Delivery fee |
| taxAmount | Number | default 0 | Tax |
| totalAmount | Number | — | Final total |
| status | String | enum | pending, confirmed, processing, shipped, delivered, cancelled, refunded |
| paymentStatus | String | enum | pending, completed, failed, refunded |
| paymentMethod | String | — | paystack, flutterwave, stripe, bank_transfer, cash_on_delivery, whatsapp |
| timestamps | — | auto | createdAt, updatedAt |

---

### 7. PaymentTransaction

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| order | ObjectId | ref: Order, required | Associated order |
| user | ObjectId | ref: User | Authenticated payer |
| guest | ObjectId | ref: Guest | Guest payer |
| amount | Number | required | Payment amount |
| currency | String | default 'NGN' | Currency code |
| paymentMethod | String | enum | paystack, flutterwave, stripe, bank_transfer, cash_on_delivery, whatsapp |
| gateway | String | — | Gateway identifier |
| gatewayReference | String | — | Transaction reference |
| bankTransferProof | Object | — | `{ url, public_id }` (Cloudinary) |
| verified | Boolean | default false | Admin verification for bank transfers |
| status | String | enum | pending, success, failed, refunded, cancelled, abandoned |
| timestamps | — | auto | createdAt, updatedAt |

---

### 8. Coupon

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| code | String | required, unique, uppercase | Coupon code |
| discountType | String | enum: percentage, fixed | Discount type |
| discountValue | Number | required | Amount or percentage |
| minimumPurchase | Number | default 0 | Min cart value |
| maximumDiscount | Number | — | Cap for percentage discounts |
| validFrom | Date | — | Start date |
| validUntil | Date | — | Expiry date |
| usageLimit | Number | — | Max total uses |
| usageCount | Number | default 0 | Current uses |
| isActive | Boolean | default true | Active flag |
| applicableProductIds | [ObjectId] | ref: Product | Only these products |
| applicableCollectionIds | [ObjectId] | ref: Collection | Only these collections |
| excludedProductIds | [ObjectId] | ref: Product | Exclude these |
| excludedCollectionIds | [ObjectId] | ref: Collection | Exclude these |
| timestamps | — | auto | createdAt, updatedAt |

---

### 9. BlogPost

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| title | String | required | Post title |
| slug | String | required, unique | URL slug (auto-generated) |
| excerpt | String | — | Short summary |
| content | String | required | Full content (HTML) |
| coverImage | Object | — | `{ url, public_id }` |
| tags | [String] | — | Category tags |
| status | String | enum: draft, published | Publish state |
| publishedAt | Date | — | Publication date |
| author | ObjectId | ref: Admin | Creator |
| timestamps | — | auto | createdAt, updatedAt |

---

### 10. FAQ

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| question | String | required | FAQ question |
| answer | String | required | FAQ answer |
| order | Number | default 0 | Display order |
| isActive | Boolean | default true | Visibility flag |
| timestamps | — | auto | createdAt, updatedAt |

---

### 11. Project

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| title | String | required | Project name |
| description | String | — | Project description |
| images | Array | — | `[{ url, public_id }]` |
| category | String | — | Project type |
| location | String | — | Project location |
| price | Number | — | Project value |
| timestamps | — | auto | createdAt, updatedAt |

---

### 12. ConsultationRequest

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| fullName | String | required | Client name |
| email | String | required | Contact email |
| phone | String | — | Contact phone |
| budgetMin | Number | — | Budget lower bound |
| budgetMax | Number | — | Budget upper bound |
| stylePreferences | [String] | — | Selected styles |
| roomPhotos | Array | — | `[{ url, public_id }]` (Cloudinary) |
| floorPlan | Object | — | `{ url, public_id }` (Cloudinary) |
| preferredDesigner | ObjectId | ref: Designer | Client preference |
| assignedDesigner | ObjectId | ref: Designer | Admin assignment |
| status | String | enum: new, scheduled, completed, cancelled | Default: new |
| notes | String | — | Admin notes |
| scheduledDate | Date | — | Meeting date |
| timestamps | — | auto | createdAt, updatedAt |

---

### 13. Designer

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| name | String | required | Designer name |
| title | String | — | Job title |
| bio | String | — | Biography |
| avatar | Object | — | `{ url, public_id }` (Cloudinary) |
| isActive | Boolean | default true | Available for assignment |
| timestamps | — | auto | createdAt, updatedAt |

---

### 14. Notification

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| user | ObjectId | ref: User, required | Recipient |
| title | String | required | Notification title |
| message | String | required | Body text |
| type | String | enum: order, promo, system | Category |
| relatedOrder | ObjectId | ref: Order | Associated order |
| isRead | Boolean | default false | Read status |
| timestamps | — | auto | createdAt, updatedAt |

---

### 15. LoyaltyTransaction

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| user | ObjectId | ref: User, required | Points owner |
| order | ObjectId | ref: Order | Associated order |
| type | String | enum: earn, redeem, adjustment | Transaction type |
| points | Number | required | Points amount |
| description | String | — | Transaction reason |
| timestamps | — | auto | createdAt, updatedAt |

---

### 16. PromoBanner

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| title | String | required | Banner title |
| subtitle | String | — | Secondary text |
| imageUrl | String | — | Banner image URL |
| linkUrl | String | — | Click destination |
| position | String | enum: home, shop, collection, product | Display location |
| priority | Number | default 0 | Sort order |
| isActive | Boolean | default true | Visibility |
| startDate | Date | — | Schedule start |
| endDate | Date | — | Schedule end |
| timestamps | — | auto | createdAt, updatedAt |

---

### 17. FlashSale

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| name | String | required | Sale name |
| discountType | String | enum: percentage, fixed | Discount type |
| discountValue | Number | required | Amount or percentage |
| productIds | [ObjectId] | ref: Product | Targeted products |
| collectionIds | [ObjectId] | ref: Collection | Targeted collections |
| bannerImageUrl | String | — | Promotional image |
| isActive | Boolean | default true | Active flag |
| startDate | Date | required | Sale start |
| endDate | Date | required | Sale end |
| timestamps | — | auto | createdAt, updatedAt |

---

### 18. InventoryAdjustment

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| product | ObjectId | ref: Product, required | Adjusted product |
| delta | Number | required | Change amount (+/-) |
| previousQuantity | Number | — | Stock before |
| newQuantity | Number | — | Stock after |
| reason | String | — | Adjustment reason |
| adjustedBy | ObjectId | ref: Admin, required | Admin who made the change |
| timestamps | — | auto | createdAt, updatedAt |

---

### 19. AuditLog

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| actor | ObjectId | ref: Admin | Admin who performed the action |
| actorEmail | String | — | Admin email (denormalized) |
| action | String | enum | CREATE, UPDATE, DELETE, LOGIN, STATUS_CHANGE, PERMISSION_CHANGE, EXPORT, BULK_ACTION, OTHER |
| resourceType | String | enum | Product, Collection, Order, User, Admin, Coupon, BlogPost, FAQ, Designer, Consultation, Banner, FlashSale, Inventory, Payment, Other |
| resourceId | String | — | Target resource ID |
| changes | Object | — | `{ before, after }` diff |
| metadata | Object | — | Additional context |
| ipAddress | String | — | Client IP |
| userAgent | String | — | Client user agent |
| status | String | enum: success, failed | Outcome |
| errorMessage | String | — | Error details (if failed) |
| timestamps | — | auto | createdAt, updatedAt |

---

### 20. ActivityLog

| Field | Type | Constraints | Description |
|-------|------|------------|-------------|
| user | ObjectId | ref: User | Authenticated user |
| guest | ObjectId | ref: Guest | Guest user |
| activityType | String | enum | PRODUCT_VIEW, COLLECTION_VIEW, ADD_TO_CART, REMOVE_FROM_CART, ADD_TO_WISHLIST, REMOVE_FROM_WISHLIST, SEARCH, ORDER_PLACED, ORDER_CANCELLED, REVIEW_SUBMITTED, LOGIN, SIGNUP, PROFILE_UPDATE, COUPON_APPLIED, CONSULTATION_SUBMITTED, OTHER |
| resourceType | String | — | Type of resource involved |
| resourceId | String | — | ID of resource |
| metadata | Object | — | `{ method, path, query, body }` |
| sessionId | String | — | Session identifier |
| ipAddress | String | — | Client IP |
| userAgent | String | — | Client user agent |
| referrer | String | — | Referring page |
| expiresAt | Date | TTL index | Auto-delete after 90 days |
| timestamps | — | auto | createdAt, updatedAt |

---

## Indexes

| Model | Index | Type | Purpose |
|-------|-------|------|---------|
| User | email | unique | Login lookup |
| Admin | email | unique | Login lookup |
| Guest | anonymousId | unique | Session lookup |
| Guest | expiresAt | TTL | Auto-expiration |
| Coupon | code | unique | Code lookup |
| BlogPost | slug | unique | URL routing |
| Order | orderNumber | unique | Tracking lookup |
| ActivityLog | expiresAt | TTL | Auto-expiration (90 days) |
