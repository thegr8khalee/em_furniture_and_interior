-- Gapless document numbering.
--
-- A PostgreSQL sequence is the obvious choice and the wrong one: sequences skip
-- values on rollback, and gapless invoice numbering is a common statutory
-- requirement. An auditor asking why INV-2026-0041 does not exist is not a
-- conversation worth having.
--
-- Instead a counter row is locked FOR UPDATE inside the caller's transaction.
-- That serialises issuance, so two concurrent requests cannot take the same
-- number, and a rolled-back document returns its number to the pool.

CREATE OR REPLACE FUNCTION fin.next_document_number(p_doc_type text, p_year integer DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  target_year integer := COALESCE(p_year, extract(year FROM now())::integer);
  prefix      text;
  value       integer;
BEGIN
  prefix := CASE p_doc_type
    WHEN 'quotation'   THEN 'QUO'
    WHEN 'proforma'    THEN 'PRO'
    WHEN 'invoice'     THEN 'INV'
    WHEN 'receipt'     THEN 'REC'
    WHEN 'credit_note' THEN 'CN'
    ELSE NULL
  END;

  IF prefix IS NULL THEN
    RAISE EXCEPTION 'unknown document type: %', p_doc_type;
  END IF;

  INSERT INTO core.counters (scope, year, next_value)
  VALUES (p_doc_type, target_year, 1)
  ON CONFLICT (scope, year) DO NOTHING;

  -- FOR UPDATE is the whole mechanism: it blocks a concurrent caller until this
  -- transaction commits or rolls back.
  SELECT next_value INTO value
    FROM core.counters
   WHERE scope = p_doc_type AND year = target_year
     FOR UPDATE;

  UPDATE core.counters
     SET next_value = next_value + 1
   WHERE scope = p_doc_type AND year = target_year;

  RETURN format('%s-%s-%s', prefix, target_year, lpad(value::text, 4, '0'));
END;
$$;

COMMENT ON FUNCTION fin.next_document_number IS
  'Call inside the transaction that inserts the document, so a rollback returns the number.';
