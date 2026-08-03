-- Read-only Production verification for 20260806_atomic_stock_operations.sql.

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('adjust_stock_atomic','receive_purchase_order_atomic'))<>2
  THEN RAISE EXCEPTION 'Atomic stock RPC is missing'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('adjust_stock_atomic','receive_purchase_order_atomic')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT ('search_path=public'=ANY(p.proconfig)))
  ) THEN RAISE EXCEPTION 'Atomic stock RPC security configuration is invalid'; END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('purchase_order_items','quantity'),
      ('purchase_order_items','received_qty')
    ) expected(table_name,column_name)
    LEFT JOIN information_schema.columns c
      ON c.table_schema='public'
     AND c.table_name=expected.table_name
     AND c.column_name=expected.column_name
    WHERE c.data_type<>'numeric'
       OR c.numeric_precision<>12
       OR c.numeric_scale<>3
       OR c.column_name IS NULL
  ) THEN RAISE EXCEPTION 'Fractional purchase-order quantity contract is invalid'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('adjust_stock_atomic','receive_purchase_order_atomic')
      AND (pg_get_functiondef(p.oid) NOT ILIKE '%FOR UPDATE%'
        OR pg_get_functiondef(p.oid) NOT ILIKE '%IS DISTINCT FROM%'
        OR pg_get_functiondef(p.oid) NOT ILIKE '%INSERT INTO stock_ledger%')
  ) THEN RAISE EXCEPTION 'Atomic stock RPC lacks locking, optimistic checks, or ledger writes'; END IF;
END $$;

SELECT 'atomic stock adjustment and purchase-order receiving verified' AS result;
