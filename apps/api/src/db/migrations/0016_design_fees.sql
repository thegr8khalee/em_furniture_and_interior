-- Billing the design work.
--
-- `4200 Interior design fees` has been in the chart since it was written and
-- nothing could ever post to it: consultations were tracked from enquiry to
-- completion and then stopped, so the design half of the business earned
-- nothing in the books. Every figure the owner reads — revenue, profit, what
-- the business is worth — described the furniture only.
--
-- A consultation is billed the way an expense is approved: once, deliberately,
-- and that is the moment it becomes money owed. Paying it settles the debt.

ALTER TABLE consultation_requests
  ADD COLUMN fee_amount     money_minor NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  ADD COLUMN fee_tax        money_minor NOT NULL DEFAULT 0 CHECK (fee_tax >= 0),
  ADD COLUMN fee_total      money_minor NOT NULL DEFAULT 0 CHECK (fee_total >= 0),

  -- When the fee became owed. Null means the work has not been billed, which is
  -- the state most consultations stay in — an enquiry that went nowhere is not
  -- a debt.
  ADD COLUMN billed_at      timestamptz,
  ADD COLUMN billed_by      uuid REFERENCES staff (id) ON DELETE SET NULL,

  ADD COLUMN fee_paid_on    date,
  ADD COLUMN fee_method     payment_method;

ALTER TABLE consultation_requests
  ADD CONSTRAINT consultation_fee_total_is_amount_plus_tax
    CHECK (fee_total = fee_amount + fee_tax),

  -- A bill is for something. Billing zero is not billing.
  ADD CONSTRAINT consultation_billed_has_a_fee
    CHECK (billed_at IS NULL OR fee_total > 0),

  -- Paid means paid on a day, by some means, for something that was billed.
  ADD CONSTRAINT consultation_fee_payment_is_dated
    CHECK (fee_paid_on IS NULL OR (fee_method IS NOT NULL AND billed_at IS NOT NULL));

CREATE INDEX consultation_requests_unpaid_fee_idx
  ON consultation_requests (billed_at)
  WHERE billed_at IS NOT NULL AND fee_paid_on IS NULL;

-- Two events, two sources: (source, source_id) is unique, so the fee and its
-- settlement would collide on one value.
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'design_fee';
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'design_fee_payment';
