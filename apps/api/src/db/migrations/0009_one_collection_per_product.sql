-- A product belongs to at most one collection.
--
-- The Mongo model expressed this as a single `collectionId` on the product,
-- kept in sync by hand with the collection's `productIds` array — two copies of
-- one fact, which is why the admin controller carried code to remove a product
-- from its previous collection before adding it to a new one.
--
-- collection_products already holds the relationship once. This makes the
-- cardinality the schema's business rather than the service's: adding a product
-- to a second collection is refused instead of silently producing a product the
-- old code would have shown in one place and the new code in another.
--
-- If the business later wants a product in several collections, dropping this
-- index is the whole change.
CREATE UNIQUE INDEX collection_products_one_collection_per_product
  ON collection_products (product_id);
