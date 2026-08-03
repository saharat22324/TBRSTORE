-- Read-only Production verification for 20260808_archive_stock_items.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_items' AND column_name='active'
      AND data_type='boolean' AND is_nullable='NO'
  ) THEN RAISE EXCEPTION 'Stock archive column is missing or nullable'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stock_items' AND cmd='DELETE'
  ) THEN RAISE EXCEPTION 'Direct stock delete policy is still active'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='archive_stock_item_atomic'
      AND p.prosecdef AND p.proconfig IS NOT NULL AND 'search_path=public'=ANY(p.proconfig)
  ) THEN RAISE EXCEPTION 'Stock archive RPC security configuration is invalid'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='archive_stock_item_atomic'
      AND (pg_get_functiondef(p.oid) NOT ILIKE '%FOR UPDATE%'
        OR pg_get_functiondef(p.oid) NOT ILIKE '%quantity<>0%'
        OR pg_get_functiondef(p.oid) NOT ILIKE '%PURCHASE_ORDER%')
  ) THEN RAISE EXCEPTION 'Stock archive RPC lacks locking, zero-stock, or pending-PO guard'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_stock_items_secure'
      AND pg_get_functiondef(p.oid) ILIKE '%WHERE s.active%'
      AND pg_get_function_result(p.oid) ILIKE '%quantity numeric%'
  ) THEN RAISE EXCEPTION 'Secure stock getter does not hide archives or preserve fractions'; END IF;
END $$;

SELECT 'stock archive and secure fractional reads verified' AS result;
