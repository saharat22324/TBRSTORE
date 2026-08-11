-- Read-only verification for 20260821_lock_requisition_linked_invoice_quantities.sql.

DO $$
DECLARE v_definition TEXT;
BEGIN
  IF to_regprocedure('public.update_invoice_atomic_unlocked(uuid,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Unlocked internal invoice update function is missing';
  END IF;

  SELECT pg_get_functiondef('public.update_invoice_atomic(uuid,jsonb,jsonb)'::regprocedure)
  INTO v_definition;
  IF v_definition NOT ILIKE '%Requisition-linked stock quantities must be edited from the Job Card%'
     OR v_definition NOT ILIKE '%FULL JOIN new_quantities%'
     OR v_definition NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'Requisition-linked invoice quantity guard is incomplete';
  END IF;

  IF has_function_privilege('authenticated','public.update_invoice_atomic_unlocked(uuid,jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.update_invoice_atomic(uuid,jsonb,jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.update_invoice_atomic(uuid,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Invoice update RPC grants are invalid';
  END IF;
END $$;

SELECT 'requisition-linked invoice quantity lock verified' AS verification;