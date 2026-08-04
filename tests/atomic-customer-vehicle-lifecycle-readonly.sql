-- Read-only Production smoke test for atomic customer and vehicle writes.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('customers','vehicles')
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'Direct customer or vehicle write policy remains';
  END IF;
  IF NOT has_function_privilege('authenticated','public.save_customer_atomic(uuid,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.delete_unused_customer_atomic(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.save_vehicle_atomic(uuid,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.delete_unused_vehicle_atomic(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Authenticated role cannot execute atomic customer and vehicle RPCs'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'save_customer_atomic','delete_unused_customer_atomic','save_vehicle_atomic','delete_unused_vehicle_atomic'
    ) AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN RAISE EXCEPTION 'Atomic customer or vehicle security configuration is invalid'; END IF;

  SELECT pg_get_functiondef('public.save_customer_atomic(uuid,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%' OR v_definition NOT ILIKE '%CUSTOMER_SAVE%'
    OR v_definition NOT ILIKE '%p_customer%?%name%' THEN RAISE EXCEPTION 'Atomic customer save guards are missing'; END IF;
  SELECT pg_get_functiondef('public.delete_unused_customer_atomic(uuid)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%' OR v_definition NOT ILIKE '%Customer has business history%'
    OR v_definition NOT ILIKE '%CUSTOMER_DELETE_UNUSED%' THEN RAISE EXCEPTION 'Unused customer deletion guards are missing'; END IF;
  SELECT pg_get_functiondef('public.save_vehicle_atomic(uuid,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%pg_advisory_xact_lock%' OR v_definition NOT ILIKE '%FOR UPDATE%'
    OR v_definition NOT ILIKE '%FOR KEY SHARE%' OR v_definition NOT ILIKE '%Vehicle plate already exists%'
    OR v_definition NOT ILIKE '%VEHICLE_SAVE%' THEN RAISE EXCEPTION 'Atomic vehicle save guards are missing'; END IF;
  SELECT pg_get_functiondef('public.delete_unused_vehicle_atomic(uuid)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%' OR v_definition NOT ILIKE '%Vehicle has business history%'
    OR v_definition NOT ILIKE '%VEHICLE_DELETE_UNUSED%' THEN RAISE EXCEPTION 'Unused vehicle deletion guards are missing'; END IF;
END $$;

SELECT 'atomic customer and vehicle lifecycle verified' AS verification;