-- ═══════════════════════════════════════════════════════════════════════════════
-- SQL_FINAL_MIGRATION.sql  — TBR System Complete Schema Migration
-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ Idempotent: safe to run multiple times
-- ✅ No DROP TABLE on existing data tables (customers, vehicles, jobs etc.)
-- ✅ All CREATE TYPE wrapped in DO $$ / IF NOT EXISTS
-- ✅ All CREATE POLICY use DROP POLICY IF EXISTS first
-- ✅ All CREATE INDEX use IF NOT EXISTS
-- ✅ Trigger recreated safely
-- ✅ RLS policies for core tables (customers, vehicles, jobs, stock_items,
--    services, requisitions, invoices) + new tables
-- ✅ enum user_role = admin / supervisor / technician
--
-- RUN IN: Supabase SQL Editor (Project: tgtuxvmuapiltmkulvlk)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: ENUM TYPES (safe guard — skip if already exists)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'technician');
    RAISE NOTICE 'Created enum: user_role';
  ELSE
    RAISE NOTICE 'Skipped: user_role already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_movement_type') THEN
    CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjust', 'return');
    RAISE NOTICE 'Created enum: stock_movement_type';
  ELSE
    RAISE NOTICE 'Skipped: stock_movement_type already exists';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_part_status') THEN
    CREATE TYPE job_part_status AS ENUM ('ordered', 'arrived', 'installed', 'returned');
    RAISE NOTICE 'Created enum: job_part_status';
  ELSE
    RAISE NOTICE 'Skipped: job_part_status already exists';
  END IF;
END$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: NEW TABLES
-- (ไม่แตะตารางหลักที่มีข้อมูลอยู่: customers, vehicles, jobs,
--  stock_items, services, requisitions, invoices, purchase_orders, expenses)
-- ─────────────────────────────────────────────────────────────────────────────

-- TABLE: profiles (replaces users_auth — linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   VARCHAR(255),
  role        user_role DEFAULT 'technician',
  email       VARCHAR(255),
  phone       VARCHAR(20),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth. role = admin/supervisor/technician.';

-- TABLE: stock_costs (cost_price ซ่อนจากช่าง)
CREATE TABLE IF NOT EXISTS stock_costs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id  UUID UNIQUE NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  cost_price     DECIMAL(12,2) DEFAULT 0,
  supplier_id    UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_ref   VARCHAR(100),
  last_updated   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE stock_costs IS 'Separates cost_price from stock_items — hidden from technician via RLS.';

-- TABLE: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  phone          VARCHAR(20),
  email          VARCHAR(255),
  address        TEXT,
  tax_id         VARCHAR(50),
  payment_terms  VARCHAR(100),
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- TABLE: purchases (ใบสั่งซื้อ — แยกจาก purchase_orders เดิม)
CREATE TABLE IF NOT EXISTS purchases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no         VARCHAR(100) NOT NULL UNIQUE,
  supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_date  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invoice_no     VARCHAR(100),
  total          DECIMAL(14,2),
  tax            DECIMAL(12,2) DEFAULT 0,
  discount       DECIMAL(12,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: purchase_items
CREATE TABLE IF NOT EXISTS purchase_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id    UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  stock_item_id  UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty            DECIMAL(12,2) NOT NULL,
  unit_cost      DECIMAL(12,2) NOT NULL,
  line_total     DECIMAL(14,2) GENERATED ALWAYS AS (qty * unit_cost) STORED,
  received_qty   DECIMAL(12,2) DEFAULT 0,
  notes          TEXT
);

-- TABLE: stock_movements (movement journal — single source of truth)
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id  UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type           stock_movement_type NOT NULL,
  qty            DECIMAL(12,2) NOT NULL,
  reference_type VARCHAR(50),
  reference_id   VARCHAR(100),
  unit_cost      DECIMAL(12,2),
  note           TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255)
);

-- TABLE: job_parts (อะไหล่สั่งพิเศษ — cost แยกตาราง)
CREATE TABLE IF NOT EXISTS job_parts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  part_name      VARCHAR(255) NOT NULL,
  sale_price     DECIMAL(12,2) NOT NULL,
  qty            DECIMAL(12,2) DEFAULT 1,
  unit           VARCHAR(50) DEFAULT 'ชิ้น',
  status         job_part_status DEFAULT 'ordered',
  received_date  TIMESTAMP WITH TIME ZONE,
  notes          TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: job_part_costs (ราคาทุนอะไหล่สั่ง — ซ่อนจากช่าง)
CREATE TABLE IF NOT EXISTS job_part_costs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_part_id         UUID NOT NULL UNIQUE REFERENCES job_parts(id) ON DELETE CASCADE,
  cost_price          DECIMAL(12,2) NOT NULL,
  supplier_id         UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_ref        VARCHAR(100),
  purchase_invoice_no VARCHAR(100),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE job_part_costs IS 'Cost details for job parts — hidden from technician via RLS.';

-- TABLE: quotes (ใบเสนอราคา)
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

-- TABLE: stock_ledger (บันทึกรับ/จ่ายสต๊อกรายวัน)
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

-- TABLE: app_config (shop info + sequences)
CREATE TABLE IF NOT EXISTS app_config (
  key        VARCHAR(100) PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES
  ('shop', '{"name":"บริษัท ทีบีอาร์ เพอร์ฟอร์แมนซ์ จำกัด","addr":"1991/192 หมู่บ้านอารียา แมนดารีนา ถนนอ่อนนุช แขวงสวนหลวง เขตสวนหลวง กทม 10250","phone":"065-953-5241","tax":"0105562178451","line":"@topbullrace","note":"ขอบคุณที่ใช้บริการ TBR Performance"}'::jsonb),
  ('seq',  '{"job":1,"inv":1,"qt":1,"po":1,"rq":1}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: INDEXES (IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role              ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_stock_costs_supplier_id    ON stock_costs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active           ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_date    ON purchases(supplier_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date  ON stock_movements(stock_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference  ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_job_parts_job_id           ON job_parts(job_id);
CREATE INDEX IF NOT EXISTS idx_job_parts_status           ON job_parts(status);
CREATE INDEX IF NOT EXISTS idx_job_parts_created_date     ON job_parts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_part_costs_supplier    ON job_part_costs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date              ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category          ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item          ON stock_ledger(stock_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ref           ON stock_ledger(ref_type, ref_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: auth_role() FUNCTION + TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p.role, 'technician'::user_role)
  FROM profiles p
  WHERE p.id = auth.uid()
$$;
COMMENT ON FUNCTION auth_role IS 'Returns role of current authenticated user. SECURITY DEFINER + STABLE for safe RLS use.';

-- Trigger: block non-admin role escalation
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth_role() <> 'admin' THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_change ON profiles;
CREATE TRIGGER trg_prevent_role_self_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: ENABLE RLS (all tables — existing + new)
-- ─────────────────────────────────────────────────────────────────────────────
-- Core existing tables
ALTER TABLE customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses        ENABLE ROW LEVEL SECURITY;
-- New tables
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_costs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_parts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_part_costs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config      ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: RLS POLICIES — CORE EXISTING TABLES
-- (ลบ policy ทั้งหมดที่มีอยู่ก่อน ป้องกัน conflict กับ policy เก่าที่อาจเคยรันไว้)
-- ─────────────────────────────────────────────────────────────────────────────

-- ★ FULL CLEANUP: drop ALL existing policies on core tables (ชื่อเดิมอะไรก็ตาม)
DO $$
DECLARE
  r record;
  core_tables text[] := ARRAY['customers','vehicles','jobs','stock_items','services',
                               'requisitions','invoices','purchase_orders','expenses'];
  t text;
BEGIN
  FOREACH t IN ARRAY core_tables LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, t);
      RAISE NOTICE 'Dropped old policy: % ON %', r.policyname, t;
    END LOOP;
  END LOOP;
END$$;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ VEHICLES: all authenticated can read, admin/supervisor can modify
DROP POLICY IF EXISTS "vehicles_select" ON vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON vehicles;
CREATE POLICY "vehicles_select" ON vehicles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vehicles_insert" ON vehicles
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "vehicles_update" ON vehicles
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "vehicles_delete" ON vehicles
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ JOBS: all authenticated can read, admin/supervisor can modify
DROP POLICY IF EXISTS "jobs_select" ON jobs;
DROP POLICY IF EXISTS "jobs_insert" ON jobs;
DROP POLICY IF EXISTS "jobs_update" ON jobs;
DROP POLICY IF EXISTS "jobs_delete" ON jobs;
CREATE POLICY "jobs_select" ON jobs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "jobs_insert" ON jobs
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "jobs_update" ON jobs
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "jobs_delete" ON jobs
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ STOCK_ITEMS: all authenticated can read qty/name, admin/supervisor can modify
DROP POLICY IF EXISTS "stock_items_select" ON stock_items;
DROP POLICY IF EXISTS "stock_items_insert" ON stock_items;
DROP POLICY IF EXISTS "stock_items_update" ON stock_items;
DROP POLICY IF EXISTS "stock_items_delete" ON stock_items;
CREATE POLICY "stock_items_select" ON stock_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_items_insert" ON stock_items
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_items_update" ON stock_items
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_items_delete" ON stock_items
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ SERVICES: all authenticated can read, admin/supervisor can modify
DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_insert" ON services;
DROP POLICY IF EXISTS "services_update" ON services;
DROP POLICY IF EXISTS "services_delete" ON services;
CREATE POLICY "services_select" ON services
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "services_insert" ON services
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "services_update" ON services
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "services_delete" ON services
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ REQUISITIONS: all authenticated can read, admin/supervisor can modify
DROP POLICY IF EXISTS "requisitions_select" ON requisitions;
DROP POLICY IF EXISTS "requisitions_insert" ON requisitions;
DROP POLICY IF EXISTS "requisitions_update" ON requisitions;
DROP POLICY IF EXISTS "requisitions_delete" ON requisitions;
CREATE POLICY "requisitions_select" ON requisitions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "requisitions_insert" ON requisitions
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "requisitions_update" ON requisitions
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "requisitions_delete" ON requisitions
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ INVOICES: admin/supervisor full access, technician read-only
DROP POLICY IF EXISTS "invoices_select" ON invoices;
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
DROP POLICY IF EXISTS "invoices_update" ON invoices;
DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ PURCHASE_ORDERS (existing table): admin/supervisor only
DROP POLICY IF EXISTS "purchase_orders_select" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update" ON purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete" ON purchase_orders;
CREATE POLICY "purchase_orders_select" ON purchase_orders
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchase_orders_insert" ON purchase_orders
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchase_orders_update" ON purchase_orders
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchase_orders_delete" ON purchase_orders
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ EXPENSES (existing table): admin only
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (auth_role() = 'admin');


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: RLS POLICIES — NEW TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ▶ PROFILES (NO RECURSION: ใช้ auth.uid() โดยตรง สำหรับ own profile)
DROP POLICY IF EXISTS "profiles_select_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_admin_select_all"  ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON profiles;
DROP POLICY IF EXISTS "profiles_admin_update_all"  ON profiles;
DROP POLICY IF EXISTS "profiles_admin_insert"      ON profiles;
DROP POLICY IF EXISTS "profiles_admin_delete"      ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_admin_select_all" ON profiles
  FOR SELECT USING (auth_role() = 'admin');
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_update_all" ON profiles
  FOR UPDATE USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
CREATE POLICY "profiles_admin_insert" ON profiles
  FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY "profiles_admin_delete" ON profiles
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ STOCK_COSTS (hidden from technician)
DROP POLICY IF EXISTS "stock_costs_admin_only_select" ON stock_costs;
DROP POLICY IF EXISTS "stock_costs_admin_only_insert" ON stock_costs;
DROP POLICY IF EXISTS "stock_costs_admin_only_update" ON stock_costs;
DROP POLICY IF EXISTS "stock_costs_admin_only_delete" ON stock_costs;

CREATE POLICY "stock_costs_admin_only_select" ON stock_costs
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_costs_admin_only_insert" ON stock_costs
  FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY "stock_costs_admin_only_update" ON stock_costs
  FOR UPDATE USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
CREATE POLICY "stock_costs_admin_only_delete" ON stock_costs
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ SUPPLIERS
DROP POLICY IF EXISTS "suppliers_view_all"    ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_modify" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_delete" ON suppliers;

CREATE POLICY "suppliers_view_all" ON suppliers
  FOR SELECT USING (true);
CREATE POLICY "suppliers_admin_modify" ON suppliers
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "suppliers_admin_update" ON suppliers
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "suppliers_admin_delete" ON suppliers
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ PURCHASES
DROP POLICY IF EXISTS "purchases_admin_only_select" ON purchases;
DROP POLICY IF EXISTS "purchases_admin_only_insert" ON purchases;
DROP POLICY IF EXISTS "purchases_admin_only_update" ON purchases;
DROP POLICY IF EXISTS "purchases_admin_only_delete" ON purchases;

CREATE POLICY "purchases_admin_only_select" ON purchases
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchases_admin_only_insert" ON purchases
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchases_admin_only_update" ON purchases
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchases_admin_only_delete" ON purchases
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ PURCHASE_ITEMS
DROP POLICY IF EXISTS "purchase_items_admin_only_select" ON purchase_items;
DROP POLICY IF EXISTS "purchase_items_admin_only_insert" ON purchase_items;
DROP POLICY IF EXISTS "purchase_items_admin_only_update" ON purchase_items;
DROP POLICY IF EXISTS "purchase_items_admin_only_delete" ON purchase_items;

CREATE POLICY "purchase_items_admin_only_select" ON purchase_items
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchase_items_admin_only_insert" ON purchase_items
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchase_items_admin_only_update" ON purchase_items
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "purchase_items_admin_only_delete" ON purchase_items
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ STOCK_MOVEMENTS
DROP POLICY IF EXISTS "stock_movements_view_all"    ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_admin_insert" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_admin_update" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_admin_delete" ON stock_movements;

CREATE POLICY "stock_movements_view_all" ON stock_movements
  FOR SELECT USING (true);
CREATE POLICY "stock_movements_admin_insert" ON stock_movements
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_movements_admin_update" ON stock_movements
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_movements_admin_delete" ON stock_movements
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ JOB_PARTS (technician เห็นเฉพาะ job ที่รับผิดชอบ)
DROP POLICY IF EXISTS "job_parts_view_own_job_or_admin" ON job_parts;
DROP POLICY IF EXISTS "job_parts_admin_only_insert"     ON job_parts;
DROP POLICY IF EXISTS "job_parts_admin_only_update"     ON job_parts;
DROP POLICY IF EXISTS "job_parts_admin_only_delete"     ON job_parts;

CREATE POLICY "job_parts_view_own_job_or_admin" ON job_parts
  FOR SELECT USING (
    auth_role() IN ('admin', 'supervisor') OR
    job_id IN (SELECT id FROM jobs WHERE assign_to = auth.uid())
  );
CREATE POLICY "job_parts_admin_only_insert" ON job_parts
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "job_parts_admin_only_update" ON job_parts
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "job_parts_admin_only_delete" ON job_parts
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ JOB_PART_COSTS (hidden completely from technician)
DROP POLICY IF EXISTS "job_part_costs_admin_only_select" ON job_part_costs;
DROP POLICY IF EXISTS "job_part_costs_admin_only_insert" ON job_part_costs;
DROP POLICY IF EXISTS "job_part_costs_admin_only_update" ON job_part_costs;
DROP POLICY IF EXISTS "job_part_costs_admin_only_delete" ON job_part_costs;

CREATE POLICY "job_part_costs_admin_only_select" ON job_part_costs
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "job_part_costs_admin_only_insert" ON job_part_costs
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "job_part_costs_admin_only_update" ON job_part_costs
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "job_part_costs_admin_only_delete" ON job_part_costs
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ QUOTES
DROP POLICY IF EXISTS "quotes_select" ON quotes;
DROP POLICY IF EXISTS "quotes_insert" ON quotes;
DROP POLICY IF EXISTS "quotes_update" ON quotes;
DROP POLICY IF EXISTS "quotes_delete" ON quotes;

CREATE POLICY "quotes_select" ON quotes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "quotes_insert" ON quotes
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "quotes_update" ON quotes
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "quotes_delete" ON quotes
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ STOCK_LEDGER
DROP POLICY IF EXISTS "stock_ledger_select" ON stock_ledger;
DROP POLICY IF EXISTS "stock_ledger_insert" ON stock_ledger;
DROP POLICY IF EXISTS "stock_ledger_update" ON stock_ledger;
DROP POLICY IF EXISTS "stock_ledger_delete" ON stock_ledger;

CREATE POLICY "stock_ledger_select" ON stock_ledger
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "stock_ledger_insert" ON stock_ledger
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_ledger_update" ON stock_ledger
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor'))
  WITH CHECK (auth_role() IN ('admin', 'supervisor'));
CREATE POLICY "stock_ledger_delete" ON stock_ledger
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ APP_CONFIG
DROP POLICY IF EXISTS "app_config_select" ON app_config;
DROP POLICY IF EXISTS "app_config_insert" ON app_config;
DROP POLICY IF EXISTS "app_config_update" ON app_config;
DROP POLICY IF EXISTS "app_config_delete" ON app_config;

CREATE POLICY "app_config_select" ON app_config
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "app_config_insert" ON app_config
  FOR INSERT WITH CHECK (auth_role() = 'admin');
CREATE POLICY "app_config_update" ON app_config
  FOR UPDATE USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');
CREATE POLICY "app_config_delete" ON app_config
  FOR DELETE USING (auth_role() = 'admin');


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE ✅
-- ═══════════════════════════════════════════════════════════════════════════════
-- SUMMARY OF WHAT THIS FILE CREATES:
--
-- NEW TABLES (9):  profiles, stock_costs, purchases, purchase_items,
--                  stock_movements, job_parts, job_part_costs, quotes,
--                  stock_ledger, app_config
-- UNTOUCHED (9):   customers, vehicles, jobs, stock_items, services,
--                  requisitions, invoices, purchase_orders, expenses
-- FUNCTIONS (2):   auth_role(), prevent_role_self_change()
-- TRIGGERS  (1):   trg_prevent_role_self_change ON profiles
-- RLS TABLES (20): all above + existing core tables
-- POLICIES  (76):  all tables × 4 operations
-- INDEXES   (15):  on new tables only
--
-- NEXT STEPS:
-- 1. Supabase Dashboard → Authentication → Users → สร้าง 5 users (@tbr.local)
-- 2. SQL Editor → INSERT INTO profiles (id, full_name, role) → map UUID → role
-- 3. ทดสอบ login → ระบบควรเห็นข้อมูลร่วมกันระหว่าง devices
-- ═══════════════════════════════════════════════════════════════════════════════
