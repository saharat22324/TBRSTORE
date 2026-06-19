# 📋 REMAINING TASKS - PRODUCTION CHECKLIST

## ✅ Currently Complete (85%)

- [x] All UI pages built and functional
- [x] Supabase integration working
- [x] Invoice → Dashboard real-time update verified
- [x] 10 oil products in inventory
- [x] RLS policies SQL created
- [x] Documentation written

---

## ⚠️ REMAINING (15%) - MUST DO BEFORE GO-LIVE

### 1️⃣ **🔐 Enable RLS Policies in Supabase (Critical)**

**Status:** SQL file created, but NOT YET ENABLED in Supabase

**What to do:**
```
1. Go to: https://app.supabase.com
2. Select Project: TBR System
3. SQL Editor → New Query
4. Copy file: enable-rls-policies.sql
5. Paste in SQL Editor
6. Click "Run" → Wait for "Success"
7. Verify: All 23 tables now have RLS enabled
```

**Why:** 
- Without RLS: Anyone with Supabase credentials can access all data
- With RLS: Users can only access data for their role (admin/tech/desk)
- Required for multi-user security

**Time:** 2 minutes

---

### 2️⃣ **🌍 Update Production Environment Variables**

**Status:** Currently using development credentials

**Files to update:**
```
File: index.html (line ~20-30)
```

**What to change:**
```javascript
// BEFORE (Development)
const SUPABASE_URL = 'https://tgtuxvmuapiltmkulvlk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8mmv4aAB8mPRvYe459ZwGQ_KVVJROax';

// AFTER (Production)
const SUPABASE_URL = '[YOUR_PRODUCTION_URL]';
const SUPABASE_KEY = '[YOUR_PRODUCTION_KEY]';
```

**Where to get credentials:**
1. Create NEW Supabase project (separate from dev)
2. Go to Project Settings → API
3. Copy: Project URL + Publishable Key (anon)
4. ⚠️ DO NOT use Service Role Key in frontend!

**Time:** 5 minutes

---

### 3️⃣ **📊 Auto-Refresh Dashboard Invoice Data (Recommended)**

**Status:** Currently only updates when page loads or invoice is created

**Enhancement:** Make Dashboard auto-refresh every 30 seconds or when user returns to tab

**Optional code to add to dashboard.js:**
```javascript
// Auto-refresh dashboard data every 30 seconds
async function dashboardAutoRefresh() {
  if (currentTab === 'dash' && useSupabase && typeof getInvoices === 'function') {
    try {
      S.invoices = await getInvoices() || S.invoices;
      if (currentTab === 'dash') renderPanel(); // Re-render if still on dashboard
    } catch(err) {
      console.warn('[Dashboard] Auto-refresh failed:', err);
    }
  }
}

// Start refresh interval
setInterval(dashboardAutoRefresh, 30000);
```

**Why:** If multiple users create invoices, your dashboard will show latest data without manual refresh

**Time:** 5 minutes (optional)

---

### 4️⃣ **🚀 Deploy to Production Server**

**Status:** Currently running on localhost:8000

**Three deployment options:**

#### Option A: Simple Python Server (Easiest)
```bash
# On production server
cd /var/www/tbr-system
python3 -m http.server 8080

# Access: http://[server-ip]:8080
# Problem: Server dies if terminal closes
```

#### Option B: Docker Container (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["npx", "http-server", "-p", "8080", "-c-1"]
```

```bash
# Build & run
docker build -t tbr-system .
docker run -d -p 8080:8080 --name tbr-system tbr-system
```

#### Option C: Nginx Reverse Proxy (Enterprise)
```nginx
server {
    listen 80;
    server_name tbr.yourdomain.com;
    
    root /var/www/tbr-system;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass https://tgtuxvmuapiltmkulvlk.supabase.co;
    }
}
```

**Time:** 15-30 minutes depending on option

---

## 📋 OPTIONAL ENHANCEMENTS (Not Required for MVP)

- [ ] Add email notifications for invoices
- [ ] Auto-backup to Google Drive / Dropbox
- [ ] SMS alerts for low stock
- [ ] Mobile app (iOS/Android)
- [ ] Accounting integration (QuickBooks)
- [ ] Multi-location support
- [ ] Customer payment portal
- [ ] Automated invoice reminders

---

## 🧪 FINAL TESTING BEFORE GO-LIVE

Run this checklist to verify everything works:

```
□ Login with admin@tbr.local / admin123 → Dashboard loads
□ Create new customer (Customers page)
□ Create new invoice with oil product (Billing page)
□ Verify Dashboard metrics update immediately:
  - ยอดขาย should show new amount
  - กำไร should calculate correctly
  - Chart should update
□ Delete invoice from Reports → Stock should restore
□ Switch between all 6 tabs without errors
□ Browser console (F12) has no red errors
□ Check Supabase SQL Editor - invoices table has new record
□ Test with role:desk@tbr.local (should not access Settings)
□ Try with role:tech@tbr.local (should not access Customers)
□ Create 3 invoices → Dashboard chart shows monthly progression
□ Page load time < 3 seconds
```

---

## 📊 DEPLOYMENT READINESS MATRIX

| Task | Status | Priority | Time |
|------|--------|----------|------|
| Enable RLS | ⚠️ Pending | 🔴 Critical | 2 min |
| Prod Credentials | ⚠️ Pending | 🔴 Critical | 5 min |
| Auto-Refresh (opt) | ⚠️ Pending | 🟡 Nice-to-have | 5 min |
| Deploy Server | ⚠️ Pending | 🔴 Critical | 30 min |
| Final Testing | ⚠️ Pending | 🟡 Important | 20 min |

**Total Time to Production:** ~60 minutes ⏱️

---

## ✅ GO-LIVE CHECKLIST

Before clicking "deploy":
- [ ] RLS policies enabled in Supabase
- [ ] Production credentials updated in index.html
- [ ] Database backup created
- [ ] Admin user created for production
- [ ] Demo accounts disabled (optional)
- [ ] Email notifications configured (optional)
- [ ] All 6 tabs tested manually
- [ ] Console has no errors
- [ ] Response times acceptable
- [ ] Team trained on system

---

## 🎯 QUICK START FOR DEPLOYMENT

### Step 1: Enable Security (5 min)
```
1. Open: https://app.supabase.com/project/[project-id]/sql/new
2. Paste: enable-rls-policies.sql
3. Run → Success
```

### Step 2: Update Credentials (5 min)
```
1. Open: index.html
2. Find: SUPABASE_URL & SUPABASE_KEY
3. Replace with production values
4. Save
```

### Step 3: Deploy Code (30 min)
```
1. Upload files to server
2. Start web server (Python/Docker/Nginx)
3. Access: http://[server-ip]:[port]/login.html
```

### Step 4: Verify (20 min)
```
1. Login with admin account
2. Create test invoice
3. Verify Dashboard updates
4. Check Supabase shows data
```

### Step 5: Train Users (30+ min)
```
1. Show login process
2. Demo creating invoice
3. Explain role-based access
4. Review error procedures
```

**Total: ~90 minutes to full production** ⏱️

---

## 📞 TROUBLESHOOTING

### RLS Not Working?
```
1. Check: Are all 23 tables showing "RLS enabled" in Supabase?
2. If not: Run enable-rls-policies.sql again
3. Check: User JWT has correct role claim
4. Test: Try viewing data as different role
```

### Dashboard shows ฿0?
```
1. Check: Invoices created in current month?
2. Check: Browser console for errors
3. Check: Supabase invoices table has data
4. Solution: Reload page or clear cache
```

### Slow Loading?
```
1. Check: Database query times in Supabase Logs
2. Check: Network speed (F12 → Network tab)
3. Check: Server CPU/memory usage
4. Optimize: Add database indexes if needed
```

---

## 🎓 POST-LAUNCH MAINTENANCE

### Week 1:
- [ ] Monitor for errors
- [ ] Collect user feedback
- [ ] Fix critical bugs
- [ ] Performance optimization

### Week 2-4:
- [ ] User training sessions
- [ ] Process refinement
- [ ] Data cleanup if needed
- [ ] Security audit

### Ongoing:
- [ ] Daily backups
- [ ] Weekly performance review
- [ ] Monthly security audit
- [ ] Quarterly feature planning

---

**Summary:** System is 85% complete and fully functional. Remaining 15% is production deployment setup (RLS, credentials, server). Approximately 90 minutes from now to full production deployment.

**Next action:** Enable RLS policies in Supabase SQL Editor.
