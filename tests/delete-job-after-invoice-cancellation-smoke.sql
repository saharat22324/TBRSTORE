-- Transactional smoke test for deleting a job after invoice cancellation.
-- All writes are rolled back. Run as postgres in Supabase SQL Editor.

BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  v_suffix TEXT:=txid_current()::TEXT;
  v_customer UUID;
  v_vehicle UUID;
  v_job jobs;
  v_invoice invoices;
BEGIN
  INSERT INTO customers(name) VALUES('Delete cancelled job '||v_suffix) RETURNING id INTO v_customer;
  INSERT INTO vehicles(customer_id,plate,brand,model)
  VALUES(v_customer,'DCJ'||v_suffix,'Smoke','Delete') RETURNING id INTO v_vehicle;
  SELECT * INTO v_job FROM create_job_atomic(
    'SMOKE-DELETE-CANCELLED-'||v_suffix,v_vehicle,v_customer,'Delete cancelled smoke',NULL,0,NULL
  );
  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-DCJ-INV-'||v_suffix,'job_id',v_job.id,
      'customer_id',v_customer,'vehicle_id',v_vehicle,'customer_name','Delete cancelled job',
      'subtotal',20,'discount',0,'vat',0,'grand_total',20
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','service','description','Delete cancelled service',
      'quantity',1,'unit_price',20,'cost_price',0,'total',20
    ))
  );

  BEGIN
    PERFORM delete_job_atomic(v_job.id);
    RAISE EXCEPTION 'Active billed job deletion unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Active billed job deletion unexpectedly succeeded' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM jobs WHERE id=v_job.id) THEN
    RAISE EXCEPTION 'Rejected active billed job deletion removed the job';
  END IF;

  PERFORM cancel_invoice_atomic(v_invoice.id,'delete cancelled job smoke');
  PERFORM delete_job_atomic(v_job.id);
  IF EXISTS(SELECT 1 FROM jobs WHERE id=v_job.id) THEN
    RAISE EXCEPTION 'Cancelled billed job was not deleted';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM invoices
    WHERE id=v_invoice.id AND status='cancelled' AND job_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cancelled invoice was deleted or remained linked to the deleted job';
  END IF;
END $$;

SELECT 'delete job after invoice cancellation smoke test passed' AS verification;
ROLLBACK;