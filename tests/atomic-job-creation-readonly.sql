-- Read-only Production smoke test for atomic job creation.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='jobs' AND cmd IN ('INSERT','ALL')
  ) THEN
    RAISE EXCEPTION 'Direct job insert policy remains';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.create_job_atomic(text,uuid,uuid,text,uuid,integer,text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic job creation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='create_job_atomic'
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN
    RAISE EXCEPTION 'Atomic job creation security configuration is invalid';
  END IF;
  SELECT pg_get_functiondef(
    'public.create_job_atomic(text,uuid,uuid,text,uuid,integer,text)'::regprocedure
  ) INTO v_definition;
  IF v_definition NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_definition NOT ILIKE '%FOR UPDATE%'
     OR v_definition NOT ILIKE '%Vehicle does not belong to customer%'
     OR v_definition NOT ILIKE '%UPDATE vehicles SET mileage%'
     OR v_definition NOT ILIKE '%INSERT INTO jobs%'
     OR v_definition NOT ILIKE '%JOB_CREATE%' THEN
    RAISE EXCEPTION 'Atomic job creation guards are missing';
  END IF;
END $$;

SELECT 'atomic job creation verified' AS verification;
