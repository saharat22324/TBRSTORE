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
        if (data && (data.customers?.length > 0 || data.vehicles?.length > 0 || data.jobs?.length > 0 || data.invoices?.length > 0 || data.services?.length > 0 || data.stockItems?.length > 0)) {
          S = convertSupabaseToState(data);
          useSupabase = true;
          // ALWAYS merge localStorage records not yet in Supabase (safety net)
          mergeLocalStorageIntoS();
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
      // Keep useSupabase = true if Supabase was accessible (just empty tables)
      // This allows future saves to go to Supabase for multi-device sync
      if (useSupabase) {
        console.log('[DB] ⚠️  โหลดจาก localStorage — กำลังซิงค์ข้อมูลไปยัง Supabase...');
        // Run sync in background — don't block page load
        syncLocalToSupabase().catch(e => console.warn('[DB] Background sync failed:', e));
      } else {
        console.log('[DB] ⚠️  โหลดจาก localStorage - ข้อมูลไม่ซิงค์ (Supabase ไม่พร้อม)');
      }
    } else {
      S = seedData();
      await saveData();
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
  // Reset stock items — don't use demo seed items when Supabase is available.
  // mergeLocalStorageIntoS() will restore real items from localStorage if Supabase returns empty.
  state.stockItems = [];

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

  if (dbData.stockItems && dbData.stockItems.length > 0) {
    state.stockItems = dbData.stockItems.map(i => {
      // Infer category from name/SKU if category_id is not set
      const catFromJoin = i.product_categories?.name || '';
      let catFallback = '';
      if (!catFromJoin) {
        const n = (i.name || '').toLowerCase();
        const s = (i.sku || '').toLowerCase();
        if (n.includes('เครื่อง') || s.includes('5w')) catFallback = 'น้ำมันเครื่อง';
        else if (n.includes('เบรก') || n.includes('dot') || s.includes('brake')) catFallback = 'น้ำมันเบรก';
        else if (n.includes('เกียร์') || n.includes('gear') || n.includes('dexron') || n.includes('atf') || s.includes('dex') || s.includes('gear') || s.includes('ulv')) catFallback = 'น้ำมันเกียร์';
        else if (n.includes('ไส้กรอง') || n.includes('filter') || n.includes('แหวน')) catFallback = 'ไส้กรอง';
        else catFallback = 'น้ำยา';
      }
      return {
        id: i.sku,
        cat: catFromJoin || catFallback,
        name: i.name,
        unit: i.unit || 'ลิตร',
        cost: i.cost_price,
        sell: i.sell_price,
        qty: i.quantity,
        reorder: i.reorder_level || 10,
        recv: i.quantity,
        used: 0
      };
    });
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
    // Build cost lookup: Supabase stock UUID → cost_price
    const costByUuid = {};
    for (const si of (dbData.stockItems || [])) {
      if (si.id) costByUuid[si.id] = si.cost_price || 0;
    }

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
        cost: it.stock_item_id ? (costByUuid[it.stock_item_id] || 0) : 0,
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
 * Merge any localStorage records not present in S (loaded from Supabase).
 * Called every time Supabase loads successfully — ensures no local-only data is lost.
 * Matches jobs by job number (no), invoices by invoice number (no),
 * customers by phone, vehicles by plate.
 */
function mergeLocalStorageIntoS() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return;
  try {
    const local = JSON.parse(raw);
    let merged = 0;
    const toSync = { jobs: [], invoices: [], customers: [], vehicles: [] };

    // Jobs: match by job number
    const sbJobNos = new Set(S.jobs.map(j => j.no).filter(Boolean));
    for (const j of (local.jobs || [])) {
      if (j.no && !sbJobNos.has(j.no)) {
        S.jobs.push(j);
        toSync.jobs.push(j);
        merged++;
      }
    }

    // Invoices: match by invoice number
    const sbInvNos = new Set(S.invoices.map(i => i.no).filter(Boolean));
    for (const inv of (local.invoices || [])) {
      if (inv.no && !sbInvNos.has(inv.no)) {
        S.invoices.push(inv);
        toSync.invoices.push(inv);
        merged++;
      }
    }

    // Customers: match by phone (unique) or id
    const sbPhones = new Set(S.customers.map(c => c.phone).filter(Boolean));
    const sbCustIds = new Set(S.customers.map(c => c.id));
    for (const c of (local.customers || [])) {
      if (!sbCustIds.has(c.id) && !(c.phone && sbPhones.has(c.phone))) {
        S.customers.push(c);
        toSync.customers.push(c);
        merged++;
      }
    }

    // Vehicles: match by plate
    const sbPlates = new Set(S.vehicles.map(v => v.plate).filter(Boolean));
    for (const v of (local.vehicles || [])) {
      if (v.plate && !sbPlates.has(v.plate)) {
        S.vehicles.push(v);
        toSync.vehicles.push(v);
        merged++;
      }
    }

    // Stock items: restore from localStorage when Supabase returned none,
    // or add non-seed local items not yet in Supabase.
    // Seed item IDs match pattern S##/C## (e.g. S01, C03) — skip those when merging.
    const isSeedItem = id => /^[SC]\d{1,2}$/.test(id);
    if (S.stockItems.length === 0) {
      // Supabase returned no stock — use localStorage items (prefer real over seed)
      const realLocal = (local.stockItems || []).filter(i => i.id && !isSeedItem(i.id));
      S.stockItems = realLocal.length > 0 ? realLocal : (local.stockItems || []);
      if (S.stockItems.length > 0) merged += S.stockItems.length;
    } else {
      // Add only real (non-seed) local items not already in Supabase
      const sbSkus = new Set(S.stockItems.map(i => i.id).filter(Boolean));
      for (const item of (local.stockItems || [])) {
        if (item.id && !isSeedItem(item.id) && !sbSkus.has(item.id)) {
          S.stockItems.push(item);
          merged++;
        }
      }
    }

    if (merged > 0) {
      console.log(`[DB] 🔀 Merged ${merged} local records not found in Supabase`);
      // Save merged state to localStorage
      localStorage.setItem(DB_KEY, JSON.stringify(S));
      // Push missing records to Supabase in background
      const hasNew = toSync.jobs.length || toSync.invoices.length || toSync.customers.length || toSync.vehicles.length;
      if (hasNew && window.supabaseReady) {
        syncLocalToSupabase().catch(e => console.warn('[DB] Background sync failed:', e));
      }
    }
  } catch (e) {
    console.warn('[DB] mergeLocalStorageIntoS error:', e);
  }
}

/**
 * ซิงค์ข้อมูลจาก localStorage ไปยัง Supabase (one-time migration)
 * ทำงานเมื่อ Supabase พร้อมแต่ยังไม่มีข้อมูล (tables empty)
 */
async function syncLocalToSupabase() {
  if (!window.supabaseReady) return;
  if (!S.customers?.length && !S.jobs?.length && !S.invoices?.length) return;

  console.log('[DB] 🔄 Syncing unsynced local records to Supabase...');
  const idMap = {}; // local ID → Supabase UUID
  let syncedCount = 0;

  try {
    // 1. Sync customers
    for (const c of (S.customers || [])) {
      if (!c.id || c.id.startsWith('C-')) { // local timestamp IDs
        try {
          const result = await addCustomer(c.name || '', c.phone || '', c.email || '', c.line || '', c.address || '', c.note || '');
          if (result?.id) {
            idMap[c.id] = result.id;
            c.id = result.id;
            syncedCount++;
          }
        } catch (e) { /* skip individual failures */ }
      }
    }

    // Remap vehicle custIds to Supabase UUIDs
    for (const v of (S.vehicles || [])) {
      if (idMap[v.custId]) v.custId = idMap[v.custId];
    }

    // 2. Sync vehicles
    for (const v of (S.vehicles || [])) {
      if (!v.id || v.id.startsWith('V-')) {
        try {
          const result = await addVehicle(v.custId, v.plate, v.brand, v.model, v.year, v.color, v.mileage, '', '', v.note || '');
          if (result?.id) {
            idMap[v.id] = result.id;
            v.id = result.id;
            syncedCount++;
          }
        } catch (e) { /* skip individual failures */ }
      }
    }

    // Remap job references
    for (const j of (S.jobs || [])) {
      if (idMap[j.custId]) j.custId = idMap[j.custId];
      if (idMap[j.vehicleId]) j.vehicleId = idMap[j.vehicleId];
    }

    // 3. Sync jobs
    for (const j of (S.jobs || [])) {
      if (!j.id || j.id.startsWith('J-')) {
        try {
          const result = await addJob(j.vehicleId, j.custId, j.complaint || '', j.assignTo || '', j.mileage || 0, j.note || '');
          if (result?.id) {
            idMap[j.id] = result.id;
            j.id = result.id;
            syncedCount++;
          }
        } catch (e) { /* skip individual failures */ }
      }
    }

    // Remap invoice references
    for (const inv of (S.invoices || [])) {
      if (idMap[inv.custId]) inv.custId = idMap[inv.custId];
      if (idMap[inv.vehicleId]) inv.vehicleId = idMap[inv.vehicleId];
      if (idMap[inv.jobId]) inv.jobId = idMap[inv.jobId];
    }

    // 4. Sync invoices
    for (const inv of (S.invoices || [])) {
      if (!inv.id || inv.id.startsWith('I-')) {
        try {
          const items = (inv.items || []).map(it => ({
            type: it.itemType || 'service',
            description: it.name || '',
            quantity: it.qty || 1,
            unitPrice: it.price || 0,
            total: (it.qty || 1) * (it.price || 0),
            note: ''
          }));
          const result = await addInvoice(
            inv.jobId || null, inv.custId, inv.vehicleId || null,
            items, inv.sub || 0, inv.disc || 0, inv.vat || 0, inv.grand || 0,
            inv.note || '', inv.no || ''
          );
          if (result?.id) {
            idMap[inv.id] = result.id;
            inv.id = result.id;
            syncedCount++;
          }
        } catch (e) { /* skip individual failures */ }
      }
    }

    // Save updated S (with Supabase UUIDs) back to localStorage
    localStorage.setItem(DB_KEY, JSON.stringify(S));

    if (syncedCount > 0) {
      console.log(`[DB] ✅ Synced ${syncedCount} records to Supabase — data is now backed up`);
      if (typeof showToast === 'function') {
        showToast(`ซิงค์ข้อมูล ${syncedCount} รายการไปยัง Supabase แล้ว ✅`, 'ok');
      }
    } else {
      console.log('[DB] Sync ran but nothing new to migrate');
    }
  } catch (err) {
    console.error('[DB] syncLocalToSupabase error:', err);
  }
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
