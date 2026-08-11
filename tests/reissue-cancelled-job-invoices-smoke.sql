-- Rollback smoke test for replacing a cancelled job invoice.

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
  v_first_invoice invoices;
  v_replacement_invoice invoices;
BEGIN
  INSERT INTO customers(name)
  VALUES('Replacement invoice smoke '||v_suffix)
  RETURNING id INTO v_customer;

  INSERT INTO vehicles(customer_id,plate,brand,model)
  VALUES(v_customer,'RIS'||v_suffix,'Smoke','Replacement')
  RETURNING id INTO v_vehicle;

  SELECT * INTO v_job FROM create_job_atomic(
    'SMOKE-REISSUE-'||v_suffix,v_vehicle,v_customer,
    'Replacement invoice smoke',NULL,0,NULL
  );

  SELECT * INTO v_first_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-REISSUE-1-'||v_suffix,
      'job_id',v_job.id,'customer_id',v_customer,'vehicle_id',v_vehicle,
      'customer_name','Replacement invoice smoke',
      'subtotal',20,'discount',0,'vat',0,'grand_total',20
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','service','description','Original service',
      'quantity',1,'unit_price',20,'cost_price',0,'total',20
    ))
  );

  BEGIN
    PERFORM create_invoice_atomic(
      jsonb_build_object(
        'invoice_number','SMOKE-REISSUE-2-'||v_suffix,
        'job_id',v_job.id,'customer_id',v_customer,'vehicle_id',v_vehicle,
        'customer_name','Replacement invoice smoke',
        'subtotal',10,'discount',0,'vat',0,'grand_total',10
      ),
      jsonb_build_array(jsonb_build_object(
        'item_type','service','description','Duplicate active service',
        'quantity',1,'unit_price',10,'cost_price',0,'total',10
      ))
    );
    RAISE EXCEPTION 'Second active invoice unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  PERFORM cancel_invoice_atomic(v_first_invoice.id,'replacement invoice smoke');

  SELECT * INTO v_replacement_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-REISSUE-3-'||v_suffix,
      'job_id',v_job.id,'customer_id',v_customer,'vehicle_id',v_vehicle,
      'customer_name','Replacement invoice smoke',
      'subtotal',30,'discount',0,'vat',0,'grand_total',30
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','service','description','Replacement service',
      'quantity',1,'unit_price',30,'cost_price',0,'total',30
    ))
  );

  IF v_replacement_invoice.id IS NULL
     OR v_replacement_invoice.job_id<>v_job.id
     OR v_replacement_invoice.status<>'issued' THEN
    RAISE EXCEPTION 'Replacement invoice was not issued for the job';
  END IF;

  IF (SELECT COUNT(*) FROM invoices
      WHERE job_id=v_job.id
        AND status NOT IN ('cancelled','credited','refunded')
        AND document_type NOT IN ('credit_note','debit_note'))<>1 THEN
    RAISE EXCEPTION 'Job does not have exactly one active invoice';
  END IF;
END $$;

SELECT 'replacement invoice after cancellation smoke test passed' AS verification;
ROLLBACK;