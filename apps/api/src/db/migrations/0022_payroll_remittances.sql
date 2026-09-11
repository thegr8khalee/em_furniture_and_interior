-- 0022_payroll_remittances.sql
--
-- Remitting the tax and pension deducted from a payroll run.
--
-- Approving a pay run created liabilities:
--   2500 PAYE Tax Payable
--   2600 Pension Payable
--
-- Paying the net wages (2450) settled what the employees were owed. The tax and
-- the pension remain debts to FIRS and the pension fund administrator (PFA) until
-- they are remitted. These two journal sources and pay_runs tracking columns
-- record the settlement of those debts against the bank account.

ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'paye_remittance';
ALTER TYPE journal_source ADD VALUE IF NOT EXISTS 'pension_remittance';

ALTER TABLE pay_runs
  ADD COLUMN IF NOT EXISTS tax_remitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_remitted_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pension_remitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pension_remitted_by uuid REFERENCES staff(id) ON DELETE SET NULL;
