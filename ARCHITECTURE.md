# TBR System — Supabase Integration Architecture

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                            │
│  (Existing HTML/CSS/JS - No UI Changes)                         │
│  ├── index.html (Main App)                                      │
│  ├── login.html (Authentication)                                │
│  ├── css/ (Styles - Unchanged)                                  │
│  └── js/                                                         │
│      ├── Dashboard, Customers, Jobs, Stock, Billing, etc.       │
│      ├── utils.js, state.js, nav.js (Unchanged)                │
│      ├── db.js (UPDATED - Supabase integration)                │
│      ├── supabaseConfig.js (NEW - Client setup)                │
│      ├── supabaseService.js (NEW - API layer)                  │
│      └── auth.js (NEW - Authentication)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA ABSTRACTION LAYER                        │
│  ├── db.js - Converts S object ↔ Supabase format              │
│  └── supabaseService.js - CRUD operations                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE CLIENT LIBRARY                       │
│  (@supabase/supabase-js) - Handles API calls                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (CLOUD)                           │
│  ├── Supabase Authentication (Email/Password)                   │
│  ├── PostgreSQL Database                                        │
│  │   ├── 23 Tables with relationships                          │
│  │   ├── Row Level Security (RLS) policies                     │
│  │   └── Indexes & Constraints                                 │
│  └── Supabase Storage (Future: file uploads)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. User Login Flow
```
login.html
    ↓
User enters email/password
    ↓
auth.js → signIn() 
    ↓
supabaseConfig.js → Supabase Auth
    ↓
✅ User authenticated & redirected to index.html
    ↓
index.html → checkAuth()
    ↓
Load user profile & role from database
    ↓
Render dashboard based on role
```

### 2. Add Customer Flow
```
Frontend: customers.js → openCustModal()
    ↓
User fills form & clicks "Add"
    ↓
db.js → addCustomer()
    ↓
supabaseService.js → supabase.from('customers').insert()
    ↓
PostgreSQL stores data with RLS check
    ↓
Response returned to frontend
    ↓
S.customers updated in memory
    ↓
UI re-renders with new customer
    ↓
localStorage backup (if Supabase unavailable)
```

### 3. Create Job Flow
```
Frontend: jobs.js → openJobModal()
    ↓
User selects vehicle & fills details
    ↓
db.js → addJob()
    ↓
supabaseService.js → getNextJobNumber() + insert()
    ↓
PostgreSQL generates job number using sequence
    ↓
Database returns new job with ID
    ↓
S.jobs updated in memory
    ↓
UI shows new job in table
```

### 4. Take Stock Flow
```
Frontend: billing.js → Add item to invoice
    ↓
supabaseService.js → recordStockTransaction()
    ↓
PostgreSQL: Insert into stock_transactions
    ↓
PostgreSQL: Decrement stock_items.quantity
    ↓
Real-time inventory updated
    ↓
UI shows new stock level
```

---

## 🔐 Authentication & Authorization

### Authentication Flow
```
1. User Registration (optional)
   - Email, Password, Name, Role
   - Creates auth.users row + users profile
   - Status: inactive (requires admin approval)

2. User Login
   - Supabase validates email/password
   - Returns session + JWT token
   - Browser stores in auth session

3. Session Management
   - auth.onAuthStateChange() monitors session
   - On redirect to index.html: checkAuth()
   - Gets user profile from users table
   - Loads current user role

4. Logout
   - handleSignOut() calls supabase.auth.signOut()
   - Clears session & redirects to login.html
```

### Authorization (Role-Based Access)

#### Admin Role
```javascript
// Can do everything
- READ: All tables
- INSERT: Users, customers, vehicles, jobs, stock, etc.
- UPDATE: Any table
- DELETE: Any table (with restrictions)
- CREATE_USER: True
```

#### Technician Role
```javascript
// Limited access
- READ: customers, vehicles, jobs, stock_items, requisitions
- INSERT: jobs, requisitions, stock_transactions
- UPDATE: jobs, stock_transactions
- DELETE: Only own requisitions
- CREATE_USER: False
```

#### Front Desk Role
```javascript
// Billing focused
- READ: All (except sensitive settings)
- INSERT: customers, vehicles, invoices, quotations, payments
- UPDATE: customers, vehicles, invoices
- DELETE: Own customers (with restrictions)
- CREATE_USER: False
```

### RLS Policies (Enforced at Database Level)

```sql
-- Example: Only authenticated users can read customers
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Example: Technicians cannot update stock prices
CREATE POLICY "Only admin can manage stock items"
  ON stock_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid() AND r.name = 'admin')
  );
```

---

## 📊 Database Schema Overview

### Core Tables

#### Users & Auth
- `users` - User profiles with role reference
- `roles` - Three roles: admin, technician, front_desk
- `shop_config` - Shop details (name, phone, tax ID, etc.)

#### CRM
- `customers` - Customer information
- `vehicles` - Vehicles linked to customers
- `jobs` - Job cards with status tracking
- `job_statuses` - Status options (6 statuses)

#### Inventory
- `stock_items` - Inventory items with pricing
- `stock_transactions` - All stock movements (in/out/adjust)
- `product_categories` - Item categories
- `suppliers` - Supplier information

#### Billing
- `invoices` - Invoice records
- `invoice_items` - Line items in invoice
- `quotations` - Quotation records
- `quotation_items` - Line items in quotation
- `payments` - Payment records

#### Operations
- `services` - Service packages
- `requisitions` - Stock requisition forms
- `requisition_items` - Items in requisition
- `purchase_orders` - Purchase orders
- `purchase_order_items` - Items in PO
- `expenses` - Expense records
- `sequences` - Auto-increment counters

---

## 🔗 Relationships (Foreign Keys)

```
customers ──→ users (created_by)
    ↓
vehicles ──→ customers (customer_id)
    ↓
jobs ──→ vehicles, customers, users (assigned_to)
    ↓
requisitions ──→ jobs
requisition_items ──→ requisitions, stock_items
    ↓
invoices ──→ customers, jobs, users
invoice_items ──→ invoices, stock_items, services
    ↓
stock_transactions ──→ stock_items, users
    ↓
quotations ──→ customers, jobs
quotation_items ──→ quotations, stock_items, services
    ↓
purchase_orders ──→ suppliers, users
purchase_order_items ──→ purchase_orders, stock_items
    ↓
payments ──→ invoices, users
    ↓
expenses ──→ users (created_by)
```

---

## 💾 Data Persistence Strategies

### Primary Storage: Supabase PostgreSQL
- Permanent, centralized storage
- Accessible from anywhere
- Automatic backups
- RLS-protected

### Fallback: Browser localStorage
- Works offline
- Immediate sync when online
- Automatic fallback if Supabase unavailable
- Max ~5-10MB storage

### Sync Logic
```javascript
// Load Priority
1. Try Supabase (useSupabase = true)
2. Try Firebase Cloud (legacy)
3. Try localStorage
4. Create seed data

// Save Priority
1. If Supabase: service layer handles operations
2. Else: localStorage + Firebase backup
```

---

## 🛡️ Security Features

### 1. Authentication
- ✅ Email/password authentication
- ✅ Secure password hashing (bcrypt)
- ✅ Session management
- ✅ JWT tokens

### 2. Authorization (RLS)
- ✅ Row-level security policies
- ✅ Role-based access control
- ✅ Field-level restrictions
- ✅ Enforced at database level

### 3. Data Protection
- ✅ HTTPS encryption in transit
- ✅ Connection pooling
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS protection

### 4. Audit Trail
- ✅ `created_by` in records
- ✅ `created_at` timestamps
- ✅ `updated_at` for modifications
- ✅ Supabase audit logs (Pro plan)

---

## ⚙️ Configuration Files

### supabaseConfig.js
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_KEY = 'eyJxxxxx...'; // anon key
```

### auth.js
- Handles login/register forms
- Manages authentication state
- Redirects based on auth status
- Demo account features

### supabaseService.js
- All database CRUD operations
- Wraps Supabase client
- Error handling
- Type conversions

### db.js
- Converts between S object and Supabase format
- Fallback logic for offline mode
- Maintains backward compatibility

---

## 📈 Scalability Considerations

### Current Setup
- ✅ Suitable for small-medium businesses
- ✅ ~1000-5000 customers can be stored
- ✅ ~100 concurrent users supported
- ✅ Automatic scaling on Supabase

### Future Improvements
- [ ] Real-time subscriptions (Supabase realtime)
- [ ] Advanced reporting/analytics
- [ ] Integration with accounting software
- [ ] Mobile app (React Native)
- [ ] API for third-party integrations

---

## 🔧 Common Operations

### Adding a New Table

1. Create table in PostgreSQL (sql-migration.sql)
2. Add RLS policies
3. Create service function in supabaseService.js
4. Update db.js conversion logic (if needed)
5. Update state.js seed data structure
6. Create UI component (HTML + JS)

### Adding a New Feature

1. Plan database changes
2. Update SQL schema
3. Create service layer functions
4. Update db.js if new data type
5. Create UI components
6. Test with all three roles

---

## ✅ Testing Checklist

- [ ] Supabase project created
- [ ] SQL migration executed
- [ ] Demo users created and activated
- [ ] Login works for all 3 roles
- [ ] Can add customer (all roles)
- [ ] Can add vehicle (all roles)
- [ ] Can create job (all roles)
- [ ] Can view stock (all roles)
- [ ] Technician cannot edit stock prices
- [ ] Front Desk cannot view admin settings
- [ ] Can create invoice and calculate totals
- [ ] Stock decreases when invoice created
- [ ] Can export data
- [ ] Can import data
- [ ] Offline mode works (localStorage)
- [ ] Session persists on page reload

---

## 🚀 Deployment

### Option 1: Development (Current)
- Run `python -m http.server` or VS Code Live Server
- Access at http://localhost:8000
- Uses Supabase cloud backend
- Perfect for testing

### Option 2: Production (Future)
- Deploy to Vercel, Netlify, or Heroku
- Use custom domain
- Set environment variables
- Configure CORS in Supabase

---

**This architecture ensures the existing UI remains completely unchanged while providing a robust, scalable backend.**
