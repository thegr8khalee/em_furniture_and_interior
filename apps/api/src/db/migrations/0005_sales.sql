-- Carts, orders and the commercial objects around them.
--
-- Everything that references something sellable points at
-- catalog.sellable_items, so a cart line, an order line and a coupon scope all
-- use one real foreign key rather than the untyped id + discriminator pair the
-- Mongo schema used.

CREATE TABLE sales.carts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid REFERENCES core.profiles(id) ON DELETE CASCADE,
  -- Guests are Supabase anonymous sign-ins, so a cart belongs to a Supabase
  -- identity whether or not it has an account behind it. That replaces the
  -- hand-rolled anonymousId cookie and the separate guest_sessions collection.
  supabase_user_id  uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_has_an_owner CHECK (profile_id IS NOT NULL OR supabase_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX ON sales.carts (profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX ON sales.carts (supabase_user_id) WHERE profile_id IS NULL AND supabase_user_id IS NOT NULL;

CREATE TABLE sales.cart_items (
  cart_id           uuid NOT NULL REFERENCES sales.carts(id) ON DELETE CASCADE,
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  quantity          integer NOT NULL CHECK (quantity >= 1),
  added_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, sellable_item_id)
);

CREATE TABLE sales.wishlist_items (
  profile_id        uuid REFERENCES core.profiles(id) ON DELETE CASCADE,
  supabase_user_id  uuid,
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  added_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_has_an_owner CHECK (profile_id IS NOT NULL OR supabase_user_id IS NOT NULL)
);

CREATE UNIQUE INDEX ON sales.wishlist_items (COALESCE(profile_id, supabase_user_id), sellable_item_id);

CREATE TABLE sales.coupons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                citext NOT NULL UNIQUE,
  discount_type       text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value      numeric(10,2) NOT NULL CHECK (discount_value > 0),
  minimum_spend_minor core.money_minor NOT NULL DEFAULT 0 CHECK (minimum_spend_minor >= 0),
  usage_limit         integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count         integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  valid_from          timestamptz NOT NULL,
  valid_until         timestamptz NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT validity_ordered CHECK (valid_until > valid_from),
  -- A percentage over 100 would pay the customer to take the goods.
  CONSTRAINT percentage_within_range CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);

-- Which items a coupon applies to. Absent rows mean "everything".
CREATE TABLE sales.coupon_scope (
  coupon_id         uuid NOT NULL REFERENCES sales.coupons(id) ON DELETE CASCADE,
  sellable_item_id  uuid REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  category_id       uuid REFERENCES catalog.categories(id) ON DELETE CASCADE,
  -- A scope row names an item or a category, never both and never neither.
  CONSTRAINT one_target CHECK ((sellable_item_id IS NULL) <> (category_id IS NULL))
);

CREATE INDEX ON sales.coupon_scope (coupon_id);

CREATE TABLE sales.orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        text NOT NULL UNIQUE,
  profile_id          uuid REFERENCES core.profiles(id),
  supabase_user_id    uuid,
  shipping_address_id uuid NOT NULL REFERENCES core.addresses(id),
  billing_address_id  uuid REFERENCES core.addresses(id),

  -- Every figure derived server-side; nothing about money comes from a client
  -- (finding F-05).
  subtotal_minor      core.money_minor NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor      core.money_minor NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  shipping_minor      core.money_minor NOT NULL DEFAULT 0 CHECK (shipping_minor >= 0),
  tax_minor           core.money_minor NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor         core.money_minor NOT NULL CHECK (total_minor >= 0),

  coupon_id           uuid REFERENCES sales.coupons(id),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN
                        ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  payment_status      text NOT NULL DEFAULT 'pending' CHECK (payment_status IN
                        ('pending','paid','failed','refunded')),
  payment_method      text,

  -- Finding F-06: a double-clicked checkout must not create a second order.
  -- Unique but nullable, so orders created without one are unaffected.
  idempotency_key     text UNIQUE,

  notes               text,
  admin_notes         text,
  placed_at           timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- The total must actually be the sum of its parts. Application code that
  -- computes this wrongly is then a failed insert rather than a wrong invoice.
  CONSTRAINT total_is_consistent
    CHECK (total_minor = subtotal_minor - discount_minor + shipping_minor + tax_minor),
  CONSTRAINT discount_within_subtotal CHECK (discount_minor <= subtotal_minor),
  CONSTRAINT order_has_an_owner CHECK (profile_id IS NOT NULL OR supabase_user_id IS NOT NULL)
);

CREATE INDEX ON sales.orders (profile_id, placed_at DESC);
CREATE INDEX ON sales.orders (status);
CREATE INDEX ON sales.orders (payment_status, placed_at DESC);
CREATE INDEX ON sales.orders (placed_at DESC);

CREATE TABLE sales.order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
  sellable_item_id  uuid REFERENCES catalog.sellable_items(id),
  -- Name and price are snapshots, not lookups. What the customer was charged
  -- must not change because someone later edited the catalogue.
  name              text NOT NULL,
  unit_price_minor  core.money_minor NOT NULL CHECK (unit_price_minor >= 0),
  unit_cost_minor   core.money_minor CHECK (unit_cost_minor >= 0),
  quantity          integer NOT NULL CHECK (quantity >= 1),
  line_total_minor  core.money_minor NOT NULL CHECK (line_total_minor >= 0),
  CONSTRAINT line_total_is_consistent CHECK (line_total_minor = unit_price_minor * quantity)
);

CREATE INDEX ON sales.order_lines (order_id);
CREATE INDEX ON sales.order_lines (sellable_item_id);

CREATE TABLE sales.order_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
  status      text NOT NULL,
  changed_by  uuid REFERENCES core.staff(id),
  note        text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON sales.order_status_history (order_id, changed_at);

CREATE TABLE sales.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES sales.orders(id),
  gateway             text NOT NULL CHECK (gateway IN ('paystack','stripe','bank_transfer','manual')),
  gateway_reference   text,
  -- Every receipt represents money actually received; a negative payment is a
  -- credit note, which follows the approval path instead.
  amount_minor        core.money_minor NOT NULL CHECK (amount_minor > 0),
  currency            text NOT NULL DEFAULT 'NGN',
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN
                        ('pending','success','failed','refunded')),
  verified_at         timestamptz,
  gateway_response    jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON sales.payments (gateway, gateway_reference) WHERE gateway_reference IS NOT NULL;
CREATE INDEX ON sales.payments (order_id);

-- Gateways redeliver until they get a 2xx, and sometimes after. The unique
-- index is the idempotency guard (finding F-01).
CREATE TABLE sales.webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway     text NOT NULL,
  event_id    text NOT NULL,
  event_type  text,
  reference   text,
  order_id    uuid REFERENCES sales.orders(id),
  outcome     text,
  payload     jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, event_id)
);

CREATE TABLE sales.reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_item_id    uuid NOT NULL REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  profile_id          uuid NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  rating              integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment             text,
  is_verified_purchase boolean NOT NULL DEFAULT false,
  is_approved         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sellable_item_id, profile_id)
);

CREATE INDEX ON sales.reviews (sellable_item_id) WHERE is_approved;

CREATE TABLE sales.loyalty_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES core.profiles(id) ON DELETE CASCADE,
  order_id    uuid REFERENCES sales.orders(id),
  type        text NOT NULL CHECK (type IN ('earn','redeem','adjust')),
  points      integer NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON sales.loyalty_transactions (profile_id, created_at DESC);

CREATE TRIGGER touch BEFORE UPDATE ON sales.carts
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON sales.coupons
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON sales.orders
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON sales.payments
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
