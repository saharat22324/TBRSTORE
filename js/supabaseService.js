/* ============================================================
   getSupabase() SERVICE — Database operations layer
   ============================================================
   Handles all CRUD operations for the TBR System
   Replaces Firebase with getSupabase() PostgreSQL backend
*/

let currentUser = null;
let currentUserRole = null;

/**
 * ROLE-BASED ACCESS CONTROL (RBAC)
 * Role IDs: 1=Admin, 2=Technician, 4=Supervisor
 */
const PERMISSIONS = {
  1: { // Admin
    name: 'Admin',
    canViewCost: true,
    canViewProfit: true,
    canEditPrices: true,
    canManageTeam: true,
    canViewReports: true,
    canAddCustomer: true,
    canDeleteData: true
  },
  2: { // Technician
    name: 'Technician',
    canViewCost: false,
    canViewProfit: true,           // ✅ เห็นกำไรได้
    canEditPrices: false,
    canManageTeam: false,
    canViewReports: false,
    canAddCustomer: true,          // ✅ เพิ่มลูกค้าได้
    canDeleteData: false
  },
  4: { // Supervisor
    name: 'Supervisor',
    canViewCost: false,
    canViewProfit: true,
    canEditPrices: false,
    canManageTeam: false,
    canViewReports: true,
    canAddCustomer: true,          // ✅ เพิ่มลูกค้าได้
    canDeleteData: false
  }
};

/**
 * Get current user's role ID and permissions
 */
function getCurrentUserRole() {
  const session = localStorage.getItem('tbr_user_session');
  if (!session) return null;
  try {
    const data = JSON.parse(session);
    // Support both role_id (number) and role (string) formats
    if (data.role_id) return data.role_id;
    const roleMap = { admin: 1, technician: 2, supervisor: 4 };
    return roleMap[data.role?.toLowerCase()] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if current user has permission
 */
function hasPermission(permissionKey) {
  const roleId = getCurrentUserRole();
  if (!roleId) return false;
  
  const perms = PERMISSIONS[roleId];
  if (!perms) return false;
  
  return perms[permissionKey] === true;
}

/**
 * Get permission object for current user
 */
function getUserPermissions() {
  const roleId = getCurrentUserRole();
  return PERMISSIONS[roleId] || PERMISSIONS[2]; // Default to Technician (most restricted)
}

// Helper to get getSupabase() client from window
const getSupabase = () => window.getSupabase?.() || null;

/**
 * Initialize getSupabase() service and check auth state
 */
async function initSupabaseService() {
  try {
    // Initialize getSupabase() client
    await window.initializeSupabase();
    if (!window.supabaseReady) {
      console.warn('[Service] getSupabase() not ready - falling back to localStorage');
      return false;
    }

    // Check if user is logged in
    currentUser = await window.getCurrentUser();
    
    // Set up auth state listener
    window.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        // Skip getUserProfile to avoid recursion - use metadata instead
        currentUserRole = session.user?.user_metadata?.role || 'user';
        console.log(`[Service] ✅ User signed in: ${session.user.email} (Role: ${currentUserRole})`);
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentUserRole = null;
        console.log('[Service] User signed out');
      }
    });

    return true;
  } catch (err) {
    console.error('[Service] Init error:', err);
    return false;
  }
}

/**
 * === CUSTOMERS ===
 */

async function addCustomer(name, phone, email, lineId, address, note) {
  try {
    const { data, error } = await getSupabase()
      .from('customers')
      .insert([{
        name,
        phone,
        email,
        line_id: lineId,
        address,
        note,
        created_by: currentUser?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] addCustomer error:', err);
    return null;
  }
}

async function updateCustomer(customerId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateCustomer error:', err);
    return null;
  }
}

async function getCustomers() {
  try {
    const { data, error } = await getSupabase()
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getCustomers error:', err);
    return [];
  }
}

async function deleteCustomer(customerId) {
  try {
    const { error } = await getSupabase()
      .from('customers')
      .delete()
      .eq('id', customerId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteCustomer error:', err);
    return false;
  }
}

/**
 * === VEHICLES ===
 */

async function addVehicle(customerId, plate, brand, model, year, color, mileage, engineNumber, chassisNumber, note) {
  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeCustomerId = customerId && uuidRe.test(customerId) ? customerId : null;

    const { data, error } = await getSupabase()
      .from('vehicles')
      .insert([{
        customer_id: safeCustomerId,
        plate,
        brand,
        model,
        year,
        color,
        mileage,
        engine_number: engineNumber,
        chassis_number: chassisNumber,
        note,
        created_by: currentUser?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] addVehicle error:', err);
    return null;
  }
}

async function updateVehicle(vehicleId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('vehicles')
      .update(updates)
      .eq('id', vehicleId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateVehicle error:', err);
    return null;
  }
}

async function getVehicles() {
  try {
    const { data, error } = await getSupabase()
      .from('vehicles')
      .select('*, customers(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getVehicles error:', err);
    return [];
  }
}

async function deleteVehicle(vehicleId) {
  try {
    const { error } = await getSupabase()
      .from('vehicles')
      .delete()
      .eq('id', vehicleId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteVehicle error:', err);
    return false;
  }
}

/**
 * === JOBS ===
 */

async function addJob(vehicleId, customerId, complaint, assignTo, mileage, note) {
  try {
    // Get job number
    const jobNo = await getNextJobNumber();

    // Validate UUIDs — local IDs must not be sent as FK references
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeVehicleId  = vehicleId  && uuidRe.test(vehicleId)  ? vehicleId  : null;
    const safeCustomerId = customerId && uuidRe.test(customerId) ? customerId : null;
    const safeAssignTo   = assignTo   && uuidRe.test(assignTo)   ? assignTo   : null;
    
    const { data, error } = await getSupabase()
      .from('jobs')
      .insert([{
        job_number: jobNo,
        vehicle_id: safeVehicleId,
        customer_id: safeCustomerId,
        complaint,
        assign_to: safeAssignTo,
        mileage,
        note,
        status_id: 1, // เปิดงาน
        created_by: currentUser?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] addJob error:', err);
    return null;
  }
}

async function updateJob(jobId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('jobs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateJob error:', err);
    return null;
  }
}

async function getJobs() {
  try {
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('*, job_statuses(name, color), vehicles(plate, brand, model), customers(name)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getJobs error:', err);
    return [];
  }
}

/**
 * === STOCK ITEMS ===
 */

async function addStockItem(sku, name, categoryId, unit, costPrice, sellPrice, quantity, reorderLevel, supplierId, note) {
  try {
    const { data, error } = await getSupabase()
      .from('stock_items')
      .insert([{
        sku,
        name,
        category_id: categoryId,
        unit,
        cost_price: costPrice,
        sell_price: sellPrice,
        quantity,
        reorder_level: reorderLevel,
        supplier_id: supplierId,
        note
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] addStockItem error:', err);
    return null;
  }
}

async function updateStockItem(itemId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('stock_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateStockItem error:', err);
    return null;
  }
}

/**
 * Update stock quantity directly by SKU (local item id = sku in Supabase)
 */
async function updateStockBySku(sku, newQty) {
  try {
    const { error } = await getSupabase()
      .from('stock_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('sku', sku);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] updateStockBySku error:', err.message);
    return false;
  }
}

/**
 * Upsert stock item by SKU (insert if not exists, update if exists)
 */
async function upsertStockItemBySku(item) {
  try {
    const { error } = await getSupabase()
      .from('stock_items')
      .upsert({
        sku: item.id,
        name: item.name,
        unit: item.unit || 'ลิตร',
        cost_price: item.cost || 0,
        sell_price: item.sell || 0,
        quantity: item.qty || 0,
        reorder_level: item.reorder || 10,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sku' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] upsertStockItemBySku error:', err.message);
    return false;
  }
}

/**
 * Delete stock item by SKU
 */
async function deleteStockItemBySku(sku) {
  try {
    const { error } = await getSupabase()
      .from('stock_items')
      .delete()
      .eq('sku', sku);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] deleteStockItemBySku error:', err.message);
    return false;
  }
}

async function getStockItems() {
  try {
    // Try with category join first
    const { data, error } = await getSupabase()
      .from('stock_items')
      .select('*, product_categories(name)')
      .order('sku', { ascending: true });
    
    if (error) {
      // JOIN failed (product_categories may not exist) — fall back to simple select
      console.warn('[Service] getStockItems JOIN failed, retrying without join:', error.message);
      const { data: data2, error: error2 } = await getSupabase()
        .from('stock_items')
        .select('*')
        .order('sku', { ascending: true });
      if (error2) throw error2;
      return data2 || [];
    }
    return data || [];
  } catch (err) {
    console.error('[Service] getStockItems error:', err);
    return [];
  }
}

async function recordStockTransaction(stockItemId, type, quantity, referenceType, referenceId, note) {
  try {
    // Record transaction
    const { data: trans, error: transErr } = await getSupabase()
      .from('stock_transactions')
      .insert([{
        stock_item_id: stockItemId,
        type,
        quantity,
        reference_type: referenceType,
        reference_id: referenceId,
        note,
        created_by: currentUser?.id
      }])
      .select()
      .single();
    
    if (transErr) throw transErr;

    // Update stock quantity
    if (type === 'in') {
      const { error: updateErr } = await getSupabase().rpc('increment_stock', {
        item_id: stockItemId,
        qty: quantity
      });
      if (updateErr) throw updateErr;
    } else if (type === 'out') {
      const { error: updateErr } = await getSupabase().rpc('decrement_stock', {
        item_id: stockItemId,
        qty: quantity
      });
      if (updateErr) throw updateErr;
    }

    return trans;
  } catch (err) {
    console.error('[Service] recordStockTransaction error:', err);
    return null;
  }
}

/**
 * === INVOICES ===
 */

async function addInvoice(jobId, customerId, vehicleId, items, subtotal, discount, vat, grandTotal, note, invoiceNo, meta = {}) {
  try {
    // Use provided invoice number or generate locally
    let invNo = invoiceNo;
    if (!invNo) {
      const today = new Date();
      const dateStr = String(today.getFullYear()) + 
                      String(today.getMonth() + 1).padStart(2, '0') + 
                      String(today.getDate()).padStart(2, '0');
      const counter = String((window.invoiceCounter || 0) + 1).padStart(3, '0');
      window.invoiceCounter = parseInt(counter);
      invNo = `INV-${dateStr}-${counter}`;
    }

    // Validate UUIDs — local IDs (non-UUID) must not be sent as FK references
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeJobId      = jobId      && uuidRe.test(jobId)      ? jobId      : null;
    const safeCustomerId = customerId && uuidRe.test(customerId) ? customerId : null;
    const safeVehicleId  = vehicleId  && uuidRe.test(vehicleId)  ? vehicleId  : null;
    
    console.log('[Service] Creating invoice:', invNo, '| job:', safeJobId, '| cust:', safeCustomerId);
    
    // Create invoice
    const { data: invoice, error: invErr } = await getSupabase()
      .from('invoices')
      .insert([{
        invoice_number: invNo || '',
        job_id: safeJobId,
        customer_id: safeCustomerId,
        vehicle_id: safeVehicleId,
        customer_name: meta.cust || null,
        plate: meta.plate || null,
        phone: meta.phone || null,
        car_model: meta.model || null,
        subtotal,
        discount,
        vat,
        grand_total: grandTotal,
        note,
        created_by: currentUser?.id
      }])
      .select()
      .single();
    
    if (invErr) throw invErr;

    // Add invoice items
    const itemsData = items.map(item => ({
      invoice_id: invoice.id,
      item_type: item.type,
      stock_item_id: item.stockItemId && uuidRe.test(item.stockItemId) ? item.stockItemId : null,
      service_id:    item.serviceId   && uuidRe.test(item.serviceId)   ? item.serviceId   : null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      cost_price: item.costPrice || 0,
      total: item.total,
      note: item.note
    }));

    const { error: itemsErr } = await getSupabase()
      .from('invoice_items')
      .insert(itemsData);
    
    if (itemsErr) throw itemsErr;

    return invoice;
  } catch (err) {
    console.error('[Service] addInvoice error:', err);
    return null;
  }
}

async function updateInvoicePaid(invId, paid) {
  try {
    const { error } = await getSupabase()
      .from('invoices')
      .update({ payment_status: paid })
      .eq('id', invId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] updateInvoicePaid:', err);
    return false;
  }
}

/**
 * แก้ไขใบเสร็จ — อัปเดต header + ลบ items เดิม + ใส่ items ใหม่
 */
async function updateInvoiceFull(invId, invoiceData, items) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  try {
    const { error: invErr } = await getSupabase()
      .from('invoices')
      .update({
        subtotal:      invoiceData.sub,
        discount:      invoiceData.disc,
        vat_rate:      invoiceData.vat > 0 ? 0.07 : 0,
        grand_total:   invoiceData.grand,
        customer_name: invoiceData.cust  || null,
        plate:         invoiceData.plate || null,
        phone:         invoiceData.phone || null,
        car_model:     invoiceData.model || null,
        notes:         invoiceData.note  || null,
      })
      .eq('id', invId);
    if (invErr) throw invErr;

    // ลบ items เดิม (ถ้าไม่ได้รับอนุญาต RLS จะ skip แล้วล้างด้วย insert แทน)
    try {
      await getSupabase().from('invoice_items').delete().eq('invoice_id', invId);
    } catch (delErr) {
      console.warn('[Service] invoice_items delete skipped (RLS?):', delErr?.message);
    }

    // ใส่ items ใหม่
    if (items.length > 0) {
      const itemsData = items.map(item => ({
        invoice_id:    invId,
        stock_item_id: item.stockItemId && uuidRe.test(item.stockItemId) ? item.stockItemId : null,
        service_id:    item.serviceId   && uuidRe.test(item.serviceId)   ? item.serviceId   : null,
        item_type:     item.type        || 'service',
        description:   item.description || '',
        quantity:      item.quantity,
        unit_price:    item.unitPrice,
        cost_price:    item.costPrice   || 0,
        total:         item.total,
        note:          item.note        || '',
      }));
      const { error: itemsErr } = await getSupabase().from('invoice_items').insert(itemsData);
      if (itemsErr) throw itemsErr;
    }
    return true;
  } catch (err) {
    console.error('[Service] updateInvoiceFull error:', err);
    return false;
  }
}

async function getInvoices() {
  try {
    const { data, error } = await getSupabase()
      .from('invoices')
      .select('*, invoice_items(*), customers(name), vehicles(plate)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getInvoices error:', err);
    return [];
  }
}

async function getNextInvoiceNumber() {
  try {
    const { data, error } = await window.getSupabase().rpc('get_next_sequence', {
      seq_name: 'invoice'
    });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] getNextInvoiceNumber error:', err);
    return null;
  }
}

/**
 * Update cost_price on existing invoice_items rows.
 * @param {Array<{id: string, cost_price: number}>} updates
 * @returns {number} count of rows updated
 */
async function updateInvoiceItemCosts(updates) {
  if (!updates || updates.length === 0) return 0;
  let count = 0;
  // Batch in groups of 50 to avoid request size limits
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    // Update each item individually — Supabase upsert by id
    for (const u of batch) {
      const { error } = await getSupabase()
        .from('invoice_items')
        .update({ cost_price: u.cost_price })
        .eq('id', u.id)
        .eq('cost_price', 0); // Only update rows that still have cost=0 (avoid overwriting good data)
      if (!error) count++;
    }
  }
  return count;
}

async function deleteInvoice(invoiceId) {
  try {
    // Delete invoice items first
    await getSupabase().from('invoice_items').delete().eq('invoice_id', invoiceId);
    
    // Delete invoice
    const { error } = await getSupabase()
      .from('invoices')
      .delete()
      .eq('id', invoiceId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteInvoice error:', err);
    return false;
  }
}

/**
 * === SHOP CONFIG ===
 */

async function getShopConfig() {
  try {
    const { data, error } = await getSupabase()
      .from('shop_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] getShopConfig error:', err);
    return null;
  }
}

async function updateShopConfig(updates) {
  try {
    const { data, error } = await getSupabase()
      .from('shop_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateShopConfig error:', err);
    return null;
  }
}

/**
 * === HELPER FUNCTIONS ===
 */

async function getNextJobNumber() {
  try {
    const { data, error } = await getSupabase().rpc('get_next_sequence', {
      seq_name: 'job'
    });
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] getNextJobNumber error:', err);
    return null;
  }
}

/**
 * === BULK DATA LOADING ===
 */

async function loadAllData() {
  try {
    console.log('[Service] Starting bulk data load from Supabase...');
    
    // Load all data in parallel
    const results = await Promise.allSettled([
      (async () => {
        console.log('[Service] Loading customers...');
        const data = await getCustomers();
        console.log('[Service] ✅ Customers loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading vehicles...');
        const data = await getVehicles();
        console.log('[Service] ✅ Vehicles loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading jobs...');
        const data = await getJobs();
        console.log('[Service] ✅ Jobs loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading stock items...');
        const data = await getStockItems();
        console.log('[Service] ✅ Stock items loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading invoices...');
        const data = await getInvoices();
        console.log('[Service] ✅ Invoices loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading services...');
        const data = await getServices();
        console.log('[Service] ✅ Services loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading shop config...');
        const data = await getShopConfig();
        console.log('[Service] ✅ Shop config loaded');
        return data;
      })()
    ]);

    // Extract successful results
    const [customers, vehicles, jobs, stockItems, invoices, services, shopConfig] = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        console.error(`[Service] Error loading item ${i}:`, r.reason);
        return null;
      }
    });

    console.log('[Service] ✅ Bulk data load complete - Customers:', customers?.length || 0);
    return {
      customers: customers || [],
      vehicles: vehicles || [],
      jobs: jobs || [],
      stockItems: stockItems || [],
      invoices: invoices || [],
      services: services || [],
      shopConfig: shopConfig || {}
    };
  } catch (err) {
    console.error('[Service] loadAllData error:', err);
    return null;
  }
}

async function getServices() {
  try {
    const { data, error } = await getSupabase()
      .from('services')
      .select('*')
      .eq('active', true)
      .order('service_code', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getServices error:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS FOR GLOBAL USE (in other JS files)
// ═══════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.hasPermission = hasPermission;
  window.getCurrentUserRole = getCurrentUserRole;
  window.getUserPermissions = getUserPermissions;
  window.PERMISSIONS = PERMISSIONS;
}
