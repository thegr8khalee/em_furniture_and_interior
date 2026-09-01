-- Fix: the retention function matched indexes as well as partitions.
--
-- `relname LIKE 'activity_logs_%'` against pg_class also matches the indexes on
-- each partition (activity_logs_2026_09_pkey and friends). The function would
-- then attempt DROP TABLE on an index — and before that, to_date() on the
-- trailing seven characters of an index name, which is not a date.
--
-- Two corrections: filter to ordinary tables with relkind = 'r', and select
-- partitions by their attachment to the parent rather than by name, so the
-- month is read from the partition bound instead of parsed out of a string.

CREATE OR REPLACE FUNCTION core.drop_activity_partitions_older_than(days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  cutoff  timestamptz := date_trunc('month', now() - make_interval(days => days));
  rec     record;
  dropped integer := 0;
BEGIN
  FOR rec IN
    SELECT c.relname,
           -- The upper bound of the partition's range, parsed from its
           -- definition. Authoritative, unlike the name.
           (regexp_match(
              pg_get_expr(c.relpartbound, c.oid),
              'TO \(''([^'']+)''\)'
            ))[1]::timestamptz AS upper_bound
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_inherits i ON i.inhrelid = c.oid
     WHERE n.nspname = 'core'
       AND c.relkind = 'r'                                   -- ordinary tables only
       AND i.inhparent = 'core.activity_logs'::regclass      -- partitions of this table only
  LOOP
    -- A partition is droppable only when everything it could hold is older than
    -- the cutoff, i.e. its upper bound has passed.
    IF rec.upper_bound <= cutoff THEN
      EXECUTE format('DROP TABLE core.%I', rec.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  RETURN dropped;
END;
$$;

COMMENT ON FUNCTION core.drop_activity_partitions_older_than IS
  'Retention by partition drop, not DELETE. Selects partitions via pg_inherits and relkind, never by name matching, which also catches their indexes.';
