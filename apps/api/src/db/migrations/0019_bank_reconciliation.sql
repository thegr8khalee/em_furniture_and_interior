-- Does the bank agree?
--
-- The ledger says `1120` holds ₦17.3m. Nothing said whether the bank agreed,
-- and the two drift for ordinary reasons: a transfer recorded twice, a charge
-- the bank took and nobody entered, a cheque written and not yet presented, a
-- customer payment that arrived without anyone noticing. A cash figure nobody
-- has checked against the bank is a guess with a decimal point.
--
-- Reconciliation is the check. Lines from the bank on one side, postings from
-- the ledger on the other, matched off against each other until what is left
-- explains the difference.

CREATE TYPE bank_line_direction AS ENUM ('in', 'out');

CREATE TABLE bank_statement_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which of the cash accounts this statement belongs to. A business with two
  -- bank accounts reconciles them separately, and mixing them would make every
  -- balance meaningless.
  account_id  uuid NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,

  entry_date  date NOT NULL,
  description text NOT NULL,

  -- Unsigned, with the direction beside it. A statement is read as money in and
  -- money out, and storing a negative "in" invites the sign to be lost.
  amount      money_minor NOT NULL CHECK (amount > 0),
  direction   bank_line_direction NOT NULL,

  reference   text,

  -- What this line was matched to, if anything. Null is the interesting state:
  -- it is either something the books have not recorded yet, or something the
  -- bank has not processed.
  matched_entry_id uuid REFERENCES journal_entries (id) ON DELETE SET NULL,
  matched_at  timestamptz,
  matched_by  uuid REFERENCES staff (id) ON DELETE SET NULL,

  -- The statement's own identifier for the transaction, when it has one. Unique
  -- so importing the same statement twice cannot duplicate a line — the most
  -- common way a reconciliation goes wrong is doing it on doubled data.
  bank_reference text,

  imported_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bank_line_match_is_dated
    CHECK ((matched_entry_id IS NULL) = (matched_at IS NULL)),

  UNIQUE (account_id, bank_reference)
);

CREATE INDEX bank_statement_lines_unmatched_idx
  ON bank_statement_lines (account_id, entry_date)
  WHERE matched_entry_id IS NULL;

CREATE INDEX bank_statement_lines_matched_idx ON bank_statement_lines (matched_entry_id);

-- One journal entry answers for one bank line. Matching the same posting to two
-- lines would reconcile a balance that never existed.
CREATE UNIQUE INDEX bank_statement_lines_one_entry_each
  ON bank_statement_lines (matched_entry_id)
  WHERE matched_entry_id IS NOT NULL;

-- A completed reconciliation: at this date, against this account, the books and
-- the bank agreed. Kept so the next one can start where the last finished
-- rather than re-checking everything from the beginning of time.
CREATE TABLE bank_reconciliations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,

  statement_date date NOT NULL,

  -- What the bank said, and what the books said, at that date.
  statement_balance money_minor NOT NULL,
  ledger_balance    money_minor NOT NULL,

  -- What was outstanding on each side, which is what explains the difference.
  unpresented    money_minor NOT NULL DEFAULT 0,
  unrecorded     money_minor NOT NULL DEFAULT 0,

  notes          text,
  completed_by   uuid REFERENCES staff (id) ON DELETE SET NULL,
  completed_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (account_id, statement_date)
);

CREATE INDEX bank_reconciliations_account_idx
  ON bank_reconciliations (account_id, statement_date DESC);
