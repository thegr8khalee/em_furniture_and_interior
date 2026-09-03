-- The catalog, built on a supertype that replaces Mongo's refPath polymorphism.
--
-- In Mongo, a cart line, wishlist entry, order line and coupon rule each stored
-- { item: ObjectId, itemType: 'Product' | 'Collection' }. Nothing enforced that
-- the id existed, or that it existed in the collection the string named: a typo
-- in itemType, or a deleted product, produced a row that pointed at nothing and
-- failed only when something later tried to read it.
--
-- sellable_items is the thing you can put in a cart. products and collections
-- are its two subtypes, and everything that references "something buyable"
-- points at one real foreign key.

CREATE TYPE sellable_kind AS ENUM ('product', 'collection');

CREATE TABLE sellable_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             sellable_kind NOT NULL,

  name             text NOT NULL,
  description      text,
  style            text NOT NULL,

  price            money_minor NOT NULL CHECK (price >= 0),
  currency         currency_code NOT NULL DEFAULT 'NGN',
  is_promo         boolean NOT NULL DEFAULT false,
  discounted_price money_minor CHECK (discounted_price IS NULL OR discounted_price >= 0),

  -- What the item cost us. Absent from the Mongo schema entirely, which is why
  -- no report could show a margin. Nullable until it is backfilled.
  cost_price       money_minor CHECK (cost_price IS NULL OR cost_price >= 0),

  is_best_seller   boolean NOT NULL DEFAULT false,
  is_foreign       boolean NOT NULL DEFAULT false,
  origin           text,

  average_rating   numeric(2,1) NOT NULL DEFAULT 0
                     CHECK (average_rating >= 0 AND average_rating <= 5),
  review_count     integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- Subtype tables key on (id, kind), so this pair must be unique.
  UNIQUE (id, kind),

  -- A promotion with no promotional price was allowed by the Mongo schema's
  -- conditional `required`, because that only fires through the ODM.
  CONSTRAINT sellable_promo_needs_price
    CHECK (NOT is_promo OR discounted_price IS NOT NULL),

  -- A "discount" above list price is a mispriced item, not a discount.
  CONSTRAINT sellable_discount_below_list
    CHECK (discounted_price IS NULL OR discounted_price <= price),

  -- Same shape as the ODM's conditional requirement, enforced for every writer.
  CONSTRAINT sellable_foreign_needs_origin
    CHECK (NOT is_foreign OR origin IS NOT NULL)
);

CREATE TRIGGER sellable_items_updated_at BEFORE UPDATE ON sellable_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX sellable_items_kind_idx ON sellable_items (kind);
CREATE INDEX sellable_items_style_idx ON sellable_items (style);
CREATE INDEX sellable_items_promo_idx ON sellable_items (is_promo) WHERE is_promo;

CREATE TABLE products (
  id                 uuid PRIMARY KEY,
  kind               sellable_kind NOT NULL DEFAULT 'product'
                       CHECK (kind = 'product'),

  category           text NOT NULL,
  components         text,          -- the Mongo model's free-text `items` field
  sku                text UNIQUE,   -- unique but optional: not every piece has one
  warehouse_location text,

  -- Stock itself is NOT here: it is derived from the append-only movement log
  -- in 0005. This is only the policy for when to reorder.
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),

  lead_time_days     integer NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  shipping_min_days  integer CHECK (shipping_min_days IS NULL OR shipping_min_days >= 0),
  shipping_max_days  integer CHECK (shipping_max_days IS NULL OR shipping_max_days >= 0),

  seo_title          text,
  seo_description    text,
  seo_keywords       text[] NOT NULL DEFAULT '{}',
  seo_schema_json_ld jsonb,

  -- The composite reference is what makes the subtype safe: a products row
  -- cannot attach to a sellable_item that declares itself a collection.
  FOREIGN KEY (id, kind) REFERENCES sellable_items (id, kind) ON DELETE CASCADE,

  CONSTRAINT products_shipping_window_ordered
    CHECK (shipping_min_days IS NULL OR shipping_max_days IS NULL
           OR shipping_min_days <= shipping_max_days)
);

CREATE INDEX products_category_idx ON products (category);

CREATE TABLE collections (
  id                    uuid PRIMARY KEY,
  kind                  sellable_kind NOT NULL DEFAULT 'collection'
                          CHECK (kind = 'collection'),
  cover_image_url       text,
  cover_image_public_id text,

  FOREIGN KEY (id, kind) REFERENCES sellable_items (id, kind) ON DELETE CASCADE
);

-- Which products make up a collection. Was an array of ObjectIds with no
-- referential integrity; a deleted product left a dangling id behind.
CREATE TABLE collection_products (
  collection_id uuid NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX collection_products_product_idx ON collection_products (product_id);

CREATE TABLE sellable_images (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_item_id uuid NOT NULL REFERENCES sellable_items (id) ON DELETE CASCADE,
  url              text NOT NULL,
  public_id        text,          -- Cloudinary handle, needed to delete the asset
  position         integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (sellable_item_id, position)
);

CREATE INDEX sellable_images_item_idx ON sellable_images (sellable_item_id);

-- One reviews table for both subtypes. Mongo embedded an identical review
-- schema twice, so "all reviews awaiting moderation" meant scanning two
-- collections and merging in application code.
CREATE TABLE reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sellable_item_id     uuid NOT NULL REFERENCES sellable_items (id) ON DELETE CASCADE,
  customer_id          uuid NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  rating               integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment              text,
  is_verified_purchase boolean NOT NULL DEFAULT false,
  is_approved          boolean NOT NULL DEFAULT false,
  approved_by          uuid REFERENCES staff (id) ON DELETE SET NULL,
  approved_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- One review per customer per item; the embedded arrays allowed duplicates.
  UNIQUE (sellable_item_id, customer_id),

  CONSTRAINT reviews_approval_is_attributed
    CHECK ((is_approved IS FALSE AND approved_at IS NULL)
           OR (is_approved IS TRUE AND approved_at IS NOT NULL))
);

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX reviews_item_idx ON reviews (sellable_item_id);
CREATE INDEX reviews_pending_idx ON reviews (created_at) WHERE NOT is_approved;

-- The rating is maintained by the database rather than a pre-save hook, so it
-- stays correct when a review is approved by a moderation endpoint, a bulk
-- script, or psql. Only approved reviews count: an aggregate built from
-- unmoderated reviews would let anyone who can post one move the number.
CREATE OR REPLACE FUNCTION refresh_sellable_rating() RETURNS trigger AS $$
DECLARE
  target uuid := COALESCE(NEW.sellable_item_id, OLD.sellable_item_id);
BEGIN
  UPDATE sellable_items s
  SET average_rating = COALESCE(agg.avg_rating, 0),
      review_count   = COALESCE(agg.n, 0)
  FROM (
    SELECT round(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS n
    FROM reviews
    WHERE sellable_item_id = target AND is_approved
  ) agg
  WHERE s.id = target;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_sellable_rating();
