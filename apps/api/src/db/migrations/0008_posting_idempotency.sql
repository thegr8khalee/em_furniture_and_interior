-- One posting per business event.
--
-- Without this, a retried webhook or a re-run job posts the same sale twice and
-- the books silently overstate revenue. The service checks before posting, but
-- a check-then-insert is not atomic under concurrency — two webhook deliveries
-- arriving together would both find nothing and both post.
--
-- Manual entries are exempt: a bookkeeper may legitimately post several
-- unrelated entries with no source at all.
CREATE UNIQUE INDEX journal_entries_one_per_source
  ON journal_entries (source, source_id)
  WHERE source <> 'manual' AND source_id IS NOT NULL;
