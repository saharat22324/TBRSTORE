-- TBR System: atomic job creation and vehicle mileage update.
-- Apply after 20260810_atomic_job_updates.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION create_job_atomic(
  p_job_number TEXT,
  p_vehicle_id UUID,
  p_customer_id UUID,
  p_complaint TEXT DEFAULT NULL,
  p_assign_to UUID DEFAULT NULL,
  p_mileage INTEGER DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_job jobs; v_vehicle vehicles;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor','technician') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF COALESCE(BTRIM(p_job_number),'')='' THEN RAISE EXCEPTION 'Job number is required'; END IF;
  IF p_vehicle_id IS NULL OR p_customer_id IS NULL THEN RAISE EXCEPTION 'Vehicle and customer are required'; END IF;
  IF p_mileage IS NOT NULL AND p_mileage<0 THEN RAISE EXCEPTION 'Mileage must be non-negative'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(BTRIM(p_job_number),0));
  IF EXISTS (SELECT 1 FROM jobs WHERE job_number=BTRIM(p_job_number)) THEN
    RAISE EXCEPTION 'Job number already exists';
  END IF;
  SELECT * INTO v_vehicle FROM vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id=p_customer_id) THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF v_vehicle.customer_id IS DISTINCT FROM p_customer_id THEN RAISE EXCEPTION 'Vehicle does not belong to customer'; END IF;

  IF p_mileage IS NOT NULL THEN
    UPDATE vehicles SET mileage=p_mileage,updated_at=NOW() WHERE id=p_vehicle_id;
  END IF;
  INSERT INTO jobs(job_number,vehicle_id,customer_id,status_id,complaint,assign_to,mileage,note,created_by,created_at,updated_at)
  VALUES(BTRIM(p_job_number),p_vehicle_id,p_customer_id,1,p_complaint,p_assign_to,p_mileage,p_note,auth.uid(),NOW(),NOW())
  RETURNING * INTO v_job;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'JOB_CREATE','job',v_job.id::TEXT,v_job.job_number,
    jsonb_build_object('vehicle_id',v_job.vehicle_id,'customer_id',v_job.customer_id,'mileage',v_job.mileage));
  RETURN v_job;
END;
$$;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='jobs' AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs',v_policy.policyname);
  END LOOP;
END $$;
DROP POLICY IF EXISTS team_write_jobs ON jobs;
DROP POLICY IF EXISTS prod_jobs_insert ON jobs;
DROP POLICY IF EXISTS "Admins and technicians can insert jobs" ON jobs;

REVOKE ALL ON FUNCTION create_job_atomic(TEXT,UUID,UUID,TEXT,UUID,INTEGER,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_job_atomic(TEXT,UUID,UUID,TEXT,UUID,INTEGER,TEXT) TO authenticated;

COMMIT;
