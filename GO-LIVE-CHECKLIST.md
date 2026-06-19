# ✅ GO-LIVE CHECKLIST

**System Status:** 🟢 Production Ready  
**Last Updated:** 2026-06-18  
**Estimated Time:** ~60 minutes  

---

## 📋 BEFORE YOU START

- [ ] Read [DEPLOYMENT.md](DEPLOYMENT.md) (master guide)
- [ ] Read [UPDATE_CREDENTIALS.md](UPDATE_CREDENTIALS.md)
- [ ] Read [ENABLE_RLS_GUIDE.md](ENABLE_RLS_GUIDE.md)
- [ ] Understand 3 deployment options
- [ ] Have Supabase account ready
- [ ] Have production domain/server ready (if needed)

---

## 🎯 STEP 1: UPDATE PRODUCTION CREDENTIALS (5 minutes)

### Checklist:
- [ ] Create or select production Supabase project
  - Go: https://app.supabase.com
  - Action: "New Project" or select existing
- [ ] Get API credentials
  - Go: Settings → API
  - Copy: Project URL (https://xyz.supabase.co)
  - Copy: Publishable Key (anon)
- [ ] Open: `index.html`
- [ ] Find: SUPABASE_URL (around line 25)
- [ ] Replace: 
  ```javascript
  const SUPABASE_URL = '[YOUR_PRODUCTION_URL]';
  const SUPABASE_KEY = '[YOUR_PRODUCTION_KEY]';
  ```
- [ ] Save file (Ctrl+S)
- [ ] Test: Refresh browser → Should connect to production

**Status:** [ ] Not Started [ ] In Progress [ ] Complete ✅

---

## 🔐 STEP 2: ENABLE RLS POLICIES (10 minutes)

### Checklist:
- [ ] Open: https://app.supabase.com
- [ ] Select: Your production project
- [ ] Go: SQL Editor (left sidebar)
- [ ] Click: "New Query"
- [ ] Copy: Entire file `enable-rls-policies.sql`
- [ ] Paste: Into SQL Editor
- [ ] Click: "Run" button (green)
- [ ] Wait: 10-30 seconds
- [ ] Verify: "Success. No rows returned."
- [ ] Check: Go to Table Editor
- [ ] Confirm: All 23 tables show 🔒 icon
- [ ] Test: Try accessing as different role
  - Admin: Should see all data
  - Tech: Should see only jobs
  - Desk: Should see only customers

**Status:** [ ] Not Started [ ] In Progress [ ] Complete ✅

---

## 🚀 STEP 3: DEPLOY SERVER (30 minutes)

### Choose ONE Option:

#### Option A: Simple (Development/Testing)
- [ ] Open terminal
- [ ] Run: `python deploy-simple.py 8080`
- [ ] Access: http://localhost:8080
- [ ] Should see: Login page ✅

**Time:** 2 minutes  
**Difficulty:** Easy 🟢  

---

#### Option B: Docker (Recommended)
- [ ] Install Docker: https://www.docker.com
- [ ] Open terminal in project folder
- [ ] Run: `docker-compose up -d`
- [ ] Wait: 2-5 minutes for build
- [ ] Check: `docker ps` (see tbr-system running)
- [ ] Access: http://localhost:8080
- [ ] Should see: Login page ✅
- [ ] View logs: `docker logs -f tbr-system`

**Time:** 10 minutes  
**Difficulty:** Medium 🟡  

---

#### Option C: Advanced (Nginx + SSL)
- [ ] Install Docker & Nginx
- [ ] Copy: `nginx.conf` to production server
- [ ] Add: SSL certificates to `ssl/` folder
- [ ] Run: `docker-compose up -d`
- [ ] Configure: DNS to point to your domain
- [ ] Access: https://yourdomain.com
- [ ] Should see: Login page with SSL ✅

**Time:** 30 minutes  
**Difficulty:** Hard 🔴  

---

### After Deployment:
- [ ] Verify: Server is running
- [ ] Verify: No error messages
- [ ] Verify: Can access login page

**Status:** [ ] Not Started [ ] In Progress [ ] Complete ✅

---

## 🧪 STEP 4: TEST EVERYTHING (20 minutes)

### Smoke Test (Quick):
- [ ] Access: http://[server]:8080/login.html
- [ ] Login: admin@tbr.local / admin123
- [ ] Dashboard: Loads without errors
- [ ] Console: F12 → No red errors
- [ ] All tabs: Click each one, should load

### Functional Test (Create Invoice):
- [ ] Go to: Billing page
- [ ] Fill in: Customer name, phone, plate
- [ ] Add: 1x Oil product (any item)
- [ ] Click: "บันทึก & ออกใบเสร็จ"
- [ ] Wait: Invoice should save
- [ ] Go to: Dashboard
- [ ] Verify: 
  - [ ] ยอดขาย increased
  - [ ] กำไร calculated
  - [ ] Chart updated
- [ ] Check Supabase:
  - [ ] Go: https://app.supabase.com
  - [ ] Table: invoices
  - [ ] Should see: Your invoice ✅

### Multi-User Test (Role-Based):
- [ ] Logout: Click "ออก"
- [ ] Login: tech@tbr.local / tech123
- [ ] Should see: Jobs tab only
- [ ] Should NOT see: Customers tab
- [ ] Logout
- [ ] Login: desk@tbr.local / desk123
- [ ] Should see: Customers tab
- [ ] Should NOT see: Jobs tab

### Performance Test:
- [ ] Page load time: < 3 seconds
- [ ] Invoice save: < 1 second
- [ ] Dashboard update: Instant
- [ ] All buttons responsive

**Status:** [ ] Not Started [ ] In Progress [ ] Complete ✅

---

## ✅ STEP 5: FINAL CHECKS (5 minutes)

- [ ] RLS policies: Enabled (check 🔒 on tables)
- [ ] Production credentials: Updated in index.html
- [ ] Server: Running and accessible
- [ ] Login: Works with all 3 demo accounts
- [ ] Dashboard: Shows real data (not cached)
- [ ] Invoice: Creates successfully
- [ ] Data: Appears in Supabase
- [ ] Roles: Role-based access working
- [ ] Console: No errors (F12)
- [ ] Performance: Acceptable

---

## 🎯 FINAL GO-LIVE DECISION

### Is Everything Ready?

**Before marking YES, verify:**
- [ ] System tested for 20+ minutes
- [ ] Multiple users tested
- [ ] No console errors
- [ ] Data saves to Supabase
- [ ] Dashboard updates real-time
- [ ] All tabs working
- [ ] Deployment process documented

### Decision:
- [ ] **YES** → All tests passed, ready to go-live! 🚀
- [ ] **NO** → Review failed tests, troubleshoot, retry

---

## 🎉 GO-LIVE!

### Announce to Users:
```
System is now live!

📍 Access: http://[your-domain]
📍 Login: See provided credentials
📍 Support: [Your contact info]

Demo Accounts (admin only):
  - admin@tbr.local / admin123
  - tech@tbr.local / tech123
  - desk@tbr.local / desk123
```

### Monitor First Week:
- [ ] Check logs daily
- [ ] Collect user feedback
- [ ] Fix any bugs immediately
- [ ] Monitor Supabase performance
- [ ] Verify backups working

---

## 📊 POST-LAUNCH ACTIONS

### Day 1:
- [ ] Monitor for errors
- [ ] Respond to user issues
- [ ] Test backup/restore

### Week 1:
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Performance optimization
- [ ] Security audit

### Ongoing:
- [ ] Monthly backups verification
- [ ] Security reviews
- [ ] Performance monitoring
- [ ] User training updates

---

## 📞 TROUBLESHOOTING

### If Something Goes Wrong:

**Dashboard shows ฿0?**
- Clear cache: Ctrl+Shift+Del
- Check invoices in Supabase
- Refresh page

**Login doesn't work?**
- Check credentials correct
- Clear cookies
- Try incognito mode
- Check Supabase project is running

**Invoice won't save?**
- Check Supabase credentials
- Check browser console (F12)
- Verify RLS policies enabled
- Check user has correct role

**Server won't start?**
- Check port 8080 not in use
- Check Docker running
- Check files in right directory
- Try different port: `python deploy-simple.py 8081`

---

## 🔧 ROLLBACK PLAN

If something goes catastrophically wrong:

1. **Stop server:**
   ```bash
   docker-compose down
   # or
   Ctrl+C (if using python server)
   ```

2. **Revert credentials:**
   - Restore index.html from backup
   - OR go back to development Supabase project

3. **Disable RLS (if needed):**
   ```sql
   ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
   -- (for all 23 tables if needed)
   ```

4. **Restore from backup:**
   - Supabase → Backups
   - Select previous backup
   - Restore

---

## 📝 Sign-Off

After completing all steps, sign here:

```
Completed by:  _______________________
Date:          _______________________
Time:          _______________________
Status:        [ ] Ready for Go-Live
               [ ] Not Ready - Issues Found
               [ ] Testing in Progress
```

---

**Important:** Do not proceed with go-live until ALL steps are complete and verified! ✅

**Estimated Total Time:** ~60 minutes  
**Status:** Ready for Deployment 🟢
