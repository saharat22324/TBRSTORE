-- ════════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS POLICIES for TBR Service Center
-- Production Security - Role-Based Access Control
-- ════════════════════════════════════════════════════════════════════════════════

-- First, enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotation_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "requisitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "requisition_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "docs" ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════════
-- USERS TABLE - Admins only
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "Admins can view all users"
  ON "users" FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update users"
  ON "users" FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view themselves"
  ON "users" FOR SELECT
  USING (id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════════
-- CUSTOMERS TABLE - All authenticated users can view, admins/desk can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view customers"
  ON "customers" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and desk staff can insert customers"
  ON "customers" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins and desk staff can update customers"
  ON "customers" FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'front_desk'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins can delete customers"
  ON "customers" FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════════════════════════
-- VEHICLES TABLE - All authenticated users can view, admins/desk can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view vehicles"
  ON "vehicles" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and desk staff can insert vehicles"
  ON "vehicles" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins and desk staff can update vehicles"
  ON "vehicles" FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'front_desk'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins can delete vehicles"
  ON "vehicles" FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════════════════════════
-- JOBS TABLE - All can view, admins/tech can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view jobs"
  ON "jobs" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can insert jobs"
  ON "jobs" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'technician'));

CREATE POLICY "Admins and technicians can update jobs"
  ON "jobs" FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'technician'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'technician'));

-- ════════════════════════════════════════════════════════════════════════════════
-- INVOICES TABLE - All can view, admins/desk can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view invoices"
  ON "invoices" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and desk staff can insert invoices"
  ON "invoices" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins and desk staff can update invoices"
  ON "invoices" FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'front_desk'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins can delete invoices"
  ON "invoices" FOR DELETE
  USING (auth.jwt() ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════════════════════════
-- INVOICE_ITEMS TABLE - All can view, admins/desk can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view invoice items"
  ON "invoice_items" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and desk staff can manage invoice items"
  ON "invoice_items" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

CREATE POLICY "Admins and desk staff can update invoice items"
  ON "invoice_items" FOR UPDATE
  USING (auth.jwt() ->> 'role' IN ('admin', 'front_desk'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'front_desk'));

-- ════════════════════════════════════════════════════════════════════════════════
-- STOCK_ITEMS TABLE - All can view, admins can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view stock items"
  ON "stock_items" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage stock items"
  ON "stock_items" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update stock items"
  ON "stock_items" FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════════════════════════
-- STOCK_TRANSACTIONS TABLE - All can view, anyone can insert
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view stock transactions"
  ON "stock_transactions" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can record transactions"
  ON "stock_transactions" FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════════════════════════
-- SERVICES TABLE - All can view, admins only manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view services"
  ON "services" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage services"
  ON "services" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can update services"
  ON "services" FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════════════════════════
-- SHOP_CONFIG TABLE - All can view, admins only manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view shop config"
  ON "shop_config" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage shop config"
  ON "shop_config" FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════════════════════════
-- QUOTATIONS & REQUISITIONS - All can view, admins/tech can manage
-- ════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "All authenticated users can view quotations"
  ON "quotations" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can manage quotations"
  ON "quotations" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'technician'));

CREATE POLICY "All authenticated users can view requisitions"
  ON "requisitions" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and technicians can manage requisitions"
  ON "requisitions" FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'technician'));

-- ════════════════════════════════════════════════════════════════════════════════
-- NOTES
-- ════════════════════════════════════════════════════════════════════════════════
-- Roles:
--   admin      → Full access (view/create/update/delete everything)
--   technician → Job management, stock transactions
--   front_desk → Customer & invoice management
--
-- To test policies:
--   1. Create users with different roles via Supabase Auth
--   2. Add custom claims to JWT (auth.jwt() ->> 'role')
--   3. Test queries from different roles
-- ════════════════════════════════════════════════════════════════════════════════
