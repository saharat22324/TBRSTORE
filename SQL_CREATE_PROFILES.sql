-- ═══════════════════════════════════════════════════════════════════════════════
-- SQL_CREATE_PROFILES.sql — Step 3: INSERT profiles หลังสร้าง Auth users ครบแล้ว
-- ═══════════════════════════════════════════════════════════════════════════════
-- วิธีใช้:
--   1. สร้าง Auth users ครบ 5 คนใน Supabase Dashboard → Authentication → Users
--      email: admin@tbr.local, porche1@tbr.local, bass1@tbr.local,
--             vit1@tbr.local, mix1@tbr.local
--   2. ดู UUID ของแต่ละคน (คลิก user → copy UUID)
--   3. แทนที่ <UUID_xxx> ด้วย UUID จริง แล้วรัน
-- ═══════════════════════════════════════════════════════════════════════════════

-- ตรวจ UUID ของ Auth users ทั้งหมดที่เพิ่งสร้าง (รันก่อนเพื่อ copy UUID)
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT profiles — แทน <UUID_xxx> ด้วย UUID จริงจาก auth.users
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO profiles (id, full_name, role, email, is_active)
VALUES
  ('<UUID_admin>',   'Admin',  'admin',      'admin@tbr.local',   true),
  ('<UUID_porche1>', 'Porche', 'supervisor', 'porche1@tbr.local', true),
  ('<UUID_bass1>',   'Bass',   'supervisor', 'bass1@tbr.local',   true),
  ('<UUID_vit1>',    'Vit',    'technician', 'vit1@tbr.local',    true),
  ('<UUID_mix1>',    'Mix',    'supervisor', 'mix1@tbr.local',    true)
ON CONFLICT (id) DO UPDATE SET
  full_name  = EXCLUDED.full_name,
  role       = EXCLUDED.role,
  email      = EXCLUDED.email,
  is_active  = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- ยืนยันผล
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id, full_name, role, email, is_active FROM profiles ORDER BY role, full_name;
