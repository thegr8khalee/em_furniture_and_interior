-- Inventory as an append-only movement log.
--
-- Finding F-02: stock was a single mutable number that selling never changed.
-- A mutable counter cannot be audited, reconciled or explained, so every stock
-- discrepancy becomes unanswerable. Here, current stock is DERIVED from
-- immutable movements; a mistake is corrected by a compensating movement, never
-- by editing history.

CREATE TABLE inv.locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  kind        text NOT NULL CHECK (kind IN ('showroom','warehouse','workshop','transit')),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inv.stock_movements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id),
  location_id       uuid NOT NULL REFERENCES inv.locations(id),
  kind              text NOT NULL CHECK (kind IN (
                      'goods_receipt','sale_dispatch','return_restock','transfer_out','transfer_in',
                      'count_adjustment','write_off','production_consume','production_output')),
  -- Signed: positive adds, negative removes. Zero is not a movement.
  quantity          integer NOT NULL CHECK (quantity <> 0),
  -- Weighted average at the time of the movement, so COGS and inventory value
  -- can be computed without re-deriving history.
  unit_cost_minor   core.money_minor CHECK (unit_cost_minor >= 0),
  reference_type    text,
  reference_id      uuid,
  reason            text,
  moved_by          uuid REFERENCES core.staff(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON inv.stock_movements (sellable_item_id, location_id, created_at);
CREATE INDEX ON inv.stock_movements (reference_type, reference_id);

-- Movements are history. Correcting one means posting its opposite.
CREATE OR REPLACE FUNCTION inv.reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'stock movements are immutable; post a compensating movement instead';
END;
$$;

CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON inv.stock_movements
  FOR EACH ROW EXECUTE FUNCTION inv.reject_mutation();

-- Reserving at order time prevents overselling; decrementing only at dispatch
-- keeps physical and system stock aligned. available = on_hand - reserved.
CREATE TABLE inv.reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id),
  location_id       uuid NOT NULL REFERENCES inv.locations(id),
  order_id          uuid REFERENCES sales.orders(id) ON DELETE CASCADE,
  quantity          integer NOT NULL CHECK (quantity > 0),
  -- Unpaid orders must not hold stock indefinitely.
  expires_at        timestamptz,
  released_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON inv.reservations (sellable_item_id, location_id) WHERE released_at IS NULL;
CREATE INDEX ON inv.reservations (order_id);

CREATE VIEW inv.stock_on_hand AS
  SELECT sellable_item_id, location_id, sum(quantity)::bigint AS on_hand
    FROM inv.stock_movements
   GROUP BY sellable_item_id, location_id;

CREATE VIEW inv.stock_available AS
  SELECT m.sellable_item_id,
         m.location_id,
         m.on_hand,
         COALESCE(r.reserved, 0) AS reserved,
         m.on_hand - COALESCE(r.reserved, 0) AS available
    FROM inv.stock_on_hand m
    LEFT JOIN (
      SELECT sellable_item_id, location_id, sum(quantity)::bigint AS reserved
        FROM inv.reservations
       WHERE released_at IS NULL AND (expires_at IS NULL OR expires_at > now())
       GROUP BY sellable_item_id, location_id
    ) r USING (sellable_item_id, location_id);

COMMENT ON VIEW inv.stock_available IS
  'Available-to-promise. Never read a stored stock number; it is derived here so it cannot drift.';

CREATE TABLE inv.stock_takes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES inv.locations(id),
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','counted','approved')),
  counted_by    uuid REFERENCES core.staff(id),
  approved_by   uuid REFERENCES core.staff(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Segregation of duties: whoever counted cannot also approve the variance.
  CONSTRAINT approver_is_not_counter CHECK (approved_by IS NULL OR approved_by <> counted_by)
);

CREATE TABLE inv.stock_take_lines (
  stock_take_id     uuid NOT NULL REFERENCES inv.stock_takes(id) ON DELETE CASCADE,
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id),
  expected_quantity integer NOT NULL,
  counted_quantity  integer NOT NULL CHECK (counted_quantity >= 0),
  PRIMARY KEY (stock_take_id, sellable_item_id)
);
