# Production Hardening Deployment Guide

## สำคัญ

ให้ทดสอบใน Supabase Staging ก่อน Production และสร้าง Backup ก่อนทุกครั้ง ห้ามรัน SQL ทั้งหมดพร้อมกันโดยไม่ทดสอบบัญชีทั้งสามบทบาท

## ลำดับการติดตั้ง

1. รัน add-tax-invoice-support.sql
2. รัน production-hardening-phase-1.sql
3. รัน secure-cost-data.sql
4. รัน production-role-policies.sql
5. รัน tests/production-hardening-smoke.sql ใน Staging
6. ทดสอบผ่านหน้าเว็บด้วย Admin, Supervisor และ Technician
7. เมื่อผ่านจึงทำซ้ำใน Production

## สิ่งที่แต่ละ Migration ทำ

### add-tax-invoice-support.sql

เพิ่มข้อมูลภาษีของลูกค้าและ snapshot ผู้ซื้อบนใบกำกับภาษี

### production-hardening-phase-1.sql

- เพิ่ม lifecycle ของใบเสร็จและใบกำกับภาษี
- เพิ่ม Payment Ledger
- เพิ่มเลขเอกสารแบบ atomic
- สร้างบิลและรายการบิลใน transaction เดียว
- ยกเลิกบิลและคืนสต๊อกใน transaction เดียว
- ป้องกันการลบเอกสารที่ออกแล้ว

### secure-cost-data.sql

- ซ่อน `cost_price` จาก Technician และ Supervisor ที่ระดับฐานข้อมูล
- ให้ Admin อ่านต้นทุนผ่าน RPC
- ปิดการอ่านต้นทุนผ่าน anon key และ direct REST query

### production-role-policies.sql

- ทุกคนในทีมอ่านข้อมูลปฏิบัติงานร่วมกัน
- จำกัดการลบลูกค้า/รถให้ Admin
- จำกัดการลบงานให้ Admin/Supervisor
- ห้ามลบใบเสร็จและใช้การยกเลิกแทน
- จำกัดรายจ่ายและ Audit Log ตามบทบาท
- จำกัดการตั้งค่าร้านให้ Admin

## UAT ขั้นต่ำ

### Admin

- เห็นราคาทุนและกำไร
- สร้างและแก้ไขบิลได้
- ยกเลิกบิลได้เมื่อระบุเหตุผล
- บิลยกเลิกยังอยู่ในประวัติ แต่ไม่รวมยอดขาย/VAT
- สต๊อกคืนเพียงครั้งเดียว
- เปิด Audit Log ได้

### Supervisor

- ไม่เห็นราคาทุนจาก UI, Network response หรือ direct REST
- ดูรายงานได้ตามสิทธิ์
- ลบงานได้ แต่ยกเลิกบิลไม่ได้

### Technician

- ไม่เห็นราคาทุนจาก UI, Network response หรือ direct REST
- สร้าง/อัปเดต Job และใบเบิกได้
- เปิดรายจ่ายและ Audit Log ไม่ได้
- ลบลูกค้า รถ บิล และงานไม่ได้

### หลายผู้ใช้

- สร้างบิลพร้อมกันอย่างน้อยสองเครื่อง
- ตรวจว่าเลขไม่ซ้ำและรายการบิลไม่ขาด
- ยกเลิกบิลจาก Admin แล้วอีกเครื่องเห็นสถานะภายใน 15 วินาที

## Rollback

หากเกิดปัญหา ให้หยุดการออกบิลก่อน แล้ว Restore Backup เป็นทางเลือกหลัก การ rollback เฉพาะโค้ดโดยไม่ rollback schema สามารถทำได้เพราะคอลัมน์ใหม่เป็น additive แต่ Trigger ป้องกันการลบจะยังทำงานอยู่

หากจำเป็นต้องปิด Trigger ชั่วคราว:

- ปิด `trg_prevent_issued_invoice_delete` เฉพาะระหว่าง Incident
- ห้ามลบข้อมูลจริงระหว่างที่ Trigger ปิด
- เปิด Trigger กลับทันทีหลังแก้ไข

การคืนสิทธิ์อ่านต้นทุนเป็นการลดความปลอดภัย จึงควรแก้ RPC หรือ Role ให้ถูกต้องแทนการ `GRANT SELECT` กลับทั้งตาราง

## Backup/Restore

ปฏิบัติตาม BACKUP_RESTORE.md และบันทึกผล Restore drill ก่อนประกาศ Production Ready
