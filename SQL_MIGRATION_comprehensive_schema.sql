-- ═══════════════════════════════════════════════════════════════════════════════
-- TBR SYSTEM — COMPREHENSIVE SCHEMA MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Contains: profiles + roles, stock_movements, suppliers/purchases, 
-- job_parts, expenses, stock_costs, RLS policies
-- 
-- IMPORTANT: Run this AFTER backing up existing data
-- RUN IN: Supabase SQL Editor (Project: tgtuxvmuapiltmkulvlk)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUM: Role Types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'supervisor', 'technician');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENUM: Stock Movement Types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjust', 'return');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENUM: Job Parts Status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE job_part_status AS ENUM ('ordered', 'arrived', 'installed', 'returned');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLE: profiles (replaces users_auth)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  role user_role DEFAULT 'technician',
  email VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth. Replaces custom users_auth table.';
COMMENT ON COLUMN profiles.role IS '3 roles: admin (ผู้จัดการ), supervisor (หัวหน้าช่าง), technician (ช่าง)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABLE: stock_costs (cost_price separated from stock_items)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID UNIQUE NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  cost_price DECIMAL(12, 2) DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_ref VARCHAR(100),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE stock_costs IS 'Separates cost_price from stock_items to support RLS (costs hidden from technician)';
COMMENT ON COLUMN stock_costs.cost_price IS 'Cost per unit for profit calculation (hidden from technicians)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABLE: suppliers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  tax_id VARCHAR(50),
  payment_terms VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE suppliers IS 'Store supplier information for purchases and cost tracking';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TABLE: purchases
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no VARCHAR(100) NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invoice_no VARCHAR(100),
  total DECIMAL(14, 2),
  tax DECIMAL(12, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE purchases IS 'Purchase orders and received goods from suppliers';
COMMENT ON COLUMN purchases.ref_no IS 'PO number or invoice reference (e.g., PO-001, INV-20260624)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TABLE: purchase_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty DECIMAL(12, 2) NOT NULL,
  unit_cost DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(14, 2) GENERATED ALWAYS AS (qty * unit_cost) STORED,
  received_qty DECIMAL(12, 2) DEFAULT 0,
  notes TEXT
);

COMMENT ON TABLE purchase_items IS 'Individual items within a purchase order';
COMMENT ON COLUMN purchase_items.unit_cost IS 'Cost per unit at time of purchase (historical record)';
COMMENT ON COLUMN purchase_items.received_qty IS 'Quantity actually received (may differ from ordered qty)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. TABLE: stock_movements (Movement Journal)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  qty DECIMAL(12, 2) NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(100),
  unit_cost DECIMAL(12, 2),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255)
);

COMMENT ON TABLE stock_movements IS 'Complete journal of all stock movements (in/out/adjust/return). Single source of truth for stock history.';
COMMENT ON COLUMN stock_movements.type IS 'in=purchase, out=requisition, adjust=manual, return=returned goods';
COMMENT ON COLUMN stock_movements.reference_type IS 'Type of reference: purchase_order, requisition, job_card, adjustment';
COMMENT ON COLUMN stock_movements.reference_id IS 'ID of the reference (purchase.id, requisition.id, job.id, etc)';
COMMENT ON COLUMN stock_movements.unit_cost IS 'Cost per unit at time of movement (historical record)';

CREATE INDEX idx_stock_movements_item_date ON stock_movements(stock_item_id, created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. TABLE: job_parts (Job-specific parts not in stock)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  sale_price DECIMAL(12, 2) NOT NULL,
  qty DECIMAL(12, 2) DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'ชิ้น',
  status job_part_status DEFAULT 'ordered',
  received_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE job_parts IS 'Parts ordered for specific jobs (not in stock). Cost information is in separate job_part_costs table.';
COMMENT ON COLUMN job_parts.sale_price IS 'Selling price to customer (calculated as cost * 1.37 or custom markup)';
COMMENT ON COLUMN job_parts.status IS 'ordered=ส่ั่ง, arrived=ถึง, installed=ใส่, returned=คืน';

CREATE INDEX idx_job_parts_job_id ON job_parts(job_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10b. TABLE: job_part_costs (Cost information for job parts — hidden from technician)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_part_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_part_id UUID NOT NULL UNIQUE REFERENCES job_parts(id) ON DELETE CASCADE,
  cost_price DECIMAL(12, 2) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_ref VARCHAR(100),
  purchase_invoice_no VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE job_part_costs IS 'Cost details for job parts (hidden from technician via RLS). Separated from job_parts for column-level security.';
COMMENT ON COLUMN job_part_costs.cost_price IS 'Actual cost per unit (visible only to admin/supervisor)';
COMMENT ON COLUMN job_part_costs.supplier_id IS 'Supplier who provided this part (visible only to admin/supervisor)';

CREATE INDEX idx_job_part_costs_supplier ON job_part_costs(supplier_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. TABLE: expenses (Operating expenses)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  payment_method VARCHAR(50),
  receipt_ref VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE expenses IS 'Operating expenses: rent, salary, utilities, etc. Used to calculate net profit.';
COMMENT ON COLUMN expenses.category IS 'e.g., rent, salary, utilities, insurance, maintenance, other';

CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. FUNCTION: auth_role() - Get current user role
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

COMMENT ON FUNCTION auth_role IS 'Returns role of current authenticated user. Used in RLS policies. SECURITY DEFINER bypasses RLS, STABLE optimizes caching.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 12b. TRIGGER: Prevent non-admin users from changing their own role
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_role_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admin can change role. Non-admin attempting to change role gets rejected.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth_role() <> 'admin' THEN
      RAISE EXCEPTION 'Only administrators can change user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_self_change
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_role_self_change();

COMMENT ON FUNCTION prevent_role_self_change IS 'Prevents non-admin users from escalating their own role (security critical)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. ENABLE RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_part_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- ▶ PROFILES (NO RECURSION - uses auth.uid() directly for own profile check)
-- SELECT own profile — uses auth.uid() NOT auth_role() to avoid infinite recursion
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- SELECT all profiles as admin — safe to use auth_role() here (SECURITY DEFINER bypass)
CREATE POLICY "profiles_admin_select_all" ON profiles
  FOR SELECT USING (auth_role() = 'admin');

-- UPDATE own profile — direct auth.uid() check (trigger blocks role change)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- UPDATE/DELETE all profiles as admin
CREATE POLICY "profiles_admin_update_all" ON profiles
  FOR UPDATE USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "profiles_admin_insert" ON profiles
  FOR INSERT WITH CHECK (auth_role() = 'admin');

CREATE POLICY "profiles_admin_delete" ON profiles
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ STOCK_COSTS (隐藏 cost_price from technician)
CREATE POLICY "stock_costs_admin_only_select" ON stock_costs
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "stock_costs_admin_only_insert" ON stock_costs
  FOR INSERT WITH CHECK (auth_role() = 'admin');

CREATE POLICY "stock_costs_admin_only_update" ON stock_costs
  FOR UPDATE USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "stock_costs_admin_only_delete" ON stock_costs
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ SUPPLIERS (All roles can view, only admin/supervisor can modify)
CREATE POLICY "suppliers_view_all" ON suppliers
  FOR SELECT USING (true);

CREATE POLICY "suppliers_admin_modify" ON suppliers
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "suppliers_admin_update" ON suppliers
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor')) WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "suppliers_admin_delete" ON suppliers
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ PURCHASES (Only admin/supervisor can view and modify)
CREATE POLICY "purchases_admin_only_select" ON purchases
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "purchases_admin_only_insert" ON purchases
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "purchases_admin_only_update" ON purchases
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor')) WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "purchases_admin_only_delete" ON purchases
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ PURCHASE_ITEMS (Only admin/supervisor can view and modify)
CREATE POLICY "purchase_items_admin_only_select" ON purchase_items
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "purchase_items_admin_only_insert" ON purchase_items
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "purchase_items_admin_only_update" ON purchase_items
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor')) WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "purchase_items_admin_only_delete" ON purchase_items
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ STOCK_MOVEMENTS (All can view, only admin/supervisor can insert)
CREATE POLICY "stock_movements_view_all" ON stock_movements
  FOR SELECT USING (true);

CREATE POLICY "stock_movements_admin_insert" ON stock_movements
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "stock_movements_admin_update" ON stock_movements
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor')) WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "stock_movements_admin_delete" ON stock_movements
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ JOB_PARTS (Technician can view own jobs, only admin/supervisor can edit)
CREATE POLICY "job_parts_view_own_job_or_admin" ON job_parts
  FOR SELECT USING (
    auth_role() IN ('admin', 'supervisor') OR
    job_id IN (SELECT id FROM jobs WHERE assign_to = auth.uid())
  );

CREATE POLICY "job_parts_admin_only_insert" ON job_parts
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "job_parts_admin_only_update" ON job_parts
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor')) WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "job_parts_admin_only_delete" ON job_parts
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ JOB_PART_COSTS (Hidden completely from technician)
CREATE POLICY "job_part_costs_admin_only_select" ON job_part_costs
  FOR SELECT USING (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "job_part_costs_admin_only_insert" ON job_part_costs
  FOR INSERT WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "job_part_costs_admin_only_update" ON job_part_costs
  FOR UPDATE USING (auth_role() IN ('admin', 'supervisor')) WITH CHECK (auth_role() IN ('admin', 'supervisor'));

CREATE POLICY "job_part_costs_admin_only_delete" ON job_part_costs
  FOR DELETE USING (auth_role() = 'admin');

-- ▶ EXPENSES (Only admin can view and modify)
CREATE POLICY "expenses_admin_only_select" ON expenses
  FOR SELECT USING (auth_role() = 'admin');

CREATE POLICY "expenses_admin_only_insert" ON expenses
  FOR INSERT WITH CHECK (auth_role() = 'admin');

CREATE POLICY "expenses_admin_only_update" ON expenses
  FOR UPDATE USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

CREATE POLICY "expenses_admin_only_delete" ON expenses
  FOR DELETE USING (auth_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. MIGRATION: Data migration from users_auth to profiles (if needed)
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: This requires manual user creation in Supabase Auth first
-- Use Supabase Dashboard: Authentication → Users → Add user
-- Then run this to link them:

/*
INSERT INTO profiles (id, full_name, role, email, phone, is_active)
SELECT 
  id,
  username,
  CASE role_id
    WHEN 1 THEN 'admin'::user_role
    WHEN 4 THEN 'supervisor'::user_role
    ELSE 'technician'::user_role
  END,
  email,
  phone,
  is_active
FROM users_auth
ON CONFLICT (id) DO NOTHING;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. INDEXES for Performance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_stock_costs_supplier_id ON stock_costs(supplier_id);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);
CREATE INDEX idx_purchases_supplier_date ON purchases(supplier_id, purchase_date DESC);
CREATE INDEX idx_job_parts_status ON job_parts(status);
CREATE INDEX idx_job_parts_created_date ON job_parts(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. COMMENTS & DOCUMENTATION
-- ─────────────────────────────────────────────────────────────────────────────
/*

SCHEMA OVERVIEW:

┌─────────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION & AUTHORIZATION                                      │
├─────────────────────────────────────────────────────────────────────┤
│ • profiles (linked to auth.users via Supabase Auth)                 │
│ • auth_role() function for RLS policies                             │
│ • 3 roles: admin, supervisor, technician                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ STOCK MANAGEMENT (Single Source of Truth)                           │
├─────────────────────────────────────────────────────────────────────┤
│ • stock_movements (complete journal: in/out/adjust/return)          │
│ • stock_costs (cost_price separated, hidden from technician)        │
│ • suppliers (vendor information)                                    │
│ • purchases + purchase_items (PO tracking & receiving)              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ JOB-SPECIFIC PARTS & EXPENSES                                       │
├─────────────────────────────────────────────────────────────────────┤
│ • job_parts (non-stock parts with cost+sale tracking)               │
│ • expenses (operating expenses for net profit calculation)          │
└─────────────────────────────────────────────────────────────────────┘

KEY DESIGN DECISIONS:

1. Cost Price Separation (stock_costs table):
   - RLS can only hide entire rows, not columns
   - Separating cost_price allows hidden table for technicians
   - stock_items.qty remains visible to all (stock balance needed for everyone)

2. Job Parts Cost Tracking:
   - Stores cost_price at time of order (historical record)
   - sale_price computed from cost or custom markup
   - Both stored for profit calculation and audit trail

3. Stock Movements Journal:
   - Single comprehensive source of truth
   - Replaces/complements existing requisitions
   - Supports audit trail, reconciliation, stock analysis
   - reference_type + reference_id = full traceability

4. RLS Policy Matrix:
   ┌─────────────────┬──────────┬────────────┬────────────┐
   │ Table           │ Admin    │ Supervisor │ Technician │
   ├─────────────────┼──────────┼────────────┼────────────┤
   │ profiles        │ CRUD     │ R          │ Own only   │
   │ stock_costs     │ CRUD     │ R          │ ✗          │
   │ suppliers       │ CRUD     │ CRU        │ R          │
   │ purchases       │ CRUD     │ CRU        │ ✗          │
   │ stock_movements │ CRUD     │ CRU        │ R          │
   │ job_parts       │ CRUD     │ CRU        │ Own jobs   │
   │ expenses        │ CRUD     │ ✗          │ ✗          │
   └─────────────────┴──────────┴────────────┴────────────┘

5. Existing Tables (Not Modified):
   - stock_items: qty remains visible (needed for requisition checks)
   - jobs, requisitions: maintain existing structure
   - customers, vehicles, invoices: unchanged
   - Keep canViewCost permission logic as backup UI layer

NEXT STEPS AFTER MIGRATION:

1. Create profiles for existing users via Supabase Auth
2. Update frontend supabaseService.js to use Supabase Auth (signInWithPassword)
3. Update loadAllData() to fetch from new tables
4. Add stock_movements entry when requisition created
5. Add job_parts form to Job Card modal
6. Add expenses entry form to Settings
7. Update profit calculation to include job_parts cost + expenses

*/

-- ═══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════════
