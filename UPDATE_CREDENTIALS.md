# 📋 UPDATE PRODUCTION CREDENTIALS - คู่มือแบบละเอียด

## 🎯 เป้าหมาย
แก้ไฟล์ `index.html` เพื่อใช้ credentials ของ production Supabase project แทน development

---

## 📝 ขั้นตอนทีละขั้น

### Step 1: เปิดไฟล์ index.html
```
ไฟล์: c:\Users\PERTS\OneDrive\Desktop\TBR-System\index.html
ใช้: VS Code หรือ editor อื่นๆ
```

### Step 2: หาบรรทัด SUPABASE_URL
```
ค้นหา: Ctrl+F → พิมพ์ "SUPABASE_URL"
ควรเจอที่บรรทัดประมาณ 20-30
```

### Step 3: ดู Current Credentials
```javascript
// ก่อนหน้านี้ (Development):
const SUPABASE_URL = 'https://tgtuxvmuapiltmkulvlk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8mmv4aAB8mPRvYe459ZwGQ_KVVJROax';
```

### Step 4: หา Production Credentials

#### วิธี 1: สร้าง Project ใหม่
```
1. ไปที่ https://app.supabase.com
2. กด "New Project"
3. ใส่ชื่อ: "TBR System Production"
4. เลือก region: "Southeast Asia (Singapore)"
5. กด "Create new project"
6. รอ 2-5 นาที ให้ setup เสร็จ
```

#### วิธี 2: หา API Credentials
```
1. เลือก Project ที่เพิ่งสร้าง (หรือ existing project)
2. ไปที่: Settings → API (ซ้ายสุด)
3. หาเซคชั่น "Project API keys"
4. คัดลอก 2 อย่าง:
   
   a) Project URL (ทั้งลิงค์):
      https://[xxxxx].supabase.co
   
   b) Publishable Key (anon key):
      sb_publishable_[xxxxx]
      
   ⚠️  ห้ามใช้ Service Role Key!
```

### Step 5: แก้ไขใน index.html
```javascript
// แก้จาก:
const SUPABASE_URL = 'https://tgtuxvmuapiltmkulvlk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8mmv4aAB8mPRvYe459ZwGQ_KVVJROax';

// เป็น:
const SUPABASE_URL = 'https://[YOUR_PROJECT_ID].supabase.co';
const SUPABASE_KEY = 'sb_publishable_[YOUR_ANON_KEY]';

// ตัวอย่าง (หลังแก้):
const SUPABASE_URL = 'https://mycompany-prod.supabase.co';
const SUPABASE_KEY = 'sb_publishable_abc123def456ghi789';
```

### Step 6: บันทึกไฟล์
```
Ctrl+S ใน VS Code
หรือเมนู File → Save
```

### Step 7: ทดสอบ
```
1. Refresh browser: F5
2. ลองสร้าง Invoice ใหม่
3. เช็ค: มีข้อมูลเขียนใน Supabase ไหม?
   - ไป https://app.supabase.com
   - ไปที่ Table editor
   - ดู invoices table
   - ควรเห็น invoice ที่เพิ่งสร้าง
```

---

## ⚠️ สำคัญ!

### ห้ามทำ:
- ❌ ใช้ Service Role Key (มีความสำคัญมากเกินไป)
- ❌ Share credentials ให้คนอื่น
- ❌ Commit ไปยัง GitHub / Git
- ❌ ใช้ development project สำหรับ production

### ต้องทำ:
- ✅ ใช้ Publishable Key (anon) เท่านั้น
- ✅ เก็บ credentials ให้ปลอดภัย
- ✅ Enable RLS policies ใน Supabase
- ✅ สร้าง project ใหม่สำหรับ production

---

## 🔐 Security Best Practices

### 1. Separate Environments
```
Development:  https://dev.supabase.co     ← ใช้ตอนพัฒนา
Production:   https://prod.supabase.co    ← ใช้ production จริง
```

### 2. Protect Your Keys
```
- เก็บไว้ปลอดภัย (ไม่โพสต์ online)
- ถ้า exposed → regenerate immediately
- ใช้ environment variables ในเซิร์ฟเวอร์
```

### 3. Enable RLS
```
- ต้องทำหลังสร้าง project
- ใช้ไฟล์: enable-rls-policies.sql
- ตรวจสอบ: All 23 tables have RLS enabled
```

---

## ❓ Troubleshooting

### "Invoice not saving"?
```
ปัญหา: Credentials ไม่ถูก
วิธีแก้:
  1. ตรวจสอบ URL ถูก?
  2. ตรวจสอบ Key ถูก?
  3. ลอง clear cache: Ctrl+Shift+Del
  4. ลอง incognito mode
  5. ตรวจ browser console: F12 → Console
```

### "RLS permission denied"?
```
ปัญหา: RLS policies ยังไม่เปิด
วิธีแก้:
  1. ไป Supabase SQL Editor
  2. ใช้: enable-rls-policies.sql
  3. Run → ดูสถานะ
```

### "Cannot connect to Supabase"?
```
ปัญหา: Network issue
วิธีแก้:
  1. ตรวจสอบ internet connection
  2. ตรวจสอบ firewall/proxy
  3. ลองใน incognito
  4. ลอง VPN
```

---

## ✅ Verification Checklist

หลังแก้เสร็จแล้วต้องเช็ค:

- [ ] URL ใน index.html ถูก
- [ ] Key ใน index.html ถูก
- [ ] ไฟล์ saved
- [ ] Browser refresh (F5)
- [ ] ลอง login
- [ ] ลอง create invoice
- [ ] ตรวจ Supabase → invoices table มีข้อมูล?
- [ ] Console (F12) ไม่มี error แดง

---

## 📞 ถ้าไม่รู้ credentials

### Option 1: สร้าง Project ใหม่ (แนะนำ)
```
1. ไป https://app.supabase.com
2. Login / Sign up
3. New Project
4. ตั้งค่า database
5. รอให้เสร็จ
6. Copy credentials
```

### Option 2: ใช้ Existing Project
```
1. ไปที่โปรเจคเดิม
2. Settings → API
3. Copy URL + Publishable Key
```

---

**เมื่อเสร็จแล้ว:** ระบบพร้อมใช้งาน production! 🎉
