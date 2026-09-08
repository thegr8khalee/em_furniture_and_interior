-- What the business owns and wears out.
--
-- A furniture maker has a workshop full of tools, a delivery van and a set of
-- machines, and none of it existed in the books. Buying a ₦4,000,000 van was
-- recorded — if it was recorded at all — as an expense in the month it was
-- bought, which is wrong twice: that month's profit is destroyed, and every
-- month afterwards is flattered, because the van goes on earning while nothing
-- charges for its use. The balance sheet, meanwhile, said the business owned
-- nothing.
--
-- Three accounts and a register fix it. The asset is capitalised when bought and
-- charged to profit a month at a time across its life, which is what
-- depreciation is for.

INSERT INTO accounts (code, name, type, parent_id, is_postable, description)
SELECT '1500', 'Equipment and vehicles', 'asset', a.id, true,
       'What the business owns and uses: tools, machines, the van'
  FROM accounts a WHERE a.code = '1000'
ON CONFLICT (code) DO NOTHING;

-- A contra-asset. Its balance runs the other way from the accounts around it —
-- every charge credits it — so it shows as a negative asset and reduces what the
-- balance sheet says the business owns. That is what a contra account is: the
-- schema's own check refuses `normal_balance = 'credit'` on an asset, and it is
-- right to, because inverting the account would invert every report built on it.
INSERT INTO accounts (code, name, type, parent_id, is_postable, description)
SELECT '1590', 'Accumulated depreciation', 'asset', a.id, true,
       'What has been charged against those assets so far. Runs negative, by design.'
  FROM accounts a WHERE a.code = '1000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO accounts (code, name, type, parent_id, is_postable, description)
SELECT '5800', 'Depreciation', 'expense', a.id, true,
       'This month''s share of the cost of the things the business owns'
  FROM accounts a WHERE a.code = '5000'
ON CONFLICT (code) DO NOTHING;

CREATE TABLE fixed_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,

  acquired_on    date NOT NULL,
  cost           money_minor NOT NULL CHECK (cost > 0),

  -- What it is expected to be worth at the end. Only the difference between
  -- cost and this is charged to profit — a van sold for scrap at the end was
  -- never worth zero to the business.
  residual_value money_minor NOT NULL DEFAULT 0 CHECK (residual_value >= 0),

  -- Straight line: the same charge every month across this many. Not years,
  -- because the charge is monthly and a life expressed in years has to be
  -- divided by twelve somewhere — doing it here means it is done once.
  useful_life_months integer NOT NULL CHECK (useful_life_months > 0),

  disposed_on    date,
  disposal_notes text,

  recorded_by    uuid REFERENCES staff (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Nothing is worth less than nothing at the end of its life.
  CONSTRAINT fixed_asset_residual_within_cost CHECK (residual_value < cost),

  -- It cannot be disposed of before it was bought.
  CONSTRAINT fixed_asset_disposal_follows_acquisition
    CHECK (disposed_on IS NULL OR disposed_on >= acquired_on)
);

CREATE TRIGGER fixed_assets_updated_at BEFORE UPDATE ON fixed_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX fixed_assets_in_use_idx ON fixed_assets (acquired_on)
  WHERE disposed_on IS NULL;

-- One charge per asset per month, with its own identity — which is what lets a
-- posting be tied to it. Keying the posting on the asset alone would allow one
-- charge per asset for ever, and keying it on the month alone would collide
-- across assets.
CREATE TABLE depreciation_charges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   uuid NOT NULL REFERENCES fixed_assets (id) ON DELETE RESTRICT,

  -- The first day of the month being charged, so the month is a value rather
  -- than something inferred from a range.
  period     date NOT NULL,
  amount     money_minor NOT NULL CHECK (amount > 0),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Running the month twice charges nothing twice.
  UNIQUE (asset_id, period)
);

CREATE INDEX depreciation_charges_period_idx ON depreciation_charges (period);

ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'depreciation';
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'asset_purchase';
