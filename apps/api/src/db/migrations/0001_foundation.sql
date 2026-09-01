-- Domain schemas and shared helpers.
--
-- Schemas are the boundary the module rule in context/03-backend-architecture.md
-- rests on: cross-domain access goes through a service, never a foreign model.
-- Naming them here makes that boundary visible in the database, not just in
-- convention.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS cms;
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS inv;
CREATE SCHEMA IF NOT EXISTS fin;

-- Every table carries created_at/updated_at; this keeps updated_at honest
-- without each table repeating the same trigger body.
CREATE OR REPLACE FUNCTION core.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Money is stored as integer minor units (kobo) everywhere — finding F-11.
-- This domain makes that a property of the type rather than a convention
-- someone has to remember, and rules out a float column by construction.
CREATE DOMAIN core.money_minor AS bigint;

COMMENT ON DOMAIN core.money_minor IS
  'Integer minor units (kobo). Never a float: summing thousands of float rows into a ledger that must balance is finding F-11.';
