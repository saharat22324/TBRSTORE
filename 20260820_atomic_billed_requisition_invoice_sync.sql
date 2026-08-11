-- TBR System: atomically synchronize billed requisition edits with invoices.
-- Apply after 20260819_backdated_invoice_dates.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION block_billed_requisition_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_job_id UUID:=CASE WHEN TG_OP='DELETE' THEN OLD.job_id ELSE NEW.job_id END;
  v_invoice invoices;
  v_stock_id UUID;
  v_template_item invoice_items;
  v_invoice_item_count INTEGER;
  v_distinct_price_count INTEGER;
  v_old_current_qty NUMERIC(12,3);
  v_new_current_qty NUMERIC(12,3);
  v_old_req_qty NUMERIC(12,3);
  v_new_req_qty NUMERIC(12,3);
  v_old_invoice_qty NUMERIC(12,3);
  v_new_invoice_qty NUMERIC(12,3);
  v_old_deducted_qty NUMERIC(12,3);
  v_new_deducted_qty NUMERIC(12,3);
  v_stock_adjustment NUMERIC(12,3);
  v_subtotal NUMERIC(12,2);
BEGIN
  PERFORM 1 FROM jobs WHERE id=v_job_id FOR UPDATE;
  SELECT * INTO v_invoice
  FROM invoices
  WHERE job_id=v_job_id
    AND status NOT IN ('cancelled','credited','refunded')
    AND document_type NOT IN ('credit_note','debit_note')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP<>'UPDATE' THEN
    RAISE EXCEPTION 'Requisitions cannot be added or deleted after the job is invoiced';
  END IF;
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN
    RAISE EXCEPTION 'Only admin can edit a billed requisition';
  END IF;
  IF OLD.job_id IS DISTINCT FROM NEW.job_id THEN
    RAISE EXCEPTION 'A billed requisition cannot be moved to another job';
  END IF;
  IF EXISTS(
    SELECT 1 FROM invoices
    WHERE job_id=v_job_id
      AND status NOT IN ('cancelled','credited','refunded')
      AND document_type NOT IN ('credit_note','debit_note')
      AND id<>v_invoice.id
  ) THEN
    RAISE EXCEPTION 'The job has multiple active invoices';
  END IF;
  IF EXISTS(
    SELECT 1 FROM invoice_payments
    WHERE invoice_id=v_invoice.id AND reversed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Reverse payments before editing this billed requisition';
  END IF;

  FOR v_stock_id IN
    SELECT DISTINCT stock.id
    FROM stock_items stock
    WHERE stock.sku IN (
      SELECT item->>'sid' FROM jsonb_array_elements(COALESCE(OLD.items,'[]'::JSONB)) item
      UNION
      SELECT item->>'sid' FROM jsonb_array_elements(COALESCE(NEW.items,'[]'::JSONB)) item
    ) OR stock.id::TEXT IN (
      SELECT item->>'sid' FROM jsonb_array_elements(COALESCE(OLD.items,'[]'::JSONB)) item
      UNION
      SELECT item->>'sid' FROM jsonb_array_elements(COALESCE(NEW.items,'[]'::JSONB)) item
    )
  LOOP
    PERFORM 1 FROM stock_items WHERE id=v_stock_id FOR UPDATE;

    SELECT COALESCE(SUM((item->>'qty')::NUMERIC),0) INTO v_old_current_qty
    FROM jsonb_array_elements(COALESCE(OLD.items,'[]'::JSONB)) item
    WHERE item->>'sid' IN (v_stock_id::TEXT,(SELECT sku FROM stock_items WHERE id=v_stock_id));

    SELECT COALESCE(SUM((item->>'qty')::NUMERIC),0) INTO v_new_current_qty
    FROM jsonb_array_elements(COALESCE(NEW.items,'[]'::JSONB)) item
    WHERE item->>'sid' IN (v_stock_id::TEXT,(SELECT sku FROM stock_items WHERE id=v_stock_id));

    SELECT COALESCE(SUM((item->>'qty')::NUMERIC),0) INTO v_old_req_qty
    FROM requisitions requisition
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(requisition.items,'[]'::JSONB)) item
    WHERE requisition.job_id=v_job_id
      AND item->>'sid' IN (v_stock_id::TEXT,(SELECT sku FROM stock_items WHERE id=v_stock_id));
    v_new_req_qty:=v_old_req_qty-v_old_current_qty+v_new_current_qty;

    SELECT COUNT(*),COUNT(DISTINCT unit_price),COALESCE(SUM(quantity),0),COALESCE(SUM(stock_deducted_qty),0)
    INTO v_invoice_item_count,v_distinct_price_count,v_old_invoice_qty,v_old_deducted_qty
    FROM invoice_items
    WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock_id;

    IF v_invoice_item_count=0 THEN
      RAISE EXCEPTION 'Invoice % has no matching stock line',v_invoice.invoice_number;
    END IF;
    IF v_distinct_price_count>1 THEN
      RAISE EXCEPTION 'Invoice % has conflicting prices for one stock item',v_invoice.invoice_number;
    END IF;

    SELECT * INTO v_template_item
    FROM invoice_items
    WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock_id
    ORDER BY id
    LIMIT 1
    FOR UPDATE;

    v_new_invoice_qty:=v_old_invoice_qty+(v_new_req_qty-v_old_req_qty);
    IF v_new_invoice_qty<0 THEN RAISE EXCEPTION 'Invoice stock quantity cannot be negative'; END IF;
    v_new_deducted_qty:=GREATEST(v_new_invoice_qty-v_new_req_qty,0);
    v_stock_adjustment:=v_old_deducted_qty-v_new_deducted_qty;

    IF v_stock_adjustment<0 AND (SELECT quantity FROM stock_items WHERE id=v_stock_id)<ABS(v_stock_adjustment) THEN
      RAISE EXCEPTION 'Insufficient stock while synchronizing invoice %',v_invoice.invoice_number;
    END IF;
    IF v_stock_adjustment<>0 THEN
      UPDATE stock_items SET quantity=quantity+v_stock_adjustment,updated_at=NOW() WHERE id=v_stock_id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock_id,CASE WHEN v_stock_adjustment>0 THEN 'in' ELSE 'out' END,ABS(v_stock_adjustment),
        'invoice_requisition_sync',v_invoice.id,'ซิงก์ใบเบิกกับบิล '||v_invoice.invoice_number,auth.uid());
    END IF;

    DELETE FROM invoice_items
    WHERE invoice_id=v_invoice.id AND stock_item_id=v_stock_id AND id<>v_template_item.id;
    IF v_new_invoice_qty=0 THEN
      DELETE FROM invoice_items WHERE id=v_template_item.id;
    ELSE
      UPDATE invoice_items
      SET quantity=v_new_invoice_qty,stock_deducted_qty=v_new_deducted_qty,
        total=ROUND(v_new_invoice_qty*unit_price,2),cost_price=(SELECT cost_price FROM stock_items WHERE id=v_stock_id)
      WHERE id=v_template_item.id;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(total),0) INTO v_subtotal FROM invoice_items WHERE invoice_id=v_invoice.id;
  UPDATE invoices
  SET subtotal=v_subtotal,
    grand_total=ROUND(GREATEST(v_subtotal-COALESCE(discount,0),0)*(1+COALESCE(vat,0)),0),
    version=COALESCE(version,1)+1,updated_at=NOW()
  WHERE id=v_invoice.id RETURNING * INTO v_invoice;

  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'BILLED_REQUISITION_SYNC','invoice',v_invoice.id::TEXT,v_invoice.invoice_number,
    jsonb_build_object('requisition_id',NEW.id,'requisition_no',NEW.no,'subtotal',v_invoice.subtotal,
      'grand_total',v_invoice.grand_total,'version',v_invoice.version));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION block_billed_requisition_changes() FROM PUBLIC,anon;

COMMIT;