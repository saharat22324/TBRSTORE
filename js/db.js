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
    // Try Supabase first
    if (typeof supabaseReady !== 'undefined' && supabaseReady && typeof loadAllData === 'function') {
      console.log('[DB] 🔄 Loading from Supabase...');
      try {
        const data = await loadAllData();
        if (data) {
          S = convertSupabaseToState(data);
          useSupabase = true;
          console.log('[DB] ✅ โหลดจาก Supabase สำเร็จ');
          return;
        }
      } catch (err) {
        console.warn('[DB] Supabase load failed:', err);
      }
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

    // Fallback: localStorage
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      S = JSON.parse(raw);
      migrateData();
      useSupabase = false;
      console.log('[DB] ✅ โหลดจาก localStorage สำเร็จ');
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
 */
async function saveData() {
  try {
    // Always save to localStorage as fallback/backup
    localStorage.setItem(DB_KEY, JSON.stringify(S));

    // Also try Supabase if available
    if (useSupabase && supabaseReady) {
      console.log('[DB] ✅ Supabase sync via service layer');
    } else {
      console.log('[DB] ✅ บันทึกสำเร็จ (localStorage)');
    }

    // Try Firebase backup
    if (typeof saveToCloud !== 'undefined' && isFirebaseReady) {
      try {
        await saveToCloud('tbr-data', S);
      } catch (err) {
        console.warn('[DB] Firebase backup failed (non-critical)');
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
