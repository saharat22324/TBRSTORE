-- Regression smoke test for payment/edit serialization and atomic stock safety.
-- All writes are rolled back. Run as postgres in Supabase SQL Editor.

BEGIN;
SET LOCAL statement_timeout = '30s';
SELECT set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  v_suffix TEXT := txid_current()::TEXT;
  v_stock_id UUID := gen_random_uuid();
  v_invoice invoices;
  v_duplicate_invoice invoices;
  v_payment_one invoice_payments;
  v_payment_two invoice_payments;
  v_quantity NUMERIC;
  v_item_quantity NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='record_invoice_payment'
      AND pg_get_functiondef(p.oid) ILIKE '%FOR UPDATE%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='update_invoice_atomic'
      AND pg_get_functiondef(p.oid) ILIKE '%FOR UPDATE%'
  ) THEN
    RAISE EXCEPTION 'Payment/edit RPCs must serialize concurrent writes with row locks';
  END IF;

  INSERT INTO stock_items(id,sku,name,unit,cost_price,sell_price,quantity,reorder_level)
  VALUES(v_stock_id,'SMOKE-RACE-'||v_suffix,'Race regression item','ชิ้น',10,20,10,1);

  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-RACE-INV-'||v_suffix,
      'subtotal',20,'discount',0,'vat',0,'grand_total',20,
      'customer_name','Race Regression'
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','stock','stock_item_id',v_stock_id,
      'description','Race item','quantity',1,'unit_price',20,'cost_price',10,'total',20
    ))
  );

  SELECT * INTO v_payment_one FROM record_invoice_payment(v_invoice.id,5,'cash',NULL,'partial one');
  SELECT * INTO v_payment_two FROM record_invoice_payment(v_invoice.id,5,'transfer','RACE-2','partial two');

  BEGIN
    PERFORM update_invoice_atomic(
      v_invoice.id,
      jsonb_build_object('subtotal',40,'discount',0,'vat',0,'grand_total',40),
      jsonb_build_array(jsonb_build_object(
        'item_type','stock','stock_item_id',v_stock_id,
        'description','Race item','quantity',2,'unit_price',20,'cost_price',10,'total',40
      ))
    );
    RAISE EXCEPTION 'Edit unexpectedly succeeded while active payments existed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Edit unexpectedly succeeded while active payments existed' THEN RAISE; END IF;
  END;

  PERFORM reverse_invoice_payment(v_payment_one.id,'reverse first partial payment');
  BEGIN
    PERFORM update_invoice_atomic(
      v_invoice.id,
      jsonb_build_object('subtotal',40,'discount',0,'vat',0,'grand_total',40),
      jsonb_build_array(jsonb_build_object(
        'item_type','stock','stock_item_id',v_stock_id,
        'description','Race item','quantity',2,'unit_price',20,'cost_price',10,'total',40
      ))
    );
    RAISE EXCEPTION 'Edit unexpectedly succeeded while one partial payment remained';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Edit unexpectedly succeeded while one partial payment remained' THEN RAISE; END IF;
  END;

  PERFORM reverse_invoice_payment(v_payment_two.id,'reverse final partial payment');

  BEGIN
    PERFORM update_invoice_atomic(
      v_invoice.id,
      jsonb_build_object('subtotal',2000,'discount',0,'vat',0,'grand_total',2000),
      jsonb_build_array(jsonb_build_object(
        'item_type','stock','stock_item_id',v_stock_id,
        'description','Race item','quantity',100,'unit_price',20,'cost_price',10,'total',2000
      ))
    );
    RAISE EXCEPTION 'Edit unexpectedly succeeded with insufficient stock';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Edit unexpectedly succeeded with insufficient stock' THEN RAISE; END IF;
  END;

  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock_id;
  SELECT quantity INTO v_item_quantity FROM invoice_items WHERE invoice_id=v_invoice.id;
  IF v_quantity<>9 OR v_item_quantity<>1 THEN
    RAISE EXCEPTION 'Failed edit changed stock or invoice items: stock %, item %',v_quantity,v_item_quantity;
  END IF;

  PERFORM update_invoice_atomic(
    v_invoice.id,
    jsonb_build_object('subtotal',40,'discount',0,'vat',0,'grand_total',40),
    jsonb_build_array(jsonb_build_object(
      'item_type','stock','stock_item_id',v_stock_id,
      'description','Race item updated','quantity',2,'unit_price',20,'cost_price',10,'total',40
    ))
  );
  SELECT quantity INTO v_quantity FROM stock_items WHERE id=v_stock_id;
  IF v_quantity<>8 THEN RAISE EXCEPTION 'Edit after final reversal produced stock %, expected 8',v_quantity; END IF;

  SELECT * INTO v_duplicate_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','SMOKE-DUP-PAY-'||v_suffix,
      'subtotal',20,'discount',0,'vat',0,'grand_total',20,
      'customer_name','Duplicate Payment Regression'
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','service','description','Service','quantity',1,'unit_price',20,'cost_price',0,'total',20
    ))
  );
  PERFORM record_invoice_payment(v_duplicate_invoice.id,20,'cash','DUPLICATE-REF','first submit');
  BEGIN
    PERFORM record_invoice_payment(v_duplicate_invoice.id,20,'cash','DUPLICATE-REF','duplicate submit');
    RAISE EXCEPTION 'Duplicate full payment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Duplicate full payment unexpectedly succeeded' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM invoice_payments WHERE invoice_id=v_duplicate_invoice.id AND reversed_at IS NULL)<>1 THEN
    RAISE EXCEPTION 'Duplicate payment guard did not preserve exactly one active payment';
  END IF;
END $$;

SELECT 'accounting and stock race regression smoke tests passed' AS result;
ROLLBACK;
