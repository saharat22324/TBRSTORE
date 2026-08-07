-- TBR System: support controlled backdated invoice dates for administrators.
-- Keeps created_at as the immutable system-entry timestamp.
-- Apply after 20260818_stock_requisition_billing_idempotency.sql.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

UPDATE invoices
SET invoice_date=created_at::DATE
WHERE invoice_date IS NULL;

ALTER TABLE invoices
  ALTER COLUMN invoice_date SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE,
  ALTER COLUMN invoice_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

CREATE OR REPLACE FUNCTION enforce_invoice_document_date()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_today DATE:=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.invoice_date IS DISTINCT FROM OLD.invoice_date
       OR NEW.backdate_reason IS DISTINCT FROM OLD.backdate_reason THEN
      RAISE EXCEPTION 'Invoice date and backdate reason are immutable after issue';
    END IF;
  END IF;
  IF NEW.invoice_date>v_today THEN RAISE EXCEPTION 'Invoice date cannot be in the future'; END IF;
  IF NEW.invoice_date<v_today THEN
    IF current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can create a backdated invoice'; END IF;
    IF NULLIF(BTRIM(NEW.backdate_reason),'') IS NULL THEN RAISE EXCEPTION 'Backdate reason is required'; END IF;
  ELSE
    NEW.backdate_reason:=NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_document_date ON invoices;
CREATE TRIGGER trg_enforce_invoice_document_date
BEFORE INSERT OR UPDATE OF invoice_date,backdate_reason ON invoices
FOR EACH ROW EXECUTE FUNCTION enforce_invoice_document_date();

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
  v_today DATE:=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE;
  v_invoice_date DATE:=COALESCE(NULLIF(p_invoice->>'invoice_date','')::DATE,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE);
  v_backdate_reason TEXT:=NULLIF(BTRIM(p_invoice->>'backdate_reason'),'');
  v_invoice_number TEXT:=NULLIF(BTRIM(p_invoice->>'invoice_number'),'');
  v_sequence INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Invoice requires at least one item'; END IF;
  IF v_invoice_date>v_today THEN RAISE EXCEPTION 'Invoice date cannot be in the future'; END IF;
  IF v_invoice_date<v_today THEN
    IF current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can create a backdated invoice'; END IF;
    IF v_backdate_reason IS NULL THEN RAISE EXCEPTION 'Backdate reason is required'; END IF;
  ELSE
    v_backdate_reason:=NULL;
  END IF;
  IF NULLIF(p_invoice->>'job_id','') IS NOT NULL THEN
    PERFORM 1 FROM jobs WHERE id=(p_invoice->>'job_id')::UUID FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  END IF;

  IF v_invoice_number IS NULL THEN
    IF v_invoice_date=v_today THEN RAISE EXCEPTION 'Invoice number is required'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('invoice-number:'||v_invoice_date::TEXT,0));
    SELECT COALESCE(MAX(NULLIF(SUBSTRING(invoice_number FROM '([0-9]+)$'), '')::INTEGER),0)+1
    INTO v_sequence
    FROM invoices
    WHERE invoice_number LIKE 'INV-'||TO_CHAR(v_invoice_date,'YYYYMMDD')||'-%';
    v_invoice_number:='INV-'||TO_CHAR(v_invoice_date,'YYYYMMDD')||'-'||LPAD(v_sequence::TEXT,3,'0');
  END IF;

  INSERT INTO invoices(invoice_number,invoice_date,backdate_reason,job_id,customer_id,vehicle_id,customer_name,plate,phone,car_model,
    subtotal,discount,vat,grand_total,note,created_by,status,document_type,invoice_type)
  VALUES(v_invoice_number,v_invoice_date,v_backdate_reason,NULLIF(p_invoice->>'job_id','')::UUID,NULLIF(p_invoice->>'customer_id','')::UUID,
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
        VALUES(v_stock.id,'out',v_deducted_qty,'invoice',v_invoice.id,
          'ออกตามบิล '||v_invoice.invoice_number||' วันที่เอกสาร '||TO_CHAR(v_invoice.invoice_date,'YYYY-MM-DD'),auth.uid());
      END IF;
    END IF;
    INSERT INTO invoice_items(invoice_id,item_type,stock_item_id,service_id,description,quantity,stock_deducted_qty,unit_price,cost_price,total,note)
    VALUES(v_invoice.id,COALESCE(NULLIF(v_item->>'item_type',''),'service'),NULLIF(v_item->>'stock_item_id','')::UUID,
      NULLIF(v_item->>'service_id','')::UUID,COALESCE(v_item->>'description',''),v_qty,v_deducted_qty,
      COALESCE((v_item->>'unit_price')::DECIMAL,0),CASE WHEN v_stock.id IS NOT NULL THEN v_stock.cost_price ELSE COALESCE((v_item->>'cost_price')::DECIMAL,0) END,
      COALESCE((v_item->>'total')::DECIMAL,0),NULLIF(v_item->>'note',''));
  END LOOP;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),CASE WHEN v_invoice_date<v_today THEN 'INVOICE_CREATE_BACKDATED' ELSE 'INVOICE_CREATE' END,
    'invoice',v_invoice.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('grand_total',v_invoice.grand_total,'invoice_date',v_invoice.invoice_date,
      'created_at',v_invoice.created_at,'backdate_reason',v_backdate_reason,'requisition_coverage',v_coverage));
  RETURN v_invoice;
END;
$$;

INSERT INTO schema_migrations(version,description,applied_by)
VALUES('20260819_backdated_invoice_dates','Add controlled invoice dates and admin backdated invoice creation',auth.uid())
ON CONFLICT(version) DO UPDATE SET description=EXCLUDED.description;

COMMIT;
