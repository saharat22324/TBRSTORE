-- ============================================================
-- FIX SCHEMA MISMATCH (2026-06-27)
-- เพิ่มคอลัมน์ที่แอปใช้แต่ฐานข้อมูลยังไม่มี ทำให้
-- requisitions / quotes / purchase_orders เขียนขึ้นคลาวด์ไม่ได้
-- ทุกคำสั่งเป็นแบบ "เพิ่มเท่านั้น" (ไม่ลบ ไม่แก้ข้อมูลเดิม) ปลอดภัย
-- ============================================================

-- ── requisitions (ใบเบิกอะไหล่) ──
-- แอปส่ง: no (เลขที่ใบเบิก), items (รายการอะไหล่ JSON), job_id (อาจเป็น null)
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS "no"  text;
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE requisitions ALTER COLUMN job_id DROP NOT NULL;

-- ── quotes (ใบเสนอราคา) ──
-- แอปส่ง/อ่าน: phone, ref, converted (สถานะแปลงเป็นบิลแล้ว)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS phone     text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ref       text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted boolean DEFAULT false;

-- ── purchase_orders (ใบสั่งซื้อ) ──
-- แอปส่ง/อ่าน: no, supplier (ชื่อร้านแบบข้อความ), items (JSON), total
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS "no"     text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS items    jsonb DEFAULT '[]'::jsonb;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total    numeric DEFAULT 0;
ALTER TABLE purchase_orders ALTER COLUMN po_number   DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;

-- รีเฟรช schema cache ของ PostgREST ให้รู้จักคอลัมน์ใหม่ทันที
NOTIFY pgrst, 'reload schema';
