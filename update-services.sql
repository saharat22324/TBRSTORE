-- อัพเดท + เพิ่มรายการบริการใน Supabase
-- รัน script นี้ใน Supabase Dashboard → SQL Editor

-- อัพเดทรายการที่มีอยู่แล้ว (ชื่อ/รายละเอียด)
UPDATE services SET name='เปลี่ยนน้ำมันเครื่อง (Small Cars)',   description='รถเล็ก 1,500cc | FULLY SYNTHETIC | รวมไส้กรอง | ไม่รวมฟลัชชิ่ง', price=2200 WHERE service_code='SV01';
UPDATE services SET name='เปลี่ยนน้ำมันเครื่อง (Mid Cars)',     description='รถกลาง 1,600–3,000cc | FULLY SYNTHETIC | รวมไส้กรอง | ไม่รวมฟลัชชิ่ง', price=2500 WHERE service_code='SV02';
UPDATE services SET name='เปลี่ยนน้ำมันเครื่อง (SUV/PPV)',     description='รถกระบะ/SUV/PPV | FULLY SYNTHETIC | รวมไส้กรอง | ไม่รวมฟลัชชิ่ง', price=3000 WHERE service_code='SV03';
UPDATE services SET name='เปลี่ยนน้ำมันเครื่อง (ยุโรป/LEXUS)', description='รถยุโรปทุกรุ่น + LEXUS | FULLY SYNTHETIC | รวมไส้กรอง | ไม่รวมฟลัชชิ่ง', price=4500 WHERE service_code='SV04';
UPDATE services SET name='เปลี่ยนน้ำมันเครื่อง (Super Cars)',  description='ซุปเปอร์คาร์ | FULLY SYNTHETIC | รวมไส้กรอง | ไม่รวมฟลัชชิ่ง', price=6500 WHERE service_code='SV05';
UPDATE services SET description='ระบบดูดสุญญากาศ ไม่ต้องถอดอ่าง', price=4800 WHERE service_code='SV06';
UPDATE services SET name='เปิดอ่างเกียร์ + ล้างสมองเกียร์',   description='รวมน้ำยาคลีนนิ่งล้างสมองเกียร์', price=1500 WHERE service_code='SV07';
UPDATE services SET description='รวมค่าแรงและน้ำมัน | สำหรับ RWD / AWD / 4WD', price=2400 WHERE service_code='SV08';
UPDATE services SET description='รวมค่าแรงและน้ำยา | ใช้ได้กับ EV ด้วย', price=2100 WHERE service_code='SV10';
UPDATE services SET name='ฟลัชชิ่งเกียร์ Hybrid (1 รอบ)',      description='พร้อมเปิดอ่าง | น้ำมันเกียร์ Premium Grade | มาตรฐานยุโรป', price=4000 WHERE service_code='SV11';
UPDATE services SET name='ฟลัชชิ่งเกียร์ Hybrid (2 รอบ แนะนำ)', description='พร้อมเปิดอ่าง | สะอาด 95-99% | เหมาะสำหรับ Hybrid และ EV', price=5500 WHERE service_code='SV12';

-- เพิ่มรายการใหม่ (เปลี่ยนน้ำมัน + ฟลัชชิ่ง ทั้ง 5 ประเภท + เปิดอ่าง+ฟลัชชิ่ง)
INSERT INTO services (service_code, name, description, price) VALUES
  ('SV16', 'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง (Small Cars)', 'รถเล็ก 1,500cc | FULLY SYNTHETIC | รวมไส้กรอง + ฟลัชชิ่งเครื่องยนต์', 2790),
  ('SV17', 'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง (Mid Cars)',   'รถกลาง 1,600–3,000cc | FULLY SYNTHETIC | รวมไส้กรอง + ฟลัชชิ่งเครื่องยนต์', 3090),
  ('SV18', 'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง (SUV/PPV)',   'รถกระบะ/SUV/PPV | FULLY SYNTHETIC | รวมไส้กรอง + ฟลัชชิ่งเครื่องยนต์', 3590),
  ('SV19', 'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง (ยุโรป/LEXUS)', 'รถยุโรปทุกรุ่น + LEXUS | FULLY SYNTHETIC | รวมไส้กรอง + ฟลัชชิ่งเครื่องยนต์', 5090),
  ('SV20', 'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง (Super Cars)', 'ซุปเปอร์คาร์ | FULLY SYNTHETIC | รวมไส้กรอง + ฟลัชชิ่งเครื่องยนต์', 7090),
  ('SV21', 'เปิดอ่าง + ฟลัชชิ่งเกียร์ (ครบชุด)', 'เปิดอ่างเกียร์ + น้ำยาคลีนนิ่งล้างสมองเกียร์ + ฟลัชชิ่งเกียร์', 6800)
ON CONFLICT (service_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price;
