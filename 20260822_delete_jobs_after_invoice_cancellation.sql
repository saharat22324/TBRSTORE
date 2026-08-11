-- TBR System: allow job deletion after all linked accounting documents are inactive.
-- Apply after 20260821_lock_requisition_linked_invoice_quantities.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION delete_job_atomic(p_job_id UUID)
RETURNS jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_job jobs; v_requisition RECORD;
BEGIN
  IF current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_job FROM jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;

  IF EXISTS(
    SELECT 1 FROM invoices
    WHERE job_id=p_job_id
      AND status NOT IN ('cancelled','credited','refunded')
      AND document_type NOT IN ('credit_note','debit_note')
  ) THEN
    RAISE EXCEPTION 'An active billed job cannot be deleted';
  END IF;

  UPDATE invoices SET job_id=NULL,updated_at=NOW()
  WHERE job_id=p_job_id;

  FOR v_requisition IN SELECT id FROM requisitions WHERE job_id=p_job_id FOR UPDATE LOOP
    PERFORM delete_requisition_atomic(v_requisition.id);
  END LOOP;
  DELETE FROM jobs WHERE id=p_job_id;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'JOB_DELETE','job',v_job.id::TEXT,v_job.job_number,
    jsonb_build_object('inactive_invoices_unlinked',true));
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION delete_job_atomic(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION delete_job_atomic(UUID) TO authenticated;

COMMIT;