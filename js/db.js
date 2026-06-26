/* ============================================================
   DB.JS — Persistent Storage via localStorage
   ────────────────────────────────────────────
   ใช้ localStorage เพื่อให้ข้อมูลคงอยู่ข้าม session
   ทำงานบน VS Code Live Server / ไฟล์ธรรมดาได้เลย
   ============================================================ */

const DB_KEY = 'tbr-system-v1';
let useSupabase = false;
let _servicesSynced = false; // one-time flag per session
let _liveSync      = null;   // polling interval for remote sync
let _lastSyncTs    = 0;      // debounce timestamp

/* ══════════════════════════════════════
   LIVE SYNC — ดึงข้อมูลใหม่จาก Supabase
   เรียกจาก Realtime subscription / polling / visibilitychange
══════════════════════════════════════ */
async function syncRemoteData() {
  if (!useSupabase || !window.supabaseReady || typeof loadAllData !== 'function') return;
  if (Date.now() - _lastSyncTs < 5000) return; // debounce 5 วิ
  _lastSyncTs = Date.now();

  try {
    const data = await loadAllData();
    if (!data) return;

    const newState = convertSupabaseToState(data);
    let changed = false;

    // ── Jobs: เพิ่ม job ใหม่ + sync สถานะ + sync assignTo ──
    const jobById = new Map(S.jobs.map(j => [j.id, j]));
    const jobByNo = new Map(S.jobs.map(j => [j.no,  j]));
    for (const j of newState.jobs) {
      if (jobById.has(j.id)) {
        const ex = jobById.get(j.id);
        if (ex.status !== j.status) { ex.status = j.status; changed = true; }
        // Sync assignTo (fixes UUID→name when profiles join resolves)
        if (j.assignTo && j.assignTo !== ex.assignTo) { ex.assignTo = j.assignTo; changed = true; }
      } else if (jobByNo.has(j.no)) {
        // Job exists by number but different id (local id vs UUID) — sync assignTo + status
        const ex = jobByNo.get(j.no);
        if (ex.status !== j.status) { ex.status = j.status; changed = true; }
        if (j.assignTo && j.assignTo !== ex.assignTo) { ex.assignTo = j.assignTo; changed = true; }
        // Update id to Supabase UUID so invoice matching works
        const _uuidRe2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (_uuidRe2.test(j.id) && !_uuidRe2.test(ex.id)) { ex.id = j.id; changed = true; }
      } else {
        S.jobs.push(j); changed = true;
      }
    }

    // ── Invoices: เพิ่ม invoice ใหม่ + sync paid ──
    const invById = new Map(S.invoices.filter(i => i.id).map(i => [i.id, i]));
    const invByNo = new Map(S.invoices.map(i => [i.no, i]));
    for (const inv of newState.invoices) {
      if (inv.id && invById.has(inv.id)) {
        const ex = invById.get(inv.id);
        // ถ้าไม่มี _editedAt local ให้ Supabase override paid status
        if (!ex._editedAt && ex.paid !== inv.paid) { ex.paid = inv.paid; changed = true; }
        // sync jobId จาก Supabase ถ้า local มี ID ผิดรูปแบบ
        const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (inv.jobId && !_uuidRe.test(ex.jobId)) { ex.jobId = inv.jobId; changed = true; }
        // sync invoice items ถ้าจำนวน item เปลี่ยน หรือยอดรวมต่างกัน (user อื่นแก้บิล)
        if (!ex._editedAt && inv.items?.length > 0 &&
            (inv.items.length !== ex.items?.length || Math.abs((inv.grand || 0) - (ex.grand || 0)) > 0.01)) {
          ex.items = inv.items; ex.grand = inv.grand; ex.sub = inv.sub;
          ex.disc = inv.disc; ex.vat = inv.vat; ex.totalCost = inv.totalCost;
          changed = true;
        }
      } else if (!invByNo.has(inv.no)) {
        S.invoices.push(inv); changed = true;
      }
    }

    // ── Stock: sync quantity + เพิ่มสินค้าใหม่ ──
    const stockById = new Map(S.stockItems.map(i => [i.id, i]));
    for (const item of newState.stockItems) {
      if (stockById.has(item.id)) {
        const ex = stockById.get(item.id);
        if (ex.qty !== item.qty) { ex.qty = item.qty; changed = true; }
        if (item.sell && ex.sell !== item.sell) { ex.sell = item.sell; changed = true; }
        if (item.cost && ex.cost !== item.cost) { ex.cost = item.cost; changed = true; }
      } else {
        // สินค้าใหม่จาก Supabase
        S.stockItems.push(item); changed = true;
      }
    }

    // ── Customers: เพิ่มใหม่ + อัปเดตที่มีการแก้ไข ──
    const custById = new Map(S.customers.map(c => [c.id, c]));
    for (const c of newState.customers) {
      if (custById.has(c.id)) {
        const ex = custById.get(c.id);
        if (ex.name !== c.name || ex.phone !== c.phone || ex.email !== c.email || ex.address !== c.address) {
          Object.assign(ex, { name: c.name, phone: c.phone, email: c.email, address: c.address, note: c.note });
          changed = true;
        }
      } else {
        S.customers.push(c); changed = true;
      }
    }

    // ── Vehicles: เพิ่มใหม่ + อัปเดตที่มีการแก้ไข ──
    const vehById = new Map(S.vehicles.map(v => [v.id, v]));
    for (const v of newState.vehicles) {
      if (vehById.has(v.id)) {
        const ex = vehById.get(v.id);
        if (ex.plate !== v.plate || ex.mileage !== v.mileage || ex.brand !== v.brand || ex.model !== v.model) {
          Object.assign(ex, { plate: v.plate, brand: v.brand, model: v.model, year: v.year, color: v.color, mileage: v.mileage, note: v.note });
          changed = true;
        }
      } else {
        S.vehicles.push(v); changed = true;
      }
    }

    // ── Deletions: ลบรายการที่คนอื่น delete ออกจาก Supabase แล้ว ──
    // เฉพาะรายการที่มี Supabase UUID เท่านั้น (local-ID items ข้าม)
    const _delUuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const sbInvIds   = new Set(newState.invoices.map(i => i.id).filter(Boolean));
    const prevInvLen = S.invoices.length;
    S.invoices = S.invoices.filter(i => !i.id || !_delUuidRx.test(i.id) || sbInvIds.has(i.id));
    if (S.invoices.length !== prevInvLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevInvLen - S.invoices.length} deleted invoice(s)`); }

    const sbJobIds   = new Set(newState.jobs.map(j => j.id).filter(Boolean));
    const prevJobLen = S.jobs.length;
    S.jobs = S.jobs.filter(j => !j.id || !_delUuidRx.test(j.id) || sbJobIds.has(j.id));
    if (S.jobs.length !== prevJobLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevJobLen - S.jobs.length} deleted job(s)`); }

    const sbCustIds   = new Set(newState.customers.map(c => c.id).filter(Boolean));
    const prevCustLen = S.customers.length;
    S.customers = S.customers.filter(c => !c.id || !_delUuidRx.test(c.id) || sbCustIds.has(c.id));
    if (S.customers.length !== prevCustLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevCustLen - S.customers.length} deleted customer(s)`); }

    const sbVehIds   = new Set(newState.vehicles.map(v => v.id).filter(Boolean));
    const prevVehLen = S.vehicles.length;
    S.vehicles = S.vehicles.filter(v => !v.id || !_delUuidRx.test(v.id) || sbVehIds.has(v.id));
    if (S.vehicles.length !== prevVehLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevVehLen - S.vehicles.length} deleted vehicle(s)`); }

    // Stock: match by _uuid (Supabase UUID stored alongside SKU)
    if (newState.stockItems.length > 0) {
      const sbStockUuids  = new Set(newState.stockItems.map(i => i._uuid).filter(Boolean));
      const prevStockLen  = S.stockItems.length;
      S.stockItems = S.stockItems.filter(i => !i._uuid || sbStockUuids.has(i._uuid));
      if (S.stockItems.length !== prevStockLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevStockLen - S.stockItems.length} deleted stock item(s)`); }
    }

    // ── Requisitions ──
    const reqById = new Map(S.requisitions.map(r => [r.id, r]));
    const reqByNo = new Map(S.requisitions.map(r => [r.no, r]));
    for (const r of newState.requisitions) {
      if (!reqById.has(r.id) && !reqByNo.has(r.no)) {
        S.requisitions.push(r); changed = true;
      } else if (!reqById.has(r.id) && reqByNo.has(r.no)) {
        // Local has it by number (local ID) — update to Supabase UUID
        const ex = reqByNo.get(r.no);
        if (ex && ex.id !== r.id) { ex.id = r.id; changed = true; }
      }
    }
    const sbReqIds   = new Set(newState.requisitions.map(r => r.id).filter(Boolean));
    const prevReqLen = S.requisitions.length;
    S.requisitions = S.requisitions.filter(r => !r.id || !_delUuidRx.test(r.id) || sbReqIds.has(r.id));
    if (S.requisitions.length !== prevReqLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevReqLen - S.requisitions.length} deleted requisition(s)`); }

    // ── Expenses ──
    const expById = new Map(S.expenses.map(e => [e.id, e]));
    for (const e of newState.expenses) {
      if (!expById.has(e.id)) { S.expenses.push(e); changed = true; }
    }
    const sbExpIds   = new Set(newState.expenses.map(e => e.id).filter(Boolean));
    const prevExpLen = S.expenses.length;
    S.expenses = S.expenses.filter(e => !e.id || !_delUuidRx.test(e.id) || sbExpIds.has(e.id));
    if (S.expenses.length !== prevExpLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevExpLen - S.expenses.length} deleted expense(s)`); }

    // ── Quotes ──
    const qtById = new Map(S.quotes.map(q => [q.id, q]));
    const qtByNo = new Map(S.quotes.map(q => [q.no, q]));
    for (const q of newState.quotes) {
      if (qtById.has(q.id)) {
        const ex = qtById.get(q.id);
        if (!ex.converted && q.converted) { ex.converted = true; changed = true; }
      } else if (qtByNo.has(q.no)) {
        const ex = qtByNo.get(q.no);
        if (ex.id !== q.id) { ex.id = q.id; changed = true; }
        if (!ex.converted && q.converted) { ex.converted = true; changed = true; }
      } else {
        S.quotes.push(q); changed = true;
      }
    }
    const sbQtIds   = new Set(newState.quotes.map(q => q.id).filter(Boolean));
    const prevQtLen = S.quotes.length;
    S.quotes = S.quotes.filter(q => !q.id || !_delUuidRx.test(q.id) || sbQtIds.has(q.id));
    if (S.quotes.length !== prevQtLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevQtLen - S.quotes.length} deleted quote(s)`); }

    // ── Purchase Orders ──
    if (!S.purchaseOrders) S.purchaseOrders = [];
    const poById = new Map(S.purchaseOrders.map(p => [p.id, p]));
    const poByNo = new Map(S.purchaseOrders.map(p => [p.no, p]));
    for (const p of (newState.purchaseOrders || [])) {
      if (poById.has(p.id)) {
        const ex = poById.get(p.id);
        if (ex.status !== p.status) { ex.status = p.status; ex.receivedAt = p.receivedAt; changed = true; }
      } else if (poByNo.has(p.no)) {
        const ex = poByNo.get(p.no);
        if (ex.id !== p.id) { ex.id = p.id; changed = true; }
        if (ex.status !== p.status) { ex.status = p.status; ex.receivedAt = p.receivedAt; changed = true; }
      } else {
        S.purchaseOrders.push(p); changed = true;
      }
    }
    const sbPoIds   = new Set((newState.purchaseOrders || []).map(p => p.id).filter(Boolean));
    const prevPoLen = S.purchaseOrders.length;
    S.purchaseOrders = S.purchaseOrders.filter(p => !p.id || !_delUuidRx.test(p.id) || sbPoIds.has(p.id));
    if (S.purchaseOrders.length !== prevPoLen) { changed = true; console.log(`[DB] 🗑 Removed ${prevPoLen - S.purchaseOrders.length} deleted PO(s)`); }

    if (changed) {
      syncSeqFromState();
      localStorage.setItem(DB_KEY, JSON.stringify(S));

      // Re-render เฉพาะตอนที่ผู้ใช้ไม่กำลังกรอกฟอร์ม
      const modalOpen    = sel('mOv')?.style.display !== 'none' || sel('dOv')?.style.display !== 'none';
      const inBillingEdit = currentTab === 'billing' && bItems.length > 0;
      if (!modalOpen && !inBillingEdit) {
        renderNav();
        renderPanel();
        console.log('[DB] 🔄 Remote data synced & re-rendered');
      } else {
        showToast('มีข้อมูลใหม่จากผู้ใช้อื่น ● รีเฟรชเพื่ออัปเดต', 'inf');
        console.log('[DB] 🔄 Remote changes buffered (user in form)');
      }
    }
  } catch (e) {
    console.warn('[DB] syncRemoteData error:', e);
  }
}

function _onTabVisible() {
  if (document.visibilityState === 'visible') syncRemoteData();
}

function startLiveSync() {
  if (!useSupabase) return;

  // 1. Supabase Realtime — instant push on table changes
  try {
    const sbClient = typeof getSupabase === 'function' && getSupabase();
    if (sbClient?.channel) {
      sbClient
        .channel('tbr-live-' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs'          }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices'      }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items'   }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers'     }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles'      }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requisitions'     }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses'         }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes'           }, syncRemoteData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders'  }, syncRemoteData)
        .subscribe(status => {
          if (status === 'SUBSCRIBED')
            console.log('[DB] ✅ Supabase Realtime เชื่อมต่อแล้ว — sync อัตโนมัติทุก operation');
        });
    }
  } catch (e) {
    console.warn('[DB] Realtime setup failed (will use polling):', e);
  }

  // 2. Polling 15 วิ — fallback สำหรับเครื่องที่ Realtime ยังไม่ enabled
  if (_liveSync) clearInterval(_liveSync);
  _liveSync = setInterval(syncRemoteData, 15000);

  // 3. Sync เมื่อกลับมาที่แท็บ
  document.removeEventListener('visibilitychange', _onTabVisible);
  document.addEventListener('visibilitychange', _onTabVisible);

  console.log('[DB] 🔁 Live sync started (Realtime + polling 60s + visibilitychange)');
}

/**
 * Sync all seed services to Supabase (upsert by service_code).
 * Runs once per session after login so Supabase always has the latest prices/names.
 */
async function syncSeedServicesToSupabase() {
  if (_servicesSynced || !window.supabaseReady || !window.supabase) return;
  _servicesSynced = true;

  const seedServices = (typeof seedData === 'function' ? seedData() : S)?.services || [];
  if (!seedServices.length) return;

  const rows = seedServices.map(s => ({
    service_code: s.id,
    name: s.name,
    description: s.detail || '',
    price: s.price || 0,
  }));

  const { error } = await window.supabase
    .from('services')
    .upsert(rows, { onConflict: 'service_code' });

  if (error) {
    console.warn('[DB] services sync failed:', error.message);
  } else {
    console.log(`[DB] ✅ Synced ${rows.length} services to Supabase`);
    // Reload services into S
    const { data } = await window.supabase.from('services').select('*');
    if (data?.length) {
      S.services = data.map(s => ({ id: s.service_code, name: s.name, detail: s.description || '', price: s.price }));
    }
  }
}

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

          // ── ตรวจจับ RLS blocking invoices ──────────────────────────────
          // ถ้า Supabase คืน invoices = 0 แต่ localStorage มีบิล → RLS อาจบล็อก
          const localRaw = localStorage.getItem(DB_KEY);
          if (data.invoices?.length === 0 && localRaw) {
            try {
              const localParsed = JSON.parse(localRaw);
              const localInvCount = (localParsed.invoices || []).length;
              if (localInvCount > 0) {
                console.warn(`[DB] ⚠️  RLS อาจบล็อก invoices — Supabase คืน 0 บิล แต่ localStorage มี ${localInvCount} บิล`);
                console.warn('[DB] แก้ไข: รัน fix-data-visibility.sql ใน Supabase SQL Editor');
                // แสดง toast เตือน admin
                window._rlsWarning = true;
              }
            } catch (_e) {}
          }

          // ALWAYS merge localStorage records not yet in Supabase (safety net)
          mergeLocalStorageIntoS();
          // Sync seq counters so invoice/job numbers never collide between users
          syncSeqFromState();
          // Sync seed services (prices/names) to Supabase in background
          syncSeedServicesToSupabase().catch(e => console.warn('[DB] services sync error:', e));
          // Start live sync (Realtime + polling + visibilitychange)
          startLiveSync();
          console.log('[DB] ✅ โหลดจาก Supabase สำเร็จ - ข้อมูลซิงค์ระหว่างผู้ใช้');
          return;
        } else if (data) {
          // Got empty data but no error - might be RLS issue
          console.warn('[DB] Supabase returned empty data (possible RLS policy issue)');
          S = convertSupabaseToState(data);
          useSupabase = true;
          window._rlsWarning = true;
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
      assignTo: j.profiles?.full_name || j.assign_to || '',
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
        _uuid: i.id,   // real Supabase UUID — used for FK inserts (stock_ledger etc.)
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
    // Build UUID→SKU map so invoice items use SKU (sid) not UUID
    const uuidToSku = {};
    for (const si of (dbData.stockItems || [])) {
      if (si.id) {
        costByUuid[si.id] = si.cost_price || 0;
        if (si.sku) uuidToSku[si.id] = si.sku;
      }
    }

    state.invoices = dbData.invoices.map(i => ({
      id: i.id,
      no: i.invoice_number,
      ts: new Date(i.created_at).getTime(),
      jobId: i.job_id,
      cust: i.customer_name || i.customers?.name || '',
      phone: i.phone || '',
      plate: i.plate || i.vehicles?.plate || '',
      model: i.car_model || i.model || '',
      mileage: i.mileage,
      ref: i.note || '',
      items: i.invoice_items?.map(it => ({
        _itemId: it.id,
        name: it.description,
        unit: '',
        qty: it.quantity,
        price: it.unit_price,
        cost: it.cost_price > 0 ? it.cost_price : (it.stock_item_id ? (costByUuid[it.stock_item_id] || 0) : 0),
        itemType: it.item_type,
        // แปลง UUID → SKU เพื่อให้ stock deduction logic ทำงานได้ถูกต้อง
        sid: it.stock_item_id ? (uuidToSku[it.stock_item_id] || null) : null,
      })) || [],
      sub: i.subtotal,
      disc: i.discount || 0,
      // vat ใน DB เก็บเป็น rate (0.07) → แปลงกลับเป็นตัวเลข amount
      vat: (i.vat > 0) ? fmt(Math.max(0, (i.subtotal || 0) - (i.discount || 0)) * 0.07) : 0,
      grand: i.grand_total,
      totalCost: (i.invoice_items || []).reduce((s, it) => s + (it.quantity || 0) * (it.cost_price > 0 ? it.cost_price : (it.stock_item_id ? (costByUuid[it.stock_item_id] || 0) : 0)), 0),
      note: i.note || '',
      paid: i.payment_status || false,
    }));
  }

  if (dbData.stockLedger && dbData.stockLedger.length > 0) {
    // Build SKU→name/unit map from stockItems for display
    const skuMap = {};
    for (const si of (dbData.stockItems || [])) {
      skuMap[si.id] = { name: si.name, unit: si.unit, sku: si.sku };
    }
    state.stockLedger = dbData.stockLedger.map(e => {
      const si = e.stock_items || skuMap[e.stock_item_id] || {};
      const dt = new Date(e.created_at);
      return {
        _id: e.id,
        date: dt.toISOString().split('T')[0],
        time: dt.toLocaleTimeString('th-TH'),
        itemId: si.sku || e.stock_item_id || '',
        name: si.name || '',
        cat: '',
        type: e.type === 'adjust' ? 'count' : (e.type || 'in'),
        qty: Number(e.qty),
        unit: si.unit || '',
        note: e.note || '',
        user: ''
      };
    });
  }

  if (dbData.requisitions && dbData.requisitions.length > 0) {
    state.requisitions = dbData.requisitions.map(r => ({
      id:     r.id,
      no:     r.no     || '',
      ts:     new Date(r.created_at).getTime(),
      jobId:  r.job_id || null,
      note:   r.note   || '',
      items:  Array.isArray(r.items) ? r.items : [],
    }));
  }

  if (dbData.expenses && dbData.expenses.length > 0) {
    state.expenses = dbData.expenses.map(e => ({
      id:     e.id,
      label:  e.label  || '',
      amount: parseFloat(e.amount) || 0,
      date:   e.date   || '',
    }));
  }

  if (dbData.quotes && dbData.quotes.length > 0) {
    state.quotes = dbData.quotes.map(q => ({
      id:        q.id,
      no:        q.no         || '',
      ts:        new Date(q.created_at).getTime(),
      cust:      q.cust_name  || '',
      phone:     q.phone      || '',
      plate:     q.plate      || '',
      model:     q.car_model  || '',
      ref:       q.ref        || '',
      note:      q.note       || '',
      items:     Array.isArray(q.items) ? q.items : [],
      sub:       parseFloat(q.sub)   || 0,
      disc:      parseFloat(q.disc)  || 0,
      vat:       parseFloat(q.vat)   || 0,
      grand:     parseFloat(q.grand) || 0,
      converted: q.converted  || false,
    }));
  }

  if (dbData.purchaseOrders && dbData.purchaseOrders.length > 0) {
    state.purchaseOrders = dbData.purchaseOrders.map(p => ({
      id:         p.id,
      no:         p.no          || '',
      ts:         new Date(p.created_at).getTime(),
      supplier:   p.supplier    || '',
      status:     p.status      || 'pending',
      items:      Array.isArray(p.items) ? p.items : [],
      total:      parseFloat(p.total) || 0,
      note:       p.note        || '',
      receivedAt: p.received_at ? new Date(p.received_at).getTime() : null,
    }));
  }

  return state;
}

/**
 * Repair invoice items with wrong or missing costs:
 * 1. cost > price → recalculate as Math.round(price / 1.37)
 * 2. cost = 0 for stock items → lookup from S.stockItems by sid or name
 */
function repairInvoiceCosts() {
  // Build quick lookup maps for stock items
  const stockById   = {};
  const stockByName = {};
  for (const si of (S.stockItems || [])) {
    if (si.id)   stockById[si.id]     = si;
    if (si.name) stockByName[si.name.trim().toLowerCase()] = si;
  }

  let repaired = 0;
  for (const inv of (S.invoices || [])) {
    let changed = false;
    for (const it of (inv.items || [])) {
      if (!it.price || it.price <= 0) continue;

      // Case 1: cost > sell price — impossible, recalculate
      if (it.cost > it.price) {
        const fixed = Math.round(it.price / 1.37);
        console.log(`[DB] 🔧 cost>sell: ${it.name} ${it.cost}→${fixed}`);
        it.cost = fixed;
        changed = true;
        repaired++;
      }
      // Case 2: stock item with cost=0 — lookup from stock master
      else if (it.cost === 0 && it.itemType === 'stock') {
        const si = (it.sid && stockById[it.sid])
                 || stockByName[(it.name || '').trim().toLowerCase()];
        if (si && si.cost > 0) {
          console.log(`[DB] 🔧 stock cost=0: ${it.name} →${si.cost}`);
          it.cost = si.cost;
          changed = true;
          repaired++;
        }
      }
    }
    if (changed) {
      inv.totalCost = (inv.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);
    }
  }
  if (repaired > 0) {
    localStorage.setItem(DB_KEY, JSON.stringify(S));
    console.log(`[DB] ✅ Repaired ${repaired} item costs`);
  }
}

/**
 * Sync local seq counters to be higher than any existing INV-/JOB- numbers in S.
 * Prevents invoice/job number collisions when multiple users share the same Supabase.
 * Only affects today's date — sequence resets each day by design.
 */
function syncSeqFromState() {
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  })();

  const extract = (str, prefix) => {
    const m = str?.match(new RegExp(`${prefix}-${today}-(\\d+)`));
    return m ? parseInt(m[1]) : 0;
  };

  const maxInv = Math.max(0, ...S.invoices.map(i => extract(i.no, 'INV')));
  const maxJob = Math.max(0, ...S.jobs.map(j => extract(j.no, 'JOB')));
  const maxQt  = Math.max(0, ...((S.quotes||[]).map(q => extract(q.no, 'QT'))));
  const maxPo  = Math.max(0, ...((S.purchaseOrders||[]).map(p => extract(p.no, 'PO'))));

  if (maxInv >= (S.seq?.inv || 1)) S.seq.inv = maxInv + 1;
  if (maxJob >= (S.seq?.job || 1)) S.seq.job = maxJob + 1;
  if (maxQt  >= (S.seq?.qt  || 1)) S.seq.qt  = maxQt  + 1;
  if (maxPo  >= (S.seq?.po  || 1)) S.seq.po  = maxPo  + 1;

  if (maxInv > 0 || maxJob > 0) {
    console.log(`[DB] 🔢 Seq synced → INV:${S.seq.inv} JOB:${S.seq.job}`);
  }
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

    // If using Supabase, trigger background sync for any remaining local-ID entities
    if (useSupabase && window.supabaseReady) {
      const hasLocalIds = [
        ...(S.customers || []),
        ...(S.vehicles  || []),
        ...(S.jobs      || []),
        ...(S.invoices  || []),
      ].some(e => e.id && (e.id.startsWith('C-') || e.id.startsWith('V-') || e.id.startsWith('J-') || e.id.startsWith('I-')));

      if (hasLocalIds && typeof syncLocalToSupabase === 'function') {
        syncLocalToSupabase().catch(e => console.warn('[DB] background sync error:', e));
      }
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
    const _invUuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Helper: resolve a non-UUID jobId to Supabase UUID via ref (job number) or local job lookup
    const resolveJobIdToUuid = (jobId, ref, localJobs) => {
      if (jobId && _invUuidRe.test(jobId)) return jobId; // already UUID
      // Try ref = job number pre-filled in billing form
      if (ref) {
        const byRef = S.jobs.find(j => j.no === ref);
        if (byRef && _invUuidRe.test(byRef.id)) return byRef.id;
      }
      // Try resolving local jobId → local job → Supabase job by job number
      if (jobId && localJobs) {
        const lj = localJobs.find(j => j.id === jobId);
        if (lj?.no) {
          const sbJ = S.jobs.find(j => j.no === lj.no);
          if (sbJ && _invUuidRe.test(sbJ.id)) return sbJ.id;
        }
      }
      return jobId;
    };

    const sbInvNos = new Set(S.invoices.map(i => i.no).filter(Boolean));
    for (const inv of (local.invoices || [])) {
      if (inv.no && !sbInvNos.has(inv.no)) {
        // Invoice only in localStorage — resolve jobId to UUID before pushing
        const resolvedJobId = resolveJobIdToUuid(inv.jobId, inv.ref, local.jobs);
        const fixedInv = resolvedJobId !== inv.jobId ? { ...inv, jobId: resolvedJobId } : inv;
        S.invoices.push(fixedInv);
        toSync.invoices.push(fixedInv);
        merged++;
      } else if (inv.no && sbInvNos.has(inv.no)) {
        const sInv = S.invoices.find(i => i.no === inv.no);
        if (!sInv) continue;

        // ถ้า Supabase invoice ไม่มี jobId ที่ถูกต้อง → ลองแก้จาก ref หรือ local jobId
        if (!sInv.jobId || !_invUuidRe.test(sInv.jobId)) {
          const resolved = resolveJobIdToUuid(inv.jobId, inv.ref, local.jobs);
          if (resolved && _invUuidRe.test(resolved)) {
            sInv.jobId = resolved;
            // Fix job_id in Supabase in background
            if (typeof getSupabase === 'function' && sInv.id && _invUuidRe.test(sInv.id)) {
              getSupabase().from('invoices').update({ job_id: resolved }).eq('id', sInv.id)
                .then(() => console.log('[DB] ✅ Fixed job_id for', sInv.no, '→', resolved))
                .catch(() => {});
            }
            merged++;
          }
        }

        // ถ้า local มี _editedAt ที่ใหม่กว่า → ผู้ใช้เพิ่งแก้ไข ให้ใช้ข้อมูล local
        if (inv._editedAt && inv._editedAt > (sInv._editedAt || sInv.ts || 0)) {
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const keepId    = sInv.id;
          const keepPaid  = sInv.paid;
          const keepJobId = sInv.jobId; // คง Supabase job UUID ไว้
          Object.assign(sInv, inv);
          sInv.id   = keepId;    // คง Supabase UUID ไว้
          sInv.paid = keepPaid;  // คงสถานะชำระเงินจาก Supabase ไว้
          // ถ้า local jobId ไม่ใช่ UUID ให้ใช้ของ Supabase (กรณีสร้างก่อน sync)
          if (!uuidRe.test(sInv.jobId) && keepJobId) sInv.jobId = keepJobId;
          merged++;
        } else if ((inv.items || []).length > 0) {
          // Merge costs from localStorage (กรณีเก่า)
          const localCostSum = (inv.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);
          const sCostSum = (sInv.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);
          if (localCostSum > 0 && sCostSum === 0) {
            sInv.items = inv.items;
            merged++;
          }
        }
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

    // Requisitions: merge local ones not yet in Supabase (by no)
    const sbReqNos = new Set(S.requisitions.map(r => r.no).filter(Boolean));
    for (const r of (local.requisitions || [])) {
      if (r.no && !sbReqNos.has(r.no)) {
        S.requisitions.push(r);
        merged++;
      }
    }

    // Expenses: merge local ones not yet in Supabase (by id — local ids like 'EX-...')
    const sbExpIds2 = new Set(S.expenses.map(e => e.id).filter(Boolean));
    for (const e of (local.expenses || [])) {
      if (e.id && !sbExpIds2.has(e.id)) {
        S.expenses.push(e);
        merged++;
      }
    }

    // Quotes: merge local ones not yet in Supabase (by no)
    const sbQtNos = new Set(S.quotes.map(q => q.no).filter(Boolean));
    for (const q of (local.quotes || [])) {
      if (q.no && !sbQtNos.has(q.no)) {
        S.quotes.push(q);
        merged++;
      }
    }

    // Purchase Orders: merge local ones not yet in Supabase (by no)
    if (!S.purchaseOrders) S.purchaseOrders = [];
    const sbPoNos = new Set(S.purchaseOrders.map(p => p.no).filter(Boolean));
    for (const p of (local.purchaseOrders || [])) {
      if (p.no && !sbPoNos.has(p.no)) {
        S.purchaseOrders.push(p);
        merged++;
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
    // Always repair any invoice items where cost > sell (data entry errors)
    repairInvoiceCosts();
    // Push corrected costs back to Supabase (repairs old invoices)
    if (window.supabaseReady) {
      pushCostsToSupabase().catch(e => console.warn('[DB] pushCostsToSupabase failed:', e));
    }
  } catch (e) {
    console.warn('[DB] mergeLocalStorageIntoS error:', e);
  }
}

/**
 * Push corrected item costs from memory back to Supabase invoice_items.
 * Only updates rows where _itemId (Supabase UUID) is known and cost > 0.
 */
async function pushCostsToSupabase() {
  if (typeof updateInvoiceItemCosts !== 'function') return;
  const updates = [];
  for (const inv of (S.invoices || [])) {
    for (const it of (inv.items || [])) {
      if (it._itemId && it.cost > 0) {
        updates.push({ id: it._itemId, cost_price: it.cost });
      }
    }
  }
  if (updates.length === 0) return;
  const updated = await updateInvoiceItemCosts(updates);
  if (updated > 0) console.log(`[DB] ✅ Pushed cost to ${updated} old invoice items in Supabase`);
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
            items, inv.sub || 0, inv.disc || 0, (inv.vat > 0 ? 0.07 : 0), inv.grand || 0,
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
