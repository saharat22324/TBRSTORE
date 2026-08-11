-- Transactional smoke test for requisition-linked invoice quantity locks.
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
BEGIN
  INSERT INTO customers(name) VALUES('Invoice quantity lock '||v_suffix) RETURNING id INTO v_customer;
  INSERT INTO vehicles(customer_id,plate,brand,model)
  VALUES(v_customer,'IQL'||v_suffix,'Smoke','Lock') RETURNING id INTO v_vehicle;
  SELECT * INTO v_job FROM create_job_atomic(
    'SMOKE-INVOICE-LOCK-'||v_suffix,v_vehicle,v_customer,'Invoice lock smoke',NULL,0,NULL
  );
  INSERT INTO stock_items(id,sku,name,unit,cost_price,sell_price,quantity,reorder_level)
  VALUES(v_stock,'SMOKE-IQL-'||v_suffix,'Invoice lock item','ลิตร',10,20,10,1);
  SELECT * INTO v_requisition FROM create_requisition_atomic(
    v_job.id,'SMOKE-IQL-REQ-'||v_suffix,
    jsonb_build_array(jsonb_build_object(
      'sid',v_stock::TEXT,'name','Invoice lock item','unit','ลิตร','qty',2
    )),NULL
  );
  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-IQL-INV-'||v_suffix,'job_id',v_job.id,
      'customer_id',v_customer,'vehicle_id',v_vehicle,'customer_name','Invoice lock smoke',
      'subtotal',40,'discount',0,'vat',0,'grand_total',40
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','stock','stock_item_id',v_stock,'description','Invoice lock item',
      'quantity',2,'unit_price',20,'cost_price',10,'total',40
    ))
  );

  BEGIN
    PERFORM update_invoice_atomic(
      v_invoice.id,
      jsonb_build_object('subtotal',60,'discount',0,'vat',0,'grand_total',60),
      jsonb_build_array(jsonb_build_object(
        'item_type','stock','stock_item_id',v_stock,'description','Invoice lock item',
        'quantity',3,'unit_price',20,'cost_price',10,'total',60
      ))
    );
    RAISE EXCEPTION 'Requisition-linked invoice quantity edit unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Requisition-linked invoice quantity edit unexpectedly succeeded' THEN RAISE; END IF;
  END;
  IF (SELECT quantity FROM invoice_items WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock)<>2
     OR (SELECT quantity FROM stock_items WHERE id=v_stock)<>8 THEN
    RAISE EXCEPTION 'Rejected invoice quantity edit changed invoice or stock';
  END IF;

  PERFORM update_invoice_atomic(
    v_invoice.id,
    jsonb_build_object('subtotal',50,'discount',0,'vat',0,'grand_total',50),
    jsonb_build_array(jsonb_build_object(
      'item_type','stock','stock_item_id',v_stock,'description','Invoice lock item',
      'quantity',2,'unit_price',25,'cost_price',10,'total',50
    ))
  );
  IF (SELECT quantity FROM invoice_items WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock)<>2
     OR (SELECT unit_price FROM invoice_items WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock)<>25
     OR (SELECT grand_total FROM invoices WHERE id=v_invoice.id)<>50
     OR (SELECT quantity FROM stock_items WHERE id=v_stock)<>8 THEN
    RAISE EXCEPTION 'Allowed invoice price edit produced incorrect invoice or stock values';
  END IF;
END $$;

SELECT 'requisition-linked invoice quantity lock smoke test passed' AS verification;
ROLLBACK;