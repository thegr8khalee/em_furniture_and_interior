-- Everything that was still only in Mongo: content, the interior-design module,
-- what the shop tells its customers, what it promotes, and what it records
-- about who did what.
--
-- These are the last collections. Nothing here is a new capability; each table
-- is the Mongo document with its implicit rules made explicit, and the pattern
-- is the same one the earlier migrations used — a reference is a foreign key, a
-- fixed set of values is an enum, a rule that has to hold is a constraint.

-- ------------------------------------------------------------------ content

CREATE TYPE publication_status AS ENUM ('draft', 'published');

CREATE TABLE blog_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  slug          text NOT NULL UNIQUE,
  excerpt       text NOT NULL DEFAULT '',
  content       text NOT NULL,
  cover_url     text,
  cover_public_id text,
  tags          text[] NOT NULL DEFAULT '{}',
  status        publication_status NOT NULL DEFAULT 'draft',
  published_at  timestamptz,

  -- The author keeps their name on the post after they leave.
  author_id     uuid REFERENCES staff (id) ON DELETE SET NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A published post has a publication date. The Mongo version set it in a
  -- handler, so a post published by any other route had none, and the blog
  -- ordered by a null.
  CONSTRAINT blog_published_is_dated
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX blog_posts_published_idx ON blog_posts (published_at DESC)
  WHERE status = 'published';
CREATE INDEX blog_posts_tags_idx ON blog_posts USING gin (tags);

CREATE TABLE faqs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text NOT NULL,
  answer     text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER faqs_updated_at BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX faqs_order_idx ON faqs (position, created_at) WHERE is_active;

-- Portfolio work. Not a sellable item: a project has a price because it says
-- what a job like this costs, not because anyone can buy it.
CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text NOT NULL,
  category    text NOT NULL,
  location    text NOT NULL,
  price       money_minor NOT NULL CHECK (price >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE project_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  url        text NOT NULL,
  public_id  text,
  position   integer NOT NULL DEFAULT 0,

  -- Same rule as the catalog's images: one image per slot, so a gallery has a
  -- defined order rather than whatever the array happened to hold.
  UNIQUE (project_id, position)
);

CREATE INDEX project_images_project_idx ON project_images (project_id);

-- -------------------------------------------------------- interior design

CREATE TABLE designers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  title      text NOT NULL DEFAULT '',
  bio        text NOT NULL DEFAULT '',
  avatar_url text,
  avatar_public_id text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER designers_updated_at BEFORE UPDATE ON designers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TYPE meeting_type AS ENUM ('calendly', 'zoom', 'meet', 'phone', 'none');
CREATE TYPE consultation_status AS ENUM ('new', 'scheduled', 'completed', 'cancelled');

CREATE TABLE consultation_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Set when the enquirer was signed in. Most are not, which is why the contact
  -- details below are on the request rather than looked up from an account.
  customer_id   uuid REFERENCES customers (id) ON DELETE SET NULL,

  full_name     text NOT NULL,
  email         citext NOT NULL,
  phone         text NOT NULL,

  budget_min    money_minor NOT NULL DEFAULT 0 CHECK (budget_min >= 0),
  budget_max    money_minor NOT NULL DEFAULT 0 CHECK (budget_max >= 0),
  style_preferences text[] NOT NULL DEFAULT '{}',

  floor_plan_url text,
  floor_plan_public_id text,

  preferred_designer_id uuid REFERENCES designers (id) ON DELETE SET NULL,
  assigned_designer_id  uuid REFERENCES designers (id) ON DELETE SET NULL,

  preferred_meeting_type meeting_type NOT NULL DEFAULT 'calendly',
  meeting_link  text,
  scheduled_at  timestamptz,

  status        consultation_status NOT NULL DEFAULT 'new',
  notes         text NOT NULL DEFAULT '',
  admin_notes   text NOT NULL DEFAULT '',

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- A budget that runs backwards is a form filled in wrongly, not a range.
  CONSTRAINT consultation_budget_ordered
    CHECK (budget_max = 0 OR budget_min <= budget_max),

  -- "Scheduled" with no time in the diary is the state that loses a customer.
  CONSTRAINT consultation_scheduled_has_a_time
    CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL),

  -- And a scheduled consultation has somebody to take it.
  CONSTRAINT consultation_scheduled_has_a_designer
    CHECK (status <> 'scheduled' OR assigned_designer_id IS NOT NULL)
);

CREATE TRIGGER consultation_requests_updated_at BEFORE UPDATE ON consultation_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX consultation_requests_status_idx
  ON consultation_requests (status, created_at DESC);
CREATE INDEX consultation_requests_designer_idx
  ON consultation_requests (assigned_designer_id, created_at DESC);

CREATE TABLE consultation_room_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultation_requests (id) ON DELETE CASCADE,
  url             text NOT NULL,
  public_id       text,
  position        integer NOT NULL DEFAULT 0,

  UNIQUE (consultation_id, position)
);

-- ------------------------------------------------------------- engagement

CREATE TYPE notification_type AS ENUM ('order', 'promo', 'system', 'loyalty');

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text NOT NULL,
  type        notification_type NOT NULL DEFAULT 'system',
  order_id    uuid REFERENCES orders (id) ON DELETE SET NULL,
  is_read     boolean NOT NULL DEFAULT false,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notification_read_is_dated
    CHECK (is_read IS FALSE OR read_at IS NOT NULL)
);

CREATE INDEX notifications_unread_idx
  ON notifications (customer_id, created_at DESC) WHERE NOT is_read;
CREATE INDEX notifications_customer_idx ON notifications (customer_id, created_at DESC);

CREATE TYPE loyalty_movement AS ENUM ('earn', 'redeem', 'adjustment');

-- The points ledger. `customers.loyalty_points` is the balance; this is why it
-- is that number. The Mongo version wrote both and nothing tied them together,
-- so a balance could not be explained from its history.
CREATE TABLE loyalty_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  order_id    uuid REFERENCES orders (id) ON DELETE SET NULL,
  type        loyalty_movement NOT NULL,

  -- Signed, in the direction the balance moves. An "earn" of -50 is a data
  -- error, not a redemption written oddly.
  points      integer NOT NULL CHECK (points <> 0),
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loyalty_direction_matches_type
    CHECK ((type = 'earn' AND points > 0)
        OR (type = 'redeem' AND points < 0)
        OR type = 'adjustment'),

  -- One earn per order, so re-running a delivery cannot pay the points twice.
  CONSTRAINT loyalty_one_earn_per_order EXCLUDE (order_id WITH =)
    WHERE (type = 'earn' AND order_id IS NOT NULL)
);

CREATE INDEX loyalty_transactions_customer_idx
  ON loyalty_transactions (customer_id, created_at DESC);

-- -------------------------------------------------------------- marketing

CREATE TYPE banner_position AS ENUM ('home', 'shop', 'collection', 'product');

CREATE TABLE promo_banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  subtitle   text,
  image_url  text NOT NULL,
  link_url   text,
  position   banner_position NOT NULL DEFAULT 'home',
  priority   integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT banner_window_ordered
    CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

CREATE TRIGGER promo_banners_updated_at BEFORE UPDATE ON promo_banners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX promo_banners_live_idx
  ON promo_banners (position, priority DESC) WHERE is_active;

CREATE TABLE flash_sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  discount_type  discount_type NOT NULL,

  -- The same two-units column as `coupons.discount_value`: basis points for a
  -- percentage, kobo for a fixed amount.
  discount_value bigint NOT NULL CHECK (discount_value > 0),
  banner_image_url text,
  is_active      boolean NOT NULL DEFAULT true,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT flash_sale_window_ordered CHECK (starts_at < ends_at),

  CONSTRAINT flash_sale_percentage_within_range
    CHECK (discount_type <> 'percentage' OR discount_value <= 10000)
);

CREATE TRIGGER flash_sales_updated_at BEFORE UPDATE ON flash_sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX flash_sales_live_idx ON flash_sales (starts_at, ends_at) WHERE is_active;

-- One table for both of the Mongo arrays. A flash sale targeted products and
-- collections through two parallel arrays of ids that nothing could join on;
-- both kinds are `sellable_items`, so both are rows here.
CREATE TABLE flash_sale_items (
  flash_sale_id    uuid NOT NULL REFERENCES flash_sales (id) ON DELETE CASCADE,
  sellable_item_id uuid NOT NULL REFERENCES sellable_items (id) ON DELETE CASCADE,

  PRIMARY KEY (flash_sale_id, sellable_item_id)
);

CREATE INDEX flash_sale_items_item_idx ON flash_sale_items (sellable_item_id);

-- ------------------------------------------------------------------- logs

CREATE TYPE audit_action AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
  'STATUS_CHANGE', 'PERMISSION_CHANGE', 'EXPORT', 'BULK_ACTION'
);
CREATE TYPE audit_outcome AS ENUM ('success', 'failed');

-- What an operator did. `actor_email` is denormalised on purpose: the entry has
-- to stay readable after the account is deleted, and an audit trail that says
-- "null did this" is not a trail.
CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES staff (id) ON DELETE SET NULL,
  actor_email   text NOT NULL,
  action        audit_action NOT NULL,

  -- Free text rather than an enum. A resource type is added whenever a screen
  -- is, and a log that refuses to record an unfamiliar one loses the entry that
  -- mattered most.
  resource_type text NOT NULL,
  resource_id   text,
  resource_name text,

  changes       jsonb,
  metadata      jsonb,
  ip_address    inet,
  user_agent    text,
  status        audit_outcome NOT NULL DEFAULT 'success',
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_resource_idx ON audit_logs (resource_type, resource_id);

-- What a shopper did. One of customer or guest session, or neither for somebody
-- who has not been identified at all yet.
CREATE TABLE activity_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      uuid REFERENCES customers (id) ON DELETE SET NULL,
  guest_session_id uuid REFERENCES guest_sessions (id) ON DELETE SET NULL,
  activity_type    text NOT NULL,
  resource_type    text,
  resource_id      text,
  metadata         jsonb,
  session_id       text,
  ip_address       inet,
  user_agent       text,
  referrer         text,
  page             text,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT activity_has_at_most_one_actor
    CHECK (num_nonnulls(customer_id, guest_session_id) <= 1)
);

CREATE INDEX activity_logs_created_idx ON activity_logs (created_at DESC);
CREATE INDEX activity_logs_customer_idx ON activity_logs (customer_id, created_at DESC);
CREATE INDEX activity_logs_type_idx ON activity_logs (activity_type, created_at DESC);

-- Mongo expired activity logs with a TTL index. Postgres has no equivalent, so
-- retention is a job rather than a property of the table: this is the statement
-- that job runs, kept here so the intent is not lost with the index.
--
--   DELETE FROM activity_logs WHERE created_at < now() - interval '90 days';
