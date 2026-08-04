-- TBR System: preserve fractional stock quantities in invoice create/edit.
-- Apply after 20260811_atomic_job_creation.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION create_invoice_atomic(p_invoice JSONB,p_items JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_item JSONB; v_stock stock_items; v_qty NUMERIC(12,3);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Invoice requires at least one item'; END IF;
  INSERT INTO invoices(invoice_number,job_id,customer_id,vehicle_id,customer_name,plate,phone,car_model,
    subtotal,discount,vat,grand_total,note,created_by,status,document_type,invoice_type)
  VALUES(p_invoice->>'invoice_number',NULLIF(p_invoice->>'job_id','')::UUID,NULLIF(p_invoice->>'customer_id','')::UUID,
    NULLIF(p_invoice->>'vehicle_id','')::UUID,NULLIF(p_invoice->>'customer_name',''),NULLIF(p_invoice->>'plate',''),
    NULLIF(p_invoice->>'phone',''),NULLIF(p_invoice->>'car_model',''),COALESCE((p_invoice->>'subtotal')::DECIMAL,0),
    COALESCE((p_invoice->>'discount')::DECIMAL,0),COALESCE((p_invoice->>'vat')::DECIMAL,0),
    COALESCE((p_invoice->>'grand_total')::DECIMAL,0),NULLIF(p_invoice->>'note',''),auth.uid(),'issued',
    COALESCE(NULLIF(p_invoice->>'document_type',''),'invoice'),COALESCE(NULLIF(p_invoice->>'invoice_type',''),'receipt'))
  RETURNING * INTO v_invoice;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_qty:=COALESCE((v_item->>'quantity')::NUMERIC(12,3),0);
    IF v_qty<=0 THEN RAISE EXCEPTION 'Item quantity must be positive'; END IF;
    IF NULLIF(v_item->>'stock_item_id','') IS NOT NULL THEN
      SELECT * INTO v_stock FROM stock_items WHERE id=(v_item->>'stock_item_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
      IF COALESCE(v_stock.quantity,0)<v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for % (available %, requested %)',v_stock.sku,v_stock.quantity,v_qty;
      END IF;
      UPDATE stock_items SET quantity=quantity-v_qty,updated_at=NOW() WHERE id=v_stock.id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock.id,'out',v_qty,'invoice',v_invoice.id,'ออกตามบิล '||v_invoice.invoice_number,auth.uid());
    END IF;
    INSERT INTO invoice_items(invoice_id,item_type,stock_item_id,service_id,description,quantity,unit_price,cost_price,total,note)
    VALUES(v_invoice.id,COALESCE(NULLIF(v_item->>'item_type',''),'service'),NULLIF(v_item->>'stock_item_id','')::UUID,
      NULLIF(v_item->>'service_id','')::UUID,COALESCE(v_item->>'description',''),v_qty,
      COALESCE((v_item->>'unit_price')::DECIMAL,0),CASE WHEN v_stock.id IS NOT NULL THEN v_stock.cost_price ELSE COALESCE((v_item->>'cost_price')::DECIMAL,0) END,
      COALESCE((v_item->>'total')::DECIMAL,0),NULLIF(v_item->>'note',''));
    v_stock:=NULL;
  END LOOP;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_CREATE','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,jsonb_build_object('grand_total',v_invoice.grand_total));
  RETURN v_invoice;
END; $$;

CREATE OR REPLACE FUNCTION update_invoice_atomic(p_invoice_id UUID,p_invoice JSONB,p_items JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_old RECORD; v_item JSONB; v_stock stock_items; v_qty NUMERIC(12,3);
BEGIN
  IF current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can edit an issued invoice'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status IN ('cancelled','credited','refunded') OR v_invoice.document_type IN ('credit_note','debit_note') THEN RAISE EXCEPTION 'This document cannot be edited'; END IF;
  IF EXISTS(SELECT 1 FROM invoice_payments WHERE invoice_id=p_invoice_id AND reversed_at IS NULL) THEN RAISE EXCEPTION 'Reverse payments before editing this invoice'; END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Invoice requires items'; END IF;
  FOR v_old IN SELECT stock_item_id,SUM(quantity) qty FROM invoice_items WHERE invoice_id=p_invoice_id AND stock_item_id IS NOT NULL GROUP BY stock_item_id LOOP
    UPDATE stock_items SET quantity=quantity+v_old.qty,updated_at=NOW() WHERE id=v_old.stock_item_id;
    INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
    VALUES(v_old.stock_item_id,'in',v_old.qty,'invoice_edit',p_invoice_id,'คืนก่อนแก้ไขบิล '||v_invoice.invoice_number,auth.uid());
  END LOOP;
  DELETE FROM invoice_items WHERE invoice_id=p_invoice_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_qty:=COALESCE((v_item->>'quantity')::NUMERIC(12,3),0);
    IF v_qty<=0 THEN RAISE EXCEPTION 'Item quantity must be positive'; END IF;
    IF NULLIF(v_item->>'stock_item_id','') IS NOT NULL THEN
      SELECT * INTO v_stock FROM stock_items WHERE id=(v_item->>'stock_item_id')::UUID FOR UPDATE;
      IF NOT FOUND OR COALESCE(v_stock.quantity,0)<v_qty THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
      UPDATE stock_items SET quantity=quantity-v_qty,updated_at=NOW() WHERE id=v_stock.id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock.id,'out',v_qty,'invoice_edit',p_invoice_id,'ตัดใหม่หลังแก้ไขบิล '||v_invoice.invoice_number,auth.uid());
    END IF;
    INSERT INTO invoice_items(invoice_id,item_type,stock_item_id,service_id,description,quantity,unit_price,cost_price,total,note)
    VALUES(p_invoice_id,COALESCE(NULLIF(v_item->>'item_type',''),'service'),NULLIF(v_item->>'stock_item_id','')::UUID,
      NULLIF(v_item->>'service_id','')::UUID,COALESCE(v_item->>'description',''),v_qty,
      COALESCE((v_item->>'unit_price')::DECIMAL,0),CASE WHEN v_stock.id IS NOT NULL THEN v_stock.cost_price ELSE COALESCE((v_item->>'cost_price')::DECIMAL,0) END,
      COALESCE((v_item->>'total')::DECIMAL,0),NULLIF(v_item->>'note',''));
    v_stock:=NULL;
  END LOOP;
  UPDATE invoices SET subtotal=COALESCE((p_invoice->>'subtotal')::DECIMAL,0),discount=COALESCE((p_invoice->>'discount')::DECIMAL,0),
    vat=COALESCE((p_invoice->>'vat')::DECIMAL,0),grand_total=COALESCE((p_invoice->>'grand_total')::DECIMAL,0),
    customer_name=NULLIF(p_invoice->>'customer_name',''),plate=NULLIF(p_invoice->>'plate',''),phone=NULLIF(p_invoice->>'phone',''),
    car_model=NULLIF(p_invoice->>'car_model',''),note=NULLIF(p_invoice->>'note',''),version=version+1,updated_at=NOW()
  WHERE id=p_invoice_id RETURNING * INTO v_invoice;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_EDIT','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,jsonb_build_object('version',v_invoice.version));
  RETURN v_invoice;
END; $$;

CREATE OR REPLACE FUNCTION cancel_invoice_atomic(p_invoice_id UUID,p_reason TEXT)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_item RECORD;
BEGIN
  IF current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can cancel an invoice'; END IF;
  IF COALESCE(BTRIM(p_reason),'')='' THEN RAISE EXCEPTION 'Cancellation reason is required'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status='cancelled' THEN RETURN v_invoice; END IF;
  IF v_invoice.status IN ('credited','refunded') THEN RAISE EXCEPTION 'Adjusted documents cannot be cancelled directly'; END IF;
  IF EXISTS(SELECT 1 FROM invoice_payments WHERE invoice_id=p_invoice_id AND reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Reverse active payments before cancelling the invoice';
  END IF;
  FOR v_item IN SELECT stock_item_id,SUM(quantity) qty FROM invoice_items
    WHERE invoice_id=p_invoice_id AND stock_item_id IS NOT NULL GROUP BY stock_item_id
  LOOP
    UPDATE stock_items SET quantity=quantity+v_item.qty,updated_at=NOW() WHERE id=v_item.stock_item_id;
    INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
    VALUES(v_item.stock_item_id,'in',v_item.qty,'invoice_cancel',p_invoice_id,'คืนจากยกเลิกบิล '||v_invoice.invoice_number,auth.uid());
  END LOOP;
  UPDATE invoices SET status='cancelled',cancelled_at=NOW(),cancelled_by=auth.uid(),
    cancellation_reason=BTRIM(p_reason),payment_status=FALSE,version=version+1,updated_at=NOW()
  WHERE id=p_invoice_id RETURNING * INTO v_invoice;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_CANCEL','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,jsonb_build_object('reason',p_reason));
  RETURN v_invoice;
END; $$;

REVOKE ALL ON FUNCTION create_invoice_atomic(JSONB,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION update_invoice_atomic(UUID,JSONB,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION cancel_invoice_atomic(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_invoice_atomic(JSONB,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_invoice_atomic(UUID,JSONB,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_invoice_atomic(UUID,TEXT) TO authenticated;
COMMIT;
