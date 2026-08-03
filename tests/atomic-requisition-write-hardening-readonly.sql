-- Read-only Production verification for 20260804_atomic_requisition_and_write_hardening.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('requisitions','requisition_items')
      AND cmd IN ('INSERT','UPDATE','DELETE')
  ) THEN RAISE EXCEPTION 'Direct requisition write policy is still active'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='stock_items' AND cmd='UPDATE'
      AND (lower(COALESCE(qual,''))='true' OR lower(COALESCE(with_check,''))='true')
  ) THEN RAISE EXCEPTION 'Stock update policy is not role restricted'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='invoices' AND cmd='INSERT'
  ) THEN RAISE EXCEPTION 'Direct invoice insert policy is still active'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='invoice_payments' AND cmd IN ('INSERT','UPDATE','DELETE')
  ) THEN RAISE EXCEPTION 'Direct payment write policy is still active'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN ('create_requisition_atomic','update_requisition_atomic','delete_requisition_atomic','delete_job_atomic')
      AND (NOT p.prosecdef OR p.proconfig IS NULL OR NOT ('search_path=public'=ANY(p.proconfig)))
  ) THEN RAISE EXCEPTION 'Atomic RPC security configuration is invalid'; END IF;

  IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('create_requisition_atomic','update_requisition_atomic','delete_requisition_atomic','delete_job_atomic')) <> 4
  THEN RAISE EXCEPTION 'Atomic requisition RPC is missing'; END IF;
END $$;

SELECT 'atomic requisition and write hardening verified' AS result;