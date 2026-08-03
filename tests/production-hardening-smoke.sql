-- Run in a STAGING Supabase SQL Editor after both hardening migrations.
-- Every data-changing assertion runs inside a transaction and is rolled back.

BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.create_invoice_atomic(jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'create_invoice_atomic is missing';
  END IF;
  IF to_regprocedure('public.cancel_invoice_atomic(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'cancel_invoice_atomic is missing';
  END IF;
  IF to_regprocedure('public.get_stock_items_secure()') IS NULL THEN
    RAISE EXCEPTION 'get_stock_items_secure is missing';
  END IF;
  IF to_regprocedure('public.get_invoices_secure()') IS NULL THEN
    RAISE EXCEPTION 'get_invoices_secure is missing';
  END IF;
END $$;

DO $$
DECLARE
  v_first TEXT;
  v_second TEXT;
BEGIN
  v_first := next_document_number('smoke_test', 'TEST', '00000');
  v_second := next_document_number('smoke_test', 'TEST', '00000');
  IF v_first = v_second THEN RAISE EXCEPTION 'Document sequence generated a duplicate'; END IF;
  IF v_first !~ '^TEST-[0-9]{4}-[0-9]{6}$' THEN
    RAISE EXCEPTION 'Unexpected document number format: %', v_first;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='status'
  ) THEN RAISE EXCEPTION 'invoices.status is missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='invoice_payments'
  ) THEN RAISE EXCEPTION 'invoice_payments is missing'; END IF;
END $$;

-- Ensure issued documents cannot be physically deleted.
DO $$
DECLARE
  v_id UUID;
  v_customer_id UUID;
BEGIN
  INSERT INTO customers(name) VALUES ('Hardening smoke test') RETURNING id INTO v_customer_id;
  INSERT INTO invoices(invoice_number, customer_id, subtotal, discount, vat, grand_total, status)
  VALUES ('TST-' || gen_random_uuid()::TEXT, v_customer_id, 0, 0, 0, 0, 'issued')
  RETURNING id INTO v_id;

  BEGIN
    DELETE FROM invoices WHERE id = v_id;
    RAISE EXCEPTION 'Delete guard did not block an issued invoice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Delete guard did not block an issued invoice' THEN RAISE; END IF;
  END;
END $$;

ROLLBACK;

SELECT 'production hardening smoke tests passed' AS result;
