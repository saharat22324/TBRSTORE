/* ============================================================
   SETTINGS.JS — ตั้งค่าระบบ
   ────────────────────────────────────────────
   3 sub-tabs: ข้อมูลร้าน / Service Package / ระบบ
   ============================================================ */

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function settingsHTML() {
  return `
    <div class="fjb mb16">
      <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">ตั้งค่าระบบ</h1>
    </div>

    <!-- Sub-tab buttons -->
    <div class="flex gap8 mb16">
      <button class="btn btn-sm ${settingsTab==='shop'  ?'btn-red':'btn-ghost'}" data-st="shop">ข้อมูลร้าน</button>
      <button class="btn btn-sm ${settingsTab==='svc'   ?'btn-red':'btn-ghost'}" data-st="svc">Service Package</button>
      <button class="btn btn-sm ${settingsTab==='sys'   ?'btn-red':'btn-ghost'}" data-st="sys">ระบบ &amp; ข้อมูล</button>
      <button class="btn btn-sm ${settingsTab==='audit' ?'btn-red':'btn-ghost'}" data-st="audit">ประวัติการแก้ไข</button>
    </div>

    ${settingsTab === 'shop'  ? shopSettingsHTML()    : ''}
    ${settingsTab === 'svc'   ? serviceSettingsHTML() : ''}
    ${settingsTab === 'sys'   ? systemSettingsHTML()  : ''}
    ${settingsTab === 'audit' ? auditLogHTML()        : ''}`;
}

/* ── Sub-tab: ประวัติการแก้ไข (Audit Log) ── */
function auditLogHTML() {
  return `
    <div class="card">
      <div class="card-h" style="justify-content:space-between">
        <div class="flex gap8">
          ${svgI('<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>')}
          <h2>ประวัติการแก้ไข</h2>
        </div>
        <button class="btn btn-ghost btn-sm" id="refreshAuditBtn">โหลดใหม่</button>
      </div>
      <div class="card-b">
        <div id="auditLogList"><div style="text-align:center;padding:20px;color:var(--fg3)">กำลังโหลด…</div></div>
      </div>
    </div>`;
}

async function loadAndRenderAuditLog() {
  const box = sel('auditLogList');
  if (!box) return;
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--fg3)">กำลังโหลด…</div>';
  const logs = typeof getAuditLogs === 'function' ? await getAuditLogs(200) : [];
  if (!logs.length) {
    box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--fg3)">ยังไม่มีประวัติ</div>';
    return;
  }
  const ACTION_LABEL = {
    JOB_STATUS_CHANGE: 'เปลี่ยนสถานะ',
    INVOICE_CREATE:    'ออกบิล',
    INVOICE_EDIT:      'แก้ไขบิล',
    JOB_CREATE:        'เปิดงาน',
    JOB_EDIT:          'แก้ไขงาน',
  };
  box.innerHTML = `
    <table class="tbl" style="font-size:.82rem">
      <thead><tr><th>วันเวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายการ</th><th>รายละเอียด</th></tr></thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td style="color:var(--fg2);white-space:nowrap">${new Date(l.created_at).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</td>
            <td>${esc(l.user_name||'—')}</td>
            <td><span class="badge b-blue">${esc(ACTION_LABEL[l.action]||l.action)}</span></td>
            <td class="mono" style="font-size:.72rem;color:var(--teal)">${esc(l.entity_ref||l.entity_id||'—')}</td>
            <td style="color:var(--fg2);font-size:.78rem">${l.details && Object.keys(l.details).length ? JSON.stringify(l.details) : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

/* ── Sub-tab: ข้อมูลร้าน ── */
function shopSettingsHTML() {
  const s = S.shop;
  return `
    <div class="g2">
      <div class="card">
        <div class="card-h">
          ${svgI('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>')}
          <h2>ข้อมูลร้าน</h2>
        </div>
        <div class="card-b">
          <div class="fgrid mb12">
            <div class="fld">
              <label>ชื่อบริษัท / ร้าน</label>
              <input id="sNm" value="${esc(s.name||'')}">
            </div>
          </div>
          <div class="fld mb12">
            <label>ที่อยู่</label>
            <textarea id="sAd" rows="2">${esc(s.addr||'')}</textarea>
          </div>
          <div class="fgrid c2 mb12">
            <div class="fld"><label>เบอร์โทร</label><input id="sPh" value="${esc(s.phone||'')}"></div>
            <div class="fld"><label>LINE ID</label><input id="sLn" value="${esc(s.line||'')}"></div>
          </div>
          <div class="fld mb12">
            <label>เลขประจำตัวผู้เสียภาษี</label>
            <input id="sTx" value="${esc(s.tax||'')}" placeholder="0000000000000">
          </div>
          <div class="fld mb16">
            <label>หมายเหตุท้ายเอกสาร</label>
            <input id="sNt" value="${esc(s.note||'')}">
          </div>
          <button class="btn btn-gold" id="saveShopBtn">
            ${svgI('<path d="M20 6 9 17l-5-5"/>')} บันทึกข้อมูลร้าน
          </button>
        </div>
      </div>

      <!-- Preview card -->
      <div class="card">
        <div class="card-h">${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>')} <h2>ตัวอย่างหัวเอกสาร</h2></div>
        <div class="card-b">
          <div style="background:#15171b;border-radius:10px;padding:14px 16px">
            <div style="font-family:'Saira Condensed',sans-serif;font-style:italic;
                        font-weight:900;font-size:1.1rem;color:#fff;letter-spacing:.5px">
              ${esc(s.name || 'TBR Performance')}
            </div>
            <div style="font-size:.7rem;color:#9aa0aa;margin-top:3px;line-height:1.55">
              ${esc(s.addr || '')}${s.phone ? '<br>โทร '+esc(s.phone) : ''}
              ${s.tax ? '<br>เลขภาษี '+esc(s.tax) : ''}
            </div>
          </div>
          <div style="font-size:.78rem;color:var(--fg2);margin-top:12px">
            หมายเหตุท้ายเอกสาร:<br>
            <span style="color:var(--fg)">${esc(s.note || '—')}</span>
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Sub-tab: Service Package ── */
function serviceSettingsHTML() {
  const rows = S.services.map(s => `
    <tr>
      <td class="mono" style="font-size:.74rem;color:var(--purple)">${esc(s.id)}</td>
      <td style="font-weight:600">${esc(s.name)}</td>
      <td style="font-size:.82rem;color:var(--fg2)">${esc(s.detail || '—')}</td>
      <td class="r money fc-gold">${THB(s.price)}</td>
      <td class="c">
        <button class="btn-icon" data-esvc="${s.id}">
          ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',13)}
        </button>
      </td>
    </tr>`).join('');

  return `
    <div class="fjb mb12">
      <div>
        <h2 class="cond" style="font-weight:800;text-transform:uppercase;font-size:1rem">
          Service Package
        </h2>
        <div style="font-size:.8rem;color:var(--fg2);margin-top:2px">
          ราคาตั้งเอง · ไม่ตัดสต๊อกอัตโนมัติ
        </div>
      </div>
      <button class="btn btn-gold btn-sm" id="addSvcBtn">+ เพิ่ม Package</button>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>รหัส</th><th>ชื่อบริการ</th><th>รายละเอียด</th><th class="r">ราคาขาย</th><th class="c"></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Sub-tab: ระบบ & ข้อมูล ── */
function systemSettingsHTML() {
  return `
    <div class="g2">
      <!-- System info -->
      <div class="card">
        <div class="card-h">
          ${svgI('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>')}
          <h2>สถานะระบบ</h2>
        </div>
        <div class="card-b">
          <div style="font-size:.87rem;line-height:2;color:var(--fg2)">
            ลูกค้า:         <b style="color:var(--fg)">${S.customers.length}</b><br>
            รถ:             <b style="color:var(--fg)">${S.vehicles.length}</b><br>
            Job Card:       <b style="color:var(--fg)">${S.jobs.length}</b><br>
            ใบเสร็จ:        <b style="color:var(--fg)">${S.invoices.length}</b><br>
            ใบเสนอราคา:    <b style="color:var(--fg)">${S.quotes.length}</b><br>
            ใบเบิกสต๊อก:   <b style="color:var(--fg)">${S.requisitions.length}</b><br>
            ค่าใช้จ่าย:    <b style="color:var(--fg)">${S.expenses.length}</b>
          </div>
        </div>
      </div>

      <!-- Backup / restore -->
      <div class="card">
        <div class="card-h">
          ${svgI('<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>')}
          <h2>สำรอง &amp; กู้คืนข้อมูล</h2>
        </div>
        <div class="card-b">
          <div style="font-size:.84rem;color:var(--fg2);margin-bottom:14px;line-height:1.6">
            ข้อมูลเก็บใน <b style="color:var(--fg)">localStorage</b> ของเบราว์เซอร์<br>
            แนะนำ Export สำรองข้อมูลทุกสัปดาห์
          </div>
          <div class="flex gap8" style="flex-direction:column">
            <button class="btn btn-teal" id="exportBtn">
              ${svgI('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>')}
              Export ข้อมูล (.json)
            </button>
            <label class="btn btn-ghost" style="cursor:pointer;justify-content:center">
              ${svgI('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
              Import ข้อมูล (.json)
              <input type="file" accept=".json" id="importFile" style="display:none">
            </label>
            <button class="btn btn-gold" id="forceSyncBtn">
              ${svgI('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>')}
              ตรวจสอบ &amp; ดันข้อมูลขึ้นคลาวด์
            </button>
            <div style="font-size:.78rem;color:var(--fg2);line-height:1.5">
              ใช้เมื่อ <b style="color:var(--fg)">ช่างคนอื่นไม่เห็นข้อมูลที่คุณเพิ่ม</b><br>
              ระบบจะดันข้อมูลที่ค้างในเครื่องนี้ขึ้นส่วนกลาง และแจ้งถ้าถูกบล็อก
            </div>
          </div>

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--ln)">
            <button class="btn btn-ghost" id="resetAllBtn"
              style="color:var(--bad);border-color:rgba(239,83,80,.3)">
              ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')}
              รีเซ็ตข้อมูลทั้งหมด (ไม่สามารถกู้คืนได้)
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindSettings() {

  /* Sub-tab switch */
  document.querySelectorAll('[data-st]').forEach(b =>
    b.addEventListener('click', () => {
      settingsTab = b.dataset.st;
      renderPanel();
      if (settingsTab === 'audit') loadAndRenderAuditLog();
    })
  );

  /* Auto-load audit log if already on that tab */
  if (settingsTab === 'audit') loadAndRenderAuditLog();

  sel('refreshAuditBtn')?.addEventListener('click', loadAndRenderAuditLog);

  /* ── Shop settings ── */
  sel('saveShopBtn')?.addEventListener('click', async () => {
    Object.assign(S.shop, {
      name:  sv('sNm'),
      addr:  sv('sAd'),
      phone: sv('sPh'),
      line:  sv('sLn'),
      tax:   sv('sTx'),
      note:  sv('sNt'),
    });
    // Sync shop config to Supabase (map JS field names → DB column names)
    if (useSupabase && typeof updateShopConfig === 'function') {
      updateShopConfig({
        name:    S.shop.name,
        address: S.shop.addr,
        phone:   S.shop.phone,
        line_id: S.shop.line,
        tax_id:  S.shop.tax,
        note:    S.shop.note,
      }).catch(e => console.warn('[Settings] shop config sync failed:', e));
    }
    await saveData();
    renderNav();
    showToast('บันทึกข้อมูลร้านแล้ว');
  });

  /* ── Service Package ── */
  sel('addSvcBtn')?.addEventListener('click', () => openSvcModal(null));

  document.querySelectorAll('[data-esvc]').forEach(b =>
    b.addEventListener('click', () => openSvcModal(b.dataset.esvc))
  );

  /* ── System ── */
  sel('exportBtn')?.addEventListener('click', () => {
    exportData();
    showToast('Export ข้อมูลแล้ว');
  });

  sel('importFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importData(file);
      renderNav();
      renderPanel();
      showToast('Import ข้อมูลสำเร็จ');
    } catch (err) {
      showToast('Import ไม่สำเร็จ — ตรวจสอบไฟล์', 'err');
    }
  });

  sel('forceSyncBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!window.supabaseReady) {
      showToast('ยังเชื่อมต่อ Supabase ไม่ได้ — ลองรีเฟรชหน้า', 'err');
      return;
    }
    if (typeof syncLocalToSupabase !== 'function') {
      showToast('ฟังก์ชันซิงค์ไม่พร้อม', 'err');
      return;
    }
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'กำลังดันข้อมูลขึ้นคลาวด์...';
    try {
      const res = await syncLocalToSupabase();
      const synced = res?.syncedCount || 0;
      const failed = res?.failedCount || 0;
      if (failed > 0) {
        showToast(`ดันขึ้นได้ ${synced} รายการ • ติดบล็อก ${failed} รายการ (RLS)`, 'err');
      } else if (synced > 0) {
        showToast(`ดันข้อมูลขึ้นคลาวด์สำเร็จ ${synced} รายการ ✅`, 'ok');
      } else {
        showToast('ข้อมูลทั้งหมดอยู่บนคลาวด์แล้ว ✅', 'ok');
      }
    } catch (err) {
      showToast('ดันข้อมูลไม่สำเร็จ: ' + (err?.message || err), 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  sel('resetAllBtn')?.addEventListener('click', async () => {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมด?\nข้อมูลจะหายหมด ไม่สามารถกู้คืนได้')) return;
    clearData();
    S = seedData();
    await saveData();
    renderNav();
    renderPanel();
    showToast('รีเซ็ตแล้ว');
  });
}

/* ══════════════════════════════════════
   SERVICE PACKAGE MODAL
══════════════════════════════════════ */
function openSvcModal(id) {
  const s  = id ? S.services.find(x => x.id === id) : null;
  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal md">
      <div class="modal-h">
        <h3>${s ? 'แก้ไข Package' : 'เพิ่ม Service Package'}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fgrid c2 mb12">
          <div class="fld"><label>รหัส *</label><input id="svId" value="${esc(s?.id||'')}" placeholder="SV10"></div>
          <div class="fld"><label>ราคาขาย (฿)</label><input id="svPrice" type="number" value="${s?.price||0}"></div>
        </div>
        <div class="fld mb12">
          <label>ชื่อบริการ *</label>
          <input id="svNm" value="${esc(s?.name||'')}" placeholder="ฟลัชชิ่งเกียร์…">
        </div>
        <div class="fld">
          <label>รายละเอียด</label>
          <textarea id="svDet" rows="2">${esc(s?.detail||'')}</textarea>
        </div>
      </div>
      <div class="modal-f">
        ${s ? `
          <button class="btn btn-ghost" id="delSvc"
            style="color:var(--bad);border-color:rgba(239,83,80,.3)">ลบ</button>` : ''}
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold"  id="mOk">
          ${svgI('<path d="M20 6 9 17l-5-5"/>')} ${s ? 'บันทึก' : 'เพิ่ม'}
        </button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const nId  = sv('svId').trim();
    const name = sv('svNm').trim();
    if (!nId || !name) return showToast('กรุณากรอกรหัสและชื่อ', 'err');

    const data = { id: nId, name, detail: sv('svDet'), price: parseFloat(sv('svPrice')) || 0 };

    if (s) {
      Object.assign(s, data);
    } else {
      S.services.push(data);
    }

    if (useSupabase && typeof upsertService === 'function') {
      upsertService(data).catch(e => console.warn('[Settings] service sync:', e));
    }
    await saveData();
    closeMod();
    renderPanel();
    showToast(s ? 'อัปเดตแล้ว' : 'เพิ่ม Package แล้ว');
  });

  ov.querySelector('#delSvc')?.addEventListener('click', async () => {
    if (!confirm('ลบ Package นี้?')) return;
    S.services = S.services.filter(x => x.id !== id);
    if (useSupabase && typeof deleteServiceByCode === 'function') {
      deleteServiceByCode(id).catch(e => console.warn('[Settings] service delete sync:', e));
    }
    await saveData();
    closeMod();
    renderPanel();
    showToast('ลบแล้ว');
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}
