-- ════════════════════════════════════════════
-- ลบ seed ขยะ 10 รายการที่ชื่อไม่สมบูรณ์/ซ้ำ
-- ────────────────────────────────────────────
-- ตรวจก่อนลบ (step 1) — ดูว่าจะลบอะไร
SELECT id, sku, name, quantity
FROM stock_items
WHERE sku IN (
  'OIL-5W40-A', 'OIL-5W40-R', 'OIL-COOL',
  'OIL-DEX3',   'OIL-DEX6',   'OIL-F1',
  'OIL-GEAR-GLS','OIL-S1',    'OIL-TBR-PLUS', 'OIL-ULV'
)
ORDER BY sku;

-- ════════════════════════════════════════════
-- ลบ (step 2) — รันบรรทัดนี้หลังยืนยัน SELECT ข้างบน
-- ════════════════════════════════════════════
DELETE FROM stock_items
WHERE sku IN (
  'OIL-5W40-A', 'OIL-5W40-R', 'OIL-COOL',
  'OIL-DEX3',   'OIL-DEX6',   'OIL-F1',
  'OIL-GEAR-GLS','OIL-S1',    'OIL-TBR-PLUS', 'OIL-ULV'
);

-- ════════════════════════════════════════════
-- ยืนยันข้อมูลจริงที่เหลือ (step 3)
-- ════════════════════════════════════════════
SELECT id, sku, name, unit, cost, sell, qty, reorder
FROM stock_items
ORDER BY cat, sku;
