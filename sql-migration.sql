/* ============================================================
   SUPABASE DATABASE SCHEMA — SQL MIGRATION
   ============================================================
   Run this SQL in Supabase SQL Editor to create the schema
   
   Steps:
   1. Go to https://app.supabase.com
   2. Select your project
   3. Go to SQL Editor
   4. Click "New Query"
   5. Copy and paste this entire file
   6. Click "Run"
   7. Wait for completion (should show green checkmark)
   ============================================================ */

-- ============================================================
-- 1. ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator - Full access to all features'),
  ('technician', 'Technician - Can create jobs, manage stock, view related data'),
  ('front_desk', 'Front Desk - Can add customers, manage bookings, create invoices')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  role_id INTEGER REFERENCES roles(id),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. SHOP CONFIGURATION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS shop_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'TBR Service Center',
  address TEXT,
  phone VARCHAR(20),
  tax_id VARCHAR(50),
  line_id VARCHAR(100),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default shop config
INSERT INTO shop_config (name, address, phone, tax_id, line_id, note) VALUES
  (
    'บริษัท ทีบีอาร์ เพอร์ฟอร์แมนซ์ จำกัด',
    '1991/192 หมู่บ้านอารียา แมนดารีนา ถนนอ่อนนุช แขวงสวนหลวง เขตสวนหลวง กทม 10250',
    '065-953-5241',
    '0105562178451',
    '@topbullrace',
    'ขอบคุณที่ใช้บริการ TBR Performance'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. CUSTOMERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  line_id VARCHAR(100),
  address TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_created_by ON customers(created_by);
CREATE INDEX idx_customers_name ON customers(name);

-- ============================================================
-- 5. VEHICLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plate VARCHAR(20) UNIQUE NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),
  mileage INTEGER,
  engine_number VARCHAR(50),
  chassis_number VARCHAR(50),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_plate ON vehicles(plate);
CREATE INDEX idx_vehicles_created_by ON vehicles(created_by);

-- ============================================================
-- 6. JOB STATUS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS job_statuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  color VARCHAR(20),
  dot_color VARCHAR(20),
  description TEXT
);

INSERT INTO job_statuses (name, color, dot_color, description) VALUES
  ('เปิดงาน', 'teal', '#28C2C9', 'Job opened'),
  ('ตรวจสอบ', 'warn', '#EEA61C', 'Under inspection'),
  ('รออนุมัติ', 'purple', '#9b59b6', 'Waiting for approval'),
  ('กำลังซ่อม', 'gold', '#EEA61C', 'In progress'),
  ('รอส่งมอบ', 'grn', '#2ecc71', 'Waiting delivery'),
  ('ปิดงาน', 'gray', '#5d636e', 'Closed')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 7. JOBS TABLE (Job Cards)
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number VARCHAR(50) UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status_id INTEGER REFERENCES job_statuses(id) DEFAULT 1,
  complaint TEXT,
  assign_to UUID REFERENCES auth.users(id),
  mileage INTEGER,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE INDEX idx_jobs_vehicle_id ON jobs(vehicle_id);
CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_status_id ON jobs(status_id);
CREATE INDEX idx_jobs_assign_to ON jobs(assign_to);
CREATE INDEX idx_jobs_created_at ON jobs(created_at);
CREATE INDEX idx_jobs_job_number ON jobs(job_number);

-- ============================================================
-- 8. PRODUCT CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO product_categories (name, description) VALUES
  ('น้ำมันเครื่อง', 'Engine Oil'),
  ('น้ำยา', 'Fluid Additives'),
  ('น้ำมันเกียร์', 'Gear Oil'),
  ('น้ำมันเบรก', 'Brake Fluid'),
  ('ไส้กรอง', 'Filters')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 9. SUPPLIERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  tax_id VARCHAR(50),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. STOCK ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES product_categories(id),
  unit VARCHAR(50),
  cost_price DECIMAL(10, 2) NOT NULL,
  sell_price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  supplier_id UUID REFERENCES suppliers(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_items_sku ON stock_items(sku);
CREATE INDEX idx_stock_items_name ON stock_items(name);
CREATE INDEX idx_stock_items_category_id ON stock_items(category_id);

-- ============================================================
-- 11. STOCK TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'in' | 'out' | 'adjust'
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50), -- 'job' | 'purchase' | 'adjustment' | 'requisition'
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_transactions_stock_item_id ON stock_transactions(stock_item_id);
CREATE INDEX idx_stock_transactions_type ON stock_transactions(type);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at);

-- ============================================================
-- 12. SERVICES TABLE (Service Packages)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  note TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO services (service_code, name, description, price) VALUES
  ('SV01', 'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง', 'รวมค่าแรง + ฟรีตรวจ 15 รายการ', 4500),
  ('SV02', 'ฟลัชชิ่งเกียร์ (Vacuum)', 'ระบบดูดสุญญากาศ ไม่ต้องถอดอ่าง', 2000),
  ('SV03', 'เปิดอ่างเกียร์ + ล้างสมองเกียร์', 'รวมน้ำยาคลีนนิ่ง', 1500),
  ('SV04', 'Hybrid Service', 'บริการสำหรับรถ Hybrid โดยเฉพาะ', 4000),
  ('SV05', 'เปลี่ยนน้ำมันเฟืองท้าย', 'รวมค่าแรงและน้ำมัน', 2400),
  ('SV06', 'เปลี่ยนน้ำมันเบรก + ไล่ลม', 'ไล่ลมครบ 4 ล้อ', 650),
  ('SV07', 'เปลี่ยนน้ำยาหล่อเย็น', 'ล้างระบบ + เติมใหม่', 890),
  ('SV08', 'ตรวจเช็คช่วงล่าง', 'ด้วยเครื่องจำลองถนนจริง', 300),
  ('SV09', 'ค่าแรง / ค่าบริการทั่วไป', '', 0)
ON CONFLICT (service_code) DO NOTHING;

-- ============================================================
-- 13. REQUISITIONS TABLE (Stock Requisitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requisitions_job_id ON requisitions(job_id);

-- ============================================================
-- 14. REQUISITION ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  stock_item_id UUID REFERENCES stock_items(id),
  quantity INTEGER NOT NULL,
  cost_price DECIMAL(10, 2),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_requisition_items_requisition_id ON requisition_items(requisition_id);

-- ============================================================
-- 15. INVOICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  job_id UUID REFERENCES jobs(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  subtotal DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  vat DECIMAL(10, 2) DEFAULT 0,
  grand_total DECIMAL(10, 2) DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_job_id ON invoices(job_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- ============================================================
-- 16. INVOICE ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL, -- 'stock' | 'service' | 'order' | 'custom'
  stock_item_id UUID REFERENCES stock_items(id),
  service_id UUID REFERENCES services(id),
  description VARCHAR(255),
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ============================================================
-- 17. QUOTATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  job_id UUID REFERENCES jobs(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  subtotal DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  vat DECIMAL(10, 2) DEFAULT 0,
  grand_total DECIMAL(10, 2) DEFAULT 0,
  note TEXT,
  valid_until TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotations_quotation_number ON quotations(quotation_number);
CREATE INDEX idx_quotations_job_id ON quotations(job_id);
CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);

-- ============================================================
-- 18. QUOTATION ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL,
  stock_item_id UUID REFERENCES stock_items(id),
  service_id UUID REFERENCES services(id),
  description VARCHAR(255),
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- ============================================================
-- 19. PURCHASE ORDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'ordered' | 'received' | 'cancelled'
  total_amount DECIMAL(10, 2) DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_at TIMESTAMP
);

CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

-- ============================================================
-- 20. PURCHASE ORDER ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  received_qty INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_po_items_po_id ON purchase_order_items(po_id);

-- ============================================================
-- 21. PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash' | 'credit_card' | 'transfer' | 'cheque'
  reference VARCHAR(100),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

-- ============================================================
-- 22. EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  reference VARCHAR(100),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_created_at ON expenses(created_at);

-- ============================================================
-- 23. SEQUENCE COUNTER TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sequences (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  current_value INTEGER DEFAULT 1,
  prefix VARCHAR(20),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sequences (name, prefix, current_value) VALUES
  ('job', 'JOB', 1),
  ('invoice', 'INV', 1),
  ('quotation', 'QT', 1),
  ('po', 'PO', 1)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- USERS: Everyone can read their own profile
CREATE POLICY "Users can read their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- USERS: Admin can read all
CREATE POLICY "Admin can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- CUSTOMERS: All authenticated users can read
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

-- CUSTOMERS: Users can create customers
CREATE POLICY "Authenticated users can create customers"
  ON customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- CUSTOMERS: Users can update customers they created
CREATE POLICY "Users can update customers they created"
  ON customers FOR UPDATE
  USING (auth.uid() = created_by);

-- VEHICLES: All authenticated users can read
CREATE POLICY "Authenticated users can read vehicles"
  ON vehicles FOR SELECT
  USING (auth.role() = 'authenticated');

-- VEHICLES: Users can create vehicles
CREATE POLICY "Authenticated users can create vehicles"
  ON vehicles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- JOBS: All authenticated users can read
CREATE POLICY "Authenticated users can read jobs"
  ON jobs FOR SELECT
  USING (auth.role() = 'authenticated');

-- JOBS: Users can create jobs
CREATE POLICY "Authenticated users can create jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- JOBS: Users can update jobs
CREATE POLICY "Authenticated users can update jobs"
  ON jobs FOR UPDATE
  USING (auth.role() = 'authenticated');

-- STOCK_ITEMS: All authenticated users can read
CREATE POLICY "Authenticated users can read stock items"
  ON stock_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- STOCK_ITEMS: Only admin can create/update
CREATE POLICY "Admin can manage stock items"
  ON stock_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- INVOICES: All authenticated users can read
CREATE POLICY "Authenticated users can read invoices"
  ON invoices FOR SELECT
  USING (auth.role() = 'authenticated');

-- INVOICES: Users can create invoices
CREATE POLICY "Authenticated users can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- QUOTATIONS: All authenticated users can read
CREATE POLICY "Authenticated users can read quotations"
  ON quotations FOR SELECT
  USING (auth.role() = 'authenticated');

-- QUOTATIONS: Users can create quotations
CREATE POLICY "Authenticated users can create quotations"
  ON quotations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- PAYMENTS: All authenticated users can read
CREATE POLICY "Authenticated users can read payments"
  ON payments FOR SELECT
  USING (auth.role() = 'authenticated');

-- PAYMENTS: Users can create payments
CREATE POLICY "Authenticated users can create payments"
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- EXPENSES: All authenticated users can read
CREATE POLICY "Authenticated users can read expenses"
  ON expenses FOR SELECT
  USING (auth.role() = 'authenticated');

-- EXPENSES: Users can create expenses
CREATE POLICY "Authenticated users can create expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- FUNCTIONS FOR SEQUENCE GENERATION
-- ============================================================

CREATE OR REPLACE FUNCTION get_next_sequence(seq_name VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_next_value INTEGER;
  v_date_part VARCHAR;
BEGIN
  -- Get today's date in YYYYMMDD format
  v_date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Update sequence counter and get next value
  UPDATE sequences
  SET current_value = current_value + 1
  WHERE name = seq_name
  RETURNING prefix, current_value INTO v_prefix, v_next_value;
  
  -- Return formatted sequence number
  RETURN v_prefix || '-' || v_date_part || '-' || LPAD(v_next_value::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DONE!
-- ============================================================
-- All tables created successfully!
-- Now go to Supabase console and:
-- 1. Enable Row Level Security policies
-- 2. Create some test users
-- 3. Update supabaseConfig.js with your credentials
