/* ============================================================
   JOBS.JS — Job Card, สถานะงาน, ใบเบิกสต๊อก (Requisition)
   ============================================================ */

let _jobFilter = -1; // -1 = แสดงทั้งหมด

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function jobsHTML() {
  const filtered = _jobFilter === -1
    ? [...S.jobs].reverse()
    : S.jobs.filter(j => j.status === _jobFilter).reverse();

  const filterBtns = `
    <button class="btn btn-sm ${_jobFilter===-1?'btn-red':'btn-ghost'}" data-jf="-1">
      ทั้งหมด (${S.jobs.length})
    </button>
    ${JOB_STATUS.map((s, i) => `
      <button class="btn btn-sm ${_jobFilter===i?'btn-red':'btn-ghost'}" data-jf="${i}">
        <span style="width:7px;height:7px;border-radius:50%;display:inline-block;background:${JOB_DOT[i]}"></span>
        ${s} (${S.jobs.filter(j=>j.status===i).length})
      </button>`).join('')}`;

  const rows = filtered.length
    ? filtered.map(j => {
        const inv = S.invoices.find(i => i.jobId === j.id);
        return `
          <tr data-oj="${j.id}">
            <td class="mono" style="font-size:.75rem;color:var(--teal)">${j.no}</td>
            <td style="font-size:.8rem">${dateStr(j.createdAt)}</td>
            <td style="font-weight:600">${esc(j.custName || '—')}</td>
            <td style="font-size:.82rem;color:var(--fg2)">${esc(j.plate || '—')} ${j.carModel ? '· '+esc(j.carModel) : ''}</td>
            <td style="font-size:.82rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${esc(j.complaint || '—')}
            </td>
            <td style="font-size:.82rem;color:var(--fg2)">${esc(j.assignTo || '—')}</td>
            <td><span class="badge b-${JOB_COLOR[j.status]}">${JOB_STATUS[j.status]}</span></td>
            <td class="r money fc-gold">${inv ? THB(inv.grand) : '—'}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="tbl-empty">ไม่มีงาน</td></tr>`;

  return `
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">Job Card</h1>
        <div style="font-size:.82rem;color:var(--fg2);margin-top:2px">
          ${S.jobs.length} งานทั้งหมด · ${S.jobs.filter(j=>j.status<5).length} งานที่เปิดอยู่
        </div>
      </div>
      <button class="btn btn-gold" id="addJobBtn">
        ${svgI('<path d="M12 5v14M5 12h14"/>')} เปิดงานใหม่
      </button>
    </div>

    <div class="flex gap8 mb16" style="flex-wrap:wrap">${filterBtns}</div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>เลขที่งาน</th><th>วันที่เข้า</th><th>ลูกค้า</th>
            <th>ทะเบียน / รุ่น</th><th>แจ้งซ่อม</th>
            <th>ผู้รับผิดชอบ</th><th>สถานะ</th><th class="r">ยอด</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindJobs() {
  sel('addJobBtn')?.addEventListener('click', () => openJobModal(null, null));

  document.querySelectorAll('[data-jf]').forEach(b =>
    b.addEventListener('click', () => { _jobFilter = parseInt(b.dataset.jf); renderPanel(); })
  );

  document.querySelectorAll('[data-oj]').forEach(el =>
    el.addEventListener('click', () => openJobDetail(el.dataset.oj))
  );
}

/* ══════════════════════════════════════
   JOB MODAL (เปิด/แก้ไขงาน)
══════════════════════════════════════ */
function openJobModal(jid, prefVid) {
  const j   = jid ? S.jobs.find(x => x.id === jid) : null;
  const ov  = sel('mOv');

  const vehOpts = S.vehicles.map(v => {
    const c = S.customers.find(x => x.id === v.custId);
    const selected = (j?.vehicleId || prefVid) === v.id ? ' selected' : '';
    return `<option value="${v.id}"${selected}>${esc(v.plate)} — ${esc([v.brand,v.model].filter(Boolean).join(' '))} (${esc(c?.name||'?')})</option>`;
  }).join('');

  ov.innerHTML = `
    <div class="modal md">
      <div class="modal-h">
        <h3>${j ? `แก้ไขงาน ${j.no}` : 'เปิดงานใหม่'}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fgrid c2 mb12">
          <div class="fld"><label>รถ (ทะเบียน) *</label>
            <select id="jVeh"><option value="">— เลือกรถ —</option>${vehOpts}</select>
          </div>
          <div class="fld"><label>เลขไมล์ขณะเข้า</label>
            <input id="jMile" type="number" value="${j?.mileage||''}" placeholder="85000">
          </div>
        </div>
        <div class="fld mb12"><label>รายการแจ้งซ่อม / อาการ</label>
          <textarea id="jComp" rows="3" placeholder="ลูกค้าแจ้งว่า…">${esc(j?.complaint||'')}</textarea>
        </div>
        <div class="fgrid c2 mb12">
          <div class="fld"><label>ผู้รับผิดชอบ / ช่าง</label>
            <input id="jAssign" value="${esc(j?.assignTo||'')}" placeholder="ชื่อช่าง">
          </div>
          <div class="fld"><label>สถานะ</label>
            <select id="jStatus">
              ${JOB_STATUS.map((s,i) => `<option value="${i}"${(j?.status??0)===i?' selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="fld"><label>หมายเหตุ</label>
          <textarea id="jNote" rows="2">${esc(j?.note||'')}</textarea>
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold" id="mOk">
          ${svgI('<path d="M20 6 9 17l-5-5"/>')} ${j ? 'บันทึก' : 'เปิดงาน'}
        </button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const vid = sv('jVeh');
    if (!vid) return showToast('กรุณาเลือกรถ', 'err');

    const v    = S.vehicles.find(x => x.id === vid);
    const c    = S.customers.find(x => x.id === v?.custId);
    const mile = parseInt(sv('jMile')) || 0;

    /* อัปเดตเลขไมล์รถ */
    if (mile && v) v.mileage = mile;

    const data = {
      vehicleId:  vid,
      custId:     v?.custId,
      custName:   c?.name || '',
      plate:      v?.plate || '',
      carModel:   [v?.brand, v?.model].filter(Boolean).join(' '),
      mileage:    mile,
      complaint:  sv('jComp'),
      assignTo:   sv('jAssign'),
      status:     parseInt(sv('jStatus')),
      note:       sv('jNote'),
    };

    if (j) {
      Object.assign(j, data);
    } else {
      const no = nextSeqNo('job').replace('job-', 'JOB-');
      S.jobs.push({
        id:           'J-' + Date.now(),
        no,
        createdAt:    Date.now(),
        requisitions: [],
        ...data,
      });
    }

    await saveData();
    closeMod();
    renderPanel();
    renderNav();
    showToast(j ? 'อัปเดตงานแล้ว' : `เปิดงาน ${S.jobs.slice(-1)[0]?.no} แล้ว`);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   JOB DETAIL (ดูรายละเอียด + สร้างใบเบิก)
══════════════════════════════════════ */
function openJobDetail(jid) {
  const j   = S.jobs.find(x => x.id === jid);
  if (!j) return;

  const reqs      = S.requisitions.filter(r => r.jobId === jid);
  const inv       = S.invoices.find(i => i.jobId === jid);
  const totalCost = reqs.reduce((s, r) => s + r.items.reduce((ss, it) => ss + it.qty * (it.cost || 0), 0), 0);
  const ov        = sel('mOv');

  const statusBtns = JOB_STATUS.map((s, i) => `
    <button class="btn btn-xs ${j.status===i?'btn-red':'btn-ghost'}" data-jst="${i}">${s}</button>
  `).join('');

  const reqCards = reqs.length
    ? reqs.map(r => `
      <div class="card mb8">
        <div class="card-h" style="padding:9px 14px">
          <span class="mono" style="font-size:.72rem;color:var(--teal)">${r.no}</span>
          <span style="font-size:.8rem;margin-left:8px">${dateStr(r.ts)}</span>
          ${hasPermission('canViewCost') ? `<span style="margin-left:auto;font-size:.8rem;color:var(--fg2)">
            ต้นทุน ${THB(r.items.reduce((s,it)=>s+it.qty*(it.cost||0),0))}
          </span>` : ''}
        </div>
        <div style="padding:0 14px 10px">
          <table class="tbl" style="font-size:.82rem">
            <tbody>
              ${r.items.map(it => `
                <tr>
                  <td>${esc(it.name)}</td>
                  <td class="r" style="color:var(--fg2)">${numFmt(it.qty)} ${esc(it.unit)}</td>
                  ${hasPermission('canViewCost') ? `<td class="r fc-gold">${THB(it.cost * it.qty)}</td>` : ''}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`)
      .join('')
    : `<div class="card mb8"><div style="padding:20px;text-align:center;color:var(--fg3);font-size:.88rem">
        ยังไม่มีใบเบิก — กดปุ่ม "สร้างใบเบิก" เพื่อเบิกของจากสต๊อก
      </div></div>`;

  const billSection = inv
    ? `<div style="font-size:.86rem">
        ออกใบเสร็จ <b style="color:var(--teal)">${inv.no}</b><br>
        ยอดรวม <b class="fc-gold">${THB(inv.grand)}</b><br>
        ${hasPermission('canViewCost') ? `ต้นทุน ${THB(totalCost)} ·` : ''}
        ${hasPermission('canViewProfit') ? `กำไร <span style="color:${inv.grand-totalCost>=0?'var(--grn)':'var(--bad)'}">
          ${THB(inv.grand - totalCost)}
        </span>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm mt8" id="viewInvBtn">ดูใบเสร็จ</button>`
    : `${hasPermission('canViewCost') ? `<div style="font-size:.86rem;color:var(--fg2);margin-bottom:10px">
        ต้นทุนใบเบิก ${THB(totalCost)}
      </div>` : ''}
      <button class="btn btn-gold btn-sm" id="billJobBtn">ออกบิลจากงานนี้</button>`;

  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <div>
          <h3>${j.no} — ${esc(j.plate)}</h3>
          <div style="font-size:.76rem;color:var(--fg2);margin-top:2px">
            ${esc(j.custName || '')} · ${esc(j.carModel || '')}
          </div>
        </div>
        <div class="flex gap8">
          <button class="btn btn-ghost btn-sm" id="editJobBtn">แก้ไข</button>
          <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
        </div>
      </div>
      <div class="modal-b">
        <!-- Status + info bar -->
        <div class="card mb16"><div class="card-b" style="padding:12px 16px">
          <div class="flex gap8 mb8" style="flex-wrap:wrap">${statusBtns}</div>
          <div class="flex gap12" style="font-size:.82rem;flex-wrap:wrap">
            <span>เข้า: <b>${dateStr(j.createdAt)}</b></span>
            <span>ไมล์: <b>${j.mileage ? numFmt(j.mileage)+' กม.' : '—'}</b></span>
            <span>ช่าง: <b>${esc(j.assignTo || '—')}</b></span>
          </div>
          ${j.complaint ? `
            <div style="margin-top:8px;font-size:.84rem;background:var(--p3);border-radius:8px;padding:9px 12px;color:var(--fg2)">
              แจ้งซ่อม: <span style="color:var(--fg)">${esc(j.complaint)}</span>
            </div>` : ''}
        </div></div>

        <!-- Requisitions -->
        <div class="fjb mb8">
          <h3 class="cond" style="font-weight:800;text-transform:uppercase;font-size:1rem">
            ใบเบิกสต๊อก
          </h3>
          <button class="btn btn-teal btn-sm" id="addReqBtn">
            ${svgI('<path d="M12 5v14M5 12h14"/>')} สร้างใบเบิก
          </button>
        </div>
        ${reqCards}

        <!-- Billing -->
        <div class="g2 mt12">
          <div class="card">
            <div class="card-h">${svgI('<path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 12h6"/>')} <h2>ออกบิล</h2></div>
            <div class="card-b">${billSection}</div>
          </div>
          <div class="card">
            <div class="card-h">${svgI('<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>')} <h2>หมายเหตุงาน</h2></div>
            <div class="card-b"><div style="font-size:.85rem;color:var(--fg2)">${esc(j.note || '—')}</div></div>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ปิด</button>
      </div>
    </div>`;

  openOv('mOv');

  /* Status buttons */
  ov.querySelectorAll('[data-jst]').forEach(b => {
    b.addEventListener('click', async () => {
      j.status = parseInt(b.dataset.jst);
      await saveData();
      renderNav();
      renderPanel();
      openJobDetail(jid); /* re-open with new status */
      showToast(`อัปเดตสถานะ: ${JOB_STATUS[j.status]}`);
    });
  });

  ov.querySelector('#editJobBtn')?.addEventListener('click', () => {
    closeMod();
    setTimeout(() => openJobModal(jid, null), 80);
  });

  ov.querySelector('#addReqBtn')?.addEventListener('click', () => {
    closeMod();
    setTimeout(() => openReqModal(jid), 80);
  });

  ov.querySelector('#billJobBtn')?.addEventListener('click', () => {
    closeMod();
    setTimeout(() => openBillFromJob(jid), 80);
  });

  ov.querySelector('#viewInvBtn')?.addEventListener('click', () => {
    if (inv) { closeMod(); setTimeout(() => showDoc('inv', inv), 80); }
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   REQUISITION MODAL (ใบเบิกสต๊อก)
══════════════════════════════════════ */
function openReqModal(jid) {
  const j = S.jobs.find(x => x.id === jid);
  if (!j) return;

  let rItems = [];
  let rKey   = 0;

  const stOpts = S.stockItems.map(i =>
    `<option value="${i.id}">${esc(i.name)} [${i.unit}] — คงเหลือ ${numFmt(i.qty)}</option>`
  ).join('');

  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <h3>ใบเบิกสต๊อก — ${j.no} (${esc(j.plate)})</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="flex gap8 mb14" style="flex-wrap:wrap">
          <select id="rSel" style="flex:1;min-width:200px;background:var(--ink);border:1px solid var(--ln2);
                                   color:var(--fg);border-radius:8px;padding:9px 11px;font-size:.88rem;outline:none">
            <option value="">+ เลือกของที่ต้องการเบิก…</option>
            ${stOpts}
          </select>
          <button class="btn btn-teal btn-sm" id="rAddSt">
            ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่มจากสต๊อก
          </button>
          <button class="btn btn-ghost btn-sm" id="rAddFr">
            ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>')} รายการอื่น
          </button>
        </div>

        <!-- Column headers -->
        <div style="display:grid;grid-template-columns:1fr 110px 70px 36px;gap:8px;
                    padding:0 4px 7px;font-family:'JetBrains Mono',monospace;
                    font-size:.6rem;letter-spacing:1px;color:var(--fg2);text-transform:uppercase;
                    border-bottom:1px solid var(--ln);margin-bottom:4px">
          <span>รายการ</span><span>จำนวน + หน่วย</span><span class="r">ต้นทุน</span><span></span>
        </div>

        <div id="rRows">
          <div class="bi-empty">ยังไม่มีรายการ — เลือกจากสต๊อกหรือกรอกเอง</div>
        </div>

        <div class="fld mt12">
          <label>หมายเหตุ / อ้างอิง</label>
          <input id="rNote" placeholder="เช่น เปลี่ยนน้ำมันเครื่อง…">
        </div>
      </div>
      <div class="modal-f">
        <div style="font-size:.84rem;color:var(--fg2)">
          ต้นทุนรวม: <b id="rTotal" class="fc-gold">฿0</b>
        </div>
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-red" id="rSave" disabled>
          ${svgI('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}
          ยืนยันเบิก &amp; ตัดสต๊อก
        </button>
      </div>
    </div>`;

  openOv('mOv');

  /* ── Render req rows ── */
  function renderReqRows() {
    const box = sel('rRows');
    if (!box) return;

    if (!rItems.length) {
      box.innerHTML = '<div class="bi-empty">ยังไม่มีรายการ</div>';
      sel('rSave').disabled = true;
      si('rTotal', '฿0');
      return;
    }

    const hasShort = rItems.some(it => {
      const st = S.stockItems.find(x => x.id === it.sid);
      return it.sid && it.qty > (st?.qty || 0);
    });

    box.innerHTML = rItems.map(it => {
      const st    = it.sid ? S.stockItems.find(x => x.id === it.sid) : null;
      const short = st && it.qty > st.qty;
      return `
        <div style="display:grid;grid-template-columns:1fr 110px 70px 36px;gap:8px;
                    align-items:center;padding:7px 4px;border-bottom:1px dashed var(--ln)">
          <div>
            <div style="font-size:.86rem;font-weight:600">${esc(it.nm)}</div>
            ${it.sid ? `
              <div style="font-size:.67rem;color:${short?'var(--bad)':'var(--fg2)'};font-family:'JetBrains Mono',monospace">
                ${it.sid}${short ? ` · ⚠ ไม่พอ (เหลือ ${numFmt(st.qty)})` : ' · คงเหลือ '+numFmt(st?.qty||0)}
              </div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <input type="number" min="0" step="${it.unit==='ลิตร'?'0.5':'1'}"
                   value="${numFmt(it.qty)}" data-rk="${it.k}"
                   style="width:64px;background:var(--ink);border:1px solid var(--ln2);
                          color:var(--fg);border-radius:7px;padding:6px 7px;font-size:.84rem;
                          outline:none;text-align:right">
            <span style="font-size:.76rem;color:var(--fg2)">${it.unit}</span>
          </div>
          ${hasPermission('canViewCost') ? `<div style="font-size:.82rem;text-align:right;color:var(--fg2)">
            ${THB(it.cost * it.qty)}
          </div>` : ''}
          <button class="btn-icon" data-rdl="${it.k}">
            ${svgI('<path d="M18 6 6 18M6 6l12 12"/>',13)}
          </button>
        </div>`;
    }).join('');

    /* Bind row inputs */
    box.querySelectorAll('input[data-rk]').forEach(inp => {
      inp.addEventListener('input', () => {
        const it = rItems.find(x => x.k == inp.dataset.rk);
        if (it) it.qty = parseFloat(inp.value) || 0;
        renderReqRows();
      });
    });

    box.querySelectorAll('[data-rdl]').forEach(b => {
      b.addEventListener('click', () => {
        rItems = rItems.filter(x => x.k != b.dataset.rdl);
        renderReqRows();
      });
    });

    const tot         = rItems.reduce((s, it) => s + it.qty * it.cost, 0);
    const totDisplay  = hasPermission('canViewCost') ? THB(tot) : '—';
    si('rTotal', totDisplay);

    const saveBtn     = sel('rSave');
    saveBtn.disabled  = !rItems.length || hasShort;
    saveBtn.textContent = hasShort
      ? '⚠ สต๊อกไม่พอ'
      : 'ยืนยันเบิก & ตัดสต๊อก';
  }

  /* Add from stock */
  sel('rAddSt').addEventListener('click', () => {
    const id = sv('rSel');
    if (!id) return;
    if (rItems.find(x => x.sid === id)) return showToast('มีรายการนี้แล้ว', 'err');
    const m = S.stockItems.find(x => x.id === id);
    rItems.push({ k: ++rKey, sid: id, nm: m.name, unit: m.unit, qty: m.unit==='ลิตร'?4:1, cost: m.cost });
    sel('rSel').value = '';
    renderReqRows();
  });

  /* Add free-text item */
  sel('rAddFr').addEventListener('click', () => {
    rItems.push({ k: ++rKey, sid: null, nm: 'รายการอื่น', unit: 'ชิ้น', qty: 1, cost: 0 });
    renderReqRows();
  });

  /* Save & deduct stock */
  sel('rSave').addEventListener('click', async () => {
    if (!rItems.length) return;

    for (const it of rItems) {
      const st = S.stockItems.find(x => x.id === it.sid);
      if (it.sid && it.qty > (st?.qty || 0)) {
        return showToast('สต๊อกไม่พอ: ' + it.nm, 'err');
      }
    }

    /* Deduct stock */
    rItems.forEach(it => {
      if (!it.sid) return;
      const m = S.stockItems.find(x => x.id === it.sid);
      if (m) {
        m.qty  = fmt(m.qty  - it.qty);
        m.used = fmt((m.used || 0) + it.qty);
      }
    });

    const no  = nextSeqNo('rq').replace('rq-', 'RQ-');
    const req = {
      id:     'RQ-' + Date.now(),
      no,
      ts:     Date.now(),
      jobId:  jid,
      note:   sv('rNote'),
      items:  rItems.map(it => ({
        sid:  it.sid,
        name: it.nm,
        unit: it.unit,
        qty:  fmt(it.qty),
        cost: it.cost,
      })),
    };

    S.requisitions.push(req);
    if (!j.requisitions) j.requisitions = [];
    j.requisitions.push(req.id);

    await saveData();
    closeMod();
    renderNav();
    showToast(`เบิกสต๊อก ${no} แล้ว · ตัดของเรียบร้อย`);
    openJobDetail(jid);
  });

  /* Close → go back to job detail */
  ov.querySelector('#mCl').addEventListener('click',  () => { closeMod(); openJobDetail(jid); });
  ov.querySelector('#mCl2').addEventListener('click', () => { closeMod(); openJobDetail(jid); });
}
