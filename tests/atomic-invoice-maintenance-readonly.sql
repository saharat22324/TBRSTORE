-- Read-only Production smoke test for guarded invoice maintenance.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('invoices','invoice_items')
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN RAISE EXCEPTION 'Direct invoice or invoice-item write policy remains'; END IF;
  IF NOT has_function_privilege('authenticated','public.update_invoice_tax_details_atomic(uuid,jsonb)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.repair_invoice_job_link_atomic(uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Authenticated role cannot execute invoice maintenance RPCs'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('update_invoice_tax_details_atomic','repair_invoice_job_link_atomic')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT 'search_path=public'=ANY(p.proconfig))
  ) THEN RAISE EXCEPTION 'Invoice maintenance security configuration is invalid'; END IF;

  SELECT pg_get_functiondef('public.update_invoice_tax_details_atomic(uuid,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%' OR v_definition NOT ILIKE '%13 digits%'
    OR v_definition NOT ILIKE '%credit_note%' OR v_definition NOT ILIKE '%INVOICE_TAX_DETAILS_UPDATE%'
  THEN RAISE EXCEPTION 'Invoice tax detail guards are missing'; END IF;
  SELECT pg_get_functiondef('public.repair_invoice_job_link_atomic(uuid,uuid)'::regprocedure) INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%' OR v_definition NOT ILIKE '%FOR KEY SHARE%'
    OR v_definition NOT ILIKE '%job_id IS NULL%' OR v_definition NOT ILIKE '%customer does not match%'
    OR v_definition NOT ILIKE '%vehicle does not match%' OR v_definition NOT ILIKE '%INVOICE_JOB_LINK_REPAIR%'
  THEN RAISE EXCEPTION 'Invoice job-link repair guards are missing'; END IF;
END $$;

SELECT 'atomic invoice maintenance verified' AS verification;