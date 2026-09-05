-- An accounting calendar, so the books can actually be posted to.
--
-- `assert_period_open` refuses a journal entry whose date falls in no period.
-- Nothing created any, so a fresh installation could not record its first sale:
-- confirming an order raised "no accounting period covers 2026-09-05" and the
-- order failed with it. That was invisible until the posting rules were wired to
-- their callers, because until then nothing posted.
--
-- Monthly, because a month is the unit a business closes its books in. They are
-- created open; closing one is an operator's decision and stops further postings
-- to it, which is the control the period table exists for.
--
-- The range is deliberately finite. A calendar that ran forever would mean a
-- posting dated 2099 — a typo in an import, say — silently landing in a period
-- nobody has ever looked at. Running out is a loud, early failure with an
-- obvious fix: add the next years.
INSERT INTO accounting_periods (name, starts_on, ends_on)
SELECT
  to_char(month, 'YYYY-MM'),
  month::date,
  (month + interval '1 month - 1 day')::date
FROM generate_series(
  date_trunc('month', DATE '2024-01-01'),
  date_trunc('month', DATE '2035-12-01'),
  interval '1 month'
) AS month
ON CONFLICT (name) DO NOTHING;
