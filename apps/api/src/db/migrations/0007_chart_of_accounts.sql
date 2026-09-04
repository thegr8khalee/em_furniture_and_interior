-- A starting chart of accounts.
--
-- Reference data, not user data, so it belongs in a migration: the posting
-- rules in src/services/ledger.js name these codes, and a deployment without
-- them cannot post anything. An accountant will want to extend this — adding
-- accounts is ordinary use — but these are the ones the automatic postings
-- need, so they should not be renumbered casually.

INSERT INTO accounts (code, name, type, is_postable, description) VALUES
  -- Assets
  ('1000', 'Assets',                'asset',     false, 'Summary account'),
  ('1100', 'Cash and bank',         'asset',     false, 'Summary account'),
  ('1110', 'Bank — Paystack',       'asset',     true,  'Settlement account for card and transfer payments'),
  ('1120', 'Bank — current account','asset',     true,  NULL),
  ('1130', 'Cash on hand',          'asset',     true,  NULL),
  ('1200', 'Accounts receivable',   'asset',     true,  'Owed by customers on unpaid orders'),
  ('1300', 'Inventory',             'asset',     true,  'Stock at cost'),
  ('1400', 'Prepayments',           'asset',     true,  NULL),

  -- Liabilities
  ('2000', 'Liabilities',           'liability', false, 'Summary account'),
  ('2100', 'Accounts payable',      'liability', true,  'Owed to suppliers'),
  ('2200', 'VAT payable',           'liability', true,  'Output VAT collected, owed to the FIRS'),
  ('2300', 'Customer deposits',     'liability', true,  'Paid for goods not yet delivered'),
  ('2400', 'Accrued expenses',      'liability', true,  NULL),

  -- Equity
  ('3000', 'Equity',                'equity',    false, 'Summary account'),
  ('3100', 'Owner capital',         'equity',    true,  NULL),
  ('3200', 'Retained earnings',     'equity',    true,  NULL),

  -- Revenue
  ('4000', 'Revenue',               'revenue',   false, 'Summary account'),
  ('4100', 'Furniture sales',       'revenue',   true,  NULL),
  ('4200', 'Interior design fees',  'revenue',   true,  NULL),
  ('4300', 'Delivery income',       'revenue',   true,  NULL),
  ('4900', 'Discounts given',       'revenue',   true,  'Contra-revenue: reduces sales'),

  -- Expenses
  ('5000', 'Expenses',              'expense',   false, 'Summary account'),
  ('5100', 'Cost of goods sold',    'expense',   true,  NULL),
  ('5200', 'Delivery costs',        'expense',   true,  NULL),
  ('5300', 'Payment processing fees','expense',  true,  'Paystack and bank charges'),
  ('5400', 'Stock write-offs',      'expense',   true,  'Damage, shrinkage, obsolescence'),
  ('5500', 'Salaries and wages',    'expense',   true,  NULL),
  ('5600', 'Rent and utilities',    'expense',   true,  NULL),
  ('5700', 'Marketing',             'expense',   true,  NULL),
  ('5900', 'Other operating costs', 'expense',   true,  NULL);

-- Hierarchy, set after insert so parents exist regardless of row order.
UPDATE accounts c SET parent_id = p.id FROM accounts p
WHERE p.code = CASE
  WHEN c.code LIKE '11%' AND c.code <> '1100' THEN '1100'
  WHEN c.code IN ('1100','1200','1300','1400') THEN '1000'
  WHEN c.code LIKE '2%' AND c.code <> '2000' THEN '2000'
  WHEN c.code LIKE '3%' AND c.code <> '3000' THEN '3000'
  WHEN c.code LIKE '4%' AND c.code <> '4000' THEN '4000'
  WHEN c.code LIKE '5%' AND c.code <> '5000' THEN '5000'
END
AND c.id <> p.id;
