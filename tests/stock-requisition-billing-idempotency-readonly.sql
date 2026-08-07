-- Read-only verification for 20260818_stock_requisition_billing_idempotency.sql.

DO $$
DECLARE
  v_create_definition TEXT;
  v_update_definition TEXT;
  v_cancel_definition TEXT;
  v_payment_definition TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoice_items'
      AND column_name='stock_deducted_qty' AND data_type='numeric'
  ) THEN RAISE EXCEPTION 'invoice_items.stock_deducted_qty is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoice_payments'
      AND column_name='request_id' AND data_type='uuid'
  ) THEN RAISE EXCEPTION 'invoice_payments.request_id is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='invoice_payments'
      AND indexname='uq_invoice_payments_request_id'
  ) THEN RAISE EXCEPTION 'Payment request id unique index is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.requisitions'::regclass
      AND tgname='trg_block_billed_requisition_changes' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Billed requisition lock trigger is missing'; END IF;

  SELECT pg_get_functiondef('public.create_invoice_atomic(jsonb,jsonb)'::regprocedure) INTO v_create_definition;
  SELECT pg_get_functiondef('public.update_invoice_atomic(uuid,jsonb,jsonb)'::regprocedure) INTO v_update_definition;
  SELECT pg_get_functiondef('public.cancel_invoice_atomic(uuid,text)'::regprocedure) INTO v_cancel_definition;
  SELECT pg_get_functiondef('public.record_invoice_payment(uuid,numeric,character varying,character varying,text,uuid)'::regprocedure) INTO v_payment_definition;

  IF v_create_definition NOT ILIKE '%requisition_coverage%'
     OR v_create_definition NOT ILIKE '%v_deducted_qty%'
     OR v_create_definition NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'Invoice creation requisition coverage guards are missing';
  END IF;
  IF v_update_definition NOT ILIKE '%SUM(stock_deducted_qty)%'
     OR v_cancel_definition NOT ILIKE '%SUM(stock_deducted_qty)%' THEN
    RAISE EXCEPTION 'Invoice edit/cancel does not restore only invoice-deducted stock';
  END IF;
    IF v_payment_definition NOT ILIKE '%request_id=p_request_id%'
      OR v_payment_definition NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_payment_definition NOT ILIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'Payment idempotency or serialization guard is missing';
  END IF;

  IF NOT has_function_privilege(
    'authenticated','public.record_invoice_payment(uuid,numeric,character varying,character varying,text,uuid)','EXECUTE'
  ) OR has_function_privilege(
    'anon','public.record_invoice_payment(uuid,numeric,character varying,character varying,text,uuid)','EXECUTE'
  ) THEN RAISE EXCEPTION 'Payment RPC grants are invalid'; END IF;
END $$;

SELECT 'stock requisition billing and payment idempotency verified' AS verification;
