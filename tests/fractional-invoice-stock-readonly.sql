-- Read-only Production smoke test for fractional invoice stock lifecycle.
DO $$
DECLARE v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.create_invoice_atomic(jsonb,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition ILIKE '%TRUNC(%' OR v_definition ILIKE '%v_qty::integer%'
     OR v_definition NOT ILIKE '%quantity%-%v_qty%' THEN
    RAISE EXCEPTION 'Invoice creation still truncates fractional stock';
  END IF;
  SELECT pg_get_functiondef('public.update_invoice_atomic(uuid,jsonb,jsonb)'::regprocedure) INTO v_definition;
  IF v_definition ILIKE '%TRUNC(%' OR v_definition ILIKE '%::integer%'
     OR v_definition NOT ILIKE '%quantity%+%v_old.qty%'
     OR v_definition NOT ILIKE '%quantity%-%v_qty%' THEN
    RAISE EXCEPTION 'Invoice editing still truncates fractional stock';
  END IF;
  SELECT pg_get_functiondef('public.cancel_invoice_atomic(uuid,text)'::regprocedure) INTO v_definition;
  IF v_definition ILIKE '%::integer%'
     OR v_definition NOT ILIKE '%quantity%+%v_item.qty%' THEN
    RAISE EXCEPTION 'Invoice cancellation still truncates fractional stock';
  END IF;
END $$;

SELECT 'fractional invoice stock lifecycle verified' AS verification;
