-- Carts, wishlists, orders and coupons.

-- A cart belongs to a customer OR a guest session, never both and never
-- neither. In Mongo the customer cart was an array inside the user document and
-- the guest cart was a separate collection, so "get the cart" meant two code
-- paths that had drifted apart.
CREATE TABLE carts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid UNIQUE REFERENCES customers (id) ON DELETE CASCADE,
  guest_session_id uuid UNIQUE REFERENCES guest_sessions (id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT carts_exactly_one_owner
    CHECK (num_nonnulls(customer_id, guest_session_id) = 1)
);

CREATE TRIGGER carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_items (
  cart_id          uuid NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  sellable_item_id uuid NOT NULL REFERENCES sellable_items (id) ON DELETE CASCADE,
  quantity         integer NOT NULL CHECK (quantity > 0),
  added_at         timestamptz NOT NULL DEFAULT now(),

  -- One line per item. The embedded array allowed the same product twice, so a
  -- cart could show two lines that had to be summed to get the real quantity.
  PRIMARY KEY (cart_id, sellable_item_id)
);

CREATE TABLE wishlist_items (
  customer_id      uuid REFERENCES customers (id) ON DELETE CASCADE,
  guest_session_id uuid REFERENCES guest_sessions (id) ON DELETE CASCADE,
  sellable_item_id uuid NOT NULL REFERENCES sellable_items (id) ON DELETE CASCADE,
  added_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wishlist_exactly_one_owner
    CHECK (num_nonnulls(customer_id, guest_session_id) = 1)
);

-- Partial unique indexes rather than a composite primary key, because one of
-- the two owner columns is always NULL and NULLs are not equal to each other.
CREATE UNIQUE INDEX wishlist_customer_item_idx
  ON wishlist_items (customer_id, sellable_item_id) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX wishlist_guest_item_idx
  ON wishlist_items (guest_session_id, sellable_item_id) WHERE guest_session_id IS NOT NULL;

CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');

CREATE TABLE coupons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  description         text,
  discount_type       discount_type NOT NULL,
  -- Basis points for a percentage (500 = 5%), minor units for a fixed amount.
  -- One column cannot be both a money type and a rate, so the meaning is pinned
  -- by discount_type and the range check below.
  discount_value      bigint NOT NULL CHECK (discount_value > 0),
  max_discount        money_minor CHECK (max_discount IS NULL OR max_discount >= 0),
  min_purchase        money_minor NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
  usage_limit         integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  times_used          integer NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  starts_at           timestamptz,
  expires_at          timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- A 150% discount is a data-entry error, not a promotion.
  CONSTRAINT coupons_percentage_within_range
    CHECK (discount_type <> 'percentage' OR discount_value <= 10000),

  CONSTRAINT coupons_window_ordered
    CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at),

  -- Usage could exceed the limit because the check and the increment were two
  -- separate Mongo operations.
  CONSTRAINT coupons_within_usage_limit
    CHECK (usage_limit IS NULL OR times_used <= usage_limit)
);

CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM (
  'paystack', 'bank_transfer', 'cash_on_delivery', 'whatsapp', 'download_invoice'
);

CREATE TABLE orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     text NOT NULL UNIQUE,

  customer_id      uuid REFERENCES customers (id) ON DELETE SET NULL,
  guest_session_id uuid REFERENCES guest_sessions (id) ON DELETE SET NULL,

  -- Addresses are a snapshot, not a live reference: an order must keep showing
  -- where it was actually sent even after the customer edits their address.
  shipping_address jsonb NOT NULL,
  billing_address  jsonb,

  subtotal         money_minor NOT NULL CHECK (subtotal >= 0),
  discount         money_minor NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_cost    money_minor NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  tax_amount       money_minor NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount     money_minor NOT NULL CHECK (total_amount >= 0),
  currency         currency_code NOT NULL DEFAULT 'NGN',

  coupon_id        uuid REFERENCES coupons (id) ON DELETE SET NULL,
  coupon_code      text,

  status           order_status NOT NULL DEFAULT 'pending',
  payment_status   payment_status NOT NULL DEFAULT 'pending',
  payment_method   payment_method NOT NULL DEFAULT 'whatsapp',

  -- Unique and sparse. The audit found order creation had no idempotency, so a
  -- double-submitted checkout produced two orders for one intent.
  idempotency_key  text UNIQUE,

  loyalty_points_earned   integer NOT NULL DEFAULT 0 CHECK (loyalty_points_earned >= 0),
  loyalty_points_credited boolean NOT NULL DEFAULT false,

  tracking_number  text,
  tracking_url     text,
  carrier          text,
  estimated_delivery_date date,
  delivered_at     timestamptz,
  notes            text,
  admin_notes      text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- The arithmetic itself. A controller that computes the total wrongly now
  -- fails to insert rather than producing an invoice nobody can reconcile —
  -- which is what happened when shipping and tax came straight off the request
  -- body and were trusted.
  CONSTRAINT orders_total_is_the_sum_of_its_parts
    CHECK (total_amount = subtotal - discount + shipping_cost + tax_amount),

  -- A discount larger than the goods is a refund, and belongs in a credit note.
  CONSTRAINT orders_discount_within_subtotal
    CHECK (discount <= subtotal),

  CONSTRAINT orders_has_a_buyer
    CHECK (num_nonnulls(customer_id, guest_session_id) >= 1),

  CONSTRAINT orders_delivered_has_date
    CHECK (status <> 'delivered' OR delivered_at IS NOT NULL)
);

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX orders_customer_idx ON orders (customer_id, created_at DESC);
CREATE INDEX orders_guest_idx ON orders (guest_session_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);
CREATE INDEX orders_created_idx ON orders (created_at DESC);
CREATE INDEX orders_unpaid_idx ON orders (created_at) WHERE payment_status = 'pending';

CREATE TABLE order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  -- Kept as a reference for reporting, but nulled rather than cascaded if the
  -- item is deleted: an order line must survive its product being retired.
  sellable_item_id uuid REFERENCES sellable_items (id) ON DELETE SET NULL,

  -- The snapshot. What was actually sold, at the price actually charged, under
  -- the name it carried at the time — so reprinting a two-year-old invoice does
  -- not silently reprice it.
  name             text NOT NULL,
  image_url        text,
  unit_price       money_minor NOT NULL CHECK (unit_price >= 0),
  unit_cost        money_minor CHECK (unit_cost IS NULL OR unit_cost >= 0),
  quantity         integer NOT NULL CHECK (quantity > 0),
  line_total       money_minor NOT NULL CHECK (line_total >= 0),

  CONSTRAINT order_items_line_total_is_price_times_quantity
    CHECK (line_total = unit_price * quantity)
);

CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_item_idx ON order_items (sellable_item_id);

-- Status history as rows rather than an embedded array, so "every order that
-- went from processing to cancelled last month" is a query.
CREATE TABLE order_status_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status     order_status NOT NULL,
  changed_by uuid REFERENCES staff (id) ON DELETE SET NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_status_events_order_idx ON order_status_events (order_id, created_at);

-- Written by the database rather than a pre('save') hook, so a bulk status
-- update is recorded too.
CREATE OR REPLACE FUNCTION record_order_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_events (order_id, status) VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_record_status
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION record_order_status();

CREATE TYPE transaction_status AS ENUM (
  'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'
);

CREATE TABLE payment_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  amount              money_minor NOT NULL CHECK (amount > 0),
  currency            currency_code NOT NULL DEFAULT 'NGN',
  payment_method      payment_method NOT NULL,

  -- Unique, so a webhook replay cannot create a second transaction for one
  -- charge. The idempotency in the Paystack handler relies on this.
  gateway_reference   text UNIQUE,
  gateway_response    jsonb,

  status              transaction_status NOT NULL DEFAULT 'pending',
  verified_at         timestamptz,
  verification_notes  text,

  bank_transfer_proof text,
  bank_name           text,
  transfer_reference  text,
  transfer_date       date,

  refunded_amount     money_minor NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  refunded_at         timestamptz,

  ip_address          inet,
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payment_success_is_verified
    CHECK (status <> 'success' OR verified_at IS NOT NULL),

  CONSTRAINT payment_refund_within_amount
    CHECK (refunded_amount <= amount)
);

CREATE TRIGGER payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX payment_transactions_order_idx ON payment_transactions (order_id, status);
