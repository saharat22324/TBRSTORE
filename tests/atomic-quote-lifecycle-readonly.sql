-- Read-only Production smoke test for atomic quotation lifecycle.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='quotes'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'Direct quotation write policy remains';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.create_quote_atomic(jsonb)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic quotation creation';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.convert_quote_atomic(uuid)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic quotation conversion';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('create_quote_atomic','convert_quote_atomic')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN
    RAISE EXCEPTION 'Atomic quotation security configuration is invalid';
  END IF;
  SELECT pg_get_functiondef('public.create_quote_atomic(jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_definition NOT ILIKE '%Quotation number already exists%'
     OR v_definition NOT ILIKE '%QUOTE_CREATE%' THEN
    RAISE EXCEPTION 'Atomic quotation creation guards are missing';
  END IF;
  SELECT pg_get_functiondef('public.convert_quote_atomic(uuid)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%'
     OR v_definition NOT ILIKE '%already converted%'
     OR v_definition NOT ILIKE '%QUOTE_CONVERT%' THEN
    RAISE EXCEPTION 'Atomic quotation conversion guards are missing';
  END IF;
END $$;

SELECT 'atomic quotation lifecycle verified' AS verification;
