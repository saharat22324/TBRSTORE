-- Transactional smoke test for billed requisition and invoice synchronization.
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
  v_payment invoice_payments;
  v_quantity NUMERIC(12,3);
BEGIN
  INSERT INTO customers(name) VALUES('Billed requisition sync '||v_suffix) RETURNING id INTO v_customer;
  INSERT INTO vehicles(customer_id,plate,brand,model)
  VALUES(v_customer,'BRS'||v_suffix,'Smoke','Sync') RETURNING id INTO v_vehicle;
  SELECT * INTO v_job FROM create_job_atomic(
    'SMOKE-BILLED-REQ-'||v_suffix,v_vehicle,v_customer,'Billed sync smoke',NULL,0,NULL
  );
  INSERT INTO stock_items(id,sku,name,unit,cost_price,sell_price,quantity,reorder_level)
  VALUES(v_stock,'SMOKE-BRS-'||v_suffix,'Billed sync item','ลิตร',10,20,10,1);

  SELECT * INTO v_requisition FROM create_requisition_atomic(
    v_job.id,'SMOKE-BRS-REQ-'||v_suffix,
    jsonb_build_array(jsonb_build_object(
      'sid',v_stock::TEXT,'name','Billed sync item','unit','ลิตร','qty',2
    )),NULL
  );
  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-BRS-INV-'||v_suffix,'job_id',v_job.id,
      'customer_id',v_customer,'vehicle_id',v_vehicle,'customer_name','Billed sync smoke',
      'subtotal',60,'discount',0,'vat',0,'grand_total',60
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','stock','stock_item_id',v_stock,'description','Billed sync item',
      'quantity',3,'unit_price',20,'cost_price',10,'total',60
    ))
  );

  PERFORM update_requisition_atomic(
    v_requisition.id,
    jsonb_build_array(jsonb_build_object(
      'sid',v_stock::TEXT,'name','Billed sync item','unit','ลิตร','qty',1
    )),NULL
  );
  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock;
  IF v_quantity<>8 THEN RAISE EXCEPTION 'Synchronized stock mismatch: %',v_quantity; END IF;
  IF (SELECT quantity FROM invoice_items WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock)<>2
     OR (SELECT stock_deducted_qty FROM invoice_items WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock)<>1 THEN
    RAISE EXCEPTION 'Invoice stock line did not follow requisition edit';
  END IF;
  IF (SELECT subtotal FROM invoices WHERE id=v_invoice.id)<>40
     OR (SELECT grand_total FROM invoices WHERE id=v_invoice.id)<>40 THEN
    RAISE EXCEPTION 'Invoice totals did not follow requisition edit';
  END IF;

  SELECT * INTO v_payment FROM record_invoice_payment(
    v_invoice.id,10,'cash','BRS-PAY-'||v_suffix,'payment guard',gen_random_uuid()
  );
  BEGIN
    PERFORM update_requisition_atomic(
      v_requisition.id,
      jsonb_build_array(jsonb_build_object(
        'sid',v_stock::TEXT,'name','Billed sync item','unit','ลิตร','qty',3
      )),NULL
    );
    RAISE EXCEPTION 'Paid billed requisition edit unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Paid billed requisition edit unexpectedly succeeded' THEN RAISE; END IF;
  END;
  IF (SELECT (items->0->>'qty')::NUMERIC FROM requisitions WHERE id=v_requisition.id)<>1
     OR (SELECT quantity FROM invoice_items WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock)<>2
     OR (SELECT quantity FROM stock_items WHERE id=v_stock)<>8 THEN
    RAISE EXCEPTION 'Failed paid edit did not roll back all records';
  END IF;

  PERFORM reverse_invoice_payment(v_payment.id,'rollback smoke payment');
  PERFORM cancel_invoice_atomic(v_invoice.id,'rollback synchronized invoice');
  PERFORM delete_requisition_atomic(v_requisition.id);
  IF (SELECT quantity FROM stock_items WHERE id=v_stock)<>10 THEN
    RAISE EXCEPTION 'Final stock restoration mismatch';
  END IF;
END $$;

SELECT 'billed requisition invoice synchronization smoke test passed' AS verification;
ROLLBACK;