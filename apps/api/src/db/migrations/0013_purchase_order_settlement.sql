-- Paying for the goods.
--
-- Receiving a purchase order raises a liability: the stock is here and the
-- supplier is owed for it. Nothing could settle that liability, so `2100
-- Accounts payable` accumulated every receipt for ever, and the payables screen
-- — which read only expenses — showed nothing owed while the ledger said
-- otherwise. A report and the books disagreeing is the one failure this design
-- exists to prevent.
--
-- A received order is therefore payable the same way an approved expense is,
-- and gets the same two facts: when it was paid, and by what means.

ALTER TABLE purchase_orders
  ADD COLUMN paid_on        date,
  ADD COLUMN payment_method payment_method;

ALTER TABLE purchase_orders
  -- Paid means paid on a date, by some means.
  ADD CONSTRAINT purchase_order_payment_is_dated
    CHECK (paid_on IS NULL OR payment_method IS NOT NULL),

  -- Paying for goods that never arrived is either a deposit or a mistake, and
  -- neither is this. Receipt is what creates the debt, so it comes first.
  ADD CONSTRAINT purchase_order_payment_follows_receipt
    CHECK (paid_on IS NULL OR status = 'received');

-- What is still owed on goods already received.
CREATE INDEX purchase_orders_unpaid_idx ON purchase_orders (received_on)
  WHERE status = 'received' AND paid_on IS NULL;
