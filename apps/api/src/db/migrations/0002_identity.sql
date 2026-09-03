-- Customers and staff.
--
-- These stay two tables rather than one "users with a role" table: a customer
-- has a cart and loyalty points, a staff member has permissions and an audit
-- trail, and the overlap is only "has an email and a password". Merging them is
-- what produced the shared `jwt` cookie the audit flagged, where signing into
-- the storefront and signing into the console were the same act.

CREATE TABLE customers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 citext NOT NULL UNIQUE,
  full_name             text NOT NULL,
  phone_number          text,
  password_hash         text,
  -- Nullable so a Supabase-managed identity needs no local password. Set when
  -- the account still authenticates against the legacy path.
  supabase_user_id      uuid UNIQUE,
  loyalty_points        integer NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  password_reset_token  text,
  password_reset_expires timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- An account must be reachable by some means of authentication.
  CONSTRAINT customers_has_credential
    CHECK (password_hash IS NOT NULL OR supabase_user_id IS NOT NULL)
);

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TYPE staff_role AS ENUM (
  'super_admin', 'admin', 'editor', 'support', 'social_media_manager'
);

CREATE TABLE staff (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text NOT NULL UNIQUE,
  email            citext NOT NULL UNIQUE,
  password_hash    text,
  supabase_user_id uuid UNIQUE,
  role             staff_role NOT NULL DEFAULT 'admin',
  -- An explicit grant overrides the role default; empty means "use the role".
  -- Kept as an array rather than a join table because it is read on every
  -- request and never queried across accounts.
  permissions      text[] NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_has_credential
    CHECK (password_hash IS NOT NULL OR supabase_user_id IS NOT NULL)
);

CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Guest shoppers. A session, not a person: it carries a cart before anyone has
-- signed up, and is merged into a customer on registration.
CREATE TABLE guest_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id    text NOT NULL UNIQUE,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER guest_sessions_updated_at BEFORE UPDATE ON guest_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX guest_sessions_last_seen_idx ON guest_sessions (last_seen_at);
