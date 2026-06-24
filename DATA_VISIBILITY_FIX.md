# TBR System - Data Visibility Fix Report

## ปัญหาที่ค้นพบ (Problem Identified)

ผู้ใช้คนหนึ่งเข้าสู่ระบบและสร้างข้อมูล แต่ผู้ใช้คนอื่นไม่เห็นข้อมูลนั้น เมื่อเข้าสู่ระบบ

## สาเหตุหลัก (Root Cause)

### 1. **RLS Policies กำลังบล็อกการเข้าถึง** (PRIMARY ISSUE)
- Supabase Row-Level Security (RLS) policies ถูกเปิดใช้งาน
- RLS policies ตรวจสอบ `auth.role() = 'authenticated'` 
- แต่แอปพลิเคชันใช้ **custom username/password auth** ไม่ใช่ Supabase Auth
- ผลลัพธ์: ไม่สามารถ INSERT/SELECT ข้อมูลจาก Supabase ได้

### 2. โครงสร้างข้อมูลแบบ Hybrid
- **localStorage**: ใช้สำหรับ fallback เมื่อ Supabase บล็อก
- **Supabase**: ควรใช้สำหรับ multi-user sync แต่ RLS บล็อกการเข้าถึง
- ผล: ข้อมูลแต่ละผู้ใช้เก็บใน localStorage ตัวอย่าง ไม่ซิงค์

## การแก้ไข (Solution)

### ขั้นที่ 1: ปรับปรุงโค้ด (COMPLETED ✅)

#### A. `js/db.js` - Enhanced loadData()
- ✅ เพิ่มการ retry เพื่อรอให้ Supabase พร้อม
- ✅ ตรวจจับ RLS errors และแสดงข้อความแจ้งเตือน
- ✅ Graceful fallback ไป localStorage เมื่อ Supabase ไม่พร้อม
- ✅ ปรับปรุง log messages

#### B. `js/auth.js` - Fixed checkAuth()
- ✅ Ensure Supabase always initializes before checking auth
- ✅ Set up proper session tracking

#### C. `js/supabaseService.js` - Better error reporting
- ✅ Added detailed logging for each data load operation
- ✅ Better RLS error detection

### ขั้นที่ 2: Disable RLS (REQUIRED FOR PRODUCTION) ⚠️

**สำคัญ**: ต้องปิด RLS policies เพื่อให้ multi-user data sync ทำงาน

#### วิธี A: Supabase Dashboard (ง่ายที่สุด)
1. เปิด https://supabase.com/dashboard
2. Login ด้วย Supabase account ของคุณ
3. ไปที่ project `tgtuxvmuapiltmkulvlk`
4. ไปที่ SQL Editor
5. Paste SQL ด้านล่างและ Execute:

```sql
-- Disable RLS on all tables for multi-user data sharing
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE requisition_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE docs DISABLE ROW LEVEL SECURITY;
```

#### วิธี B: PostgreSQL Client เช่น DBeaver
1. Connect ไปยัง Supabase PostgreSQL database
2. ใช้ SQL ข้างบน

#### วิธี C: Command Line (psql)
```bash
# Get connection string from Supabase Dashboard > Settings > Database
psql "postgresql://[user]:[password]@[host]:[port]/postgres" < disable-rls-all.sql
```

## ทดสอบหลังการแก้ไข (Testing)

### ทดสอบ 1: Admin สร้างข้อมูล
1. Login ด้วย `admin/admin123`
2. ไปที่ ลูกค้า / รถ
3. สร้างลูกค้าใหม่ เช่น "ทดสอบ User2"
4. ตรวจสอบ localStorage (Ctrl+Shift+I > Application > localStorage)

### ทดสอบ 2: User 2 เห็นข้อมูล
1. Logout จาก admin
2. Login ด้วย `porche1/porche123`
3. ไปที่ ลูกค้า / รถ
4. ควรเห็น "ทดสอบ User2" ถ้า RLS ปิดแล้ว

### ทดสอบ 3: RBAC ยังทำงาน
- porche1 ควรเห็น cost เป็น "••••" (masked)
- admin ควรเห็น cost เป็นตัวเลข

## Architecture ปัจจุบัน

```
┌─────────────────────────────────────────────────────────┐
│           TBR System Data Flow                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  User A (admin)                  User B (porche1)       │
│       │                               │                  │
│       └──────────┬──────────────────────┘              │
│                  │ checkAuth() - initialize Supabase  │
│                  ▼                                      │
│          [Supabase] ◄── RLS DISABLED ✅              │
│          PostgreSQL                                     │
│              ▲                                          │
│              │ loadAllData()                            │
│              │ (multi-user sync)                        │
│              │                                          │
│          [localStorage] ◄── fallback only              │
│          (per browser)                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Status

- ✅ Code improvements completed
- ⚠️ **Waiting for RLS to be disabled**
- ⏳ Testing pending after RLS fix

## Next Steps

1. **อ่านขั้นตอน "Disable RLS"** และตัดสินใจว่าจะทำแบบไหน
2. Execute SQL ให้ปิด RLS
3. Refresh browser
4. Test with 2 users
5. If still not working, check console logs for errors

## Troubleshooting

### ยังไม่เห็นข้อมูลหลังจากปิด RLS?

1. **Clear localStorage**: Ctrl+Shift+I > Application > localStorage > clear all
2. **Logout/Login** ใหม่
3. **Check browser console** for errors (Ctrl+Shift+I > Console)
4. **Look for message**: "[DB] ✅ โหลดจาก Supabase สำเร็จ"

### Error: "new row violates row-level security policy"?

- RLS still enabled - ไปยัง Supabase Dashboard และปิด RLS

### Error: "Invalid API key"?

- ตรวจสอบ SUPABASE_KEY ใน index.html
- ควรเป็น `sb_publishable_...`

## Documentation

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Custom Auth in Supabase](https://supabase.com/docs/guides/auth/custom-authentication)
- File: `enable-rls-policies.sql` - RLS policies ที่ใช้
- File: `disable-rls-all.sql` - SQL ให้ปิด RLS
