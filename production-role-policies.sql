-- TBR System: production role policies
-- Run AFTER secure-cost-data.sql. Test with admin, supervisor and technician in staging.
-- The team shares operational rows; destructive and administrative actions are restricted.

BEGIN;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Remove every legacy policy on the managed tables. PostgreSQL combines
-- permissive policies with OR, so leaving even one old USING (TRUE) policy
-- would bypass the production rules below. Policies are recreated immediately
-- in this same transaction.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'customers', 'vehicles', 'jobs', 'invoices', 'invoice_items',
        'stock_items', 'requisitions', 'purchase_orders', 'expenses', 'shop_config', 'audit_logs'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- The explicit drops keep this migration readable and idempotent if more
-- policies are added to the intended production set later.
DROP POLICY IF EXISTS team_read_customers ON customers;
DROP POLICY IF EXISTS team_write_customers ON customers;
DROP POLICY IF EXISTS team_update_customers ON customers;
DROP POLICY IF EXISTS team_delete_customers ON customers;
DROP POLICY IF EXISTS "All authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Admins and desk staff can insert customers" ON customers;
DROP POLICY IF EXISTS "Admins and desk staff can update customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON customers;
DROP POLICY IF EXISTS prod_customers_read ON customers;
DROP POLICY IF EXISTS prod_customers_insert ON customers;
DROP POLICY IF EXISTS prod_customers_update ON customers;
DROP POLICY IF EXISTS prod_customers_delete ON customers;
CREATE POLICY prod_customers_read ON customers FOR SELECT TO authenticated USING (TRUE);
-- Customer writes use 20260815_atomic_customer_vehicle_lifecycle.sql RPCs.

DROP POLICY IF EXISTS team_read_vehicles ON vehicles;
DROP POLICY IF EXISTS team_write_vehicles ON vehicles;
DROP POLICY IF EXISTS team_update_vehicles ON vehicles;
DROP POLICY IF EXISTS team_delete_vehicles ON vehicles;
DROP POLICY IF EXISTS "All authenticated users can view vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins and desk staff can insert vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins and desk staff can update vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles" ON vehicles;
DROP POLICY IF EXISTS prod_vehicles_read ON vehicles;
DROP POLICY IF EXISTS prod_vehicles_insert ON vehicles;
DROP POLICY IF EXISTS prod_vehicles_update ON vehicles;
DROP POLICY IF EXISTS prod_vehicles_delete ON vehicles;
CREATE POLICY prod_vehicles_read ON vehicles FOR SELECT TO authenticated USING (TRUE);
-- Vehicle writes use 20260815_atomic_customer_vehicle_lifecycle.sql RPCs.

DROP POLICY IF EXISTS team_read_jobs ON jobs;
DROP POLICY IF EXISTS team_write_jobs ON jobs;
DROP POLICY IF EXISTS team_update_jobs ON jobs;
DROP POLICY IF EXISTS team_delete_jobs ON jobs;
DROP POLICY IF EXISTS "All authenticated users can view jobs" ON jobs;
DROP POLICY IF EXISTS "Admins and technicians can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Admins and technicians can update jobs" ON jobs;
DROP POLICY IF EXISTS prod_jobs_read ON jobs;
DROP POLICY IF EXISTS prod_jobs_insert ON jobs;
DROP POLICY IF EXISTS prod_jobs_update ON jobs;
DROP POLICY IF EXISTS prod_jobs_delete ON jobs;
CREATE POLICY prod_jobs_read ON jobs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY prod_jobs_delete ON jobs FOR DELETE TO authenticated USING (current_app_role() IN ('admin','supervisor'));
-- Job creation, edits, status transitions and image updates use SECURITY DEFINER atomic RPCs.

DROP POLICY IF EXISTS team_read_invoices ON invoices;
DROP POLICY IF EXISTS team_write_invoices ON invoices;
DROP POLICY IF EXISTS team_update_invoices ON invoices;
DROP POLICY IF EXISTS team_delete_invoices ON invoices;
DROP POLICY IF EXISTS "All authenticated users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and desk staff can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and desk staff can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;
DROP POLICY IF EXISTS prod_invoices_read ON invoices;
DROP POLICY IF EXISTS prod_invoices_insert ON invoices;
DROP POLICY IF EXISTS prod_invoices_update ON invoices;
CREATE POLICY prod_invoices_read ON invoices FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY prod_invoices_update ON invoices FOR UPDATE TO authenticated
  USING (current_app_role() = 'admin' AND status <> 'cancelled')
  WITH CHECK (current_app_role() = 'admin' AND status <> 'cancelled');
-- Header creation and cancellation use SECURITY DEFINER atomic RPCs.

DROP POLICY IF EXISTS team_read_invoice_items ON invoice_items;
DROP POLICY IF EXISTS team_write_invoice_items ON invoice_items;
DROP POLICY IF EXISTS team_update_invoice_items ON invoice_items;
DROP POLICY IF EXISTS team_delete_invoice_items ON invoice_items;
DROP POLICY IF EXISTS "All authenticated users can view invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Admins and desk staff can manage invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Admins and desk staff can update invoice items" ON invoice_items;
DROP POLICY IF EXISTS prod_invoice_items_read ON invoice_items;
DROP POLICY IF EXISTS prod_invoice_items_insert ON invoice_items;
DROP POLICY IF EXISTS prod_invoice_items_update ON invoice_items;
DROP POLICY IF EXISTS prod_invoice_items_delete ON invoice_items;
CREATE POLICY prod_invoice_items_read ON invoice_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY prod_invoice_items_insert ON invoice_items FOR INSERT TO authenticated
  WITH CHECK (current_app_role() = 'admin');
CREATE POLICY prod_invoice_items_update ON invoice_items FOR UPDATE TO authenticated
  USING (current_app_role() = 'admin' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.status <> 'cancelled'))
  WITH CHECK (current_app_role() = 'admin');
CREATE POLICY prod_invoice_items_delete ON invoice_items FOR DELETE TO authenticated
  USING (current_app_role() = 'admin' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.status <> 'cancelled'));

DROP POLICY IF EXISTS prod_stock_read ON stock_items;
DROP POLICY IF EXISTS prod_stock_insert ON stock_items;
DROP POLICY IF EXISTS prod_stock_update ON stock_items;
DROP POLICY IF EXISTS prod_stock_delete ON stock_items;
CREATE POLICY prod_stock_read ON stock_items FOR SELECT TO authenticated USING (TRUE);
-- Stock creation, metadata edits, and quantity changes use SECURITY DEFINER atomic RPCs.
-- Stock removal uses archive_stock_item_atomic so historical references remain intact.

DROP POLICY IF EXISTS team_read_req ON requisitions;
DROP POLICY IF EXISTS team_write_req ON requisitions;
DROP POLICY IF EXISTS team_update_req ON requisitions;
DROP POLICY IF EXISTS team_delete_req ON requisitions;
DROP POLICY IF EXISTS prod_requisitions_read ON requisitions;
DROP POLICY IF EXISTS prod_requisitions_insert ON requisitions;
DROP POLICY IF EXISTS prod_requisitions_update ON requisitions;
DROP POLICY IF EXISTS prod_requisitions_delete ON requisitions;
CREATE POLICY prod_requisitions_read ON requisitions FOR SELECT TO authenticated USING (TRUE);
-- Requisition writes use atomic RPCs so stock and ledger changes share a transaction.

CREATE POLICY prod_purchase_orders_read ON purchase_orders FOR SELECT TO authenticated
  USING (current_app_role() IN ('admin','supervisor'));
-- Purchase-order create/receive/cancel operations use SECURITY DEFINER atomic RPCs.

DROP POLICY IF EXISTS team_read_exp ON expenses;
DROP POLICY IF EXISTS team_write_exp ON expenses;
DROP POLICY IF EXISTS team_update_exp ON expenses;
DROP POLICY IF EXISTS team_delete_exp ON expenses;
DROP POLICY IF EXISTS prod_expenses_read ON expenses;
DROP POLICY IF EXISTS prod_expenses_insert ON expenses;
DROP POLICY IF EXISTS prod_expenses_update ON expenses;
DROP POLICY IF EXISTS prod_expenses_delete ON expenses;
CREATE POLICY prod_expenses_read ON expenses FOR SELECT TO authenticated USING (current_app_role() IN ('admin','supervisor'));
CREATE POLICY prod_expenses_insert ON expenses FOR INSERT TO authenticated WITH CHECK (current_app_role() IN ('admin','supervisor'));
CREATE POLICY prod_expenses_update ON expenses FOR UPDATE TO authenticated USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');
CREATE POLICY prod_expenses_delete ON expenses FOR DELETE TO authenticated USING (current_app_role() = 'admin');

DROP POLICY IF EXISTS team_read_shop ON shop_config;
DROP POLICY IF EXISTS team_update_shop ON shop_config;
DROP POLICY IF EXISTS team_write_shop ON shop_config;
DROP POLICY IF EXISTS prod_shop_read ON shop_config;
DROP POLICY IF EXISTS prod_shop_insert ON shop_config;
DROP POLICY IF EXISTS prod_shop_update ON shop_config;
CREATE POLICY prod_shop_read ON shop_config FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY prod_shop_insert ON shop_config FOR INSERT TO authenticated WITH CHECK (current_app_role() = 'admin');
CREATE POLICY prod_shop_update ON shop_config FOR UPDATE TO authenticated USING (current_app_role() = 'admin') WITH CHECK (current_app_role() = 'admin');

DROP POLICY IF EXISTS team_read_audit ON audit_logs;
DROP POLICY IF EXISTS team_write_audit ON audit_logs;
DROP POLICY IF EXISTS prod_audit_read ON audit_logs;
DROP POLICY IF EXISTS prod_audit_insert ON audit_logs;
CREATE POLICY prod_audit_read ON audit_logs FOR SELECT TO authenticated USING (current_app_role() = 'admin');
CREATE POLICY prod_audit_insert ON audit_logs FOR INSERT TO authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
-- No UPDATE or DELETE policy for audit logs.

COMMIT;
