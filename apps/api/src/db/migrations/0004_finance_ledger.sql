-- Double-entry ledger.
--
-- The one place where correctness is enforced by the database rather than by
-- application code. Under concurrency, "the service always writes balanced
-- entries" is a hope; a deferred constraint trigger is a guarantee.
--
-- None of this is expressible in Sequelize models, which is the trade-off
-- recorded in context/06-replatform-plan.md section 1: models describe tables,
-- migrations describe the truth.

CREATE TABLE fin.accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id   uuid REFERENCES fin.accounts(id),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Accounting periods. Locking one is what makes last month's P&L stable;
-- without it, a backdated entry silently rewrites a report someone has already
-- acted on.
CREATE TABLE fin.periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at   timestamptz,
  closed_by   uuid REFERENCES core.staff(id),
  CONSTRAINT period_ordered CHECK (ends_on >= starts_on),
  CONSTRAINT no_overlap EXCLUDE USING gist (daterange(starts_on, ends_on, '[]') WITH &&)
);

CREATE TABLE fin.journal_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date    date NOT NULL,
  period_id     uuid NOT NULL REFERENCES fin.periods(id),
  -- What caused this entry. Every posting traces back to a business event;
  -- an entry nobody can explain is an entry nobody can audit.
  source_type   text NOT NULL CHECK (source_type IN
                  ('order','payment','refund','expense','bill','stock_movement','adjustment','opening')),
  source_id     uuid,
  memo          text,
  posted_by     uuid REFERENCES core.staff(id),
  posted_at     timestamptz NOT NULL DEFAULT now(),
  -- Corrections are reversing entries, never edits.
  reverses_id   uuid REFERENCES fin.journal_entries(id),
  CONSTRAINT no_self_reversal CHECK (reverses_id IS NULL OR reverses_id <> id)
);

CREATE INDEX ON fin.journal_entries (period_id, entry_date);
CREATE INDEX ON fin.journal_entries (source_type, source_id);

CREATE TABLE fin.journal_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid NOT NULL REFERENCES fin.journal_entries(id) ON DELETE RESTRICT,
  account_id    uuid NOT NULL REFERENCES fin.accounts(id),
  debit_minor   core.money_minor NOT NULL DEFAULT 0 CHECK (debit_minor  >= 0),
  credit_minor  core.money_minor NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  -- Cost attribution: this is what makes "did we make money on that job?" a
  -- query rather than a spreadsheet.
  project_id    uuid,
  memo          text,
  -- A line is a debit or a credit, never both and never neither.
  CONSTRAINT one_side_only CHECK ((debit_minor = 0) <> (credit_minor = 0))
);

-- The trial balance query.
CREATE INDEX ON fin.journal_lines (account_id, entry_id);
CREATE INDEX ON fin.journal_lines (entry_id);
CREATE INDEX ON fin.journal_lines (project_id) WHERE project_id IS NOT NULL;

-- Balance enforcement.
--
-- DEFERRABLE INITIALLY DEFERRED is essential, not decoration: lines are
-- inserted one at a time, so the entry is only balanced once the last one
-- lands. Checking immediately would reject every entry at its first line.
CREATE OR REPLACE FUNCTION fin.assert_entry_balanced()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  total_debit  bigint;
  total_credit bigint;
  target       uuid := COALESCE(NEW.entry_id, OLD.entry_id);
BEGIN
  SELECT COALESCE(sum(debit_minor), 0), COALESCE(sum(credit_minor), 0)
    INTO total_debit, total_credit
    FROM fin.journal_lines WHERE entry_id = target;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'journal entry % does not balance: debits %, credits %',
      target, total_debit, total_credit;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER entry_balanced
  AFTER INSERT OR UPDATE OR DELETE ON fin.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION fin.assert_entry_balanced();

-- Period locking. Rejects a posting dated inside a closed period.
CREATE OR REPLACE FUNCTION fin.assert_period_open()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE period_status text;
BEGIN
  SELECT status INTO period_status FROM fin.periods WHERE id = NEW.period_id;
  IF period_status = 'closed' THEN
    RAISE EXCEPTION 'period % is closed; post the correction to the open period instead', NEW.period_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER period_open BEFORE INSERT OR UPDATE ON fin.journal_entries
  FOR EACH ROW EXECUTE FUNCTION fin.assert_period_open();

-- Immutability. Posted history is append-only; a correction is a new reversing
-- entry. Enforced here rather than trusted to application code, because the
-- application is exactly what an auditor cannot inspect.
CREATE OR REPLACE FUNCTION fin.reject_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows are immutable; post a reversing entry instead';
END;
$$;

CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON fin.journal_entries
  FOR EACH ROW EXECUTE FUNCTION fin.reject_mutation();

CREATE TRIGGER touch BEFORE UPDATE ON fin.accounts
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
