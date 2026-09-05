-- The other side of the business: what it buys and what it owes.
--
-- Twelve of the thirty accounts in the chart could never receive a posting,
-- because nothing recorded a purchase. Accounts payable stayed empty, input VAT
-- was structurally zero, and every operating cost — rent, salaries, marketing —
-- had no way in. The profit and loss showed revenue and cost of sales and
-- stopped there, which is a gross margin, not a profit.
--
-- Two documents cover it. An expense is money spent, recorded once and paid
-- once. A purchase order is an intention to buy, which becomes stock and a
-- liability when the goods arrive.

-- Paying a supplier is its own kind of event. Without a value of its own it
-- would have to share `payment` with a customer receipt, and `(source,
-- source_id)` is unique — the accrual and the settlement of one expense would
-- collide, and anyone reading `source = 'payment'` would get two different
-- things pointing into two different tables.
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'expense_payment';

CREATE TABLE vendors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      citext,
  phone      text,
  address    text,
  notes      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Two suppliers with the same name is a data-entry slip, and it makes every
  -- payables report ambiguous.
  UNIQUE (name)
);

CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------------ expenses

CREATE TYPE expense_status AS ENUM ('draft', 'approved', 'paid', 'void');

CREATE TABLE expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL UNIQUE,
  vendor_id      uuid REFERENCES vendors (id) ON DELETE RESTRICT,

  -- Which cost this is. A foreign key to the chart rather than a category
  -- string, so an expense cannot be filed under something that is not an
  -- account, and the composite reference makes it a *postable* one — a cost
  -- booked to a summary account would never appear in any report under it.
  account_id     uuid NOT NULL,
  account_postable boolean NOT NULL DEFAULT true,

  description    text NOT NULL,
  expense_date   date NOT NULL,

  net_amount     money_minor NOT NULL CHECK (net_amount >= 0),
  tax_amount     money_minor NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount   money_minor NOT NULL CHECK (total_amount >= 0),

  status         expense_status NOT NULL DEFAULT 'draft',
  payment_method payment_method,
  paid_on        date,

  receipt_url    text,
  receipt_public_id text,
  notes          text,

  recorded_by    uuid REFERENCES staff (id) ON DELETE SET NULL,
  approved_by    uuid REFERENCES staff (id) ON DELETE SET NULL,
  approved_at    timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT expense_total_is_net_plus_tax
    CHECK (total_amount = net_amount + tax_amount),

  -- An approved expense says who approved it and when. Approval is what turns a
  -- note into a liability, so it has to be attributable.
  CONSTRAINT expense_approval_is_attributed
    CHECK (status IN ('draft', 'void') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),

  -- Paid means paid on a date, by some means.
  CONSTRAINT expense_payment_is_dated
    CHECK (status <> 'paid' OR (paid_on IS NOT NULL AND payment_method IS NOT NULL)),

  FOREIGN KEY (account_id, account_postable) REFERENCES accounts (id, is_postable)
);

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX expenses_date_idx ON expenses (expense_date DESC);
CREATE INDEX expenses_vendor_idx ON expenses (vendor_id, expense_date DESC);
CREATE INDEX expenses_unpaid_idx ON expenses (expense_date) WHERE status = 'approved';

-- ----------------------------------------------------------- purchase orders

CREATE TYPE purchase_order_status AS ENUM ('draft', 'sent', 'received', 'cancelled');

CREATE TABLE purchase_orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number    text NOT NULL UNIQUE,
  vendor_id    uuid NOT NULL REFERENCES vendors (id) ON DELETE RESTRICT,

  status       purchase_order_status NOT NULL DEFAULT 'draft',
  expected_on  date,
  received_on  date,
  notes        text,

  created_by   uuid REFERENCES staff (id) ON DELETE SET NULL,
  received_by  uuid REFERENCES staff (id) ON DELETE SET NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Received means received on a day. Without it the stock movements have no
  -- date to post under.
  CONSTRAINT purchase_order_receipt_is_dated
    CHECK (status <> 'received' OR received_on IS NOT NULL)
);

CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX purchase_orders_vendor_idx ON purchase_orders (vendor_id, created_at DESC);
CREATE INDEX purchase_orders_open_idx ON purchase_orders (expected_on)
  WHERE status IN ('draft', 'sent');

CREATE TABLE purchase_order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,

  -- What is being bought. Restricted rather than nulled on delete: a product
  -- that has been ordered from a supplier cannot simply vanish from the record
  -- of what was ordered.
  product_id        uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,

  quantity          integer NOT NULL CHECK (quantity > 0),
  unit_cost         money_minor NOT NULL CHECK (unit_cost >= 0),
  line_total        money_minor NOT NULL CHECK (line_total >= 0),

  CONSTRAINT purchase_line_total_is_cost_times_quantity
    CHECK (line_total = unit_cost * quantity),

  -- One line per product on an order; two lines for the same thing is a
  -- quantity somebody typed twice.
  UNIQUE (purchase_order_id, product_id)
);

CREATE INDEX purchase_order_items_order_idx ON purchase_order_items (purchase_order_id);

-- A stock movement can now say which order brought it in, so a receipt is
-- traceable from the balance back to the paperwork.
ALTER TABLE stock_movements
  ADD COLUMN purchase_order_id uuid REFERENCES purchase_orders (id) ON DELETE SET NULL;

CREATE INDEX stock_movements_purchase_idx ON stock_movements (purchase_order_id);
