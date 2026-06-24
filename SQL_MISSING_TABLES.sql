-- ═══════════════════════════════════════════════════════════════════════════════
-- SQL_MISSING_TABLES.sql
-- ตาราง 3 ตัวที่ยังขาดใน schema migration หลัก:
--   quotes, stock_ledger, app_config
--
-- RUN IN: Supabase SQL Editor (Project: tgtuxvmuapiltmkulvlk)
-- RUN AFTER: SQL_MIGRATION_comprehensive_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLE: quotes (ใบเสนอราคา)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no          VARCHAR(50) UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id  UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  job_id      UUID REFERENCES jobs(id) ON DELETE SET NULL,
  cust_name   VARCHAR(255),
  plate       VARCHAR(50),
  car_model   VARCHAR(255),
  items       JSONB DEFAULT '[]',
  sub         DECIMAL(12,2) DEFAULT 0,
  disc        DECIMAL(12,2) DEFAULT 0,
  vat         DECIMAL(12,2) DEFAULT 0,
  grand       DECIMAL(12,2) DEFAULT 0,
  note        TEXT,
  status      VARCHAR(50) DEFAULT 'draft',
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE quotes IS 'ใบเสนอราคา (Quotations) — S.quotes[]';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLE: stock_ledger (บันทึกรับ/จ่ายสต๊อกรายวัน)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('in','out','adjust','return')),
  qty           DECIMAL(12,3) NOT NULL,
  ref_type      VARCHAR(50),
  ref_id        UUID,
  note          TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_item ON stock_ledger(stock_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ref  ON stock_ledger(ref_type, ref_id);

COMMENT ON TABLE stock_ledger IS 'บันทึกรับ/จ่ายสต๊อกรายวัน (Stock Ledger) — S.stockLedger[]';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLE: app_config (เก็บ shop config + running sequences)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE app_config IS 'ค่า config ระบบ เช่น shop info, running seq — S.shop, S.seq';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Seed app_config ด้วยค่าเริ่มต้น (ข้อมูลร้าน TBR)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO app_config (key, value) VALUES
  ('shop', '{"name":"บริษัท ทีบีอาร์ เพอร์ฟอร์แมนซ์ จำกัด","addr":"1991/192 หมู่บ้านอารียา แมนดารีนา ถนนอ่อนนุช แขวงสวนหลวง เขตสวนหลวง กทม 10250","phone":"065-953-5241","tax":"0105562178451","line":"@topbullrace","note":"ขอบคุณที่ใช้บริการ TBR Performance"}'::jsonb),
  ('seq',  '{"job":1,"inv":1,"qt":1,"po":1,"rq":1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS Policies (ทุกตาราง)
-- ─────────────────────────────────────────────────────────────────────────────

-- quotes: all roles can read, admin/supervisor can modify
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotes_select ON quotes
  FOR SELECT USING (true);

CREATE POLICY quotes_insert ON quotes
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY quotes_update ON quotes
  FOR UPDATE
  USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY quotes_delete ON quotes
  FOR DELETE USING (auth_role() = 'admin');

-- stock_ledger: all roles can read, admin/supervisor can modify
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_ledger_select ON stock_ledger
  FOR SELECT USING (true);

CREATE POLICY stock_ledger_insert ON stock_ledger
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY stock_ledger_update ON stock_ledger
  FOR UPDATE
  USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY stock_ledger_delete ON stock_ledger
  FOR DELETE USING (auth_role() = 'admin');

-- app_config: all roles can read, admin only can modify
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_config_select ON app_config
  FOR SELECT USING (true);

CREATE POLICY app_config_insert ON app_config
  FOR INSERT WITH CHECK (auth_role() = 'admin');

CREATE POLICY app_config_update ON app_config
  FOR UPDATE
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY app_config_delete ON app_config
  FOR DELETE USING (auth_role() = 'admin');
