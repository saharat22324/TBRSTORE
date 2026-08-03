-- Read-only Production smoke test for atomic job updates.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='jobs' AND cmd IN ('UPDATE','ALL')
  ) THEN
    RAISE EXCEPTION 'Direct job update policy remains';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.update_job_atomic(uuid,integer,timestamp without time zone,jsonb)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic job update';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='update_job_atomic'
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN
    RAISE EXCEPTION 'Atomic job update security configuration is invalid';
  END IF;
  SELECT pg_get_functiondef(
    'public.update_job_atomic(uuid,integer,timestamp without time zone,jsonb)'::regprocedure
  ) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%'
     OR v_definition NOT ILIKE '%status changed; reload before saving%'
     OR v_definition NOT ILIKE '%edited by another user; reload before saving%'
    OR v_definition NOT ILIKE '%p_updates%?%status_id%'
     OR v_definition NOT ILIKE '%UPDATE vehicles SET mileage%'
     OR v_definition NOT ILIKE '%UPDATE jobs SET%' THEN
    RAISE EXCEPTION 'Atomic job lock, conflict, patch or mileage guards are missing';
  END IF;
END $$;

SELECT 'atomic job updates verified' AS verification;
