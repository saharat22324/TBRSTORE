# TEAM DEPLOYMENT CONFIGURATION

## Quick Reference

### System Access
- **Live URL:** https://tbrstore.vercel.app
- **GitHub:** https://github.com/saharat22324/TBRSTORE
- **Database:** Supabase (Asia-Pacific region)

### Database Connection
```
Host: hhaduosajnvamyxrqzwd.supabase.co
Port: 5432
Database: postgres
Anon Key: sb_publishable_5ZJiyBVtCcwzi8p9qrSCOA_GnnMNj-9
```

### Team Members - Test Accounts

#### Admin User (Full Access)
- Email: admin@tbrstore.local
- Password: Admin@123456
- Permissions: Everything

#### Technician User (Job Management)
- Email: technician@tbrstore.local
- Password: Tech@123456
- Permissions: Jobs, Vehicles, Stock

#### Front Desk User (Customer Service)
- Email: frontdesk@tbrstore.local
- Password: Desk@123456
- Permissions: Customers, Vehicles, Invoices

#### Supervisor User (Approvals)
- Email: supervisor@tbrstore.local
- Password: Super@123456
- Permissions: All jobs, Invoices, Reports

---

## Database Tables

### customers
```sql
id                    -- UUID (primary key)
name                  -- TEXT (not null)
phone                 -- TEXT
email                 -- TEXT (unique)
address               -- TEXT
created_at            -- TIMESTAMP (default now)
```

### vehicles
```sql
id                    -- UUID (primary key)
customer_id           -- INTEGER (foreign key → customers)
brand                 -- TEXT
model                 -- TEXT
year                  -- INTEGER
license_plate         -- TEXT
created_at            -- TIMESTAMP (default now)
```

### jobs
```sql
id                    -- SERIAL (primary key)
job_number            -- TEXT (unique)
vehicle_id            -- INTEGER (foreign key)
status                -- INTEGER (0-5: workflow)
description           -- TEXT
created_at            -- TIMESTAMP (default now)
updated_at            -- TIMESTAMP
```

### invoices
```sql
id                    -- SERIAL (primary key)
invoice_number        -- TEXT (unique)
customer_id           -- INTEGER (foreign key)
job_id                -- INTEGER (foreign key)
amount                -- DECIMAL(10,2)
tax                   -- DECIMAL(10,2)
discount              -- DECIMAL(10,2)
created_at            -- TIMESTAMP (default now)
```

### stock
```sql
id                    -- SERIAL (primary key)
name                  -- TEXT
sku                   -- TEXT (unique)
quantity              -- INTEGER
cost                  -- DECIMAL(10,2)
selling_price         -- DECIMAL(10,2)
```

### user_roles
```sql
id                    -- SERIAL (primary key)
name                  -- TEXT (unique)
```

**Existing Roles:**
- 1: admin
- 2: technician
- 3: front_desk
- 4: supervisor

### users
```sql
id                    -- UUID (primary key, auto-generated)
email                 -- TEXT (unique, not null)
role_id               -- INTEGER (foreign key → user_roles)
created_at            -- TIMESTAMP (default now)
```

---

## Authentication & Security

### Login Flow
1. User enters email/password
2. Supabase Auth validates credentials
3. JWT token issued (valid for 1 hour)
4. Application loads with user's role
5. RLS policies apply to all data queries

### Multi-User Safety
- Each user sees only data per their role
- Write conflicts handled by "last-write-wins"
- All changes timestamped
- Audit trail in database logs

### API Authentication
```javascript
// Header required for all API calls
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

---

## Troubleshooting Guide

### Issue: "Invalid login credentials"
**Solution:**
- Verify email spelling
- Check caps lock
- Ensure user exists in Supabase Auth
- Try password reset if available

### Issue: "Permission denied" on data
**Solution:**
- Confirm user role in users table
- Check RLS is enabled on table
- Verify user's role matches required permissions
- Check browser console for detailed error

### Issue: "Cannot connect to database"
**Solution:**
- Check internet connection
- Verify Supabase project is active
- Check firewall/proxy settings
- Try incognito/private browser window

### Issue: "Data not saving"
**Solution:**
- Verify online connection
- Check browser console for errors
- Ensure you have write permission for table
- Try refreshing page
- Check localStorage in DevTools

### Issue: "RLS policy error"
**Solution:**
- This is a permission error, not a bug
- Contact admin to verify your role
- Check if you're trying to access data outside your scope
- Admin users should see all data

---

## Deployment Information

### Version Control
- Repository: saharat22324/TBRSTORE
- Branch: main (production)
- Commits: 2 (latest: 58e73ee)
- Files: 59 total
- Last deployment: 2026-06-19

### Auto-Deployment
- Service: Vercel
- Trigger: Push to GitHub main branch
- Deploy time: ~2-3 minutes
- Status: ✅ Active

### Infrastructure
- Frontend: Vercel CDN (global)
- Database: Supabase PostgreSQL (Singapore)
- Auth: Supabase Auth
- API: Supabase REST API

---

## Backup & Recovery

### Automatic Backups
- Frequency: Daily
- Retention: 30 days
- Location: Supabase cloud storage
- Recovery: Contact Supabase support

### Manual Export
```sql
-- Export customers
SELECT * FROM customers TO STDOUT WITH CSV;

-- Export all jobs with details
SELECT j.*, c.name as customer_name, v.brand, v.model
FROM jobs j
JOIN vehicles v ON j.vehicle_id = v.id
JOIN customers c ON v.customer_id = c.id
TO STDOUT WITH CSV;
```

---

## Monitoring & Alerts

### Performance Metrics
- API Response Time: < 500ms
- Database Query Time: < 200ms
- Frontend Load Time: < 3 seconds
- Uptime: 99.9%

### Error Monitoring
- Errors logged to Supabase
- Sentry integration (optional)
- Email alerts for critical issues
- Dashboard available at dashboard URL

---

## Adding New Team Members

### Step 1: Create Supabase Auth User
1. Go to Supabase Dashboard
2. Navigate to Authentication → Users
3. Click "Add User" → "Create new user"
4. Enter email and temporary password
5. User receives email with verification link

### Step 2: Assign Role
```sql
INSERT INTO users (email, role_id) VALUES
('newuser@yourcompany.com', 2);  -- 2 = technician
```

### Step 3: Notify User
- Share login URL: https://tbrstore.vercel.app
- Provide email/password
- Explain their role and permissions
- Link to training materials

### Available Roles
- 1 = Admin (full access)
- 2 = Technician (jobs, vehicles, stock)
- 3 = Front Desk (customers, vehicles, invoices)
- 4 = Supervisor (approvals, reports)

---

## Maintenance Schedule

### Daily
- Monitor error logs
- Check Supabase status page
- Verify backup completion

### Weekly
- Review performance metrics
- Update user access as needed
- Test disaster recovery

### Monthly
- Security audit
- Performance optimization
- User feedback review
- Plan next features

### Quarterly
- Major version updates
- Infrastructure review
- Compliance check
- Team training refresh

---

## Support Contacts

| Issue | Contact |
|-------|---------|
| Application Errors | Check GitHub Issues |
| Database Issues | Supabase Support |
| Deployment Issues | Vercel Dashboard |
| Authentication | Supabase Dashboard |
| General Questions | Team Lead / Admin |

---

## Documentation Links

- **Main README:** README.md
- **Architecture:** ARCHITECTURE.md
- **Deployment Guide:** DEPLOYMENT_GUIDE.md
- **Team Access:** TEAM_DEPLOYMENT_READY.md (this file)
- **API Docs:** See Supabase Dashboard
- **Git History:** GitHub Commits

---

## Configuration Files Location

```
/js/supabaseConfig.js     - Supabase credentials
/js/supabaseService.js    - Database operations
/js/db.js                 - Local storage fallback
/js/auth.js               - Authentication logic
/.env.local               - Environment variables (git-ignored)
```

---

*Configuration Last Updated: 2026-06-19*
*Maintained By: DevOps Team*
*Status: ✅ Production Ready*
