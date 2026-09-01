-- Identity, staff and authorisation.
--
-- Supabase Auth owns credentials; auth.users is the identity of record. These
-- tables carry the application's view of a person. Staff and customers share
-- one Supabase pool, which is what removes the shared-cookie collision in
-- finding F-10 — a caller's kind is decided by which of these tables holds
-- their id, never by a claim in their token.

CREATE TABLE core.profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id  uuid NOT NULL UNIQUE,
  email             citext NOT NULL UNIQUE,
  full_name         text NOT NULL,
  phone             text,
  loyalty_points    integer NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.staff (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id  uuid NOT NULL UNIQUE,
  email             citext NOT NULL UNIQUE,
  username          text NOT NULL,
  role              text NOT NULL CHECK (role IN (
                      'super_admin','managing_director','operations_manager','accountant',
                      'sales_officer','interior_designer','warehouse_officer',
                      'content_editor','customer_service','marketing_officer')),
  -- Empty means "whatever the role grants". A non-empty array overrides it, so
  -- one person can be given an exception without inventing a role for them.
  permissions       text[] NOT NULL DEFAULT '{}',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON core.staff (role) WHERE is_active;

CREATE TABLE core.addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid REFERENCES core.profiles(id) ON DELETE CASCADE,
  full_name     text NOT NULL,
  phone         text NOT NULL,
  email         citext NOT NULL,
  line1         text NOT NULL,
  city          text NOT NULL,
  state         text NOT NULL,
  country       text NOT NULL DEFAULT 'Nigeria',
  postal_code   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON core.addresses (profile_id);

-- Gapless numbering for anything a tax authority might ask about. A Postgres
-- sequence is wrong here: sequences skip on rollback, and an auditor asking why
-- INV-2026-0041 does not exist is not a conversation worth having. Callers take
-- the next value with SELECT ... FOR UPDATE inside the same transaction that
-- inserts the document, so a rolled-back document returns its number.
CREATE TABLE core.counters (
  scope       text NOT NULL,
  year        integer NOT NULL,
  next_value  integer NOT NULL DEFAULT 1 CHECK (next_value >= 1),
  PRIMARY KEY (scope, year)
);

COMMENT ON TABLE core.counters IS
  'Gapless document numbering. Take values with SELECT ... FOR UPDATE in the inserting transaction, never with a sequence.';

CREATE TRIGGER touch BEFORE UPDATE ON core.profiles
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON core.staff
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON core.addresses
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
