-- Read-only Production verification for 20260807_atomic_stock_item_save.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stock_items' AND cmd IN ('INSERT','UPDATE')
  ) THEN RAISE EXCEPTION 'Direct stock item insert/update policy is still active'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='save_stock_item_atomic'
      AND p.prosecdef AND p.proconfig IS NOT NULL AND 'search_path=public'=ANY(p.proconfig)
  ) THEN RAISE EXCEPTION 'Atomic stock item save RPC security configuration is invalid'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='save_stock_item_atomic'
      AND (pg_get_functiondef(p.oid) NOT ILIKE '%FOR UPDATE%'
        OR pg_get_functiondef(p.oid) NOT ILIKE '%IS DISTINCT FROM%'
        OR pg_get_functiondef(p.oid) NOT ILIKE '%INSERT INTO stock_ledger%')
  ) THEN RAISE EXCEPTION 'Atomic stock item save lacks locking, optimistic checks, or initial ledger writes'; END IF;
END $$;

SELECT 'atomic stock item save and direct-write hardening verified' AS result;
