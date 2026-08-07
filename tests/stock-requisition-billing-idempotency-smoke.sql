-- Transactional smoke test for requisition-backed billing and payment idempotency.
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
  v_stock UUID:=gen_random_uuid();
  v_requisition requisitions;
  v_invoice invoices;
  v_payment_one invoice_payments;
  v_payment_retry invoice_payments;
  v_request_id UUID:=gen_random_uuid();
  v_quantity NUMERIC(12,3);
BEGIN
  INSERT INTO customers(name) VALUES('Stock coverage smoke '||v_suffix) RETURNING id INTO v_customer;
  INSERT INTO vehicles(customer_id,plate,brand,model)
  VALUES(v_customer,'SMK'||v_suffix,'Smoke','Coverage') RETURNING id INTO v_vehicle;
  SELECT * INTO v_job FROM create_job_atomic(
    'SMOKE-COVERAGE-JOB-'||v_suffix,v_vehicle,v_customer,'Coverage smoke',NULL,0,NULL
  );
  INSERT INTO stock_items(id,sku,name,unit,cost_price,sell_price,quantity,reorder_level)
  VALUES(v_stock,'SMOKE-COVERAGE-'||v_suffix,'Coverage smoke item','ลิตร',10,20,10,1);

  SELECT * INTO v_requisition FROM create_requisition_atomic(
    v_job.id,'SMOKE-COVERAGE-REQ-'||v_suffix,
    jsonb_build_array(jsonb_build_object(
      'sid',v_stock::TEXT,'name','Coverage smoke item','unit','ลิตร','qty',2
    )),NULL
  );
  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock;
  IF v_quantity<>8 THEN RAISE EXCEPTION 'Requisition stock mismatch: %',v_quantity; END IF;

  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-COVERAGE-INV-'||v_suffix,'job_id',v_job.id,
      'customer_id',v_customer,'vehicle_id',v_vehicle,'customer_name','Coverage smoke',
      'subtotal',60,'discount',0,'vat',0,'grand_total',60
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','stock','stock_item_id',v_stock,'description','Coverage smoke item',
      'quantity',3,'unit_price',20,'cost_price',10,'total',60
    ))
  );
  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock;
  IF v_quantity<>7 THEN RAISE EXCEPTION 'Invoice deducted requisition quantity twice: %',v_quantity; END IF;
  IF (SELECT stock_deducted_qty FROM invoice_items WHERE invoice_id=v_invoice.id)<>1 THEN
    RAISE EXCEPTION 'Invoice did not record the one-unit incremental deduction';
  END IF;

  BEGIN
    PERFORM delete_requisition_atomic(v_requisition.id);
    RAISE EXCEPTION 'Billed requisition deletion unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Billed requisition deletion unexpectedly succeeded' THEN RAISE; END IF;
  END;

  SELECT * INTO v_payment_one FROM record_invoice_payment(
    v_invoice.id,10,'cash','IDEMPOTENT-REF','first request',v_request_id
  );
  SELECT * INTO v_payment_retry FROM record_invoice_payment(
    v_invoice.id,10,'cash','IDEMPOTENT-REF','first request',v_request_id
  );
  IF v_payment_one.id<>v_payment_retry.id THEN RAISE EXCEPTION 'Payment retry created a second row'; END IF;
  IF (SELECT COUNT(*) FROM invoice_payments WHERE request_id=v_request_id)<>1 THEN
    RAISE EXCEPTION 'Payment request id is not unique';
  END IF;
  PERFORM reverse_invoice_payment(v_payment_one.id,'smoke reversal before cancel');

  PERFORM cancel_invoice_atomic(v_invoice.id,'coverage smoke rollback');
  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock;
  IF v_quantity<>8 THEN RAISE EXCEPTION 'Cancel restored requisition-covered stock: %',v_quantity; END IF;

  PERFORM delete_requisition_atomic(v_requisition.id);
  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock;
  IF v_quantity<>10 THEN RAISE EXCEPTION 'Deleting unlocked requisition did not restore stock: %',v_quantity; END IF;
END $$;

SELECT 'stock requisition billing and payment idempotency smoke tests passed' AS verification;
ROLLBACK;
