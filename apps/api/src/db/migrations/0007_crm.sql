-- Consultations, designers, and interior projects as financial objects.
--
-- The commercially important flow, and the one the Mongo schema supported least
-- as a *financial* process: consultations existed, but a project had no budget,
-- no cost attribution and no margin. "Did we make money on that job?" was a
-- spreadsheet question.

CREATE TABLE crm.designers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid REFERENCES core.staff(id),
  name        text NOT NULL,
  email       citext,
  bio         text,
  hourly_rate_minor core.money_minor CHECK (hourly_rate_minor >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm.consultations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES core.profiles(id),
  contact_name    text NOT NULL,
  contact_email   citext NOT NULL,
  contact_phone   text,
  budget_min_minor core.money_minor CHECK (budget_min_minor >= 0),
  budget_max_minor core.money_minor CHECK (budget_max_minor >= 0),
  style_preference text,
  notes           text,
  designer_id     uuid REFERENCES crm.designers(id),
  scheduled_at    timestamptz,
  status          text NOT NULL DEFAULT 'requested' CHECK (status IN
                    ('requested','assigned','scheduled','completed','cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_range_ordered
    CHECK (budget_min_minor IS NULL OR budget_max_minor IS NULL OR budget_max_minor >= budget_min_minor)
);

CREATE INDEX ON crm.consultations (status, created_at DESC);
CREATE INDEX ON crm.consultations (designer_id);

CREATE TABLE crm.consultation_uploads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   uuid NOT NULL REFERENCES crm.consultations(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('room_photo','floor_plan','inspiration','other')),
  -- Cloudinary public id, not a URL: these are authenticated assets served by
  -- signed delivery URL. They are photographs of where somebody lives.
  asset_public_id   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crm.projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         text NOT NULL UNIQUE,
  consultation_id   uuid REFERENCES crm.consultations(id),
  profile_id        uuid REFERENCES core.profiles(id),
  designer_id       uuid REFERENCES crm.designers(id),
  title             text NOT NULL,
  -- Eight sequential phases. 5 -> 6 is the two-phase commit: before it nothing
  -- is reserved and nothing is posted; after it the business is committed.
  phase             integer NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 9),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','lost','closed')),
  quoted_minor      core.money_minor CHECK (quoted_minor >= 0),
  committed_minor   core.money_minor NOT NULL DEFAULT 0 CHECK (committed_minor >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON crm.projects (status, phase);
CREATE INDEX ON crm.projects (profile_id);

-- Append-only phase history, so how a job progressed is auditable.
CREATE TABLE crm.project_phase_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES crm.projects(id) ON DELETE CASCADE,
  from_phase  integer,
  to_phase    integer NOT NULL,
  changed_by  uuid REFERENCES core.staff(id),
  reason      text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON crm.project_phase_history (project_id, changed_at);

-- Scope changes mid-project are where bespoke work loses money. A variation is
-- a first-class object: described, priced, approved, and added to the committed
-- value — not an informal agreement nobody costed.
CREATE TABLE crm.variation_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES crm.projects(id) ON DELETE CASCADE,
  description   text NOT NULL,
  amount_minor  core.money_minor NOT NULL CHECK (amount_minor <> 0),
  requested_by  uuid REFERENCES core.staff(id),
  approved_by   uuid REFERENCES core.staff(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- No self-approval, at the database level.
  CONSTRAINT approver_is_not_requester CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE TABLE crm.project_time_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES crm.projects(id) ON DELETE CASCADE,
  staff_id      uuid REFERENCES core.staff(id),
  designer_id   uuid REFERENCES crm.designers(id),
  phase         integer CHECK (phase BETWEEN 1 AND 9),
  minutes       integer NOT NULL CHECK (minutes > 0),
  rate_minor    core.money_minor CHECK (rate_minor >= 0),
  worked_on     date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON crm.project_time_entries (project_id, worked_on);

CREATE TRIGGER touch BEFORE UPDATE ON crm.designers
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON crm.consultations
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON crm.projects
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
