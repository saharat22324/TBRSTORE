-- TBR System: atomic stock item creation and metadata editing.
-- Apply after 20260806_atomic_stock_operations.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION save_stock_item_atomic(
  p_original_sku TEXT,
  p_sku TEXT,
  p_name TEXT,
  p_unit TEXT,
  p_cost_price NUMERIC,
  p_sell_price NUMERIC,
  p_reorder_level NUMERIC,
  p_initial_quantity NUMERIC DEFAULT 0,
  p_expected_quantity NUMERIC DEFAULT NULL
) RETURNS stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock stock_items;
  v_role TEXT:=current_app_role();
  v_is_create BOOLEAN:=COALESCE(BTRIM(p_original_sku),'')='';
BEGIN
  IF auth.uid() IS NULL OR v_role NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF COALESCE(BTRIM(p_sku),'')='' OR COALESCE(BTRIM(p_name),'')='' THEN RAISE EXCEPTION 'SKU and name are required'; END IF;
  IF p_sell_price IS NULL OR p_sell_price<0 OR p_reorder_level IS NULL OR p_reorder_level<0 THEN RAISE EXCEPTION 'Prices and reorder level must be non-negative'; END IF;

  IF v_is_create THEN
    IF p_initial_quantity IS NULL OR p_initial_quantity<0 OR scale(p_initial_quantity)>3 OR p_initial_quantity>999999999.999 THEN
      RAISE EXCEPTION 'Initial quantity must be non-negative with at most three decimal places';
    END IF;
    INSERT INTO stock_items(sku,name,unit,cost_price,sell_price,quantity,reorder_level,created_at,updated_at)
    VALUES(BTRIM(p_sku),BTRIM(p_name),COALESCE(NULLIF(BTRIM(p_unit),''),'ชิ้น'),
      CASE WHEN v_role='admin' THEN COALESCE(p_cost_price,0) ELSE 0 END,p_sell_price,p_initial_quantity,p_reorder_level,NOW(),NOW())
    RETURNING * INTO v_stock;
    IF p_initial_quantity>0 THEN
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,note,created_by)
      VALUES(v_stock.id,'in',p_initial_quantity,'initial_stock','ยอดเริ่มต้น',auth.uid());
    END IF;
    INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
    VALUES(auth.uid(),'STOCK_ITEM_CREATE','stock_item',v_stock.id::TEXT,v_stock.sku,
      jsonb_build_object('initial_quantity',p_initial_quantity));
  ELSE
    SELECT * INTO v_stock FROM stock_items WHERE sku=p_original_sku FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
    IF p_expected_quantity IS NULL OR v_stock.quantity IS DISTINCT FROM p_expected_quantity THEN
      RAISE EXCEPTION 'Stock changed since it was loaded (expected %, current %)',p_expected_quantity,v_stock.quantity;
    END IF;
    UPDATE stock_items SET
      sku=BTRIM(p_sku),name=BTRIM(p_name),unit=COALESCE(NULLIF(BTRIM(p_unit),''),'ชิ้น'),
      cost_price=CASE WHEN v_role='admin' THEN COALESCE(p_cost_price,cost_price) ELSE cost_price END,
      sell_price=p_sell_price,reorder_level=p_reorder_level,updated_at=NOW()
    WHERE id=v_stock.id RETURNING * INTO v_stock;
    INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
    VALUES(auth.uid(),'STOCK_ITEM_UPDATE','stock_item',v_stock.id::TEXT,v_stock.sku,
      jsonb_build_object('original_sku',p_original_sku,'quantity',v_stock.quantity));
  END IF;
  RETURN v_stock;
END;
$$;

DROP POLICY IF EXISTS prod_stock_insert ON stock_items;
DROP POLICY IF EXISTS prod_stock_update ON stock_items;
DROP POLICY IF EXISTS team_write_stock ON stock_items;
DROP POLICY IF EXISTS team_update_stock ON stock_items;
DROP POLICY IF EXISTS "Admins and supervisors can insert stock" ON stock_items;
DROP POLICY IF EXISTS "Admins and supervisors can update stock" ON stock_items;

REVOKE ALL ON FUNCTION save_stock_item_atomic(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_stock_item_atomic(TEXT,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC) TO authenticated;

COMMIT;
