-- Read-only verification for 20260819_backdated_invoice_dates.sql.

DO $$
DECLARE
  v_definition TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices'
      AND column_name='invoice_date' AND data_type='date' AND is_nullable='NO'
  ) THEN RAISE EXCEPTION 'invoices.invoice_date is missing or nullable'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices'
      AND column_name='backdate_reason' AND data_type='text'
  ) THEN RAISE EXCEPTION 'invoices.backdate_reason is missing'; END IF;

  IF EXISTS (SELECT 1 FROM invoices WHERE invoice_date IS NULL) THEN
    RAISE EXCEPTION 'Existing invoices were not backfilled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='invoices'
      AND indexname='idx_invoices_invoice_date'
  ) THEN RAISE EXCEPTION 'Invoice date index is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.invoices'::regclass
      AND tgname='trg_enforce_invoice_document_date' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Invoice document date trigger is missing'; END IF;

  SELECT pg_get_functiondef('public.create_invoice_atomic(jsonb,jsonb)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT ILIKE '%Only admin can create a backdated invoice%'
     OR v_definition NOT ILIKE '%Backdate reason is required%'
     OR v_definition NOT ILIKE '%Invoice date cannot be in the future%'
     OR v_definition NOT ILIKE '%pg_advisory_xact_lock%'
     OR v_definition NOT ILIKE '%INVOICE_CREATE_BACKDATED%'
     OR v_definition NOT ILIKE '%stock_deducted_qty%' THEN
    RAISE EXCEPTION 'Backdate controls or stock idempotency guards are missing';
  END IF;
END $$;

SELECT 'backdated invoice dates verified' AS verification;
