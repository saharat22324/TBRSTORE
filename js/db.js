/* ============================================================
   DB.JS — Persistent Storage via localStorage
   ────────────────────────────────────────────
   ใช้ localStorage เพื่อให้ข้อมูลคงอยู่ข้าม session
   ทำงานบน VS Code Live Server / ไฟล์ธรรมดาได้เลย
   ============================================================ */

const DB_KEY = 'tbr-system-v1';
let useSupabase = false;

/**
 * โหลดข้อมูลทั้งหมด - ลองใช้ Supabase ก่อน ถ้าไม่ได้ใช้ localStorage
 */
async function loadData() {
  try {
    // Wait for Supabase to be ready (retry logic)
    let retries = 0;
    while (retries < 5 && (!window.supabaseReady || typeof loadAllData !== 'function')) {
      await new Promise(r => setTimeout(r, 100));
      retries++;
    }

    // Try Supabase first - REQUIRED for multi-user sync
    if (window.supabaseReady && typeof loadAllData === 'function') {
      console.log('[DB] 🔄 Loading from Supabase (multi-user sync enabled)...');
      try {
        const data = await loadAllData();
        if (data && (data.customers?.length > 0 || data.vehicles?.length > 0 || data.jobs?.length > 0 || data.invoices?.length > 0 || data.services?.length > 0)) {
          S = convertSupabaseToState(data);
          useSupabase = true;
          console.log('[DB] ✅ โหลดจาก Supabase สำเร็จ - ข้อมูลซิงค์ระหว่างผู้ใช้');
          return;
        } else if (data) {
          // Got empty data but no error - might be RLS issue
          console.warn('[DB] Supabase returned empty data (possible RLS policy issue)');
          S = convertSupabaseToState(data);
          useSupabase = true;
          console.log('[DB] ⚠️  Supabase accessible but returned empty (check RLS policies)');
          // Fall through to try localStorage as additional source
        } else {
          console.warn('[DB] Supabase returned null data, trying fallback...');
        }
      } catch (err) {
        console.error('[DB] Supabase load error:', err.message);
        if (err.message.includes('row-level security') || err.message.includes('RLS') || err.code === '42501') {
          console.warn('[DB] ⚠️  RLS POLICY BLOCKING ACCESS - Supabase Row-Level Security policies are enabled');
          console.warn('[DB] To fix: Disable RLS policies or modify them to allow API access');
          useSupabase = false; // Mark as not using Supabase since RLS blocks access
        }
      }
    } else {
      console.warn('[DB] Supabase not ready (retries=' + retries + '), checking window.supabaseReady:', window.supabaseReady);
    }

    // Fallback: Try Firebase Cloud
    if (typeof initializeFirebase !== 'undefined') {
      try {
        const cloudReady = await initializeFirebase();
        if (cloudReady && typeof loadFromCloud === 'function') {
          const cloudData = await loadFromCloud('tbr-data');
          if (cloudData) {
            S = cloudData;
            useSupabase = false;
            console.log('[DB] ✅ โหลดจาก Firebase Cloud สำเร็จ');
            return;
          }
        }
      } catch (err) {
        console.warn('[DB] Firebase load failed:', err);
      }
    }

    // Fallback: localStorage (single-device only, but shared across users via same device)
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      S = JSON.parse(raw);
      migrateData();
      useSupabase = false;
      console.log('[DB] ⚠️  โหลดจาก localStorage - ข้อมูลไม่ซิงค์ระหว่างผู้ใช้ (Supabase RLS issue?)');
    } else {
      S = seedData();
      await saveData();
      useSupabase = false;
      console.log('[DB] ✅ สร้างข้อมูลใหม่');
    }
  } catch (err) {
    console.error('[DB] loadData error:', err);
    S = seedData();
    useSupabase = false;
  }
}

/**
 * Convert Supabase data to state object
 */
function convertSupabaseToState(dbData) {
  const state = seedData();
  
  if (dbData.customers) {
    state.customers = dbData.customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      line: c.line_id,
      address: c.address,
      note: c.note,
      createdAt: new Date(c.created_at).getTime()
    }));
  }

  if (dbData.vehicles) {
    state.vehicles = dbData.vehicles.map(v => ({
      id: v.id,
      custId: v.customer_id,
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      mileage: v.mileage,
      note: v.note,
      createdAt: new Date(v.created_at).getTime()
    }));
  }

  if (dbData.jobs) {
    state.jobs = dbData.jobs.map(j => ({
      id: j.id,
      no: j.job_number,
      vehicleId: j.vehicle_id,
      custId: j.customer_id,
      custName: j.customers?.name || '',
      plate: j.vehicles?.plate || '',
      carModel: [j.vehicles?.brand, j.vehicles?.model].filter(Boolean).join(' '),
      mileage: j.mileage,
      complaint: j.complaint,
      assignTo: j.assign_to,
      status: (j.status_id || 1) - 1,
      note: j.note,
      requisitions: [],
      createdAt: new Date(j.created_at).getTime()
    }));
  }

  if (dbData.stockItems) {
    state.stockItems = dbData.stockItems.map(i => ({
      id: i.sku,
      cat: i.product_categories?.name || '',
      name: i.name,
      unit: i.unit,
      cost: i.cost_price,
      sell: i.sell_price,
      qty: i.quantity,
      reorder: i.reorder_level,
      recv: i.quantity,
      used: 0
    }));
  }

  if (dbData.services) {
    state.services = dbData.services.map(s => ({
      id: s.service_code,
      name: s.name,
      detail: s.description || '',
      price: s.price
    }));
  }

  if (dbData.shopConfig) {
    state.shop = {
      name: dbData.shopConfig.name || '',
      addr: dbData.shopConfig.address || '',
      phone: dbData.shopConfig.phone || '',
      tax: dbData.shopConfig.tax_id || '',
      line: dbData.shopConfig.line_id || '',
      note: dbData.shopConfig.note || ''
    };
  }

  if (dbData.invoices) {
    state.invoices = dbData.invoices.map(i => ({
      id: i.id,
      no: i.invoice_number,
      ts: new Date(i.created_at).getTime(),
      jobId: i.job_id,
      cust: i.customers?.name || '',
      phone: i.phone || '',
      plate: i.vehicles?.plate || '',
      model: i.model || '',
      mileage: i.mileage,
      ref: i.note || '',
      items: i.invoice_items?.map(it => ({
        name: it.description,
        unit: '',
        qty: it.quantity,
        price: it.unit_price,
        cost: 0,
        itemType: it.item_type,
        sid: it.stock_item_id,
      })) || [],
      sub: i.subtotal,
      disc: i.discount || 0,
      vat: i.vat || 0,
      grand: i.grand_total,
      totalCost: 0,
      note: i.note || ''
    }));
  }

  return state;
}

/**
 * บันทึกข้อมูลทั้งหมด
 * Note: Individual operations (addCustomer, addVehicle, etc.) already save to Supabase
 * This function serves as a backup to localStorage and triggers sync
 */
async function saveData() {
  try {
    // Save to localStorage as fallback/backup
    localStorage.setItem(DB_KEY, JSON.stringify(S));

    // If using Supabase, individual operations should have already saved
    // This is a safety checkpoint
    if (useSupabase && window.supabaseReady) {
      console.log('[DB] ✅ Data persisted (localStorage + Supabase operations)');
      return;
    }
    
    console.log('[DB] ✅ Data persisted to localStorage');

    // Try Firebase backup if available
    if (typeof saveToCloud !== 'undefined' && typeof isFirebaseReady !== 'undefined' && isFirebaseReady) {
      try {
        await saveToCloud('tbr-data', S);
        console.log('[DB] ✅ Firebase backup completed');
      } catch (err) {
        console.warn('[DB] Firebase backup failed (non-critical):', err.message);
      }
    }
  } catch (err) {
    console.error('[DB] saveData error:', err);
    if (typeof showToast === 'function') {
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'err');
    }
  }
}

/**
 * ลบข้อมูลทั้งหมด (ใช้ตอน reset)
 */
function clearData() {
  localStorage.removeItem(DB_KEY);
  S = seedData();
}

/**
 * Export ข้อมูลเป็น JSON file
 */
function exportData() {
  const json   = JSON.stringify(S, null, 2);
  const blob   = new Blob([json], { type: 'application/json' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  const today  = new Date().toISOString().slice(0, 10);
  a.href       = url;
  a.download   = `tbr-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import ข้อมูลจาก JSON file
 */
function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        S = imported;
        migrateData();
        await saveData();
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
