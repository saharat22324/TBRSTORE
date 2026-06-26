-- ═══════════════════════════════════════════════════════════════════
-- FIX: ทำให้ทุก account เห็นยอดเท่ากัน (ข้อมูลร่วมกันทั้งทีม)
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง SQL นี้ → Run
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. ตารางหลักที่ต้องให้ทุกคนในทีมเห็นร่วมกัน
--    → ปิด RLS หรือ อนุญาตให้ authenticated users อ่านได้ทุก row
-- ─────────────────────────────────────────────────────────────────

-- invoices ─── ยอดขาย/บิล (สำคัญที่สุด)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can view invoices"  ON invoices;
DROP POLICY IF EXISTS "Users can view own invoices"               ON invoices;
DROP POLICY IF EXISTS "Invoices viewable by owner"                ON invoices;
DROP POLICY IF EXISTS "authenticated_read_invoices"               ON invoices;
CREATE POLICY "team_read_invoices"
  ON invoices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and desk staff can insert invoices" ON invoices;
DROP POLICY IF EXISTS "team_write_invoices"                       ON invoices;
CREATE POLICY "team_write_invoices"
  ON invoices FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins and desk staff can update invoices" ON invoices;
DROP POLICY IF EXISTS "team_update_invoices"                      ON invoices;
CREATE POLICY "team_update_invoices"
  ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete invoices"                ON invoices;
DROP POLICY IF EXISTS "team_delete_invoices"                      ON invoices;
CREATE POLICY "team_delete_invoices"
  ON invoices FOR DELETE TO authenticated USING (true);

-- invoice_items ─── รายการในบิล
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can view invoice items"     ON invoice_items;
DROP POLICY IF EXISTS "Admins and desk staff can manage invoice items"     ON invoice_items;
DROP POLICY IF EXISTS "Admins and desk staff can update invoice items"     ON invoice_items;
DROP POLICY IF EXISTS "Users can view own invoice items"                    ON invoice_items;
DROP POLICY IF EXISTS "team_read_invoice_items"                             ON invoice_items;
CREATE POLICY "team_read_invoice_items"
  ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_invoice_items"
  ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_invoice_items"
  ON invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_invoice_items"
  ON invoice_items FOR DELETE TO authenticated USING (true);

-- jobs ─── งานซ่อม
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can view jobs"         ON jobs;
DROP POLICY IF EXISTS "Admins and technicians can insert jobs"        ON jobs;
DROP POLICY IF EXISTS "Admins and technicians can update jobs"        ON jobs;
DROP POLICY IF EXISTS "team_read_jobs"                                ON jobs;
CREATE POLICY "team_read_jobs"   ON jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_jobs"  ON jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_jobs" ON jobs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_jobs" ON jobs FOR DELETE TO authenticated USING (true);

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can view customers"    ON customers;
DROP POLICY IF EXISTS "Admins and desk staff can insert customers"    ON customers;
DROP POLICY IF EXISTS "Admins and desk staff can update customers"    ON customers;
DROP POLICY IF EXISTS "Admins can delete customers"                   ON customers;
DROP POLICY IF EXISTS "team_read_customers"                           ON customers;
CREATE POLICY "team_read_customers"   ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_customers"  ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_customers" ON customers FOR DELETE TO authenticated USING (true);

-- vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can view vehicles"     ON vehicles;
DROP POLICY IF EXISTS "Admins and desk staff can insert vehicles"     ON vehicles;
DROP POLICY IF EXISTS "Admins and desk staff can update vehicles"     ON vehicles;
DROP POLICY IF EXISTS "Admins can delete vehicles"                    ON vehicles;
DROP POLICY IF EXISTS "team_read_vehicles"                            ON vehicles;
CREATE POLICY "team_read_vehicles"   ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_vehicles"  ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_vehicles" ON vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_vehicles" ON vehicles FOR DELETE TO authenticated USING (true);

-- stock_items
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All authenticated users can view stock items"  ON stock_items;
DROP POLICY IF EXISTS "Admins can manage stock items"                 ON stock_items;
DROP POLICY IF EXISTS "Admins can update stock items"                 ON stock_items;
DROP POLICY IF EXISTS "team_read_stock"                               ON stock_items;
CREATE POLICY "team_read_stock"   ON stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_stock"  ON stock_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_stock" ON stock_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_stock" ON stock_items FOR DELETE TO authenticated USING (true);

-- stock_ledger / stock_transactions
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_ledger') THEN
    ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "team_read_ledger" ON stock_ledger;
    CREATE POLICY "team_read_ledger"   ON stock_ledger FOR SELECT TO authenticated USING (true);
    CREATE POLICY "team_write_ledger"  ON stock_ledger FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "team_update_ledger" ON stock_ledger FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_transactions') THEN
    ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "team_read_strans" ON stock_transactions;
    CREATE POLICY "team_read_strans"  ON stock_transactions FOR SELECT TO authenticated USING (true);
    CREATE POLICY "team_write_strans" ON stock_transactions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- profiles (อ่านได้ทุกคน เพื่อแสดงชื่อ)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "team_read_profiles"                ON profiles;
CREATE POLICY "team_read_profiles"   ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_update_profiles" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- services
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
    ALTER TABLE services ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "team_read_services" ON services;
    CREATE POLICY "team_read_services"  ON services FOR SELECT TO authenticated USING (true);
    CREATE POLICY "team_write_services" ON services FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "team_update_services" ON services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. ตารางที่เหลือ (expenses, quotes, purchase_orders, shop_config, audit_logs, requisitions)
-- ─────────────────────────────────────────────────────────────────

-- requisitions ─── ใบเบิก
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_read_req"    ON requisitions;
DROP POLICY IF EXISTS "team_write_req"   ON requisitions;
DROP POLICY IF EXISTS "team_update_req"  ON requisitions;
DROP POLICY IF EXISTS "team_delete_req"  ON requisitions;
CREATE POLICY "team_read_req"   ON requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_req"  ON requisitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_req" ON requisitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_req" ON requisitions FOR DELETE TO authenticated USING (true);

-- expenses ─── รายจ่าย
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_read_exp"   ON expenses;
DROP POLICY IF EXISTS "team_write_exp"  ON expenses;
DROP POLICY IF EXISTS "team_update_exp" ON expenses;
DROP POLICY IF EXISTS "team_delete_exp" ON expenses;
CREATE POLICY "team_read_exp"   ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_exp"  ON expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_exp" ON expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_exp" ON expenses FOR DELETE TO authenticated USING (true);

-- quotes ─── ใบเสนอราคา
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_read_qt"   ON quotes;
DROP POLICY IF EXISTS "team_write_qt"  ON quotes;
DROP POLICY IF EXISTS "team_update_qt" ON quotes;
DROP POLICY IF EXISTS "team_delete_qt" ON quotes;
CREATE POLICY "team_read_qt"   ON quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_qt"  ON quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_qt" ON quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_qt" ON quotes FOR DELETE TO authenticated USING (true);

-- purchase_orders ─── ใบสั่งซื้อ
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_read_po"   ON purchase_orders;
DROP POLICY IF EXISTS "team_write_po"  ON purchase_orders;
DROP POLICY IF EXISTS "team_update_po" ON purchase_orders;
DROP POLICY IF EXISTS "team_delete_po" ON purchase_orders;
CREATE POLICY "team_read_po"   ON purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_write_po"  ON purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_update_po" ON purchase_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team_delete_po" ON purchase_orders FOR DELETE TO authenticated USING (true);

-- shop_config ─── ตั้งค่าร้าน
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shop_config') THEN
    ALTER TABLE shop_config ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "team_read_shop"   ON shop_config;
    DROP POLICY IF EXISTS "team_update_shop" ON shop_config;
    CREATE POLICY "team_read_shop"   ON shop_config FOR SELECT TO authenticated USING (true);
    CREATE POLICY "team_update_shop" ON shop_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "team_write_shop"  ON shop_config FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- audit_logs ─── ประวัติการแก้ไข
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "team_read_audit"  ON audit_logs;
    DROP POLICY IF EXISTS "team_write_audit" ON audit_logs;
    CREATE POLICY "team_read_audit"  ON audit_logs FOR SELECT TO authenticated USING (true);
    CREATE POLICY "team_write_audit" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 3. เปิด Realtime สำหรับตารางสำคัญ (ถ้ายังไม่ได้เปิด)
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Enable Realtime publication for core tables
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'invoices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stock_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'requisitions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE requisitions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quotes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE quotes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'purchase_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 4. ยืนยันผล
-- ─────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'invoices','invoice_items','jobs','customers','vehicles',
  'stock_items','profiles','requisitions','expenses','quotes','purchase_orders'
)
ORDER BY tablename, cmd;

SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
