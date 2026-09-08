-- Where the stock is, and whether it is really there.
--
-- Three gaps, all in the same place.
--
-- **Where.** `products.warehouse_location` was free text on the product — one
-- string for a thing that might sit in two places. There was one stock pool, so
-- "we have twelve" could not distinguish twelve in the showroom from twelve in a
-- container nobody can reach today. The movement log has carried `transfer_in`
-- and `transfer_out` reasons since it was written, with nothing able to use them.
--
-- **Whether.** Stock could be corrected one product at a time, with a note. A
-- stock take is not that: it is counting everything on one day, comparing the
-- count against the book figure, and explaining the difference. Doing it as
-- forty separate adjustments loses the fact that they were one count.
--
-- **What to buy.** `low_stock_threshold` and `lead_time_days` have been on every
-- product since the catalog migration and nothing has ever read them.

CREATE TABLE stock_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  address     text,

  -- Whether stock here can be sold. A container at the port holds real stock
  -- that no customer can be promised, and counting it as available is how an
  -- order is taken for something nobody can ship.
  is_sellable boolean NOT NULL DEFAULT true,

  -- Where a movement goes when nothing says otherwise. Exactly one, so the
  -- answer to "where did this arrive?" is never ambiguous.
  is_default  boolean NOT NULL DEFAULT false,

  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER stock_locations_updated_at BEFORE UPDATE ON stock_locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX stock_locations_one_default ON stock_locations (is_default)
  WHERE is_default;

-- The workshop is where things are made and where they are sold from, so it is
-- the default until somebody says otherwise.
INSERT INTO stock_locations (name, is_sellable, is_default)
VALUES ('Workshop', true, true)
ON CONFLICT (name) DO NOTHING;

-- Every movement happens somewhere. Backfilled to the default, because every
-- movement so far did happen somewhere — there was simply nowhere to record it.
ALTER TABLE stock_movements
  ADD COLUMN location_id uuid REFERENCES stock_locations (id) ON DELETE RESTRICT;

-- The append-only trigger refuses an UPDATE, which is exactly its job — a
-- movement is history and history does not get rewritten. Adding a column that
-- did not exist when the row was written is the one case that is not a rewrite,
-- so the guard is lifted for the backfill and immediately put back.
ALTER TABLE stock_movements DISABLE TRIGGER stock_movements_no_update;

UPDATE stock_movements
   SET location_id = (SELECT id FROM stock_locations WHERE is_default)
 WHERE location_id IS NULL;

ALTER TABLE stock_movements ENABLE TRIGGER stock_movements_no_update;

ALTER TABLE stock_movements ALTER COLUMN location_id SET NOT NULL;

CREATE INDEX stock_movements_location_idx ON stock_movements (location_id, product_id);

-- A transfer is two movements that must both exist: out of one place and into
-- another. Pairing them means a half-finished transfer cannot leave stock
-- nowhere, which is what an unpaired `transfer_out` would do.
ALTER TABLE stock_movements
  ADD COLUMN transfer_group uuid;

CREATE INDEX stock_movements_transfer_idx ON stock_movements (transfer_group)
  WHERE transfer_group IS NOT NULL;

-- ------------------------------------------------------------- stock takes

CREATE TYPE stock_take_status AS ENUM ('counting', 'applied', 'abandoned');

CREATE TABLE stock_takes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES stock_locations (id) ON DELETE RESTRICT,

  counted_on  date NOT NULL,
  status      stock_take_status NOT NULL DEFAULT 'counting',

  notes       text,
  counted_by  uuid REFERENCES staff (id) ON DELETE SET NULL,
  applied_by  uuid REFERENCES staff (id) ON DELETE SET NULL,
  applied_at  timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stock_take_application_is_attributed
    CHECK (status <> 'applied' OR (applied_by IS NOT NULL AND applied_at IS NOT NULL))
);

CREATE TRIGGER stock_takes_updated_at BEFORE UPDATE ON stock_takes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One count in progress per location. Two people counting the same shelf into
-- two different sheets is how a stock take produces a number nobody trusts.
CREATE UNIQUE INDEX stock_takes_one_open_per_location
  ON stock_takes (location_id) WHERE status = 'counting';

CREATE TABLE stock_take_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_take_id uuid NOT NULL REFERENCES stock_takes (id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,

  -- What the books said when the sheet was drawn up. Frozen at that moment: the
  -- variance is against what was expected when counting began, and a sale
  -- during the count must not silently change what the counter was checking.
  expected      integer NOT NULL,
  counted       integer CHECK (counted IS NULL OR counted >= 0),

  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (stock_take_id, product_id)
);

CREATE INDEX stock_take_lines_take_idx ON stock_take_lines (stock_take_id);
