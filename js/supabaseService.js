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
  // ข้าม toast ถ้ากำลัง auto-push เบื้องหลัง (silent) — กันเด้งซ้ำทุก 12 วิจาก record ที่ค้าง
  if (typeof showToast === 'function' && !(typeof window !== 'undefined' && window._suppressWriteErrorToast)) {
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
    canManageStock: true,
    canManageTeam: true,
    canViewReports: true,
    canAddCustomer: true,
    canDeleteData: true,
    canDeleteJob: true,
    canRecordPayment: true,
    canCreateAdjustment: true,
    canReversePayment: true,
    canCancelInvoice: true,
    canEditIssuedInvoice: true
  },
  2: { // Technician
    name: 'Technician',
    canViewCost: false,
    canViewProfit: true,           // ✅ เห็นกำไรได้
    canEditPrices: false,
    canManageStock: false,
    canManageTeam: false,
    canViewReports: false,
    canAddCustomer: true,          // ✅ เพิ่มลูกค้าได้
    canDeleteData: false,
    canDeleteJob: false,
    canRecordPayment: false,
    canCreateAdjustment: false,
    canReversePayment: false,
    canCancelInvoice: false,
    canEditIssuedInvoice: false
  },
  4: { // Supervisor (หัวหน้าช่าง)
    name: 'Supervisor',
    canViewCost: false,
    canViewProfit: true,
    canEditPrices: false,
    canManageStock: true,
    canManageTeam: false,
    canViewReports: true,
    canAddCustomer: true,          // ✅ เพิ่มลูกค้าได้
    canDeleteData: false,
    canDeleteJob: true,            // ✅ ลบ Job Card ได้ (เฉพาะงาน ไม่รวมลูกค้า/รถ/บิล)
    canRecordPayment: true,
    canCreateAdjustment: true,
    canReversePayment: false,
    canCancelInvoice: false,
    canEditIssuedInvoice: false
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

async function addCustomer(name, phone, email, lineId, address, note, taxDetails = {}) {
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
        company_name: taxDetails.companyName || null,
        tax_id: taxDetails.taxId || null,
        branch_no: taxDetails.branchNo || '00000',
        billing_address: taxDetails.billingAddress || null,
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
    // year/mileage เป็นคอลัมน์ integer ในคลาวด์ — ค่าว่าง "" จะทำให้ insert fail (22P02)
    // แปลงเป็นตัวเลข ถ้าว่าง/ไม่ใช่ตัวเลข → null
    const toInt = (x) => {
      if (x === null || x === undefined || x === '') return null;
      const n = parseInt(String(x).replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) ? n : null;
    };

    const { data, error } = await getSupabase()
      .from('vehicles')
      .insert([{
        customer_id: safeCustomerId,
        plate,
        brand,
        model,
        year: toInt(year),
        color,
        mileage: toInt(mileage),
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
    // year/mileage เป็น integer ในคลาวด์ — กันค่าว่าง "" ที่ทำให้ update fail (22P02)
    const u = { ...updates };
    const toInt = (x) => {
      if (x === null || x === undefined || x === '') return null;
      const n = parseInt(String(x).replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) ? n : null;
    };
    if ('year' in u) u.year = toInt(u.year);
    if ('mileage' in u) u.mileage = toInt(u.mileage);

    const { data, error } = await getSupabase()
      .from('vehicles')
      .update(u)
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

async function createJobAtomic(vehicleId,customerId,complaint,assignTo,mileage,note,jobNo) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(vehicleId) || !uuidRe.test(customerId)) throw new Error('Job requires cloud vehicle and customer records');
  const jobNumber = jobNo || await getNextJobNumber() || ('JOB-' + Date.now());
  const { data, error } = await getSupabase().rpc('create_job_atomic', {
    p_job_number: jobNumber,
    p_vehicle_id: vehicleId,
    p_customer_id: customerId,
    p_complaint: complaint || null,
    p_assign_to: uuidRe.test(assignTo) ? assignTo : null,
    p_mileage: mileage ?? null,
    p_note: note || null,
  });
  if (error) {
    reportSupabaseWriteError(error, 'createJobAtomic');
    throw error;
  }
  return data;
}

async function updateJobAtomic(jobId, expectedStatusId, expectedUpdatedAt, updates) {
  const { data, error } = await getSupabase().rpc('update_job_atomic', {
    p_job_id: jobId,
    p_expected_status_id: expectedStatusId,
    p_expected_updated_at: expectedUpdatedAt || null,
    p_updates: updates,
  });
  if (error) {
    reportSupabaseWriteError(error, 'updateJobAtomic');
    throw error;
  }
  return data;
}

async function deleteJob(jobId) {
  try {
    const { data, error } = await getSupabase().rpc('delete_job_atomic', {
      p_job_id: jobId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error('[Service] deleteJob error:', err);
    return false;
  }
}

async function getJobs() {
  try {
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('*, job_statuses(name, color), vehicles(plate, brand, model), customers(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const uuids = [...new Set((data || []).map(j => j.assign_to).filter(Boolean))];
    const nameMap = {};
    if (uuids.length > 0) {
      const { data: profiles } = await getSupabase()
        .from('profiles')
        .select('id, full_name')
        .in('id', uuids);
      (profiles || []).forEach(p => { if (p.full_name) nameMap[p.id] = p.full_name; });
    }

    return (data || []).map(j => ({
      ...j,
      profiles: nameMap[j.assign_to] ? { full_name: nameMap[j.assign_to] } : null,
    }));
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

async function adjustStockAtomic(sku, mode, quantity, expectedQuantity, note) {
  const { data, error } = await getSupabase().rpc('adjust_stock_atomic', {
    p_sku: sku,
    p_mode: mode,
    p_quantity: quantity,
    p_expected_quantity: expectedQuantity,
    p_note: note || null,
  });
  if (error) {
    reportSupabaseWriteError(error, 'adjustStockAtomic');
    throw error;
  }
  return data;
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

async function saveStockItemAtomic(item, originalSku = null, expectedQuantity = null) {
  const { data, error } = await getSupabase().rpc('save_stock_item_atomic', {
    p_original_sku: originalSku,
    p_sku: item.id,
    p_name: item.name,
    p_unit: item.unit || 'ชิ้น',
    p_cost_price: item.cost || 0,
    p_sell_price: item.sell || 0,
    p_reorder_level: item.reorder || 0,
    p_initial_quantity: originalSku ? 0 : (item.qty || 0),
    p_expected_quantity: expectedQuantity,
  });
  if (error) {
    reportSupabaseWriteError(error, 'saveStockItemAtomic');
    throw error;
  }
  return data;
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

async function archiveStockItemAtomic(sku, expectedQuantity) {
  const { data, error } = await getSupabase().rpc('archive_stock_item_atomic', {
    p_sku: sku,
    p_expected_quantity: expectedQuantity,
  });
  if (error) {
    reportSupabaseWriteError(error, 'archiveStockItemAtomic');
    throw error;
  }
  return data;
}

async function getStockItems() {
  try {
    const { data: secureData, error: secureError } = await getSupabase().rpc('get_stock_items_secure');
    if (!secureError && secureData) return secureData;
    console.warn('[Service] secure stock RPC unavailable; using legacy query:', secureError?.message || secureError);

    // If product_categories join previously failed, skip straight to simple select
    if (!getStockItems._catJoinOk) {
      const { data, error } = await getSupabase()
        .from('stock_items')
        .select('*')
        .eq('active', true)
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
        .eq('active', true)
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

    // Preferred path after production-hardening-phase-1.sql: invoice header and
    // every line item are committed in one PostgreSQL transaction.
    const atomicItems = items.map(item => ({
      item_type: item.type || 'service',
      stock_item_id: item.stockItemId && uuidRe.test(item.stockItemId) ? item.stockItemId : null,
      service_id: item.serviceId && uuidRe.test(item.serviceId) ? item.serviceId : null,
      description: item.description || '',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      cost_price: item.costPrice || 0,
      total: item.total,
      note: item.note || ''
    }));
    const { data: atomicInvoice, error: atomicErr } = await getSupabase().rpc('create_invoice_atomic', {
      p_invoice: {
        invoice_number: invNo || '', job_id: safeJobId, customer_id: safeCustomerId,
        vehicle_id: safeVehicleId, customer_name: meta.cust || null,
        plate: meta.plate || null, phone: meta.phone || null, car_model: meta.model || null,
        subtotal, discount, vat, grand_total: grandTotal, note,
        status: 'issued', document_type: 'invoice', invoice_type: 'receipt'
      },
      p_items: atomicItems
    });
    if (!atomicErr && atomicInvoice) {
      return Array.isArray(atomicInvoice) ? atomicInvoice[0] : atomicInvoice;
    }
    throw atomicErr || new Error('Atomic invoice creation failed');
  } catch (err) {
    reportSupabaseWriteError(err, 'addInvoice');
    throw err;
  }
}

async function updateInvoicePaid(invId, paid) {
  try {
    let { error } = await getSupabase()
      .from('invoices')
      .update({ payment_status: paid, status: paid ? 'paid' : 'issued' })
      .eq('id', invId);
    if (error && /status|column|schema cache/i.test(error.message || '')) {
      ({ error } = await getSupabase()
        .from('invoices')
        .update({ payment_status: paid })
        .eq('id', invId));
    }
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] updateInvoicePaid:', err);
    return false;
  }
}

async function cancelInvoiceAtomic(invId, reason) {
  try {
    const { data, error } = await getSupabase().rpc('cancel_invoice_atomic', {
      p_invoice_id: invId,
      p_reason: reason
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    reportSupabaseWriteError(err, 'cancelInvoiceAtomic');
    return null;
  }
}

async function updateInvoiceTaxDetails(invId, buyer) {
  try {
    const { error } = await getSupabase()
      .from('invoices')
      .update({
        invoice_type: 'tax_invoice',
        document_type: 'tax_invoice',
        status: 'issued',
        buyer_name: buyer.name,
        buyer_address: buyer.address,
        buyer_tax_id: String(buyer.taxId || '').replace(/\D/g, ''),
        buyer_branch: buyer.branch || 'สำนักงานใหญ่'
      })
      .eq('id', invId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('[Service] updateInvoiceTaxDetails:', err);
    return false;
  }
}

/**
 * แก้ไขใบเสร็จ — อัปเดต header + ลบ items เดิม + ใส่ items ใหม่
 */
async function updateInvoiceFull(invId, invoiceData, items) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  try {
    const { data, error } = await getSupabase().rpc('update_invoice_atomic', {
      p_invoice_id: invId,
      p_invoice: {
        subtotal: invoiceData.sub, discount: invoiceData.disc,
        vat: invoiceData.vat > 0 ? 0.07 : 0, grand_total: invoiceData.grand,
        customer_name: invoiceData.cust || null, plate: invoiceData.plate || null,
        phone: invoiceData.phone || null, car_model: invoiceData.model || null,
        note: invoiceData.note || null,
      },
      p_items: items.map(item => ({
        stock_item_id: item.stockItemId && uuidRe.test(item.stockItemId) ? item.stockItemId : null,
        service_id: item.serviceId && uuidRe.test(item.serviceId) ? item.serviceId : null,
        item_type: item.type || 'service', description: item.description || '',
        quantity: item.quantity, unit_price: item.unitPrice,
        cost_price: item.costPrice || 0, total: item.total, note: item.note || '',
      })),
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    reportSupabaseWriteError(err, 'updateInvoiceFull');
    return null;
  }
}

async function getInvoicePayments() {
  try {
    const { data, error } = await getSupabase().from('invoice_payments').select('*').order('paid_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Service] getInvoicePayments:', err);
    return [];
  }
}

async function recordInvoicePayment(invId, amount, method, reference, note) {
  try {
    const { data, error } = await getSupabase().rpc('record_invoice_payment', {
      p_invoice_id: invId, p_amount: amount, p_method: method,
      p_reference: reference || null, p_note: note || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    reportSupabaseWriteError(err, 'recordInvoicePayment');
    return null;
  }
}

async function reverseInvoicePayment(paymentId, reason) {
  try {
    const { data, error } = await getSupabase().rpc('reverse_invoice_payment', {
      p_payment_id: paymentId, p_reason: reason,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    reportSupabaseWriteError(err, 'reverseInvoicePayment');
    return null;
  }
}

async function createAdjustmentNote(originalInvoiceId, documentType, amount, reason) {
  try {
    const { data, error } = await getSupabase().rpc('create_adjustment_note_atomic', {
      p_original_invoice_id: originalInvoiceId,
      p_document_type: documentType,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    reportSupabaseWriteError(err, 'createAdjustmentNote');
    return null;
  }
}

async function getInvoices() {
  try {
    const { data: secureData, error: secureError } = await getSupabase().rpc('get_invoices_secure');
    if (!secureError && secureData) return secureData;
    console.warn('[Service] secure invoice RPC unavailable; using legacy query:', secureError?.message || secureError);

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
    const { data, error } = await getSupabase().rpc('create_requisition_atomic', {
      p_job_id: jobId,
      p_no: no,
      p_items: items || [],
      p_note: note || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    reportSupabaseWriteError(err, 'addRequisition');
    return null;
  }
}

async function updateRequisition(reqId, updates) {
  try {
    const { data, error } = await getSupabase().rpc('update_requisition_atomic', {
      p_requisition_id: reqId,
      p_items: updates.items || [],
      p_note: updates.note || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (err) {
    console.error('[Service] updateRequisition error:', err);
    return null;
  }
}

async function deleteRequisition(reqId) {
  try {
    const { data, error } = await getSupabase().rpc('delete_requisition_atomic', {
      p_requisition_id: reqId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
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
async function createQuoteAtomic(quoteData) {
  const { data, error } = await getSupabase().rpc('create_quote_atomic', {
    p_quote: {
      no: quoteData.no,
      cust_name: quoteData.cust || null,
      phone: quoteData.phone || null,
      plate: quoteData.plate || null,
      car_model: quoteData.model || null,
      items: quoteData.items || [],
      sub: parseFloat(quoteData.sub) || 0,
      disc: parseFloat(quoteData.disc) || 0,
      vat: parseFloat(quoteData.vat) || 0,
      grand: parseFloat(quoteData.grand) || 0,
      note: quoteData.note || null,
      ref: quoteData.ref || null,
    },
  });
  if (error) {
    reportSupabaseWriteError(error, 'createQuoteAtomic');
    throw error;
  }
  return data;
}

async function convertQuoteAtomic(quoteId) {
  const { data, error } = await getSupabase().rpc('convert_quote_atomic', { p_quote_id: quoteId });
  if (error) {
    reportSupabaseWriteError(error, 'convertQuoteAtomic');
    throw error;
  }
  return data;
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
async function createPurchaseOrderAtomic(no, supplier, items, total, note) {
  const { data, error } = await getSupabase().rpc('create_purchase_order_atomic', {
    p_no: no,
    p_supplier: supplier,
    p_items: items || [],
    p_total: parseFloat(total) || 0,
    p_note: note || null,
  });
  if (error) {
    reportSupabaseWriteError(error, 'createPurchaseOrderAtomic');
    throw error;
  }
  return data;
}

async function cancelPurchaseOrderAtomic(poId, reason = null) {
  const { data, error } = await getSupabase().rpc('cancel_purchase_order_atomic', {
    p_purchase_order_id: poId,
    p_reason: reason,
  });
  if (error) {
    reportSupabaseWriteError(error, 'cancelPurchaseOrderAtomic');
    throw error;
  }
  return data;
}

async function receivePurchaseOrderAtomic(poId, receipts, items, note) {
  const { data, error } = await getSupabase().rpc('receive_purchase_order_atomic', {
    p_purchase_order_id: poId,
    p_receipts: receipts,
    p_items: items,
    p_note: note || null,
  });
  if (error) {
    reportSupabaseWriteError(error, 'receivePurchaseOrderAtomic');
    throw error;
  }
  return data;
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
      })(),
      (async () => {
        console.log('[Service] Loading invoice payments...');
        const data = await getInvoicePayments();
        console.log('[Service] ✅ Invoice payments loaded:', data?.length || 0);
        return data;
      })()
    ]);

    // Extract successful results
        const [customers, vehicles, jobs, stockItems, invoices, services, shopConfig, stockLedger,
          requisitions, expenses, quotes, purchaseOrders, invoicePayments] = results.map((r, i) => {
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
      invoicePayments: invoicePayments || [],
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

async function saveServiceAtomic(originalCode,svc) {
  const { data,error } = await getSupabase().rpc('save_service_atomic', {
    p_original_code: originalCode || null,
    p_service: {
      service_code: svc.id,
      name: svc.name,
      description: svc.detail || '',
      price: parseFloat(svc.price) || 0,
    },
  });
  if (error) {
    reportSupabaseWriteError(error,'saveServiceAtomic');
    throw error;
  }
  return data;
}

async function archiveServiceAtomic(code) {
  const { data,error } = await getSupabase().rpc('archive_service_atomic', { p_service_code: code });
  if (error) {
    reportSupabaseWriteError(error,'archiveServiceAtomic');
    throw error;
  }
  return data;
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
