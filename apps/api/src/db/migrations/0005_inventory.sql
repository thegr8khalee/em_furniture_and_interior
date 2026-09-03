-- Stock, as a ledger.
--
-- The audit's finding was that placing an order never decremented stock: the
-- only writer was an admin's manual adjustment endpoint, so inventory became
-- fiction the moment anyone bought anything.
--
-- Fixing that by decrementing a counter would have replaced one problem with a
-- worse one — a number nobody can explain. "Why does this say 4?" has no answer
-- when the only record is the number itself. So stock is an append-only log of
-- movements, and the balance is derived from it. Every unit is accounted for by
-- a row saying when it moved, why, and against which order.

CREATE TYPE stock_movement_reason AS ENUM (
  'purchase_receipt',   -- arrived from a supplier
  'sale',               -- left against a paid order
  'return',             -- came back from a customer
  'adjustment',         -- a count correction, always with a note
  'damage',             -- written off
  'transfer_in',
  'transfer_out'
);

CREATE TABLE stock_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,

  -- Signed: positive brings stock in, negative takes it out. Zero is not a
  -- movement, it is a row somebody forgot to fill in.
  quantity     integer NOT NULL CHECK (quantity <> 0),

  reason       stock_movement_reason NOT NULL,
  order_id     uuid REFERENCES orders (id) ON DELETE SET NULL,
  staff_id     uuid REFERENCES staff (id) ON DELETE SET NULL,
  note         text,
  unit_cost    money_minor CHECK (unit_cost IS NULL OR unit_cost >= 0),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- A correction with no explanation is how a discrepancy becomes permanent.
  CONSTRAINT stock_adjustment_needs_a_note
    CHECK (reason <> 'adjustment' OR (note IS NOT NULL AND length(trim(note)) > 0)),

  -- A sale or a return is always against an order.
  CONSTRAINT stock_sale_names_its_order
    CHECK (reason NOT IN ('sale', 'return') OR order_id IS NOT NULL),

  CONSTRAINT stock_receipt_is_positive
    CHECK (reason NOT IN ('purchase_receipt', 'return', 'transfer_in') OR quantity > 0),

  CONSTRAINT stock_issue_is_negative
    CHECK (reason NOT IN ('sale', 'damage', 'transfer_out') OR quantity < 0)
);

CREATE INDEX stock_movements_product_idx ON stock_movements (product_id, occurred_at);
CREATE INDEX stock_movements_order_idx ON stock_movements (order_id);

-- Append-only. History that can be edited is not history, and an inventory
-- discrepancy is only explainable if nothing has been quietly rewritten. A
-- mistaken movement is corrected by posting the opposite movement, which leaves
-- both the error and the correction visible.
CREATE OR REPLACE FUNCTION reject_stock_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'stock_movements is append-only (attempted %). Post a reversing movement instead.',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_no_update
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION reject_stock_history_change();

CREATE TRIGGER stock_movements_no_delete
  BEFORE DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION reject_stock_history_change();

-- The cached balance. The log is the truth; this is a running total maintained
-- by the database so a product listing does not have to sum thousands of rows.
-- Because only the trigger below writes it, and the log cannot be edited, the
-- two cannot drift — and product_stock_discrepancies proves it.
CREATE TABLE product_stock (
  product_id uuid PRIMARY KEY REFERENCES products (id) ON DELETE CASCADE,
  on_hand    integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger AS $$
BEGIN
  INSERT INTO product_stock (product_id, on_hand, updated_at)
  VALUES (NEW.product_id, NEW.quantity, now())
  ON CONFLICT (product_id) DO UPDATE
    SET on_hand = product_stock.on_hand + EXCLUDED.on_hand,
        updated_at = now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_apply
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- Every product has a balance row from the moment it exists, so "no stock row"
-- and "zero stock" are never confused.
CREATE OR REPLACE FUNCTION init_product_stock() RETURNS trigger AS $$
BEGIN
  INSERT INTO product_stock (product_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_init_stock
  AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION init_product_stock();

-- Reconciliation. If this ever returns a row, the cache and the log disagree
-- and something has written product_stock directly.
CREATE VIEW product_stock_discrepancies AS
SELECT
  ps.product_id,
  ps.on_hand AS cached,
  COALESCE(log.total, 0) AS from_log
FROM product_stock ps
LEFT JOIN (
  SELECT product_id, SUM(quantity)::integer AS total
  FROM stock_movements GROUP BY product_id
) log ON log.product_id = ps.product_id
WHERE ps.on_hand <> COALESCE(log.total, 0);

-- Soft holds. Stock leaves the building on payment, but it must stop being
-- sellable the moment it is in someone's confirmed order, or two customers buy
-- the last sofa.
CREATE TYPE reservation_status AS ENUM ('held', 'committed', 'released');

CREATE TABLE stock_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  quantity    integer NOT NULL CHECK (quantity > 0),
  status      reservation_status NOT NULL DEFAULT 'held',
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,

  UNIQUE (order_id, product_id),

  CONSTRAINT reservation_resolution_is_dated
    CHECK (status = 'held' OR resolved_at IS NOT NULL)
);

CREATE INDEX stock_reservations_product_idx ON stock_reservations (product_id)
  WHERE status = 'held';

-- What the storefront should actually publish as availability.
CREATE VIEW product_availability AS
SELECT
  p.id AS product_id,
  ps.on_hand,
  COALESCE(held.quantity, 0) AS reserved,
  ps.on_hand - COALESCE(held.quantity, 0) AS available,
  p.low_stock_threshold,
  (ps.on_hand - COALESCE(held.quantity, 0)) <= p.low_stock_threshold AS is_low
FROM products p
JOIN product_stock ps ON ps.product_id = p.id
LEFT JOIN (
  SELECT product_id, SUM(quantity)::integer AS quantity
  FROM stock_reservations WHERE status = 'held' GROUP BY product_id
) held ON held.product_id = p.id;
