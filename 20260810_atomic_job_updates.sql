-- TBR System: atomic job edits and status transitions.
-- Apply after 20260809_atomic_purchase_order_lifecycle.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION update_job_atomic(
  p_job_id UUID,
  p_expected_status_id INTEGER,
  p_expected_updated_at TIMESTAMP DEFAULT NULL,
  p_updates JSONB DEFAULT '{}'::JSONB
) RETURNS jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_job jobs; v_vehicle vehicles; v_vehicle_id UUID; v_status_id INTEGER; v_mileage INTEGER;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor','technician') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF COALESCE(jsonb_typeof(p_updates),'')<>'object' OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_updates) AS patch_keys(patch_key)
    WHERE patch_key NOT IN ('vehicle_id','customer_id','complaint','mileage','note','assign_to','status_id','images')
  ) THEN
    RAISE EXCEPTION 'Invalid job update payload';
  END IF;
  SELECT * INTO v_job FROM jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.status_id IS DISTINCT FROM p_expected_status_id THEN
    RAISE EXCEPTION 'Job status changed; reload before saving';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_job.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Job was edited by another user; reload before saving';
  END IF;
  v_vehicle_id:=CASE WHEN p_updates?'vehicle_id' THEN NULLIF(p_updates->>'vehicle_id','')::UUID ELSE v_job.vehicle_id END;
  v_status_id:=CASE WHEN p_updates?'status_id' THEN (p_updates->>'status_id')::INTEGER ELSE v_job.status_id END;
  v_mileage:=CASE WHEN p_updates?'mileage' THEN (p_updates->>'mileage')::INTEGER ELSE v_job.mileage END;
  IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle is required'; END IF;
  IF v_status_id NOT BETWEEN 1 AND 6 THEN
    RAISE EXCEPTION 'Invalid job status';
  END IF;
  IF v_mileage IS NOT NULL AND v_mileage<0 THEN RAISE EXCEPTION 'Mileage must be non-negative'; END IF;

  IF p_updates?'vehicle_id' OR p_updates?'mileage' THEN
    SELECT * INTO v_vehicle FROM vehicles WHERE id=v_vehicle_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    IF p_updates?'mileage' THEN
      UPDATE vehicles SET mileage=v_mileage,updated_at=NOW() WHERE id=v_vehicle_id;
    END IF;
  END IF;

  UPDATE jobs SET
    vehicle_id=v_vehicle_id,
    customer_id=CASE WHEN p_updates?'customer_id' THEN NULLIF(p_updates->>'customer_id','')::UUID ELSE customer_id END,
    complaint=CASE WHEN p_updates?'complaint' THEN p_updates->>'complaint' ELSE complaint END,
    mileage=v_mileage,
    note=CASE WHEN p_updates?'note' THEN p_updates->>'note' ELSE note END,
    assign_to=CASE WHEN p_updates?'assign_to' THEN NULLIF(p_updates->>'assign_to','')::UUID ELSE assign_to END,
    status_id=v_status_id,
    images=CASE WHEN p_updates?'images' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_updates->'images','[]'::JSONB))) ELSE images END,
    closed_at=CASE WHEN v_status_id=6 THEN COALESCE(closed_at,NOW()) ELSE NULL END,
    updated_at=NOW()
  WHERE id=v_job.id RETURNING * INTO v_job;

  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'JOB_UPDATE','job',v_job.id::TEXT,v_job.job_number,
    jsonb_build_object('from_status_id',p_expected_status_id,'to_status_id',v_job.status_id,
      'vehicle_id',v_job.vehicle_id,'mileage',v_job.mileage));
  RETURN v_job;
END;
$$;

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='jobs' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jobs',v_policy.policyname);
  END LOOP;
END $$;
DROP POLICY IF EXISTS team_update_jobs ON jobs;
DROP POLICY IF EXISTS prod_jobs_update ON jobs;
DROP POLICY IF EXISTS "Admins and technicians can update jobs" ON jobs;

REVOKE ALL ON FUNCTION update_job_atomic(UUID,INTEGER,TIMESTAMP,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION update_job_atomic(UUID,INTEGER,TIMESTAMP,JSONB) TO authenticated;

COMMIT;
