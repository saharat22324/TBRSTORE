BEGIN READ ONLY;
DO $$
DECLARE signature TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.invoice_write_requests'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Invoice request RLS is missing';
  END IF;
  IF has_table_privilege('authenticated','public.invoice_write_requests','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('anon','public.invoice_write_requests','SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'Invoice request data is exposed';
  END IF;
  FOREACH signature IN ARRAY ARRAY[
    'public.create_invoice_atomic_stock_base(jsonb,jsonb)',
    'public.update_invoice_atomic_stock_base(uuid,jsonb,jsonb)',
    'public.cancel_invoice_atomic_stock_base(uuid,text)',
    'public.update_requisition_atomic_stock_base(uuid,jsonb,text)',
    'public.update_invoice_atomic_unlocked(uuid,jsonb,jsonb)',
    'public.invoice_stock_safety_issues(uuid)',
    'public.assert_invoice_stock_safe(uuid)',
    'public.validate_invoice_stock_items(jsonb)'
  ] LOOP
    IF has_function_privilege('authenticated',signature,'EXECUTE') OR has_function_privilege('anon',signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Private stock helper is exposed: %',signature;
    END IF;
  END LOOP;
  FOREACH signature IN ARRAY ARRAY[
    'public.create_invoice_atomic(jsonb,jsonb)',
    'public.update_invoice_atomic(uuid,jsonb,jsonb)',
    'public.cancel_invoice_atomic(uuid,text)',
    'public.update_requisition_atomic(uuid,jsonb,text)',
    'public.get_invoice_stock_safety_report()'
  ] LOOP
    IF NOT has_function_privilege('authenticated',signature,'EXECUTE') OR has_function_privilege('anon',signature,'EXECUTE') THEN
      RAISE EXCEPTION 'Guarded stock RPC grants are invalid: %',signature;
    END IF;
  END LOOP;
  IF pg_get_functiondef('public.create_invoice_atomic(jsonb,jsonb)'::regprocedure) NOT LIKE '%pg_advisory_xact_lock%'
    OR pg_get_functiondef('public.update_invoice_atomic(uuid,jsonb,jsonb)'::regprocedure) NOT LIKE '%expected_version%'
    OR pg_get_functiondef('public.cancel_invoice_atomic(uuid,text)'::regprocedure) NOT LIKE '%assert_invoice_stock_safe%'
    OR pg_get_functiondef('public.update_requisition_atomic(uuid,jsonb,text)'::regprocedure) NOT LIKE '%assert_invoice_stock_safe%' THEN
    RAISE EXCEPTION 'Invoice stock safety entry guards are missing';
  END IF;
END;
$$;
SELECT 'invoice stock safety permissions and entry guards verified' AS verification;
ROLLBACK;