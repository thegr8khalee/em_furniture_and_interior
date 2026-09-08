-- Giving money back.
--
-- `order_status` and `payment_status` have both had a `refunded` value since
-- 0004, `journal_source` has had `refund` since 0006, and
-- `payment_transactions` has carried `refunded_amount` and `refunded_at` all
-- along. The console offers Refunded on two dropdowns. Nothing ever posted one.
--
-- So a refund moved a status and nothing else: revenue stayed recognised, the
-- cash stayed in the bank account, VAT stayed owed on a sale that had been
-- reversed, and returned goods never came back into stock. This is the third
-- hole of that shape — a state an operator can reach that the books never hear
-- about — and the last one left.
--
-- A refund is an event with its own identity rather than a flag on the order:
-- it has an amount, a reason, someone who authorised it, and a date. Several can
-- happen against one order, and the ledger needs to point at each of them
-- separately, because `(source, source_id)` is unique per posting.

CREATE TABLE order_refunds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,

  -- Which receipt is being given back. A refund is against money that actually
  -- arrived, so it names the transaction it reverses.
  transaction_id uuid REFERENCES payment_transactions (id) ON DELETE SET NULL,

  amount        money_minor NOT NULL CHECK (amount > 0),

  -- Why. A refund with no reason is indistinguishable from a mistake, and this
  -- is the field the customer will be quoted back weeks later.
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),

  -- Whether the goods came back. Only meaningful on a full refund: picking
  -- which lines returned out of a partial one is a guess, and a guess about
  -- stock is how a count stops being explainable.
  restocked     boolean NOT NULL DEFAULT false,

  refunded_on   date NOT NULL DEFAULT CURRENT_DATE,
  refunded_by   uuid REFERENCES staff (id) ON DELETE SET NULL,

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_refunds_order_idx ON order_refunds (order_id, refunded_on DESC);

-- Append-only, like the ledger and the stock log it drives. A refund that can be
-- edited after the fact is a receipt that cannot be trusted, and the money has
-- already left.
CREATE OR REPLACE FUNCTION reject_refund_history_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'order_refunds is append-only; record a correcting entry instead'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_refunds_are_append_only
  BEFORE UPDATE OR DELETE ON order_refunds
  FOR EACH ROW EXECUTE FUNCTION reject_refund_history_change();
