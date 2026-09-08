-- Every movement happens somewhere, and most callers do not need to say where.
--
-- `location_id` is NOT NULL because a movement with no place is a movement into
-- thin air. But a sale, a purchase receipt and an adjustment all knew nothing
-- about locations when they were written, and threading a location through every
-- one of them would mean touching code that has nothing to do with warehouses to
-- restate a default.
--
-- So the default is applied where the row is written, and the column stays NOT
-- NULL. A caller that knows where — a transfer, a stock take — says so and is
-- left alone; a caller that does not gets the default location, which is the
-- honest answer for a business with one workshop.
CREATE OR REPLACE FUNCTION default_stock_location() RETURNS trigger AS $$
BEGIN
  IF NEW.location_id IS NULL THEN
    SELECT id INTO NEW.location_id FROM stock_locations WHERE is_default;

    IF NEW.location_id IS NULL THEN
      RAISE EXCEPTION 'no default stock location exists'
        USING HINT = 'Mark one location as the default before recording movements.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Before the append-only guard and before the balance cache, because both of
-- those read a fully formed row.
CREATE TRIGGER stock_movements_default_location
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION default_stock_location();
