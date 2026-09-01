-- Documents, expenses and payables.
--
-- Finding F-07: the Document Builder rendered a PDF and forgot it. No model, no
-- record, no numbering — so you could not list what was quoted, see what
-- converted, chase an unpaid invoice, or reissue a copy. For a business running
-- interior projects on quotes and deposits that was the largest missing piece
-- of day-to-day value, and it is where accounts receivable has to live.

CREATE TABLE fin.documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type          text NOT NULL CHECK (doc_type IN ('quotation','proforma','invoice','receipt','credit_note')),
  -- Assigned from core.counters inside the inserting transaction, never from a
  -- sequence: sequences skip on rollback and invoice numbering must be gapless.
  number            text NOT NULL,
  version           integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN
                      ('draft','sent','accepted','declined','expired','invoiced','part_paid','paid','credited')),

  profile_id        uuid REFERENCES core.profiles(id),
  order_id          uuid REFERENCES sales.orders(id),
  project_id        uuid REFERENCES crm.projects(id),
  -- A credit note must say which invoice it reverses.
  reverses_id       uuid REFERENCES fin.documents(id),

  client_name       text NOT NULL,
  client_email      citext,
  client_phone      text,
  client_address    text,

  currency          text NOT NULL DEFAULT 'NGN',
  subtotal_minor    core.money_minor NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  discount_minor    core.money_minor NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor         core.money_minor NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor       core.money_minor NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  amount_paid_minor core.money_minor NOT NULL DEFAULT 0 CHECK (amount_paid_minor >= 0),

  valid_until       date,
  issued_at         timestamptz,
  issued_by         uuid REFERENCES core.staff(id),
  superseded_by     uuid REFERENCES fin.documents(id),
  -- The rendered PDF is stored, not regenerated: a changed template, logo or
  -- tax rate would produce a different document from the one the customer
  -- holds, and the copy handed to an auditor must be the copy that was sent.
  pdf_asset_id      text,
  template_version  text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (doc_type, number, version),
  CONSTRAINT paid_within_total CHECK (amount_paid_minor <= total_minor),
  CONSTRAINT credit_note_reverses CHECK (doc_type <> 'credit_note' OR reverses_id IS NOT NULL)
);

CREATE INDEX ON fin.documents (doc_type, status);
CREATE INDEX ON fin.documents (profile_id);
CREATE INDEX ON fin.documents (project_id);
-- Aged receivables.
CREATE INDEX ON fin.documents (status, valid_until) WHERE doc_type = 'invoice';

CREATE TABLE fin.document_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       uuid NOT NULL REFERENCES fin.documents(id) ON DELETE CASCADE,
  position          integer NOT NULL DEFAULT 0,
  description       text NOT NULL,
  -- Nullable: bespoke lines have no catalogue item behind them.
  sellable_item_id  uuid REFERENCES catalog.sellable_items(id),
  quantity          numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price_minor  core.money_minor NOT NULL CHECK (unit_price_minor >= 0),
  line_total_minor  core.money_minor NOT NULL CHECK (line_total_minor >= 0),
  tax_rate          numeric(5,4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0)
);

CREATE INDEX ON fin.document_lines (document_id, position);

-- Once sent, a document is what the customer holds. Amendments create a new
-- version rather than editing the one already in their inbox.
CREATE OR REPLACE FUNCTION fin.reject_issued_edit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'a document that has been issued cannot return to draft; supersede it with a new version';
  END IF;
  IF OLD.status <> 'draft' AND (
       NEW.total_minor    IS DISTINCT FROM OLD.total_minor OR
       NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor OR
       NEW.number         IS DISTINCT FROM OLD.number) THEN
    RAISE EXCEPTION 'an issued document cannot be repriced or renumbered; supersede it with a new version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER issued_is_immutable BEFORE UPDATE ON fin.documents
  FOR EACH ROW EXECUTE FUNCTION fin.reject_issued_edit();

-- ---------------------------------------------------------------- payables

CREATE TABLE fin.suppliers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  email         citext,
  phone         text,
  address       text,
  payment_terms_days integer NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fin.expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  account_id  uuid REFERENCES fin.accounts(id),
  parent_id   uuid REFERENCES fin.expense_categories(id)
);

CREATE TABLE fin.expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text NOT NULL UNIQUE,
  category_id   uuid REFERENCES fin.expense_categories(id),
  supplier_id   uuid REFERENCES fin.suppliers(id),
  project_id    uuid REFERENCES crm.projects(id),
  description   text NOT NULL,
  amount_minor  core.money_minor NOT NULL CHECK (amount_minor > 0),
  spent_on      date NOT NULL,
  receipt_asset_id text,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','paid')),
  raised_by     uuid REFERENCES core.staff(id),
  approved_by   uuid REFERENCES core.staff(id),
  approved_at   timestamptz,
  journal_entry_id uuid REFERENCES fin.journal_entries(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Segregation of duties, enforced by the database rather than trusted to a
  -- service. It holds for every role including super_admin, and it is the first
  -- control an auditor asks about.
  CONSTRAINT approver_is_not_raiser CHECK (approved_by IS NULL OR approved_by <> raised_by),
  CONSTRAINT approved_needs_approver CHECK (status <> 'approved' OR approved_by IS NOT NULL)
);

CREATE INDEX ON fin.expenses (status, spent_on DESC);
CREATE INDEX ON fin.expenses (project_id);

CREATE TABLE fin.bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference     text NOT NULL UNIQUE,
  supplier_id   uuid NOT NULL REFERENCES fin.suppliers(id),
  issued_on     date NOT NULL,
  due_on        date NOT NULL,
  total_minor   core.money_minor NOT NULL CHECK (total_minor > 0),
  paid_minor    core.money_minor NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','part_paid','paid','disputed','void')),
  approved_by   uuid REFERENCES core.staff(id),
  journal_entry_id uuid REFERENCES fin.journal_entries(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_within_total CHECK (paid_minor <= total_minor),
  CONSTRAINT due_after_issue CHECK (due_on >= issued_on)
);

CREATE INDEX ON fin.bills (status, due_on);

CREATE TRIGGER touch BEFORE UPDATE ON fin.documents
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON fin.suppliers
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON fin.expenses
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER touch BEFORE UPDATE ON fin.bills
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
