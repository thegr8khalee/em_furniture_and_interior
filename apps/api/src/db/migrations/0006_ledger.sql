-- Double-entry accounting.
--
-- Everything the audit called "finance" was a SUM over the orders collection.
-- That is a sales report: it cannot express a cost, an expense, a liability or
-- a bank balance, and nothing reconciles because there is nothing to reconcile
-- against. This is the spine those modules hang off — once it exists, expenses,
-- purchase orders and payroll are each a form plus a posting rule.

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- for the no-overlapping-periods constraint

-- ---------------------------------------------------------------- numbering
--
-- Gapless numbering. A Postgres sequence is deliberately NOT used: sequences do
-- not roll back, so a failed transaction burns its number and leaves a hole.
-- "Why is there no invoice INV-2026-0041?" is not a conversation worth having
-- with an auditor. This takes a row lock instead, so the number returns to the
-- pool if the transaction that claimed it rolls back.
CREATE TABLE counters (
  name  text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0 CHECK (value >= 0)
);

CREATE OR REPLACE FUNCTION next_number(counter_name text) RETURNS bigint AS $$
DECLARE
  n bigint;
BEGIN
  INSERT INTO counters (name, value) VALUES (counter_name, 1)
  ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
  RETURNING value INTO n;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------- chart of accounts
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE normal_balance AS ENUM ('debit', 'credit');

CREATE TABLE accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  type           account_type NOT NULL,
  parent_id      uuid REFERENCES accounts (id) ON DELETE RESTRICT,

  -- Which side increases this account. Derived from type by the trigger below
  -- rather than typed in, because getting it backwards inverts every report
  -- built on the account and the error is invisible until someone reconciles.
  normal_balance normal_balance NOT NULL,

  -- Only leaves take postings; a parent exists to be summed. Enforced through
  -- the composite foreign key on journal_lines, not by convention.
  is_postable    boolean NOT NULL DEFAULT true,

  is_active      boolean NOT NULL DEFAULT true,
  description    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (id, is_postable),

  CONSTRAINT accounts_normal_balance_matches_type CHECK (
    (type IN ('asset', 'expense') AND normal_balance = 'debit') OR
    (type IN ('liability', 'equity', 'revenue') AND normal_balance = 'credit')
  ),

  CONSTRAINT accounts_not_its_own_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX accounts_parent_idx ON accounts (parent_id);
CREATE INDEX accounts_type_idx ON accounts (type);

CREATE OR REPLACE FUNCTION default_normal_balance() RETURNS trigger AS $$
BEGIN
  IF NEW.normal_balance IS NULL THEN
    NEW.normal_balance := CASE
      WHEN NEW.type IN ('asset', 'expense') THEN 'debit'::normal_balance
      ELSE 'credit'::normal_balance
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_default_normal_balance BEFORE INSERT ON accounts
  FOR EACH ROW EXECUTE FUNCTION default_normal_balance();

-- --------------------------------------------------------------- periods
CREATE TYPE period_status AS ENUM ('open', 'closed');

CREATE TABLE accounting_periods (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL UNIQUE,
  starts_on date NOT NULL,
  ends_on   date NOT NULL,
  status    period_status NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  closed_by uuid REFERENCES staff (id) ON DELETE SET NULL,

  CONSTRAINT period_dates_ordered CHECK (starts_on <= ends_on),

  CONSTRAINT period_close_is_dated
    CHECK (status = 'open' OR closed_at IS NOT NULL),

  -- Two periods covering the same day would make "which period does this
  -- posting belong to" ambiguous, and a month could be closed twice with
  -- different totals.
  CONSTRAINT periods_do_not_overlap
    EXCLUDE USING gist (daterange(starts_on, ends_on, '[]') WITH &&)
);

-- -------------------------------------------------------- journal entries
CREATE TYPE journal_source AS ENUM (
  'manual', 'sales_order', 'payment', 'refund', 'stock_movement', 'expense', 'purchase'
);

CREATE TABLE journal_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE,
  entry_date   date NOT NULL,
  description  text NOT NULL,

  source       journal_source NOT NULL DEFAULT 'manual',
  -- What in the business caused this. Deliberately not a foreign key: the
  -- source can be an order, a payment or an expense, and a posting must survive
  -- its source being deleted.
  source_id    uuid,

  -- Set when this entry reverses another. A correction never edits history.
  reverses_id  uuid UNIQUE REFERENCES journal_entries (id) ON DELETE RESTRICT,

  created_by   uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT entry_does_not_reverse_itself CHECK (reverses_id IS DISTINCT FROM id)
);

CREATE INDEX journal_entries_date_idx ON journal_entries (entry_date);
CREATE INDEX journal_entries_source_idx ON journal_entries (source, source_id);

CREATE TABLE journal_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES journal_entries (id) ON DELETE RESTRICT,
  account_id  uuid NOT NULL,

  -- Always true, and half of the composite foreign key below. Its only job is
  -- to make "you cannot post to a summary account" a referential fact.
  is_postable boolean NOT NULL DEFAULT true CHECK (is_postable),

  debit       money_minor NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      money_minor NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description text,

  FOREIGN KEY (account_id, is_postable) REFERENCES accounts (id, is_postable) ON DELETE RESTRICT,

  -- Exactly one side. A line that is both is a mistake; a line that is neither
  -- is noise in the ledger.
  CONSTRAINT line_is_debit_xor_credit
    CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX journal_lines_entry_idx ON journal_lines (entry_id);
CREATE INDEX journal_lines_account_idx ON journal_lines (account_id);

-- The defining rule. It cannot be a CHECK, because a CHECK sees one row and
-- this spans them — and it must be DEFERRED, because lines are inserted one at
-- a time and the entry only balances once the last one lands. So it fires at
-- COMMIT, which also means a test that never commits never reaches it.
CREATE OR REPLACE FUNCTION assert_entry_balances() RETURNS trigger AS $$
DECLARE
  target uuid := COALESCE(NEW.entry_id, OLD.entry_id);
  total_debit  bigint;
  total_credit bigint;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE entry_id = target;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION
      'journal entry % does not balance: debits %, credits %',
      target, total_debit, total_credit
      USING ERRCODE = 'check_violation';
  END IF;

  IF total_debit = 0 THEN
    RAISE EXCEPTION 'journal entry % has no lines', target
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_lines_must_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_entry_balances();

-- A posting dated inside a closed period would change a number somebody has
-- already reported.
CREATE OR REPLACE FUNCTION assert_period_open() RETURNS trigger AS $$
DECLARE
  period record;
BEGIN
  SELECT * INTO period FROM accounting_periods
  WHERE NEW.entry_date BETWEEN starts_on AND ends_on;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no accounting period covers %', NEW.entry_date
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF period.status = 'closed' THEN
    RAISE EXCEPTION 'accounting period % is closed', period.name
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_period_open
  BEFORE INSERT OR UPDATE OF entry_date ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION assert_period_open();

-- Posted history is immutable. A correction is a reversing entry, which leaves
-- both the original and the correction on the record — that is the whole point
-- of a ledger over a spreadsheet.
CREATE OR REPLACE FUNCTION reject_ledger_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'the ledger is append-only (attempted % on %). Post a reversing entry instead.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_no_update
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_history_change();
CREATE TRIGGER journal_entries_no_delete
  BEFORE DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_history_change();
CREATE TRIGGER journal_lines_no_update
  BEFORE UPDATE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_history_change();
CREATE TRIGGER journal_lines_no_delete
  BEFORE DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_history_change();

-- ---------------------------------------------------------------- reports
CREATE VIEW trial_balance AS
SELECT
  a.id AS account_id,
  a.code,
  a.name,
  a.type,
  a.normal_balance,
  COALESCE(SUM(l.debit), 0)  AS total_debit,
  COALESCE(SUM(l.credit), 0) AS total_credit,
  CASE a.normal_balance
    WHEN 'debit'  THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
    ELSE               COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
  END AS balance
FROM accounts a
LEFT JOIN journal_lines l ON l.account_id = a.id
GROUP BY a.id, a.code, a.name, a.type, a.normal_balance;

-- If this ever returns a non-zero row the ledger is broken, which should be
-- impossible while the balance trigger holds. It exists so the claim is
-- checkable rather than assumed.
CREATE VIEW ledger_imbalance AS
SELECT
  COALESCE(SUM(debit), 0) AS total_debit,
  COALESCE(SUM(credit), 0) AS total_credit,
  COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS difference
FROM journal_lines
HAVING COALESCE(SUM(debit), 0) <> COALESCE(SUM(credit), 0);
