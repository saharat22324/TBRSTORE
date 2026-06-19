-- Add Oil Products (สินค้าน้ำมัน)
-- Copy & Paste นี้ลง Supabase SQL Editor แล้วกด Run

INSERT INTO stock_items (sku, name, quantity, cost_price, sell_price) 
VALUES
  ('OIL-5W40-A', '5W40 แบบ', 200, 150.00, 200.00),
  ('OIL-5W40-R', '5W40 สีแดง', 200, 150.00, 200.00),
  ('OIL-COOL', 'COOLANT', 48, 50.00, 75.00),
  ('OIL-DEX3', 'DEXRON 3', 531, 100.00, 130.00),
  ('OIL-DEX6', 'DEXRON 6', 340, 100.00, 130.00),
  ('OIL-F1', 'F1', 95, 60.00, 85.00),
  ('OIL-GEAR-GLS', 'GEAR LIMITED SLIP OIL GLS', 36, 110.00, 145.00),
  ('OIL-S1', 'S1', 65, 180.00, 230.00),
  ('OIL-TBR-PLUS', 'TBR RULE PLUS', 272, 75.00, 100.00),
  ('OIL-ULV', 'ULV ป่นป่วน 10 ตัน', 36, 110.00, 145.00)
ON CONFLICT (sku) DO NOTHING;
