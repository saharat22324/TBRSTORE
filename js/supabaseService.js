/* ============================================================
   getSupabase() SERVICE — Database operations layer
   ============================================================
   Handles all CRUD operations for the TBR System
   Replaces Firebase with getSupabase() PostgreSQL backend
*/

let currentUser = null;
let currentUserRole = null;

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
    const { data, error } = await getSupabase()
      .from('vehicles')
      .insert([{
        customer_id: customerId,
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
    
    const { data, error } = await getSupabase()
      .from('jobs')
      .insert([{
        job_number: jobNo,
        vehicle_id: vehicleId,
        customer_id: customerId,
        complaint,
        assign_to: assignTo,
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

async function getStockItems() {
  try {
    const { data, error } = await getSupabase()
      .from('stock_items')
      .select('*')
      .order('sku', { ascending: true });
    
    if (error) throw error;
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

async function addInvoice(jobId, customerId, vehicleId, items, subtotal, discount, vat, grandTotal, note, invoiceNo) {
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
    
    console.log('[Service] Creating invoice:', invNo);
    
    // Create invoice
    const { data: invoice, error: invErr } = await getSupabase()
      .from('invoices')
      .insert([{
        invoice_number: invNo || '',
        job_id: jobId,
        customer_id: customerId,
        vehicle_id: vehicleId,
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
      stock_item_id: item.stockItemId || null,
      service_id: item.serviceId || null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
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
    const [customers, vehicles, jobs, stockItems, invoices, services, shopConfig] = await Promise.all([
      getCustomers(),
      getVehicles(),
      getJobs(),
      getStockItems(),
      getInvoices(),
      getServices(),
      getShopConfig()
    ]);

    return {
      customers,
      vehicles,
      jobs,
      stockItems,
      invoices,
      services,
      shopConfig
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
