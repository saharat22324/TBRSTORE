-- Read-only verification for 20260820_atomic_billed_requisition_invoice_sync.sql.

DO $$
DECLARE v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.block_billed_requisition_changes()'::regprocedure)
  INTO v_definition;

  IF v_definition NOT ILIKE '%BILLED_REQUISITION_SYNC%'
     OR v_definition NOT ILIKE '%stock_deducted_qty%'
     OR v_definition NOT ILIKE '%Reverse payments before editing%'
     OR v_definition NOT ILIKE '%grand_total=ROUND%'
     OR v_definition NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'Atomic billed requisition invoice synchronization is incomplete';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.requisitions'::regclass
      AND tgname='trg_block_billed_requisition_changes' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Billed requisition synchronization trigger is missing'; END IF;

  IF has_function_privilege('anon','public.update_requisition_atomic(uuid,jsonb,text)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.update_requisition_atomic(uuid,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Requisition update RPC grants are invalid';
  END IF;
END $$;

SELECT 'billed requisition invoice synchronization verified' AS verification;