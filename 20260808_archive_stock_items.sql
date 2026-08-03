-- TBR System: preserve stock history by archiving instead of deleting items.
-- Apply after 20260807_atomic_stock_item_save.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_stock_items_active_sku ON stock_items(active,sku);

DROP FUNCTION IF EXISTS get_stock_items_secure();
CREATE FUNCTION get_stock_items_secure()
RETURNS TABLE (
  id UUID, sku VARCHAR, name VARCHAR, category_id INTEGER, unit VARCHAR,
  cost_price DECIMAL, sell_price DECIMAL, quantity NUMERIC(12,3), reorder_level INTEGER,
  supplier_id UUID, note TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,s.sku,s.name,s.category_id,s.unit,
    CASE WHEN current_app_role()='admin' THEN s.cost_price ELSE 0 END,
    s.sell_price,s.quantity,s.reorder_level,s.supplier_id,s.note,s.created_at,s.updated_at
  FROM stock_items s
  WHERE s.active
  ORDER BY s.sku;
$$;
REVOKE ALL ON FUNCTION get_stock_items_secure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_stock_items_secure() TO authenticated;

CREATE OR REPLACE FUNCTION archive_stock_item_atomic(p_sku TEXT,p_expected_quantity NUMERIC)
RETURNS stock_items
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_stock stock_items;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_stock FROM stock_items WHERE sku=p_sku AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active stock item not found'; END IF;
  IF p_expected_quantity IS NULL OR v_stock.quantity IS DISTINCT FROM p_expected_quantity THEN
    RAISE EXCEPTION 'Stock changed since it was loaded (expected %, current %)',p_expected_quantity,v_stock.quantity;
  END IF;
  IF v_stock.quantity<>0 THEN RAISE EXCEPTION 'Stock quantity must be zero before archiving'; END IF;
  IF EXISTS (
    SELECT 1 FROM purchase_orders po
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(po.items,'[]'::JSONB)) item
    WHERE po.status='pending' AND item->>'sid'=v_stock.sku
  ) THEN RAISE EXCEPTION 'Stock item is referenced by a pending purchase order'; END IF;

  UPDATE stock_items SET active=FALSE,updated_at=NOW() WHERE id=v_stock.id RETURNING * INTO v_stock;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'STOCK_ITEM_ARCHIVE','stock_item',v_stock.id::TEXT,v_stock.sku,
    jsonb_build_object('quantity',v_stock.quantity));
  RETURN v_stock;
END;
$$;

DROP POLICY IF EXISTS prod_stock_delete ON stock_items;
REVOKE ALL ON FUNCTION archive_stock_item_atomic(TEXT,NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_stock_item_atomic(TEXT,NUMERIC) TO authenticated;

COMMIT;
