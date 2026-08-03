-- TBR System: atomic purchase-order creation and cancellation.
-- Apply after 20260808_archive_stock_items.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION create_purchase_order_atomic(
  p_no TEXT,p_supplier TEXT,p_items JSONB,p_total NUMERIC,p_note TEXT DEFAULT NULL
) RETURNS purchase_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_po purchase_orders;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF COALESCE(BTRIM(p_no),'')='' OR COALESCE(BTRIM(p_supplier),'')='' THEN RAISE EXCEPTION 'PO number and supplier are required'; END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB))=0 THEN RAISE EXCEPTION 'Purchase order requires items'; END IF;
  IF p_total IS NULL OR p_total<0 THEN RAISE EXCEPTION 'Purchase order total must be non-negative'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(BTRIM(p_no),0));
  IF EXISTS (SELECT 1 FROM purchase_orders WHERE no=BTRIM(p_no) OR po_number=BTRIM(p_no)) THEN RAISE EXCEPTION 'Purchase order number already exists'; END IF;

  INSERT INTO purchase_orders(no,supplier,status,items,total,note,created_by,created_at,updated_at)
  VALUES(BTRIM(p_no),BTRIM(p_supplier),'pending',p_items,p_total,NULLIF(BTRIM(p_note),''),auth.uid(),NOW(),NOW())
  RETURNING * INTO v_po;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'PURCHASE_ORDER_CREATE','purchase_order',v_po.id::TEXT,v_po.no,
    jsonb_build_object('supplier',v_po.supplier,'total',v_po.total));
  RETURN v_po;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_purchase_order_atomic(p_purchase_order_id UUID,p_reason TEXT DEFAULT NULL)
RETURNS purchase_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_po purchase_orders;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_po FROM purchase_orders WHERE id=p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_po.status<>'pending' THEN RAISE EXCEPTION 'Only a pending purchase order can be cancelled'; END IF;

  UPDATE purchase_orders SET status='cancelled',note=CASE
    WHEN COALESCE(BTRIM(p_reason),'')='' THEN note
    ELSE CONCAT_WS(E'\n',note,'ยกเลิก: '||BTRIM(p_reason)) END,updated_at=NOW()
  WHERE id=v_po.id RETURNING * INTO v_po;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'PURCHASE_ORDER_CANCEL','purchase_order',v_po.id::TEXT,COALESCE(v_po.no,v_po.po_number),
    jsonb_build_object('reason',p_reason));
  RETURN v_po;
END;
$$;

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='purchase_orders' AND cmd<>'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.purchase_orders',v_policy.policyname);
  END LOOP;
END $$;
DROP POLICY IF EXISTS team_write_po ON purchase_orders;
DROP POLICY IF EXISTS team_update_po ON purchase_orders;
DROP POLICY IF EXISTS team_delete_po ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON purchase_orders;
DROP POLICY IF EXISTS prod_purchase_orders_insert ON purchase_orders;
DROP POLICY IF EXISTS prod_purchase_orders_update ON purchase_orders;
DROP POLICY IF EXISTS prod_purchase_orders_delete ON purchase_orders;

REVOKE ALL ON FUNCTION create_purchase_order_atomic(TEXT,TEXT,JSONB,NUMERIC,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_purchase_order_atomic(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_purchase_order_atomic(TEXT,TEXT,JSONB,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_purchase_order_atomic(UUID,TEXT) TO authenticated;

COMMIT;
