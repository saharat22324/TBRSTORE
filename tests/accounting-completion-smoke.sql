-- Transactional smoke test for atomic stock, payments and adjustment notes.
-- All writes are rolled back. Run as postgres in Supabase SQL Editor.

BEGIN;
SET LOCAL statement_timeout = '30s';
SELECT set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  v_stock UUID := gen_random_uuid();
  v_inv invoices;
  v_cancel invoices;
  v_payment invoice_payments;
  v_note invoices;
  v_qty INTEGER;
BEGIN
  INSERT INTO stock_items(id,sku,name,unit,cost_price,sell_price,quantity,reorder_level)
  VALUES(v_stock,'SMOKE-ACCT','Accounting smoke item','ชิ้น',10,20,10,1);

  SELECT * INTO v_inv FROM create_invoice_atomic(
    jsonb_build_object('invoice_number','SMOKE-ACCT-INV','subtotal',40,'discount',0,'vat',0,'grand_total',40,'customer_name','Smoke Test'),
    jsonb_build_array(jsonb_build_object('item_type','stock','stock_item_id',v_stock,'description','Smoke item','quantity',2,'unit_price',20,'cost_price',999,'total',40))
  );
  SELECT quantity INTO v_qty FROM stock_items WHERE id=v_stock;
  IF v_qty<>8 THEN RAISE EXCEPTION 'create did not decrement stock exactly once: %',v_qty; END IF;
  IF (SELECT cost_price FROM invoice_items WHERE invoice_id=v_inv.id)<>10 THEN RAISE EXCEPTION 'database cost was not used'; END IF;

  SELECT * INTO v_payment FROM record_invoice_payment(v_inv.id,15,'cash',NULL,'partial');
  IF (SELECT payment_status FROM invoices WHERE id=v_inv.id) THEN RAISE EXCEPTION 'partial payment marked paid'; END IF;
  PERFORM reverse_invoice_payment(v_payment.id,'smoke reversal');
  IF EXISTS(SELECT 1 FROM invoice_payments WHERE id=v_payment.id AND reversed_at IS NULL) THEN RAISE EXCEPTION 'payment not reversed'; END IF;

  SELECT * INTO v_note FROM create_adjustment_note_atomic(v_inv.id,'credit_note',5,'smoke credit');
  IF v_note.grand_total<>-5 OR v_note.original_invoice_id<>v_inv.id THEN RAISE EXCEPTION 'credit note invalid'; END IF;

  SELECT * INTO v_cancel FROM create_invoice_atomic(
    jsonb_build_object('invoice_number','SMOKE-ACCT-CANCEL','subtotal',20,'discount',0,'vat',0,'grand_total',20,'customer_name','Smoke Test'),
    jsonb_build_array(jsonb_build_object('item_type','stock','stock_item_id',v_stock,'description','Smoke item','quantity',1,'unit_price',20,'total',20))
  );
  PERFORM cancel_invoice_atomic(v_cancel.id,'smoke cancel');
  SELECT quantity INTO v_qty FROM stock_items WHERE id=v_stock;
  IF v_qty<>8 THEN RAISE EXCEPTION 'cancel did not restore stock exactly once: %',v_qty; END IF;
  IF NOT EXISTS(SELECT 1 FROM stock_ledger WHERE ref_id=v_cancel.id AND ref_type='invoice_cancel') THEN RAISE EXCEPTION 'cancel ledger missing'; END IF;
END $$;

SELECT 'accounting completion smoke tests passed' AS result;
ROLLBACK;
