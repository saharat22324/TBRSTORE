-- TBR System: guarded invoice tax snapshots and job-link repairs.
-- Apply after 20260815_atomic_customer_vehicle_lifecycle.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION update_invoice_tax_details_atomic(p_invoice_id UUID,p_buyer JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_invoice invoices;
  v_name TEXT:=BTRIM(COALESCE(p_buyer->>'name',''));
  v_address TEXT:=BTRIM(COALESCE(p_buyer->>'address',''));
  v_tax_id TEXT:=REGEXP_REPLACE(COALESCE(p_buyer->>'tax_id',''),'[^0-9]','','g');
  v_branch TEXT:=BTRIM(COALESCE(p_buyer->>'branch',''));
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can update invoice tax details'; END IF;
  IF v_name='' OR v_address='' THEN RAISE EXCEPTION 'Buyer name and address are required'; END IF;
  IF v_tax_id !~ '^[0-9]{13}$' THEN RAISE EXCEPTION 'Buyer tax ID must contain 13 digits'; END IF;
  IF v_branch='' THEN RAISE EXCEPTION 'Buyer branch is required'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status IN ('cancelled','credited','refunded')
    OR v_invoice.document_type IN ('credit_note','debit_note')
  THEN RAISE EXCEPTION 'Tax details cannot be changed for this document'; END IF;
  UPDATE invoices SET invoice_type='tax_invoice',document_type='tax_invoice',
    buyer_name=v_name,buyer_address=v_address,buyer_tax_id=v_tax_id,buyer_branch=v_branch,
    version=COALESCE(version,1)+1,updated_at=NOW()
  WHERE id=p_invoice_id RETURNING * INTO v_invoice;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_TAX_DETAILS_UPDATE','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('buyer_tax_id',v_tax_id,'buyer_branch',v_branch,'version',v_invoice.version));
  RETURN v_invoice;
END; $$;

CREATE OR REPLACE FUNCTION repair_invoice_job_link_atomic(p_invoice_id UUID,p_job_id UUID)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_job jobs;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can repair invoice links'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status='cancelled' OR v_invoice.document_type IN ('credit_note','debit_note') THEN
    RAISE EXCEPTION 'Invoice link cannot be changed for this document';
  END IF;
  IF v_invoice.job_id IS NOT NULL THEN
    IF v_invoice.job_id=p_job_id THEN RETURN v_invoice; END IF;
    RAISE EXCEPTION 'Invoice already has a different job link';
  END IF;
  SELECT * INTO v_job FROM jobs WHERE id=p_job_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_invoice.customer_id IS NOT NULL AND v_job.customer_id<>v_invoice.customer_id THEN RAISE EXCEPTION 'Job customer does not match invoice'; END IF;
  IF v_invoice.vehicle_id IS NOT NULL AND v_job.vehicle_id<>v_invoice.vehicle_id THEN RAISE EXCEPTION 'Job vehicle does not match invoice'; END IF;
  UPDATE invoices SET job_id=p_job_id,version=COALESCE(version,1)+1,updated_at=NOW()
  WHERE id=p_invoice_id AND job_id IS NULL RETURNING * INTO v_invoice;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice job link changed concurrently'; END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_JOB_LINK_REPAIR','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('job_id',p_job_id,'version',v_invoice.version));
  RETURN v_invoice;
END; $$;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD; v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['invoices','invoice_items'] LOOP
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=v_table AND cmd<>'SELECT'
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_policy.policyname,v_table); END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION update_invoice_tax_details_atomic(UUID,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION repair_invoice_job_link_atomic(UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION update_invoice_tax_details_atomic(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION repair_invoice_job_link_atomic(UUID,UUID) TO authenticated;
COMMIT;