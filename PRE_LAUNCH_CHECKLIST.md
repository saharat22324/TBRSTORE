# TBR System — Pre-Launch Checklist

**Project:** TBR Garage ERP - Supabase Integration  
**Date:** ________________  
**Checked By:** ________________  

---

## ✅ Phase 1: Setup & Configuration

### Supabase Project Setup
- [ ] Supabase account created
- [ ] Project created in Supabase
- [ ] Project name: _________________
- [ ] Region selected: _________________
- [ ] Project URL noted: _________________
- [ ] anon key noted: _________________

### Credentials Configuration
- [ ] SUPABASE_URL pasted in js/supabaseConfig.js
- [ ] SUPABASE_KEY pasted in js/supabaseConfig.js
- [ ] No test/placeholder values remain
- [ ] File saved and committed (if using git)

### Database Migration
- [ ] sql-migration.sql file reviewed
- [ ] All SQL copied from file
- [ ] SQL pasted into Supabase SQL Editor
- [ ] SQL executed successfully
- [ ] No errors in execution (green checkmark)
- [ ] All 23 tables created
- [ ] RLS policies created
- [ ] Seed data inserted (shop_config, roles, services, job_statuses, sequences)

**Verify:** Go to Supabase → Database → Tables and see:
- [ ] users ✅
- [ ] roles ✅
- [ ] customers ✅
- [ ] vehicles ✅
- [ ] jobs ✅
- [ ] stock_items ✅
- [ ] invoices ✅
- [ ] (and 15 more)

---

## ✅ Phase 2: Authentication Setup

### Demo Users Created
- [ ] admin@tbr.local created
- [ ] tech@tbr.local created
- [ ] desk@tbr.local created
- [ ] All with password: admin123, tech123, desk123

### User Profiles Configured
- [ ] admin user: role_id = 1, active = true
- [ ] technician user: role_id = 2, active = true
- [ ] front_desk user: role_id = 3, active = true

**Verify:** Run this SQL in Supabase:
```sql
SELECT id, email, role_id, active FROM users;
```

Should show 3 rows with active = true

- [ ] SQL confirmed 3 users active

### Authentication Page Setup
- [ ] login.html accessible in browser
- [ ] Page loads without errors
- [ ] Demo accounts info visible on login page
- [ ] "Demo Button" works

---

## ✅ Phase 3: Application Integration

### File Structure Verified
- [ ] js/supabaseConfig.js exists
- [ ] js/supabaseService.js exists
- [ ] js/auth.js exists
- [ ] login.html exists
- [ ] sql-migration.sql exists
- [ ] Documentation files exist:
  - [ ] SUPABASE_SETUP.md
  - [ ] QUICKSTART.md
  - [ ] ARCHITECTURE.md
  - [ ] TEST_SCENARIOS.md
  - [ ] README_SUPABASE.md

### Main Application Modified
- [ ] index.html includes Supabase client library
- [ ] index.html includes supabaseConfig.js
- [ ] index.html includes supabaseService.js
- [ ] index.html includes auth.js
- [ ] Script order is correct (Supabase before business logic)
- [ ] checkAuth() called before loading data

### Database Layer Updated
- [ ] db.js has Supabase integration
- [ ] db.js has localStorage fallback
- [ ] convertSupabaseToState() function present
- [ ] loadData() tries Supabase first

---

## ✅ Phase 4: Browser Testing

### Initial Login Test
1. [ ] Open login.html in browser
2. [ ] Page loads without console errors
3. [ ] Login form displays correctly
4. [ ] Demo accounts listed

### Admin Login Test
- [ ] Email: admin@tbr.local
- [ ] Password: admin123
- [ ] Click "เข้าสู่ระบบ"
- [ ] [ ] Success message appears
- [ ] [ ] Redirected to index.html after 1-2 seconds
- [ ] [ ] Dashboard loads
- [ ] [ ] All menu items visible
- [ ] [ ] Console shows no errors
- [ ] [ ] Console shows: "[Service] User signed in: admin@tbr.local"

**Browser Console Check (F12 → Console):**
```
[Supabase] ✅ Supabase initialized ✓
[Service] ✅ User signed in: admin@tbr.local (Role: admin) ✓
[DB] ✅ โหลดจาก Supabase สำเร็จ ✓
```

### Page Navigation
- [ ] Dashboard tab loads
- [ ] ลูกค้า & รถ tab loads
- [ ] Job Card tab loads
- [ ] สต๊อกสินค้า tab loads
- [ ] Billing tab loads
- [ ] Settings tab loads
- [ ] No console errors on any page

---

## ✅ Phase 5: Feature Testing

### Test: Add Customer
1. [ ] Click "ลูกค้า & รถ"
2. [ ] Click "เพิ่มลูกค้า"
3. [ ] Fill form:
   - [ ] Name: นายสมชาย
   - [ ] Phone: 089-1234-5678
4. [ ] Click "เพิ่มลูกค้า"
5. [ ] [ ] Success message: "เพิ่มลูกค้าแล้ว"
6. [ ] [ ] Customer appears in table
7. [ ] [ ] Counter updates
8. [ ] [ ] Check Supabase: New row in customers table

### Test: Add Vehicle
1. [ ] Click "เพิ่มรถ"
2. [ ] Select customer
3. [ ] Fill:
   - [ ] Plate: มก1111กทม
   - [ ] Brand: Toyota
   - [ ] Model: Vios
4. [ ] Click "เพิ่มรถ"
5. [ ] [ ] Success message: "เพิ่มรถแล้ว"
6. [ ] [ ] Vehicle appears in table
7. [ ] [ ] Check Supabase: New row in vehicles table

### Test: Create Job
1. [ ] Click "Job Card"
2. [ ] Click "เปิดงานใหม่"
3. [ ] Select vehicle
4. [ ] Fill complaint
5. [ ] Click "เปิดงาน"
6. [ ] [ ] Job number generated (JOB-20260618-001 format)
7. [ ] [ ] Job appears in table
8. [ ] [ ] Check Supabase: New row in jobs table

### Test: Manage Stock
1. [ ] Click "สต๊อกสินค้า"
2. [ ] Click "เพิ่มรายการ"
3. [ ] Fill stock item details
4. [ ] Click "เพิ่มรายการ"
5. [ ] [ ] Stock item appears
6. [ ] [ ] Stock value calculated
7. [ ] [ ] Check Supabase: New row in stock_items table

### Test: Create Invoice
1. [ ] Click "Billing"
2. [ ] Fill customer info
3. [ ] Select stock item
4. [ ] Fill quantity
5. [ ] Click "บันทึก & ออกใบเสร็จ"
6. [ ] [ ] Invoice number generated
7. [ ] [ ] Calculations correct
8. [ ] [ ] Stock quantity decreased
9. [ ] [ ] Check Supabase: New rows in invoices and invoice_items tables

---

## ✅ Phase 6: Data Persistence

### Test: Page Refresh
1. [ ] Add customer
2. [ ] Refresh page (F5)
3. [ ] [ ] Customer still visible
4. [ ] [ ] No data loss
5. [ ] [ ] Console shows "Loading from Supabase"

### Test: Browser Close/Reopen
1. [ ] Close browser tab
2. [ ] Reopen login.html
3. [ ] [ ] Logged in (session persists)
4. [ ] [ ] Previous data visible

### Test: localStorage Backup
1. [ ] F12 → Application → Storage → localStorage
2. [ ] [ ] See "tbr-system-v1" key
3. [ ] [ ] Contains customer/job/vehicle data

---

## ✅ Phase 7: Role-Based Access

### Test: Technician Role
1. [ ] Logout
2. [ ] Login as tech@tbr.local / tech123
3. [ ] [ ] Dashboard accessible
4. [ ] [ ] Can add job
5. [ ] [ ] Can view stock
6. [ ] [ ] Cannot edit stock price
7. [ ] [ ] Settings not accessible

**Verify:** Edit stock item price:
- [ ] Try to edit
- [ ] Cannot change sell_price
- [ ] Or changes don't save

### Test: Front Desk Role
1. [ ] Logout
2. [ ] Login as desk@tbr.local / desk123
3. [ ] [ ] Dashboard accessible
4. [ ] [ ] Can add customer
5. [ ] [ ] Can create invoice
6. [ ] [ ] Cannot manage stock
7. [ ] [ ] Cannot create job

---

## ✅ Phase 8: Error Handling & Fallbacks

### Test: Network Error Simulation
1. [ ] F12 → Network tab
2. [ ] Set throttling to "Offline"
3. [ ] Try to add customer
4. [ ] [ ] Falls back to localStorage
5. [ ] [ ] Data saves locally
6. [ ] [ ] Set network back to "Online"
7. [ ] [ ] Refresh page
8. [ ] [ ] Data still there

### Test: Invalid Input
1. [ ] Try to add customer without name
2. [ ] [ ] Validation error: "กรุณากรอกชื่อลูกค้า"
3. [ ] [ ] Cannot submit empty form

### Test: Duplicate Detection
1. [ ] Add vehicle with plate: มก1234กทม
2. [ ] Try to add another with same plate
3. [ ] [ ] Database prevents duplicate
4. [ ] [ ] Error shown

---

## ✅ Phase 9: Performance

### Load Time Check
- [ ] Login page loads: < 2 seconds ✓
- [ ] Dashboard loads: < 5 seconds ✓
- [ ] Tables render smoothly: ✓
- [ ] No freezing on data entry: ✓

### Database Performance
- [ ] Add 10+ customers: Responsive ✓
- [ ] Add 10+ vehicles: Responsive ✓
- [ ] Create 10+ jobs: Responsive ✓
- [ ] Query stock list: Fast ✓

---

## ✅ Phase 10: Documentation Review

- [ ] README_SUPABASE.md complete and accurate
- [ ] SUPABASE_SETUP.md has all steps
- [ ] QUICKSTART.md is clear and concise
- [ ] ARCHITECTURE.md explains system
- [ ] TEST_SCENARIOS.md has all test cases
- [ ] All screenshots/diagrams present
- [ ] No broken links
- [ ] Instructions tested and verified

---

## ✅ Phase 11: Security Review

### Authentication
- [ ] Passwords hashed (bcrypt)
- [ ] Sessions using JWT
- [ ] HTTPS enforced
- [ ] No credentials in code

### Authorization
- [ ] RLS policies active
- [ ] Role-based access working
- [ ] Technician can't edit prices
- [ ] Front Desk can't delete data

### Data Protection
- [ ] Database backups configured
- [ ] Regular exports scheduled
- [ ] Sensitive data protected
- [ ] Audit trail present

---

## ✅ Phase 12: Team Training

### Completed
- [ ] Admin trained on full system
- [ ] Technician trained on job/stock features
- [ ] Front Desk trained on customer/billing
- [ ] All users tested login
- [ ] All roles verified permissions
- [ ] Team handbook created
- [ ] Questions answered

---

## ✅ Phase 13: Data Backup

### Backup Strategy
- [ ] Daily export configured
- [ ] Backup storage secured
- [ ] Restoration tested
- [ ] Multiple backup copies kept
- [ ] Emergency recovery plan documented

### Initial Backup
- [ ] Initial data exported
- [ ] Backup file stored safely
- [ ] File integrity verified
- [ ] Backup location documented: _________________

---

## ✅ Phase 14: Go-Live Preparation

### Final Checks
- [ ] No console errors
- [ ] No missing data
- [ ] All features tested
- [ ] Team trained
- [ ] Backups ready
- [ ] Support plan ready

### Cutover Plan
- [ ] Old system backed up
- [ ] Migration plan documented
- [ ] Rollback plan ready
- [ ] Support contact info ready
- [ ] Team on standby

### Launch Date
- [ ] Target date: _________________
- [ ] All approvals: _________________
- [ ] Go-no-go decision: _________________

---

## 📋 Sign-Off

### Prepared By
- Name: _________________________
- Date: _________________________
- Signature: _________________________

### Reviewed By
- Name: _________________________
- Date: _________________________
- Signature: _________________________

### Approved By
- Name: _________________________
- Title: _________________________
- Date: _________________________
- Signature: _________________________

---

## 📝 Notes & Issues

### Critical Issues (Must Fix Before Launch)
```
1. ____________________________________
   Status: ______ Target Fix: ______

2. ____________________________________
   Status: ______ Target Fix: ______
```

### Minor Issues (Can Fix After Launch)
```
1. ____________________________________
   Priority: ______ Scheduled: ______

2. ____________________________________
   Priority: ______ Scheduled: ______
```

### Follow-Up Actions
```
1. ____________________________________
   Owner: ____________________

2. ____________________________________
   Owner: ____________________
```

---

## 🎯 Final Status

**Overall Status:** ☐ Ready to Launch  ☐ Needs More Work

**Ready When:**
- ☐ All checkboxes completed
- ☐ All critical issues resolved
- ☐ Team trained and confident
- ☐ Backups tested and verified
- ☐ Management approval obtained

---

**Date Completed:** _________________________

**System Ready for Production:** ☐ YES ☐ NO

**Launch Approved:** ☐ YES ☐ NO

---

**Congratulations! Your TBR System is ready to go live! 🚀**
