-- Two things the books were quietly wrong about.
--
-- **The gateway's cut.** Paystack keeps a percentage of every card payment and
-- settles the rest. The ledger recorded the whole amount as arriving in the
-- bank, so `1110` has been overstated by every fee ever charged, and `5300
-- Payment processing fees` — an account that has existed since the chart was
-- written — had never received a posting. The money is real and it is gone; not
-- recording it does not make the bank balance right, it makes it wrong.
--
-- **Money taken before it is earned.** For bespoke furniture the deposit comes
-- first: someone pays before anything is built. Every payment posted as though
-- it settled a receivable, which meant a deposit on an unconfirmed order cleared
-- a debt that did not exist yet and left `1200` negative. A deposit is not
-- revenue and it is not a receivable — it is money owed back until the goods are
-- delivered, which is what `2300 Customer deposits` is for.

ALTER TABLE payment_transactions
  -- What the gateway kept. Zero for cash and transfers, which cost nothing.
  ADD COLUMN gateway_fee money_minor NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),

  -- Whether this money was taken before the sale was recognised. Decided when
  -- the payment is posted and never afterwards: it is a fact about the moment
  -- the money arrived, not about the order's state now.
  ADD COLUMN held_as_deposit boolean NOT NULL DEFAULT false,

  -- Applying a deposit to the sale is its own posting, and it happens once.
  ADD COLUMN deposit_applied_at timestamptz;

ALTER TABLE payment_transactions
  -- A fee cannot exceed what arrived.
  ADD CONSTRAINT payment_fee_within_amount CHECK (gateway_fee <= amount),

  -- Only a deposit can be applied, and only money that actually arrived.
  ADD CONSTRAINT payment_applied_deposit_was_held
    CHECK (deposit_applied_at IS NULL OR held_as_deposit);

CREATE INDEX payment_transactions_unapplied_deposit_idx
  ON payment_transactions (order_id)
  WHERE held_as_deposit AND deposit_applied_at IS NULL;

-- Applying a deposit to the sale it was taken for moves a liability to a
-- receivable. It is neither a payment nor a sale, so it gets its own source
-- rather than sharing one and colliding on (source, source_id).
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'deposit_applied';
