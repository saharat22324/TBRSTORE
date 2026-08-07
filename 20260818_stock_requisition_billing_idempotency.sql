-- TBR System: prevent requisition-backed invoice stock from being deducted twice.
-- Also adds payment request idempotency for retries and concurrent clients.
-- Apply after 20260817_atomic_shop_expense_lifecycle.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- Existing invoices were created before requisition coverage was tracked. Preserve
-- their current cancellation/edit behavior until a separately reviewed reconciliation.
DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoice_items' AND column_name='stock_deducted_qty'
  ) THEN
    ALTER TABLE invoice_items ADD COLUMN stock_deducted_qty NUMERIC(12,3) NOT NULL DEFAULT 0;
    UPDATE invoice_items SET stock_deducted_qty=quantity WHERE stock_item_id IS NOT NULL;
  END IF;
END;
$$;

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_stock_deducted_qty_check;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_stock_deducted_qty_check
  CHECK (stock_deducted_qty>=0 AND stock_deducted_qty<=quantity);

ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payments_request_id
  ON invoice_payments(request_id) WHERE request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION block_billed_requisition_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job_id UUID:=CASE WHEN TG_OP='DELETE' THEN OLD.job_id ELSE NEW.job_id END;
BEGIN
  PERFORM 1 FROM jobs WHERE id=v_job_id FOR UPDATE;
  IF EXISTS(
    SELECT 1 FROM invoices
    WHERE job_id=v_job_id
      AND status NOT IN ('cancelled','credited','refunded')
      AND document_type NOT IN ('credit_note','debit_note')
  ) THEN
    RAISE EXCEPTION 'Requisitions cannot be changed after the job is invoiced';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_billed_requisition_changes ON requisitions;
CREATE TRIGGER trg_block_billed_requisition_changes
BEFORE INSERT OR UPDATE OR DELETE ON requisitions
FOR EACH ROW EXECUTE FUNCTION block_billed_requisition_changes();

CREATE OR REPLACE FUNCTION create_invoice_atomic(p_invoice JSONB,p_items JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_invoice invoices;
  v_item JSONB;
  v_stock stock_items;
  v_qty NUMERIC(12,3);
  v_req_qty NUMERIC(12,3);
  v_covered_used NUMERIC(12,3);
  v_covered_qty NUMERIC(12,3);
  v_deducted_qty NUMERIC(12,3);
  v_coverage JSONB:='{}'::JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Invoice requires at least one item'; END IF;
  IF NULLIF(p_invoice->>'job_id','') IS NOT NULL THEN
    PERFORM 1 FROM jobs WHERE id=(p_invoice->>'job_id')::UUID FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  END IF;
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
    v_stock:=NULL;
    v_qty:=COALESCE((v_item->>'quantity')::NUMERIC(12,3),0);
    v_deducted_qty:=0;
    IF v_qty<=0 THEN RAISE EXCEPTION 'Item quantity must be positive'; END IF;
    IF NULLIF(v_item->>'stock_item_id','') IS NOT NULL THEN
      SELECT * INTO v_stock FROM stock_items WHERE id=(v_item->>'stock_item_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;

      SELECT COALESCE(SUM((req_item->>'qty')::NUMERIC),0) INTO v_req_qty
      FROM requisitions r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.items,'[]'::JSONB)) req_item
      WHERE r.job_id=v_invoice.job_id
        AND (req_item->>'sid'=v_stock.sku OR req_item->>'sid'=v_stock.id::TEXT);
      v_covered_used:=COALESCE((v_coverage->>v_stock.id::TEXT)::NUMERIC,0);
      v_covered_qty:=LEAST(v_qty,GREATEST(v_req_qty-v_covered_used,0));
      v_deducted_qty:=v_qty-v_covered_qty;
      v_coverage:=jsonb_set(v_coverage,ARRAY[v_stock.id::TEXT],to_jsonb(v_covered_used+v_covered_qty),true);

      IF COALESCE(v_stock.quantity,0)<v_deducted_qty THEN
        RAISE EXCEPTION 'Insufficient stock for % (available %, requested %)',v_stock.sku,v_stock.quantity,v_deducted_qty;
      END IF;
      IF v_deducted_qty>0 THEN
        UPDATE stock_items SET quantity=quantity-v_deducted_qty,updated_at=NOW() WHERE id=v_stock.id;
        INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
        VALUES(v_stock.id,'out',v_deducted_qty,'invoice',v_invoice.id,'ออกตามบิล '||v_invoice.invoice_number,auth.uid());
      END IF;
    END IF;
    INSERT INTO invoice_items(invoice_id,item_type,stock_item_id,service_id,description,quantity,stock_deducted_qty,unit_price,cost_price,total,note)
    VALUES(v_invoice.id,COALESCE(NULLIF(v_item->>'item_type',''),'service'),NULLIF(v_item->>'stock_item_id','')::UUID,
      NULLIF(v_item->>'service_id','')::UUID,COALESCE(v_item->>'description',''),v_qty,v_deducted_qty,
      COALESCE((v_item->>'unit_price')::DECIMAL,0),CASE WHEN v_stock.id IS NOT NULL THEN v_stock.cost_price ELSE COALESCE((v_item->>'cost_price')::DECIMAL,0) END,
      COALESCE((v_item->>'total')::DECIMAL,0),NULLIF(v_item->>'note',''));
  END LOOP;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_CREATE','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('grand_total',v_invoice.grand_total,'requisition_coverage',v_coverage));
  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION update_invoice_atomic(p_invoice_id UUID,p_invoice JSONB,p_items JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_invoice invoices;
  v_old RECORD;
  v_item JSONB;
  v_stock stock_items;
  v_qty NUMERIC(12,3);
  v_req_qty NUMERIC(12,3);
  v_covered_used NUMERIC(12,3);
  v_covered_qty NUMERIC(12,3);
  v_deducted_qty NUMERIC(12,3);
  v_coverage JSONB:='{}'::JSONB;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can edit an issued invoice'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status IN ('cancelled','credited','refunded') OR v_invoice.document_type IN ('credit_note','debit_note') THEN
    RAISE EXCEPTION 'This document cannot be edited';
  END IF;
  IF EXISTS(SELECT 1 FROM invoice_payments WHERE invoice_id=p_invoice_id AND reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Reverse payments before editing this invoice';
  END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Invoice requires items'; END IF;

  FOR v_old IN SELECT stock_item_id,SUM(stock_deducted_qty) qty FROM invoice_items
    WHERE invoice_id=p_invoice_id AND stock_item_id IS NOT NULL GROUP BY stock_item_id
  LOOP
    IF v_old.qty>0 THEN
      UPDATE stock_items SET quantity=quantity+v_old.qty,updated_at=NOW() WHERE id=v_old.stock_item_id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_old.stock_item_id,'in',v_old.qty,'invoice_edit',p_invoice_id,'คืนก่อนแก้ไขบิล '||v_invoice.invoice_number,auth.uid());
    END IF;
  END LOOP;
  DELETE FROM invoice_items WHERE invoice_id=p_invoice_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_stock:=NULL;
    v_qty:=COALESCE((v_item->>'quantity')::NUMERIC(12,3),0);
    v_deducted_qty:=0;
    IF v_qty<=0 THEN RAISE EXCEPTION 'Item quantity must be positive'; END IF;
    IF NULLIF(v_item->>'stock_item_id','') IS NOT NULL THEN
      SELECT * INTO v_stock FROM stock_items WHERE id=(v_item->>'stock_item_id')::UUID FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
      SELECT COALESCE(SUM((req_item->>'qty')::NUMERIC),0) INTO v_req_qty
      FROM requisitions r
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.items,'[]'::JSONB)) req_item
      WHERE r.job_id=v_invoice.job_id
        AND (req_item->>'sid'=v_stock.sku OR req_item->>'sid'=v_stock.id::TEXT);
      v_covered_used:=COALESCE((v_coverage->>v_stock.id::TEXT)::NUMERIC,0);
      v_covered_qty:=LEAST(v_qty,GREATEST(v_req_qty-v_covered_used,0));
      v_deducted_qty:=v_qty-v_covered_qty;
      v_coverage:=jsonb_set(v_coverage,ARRAY[v_stock.id::TEXT],to_jsonb(v_covered_used+v_covered_qty),true);
      IF COALESCE(v_stock.quantity,0)<v_deducted_qty THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
      IF v_deducted_qty>0 THEN
        UPDATE stock_items SET quantity=quantity-v_deducted_qty,updated_at=NOW() WHERE id=v_stock.id;
        INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
        VALUES(v_stock.id,'out',v_deducted_qty,'invoice_edit',p_invoice_id,'ตัดใหม่หลังแก้ไขบิล '||v_invoice.invoice_number,auth.uid());
      END IF;
    END IF;
    INSERT INTO invoice_items(invoice_id,item_type,stock_item_id,service_id,description,quantity,stock_deducted_qty,unit_price,cost_price,total,note)
    VALUES(p_invoice_id,COALESCE(NULLIF(v_item->>'item_type',''),'service'),NULLIF(v_item->>'stock_item_id','')::UUID,
      NULLIF(v_item->>'service_id','')::UUID,COALESCE(v_item->>'description',''),v_qty,v_deducted_qty,
      COALESCE((v_item->>'unit_price')::DECIMAL,0),CASE WHEN v_stock.id IS NOT NULL THEN v_stock.cost_price ELSE COALESCE((v_item->>'cost_price')::DECIMAL,0) END,
      COALESCE((v_item->>'total')::DECIMAL,0),NULLIF(v_item->>'note',''));
  END LOOP;
  UPDATE invoices SET subtotal=COALESCE((p_invoice->>'subtotal')::DECIMAL,0),discount=COALESCE((p_invoice->>'discount')::DECIMAL,0),
    vat=COALESCE((p_invoice->>'vat')::DECIMAL,0),grand_total=COALESCE((p_invoice->>'grand_total')::DECIMAL,0),
    customer_name=NULLIF(p_invoice->>'customer_name',''),plate=NULLIF(p_invoice->>'plate',''),phone=NULLIF(p_invoice->>'phone',''),
    car_model=NULLIF(p_invoice->>'car_model',''),note=NULLIF(p_invoice->>'note',''),version=version+1,updated_at=NOW()
  WHERE id=p_invoice_id RETURNING * INTO v_invoice;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_EDIT','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('version',v_invoice.version,'requisition_coverage',v_coverage));
  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_invoice_atomic(p_invoice_id UUID,p_reason TEXT)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_item RECORD;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can cancel an invoice'; END IF;
  IF COALESCE(BTRIM(p_reason),'')='' THEN RAISE EXCEPTION 'Cancellation reason is required'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status='cancelled' THEN RETURN v_invoice; END IF;
  IF v_invoice.status IN ('credited','refunded') THEN RAISE EXCEPTION 'Adjusted documents cannot be cancelled directly'; END IF;
  IF EXISTS(SELECT 1 FROM invoice_payments WHERE invoice_id=p_invoice_id AND reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Reverse active payments before cancelling the invoice';
  END IF;
  FOR v_item IN SELECT stock_item_id,SUM(stock_deducted_qty) qty FROM invoice_items
    WHERE invoice_id=p_invoice_id AND stock_item_id IS NOT NULL GROUP BY stock_item_id
  LOOP
    IF v_item.qty>0 THEN
      UPDATE stock_items SET quantity=quantity+v_item.qty,updated_at=NOW() WHERE id=v_item.stock_item_id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_item.stock_item_id,'in',v_item.qty,'invoice_cancel',p_invoice_id,'คืนจากยกเลิกบิล '||v_invoice.invoice_number,auth.uid());
    END IF;
  END LOOP;
  UPDATE invoices SET status='cancelled',cancelled_at=NOW(),cancelled_by=auth.uid(),
    cancellation_reason=BTRIM(p_reason),payment_status=FALSE,version=version+1,updated_at=NOW()
  WHERE id=p_invoice_id RETURNING * INTO v_invoice;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'INVOICE_CANCEL','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,jsonb_build_object('reason',p_reason));
  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,p_amount DECIMAL,p_method VARCHAR,p_reference VARCHAR,p_note TEXT,p_request_id UUID
) RETURNS invoice_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_payment invoice_payments; v_paid DECIMAL;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Payment request id is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::TEXT,0));
  SELECT * INTO v_payment FROM invoice_payments WHERE request_id=p_request_id;
  IF FOUND THEN
    IF v_payment.invoice_id<>p_invoice_id OR v_payment.amount<>p_amount OR v_payment.method<>p_method THEN
      RAISE EXCEPTION 'Payment request id was reused with different data';
    END IF;
    RETURN v_payment;
  END IF;
  IF p_amount<=0 OR p_method NOT IN ('cash','transfer','promptpay','card','other') THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_invoice.status IN ('cancelled','credited','refunded') OR v_invoice.document_type='credit_note' THEN
    RAISE EXCEPTION 'Invoice cannot receive payment';
  END IF;
  SELECT * INTO v_payment FROM invoice_payments WHERE request_id=p_request_id;
  IF FOUND THEN RETURN v_payment; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM invoice_payments WHERE invoice_id=p_invoice_id AND reversed_at IS NULL;
  IF v_paid+p_amount>v_invoice.grand_total+0.01 THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
  INSERT INTO invoice_payments(invoice_id,amount,method,reference,received_by,note,request_id)
  VALUES(p_invoice_id,p_amount,p_method,NULLIF(BTRIM(p_reference),''),auth.uid(),NULLIF(BTRIM(p_note),''),p_request_id)
  RETURNING * INTO v_payment;
  v_paid:=v_paid+p_amount;
  UPDATE invoices SET payment_status=(v_paid>=grand_total-0.01),
    status=CASE WHEN v_paid>=grand_total-0.01 THEN 'paid' ELSE 'issued' END,updated_at=NOW()
  WHERE id=p_invoice_id;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'PAYMENT_RECORD','invoice_payment',v_payment.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('amount',p_amount,'method',p_method,'request_id',p_request_id));
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,p_amount DECIMAL,p_method VARCHAR,p_reference VARCHAR DEFAULT NULL,p_note TEXT DEFAULT NULL
) RETURNS invoice_payments
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT record_invoice_payment(p_invoice_id,p_amount,p_method,p_reference,p_note,gen_random_uuid());
$$;

REVOKE ALL ON FUNCTION block_billed_requisition_changes() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION create_invoice_atomic(JSONB,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION update_invoice_atomic(UUID,JSONB,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION cancel_invoice_atomic(UUID,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION record_invoice_payment(UUID,DECIMAL,VARCHAR,VARCHAR,TEXT,UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION record_invoice_payment(UUID,DECIMAL,VARCHAR,VARCHAR,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_invoice_atomic(JSONB,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_invoice_atomic(UUID,JSONB,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_invoice_atomic(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID,DECIMAL,VARCHAR,VARCHAR,TEXT,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID,DECIMAL,VARCHAR,VARCHAR,TEXT) TO authenticated;

INSERT INTO schema_migrations(version,description,applied_by)
VALUES('20260818_stock_requisition_billing_idempotency',
  'Track invoice stock deductions, lock billed requisitions, and make payment retries idempotent',auth.uid())
ON CONFLICT(version) DO UPDATE SET description=EXCLUDED.description;

COMMIT;
