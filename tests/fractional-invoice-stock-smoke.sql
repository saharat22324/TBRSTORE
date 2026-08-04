-- Transactional fractional invoice lifecycle test. All writes roll back.
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE v_stock UUID:=gen_random_uuid(); v_invoice invoices; v_qty NUMERIC(12,3);
BEGIN
  INSERT INTO stock_items(id,sku,name,unit,cost_price,sell_price,quantity,reorder_level)
  VALUES(v_stock,'SMOKE-FRACTIONAL-INVOICE','Fractional invoice smoke item','ลิตร',10,20,10,1);
  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object('invoice_number','SMOKE-FRACTIONAL-INVOICE','subtotal',10,'discount',0,'vat',0,'grand_total',10,'customer_name','Smoke Test'),
    jsonb_build_array(jsonb_build_object('item_type','stock','stock_item_id',v_stock,'description','Fractional item','quantity',0.5,'unit_price',20,'total',10))
  );
  SELECT quantity INTO v_qty FROM stock_items WHERE id=v_stock;
  IF v_qty<>9.5 THEN RAISE EXCEPTION 'Fractional create stock mismatch: %',v_qty; END IF;

  PERFORM update_invoice_atomic(v_invoice.id,
    jsonb_build_object('subtotal',15,'discount',0,'vat',0,'grand_total',15,'customer_name','Smoke Test'),
    jsonb_build_array(jsonb_build_object('item_type','stock','stock_item_id',v_stock,'description','Fractional item','quantity',0.75,'unit_price',20,'total',15))
  );
  SELECT quantity INTO v_qty FROM stock_items WHERE id=v_stock;
  IF v_qty<>9.25 THEN RAISE EXCEPTION 'Fractional edit stock mismatch: %',v_qty; END IF;

  PERFORM cancel_invoice_atomic(v_invoice.id,'fractional smoke rollback');
  SELECT quantity INTO v_qty FROM stock_items WHERE id=v_stock;
  IF v_qty<>10 THEN RAISE EXCEPTION 'Fractional cancel stock mismatch: %',v_qty; END IF;
END $$;

SELECT 'fractional invoice create, edit and cancel verified' AS verification;
ROLLBACK;
