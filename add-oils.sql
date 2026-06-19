-- เพิ่มสินค้าน้ำมันและของเหลวทั้งหมด
INSERT INTO stock_items (sku, name, quantity) 
VALUES
  ('OIL-5W40-A', '5W40 แบบ', 200),
  ('OIL-5W40-R', '5W40 สีแดง', 200),
  ('OIL-COOL', 'COOLANT', 48),
  ('OIL-DEX3', 'DEXRON 3', 531),
  ('OIL-DEX6', 'DEXRON 6', 340),
  ('OIL-F1', 'F1', 95),
  ('OIL-GEAR-GLS', 'GEAR LIMITED SLIP OIL GLS ป่นป่วน', 36),
  ('OIL-S1', 'S1', 65),
  ('OIL-TBR-PLUS', 'TBR RULE PLUS', 272),
  ('OIL-ULV', 'ULV ป่นป่วน 10 ตัน', 36)
ON CONFLICT (sku) DO NOTHING;

-- ตรวจสอบผลลัพธ์
SELECT 
  sku,
  name,
  quantity,
  'น้ำมันและของเหลว' as category
FROM stock_items 
WHERE sku LIKE 'OIL-%'
ORDER BY sku;
