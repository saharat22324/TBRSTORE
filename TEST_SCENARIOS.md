# TBR System — Testing Scenarios

## 🧪 Complete Test Cases

### Pre-requisites
- [ ] Supabase account created
- [ ] Project created and SQL migration run
- [ ] 3 demo users created and activated
- [ ] login.html accessible in browser
- [ ] Browser developer console ready (F12)

---

## Test Suite 1: Authentication

### TC-1.1: Admin Login
**Steps:**
1. Open login.html
2. Enter email: `admin@tbr.local`
3. Enter password: `admin123`
4. Click "เข้าสู่ระบบ"

**Expected:**
- ✅ Success message shows "เข้าสู่ระบบสำเร็จ"
- ✅ Redirected to index.html after 1-2 seconds
- ✅ Dashboard loads with all menu items visible
- ✅ Console shows "[Service] User signed in: admin@tbr.local (Role: admin)"

### TC-1.2: Technician Login
**Steps:**
1. From logged-in state, open login.html in new tab
2. Clear auth session
3. Enter email: `tech@tbr.local`
4. Enter password: `tech123`
5. Click "เข้าสู่ระบบ"

**Expected:**
- ✅ Login succeeds
- ✅ Role shows as "technician" in console
- ✅ Limited menu visible (no Settings for admin)

### TC-1.3: Front Desk Login
**Steps:**
1. Login with email: `desk@tbr.local`
2. Password: `desk123`

**Expected:**
- ✅ Login succeeds
- ✅ Role shows as "front_desk"
- ✅ Dashboard accessible

### TC-1.4: Invalid Credentials
**Steps:**
1. Open login.html
2. Enter email: `admin@tbr.local`
3. Enter password: `wrongpassword`
4. Click "เข้าสู่ระบบ"

**Expected:**
- ✅ Error message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
- ✅ Not redirected
- ✅ Can try again

### TC-1.5: Logout
**Steps:**
1. While logged in, find logout button (usually in nav-right)
2. Click logout/sign out

**Expected:**
- ✅ Redirected to login.html
- ✅ Session cleared
- ✅ Cannot go back without login

---

## Test Suite 2: Customer Management

### TC-2.1: Add Customer
**Steps:**
1. Login as admin
2. Go to "ลูกค้า & รถ" tab
3. Click "เพิ่มลูกค้า" button
4. Fill:
   - Name: `บริษัท ทดสอบ`
   - Phone: `089-1234-5678`
   - Email: `test@test.com`
   - LINE ID: `@testbusiness`
   - Note: `ลูกค้าทดสอบ`
5. Click "เพิ่มลูกค้า"

**Expected:**
- ✅ Modal closes
- ✅ Success message: "เพิ่มลูกค้าแล้ว"
- ✅ Customer appears in table with count updated
- ✅ Data persists in Supabase

**Verify:**
- Check browser console: `[DB] ✅ บันทึก Supabase สำเร็จ`
- Check Supabase dashboard: customers table has new row

### TC-2.2: Edit Customer
**Steps:**
1. In customers table, click edit icon (pencil) on a customer
2. Change phone to `089-9999-9999`
3. Change name to `บริษัท ทดสอบ 2`
4. Click "บันทึก"

**Expected:**
- ✅ Modal closes
- ✅ Success message: "อัปเดตลูกค้าแล้ว"
- ✅ Table updates with new values
- ✅ Changes persist in Supabase

### TC-2.3: Delete Customer
**Steps:**
1. Click edit icon on a customer
2. Click "ลบลูกค้า" button at bottom
3. Confirm deletion in popup

**Expected:**
- ✅ Confirmation dialog appears
- ✅ Customer removed from table
- ✅ Success message: "ลบลูกค้าแล้ว"
- ✅ Customer count decreases

---

## Test Suite 3: Vehicle Management

### TC-3.1: Add Vehicle
**Steps:**
1. In "ลูกค้า & รถ" tab, click "เพิ่มรถ"
2. Select customer from dropdown
3. Fill:
   - Plate: `มก8888กทม` (must be unique)
   - Brand: `Toyota`
   - Model: `Vios`
   - Year: `2022`
   - Mileage: `5000`
4. Click "เพิ่มรถ"

**Expected:**
- ✅ Modal closes
- ✅ Success message: "เพิ่มรถแล้ว"
- ✅ Vehicle appears in vehicle table
- ✅ Customer's vehicle count increases

### TC-3.2: Vehicle Plate Uniqueness
**Steps:**
1. Try to add another vehicle with same plate `มก8888กทม`
2. Submit form

**Expected:**
- ✅ Database error or warning
- ✅ Duplicate prevented

### TC-3.3: Edit Vehicle
**Steps:**
1. Click on vehicle row to edit
2. Change mileage to `10000`
3. Click "บันทึก"

**Expected:**
- ✅ Vehicle updated
- ✅ Mileage shows as `10,000`

---

## Test Suite 4: Job Management

### TC-4.1: Create Job
**Steps:**
1. Go to "Job Card" tab
2. Click "เปิดงานใหม่"
3. Select vehicle from dropdown
4. Fill:
   - Mileage: `5000`
   - Complaint: `เปลี่ยนน้ำมันเครื่อง`
   - Assign To: `ช่างสมชาย`
   - Status: `เปิดงาน`
5. Click "เปิดงาน"

**Expected:**
- ✅ Modal closes
- ✅ New job appears in table with number format `JOB-20260618-001`
- ✅ Success message shows job number
- ✅ Status shows as blue dot (เปิดงาน)

### TC-4.2: Update Job Status
**Steps:**
1. Click on job row to open detail
2. Change status to `กำลังซ่อม`
3. Save

**Expected:**
- ✅ Status dot changes color (from blue to orange)
- ✅ Job card in table updates

### TC-4.3: Job Filter
**Steps:**
1. Click on filter buttons at top
   - "ทั้งหมด"
   - "เปิดงาน"
   - "กำลังซ่อม"
   - "ปิดงาน"

**Expected:**
- ✅ Each button filters correctly
- ✅ Count badge shows filtered number
- ✅ Table shows only filtered jobs

---

## Test Suite 5: Stock Management

### TC-5.1: Add Stock Item
**Steps:**
1. Go to "สต๊อกสินค้า" tab
2. Click "เพิ่มรายการ"
3. Fill:
   - SKU: `TEST-001`
   - Name: `ทดสอบน้ำมัน`
   - Category: `น้ำมันเครื่อง`
   - Unit: `ลิตร`
   - Cost: `200`
   - Sell: `300`
   - Quantity: `10`
   - Reorder Level: `5`
4. Click "เพิ่มรายการ"

**Expected:**
- ✅ Success message: "เพิ่มรายการสต๊อกแล้ว"
- ✅ Item appears in stock table
- ✅ Shows 10 qty with "พอใช้" badge
- ✅ Stock value calculated: 10 × 200 = 2,000

### TC-5.2: Stock Status Indicator
**Steps:**
1. In stock table, find item with qty > reorder_level (green "พอใช้")
2. Find item with qty = reorder_level (yellow "ใกล้หมด")
3. Find item with qty < 0 (red "หมด")

**Expected:**
- ✅ Color-coded badges correct
- ✅ Progress bar shows percentage

### TC-5.3: Adjust Stock (Add In)
**Steps:**
1. Find stock item
2. Click "รับ" button
3. Enter quantity: `5`
4. Confirm

**Expected:**
- ✅ Quantity increases (10 + 5 = 15)
- ✅ Transaction logged
- ✅ Stock value updates to 3,000

### TC-5.4: Edit Stock Item
**Steps:**
1. Click edit icon on stock item
2. Change sell price to `350`
3. Save

**Expected:**
- ✅ Sell price updates
- ✅ Grand total recalculated

---

## Test Suite 6: Billing (Invoice)

### TC-6.1: Create Invoice
**Steps:**
1. Go to "Billing" tab
2. Fill customer info:
   - Name: `บริษัท ทดสอบ`
   - Phone: `089-1234-5678`
   - Plate: `มก8888กทม`
3. In items section:
   - Select stock item from dropdown
   - Enter quantity: `2`
   - Click "เพิ่ม"
4. Add another item:
   - Select service from dropdown
   - Click "เพิ่ม"
5. Verify totals:
   - Subtotal correct
   - VAT calculated
   - Grand total shown
6. Click "บันทึก & ออกใบเสร็จ"

**Expected:**
- ✅ Invoice saved with number `INV-20260618-001`
- ✅ Success message with invoice number
- ✅ Stock item quantity decreased
- ✅ Invoice appears in "บิลล่าสุด" list

**Calculations Check:**
```
Item 1: 2 ลิตร × 300 = 600
Item 2: 1 Service × 4500 = 4500
Subtotal = 5,100
Discount = 0
VAT (7%) = 357
Grand Total = 5,457
```

### TC-6.2: Add Discount
**Steps:**
1. Create new invoice with items (subtotal 5,100)
2. Enter discount: `100`
3. Verify total: 5,100 - 100 + VAT = 5,357

**Expected:**
- ✅ Subtotal: 5,100
- ✅ Discount: 100
- ✅ VAT: 350.70 (on 5,000)
- ✅ Grand: 5,350.70

### TC-6.3: VAT Toggle
**Steps:**
1. Create invoice
2. Toggle VAT on/off
3. Check calculation

**Expected:**
- ✅ With VAT: Grand includes 7% tax
- ✅ Without VAT: Grand = Subtotal - Discount

### TC-6.4: Stock Deduction Verification
**Steps:**
1. Before invoice: Stock item has qty = 15
2. Create invoice using 3 units
3. After invoice: Stock item qty = 12

**Expected:**
- ✅ Quantity decreases correctly
- ✅ Transaction recorded
- ✅ Supabase updated

---

## Test Suite 7: Reports & Export

### TC-7.1: Dashboard Summary
**Steps:**
1. Go to "Dashboard"
2. Verify displayed:
   - Total customers
   - Total vehicles
   - Open jobs count
   - Stock low warning
   - Total stock value

**Expected:**
- ✅ All numbers correct
- ✅ Match actual data

### TC-7.2: Data Export
**Steps:**
1. Go to Settings
2. Click "Export" button
3. JSON file downloads

**Expected:**
- ✅ File named `tbr-backup-2026-06-18.json`
- ✅ Contains all data
- ✅ Valid JSON format

### TC-7.3: Data Import
**Steps:**
1. Have backup JSON file
2. Go to Settings
3. Click Import
4. Select JSON file
5. Confirm

**Expected:**
- ✅ Data loaded
- ✅ All tables populated
- ✅ Same data as backup

---

## Test Suite 8: Role-Based Access

### TC-8.1: Admin Permissions
**Login as admin, verify:**
- ✅ Can view Dashboard
- ✅ Can manage Customers
- ✅ Can manage Vehicles
- ✅ Can manage Jobs
- ✅ Can manage Stock
- ✅ Can create Invoices
- ✅ Can access Settings
- ✅ Can create users (if feature available)

### TC-8.2: Technician Permissions
**Login as technician (tech@tbr.local):**
- ✅ Can view Dashboard
- ✅ Can manage Customers
- ✅ Can manage Vehicles
- ✅ Can manage Jobs
- ✅ Can view Stock (READ only)
- ✅ Can create Invoices
- ❌ Cannot edit Stock prices
- ❌ Cannot access Settings

**Test:** Try to edit stock item price
- Click edit on stock item
- Try to change sell price
- ❌ Should not allow or not persist

### TC-8.3: Front Desk Permissions
**Login as front desk (desk@tbr.local):**
- ✅ Can view Dashboard
- ✅ Can manage Customers
- ✅ Can view Vehicles
- ✅ Can view Jobs
- ❌ Cannot create Job
- ✅ Can create Invoice/Quotation
- ❌ Cannot edit Stock
- ❌ Cannot access Settings

---

## Test Suite 9: Data Persistence

### TC-9.1: Supabase Persistence
**Steps:**
1. Login
2. Add customer: `นายทดสอบ`
3. Refresh page (F5)
4. Verify customer still visible

**Expected:**
- ✅ Data persists after refresh
- ✅ Console shows "Loading from Supabase"

### TC-9.2: Session Persistence
**Steps:**
1. Login as admin
2. Close browser tab (not window)
3. Open new tab to login.html
4. Navigate to index.html

**Expected:**
- ✅ Still logged in (session persists)
- ✅ Dashboard loads immediately

### TC-9.3: localStorage Fallback
**Steps:**
1. Open DevTools (F12) → Application → localStorage
2. Verify `tbr-system-v1` key exists
3. Verify contains customer/vehicle/job data

**Expected:**
- ✅ localStorage has data as JSON
- ✅ Can parse and see structure

---

## Test Suite 10: Error Handling

### TC-10.1: Network Error
**Steps:**
1. Open DevTools → Network tab
2. Set network to "Offline"
3. Try to add customer
4. Set network back to "Online"

**Expected:**
- ✅ Falls back to localStorage
- ✅ Data saves locally
- ✅ Syncs when online (if implemented)

### TC-10.2: Invalid Input
**Steps:**
1. Try to add customer with empty name
2. Leave all fields blank

**Expected:**
- ✅ Validation error shown
- ✅ Cannot submit
- ✅ Message: "กรุณากรอกชื่อลูกค้า"

### TC-10.3: Duplicate Plate
**Steps:**
1. Add vehicle with plate `มก1111กทม`
2. Try to add another with same plate

**Expected:**
- ✅ Database prevents duplicate
- ✅ Error message shown

---

## Test Suite 11: Performance

### TC-11.1: Load Time
**Steps:**
1. Open login.html
2. Measure time to load page
3. Login and measure time to dashboard

**Expected:**
- ✅ Login page loads in < 2 seconds
- ✅ Dashboard loads in < 5 seconds

### TC-11.2: Large Dataset
**Steps:**
1. Add 100+ customers
2. Add 50+ vehicles
3. Navigate between pages
4. Check performance

**Expected:**
- ✅ Still responsive
- ✅ No freezing
- ✅ Tables load without lag

### TC-11.3: Real-time Updates
**Steps:**
1. Open dashboard in 2 browser windows
2. Add customer in window 1
3. Check if updates in window 2 (if real-time implemented)

**Expected:**
- ✅ Updates appear (eventually)
- ✅ Or requires manual refresh

---

## 📝 Test Report Template

```
Test Suite: [Name]
Date: [Date]
Tester: [Name]
Browser: [Chrome/Firefox/Safari]
Supabase: [URL]

Test Results:
✅ TC-X.X: [Passed/Failed] - [Notes]

Issues Found:
- Issue 1: [Description]
  Expected: [What should happen]
  Actual: [What happened]
  Severity: [Critical/High/Medium/Low]

Overall Result: [Pass/Fail]
```

---

## ✅ Sign-Off Checklist

- [ ] All TC-1 (Auth) tests passed
- [ ] All TC-2 (Customers) tests passed
- [ ] All TC-3 (Vehicles) tests passed
- [ ] All TC-4 (Jobs) tests passed
- [ ] All TC-5 (Stock) tests passed
- [ ] All TC-6 (Billing) tests passed
- [ ] All TC-7 (Reports) tests passed
- [ ] All TC-8 (Permissions) tests passed
- [ ] All TC-9 (Persistence) tests passed
- [ ] All TC-10 (Error Handling) tests passed
- [ ] All TC-11 (Performance) tests passed
- [ ] No critical issues
- [ ] System ready for production

**Tester Sign-Off:** ________________  **Date:** __________

