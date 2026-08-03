-- Read-only Production smoke test for atomic purchase-order lifecycle.
DO $$
DECLARE v_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='purchase_orders'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    RAISE EXCEPTION 'Direct purchase-order write policy remains';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.create_purchase_order_atomic(text,text,jsonb,numeric,text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic PO creation';
  END IF;
  IF NOT has_function_privilege(
    'authenticated','public.cancel_purchase_order_atomic(uuid,text)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute atomic PO cancellation';
  END IF;
  SELECT pg_get_functiondef('public.cancel_purchase_order_atomic(uuid,text)'::regprocedure)
  INTO v_definition;
  IF v_definition NOT ILIKE '%FOR UPDATE%'
     OR v_definition NOT ILIKE '%status<>''pending''%' THEN
    RAISE EXCEPTION 'Atomic PO cancellation guards are missing';
  END IF;
  SELECT pg_get_functiondef(
    'public.create_purchase_order_atomic(text,text,jsonb,numeric,text)'::regprocedure
  ) INTO v_definition;
  IF v_definition NOT ILIKE '%pg_advisory_xact_lock%' THEN
    RAISE EXCEPTION 'Atomic PO number lock is missing';
  END IF;
END $$;

SELECT 'atomic purchase-order lifecycle verified' AS verification;