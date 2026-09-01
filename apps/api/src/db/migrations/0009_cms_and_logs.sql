-- Content, and the log tables that replace Mongo's TTL indexes.

CREATE TABLE cms.blog_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  excerpt       text,
  content       text NOT NULL,
  cover_asset_id text,
  author        text,
  tags          text[] NOT NULL DEFAULT '{}',
  is_published  boolean NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT published_has_a_date CHECK (NOT is_published OR published_at IS NOT NULL)
);

CREATE INDEX ON cms.blog_posts (published_at DESC) WHERE is_published;

CREATE TABLE cms.faqs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text NOT NULL,
  answer        text NOT NULL,
  category      text,
  position      integer NOT NULL DEFAULT 0,
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON cms.faqs (position) WHERE is_published;

CREATE TABLE cms.portfolio_projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  title         text NOT NULL,
  description   text,
  category      text,
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms.media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id     text NOT NULL UNIQUE,
  kind          text NOT NULL,
  -- Confidential assets (room photos, floor plans, proof of payment) are
  -- Cloudinary 'authenticated' resources served by signed URL, never a stable
  -- public link. See docs/DATA_PROTECTION.md.
  is_public     boolean NOT NULL DEFAULT true,
  width         integer,
  height        integer,
  bytes         integer,
  uploaded_by   uuid REFERENCES core.staff(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cms.banners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement     text NOT NULL CHECK (placement IN ('home','shop','product')),
  title         text,
  subtitle      text,
  asset_id      text,
  link_url      text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT window_ordered CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE cms.flash_sales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  discount_percent  numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT window_ordered CHECK (ends_at > starts_at)
);

CREATE TABLE cms.flash_sale_items (
  flash_sale_id     uuid NOT NULL REFERENCES cms.flash_sales(id) ON DELETE CASCADE,
  sellable_item_id  uuid NOT NULL REFERENCES catalog.sellable_items(id) ON DELETE CASCADE,
  PRIMARY KEY (flash_sale_id, sellable_item_id)
);

-- ------------------------------------------------------------------- logs

-- Retained seven years: it is the evidence for "who looked at this customer,
-- and when", and step 2 of a breach response is unanswerable without it.
CREATE TABLE core.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES core.staff(id),
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   uuid,
  changes       jsonb,
  metadata      jsonb,
  ip_address    inet,
  user_agent    text,
  status        text NOT NULL DEFAULT 'success',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON core.audit_logs (actor_id, created_at DESC);
CREATE INDEX ON core.audit_logs (resource_type, resource_id);
CREATE INDEX ON core.audit_logs (created_at DESC);

-- PostgreSQL has no TTL index, which Mongo used to expire these after 90 days.
-- Monthly partitions dropped on a schedule are the equivalent, and far cheaper
-- than a mass DELETE, which would bloat the table and hold locks. Missing this
-- is the kind of thing discovered when the table is 40 GB.
CREATE TABLE core.activity_logs (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  supabase_user_id uuid,
  profile_id    uuid,
  activity_type text NOT NULL,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  session_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX ON core.activity_logs (profile_id, created_at DESC);
CREATE INDEX ON core.activity_logs (activity_type, created_at DESC);

-- Creates the partition for a given month if it does not exist. Called by the
-- retention job; also safe to call ahead of time.
CREATE OR REPLACE FUNCTION core.ensure_activity_partition(target date)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  start_of_month date := date_trunc('month', target)::date;
  next_month     date := (date_trunc('month', target) + interval '1 month')::date;
  partition_name text := format('activity_logs_%s', to_char(start_of_month, 'YYYY_MM'));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'core' AND c.relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE core.%I PARTITION OF core.activity_logs FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_of_month, next_month
    );
  END IF;
END;
$$;

-- Retention is a partition DROP, not a DELETE.
CREATE OR REPLACE FUNCTION core.drop_activity_partitions_older_than(days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  cutoff  date := (now() - make_interval(days => days))::date;
  rec     record;
  dropped integer := 0;
BEGIN
  FOR rec IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'core' AND c.relname LIKE 'activity_logs_%'
  LOOP
    IF to_date(right(rec.relname, 7), 'YYYY_MM') < date_trunc('month', cutoff) THEN
      EXECUTE format('DROP TABLE core.%I', rec.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END;
$$;

SELECT core.ensure_activity_partition(now()::date);
SELECT core.ensure_activity_partition((now() + interval '1 month')::date);

CREATE TABLE core.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid REFERENCES core.profiles(id) ON DELETE CASCADE,
  staff_id      uuid REFERENCES core.staff(id) ON DELETE CASCADE,
  channel       text NOT NULL CHECK (channel IN ('in_app','email','whatsapp','sms')),
  template      text NOT NULL,
  payload       jsonb,
  -- One outbox: every send is a row before it is dispatched, so a failure is
  -- retryable and auditable instead of vanishing inside a request handler.
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','read')),
  attempts      integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_ref  text,
  -- Stops a retried webhook or double-clicked button sending twice.
  event_key     text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  CONSTRAINT notification_has_a_recipient CHECK (profile_id IS NOT NULL OR staff_id IS NOT NULL)
);

CREATE INDEX ON core.notifications (status, created_at) WHERE status = 'queued';
CREATE INDEX ON core.notifications (profile_id, created_at DESC);

CREATE TRIGGER touch BEFORE UPDATE ON cms.blog_posts
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON cms.faqs
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON cms.portfolio_projects
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON cms.banners
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
