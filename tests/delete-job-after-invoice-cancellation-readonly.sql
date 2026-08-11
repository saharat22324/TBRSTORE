-- Read-only verification for 20260822_delete_jobs_after_invoice_cancellation.sql.

DO $$
DECLARE v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.delete_job_atomic(uuid)'::regprocedure) INTO v_definition;
    IF v_definition NOT ILIKE '%cancelled%credited%refunded%'
      OR v_definition NOT ILIKE '%credit_note%debit_note%'
      OR v_definition NOT ILIKE '%An active billed job cannot be deleted%'
    OR v_definition NOT ILIKE '%UPDATE invoices%job_id%NULL%'
     OR v_definition NOT ILIKE '%inactive_invoices_unlinked%' THEN
    RAISE EXCEPTION 'Cancelled-invoice job deletion guard is incomplete';
  END IF;
  IF has_function_privilege('anon','public.delete_job_atomic(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.delete_job_atomic(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Job deletion RPC grants are invalid';
  END IF;
END $$;

SELECT 'job deletion after invoice cancellation verified' AS verification;