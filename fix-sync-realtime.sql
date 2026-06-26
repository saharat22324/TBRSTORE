-- ═══════════════════════════════════════════════════════════════
-- FIX: ข้อมูลไม่ sync ระหว่างผู้ใช้ / Realtime ไม่ทำงาน
-- วิธีรัน: Supabase Dashboard → SQL Editor → วาง SQL นี้ → Run
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PART 1: เปิด Realtime สำหรับทุกตาราง
--   ต้องทำก่อน — ถ้าตารางไม่อยู่ใน publication
--   การ subscribe postgres_changes จะไม่ได้รับ event เลย
-- ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_items;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_items;

-- ─────────────────────────────────────────────────────────────────
-- PART 2: เพิ่ม policies สำหรับ anon role
--   เพราะ: ตอน page load บางครั้ง session ยังโหลดไม่เสร็จ
--   → query วิ่งในฐานะ 'anon' → ถ้าไม่มี anon policy → บล็อก
--   → ข้อมูลไม่ขึ้น หรือ useSupabase = false → บันทึกแค่ localStorage
-- ─────────────────────────────────────────────────────────────────

-- invoices
DROP POLICY IF EXISTS "anon_read_invoices"  ON invoices;
DROP POLICY IF EXISTS "anon_write_invoices" ON invoices;
DROP POLICY IF EXISTS "anon_update_invoices" ON invoices;
CREATE POLICY "anon_read_invoices"   ON invoices FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_invoices"  ON invoices FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_invoices" ON invoices FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- invoice_items
DROP POLICY IF EXISTS "anon_read_invoice_items"   ON invoice_items;
DROP POLICY IF EXISTS "anon_write_invoice_items"  ON invoice_items;
DROP POLICY IF EXISTS "anon_update_invoice_items" ON invoice_items;
CREATE POLICY "anon_read_invoice_items"   ON invoice_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_invoice_items"  ON invoice_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_invoice_items" ON invoice_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- jobs
DROP POLICY IF EXISTS "anon_read_jobs"   ON jobs;
DROP POLICY IF EXISTS "anon_write_jobs"  ON jobs;
DROP POLICY IF EXISTS "anon_update_jobs" ON jobs;
CREATE POLICY "anon_read_jobs"   ON jobs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_jobs"  ON jobs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_jobs" ON jobs FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- customers
DROP POLICY IF EXISTS "anon_read_customers"   ON customers;
DROP POLICY IF EXISTS "anon_write_customers"  ON customers;
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_read_customers"   ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_customers"  ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- vehicles
DROP POLICY IF EXISTS "anon_read_vehicles"   ON vehicles;
DROP POLICY IF EXISTS "anon_write_vehicles"  ON vehicles;
DROP POLICY IF EXISTS "anon_update_vehicles" ON vehicles;
CREATE POLICY "anon_read_vehicles"   ON vehicles FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_vehicles"  ON vehicles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_vehicles" ON vehicles FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- stock_items
DROP POLICY IF EXISTS "anon_read_stock"   ON stock_items;
DROP POLICY IF EXISTS "anon_write_stock"  ON stock_items;
DROP POLICY IF EXISTS "anon_update_stock" ON stock_items;
CREATE POLICY "anon_read_stock"   ON stock_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_stock"  ON stock_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_stock" ON stock_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- profiles (อ่านชื่อคนอื่นได้)
DROP POLICY IF EXISTS "anon_read_profiles" ON profiles;
CREATE POLICY "anon_read_profiles" ON profiles FOR SELECT TO anon USING (true);

-- services
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
    DROP POLICY IF EXISTS "anon_read_services"  ON services;
    DROP POLICY IF EXISTS "anon_write_services" ON services;
    CREATE POLICY "anon_read_services"  ON services FOR SELECT TO anon USING (true);
    CREATE POLICY "anon_write_services" ON services FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_ledger') THEN
    DROP POLICY IF EXISTS "anon_read_ledger"  ON stock_ledger;
    DROP POLICY IF EXISTS "anon_write_ledger" ON stock_ledger;
    CREATE POLICY "anon_read_ledger"  ON stock_ledger FOR SELECT TO anon USING (true);
    CREATE POLICY "anon_write_ledger" ON stock_ledger FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PART 3: ตรวจสอบผล
-- ─────────────────────────────────────────────────────────────────
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('invoices','invoice_items','jobs','customers','vehicles','stock_items','profiles','services')
ORDER BY tablename, cmd, roles;
