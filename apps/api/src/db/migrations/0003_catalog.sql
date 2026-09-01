-- Catalog, built around a supertype for anything that can be sold.
--
-- Mongo modelled this as an `item` id plus an `itemType` discriminator of
-- 'Product' | 'Collection', in carts, wishlists, order lines and coupon scopes.
-- SQL has no equivalent, and Sequelize's polymorphic associations give an
-- untyped column with no foreign key — precisely the integrity Postgres is
-- being adopted for.
--
-- catalog.sellable_items is that missing supertype. Order lines, cart items,
-- stock movements and ledger references all point at ONE real foreign key, and
-- every module still to be built needs to reference "a thing that can be sold"
-- uniformly.

CREATE TABLE catalog.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE catalog.sellable_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('product','collection')),
  -- Unique but nullable: most items have no SKU yet, and a plain unique index
  -- would reject all but the first of them (finding F-12).
  sku         text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE catalog.products (
  id                uuid PRIMARY KEY REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text NOT NULL,
  category_id       uuid NOT NULL REFERENCES catalog.categories(id),
  style             text NOT NULL,
  price_minor       core.money_minor NOT NULL CHECK (price_minor >= 0),
  discount_minor    core.money_minor CHECK (discount_minor >= 0),
  -- Finding F-03: without a cost, margin, COGS and inventory valuation are not
  -- "unbuilt" — they are uncomputable. Nullable because it is not known for
  -- every item on day one, but the column exists from the first row.
  cost_minor        core.money_minor CHECK (cost_minor >= 0),
  lead_time_days    integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  is_published      boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- A discounted price above the list price is a data-entry error, not a deal.
  CONSTRAINT discount_below_price CHECK (discount_minor IS NULL OR discount_minor <= price_minor)
);

-- Every shop page filters on these two, and the Mongo collection had no index
-- at all (finding F-12).
CREATE INDEX ON catalog.products (category_id, style) WHERE is_published;
CREATE INDEX ON catalog.products (created_at DESC);

CREATE TABLE catalog.collections (
  id              uuid PRIMARY KEY REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  name            text NOT NULL UNIQUE,
  description     text NOT NULL,
  style           text NOT NULL,
  price_minor     core.money_minor NOT NULL CHECK (price_minor >= 0),
  discount_minor  core.money_minor CHECK (discount_minor >= 0),
  cost_minor      core.money_minor CHECK (cost_minor >= 0),
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_below_price CHECK (discount_minor IS NULL OR discount_minor <= price_minor)
);

-- Which products make up a collection.
CREATE TABLE catalog.collection_products (
  collection_id uuid NOT NULL REFERENCES catalog.collections(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE TABLE catalog.item_images (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  url               text NOT NULL,
  public_id         text,
  position          integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON catalog.item_images (sellable_item_id, position);

CREATE TABLE catalog.item_seo (
  sellable_item_id  uuid PRIMARY KEY REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  title             text,
  description       text,
  keywords          text[],
  schema_json_ld    jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER touch BEFORE UPDATE ON catalog.categories
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON catalog.products
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON catalog.collections
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- The supertype only pays for itself if the subtype rows agree with it. These
-- stop a product row hanging off a sellable_item declared as a collection.
CREATE OR REPLACE FUNCTION catalog.assert_kind()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  SELECT kind INTO actual FROM catalog.sellable_items WHERE id = NEW.id;
  IF actual IS DISTINCT FROM TG_ARGV[0] THEN
    RAISE EXCEPTION 'sellable_item % is kind %, not %', NEW.id, actual, TG_ARGV[0];
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER product_kind AFTER INSERT OR UPDATE ON catalog.products
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog.assert_kind('product');

CREATE CONSTRAINT TRIGGER collection_kind AFTER INSERT OR UPDATE ON catalog.collections
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog.assert_kind('collection');
