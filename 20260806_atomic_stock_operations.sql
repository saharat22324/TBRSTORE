-- TBR System: atomic manual stock adjustments and purchase-order receiving.
-- Apply after 20260805_fractional_stock_quantities.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE purchase_order_items
  ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::NUMERIC(12,3),
  ALTER COLUMN received_qty TYPE NUMERIC(12,3) USING received_qty::NUMERIC(12,3),
  ALTER COLUMN received_qty SET DEFAULT 0;

CREATE OR REPLACE FUNCTION adjust_stock_atomic(
  p_sku TEXT,
  p_mode TEXT,
  p_quantity NUMERIC,
  p_expected_quantity NUMERIC,
  p_note TEXT DEFAULT NULL
) RETURNS stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock stock_items;
  v_old_quantity NUMERIC;
  v_new_quantity NUMERIC;
  v_ledger_type TEXT;
  v_ledger_quantity NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('in','count') THEN RAISE EXCEPTION 'Invalid stock adjustment mode'; END IF;
  IF p_quantity IS NULL OR p_quantity<0 OR scale(p_quantity)>3 OR p_quantity>999999999.999 THEN RAISE EXCEPTION 'Stock quantity must be non-negative with at most three decimal places'; END IF;
  IF p_mode='in' AND p_quantity=0 THEN RAISE EXCEPTION 'Received quantity must be positive'; END IF;

  SELECT * INTO v_stock FROM stock_items WHERE sku=p_sku FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
  IF v_stock.quantity IS DISTINCT FROM p_expected_quantity THEN
    RAISE EXCEPTION 'Stock changed since it was loaded (expected %, current %)',p_expected_quantity,v_stock.quantity;
  END IF;

  v_old_quantity:=v_stock.quantity;
  IF p_mode='in' THEN
    v_new_quantity:=v_old_quantity+p_quantity;
    v_ledger_type:='in';
    v_ledger_quantity:=p_quantity;
  ELSE
    v_new_quantity:=p_quantity;
    v_ledger_type:='adjust';
    v_ledger_quantity:=ABS(v_new_quantity-v_old_quantity);
  END IF;

  UPDATE stock_items SET quantity=v_new_quantity,updated_at=NOW() WHERE id=v_stock.id RETURNING * INTO v_stock;
  IF v_ledger_quantity>0 THEN
    INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
    VALUES(v_stock.id,v_ledger_type,v_ledger_quantity,'manual_adjustment',NULL,
      COALESCE(NULLIF(BTRIM(p_note),''),CASE WHEN p_mode='count' THEN 'Count '||v_old_quantity||' -> '||v_new_quantity ELSE NULL END),auth.uid());
  END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'STOCK_ADJUST','stock_item',v_stock.id::TEXT,v_stock.sku,
    jsonb_build_object('mode',p_mode,'old_quantity',v_old_quantity,'new_quantity',v_new_quantity,'note',p_note));
  RETURN v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION receive_purchase_order_atomic(
  p_purchase_order_id UUID,
  p_receipts JSONB,
  p_items JSONB,
  p_note TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po purchase_orders;
  v_receipt JSONB;
  v_stock stock_items;
  v_quantity NUMERIC;
  v_expected_quantity NUMERIC;
  v_seen_stock_ids UUID[]:='{}';
  v_updated_stock JSONB:='[]'::JSONB;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF jsonb_array_length(COALESCE(p_receipts,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Purchase order requires received items'; END IF;

  SELECT * INTO v_po FROM purchase_orders WHERE id=p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_po.status<>'pending' THEN RAISE EXCEPTION 'Purchase order is no longer pending'; END IF;

  FOR v_receipt IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
    v_quantity:=COALESCE((v_receipt->>'quantity')::NUMERIC,0);
    IF v_quantity<=0 OR scale(v_quantity)>3 OR v_quantity>999999999.999 THEN RAISE EXCEPTION 'Received quantity must be positive with at most three decimal places'; END IF;
    IF NULLIF(v_receipt->>'sid','') IS NULL THEN CONTINUE; END IF;

    SELECT * INTO v_stock FROM stock_items
    WHERE id::TEXT=v_receipt->>'sid' OR sku=v_receipt->>'sid'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;

    IF NOT (v_stock.id=ANY(v_seen_stock_ids)) THEN
      v_expected_quantity:=(v_receipt->>'expected_quantity')::NUMERIC;
      IF v_expected_quantity IS NULL OR v_stock.quantity IS DISTINCT FROM v_expected_quantity THEN
        RAISE EXCEPTION 'Stock changed since it was loaded for % (expected %, current %)',v_stock.sku,v_expected_quantity,v_stock.quantity;
      END IF;
      v_seen_stock_ids:=array_append(v_seen_stock_ids,v_stock.id);
    END IF;

    UPDATE stock_items SET quantity=quantity+v_quantity,updated_at=NOW() WHERE id=v_stock.id RETURNING * INTO v_stock;
    INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
    VALUES(v_stock.id,'in',v_quantity,'purchase_order',v_po.id,
      'รับตาม PO '||COALESCE(v_po.no,v_po.po_number,v_po.id::TEXT)||CASE WHEN COALESCE(BTRIM(p_note),'')='' THEN '' ELSE ' - '||BTRIM(p_note) END,auth.uid());
    v_updated_stock:=v_updated_stock||jsonb_build_array(jsonb_build_object('sku',v_stock.sku,'quantity',v_stock.quantity));
  END LOOP;

  UPDATE purchase_orders
  SET status='received',received_at=NOW(),items=COALESCE(p_items,'[]'::JSONB),note=COALESCE(NULLIF(BTRIM(p_note),''),note),updated_at=NOW()
  WHERE id=v_po.id RETURNING * INTO v_po;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'PURCHASE_ORDER_RECEIVE','purchase_order',v_po.id::TEXT,COALESCE(v_po.no,v_po.po_number),
    jsonb_build_object('receipts',p_receipts,'note',p_note));
  RETURN jsonb_build_object('purchase_order',to_jsonb(v_po),'stock_items',v_updated_stock);
END;
$$;

REVOKE ALL ON FUNCTION adjust_stock_atomic(TEXT,TEXT,NUMERIC,NUMERIC,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION receive_purchase_order_atomic(UUID,JSONB,JSONB,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION adjust_stock_atomic(TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION receive_purchase_order_atomic(UUID,JSONB,JSONB,TEXT) TO authenticated;

COMMIT;
