# TBR System — Backup and Restore Runbook

## เป้าหมาย

- RPO: ยอมรับข้อมูลสูญหายได้ไม่เกิน 24 ชั่วโมง
- RTO: กู้ระบบกลับมาใช้งานภายใน 4 ชั่วโมง
- เก็บ Backup อย่างน้อย 30 วัน และมีสำเนาอยู่นอก Supabase อย่างน้อย 1 ชุด

## นโยบายสำรองข้อมูล

1. เปิด Daily Backup หรือ Point-in-Time Recovery ใน Supabase ตามแพ็กเกจที่ใช้งาน
2. ทุกสัปดาห์ Export ฐานข้อมูลออกจาก Supabase เก็บในพื้นที่เข้ารหัสที่แยกบัญชี
3. ก่อนรัน SQL migration ทุกครั้ง ให้สร้าง On-demand backup
4. Export JSON จากหน้าตั้งค่าของระบบเป็นสำเนาเสริมเท่านั้น ไม่ใช่ฐานข้อมูลสำรองหลัก
5. ห้ามเก็บรหัสผ่าน, service-role key หรือ database password ไว้ใน repository

## คำสั่งมาตรฐาน

- ตั้งค่า `SUPABASE_DB_URL` ใน terminal เฉพาะ session ปัจจุบัน ห้ามบันทึกลงไฟล์
- รัน `scripts/backup-supabase.ps1` เพื่อสร้าง custom-format logical dump และไฟล์ SHA-256 สคริปต์จะค้นหา `pg_dump` จาก PATH, โฟลเดอร์ติดตั้ง PostgreSQL มาตรฐาน และ portable binaries ใต้ `%LOCALAPPDATA%\PostgreSQL` โดยอัตโนมัติ หรือระบุ `-PgDumpPath` ได้
- ตรวจ hash ก่อน restore ทุกครั้ง
- ใช้ `scripts/apply-migration.ps1 -Migration <path> -Version <schema_migrations.version>` เมื่อติดตั้ง migration ผ่าน `psql`; หากชื่อไฟล์ตรงกับ version สามารถละ `-Version` ได้ สคริปต์จะบันทึก SHA-256 ลง `schema_migrations`
- ไฟล์ในโฟลเดอร์ `backups` ต้องอยู่นอก Git และเก็บในพื้นที่เข้ารหัส

## Backup อัตโนมัติบน GitHub Actions

Workflow `.github/workflows/backup.yml` ทำงานทุกวันเวลา 01:15 น. ตามเวลาประเทศไทย และเก็บ encrypted artifact 30 วัน

ตั้งค่า GitHub Actions secrets ก่อนเปิดใช้งาน:

- `SUPABASE_DB_PASSWORD`: รหัสผ่านฐานข้อมูล Production
- `BACKUP_ENCRYPTION_PASSPHRASE`: passphrase แยกจากรหัสฐานข้อมูลสำหรับ AES-256 encryption
- `SUPABASE_DB_HOST`: database หรือ Supavisor host ที่ GitHub runner เชื่อมต่อได้ (ไม่บังคับ)
- `SUPABASE_DB_PORT`: port ของ host ดังกล่าว (ไม่บังคับ)
- `SUPABASE_DB_USER`: database user ของ host ดังกล่าว (ไม่บังคับ)

Workflow จะหยุดทันทีเมื่อ secret บังคับไม่ครบ ตรวจ catalog ด้วย `pg_restore --list`, ลบ plaintext dump หลังเข้ารหัส และอัปโหลดเฉพาะ `.dump.gpg` กับ `.sha256`

ก่อน restore ให้ตรวจ SHA-256 แล้วถอดรหัสในเครื่องที่ปลอดภัย:

```powershell
gpg --output tbr-production.dump --decrypt tbr-production.dump.gpg
pg_restore --list tbr-production.dump
```

ห้ามส่ง passphrase ผ่าน command-line argument หรือเก็บไว้ร่วมกับ artifact

## รายการที่ต้องสำรอง

- PostgreSQL schema และข้อมูลทุกตารางใน schema public
- Supabase Auth users
- Supabase Storage โดยเฉพาะ bucket รูปงานซ่อม
- Environment configuration และรายการ migration ที่รันแล้ว
- RLS policies, database functions และ triggers

## ขั้นตอนก่อน Migration

1. ตรวจว่า Daily Backup ล่าสุดสำเร็จ
2. สร้าง Manual Backup พร้อมชื่อวันที่และ release version
3. ทดสอบ migration ใน Staging
4. รัน smoke test ใน tests/production-hardening-smoke.sql
5. รัน tests/accounting-completion-smoke.sql ภายใน transaction ที่ลงท้ายด้วย ROLLBACK
6. บันทึกผู้รัน เวลา checksum และผลลัพธ์
7. จึงรันใน Production ช่วงที่ไม่มีผู้ใช้ออกบิล

## ขั้นตอน Restore

1. ประกาศหยุดใช้งานระบบชั่วคราว เพื่อไม่ให้เกิดข้อมูลใหม่ระหว่างกู้คืน
2. ระบุเวลาที่ข้อมูลยังถูกต้องล่าสุด
3. Restore ไปยัง Staging project ก่อน ห้ามทับ Production ทันที
4. ตรวจจำนวนลูกค้า รถ งาน บิล รายการบิล สต๊อก ใบเบิก PO และรายจ่าย
5. ตรวจยอดรวมบิลเทียบกับรายงาน และตรวจ stock quantity ว่าไม่ติดลบผิดปกติ
6. ทดลอง Login อย่างน้อย Admin, Supervisor และ Technician
7. ทดลองสร้าง Job และ Invoice หนึ่งรายการ แล้ว Rollback/ลบข้อมูลทดสอบตามขั้นตอนบัญชี
8. เมื่อผ่านทั้งหมดจึงสลับ Production ไปยังฐานที่กู้คืน
9. บันทึก Incident timeline และสาเหตุ

## การทดสอบกู้คืนรายไตรมาส

อย่างน้อยทุก 3 เดือน:

- Restore backup ล่าสุดไป Staging
- รัน smoke test
- เปรียบเทียบ row count ของตารางหลัก
- ตรวจเอกสารล่าสุด 10 รายการและยอดรวมรายเดือน
- ตรวจไฟล์ใน Storage แบบสุ่ม
- บันทึกเวลาที่ใช้จริงเทียบกับ RTO 4 ชั่วโมง

## ผู้รับผิดชอบ

- เจ้าของระบบ: อนุมัติ Restore และตรวจยอดธุรกิจ
- ผู้ดูแล Supabase: Backup, Restore, RLS และ Migration
- ผู้ทดสอบ: Smoke test และตรวจ workflow หลัง Restore

## หลักฐานที่ต้องเก็บ

- วันที่/เวลา Backup
- Backup identifier
- Database release/migration version
- ผู้สร้างและผู้ตรวจสอบ
- ผล smoke test
- ผล restore drill และเวลาที่ใช้
