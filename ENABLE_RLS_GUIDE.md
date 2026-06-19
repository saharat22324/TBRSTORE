# 🔐 ENABLE RLS POLICIES - Complete Guide

## 📋 What is RLS?

**RLS** = Row-Level Security (ป้องกันข้อมูล)

### ก่อน RLS:
```
❌ ใครก็ได้ → เห็นข้อมูลทั้งหมด (ไม่ปลอดภัย!)
```

### หลัง RLS:
```
✅ Admin      → เห็นข้อมูลทั้งหมด
✅ Technician → เห็นเฉพาะ jobs + stock
✅ Desk Staff → เห็นเฉพาะ customers + invoices
❌ Others     → ไม่เห็นอะไรเลย
```

---

## 🚀 Enable RLS - ทีละขั้นตอน

### Step 1: ไปที่ Supabase
```
URL: https://app.supabase.com
Action: Login with your account
```

### Step 2: เลือก Project
```
ถ้ายังไม่มี:
  1. Click "New Project"
  2. ตั้งค่า database
  3. รอให้ setup เสร็จ (2-5 นาที)

ถ้ามีแล้ว:
  1. Click ชื่อ project ของคุณ
```

### Step 3: ไปที่ SQL Editor
```
ทางซ้าย (Sidebar):
  Click: SQL Editor
```

### Step 4: สร้าง Query ใหม่
```
ที่ข้างบน (Top bar):
  Click: New Query (หรือ + icon)
```

### Step 5: Copy ไฟล์ RLS SQL

**จากที่นี่ Copy ทั้งหมด:**
```
File: enable-rls-policies.sql
```

### Step 6: Paste ลงใน SQL Editor
```
1. Copy ทั้งไฟล์ enable-rls-policies.sql
2. Paste เข้า SQL Editor
3. Ctrl+A (Select all)
4. Ctrl+C (Copy)
```

### Step 7: Run Query
```
ปุ่มสีเขียว (Top right):
  Click: Run (หรือ Ctrl+Enter)
```

### Step 8: รอให้เสร็จ
```
แล้วจะเห็น:
  ✅ "Success. No rows returned."
  ✅ ใช้เวลา 10-30 วินาที
```

### Step 9: ตรวจสอบ Success
```
1. ไปที่ Table editor (ด้านซ้าย)
2. ดู table list
3. ควรเห็น 🔒 icon ถัดจากชื่อ table
4. หมายความว่า: RLS enabled!
```

---

## 📊 What Gets Enabled

### 23 Tables Protected:
```
✅ users                    (Admin only)
✅ customers                (Front desk + Admin)
✅ vehicles                 (Front desk + Admin)
✅ jobs                     (Technician + Admin)
✅ invoices                 (Front desk + Admin)
✅ invoice_items            (Front desk + Admin)
✅ stock_items              (Admin only)
✅ stock_transactions       (Technician + Admin)
✅ services                 (Admin only)
✅ quotations               (Technician + Admin)
✅ requisitions             (Technician + Admin)
... + 12 more tables
```

---

## 🔑 3 User Roles Created

### 1. Admin (ผู้ดูแลระบบ)
```
Access: ✅ ทั้งหมด
- View all customers
- View all invoices
- View all jobs
- Edit settings
- Create users
- View reports
```

### 2. Technician (ช่าง)
```
Access: ✅ Jobs + Stock
- Create/edit jobs
- Record stock transactions
- View invoice items
- Cannot access: Settings, Customers
```

### 3. Front Desk (เสาะหน้าบ้าน)
```
Access: ✅ Customers + Invoices
- Create/edit customers
- Create/edit vehicles
- Create invoices
- View reports
- Cannot access: Jobs, Settings
```

---

## ✅ Verification

### How to Check RLS is Working

#### 1. Using SQL Editor
```sql
-- Check if RLS is enabled on a table:
SELECT tablename 
FROM pg_tables 
WHERE rowsecurity = true;

-- Should show all 23 tables
```

#### 2. Using UI
```
1. Go to: Table editor
2. Look at table list (left sidebar)
3. Tables with 🔒 = RLS enabled
4. Should see 🔒 on all tables
```

#### 3. Test Role-Based Access
```
1. Login as admin@tbr.local → Can see all data ✅
2. Login as tech@tbr.local → Can only see jobs ✅
3. Login as desk@tbr.local → Can only see customers ✅
```

---

## ⚠️ If Something Goes Wrong

### "Error: permission denied"?
```
ปัญหา: SQL execute fail
แก้ไข:
  1. ตรวจสอบ syntax (ตัวสะกด)
  2. ลอง copy ไฟล์ใหม่
  3. ลอง run ที่ละ statement (ไม่ใช่ทั้งหมด)
  4. Check SQL Editor ว่า project ถูกต้องหรือไม่
```

### "No changes made"?
```
ปัญหา: SQL execute แต่ไม่ทำอะไร
แก้ไข:
  1. Refresh: F5
  2. ตรวจสอบว่า SQL file ถูกต้อง
  3. ลอง manually ทีละ CREATE POLICY
```

### "Tables still empty"?
```
ปัญหา: ดูเหมือนไม่มี table
แก้ไข:
  1. ตรวจสอบ project ถูก
  2. ตรวจสอบ table editor (left sidebar)
  3. Scroll down ดู table list
```

---

## 🧪 Test RLS Policies

### Test 1: Admin Access
```
1. Login: admin@tbr.local / admin123
2. Go to: Dashboard
3. Should see: All invoices ✅
```

### Test 2: Technician Access
```
1. Logout
2. Login: tech@tbr.local / tech123
3. Go to: Jobs
4. Should see: All jobs ✅
5. Try access: Customers
6. Should see: "Permission denied" or empty ✅
```

### Test 3: Desk Staff Access
```
1. Logout
2. Login: desk@tbr.local / desk123
3. Go to: Customers
4. Should see: All customers ✅
5. Try access: Jobs
6. Should see: "Permission denied" or empty ✅
```

---

## 🔒 Security Checklist

หลัง enable RLS ต้องเช็ค:

- [ ] All 23 tables have RLS enabled
- [ ] Test with 3 different roles
- [ ] Each role can only see their data
- [ ] Unauthorized access returns error
- [ ] Dashboard shows correct data per role
- [ ] Invoices created by desk staff
- [ ] Jobs viewable only by technician

---

## 🎓 How RLS Works (Technical)

### Policy Example
```sql
-- Only admin can see all users
CREATE POLICY admin_can_see_users
  ON users FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- Technician can see jobs assigned to them
CREATE POLICY tech_can_see_assigned_jobs
  ON jobs FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'technician' 
    AND assign_to = auth.uid()
  );
```

---

## 📞 Support

### If RLS doesn't work:
1. Check: Is file enable-rls-policies.sql correct?
2. Check: Did SQL execute without errors?
3. Check: Are all 23 tables showing 🔒?
4. Try: Clear browser cache + re-login
5. Check: User JWT has correct role claim

### Get Help:
- Supabase Docs: https://supabase.com/docs/guides/auth/row-level-security
- Github: https://github.com/supabase/supabase/issues

---

**After RLS is enabled:** Your system is production-ready! 🎉
