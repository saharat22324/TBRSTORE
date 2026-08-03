-- TBR System: protect cost prices at database level.
-- Test in staging first. This migration requires the profiles table.

BEGIN;

CREATE OR REPLACE FUNCTION current_app_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role::TEXT FROM profiles WHERE id = auth.uid()), 'technician');
$$;
REVOKE ALL ON FUNCTION current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_app_role() TO authenticated;

-- Stock RPC returns cost only to admin. Other roles receive zero.
CREATE OR REPLACE FUNCTION get_stock_items_secure()
RETURNS TABLE (
  id UUID, sku VARCHAR, name VARCHAR, category_id INTEGER, unit VARCHAR,
  cost_price DECIMAL, sell_price DECIMAL, quantity INTEGER, reorder_level INTEGER,
  supplier_id UUID, note TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.sku, s.name, s.category_id, s.unit,
    CASE WHEN current_app_role() = 'admin' THEN s.cost_price ELSE 0 END,
    s.sell_price, s.quantity, s.reorder_level, s.supplier_id, s.note,
    s.created_at, s.updated_at
  FROM stock_items s
  ORDER BY s.sku;
$$;
REVOKE ALL ON FUNCTION get_stock_items_secure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_stock_items_secure() TO authenticated;

-- Invoice RPC includes nested items and masks item cost for non-admin users.
CREATE OR REPLACE FUNCTION get_invoices_secure()
RETURNS SETOF JSONB
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(i) || jsonb_build_object(
    'invoice_items', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(ii) || jsonb_build_object(
          'cost_price', CASE WHEN current_app_role() = 'admin' THEN ii.cost_price ELSE 0 END
        ) ORDER BY ii.created_at
      )
      FROM invoice_items ii WHERE ii.invoice_id = i.id
    ), '[]'::JSONB),
    'customers', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name) END,
    'vehicles', CASE WHEN v.id IS NULL THEN NULL ELSE jsonb_build_object('plate', v.plate) END
  )
  FROM invoices i
  LEFT JOIN customers c ON c.id = i.customer_id
  LEFT JOIN vehicles v ON v.id = i.vehicle_id
  ORDER BY i.created_at DESC;
$$;
REVOKE ALL ON FUNCTION get_invoices_secure() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_invoices_secure() TO authenticated;

-- Remove direct read access to sensitive columns while keeping normal columns usable.
REVOKE SELECT ON stock_items FROM authenticated;
REVOKE SELECT ON stock_items FROM anon;
GRANT SELECT (
  id, sku, name, category_id, unit, sell_price, quantity, reorder_level,
  supplier_id, note, created_at, updated_at
) ON stock_items TO authenticated;

REVOKE SELECT ON invoice_items FROM authenticated;
REVOKE SELECT ON invoice_items FROM anon;
GRANT SELECT (
  id, invoice_id, item_type, stock_item_id, service_id, description,
  quantity, unit_price, total, note, created_at
) ON invoice_items TO authenticated;

COMMIT;
