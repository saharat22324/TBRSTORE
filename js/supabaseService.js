/* ============================================================
   getSupabase() SERVICE — Database operations layer
   ============================================================
   Handles all CRUD operations for the TBR System
   Replaces Firebase with getSupabase() PostgreSQL backend
*/

let currentUser = null;
let currentUserRole = null;

/**
 * รายงานความล้มเหลวในการ "เขียน" ข้อมูลขึ้น Supabase ให้ผู้ใช้เห็นทันที
 * (เดิมระบบจะ catch แล้วเงียบ ทำให้ข้อมูลค้างอยู่ใน localStorage เครื่องเดียว
 *  คนอื่นในทีมเลยไม่เห็น) — ฟังก์ชันนี้จะเด้ง toast + เปิด banner เตือน
 * @param {Error} err  error object จาก Supabase
 * @param {string} op  ชื่อ operation เช่น 'addJob' (ใช้ใน log)
 */
function reportSupabaseWriteError(err, op) {
  const msg  = (err && (err.message || err.error_description || '')) + '';
  const code = (err && err.code) || '';
  const isRls =
    /row-level security|permission denied|not authorized|policy/i.test(msg) ||
    code === '42501' || code === 'PGRST301' || code === '401';

  console.error(`[Service] ${op} write failed:`, msg || err);

  // เปิด banner เตือน admin (ใน nav.js) ทุกกรณีที่เขียนไม่สำเร็จ
  if (typeof window !== 'undefined') {
    window._rlsWarning = true;
    window._lastSyncError = { op, msg, code, ts: Date.now() };
  }

  // เด้ง toast ให้ผู้ใช้ทุก role รู้ว่าข้อมูลยังไม่ขึ้นระบบกลาง (debounce กันเด้งรัว)
  if (typeof showToast === 'function') {
    const now = Date.now();
    if (now - (window._lastWriteErrorToast || 0) > 8000) {
      window._lastWriteErrorToast = now;
      showToast(
        isRls
          ? '⚠️ ข้อมูลถูกบล็อกโดยระบบ (RLS) — ยังไม่ขึ้นส่วนกลาง คนอื่นจะยังไม่เห็น'
          : '⚠️ บันทึกขึ้นระบบกลางไม่สำเร็จ — ข้อมูลอยู่ในเครื่องนี้เท่านั้น',
        'err'
      );
    }
  }
}
if (typeof window !== 'undefined') window.reportSupabaseWriteError = reportSupabaseWriteError;

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
    canDeleteData: true,
    canDeleteJob: true
  },
  2: { // Technician
    name: 'Technician',
    canViewCost: false,
    canViewProfit: true,           // ✅ เห็นกำไรได้
    canEditPrices: false,
    canManageTeam: false,
    canViewReports: false,
    canAddCustomer: true,          // ✅ เพิ่มลูกค้าได้
    canDeleteData: false,
    canDeleteJob: false
  },
  4: { // Supervisor (หัวหน้าช่าง)
    name: 'Supervisor',
    canViewCost: false,
    canViewProfit: true,
    canEditPrices: false,
    canManageTeam: false,
    canViewReports: true,
    canAddCustomer: true,          // ✅ เพิ่มลูกค้าได้
    canDeleteData: false,
    canDeleteJob: true             // ✅ ลบ Job Card ได้ (เฉพาะงาน ไม่รวมลูกค้า/รถ/บิล)
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
    reportSupabaseWriteError(err, 'addCustomer');
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
    reportSupabaseWriteError(err, 'addVehicle');
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

async function addJob(vehicleId, customerId, complaint, assignTo, mileage, note, jobNo) {
  try {
    // ใช้เลขงานที่แอปสร้างไว้ก่อน → ถ้าไม่มี ค่อยลอง RPC → สุดท้าย gen เอง (กัน job_number = null ที่ทำให้ insert พัง)
    const jobNum = jobNo || await getNextJobNumber() || ('JOB-' + Date.now());

    // Validate UUIDs — local IDs must not be sent as FK references
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeVehicleId  = vehicleId  && uuidRe.test(vehicleId)  ? vehicleId  : null;
    const safeCustomerId = customerId && uuidRe.test(customerId) ? customerId : null;
    const safeAssignTo   = assignTo   && uuidRe.test(assignTo)   ? assignTo   : null;
    
    const { data, error } = await getSupabase()
      .from('jobs')
      .insert([{
        job_number: jobNum,
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
    reportSupabaseWriteError(err, 'addJob');
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

async function deleteJob(jobId) {
  try {
    const { error } = await getSupabase()
      .from('jobs')
      .delete()
      .eq('id', jobId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteJob error:', err);
    return false;
  }
}

async function getJobs() {
  try {
    // If profiles join previously failed, skip straight to fallback
    if (!getJobs._profilesJoinOk) {
      const { data: data2, error: error2 } = await getSupabase()
        .from('jobs')
        .select('*, job_statuses(name, color), vehicles(plate, brand, model), customers(name)')
        .order('created_at', { ascending: false });
      if (error2) throw error2;

      const uuids = [...new Set((data2 || []).map(j => j.assign_to).filter(Boolean))];
      const nameMap = {};
      if (uuids.length > 0) {
        const { data: profiles } = await getSupabase()
          .from('profiles')
          .select('id, full_name')
          .in('id', uuids);
        (profiles || []).forEach(p => { if (p.full_name) nameMap[p.id] = p.full_name; });
      }
      return (data2 || []).map(j => ({
        ...j,
        profiles: nameMap[j.assign_to] ? { full_name: nameMap[j.assign_to] } : null,
      }));
    }

    // Try with profiles join (requires FK constraint)
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('*, job_statuses(name, color), vehicles(plate, brand, model), customers(name), profiles!assign_to(full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      // Mark join as broken — skip it on all future calls
      getJobs._profilesJoinOk = false;
      console.warn('[Service] getJobs profiles join failed (will skip in future):', error.message);
      const { data: data2, error: error2 } = await getSupabase()
        .from('jobs')
        .select('*, job_statuses(name, color), vehicles(plate, brand, model), customers(name)')
        .order('created_at', { ascending: false });
      if (error2) throw error2;

      const uuids = [...new Set((data2 || []).map(j => j.assign_to).filter(Boolean))];
      const nameMap = {};
      if (uuids.length > 0) {
        const { data: profiles } = await getSupabase()
          .from('profiles')
          .select('id, full_name')
          .in('id', uuids);
        (profiles || []).forEach(p => { if (p.full_name) nameMap[p.id] = p.full_name; });
      }
      return (data2 || []).map(j => ({
        ...j,
        profiles: nameMap[j.assign_to] ? { full_name: nameMap[j.assign_to] } : null,
      }));
    }
    getJobs._profilesJoinOk = true;
    return data || [];
  } catch (err) {
    console.error('[Service] getJobs error:', err);
    return [];
  }
}
getJobs._profilesJoinOk = true; // assume ok, flip to false on first failure

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
    reportSupabaseWriteError(err, 'addStockItem');
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
    // If product_categories join previously failed, skip straight to simple select
    if (!getStockItems._catJoinOk) {
      const { data, error } = await getSupabase()
        .from('stock_items')
        .select('*')
        .order('sku', { ascending: true });
      if (error) throw error;
      return data || [];
    }

    // Try with category join
    const { data, error } = await getSupabase()
      .from('stock_items')
      .select('*, product_categories(name)')
      .order('sku', { ascending: true });

    if (error) {
      // Mark join as broken
      getStockItems._catJoinOk = false;
      console.warn('[Service] getStockItems JOIN failed (will skip in future):', error.message);
      const { data: data2, error: error2 } = await getSupabase()
        .from('stock_items')
        .select('*')
        .order('sku', { ascending: true });
      if (error2) throw error2;
      return data2 || [];
    }
    getStockItems._catJoinOk = true;
    return data || [];
  } catch (err) {
    console.error('[Service] getStockItems error:', err);
    return [];
  }
}
getStockItems._catJoinOk = true; // assume ok, flip to false on first failure

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
    reportSupabaseWriteError(err, 'addInvoice');
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
        vat:           invoiceData.vat > 0 ? 0.07 : 0,
        grand_total:   invoiceData.grand,
        customer_name: invoiceData.cust  || null,
        plate:         invoiceData.plate || null,
        phone:         invoiceData.phone || null,
        car_model:     invoiceData.model || null,
        note:          invoiceData.note  || null,
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

/* ══════════════════════════════════════
   REQUISITIONS
══════════════════════════════════════ */
async function addRequisition(jobId, no, items, note) {
  try {
    const sb = getSupabase();
    const row = {
      no,
      job_id:     jobId || null,
      items:      items || [],
      note:       note  || null,
      created_by: currentUser?.id || null,
    };
    const { data, error } = await sb.from('requisitions').insert([row]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    reportSupabaseWriteError(err, 'addRequisition');
    return null;
  }
}

async function updateRequisition(reqId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('requisitions')
      .update(updates)
      .eq('id', reqId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateRequisition error:', err);
    return null;
  }
}

async function deleteRequisition(reqId) {
  try {
    const { error } = await getSupabase()
      .from('requisitions')
      .delete()
      .eq('id', reqId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteRequisition error:', err);
    return false;
  }
}

async function getRequisitions() {
  try {
    const { data, error } = await getSupabase()
      .from('requisitions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getRequisitions error:', err);
    return [];
  }
}

/* ══════════════════════════════════════
   EXPENSES
══════════════════════════════════════ */
async function addExpense(label, amount, date, note) {
  try {
    const sb = getSupabase();
    // map app fields → real DB columns (category/description/expense_date NOT NULL)
    const row = {
      category:     'ทั่วไป',
      description:  label || '',
      amount:       parseFloat(amount) || 0,
      expense_date: date || new Date().toISOString().slice(0, 10),
      reference:    note || null,
      created_by:   currentUser?.id || null,
    };
    const { data, error } = await sb.from('expenses').insert([row]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    reportSupabaseWriteError(err, 'addExpense');
    return null;
  }
}

async function deleteExpense(expId) {
  try {
    const { error } = await getSupabase()
      .from('expenses')
      .delete()
      .eq('id', expId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteExpense error:', err);
    return false;
  }
}

async function getExpenses() {
  try {
    const { data, error } = await getSupabase()
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getExpenses error:', err);
    return [];
  }
}

/* ══════════════════════════════════════
   QUOTES
══════════════════════════════════════ */
async function addQuote(quoteData) {
  try {
    const sb = getSupabase();
    const row = {
      no:         quoteData.no       || null,
      cust_name:  quoteData.cust     || null,
      phone:      quoteData.phone    || null,
      plate:      quoteData.plate    || null,
      car_model:  quoteData.model    || null,
      items:      quoteData.items    || [],
      sub:        parseFloat(quoteData.sub)   || 0,
      disc:       parseFloat(quoteData.disc)  || 0,
      vat:        parseFloat(quoteData.vat)   || 0,
      grand:      parseFloat(quoteData.grand) || 0,
      note:       quoteData.note     || null,
      ref:        quoteData.ref      || null,
      converted:  quoteData.converted || false,
      created_by: currentUser?.id    || null,
    };
    const { data, error } = await sb.from('quotes').insert([row]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] addQuote error:', err);
    return null;
  }
}

async function updateQuote(quoteId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('quotes')
      .update(updates)
      .eq('id', quoteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updateQuote error:', err);
    return null;
  }
}

async function deleteQuote(quoteId) {
  try {
    const { error } = await getSupabase()
      .from('quotes')
      .delete()
      .eq('id', quoteId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deleteQuote error:', err);
    return false;
  }
}

async function getQuotes() {
  try {
    const { data, error } = await getSupabase()
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getQuotes error:', err);
    return [];
  }
}

/* ══════════════════════════════════════
   PURCHASE ORDERS
══════════════════════════════════════ */
async function addPO(no, supplier, items, total, note) {
  try {
    const row = {
      no,
      supplier:   supplier || null,
      status:     'pending',
      items:      items    || [],
      total:      parseFloat(total) || 0,
      note:       note     || null,
      created_by: currentUser?.id || null,
    };
    const { data, error } = await getSupabase()
      .from('purchase_orders')
      .insert([row])
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] addPO error:', err);
    return null;
  }
}

async function updatePO(poId, updates) {
  try {
    const { data, error } = await getSupabase()
      .from('purchase_orders')
      .update(updates)
      .eq('id', poId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Service] updatePO error:', err);
    return null;
  }
}

async function deletePO(poId) {
  try {
    const { error } = await getSupabase()
      .from('purchase_orders')
      .delete()
      .eq('id', poId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Service] deletePO error:', err);
    return false;
  }
}

async function getPOs() {
  try {
    const { data, error } = await getSupabase()
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getPOs error:', err);
    return [];
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
      })(),
      (async () => {
        console.log('[Service] Loading stock ledger...');
        const data = await getStockLedger();
        console.log('[Service] ✅ Stock ledger loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading requisitions...');
        const data = await getRequisitions();
        console.log('[Service] ✅ Requisitions loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading expenses...');
        const data = await getExpenses();
        console.log('[Service] ✅ Expenses loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading quotes...');
        const data = await getQuotes();
        console.log('[Service] ✅ Quotes loaded:', data?.length || 0);
        return data;
      })(),
      (async () => {
        console.log('[Service] Loading purchase orders...');
        const data = await getPOs();
        console.log('[Service] ✅ POs loaded:', data?.length || 0);
        return data;
      })()
    ]);

    // Extract successful results
    const [customers, vehicles, jobs, stockItems, invoices, services, shopConfig, stockLedger,
           requisitions, expenses, quotes, purchaseOrders] = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        console.error(`[Service] Error loading item ${i}:`, r.reason);
        return null;
      }
    });

    console.log('[Service] ✅ Bulk data load complete - Customers:', customers?.length || 0);
    return {
      customers:      customers       || [],
      vehicles:       vehicles        || [],
      jobs:           jobs            || [],
      stockItems:     stockItems      || [],
      invoices:       invoices        || [],
      services:       services        || [],
      shopConfig:     shopConfig      || {},
      stockLedger:    stockLedger     || [],
      requisitions:   requisitions    || [],
      expenses:       expenses        || [],
      quotes:         quotes          || [],
      purchaseOrders: purchaseOrders  || [],
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

async function upsertService(svc) {
  try {
    const { error } = await getSupabase()
      .from('services')
      .upsert({
        service_code: svc.id,
        name:         svc.name,
        description:  svc.detail || '',
        price:        svc.price  || 0,
        active:       true,
      }, { onConflict: 'service_code' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] upsertService error:', err);
    return false;
  }
}

async function deleteServiceByCode(code) {
  try {
    const { error } = await getSupabase()
      .from('services')
      .update({ active: false })
      .eq('service_code', code);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] deleteService error:', err);
    return false;
  }
}

/* ══════════════════════════════════════
   AUDIT LOG
══════════════════════════════════════ */
async function addAuditLog(action, entityType, entityId, entityRef, details = {}) {
  try {
    if (!currentUser) return;
    await getSupabase()
      .from('audit_logs')
      .insert([{
        user_id:     currentUser.id,
        user_name:   currentUser.user_metadata?.full_name || currentUser.email || 'unknown',
        action,
        entity_type: entityType,
        entity_id:   entityId   || null,
        entity_ref:  entityRef  || null,
        details
      }]);
  } catch (err) {
    console.warn('[Service] addAuditLog error:', err);
  }
}

async function getAuditLogs(limit = 150) {
  try {
    const { data, error } = await getSupabase()
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getAuditLogs error:', err);
    return [];
  }
}

/* ══════════════════════════════════════
   STOCK LEDGER
══════════════════════════════════════ */
async function getStockLedger(limit = 1000) {
  try {
    const { data, error } = await getSupabase()
      .from('stock_ledger')
      .select('*, stock_items(sku, name, unit)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getStockLedger error:', err);
    return [];
  }
}

async function addStockLedgerEntry(itemUuid, type, qty, note) {
  try {
    const dbType = type === 'count' ? 'adjust' : (type || 'in');
    const { data, error } = await getSupabase()
      .from('stock_ledger')
      .insert([{
        stock_item_id: itemUuid || null,
        type: dbType,
        qty: Math.abs(qty),
        note: note || null
      }])
      .select('id')
      .single();
    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.error('[Service] addStockLedgerEntry error:', err);
    return null;
  }
}

/* ══════════════════════════════════════
   JOB IMAGE UPLOAD (Supabase Storage)
══════════════════════════════════════ */
async function uploadJobImage(jobId, file) {
  try {
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await getSupabase().storage
      .from('job-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = getSupabase().storage.from('job-images').getPublicUrl(path);
    return data.publicUrl || null;
  } catch (err) {
    console.error('[Service] uploadJobImage error:', err);
    return null;
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
