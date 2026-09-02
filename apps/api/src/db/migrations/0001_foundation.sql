-- Foundations every later migration leans on.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- Money is stored in the currency's minor unit (kobo for NGN) as an integer.
--
-- The Mongo schema used floating-point naira, which cannot represent 0.1 + 0.2
-- exactly. That is survivable for a product price and fatal for a ledger, where
-- a fraction of a kobo per row accumulates into a trial balance that does not
-- balance. Making it a domain rather than a convention means a column typed
-- money_minor cannot quietly become numeric later.
CREATE DOMAIN money_minor AS bigint;

COMMENT ON DOMAIN money_minor IS
  'Integer minor currency units (kobo). Never a float. Divide by 100 only for display.';

-- Currency travels with every amount rather than being assumed. Imported
-- furniture means foreign purchase costs, and retrofitting currency onto rows
-- that already exist is far more work than carrying it from the start.
CREATE TYPE currency_code AS ENUM ('NGN', 'USD', 'EUR', 'GBP');

-- updated_at maintained by the database, so a write that bypasses the ORM --
-- a manual fix, a bulk script -- still gets an accurate timestamp.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
