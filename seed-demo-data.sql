-- TBR System Demo Data Seed Script
-- Execute this in Supabase SQL Editor to populate demo data

-- 1. Insert demo customers
INSERT INTO customers (name, phone, email, address, credit_limit) 
VALUES
  ('ร้าน Ratchaburi Auto', '032-123-4567', 'ratchaburi@auto.local', '123 ซอยเพชรเกษม กรุงเทพ', 50000),
  ('บริษัท ขนส่ง Bangkok Express', '02-555-6789', 'contact@bangkokexp.local', '456 ถนนสีลม ดุสิต', 100000),
  ('โรงแรม Grand Bangkok', '02-888-9999', 'fleet@grandbkk.local', '789 ถนนเจริงนครสวรรค์ ตลิ่งชัน', 75000)
ON CONFLICT (email) DO NOTHING;

-- 2. Insert demo vehicles
WITH customer_ids AS (
  SELECT id, name FROM customers 
  WHERE email IN ('ratchaburi@auto.local', 'contact@bangkokexp.local', 'fleet@grandbkk.local')
)
INSERT INTO vehicles (customer_id, plate_number, brand, model, color, year, odometer)
SELECT 
  ci.id,
  plates.plate,
  'Toyota' as brand,
  'Innova' as model,
  colors.color,
  2022 + (row_number() OVER ()) % 3,
  (row_number() OVER () * 10000) + 5000
FROM customer_ids ci
CROSS JOIN (
  VALUES 
    ('กท-1234'),
    ('กท-5678'),
    ('กท-9999'),
    ('กท-1111'),
    ('กท-2222'),
    ('กท-3333'),
    ('กท-4444'),
    ('กท-5555'),
    ('กท-6666')
) plates(plate)
CROSS JOIN (
  VALUES ('Silver'), ('Black'), ('White')
) colors(color)
LIMIT 9
ON CONFLICT (plate_number) DO NOTHING;

-- 3. Insert demo jobs
WITH job_data AS (
  SELECT 
    ci.id as customer_id,
    v.id as vehicle_id,
    'JB-2024-' || LPAD(row_number() OVER ()::TEXT, 4, '0') as reference,
    CASE 
      WHEN (row_number() OVER ()) % 3 = 1 THEN 'completed'
      WHEN (row_number() OVER ()) % 3 = 2 THEN 'in_progress'
      ELSE 'pending' 
    END as status,
    'รถยนต์เข้ารับบริการทั่วไป' as notes,
    ((row_number() OVER ()) * 3500 + 2000)::DECIMAL as total_amount,
    NOW() - INTERVAL '1 day' * ((row_number() OVER ()) * 2) as created_at
  FROM (SELECT id FROM customers WHERE email IN ('ratchaburi@auto.local', 'contact@bangkokexp.local', 'fleet@grandbkk.local')) ci
  CROSS JOIN vehicles v
  WHERE v.customer_id = ci.id
)
INSERT INTO jobs (reference, customer_id, vehicle_id, status, notes, total_amount, created_at)
SELECT reference, customer_id, vehicle_id, status, notes, total_amount, created_at
FROM job_data
LIMIT 6
ON CONFLICT (reference) DO NOTHING;

-- 4. Insert demo invoices
WITH invoice_data AS (
  SELECT 
    j.id as job_id,
    j.customer_id,
    'INV-2024-' || LPAD(row_number() OVER ()::TEXT, 4, '0') as reference,
    CASE WHEN (row_number() OVER ()) % 2 = 0 THEN 'paid' ELSE 'pending' END as status,
    (j.total_amount * 0.9)::DECIMAL as subtotal,
    (j.total_amount * 0.1)::DECIMAL as tax,
    j.total_amount,
    NOW() + INTERVAL '30 days' as due_date
  FROM jobs j
  LIMIT 6
)
INSERT INTO invoices (job_id, customer_id, reference, status, subtotal, tax, total, due_date)
SELECT job_id, customer_id, reference, status, subtotal, tax, total, due_date
FROM invoice_data
ON CONFLICT (reference) DO NOTHING;

-- 5. Insert demo stock items
INSERT INTO stock_items (sku, name, description, quantity, reorder_level, unit_price)
VALUES
  ('OIL-001', 'น้ำมันเครื่อง Mobil', 'น้ำมันเครื่องคุณภาพสูง Mobil 10W-40', 50, 10, 250),
  ('FIL-001', 'ไส้กรอง', 'ไส้กรองอากาศแบบมาตรฐาน', 100, 20, 150),
  ('BAT-001', 'แบตเตอรี่', 'แบตเตอรี่รถยนต์ 12V 75Ah', 15, 5, 5500),
  ('BRK-001', 'แพดเบรก', 'แพดเบรกด้านหน้า OEM', 30, 8, 1200),
  ('TYR-001', 'ยางรถยนต์', 'ยางรถยนต์ขนาด 185/65R15', 20, 5, 3500),
  ('SPN-001', 'สปริง', 'สปริงแขนงนอกปกติ', 25, 5, 800),
  ('BEL-001', 'สายพานหลัก', 'สายพานหลัก Serpentine', 40, 10, 600),
  ('ACP-001', 'น้ำหล่อเย็น', 'น้ำหล่อเย็นสีแดง Thai Auto', 60, 15, 200)
ON CONFLICT (sku) DO NOTHING;

-- 6. Insert demo shop config (if empty)
INSERT INTO shop_config (shop_name, phone, email, address, tax_id, opening_hours, closing_hours)
SELECT 
  'บริษัท ทีบีอาร์ เพอร์ฟอร์แมนซ์ จำกัด',
  '02-1234-5678',
  'contact@tbr-performance.local',
  '999 หมู่ 5 ถนนพหลโยธิน จังหวัรนครสวรรค์',
  '0105123456789',
  '09:00',
  '18:00'
WHERE NOT EXISTS (SELECT 1 FROM shop_config LIMIT 1);

-- Summary
SELECT 
  'Demo data seeded successfully!' as status,
  (SELECT COUNT(*) FROM customers) as customers,
  (SELECT COUNT(*) FROM vehicles) as vehicles,
  (SELECT COUNT(*) FROM jobs) as jobs,
  (SELECT COUNT(*) FROM invoices) as invoices,
  (SELECT COUNT(*) FROM stock_items) as stock_items;
