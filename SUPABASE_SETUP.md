# TBR System — Supabase Integration Guide

## 📋 ขั้นตอนการตั้งค่า Supabase

### 1. สร้าง Supabase Account
1. ไปที่ https://supabase.com
2. คลิก **"Start Your Project"**
3. Sign up ด้วย GitHub หรือ Email
4. ยืนยัน Email

### 2. สร้าง Project ใหม่
1. Click **"New Project"**
2. เลือกชื่อ: `tbr-system` (หรืออื่นๆ)
3. เลือก Password (เก็บไว้ที่ปลอดภัย)
4. เลือก Region: **Singapore** (ใกล้ไทยที่สุด)
5. คลิก **"Create new project"** (รอ 1-2 นาที)

### 3. รับ Credentials
เมื่อ Project สร้างเสร็จ:
1. ไปที่ **Settings** → **API** (หรือ **Credentials**)
2. คัดลอก:
   - `Project URL` → `SUPABASE_URL` 
   - `anon public` → `SUPABASE_KEY`

### 4. รัน SQL Migration
1. ไปที่ **SQL Editor**
2. คลิก **"New Query"**
3. Copy-paste ทั้งหมดจาก `sql-migration.sql`
4. คลิก **"Run"** (รอจนเสร็จ)

✅ ทดสอบ: ควรเห็น "Success" message

### 5. ตั้งค่า supabaseConfig.js
อัปเดต `js/supabaseConfig.js`:

```javascript
const SUPABASE_URL = 'YOUR_PROJECT_URL';      // เช่น https://abcxyz.supabase.co
const SUPABASE_KEY = 'YOUR_ANON_KEY';         // Public anon key
```

### 6. สร้างบัญชีผู้ใช้ (Demo)
ไปที่ **Authentication** → **Users**

Click **"Add user"** สร้าง 3 บัญชี:

#### Admin
- Email: `admin@tbr.local`
- Password: `admin123`

#### Technician  
- Email: `tech@tbr.local`
- Password: `tech123`

#### Front Desk
- Email: `desk@tbr.local`
- Password: `desk123`

### 7. อัปเดตโปรไฟล์ผู้ใช้
ใน Supabase Console:
1. ไปที่ **SQL Editor**
2. รัน queries ต่อไปนี้:

```sql
-- Admin user
UPDATE users 
SET role_id = 1, active = true 
WHERE email = 'admin@tbr.local';

-- Technician user
UPDATE users 
SET role_id = 2, active = true 
WHERE email = 'tech@tbr.local';

-- Front Desk user
UPDATE users 
SET role_id = 3, active = true 
WHERE email = 'desk@tbr.local';
```

### 8. เปิดใช้ Row Level Security (RLS)
✅ RLS ถูก enable แล้วในผ่าน SQL migration

ตรวจสอบ:
1. ไปที่ **Authentication** → **Policies**
2. ควรเห็น policies ทั้งหมด

### 9. ทดสอบระบบ
1. เปิด `login.html` ในเบราว์เซอร์
2. ลองเข้าสู่ระบบด้วย:
   - Email: `admin@tbr.local`
   - Password: `admin123`

✅ ควรเห็น dashboard โหลดข้อมูลจาก Supabase

---

## 🔐 Role-Based Access Control

### Admin (ผู้จัดการ)
- ✅ ดูและจัดการทุกอย่าง
- ✅ เพิ่ม/แก้ไขสต๊อก
- ✅ อนุมัติการสมัครสมาชิก
- ✅ ตั้งค่าระบบ

### Technician (ช่าง)
- ✅ ดูและเพิ่มงาน
- ✅ ตัดสต๊อก
- ✅ ดูลูกค้าและรถที่เกี่ยวข้อง
- ❌ แก้ไขราคาสต๊อก
- ❌ ลบข้อมูล

### Front Desk (ลูกค้า)
- ✅ เพิ่มลูกค้า
- ✅ ดูงาน
- ✅ สร้างใบเสนอราคาและบิล
- ✅ ทำอื่นๆ ในส่วน Billing
- ❌ แก้ไขสถานะงาน
- ❌ จัดการสต๊อก

---

## 📁 ไฟล์ที่เพิ่มใหม่

```
TBR-System/
├── js/
│   ├── supabaseConfig.js      ← ตั้งค่า Supabase
│   ├── supabaseService.js     ← Database operations
│   └── auth.js                ← Authentication logic
├── login.html                 ← Login/Register page
├── sql-migration.sql          ← Database schema
└── SUPABASE_SETUP.md          ← (ไฟล์นี้)
```

---

## 🔄 Data Flow

```
User Input
    ↓
JavaScript Functions (customers.js, jobs.js, etc.)
    ↓
supabaseService.js (ชั้น abstraction)
    ↓
Supabase Client (@supabase/supabase-js)
    ↓
PostgreSQL Database + Authentication
    ↓
Data ↔ Frontend (S object)
```

---

## 🛠️ Troubleshooting

### ❌ "Failed to initialize Supabase"
- ✅ ตรวจสอบ `SUPABASE_URL` และ `SUPABASE_KEY` ใน `supabaseConfig.js`
- ✅ ตรวจสอบ URL ไม่มีช่องว่าง
- ✅ ลอง reload หน้า

### ❌ "CORS Error"
- ✅ ไปที่ Supabase Settings → API
- ✅ ล้อก `URL:` ให้เมื่อ Project URL

### ❌ "Authentication failed"
- ✅ ตรวจสอบบัญชีผู้ใช้ถูก enable
- ✅ ตรวจสอบ role_id ถูก set
- ✅ ตรวจสอบ active = true

### ❌ "Permission denied"
- ✅ RLS policies อาจบล็อค
- ✅ ไปที่ SQL Editor รัน:
  ```sql
  SELECT * FROM policies;
  ```

### ❌ "Cannot connect to Supabase"
- ✅ ลองใช้ localStorage fallback (ระบบจะใช้ localStorage อัตโนมัติ)
- ✅ ตรวจสอบ Network connection
- ✅ ตรวจสอบ Supabase project ยังเปิด

---

## 📊 Database Tables

ระบบใช้ 23 tables:

### Auth & Config
- `users` - ผู้ใช้ระบบ
- `roles` - บทบาท (Admin, Technician, Front Desk)
- `shop_config` - ตั้งค่าร้าน

### CRM
- `customers` - ลูกค้า
- `vehicles` - รถ
- `job_statuses` - สถานะงาน
- `jobs` - Job cards

### Inventory
- `product_categories` - หมวดสินค้า
- `stock_items` - รายการสต๊อก
- `suppliers` - ผู้จัดจำหน่าย
- `stock_transactions` - ธุรกรรมสต๊อก

### Services
- `services` - Service packages
- `requisitions` - ใบเบิกสต๊อก
- `requisition_items` - รายการเบิก

### Billing & Documents
- `invoices` - ใบแจ้งหนี้
- `invoice_items` - รายการใบแจ้งหนี้
- `quotations` - ใบเสนอราคา
- `quotation_items` - รายการใบเสนอราคา
- `payments` - รับชำระเงิน

### Purchasing
- `purchase_orders` - ใบสั่งซื้อ
- `purchase_order_items` - รายการสั่งซื้อ

### Accounting
- `expenses` - รายการค่าใช้จ่าย
- `sequences` - ตัวนับเลขที่

---

## 🚀 Backend Integration Features

### ✅ Implemented
- [x] Supabase PostgreSQL integration
- [x] Supabase Authentication (Email/Password)
- [x] Row Level Security (RLS) policies
- [x] Role-based access control (3 roles)
- [x] Database schema with relationships
- [x] Data sync from localStorage to Supabase
- [x] Session management
- [x] User profile management

### ⏳ To Implement (Optional)
- [ ] Supabase Real-time subscriptions
- [ ] File uploads to Supabase Storage
- [ ] Email notifications
- [ ] Two-factor authentication
- [ ] Audit logging

---

## 📚 References

- Supabase Docs: https://supabase.com/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security

---

## ✅ Checklist

- [ ] Supabase account created
- [ ] Project created
- [ ] Credentials copied to supabaseConfig.js
- [ ] SQL migration executed
- [ ] Demo users created
- [ ] User profiles updated (role_id, active)
- [ ] Test login successful
- [ ] Can add customer
- [ ] Can add vehicle
- [ ] Can create job
- [ ] Can manage stock
- [ ] Can create invoice

---

**Happy coding! 🚀**
