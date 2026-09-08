-- Paying the people who make the furniture.
--
-- `5500 Salaries and wages` could only ever be reached by recording an expense,
-- which meant a lump sum with a description and nothing behind it: no record of
-- who was paid, what was withheld, or what the business still owes the tax
-- authority and the pension administrator. Those last two matter — money
-- deducted from someone's wages is not the business's money, and until it is
-- remitted it is a debt.
--
-- Three liabilities, because a payroll creates three at once: what is owed to
-- the staff, what is owed to FIRS, and what is owed to the pension fund.

INSERT INTO accounts (code, name, type, parent_id, is_postable, description)
SELECT '2450', 'Wages payable', 'liability', a.id, true,
       'Net pay earned and not yet paid out'
  FROM accounts a WHERE a.code = '2000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO accounts (code, name, type, parent_id, is_postable, description)
SELECT '2500', 'PAYE payable', 'liability', a.id, true,
       'Tax withheld from wages and not yet remitted. Never the business''s money.'
  FROM accounts a WHERE a.code = '2000'
ON CONFLICT (code) DO NOTHING;

INSERT INTO accounts (code, name, type, parent_id, is_postable, description)
SELECT '2600', 'Pension payable', 'liability', a.id, true,
       'Employee and employer contributions owed to the pension administrator'
  FROM accounts a WHERE a.code = '2000'
ON CONFLICT (code) DO NOTHING;

CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract');

CREATE TABLE employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  email           citext,
  phone           text,
  job_title       text,
  employment_type employment_type NOT NULL DEFAULT 'full_time',

  monthly_salary  money_minor NOT NULL CHECK (monthly_salary >= 0),

  -- Rates rather than amounts, because they are policy and the amounts follow
  -- from the salary. Stored per employee because they legitimately differ:
  -- a contractor may have no pension and a different tax treatment.
  paye_rate       numeric(5,2) NOT NULL DEFAULT 0 CHECK (paye_rate >= 0 AND paye_rate <= 100),
  pension_rate    numeric(5,2) NOT NULL DEFAULT 0 CHECK (pension_rate >= 0 AND pension_rate <= 100),
  employer_pension_rate numeric(5,2) NOT NULL DEFAULT 0
    CHECK (employer_pension_rate >= 0 AND employer_pension_rate <= 100),

  bank_name       text,
  bank_account    text,

  -- The console account this person signs in with, when they have one. Most
  -- employees do not: a cabinetmaker is on the payroll and not in the software.
  staff_id        uuid REFERENCES staff (id) ON DELETE SET NULL,

  started_on      date NOT NULL,
  ended_on        date,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT employee_end_follows_start CHECK (ended_on IS NULL OR ended_on >= started_on)
);

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX employees_current_idx ON employees (started_on) WHERE ended_on IS NULL;

CREATE TYPE pay_run_status AS ENUM ('draft', 'approved', 'paid');

CREATE TABLE pay_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The first day of the month being paid, so the month is a value rather than
  -- something inferred from a range.
  period      date NOT NULL UNIQUE,
  status      pay_run_status NOT NULL DEFAULT 'draft',

  approved_by uuid REFERENCES staff (id) ON DELETE SET NULL,
  approved_at timestamptz,

  paid_on     date,
  payment_method payment_method,

  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Approval is what turns a draft into wages owed, so it has to be
  -- attributable — the same rule an expense is held to.
  CONSTRAINT pay_run_approval_is_attributed
    CHECK (status = 'draft' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),

  CONSTRAINT pay_run_payment_is_dated
    CHECK (status <> 'paid' OR (paid_on IS NOT NULL AND payment_method IS NOT NULL))
);

CREATE TRIGGER pay_runs_updated_at BEFORE UPDATE ON pay_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE payslips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id  uuid NOT NULL REFERENCES pay_runs (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,

  -- Copied from the employee at the moment the run is built, not read through a
  -- join. A payslip has to keep saying what it said: a rise next month must not
  -- rewrite what somebody was paid last month.
  gross       money_minor NOT NULL CHECK (gross >= 0),
  paye        money_minor NOT NULL DEFAULT 0 CHECK (paye >= 0),
  pension     money_minor NOT NULL DEFAULT 0 CHECK (pension >= 0),
  employer_pension money_minor NOT NULL DEFAULT 0 CHECK (employer_pension >= 0),
  other_deductions money_minor NOT NULL DEFAULT 0 CHECK (other_deductions >= 0),
  net         money_minor NOT NULL CHECK (net >= 0),

  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One payslip per person per run.
  UNIQUE (pay_run_id, employee_id),

  -- The arithmetic has to hold, on every row, for ever.
  CONSTRAINT payslip_net_is_gross_less_deductions
    CHECK (net = gross - paye - pension - other_deductions)
);

CREATE INDEX payslips_employee_idx ON payslips (employee_id);

-- The run and its settlement are two events, and (source, source_id) is unique.
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'payroll';
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'payroll_payment';
