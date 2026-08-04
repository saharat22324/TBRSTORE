-- Read-only Production smoke test for atomic service catalog writes.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='services'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'Direct service catalog write policy remains';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.save_service_atomic(text,jsonb)','EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated','public.archive_service_atomic(text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic service catalog RPCs';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('save_service_atomic','archive_service_atomic')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN
    RAISE EXCEPTION 'Atomic service catalog security configuration is invalid';
  END IF;
  SELECT pg_get_functiondef('public.save_service_atomic(text,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_definition NOT ILIKE '%FOR UPDATE%'
     OR v_definition NOT ILIKE '%Service code already exists%'
     OR v_definition NOT ILIKE '%SERVICE_SAVE%' THEN
    RAISE EXCEPTION 'Atomic service save guards are missing';
  END IF;
  SELECT pg_get_functiondef('public.archive_service_atomic(text)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%'
     OR v_definition NOT ILIKE '%active=FALSE%'
     OR v_definition NOT ILIKE '%SERVICE_ARCHIVE%' THEN
    RAISE EXCEPTION 'Atomic service archive guards are missing';
  END IF;
END $$;

SELECT 'atomic service catalog verified' AS verification;
