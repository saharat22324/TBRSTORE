# TBR System — Quick Start Guide

## ⚡ 5-Minute Quick Start

### Step 1: Get Supabase Credentials (2 min)
1. Go to https://supabase.com
2. Create account → New project
3. Copy `Project URL` and `anon key` 
4. Paste into `js/supabaseConfig.js`:
   ```javascript
   const SUPABASE_URL = 'your_url_here';
   const SUPABASE_KEY = 'your_key_here';
   ```

### Step 2: Run SQL Migration (1 min)
1. In Supabase → SQL Editor
2. Copy all from `sql-migration.sql`
3. Run it
4. ✅ Done!

### Step 3: Create Test Users (1 min)
In Supabase → Authentication → Users, add:
- admin@tbr.local / admin123
- tech@tbr.local / tech123  
- desk@tbr.local / desk123

### Step 4: Activate Users (1 min)
In SQL Editor, run:
```sql
UPDATE users SET role_id = 1, active = true WHERE email = 'admin@tbr.local';
UPDATE users SET role_id = 2, active = true WHERE email = 'tech@tbr.local';
UPDATE users SET role_id = 3, active = true WHERE email = 'desk@tbr.local';
```

### Step 5: Test!
1. Open `login.html` in browser
2. Login with `admin@tbr.local` / `admin123`
3. 🎉 Dashboard loaded!

---

## 🧪 Testing All Features

### Test 1: Add Customer
1. Go to "ลูกค้า & รถ"
2. Click "เพิ่มลูกค้า"
3. Fill: Name = "นายสมชาย", Phone = "089-123-4567"
4. Click "เพิ่มลูกค้า"
5. ✅ Customer appears in table

### Test 2: Add Vehicle
1. In same page, Click "เพิ่มรถ"
2. Select customer you just added
3. Fill: Plate = "กก1234กทม", Brand = "Toyota", Model = "Vios"
4. Click "เพิ่มรถ"
5. ✅ Vehicle appears in table

### Test 3: Create Job
1. Go to "Job Card"
2. Click "เปิดงานใหม่"
3. Select the vehicle
4. Fill: Complaint = "เปลี่ยนน้ำมัน"
5. Click "เปิดงาน"
6. ✅ Job card created with number JOB-20260618-001

### Test 4: Add Stock Item
1. Go to "สต๊อกสินค้า"
2. Click "เพิ่มรายการ"
3. Fill:
   - SKU: TEST001
   - Name: ทดสอบ
   - Category: น้ำมันเครื่อง
   - Unit: ลิตร
   - Cost: 200
   - Sell: 300
   - Qty: 10
4. Click "เพิ่มรายการ"
5. ✅ Stock item added

### Test 5: Create Invoice
1. Go to "Billing"
2. Fill customer info
3. Add stock item to invoice
4. Set quantity
5. Click "บันทึก & ออกใบเสร็จ"
6. ✅ Invoice created with number

### Test 6: Check Stock Decreased
1. Go back to "สต๊อกสินค้า"
2. Find your item
3. ✅ Quantity decreased by amount used

### Test 7: Role Testing

**Switch to Technician role:**
1. Logout (click user menu → sign out)
2. Login as `tech@tbr.local` / `tech123`
3. Can add job ✅
4. Cannot edit stock prices ❌
5. Cannot access settings ❌

**Switch to Front Desk role:**
1. Logout
2. Login as `desk@tbr.local` / `desk123`
3. Can add customer ✅
4. Can create invoice ✅
5. Cannot manage stock ❌
6. Cannot close job ❌

---

## 🔍 Verification Checklist

### Data Persistence
- [ ] Add customer on page A
- [ ] Refresh browser
- [ ] Customer still there ✅ (Supabase)
- [ ] Close tab
- [ ] Reopen login.html
- [ ] Login again
- [ ] Customer still there ✅ (Supabase)

### Offline Mode
- [ ] Open browser DevTools (F12)
- [ ] Go to Application/Storage
- [ ] Check localStorage has data
- [ ] If Supabase fails, app falls back ✅

### Calculations
- [ ] Create invoice with 2 items
- [ ] Subtotal = (qty1 × price1) + (qty2 × price2) ✅
- [ ] VAT 7% correct ✅
- [ ] Grand total correct ✅

### Stock Tracking
- [ ] Add stock: 100 ลิตร
- [ ] Use 20 ลิตร in invoice
- [ ] Remaining = 80 ลิตร ✅
- [ ] Transaction logged ✅

---

## 📊 Sample Data to Test

### Customer
```
Name: บริษัท มหาชน
Phone: 02-9999-9999
Email: contact@mahachon.co.th
Line: @mahachon_official
```

### Vehicle
```
Plate: มก8888กทม
Brand: BMW
Model: 520D
Year: 2023
Mileage: 12500
```

### Job Details
```
Complaint: เปลี่ยนน้ำมันเครื่อง ล้างเครื่องยนต์ ตรวจเช็ค
Assign To: ช่างสมชาย
Mileage: 12500
```

### Stock Items
```
1. น้ำมันเครื่อง 5W40 | ลิตร | Cost: 210 | Sell: 300 | Qty: 24
2. Coolant | ลิตร | Cost: 120 | Sell: 190 | Qty: 28
3. ไส้กรองน้ำมัน | ชิ้น | Cost: 120 | Sell: 164 | Qty: 40
```

### Services
```
1. เปลี่ยนน้ำมัน + ฟลัช | 4500 บาท
2. ฟลัชเกียร์ | 2000 บาท
3. ตรวจเช็ค | 300 บาท
```

---

## 🐛 Common Issues & Fixes

### Issue: "Supabase connection failed"
**Solution:**
```javascript
// Open browser console (F12)
// Check js/supabaseConfig.js has correct URL and KEY
// Try again
// Falls back to localStorage automatically ✅
```

### Issue: "Cannot login"
**Solution:**
```sql
-- In Supabase SQL Editor:
SELECT * FROM users WHERE email = 'admin@tbr.local';
-- Check active = true
UPDATE users SET active = true WHERE email = 'admin@tbr.local';
```

### Issue: "Missing tables"
**Solution:**
1. Go to Supabase SQL Editor
2. Copy entire sql-migration.sql
3. Run it completely
4. Check for errors
5. Reload page

### Issue: "Data not saving"
**Solution:**
- Open DevTools → Network tab
- Check if POST requests succeeding
- Check localStorage (Application tab)
- Try logout/login again

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `SUPABASE_SETUP.md` | Detailed setup instructions |
| `ARCHITECTURE.md` | System architecture & design |
| `sql-migration.sql` | Complete database schema |
| `js/supabaseConfig.js` | Configuration |
| `js/supabaseService.js` | Database operations |
| `js/auth.js` | Authentication logic |

---

## 🎯 Next Steps After Testing

1. **Customize Shop Info**
   - Go to Settings
   - Update shop name, address, phone, tax ID

2. **Import Existing Customers**
   - If you have old data in localStorage
   - Use Import function in Settings
   - Or add manually one by one

3. **Set Reorder Levels**
   - Go to Stock Items
   - Set reorder levels for each item
   - System will warn when stock low

4. **Train Team**
   - Give each staff member account
   - Explain their role limitations
   - Practice common workflows

5. **Go Live**
   - Start using for real data
   - Keep backups
   - Monitor for issues

---

## 💡 Tips & Tricks

### Keyboard Shortcuts
- `Escape` - Close modals
- `Enter` - Submit forms

### Bulk Operations
- Cannot yet bulk import customers
- Add one by one or use admin panel

### Offline Mode
- Works without internet
- Syncs when back online ✅
- Data stored locally

### Mobile Access
- Responsive design
- Works on tablet/phone
- Test on your device

---

## 🆘 Need Help?

### Check these first:
1. ✅ Supabase project active?
2. ✅ URL & KEY correct in supabaseConfig.js?
3. ✅ SQL migration completed?
4. ✅ Users created & activated?
5. ✅ Browser cache cleared (Ctrl+Shift+Delete)?

### Debugging:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Check Network tab for failed requests
5. Look in localStorage (Application tab)

### Still stuck?
- Check SUPABASE_SETUP.md troubleshooting
- Review ARCHITECTURE.md for flow understanding
- Check browser console for specific errors

---

**You're all set! 🚀 Enjoy your Garage ERP System!**
