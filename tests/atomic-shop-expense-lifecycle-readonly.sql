-- Read-only Production smoke test for shop configuration and expense lifecycle.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('shop_config','expenses')
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN RAISE EXCEPTION 'Direct shop configuration or expense write policy remains'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='voided_at'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='void_reason'
  ) THEN RAISE EXCEPTION 'Expense void metadata is missing'; END IF;
  IF NOT has_function_privilege('authenticated','public.save_shop_config_atomic(jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.create_expense_atomic(text,numeric,date,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.void_expense_atomic(uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'Authenticated role cannot execute shop or expense RPCs'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('save_shop_config_atomic','create_expense_atomic','void_expense_atomic')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN RAISE EXCEPTION 'Shop or expense RPC security configuration is invalid'; END IF;

  SELECT pg_get_functiondef('public.save_shop_config_atomic(jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%pg_advisory_xact_lock%' OR v_definition NOT ILIKE '%FOR UPDATE%'
    OR v_definition NOT ILIKE '%SHOP_CONFIG_SAVE%' THEN RAISE EXCEPTION 'Shop configuration save guards are missing'; END IF;
  SELECT pg_get_functiondef('public.create_expense_atomic(text,numeric,date,text)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%positive amount%' OR v_definition NOT ILIKE '%EXPENSE_CREATE%'
  THEN RAISE EXCEPTION 'Expense creation guards are missing'; END IF;
  SELECT pg_get_functiondef('public.void_expense_atomic(uuid,text)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%' OR v_definition NOT ILIKE '%voided_at=NOW()%'
    OR v_definition NOT ILIKE '%EXPENSE_VOID%' OR v_definition ILIKE '%DELETE FROM expenses%'
  THEN RAISE EXCEPTION 'Expense void guards are missing'; END IF;
END $$;

SELECT 'atomic shop and expense lifecycle verified' AS verification;