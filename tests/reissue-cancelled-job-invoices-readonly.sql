-- Read-only verification for replacement invoices after cancellation.

DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT indexdef INTO v_definition
  FROM pg_indexes
  WHERE schemaname='public' AND indexname='uq_invoices_active_job';

  IF v_definition IS NULL
     OR v_definition NOT ILIKE '%UNIQUE INDEX%invoices%job_id%'
     OR v_definition NOT ILIKE '%cancelled%credited%refunded%'
     OR v_definition NOT ILIKE '%credit_note%debit_note%' THEN
    RAISE EXCEPTION 'Active job invoice uniqueness guard is incomplete';
  END IF;
END $$;

SELECT 'replacement invoice after cancellation verified' AS verification;