/* ============================================================
   JOBS.JS — Job Card, สถานะงาน, ใบเบิกสต๊อก (Requisition)
   ============================================================ */

let _jobFilter   = -1;  // -1 = แสดงทั้งหมด
let _jobSearch   = '';  // ค้นหา
let _jobDateFrom = '';  // กรองวันที่: YYYY-MM-DD
let _jobDateTo   = '';  // กรองวันที่: YYYY-MM-DD

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function jobsHTML() {
  const filtered = (_jobFilter === -1
    ? [...S.jobs]
    : S.jobs.filter(j => j.status === _jobFilter)
  ).sort((a, b) => (b.createdAt || b.ts || 0) - (a.createdAt || a.ts || 0));

  // ── Search filter ──
  const q = _jobSearch.trim().toLowerCase();
  const qFiltered = q
    ? filtered.filter(j =>
        (j.no         || '').toLowerCase().includes(q) ||
        (j.custName   || '').toLowerCase().includes(q) ||
        (j.plate      || '').toLowerCase().includes(q) ||
        (j.carModel   || '').toLowerCase().includes(q) ||
        (j.complaint  || '').toLowerCase().includes(q) ||
        (j.assignTo   || '').toLowerCase().includes(q)
      )
    : filtered;

  // ── Date range filter ──
  const dfrom = _jobDateFrom ? new Date(_jobDateFrom).setHours(0,0,0,0) : null;
  const dto   = _jobDateTo   ? new Date(_jobDateTo).setHours(23,59,59,999) : null;
  const displayed = (dfrom || dto)
    ? qFiltered.filter(j => {
        const t = j.createdAt || j.ts || 0;
        if (dfrom && t < dfrom) return false;
        if (dto   && t > dto)   return false;
        return true;
      })
    : qFiltered;
  
  /* ── Stats ── */
  const totalJobs = S.jobs.length;
  const openJobs = S.jobs.filter(j => j.status < 5).length;
  const closeJobs = S.jobs.filter(j => j.status === 5).length;
  const totalRev = S.jobs.reduce((s, j) => {
    const inv = S.invoices.find(i => i.jobId === j.id || (j.no && i.ref === j.no));
    return s + (inv ? inv.grand - (inv.vat || 0) : 0); // ex-VAT
  }, 0);
  const avgRev = totalJobs > 0 ? totalRev / totalJobs : 0;

  const filterBtns = `
    <button class="btn btn-sm ${_jobFilter===-1?'btn-red':'btn-ghost'}" data-jf="-1">
      ทั้งหมด (${S.jobs.length})
    </button>
    ${JOB_STATUS.map((s, i) => `
      <button class="btn btn-sm ${_jobFilter===i?'btn-red':'btn-ghost'}" data-jf="${i}">
        <span style="width:7px;height:7px;border-radius:50%;display:inline-block;background:${JOB_DOT[i]}"></span>
        ${s} (${S.jobs.filter(j=>j.status===i).length})
      </button>`).join('')}`;

  const rows = displayed.length
    ? displayed.map(j => {
        const inv = S.invoices.find(i => i.jobId === j.id || (j.no && i.ref === j.no));
        return `
          <tr data-oj="${j.id}">
            <td class="mono" style="font-size:.75rem;color:var(--teal)">${j.no}</td>
            <td style="font-size:.8rem">${dateStr(j.createdAt)}</td>
            <td style="font-weight:600">${esc(j.custName || '—')}</td>
            <td style="font-size:.82rem;color:var(--fg2)">${esc(j.plate || '—')} ${j.carModel ? '· '+esc(j.carModel) : ''}</td>
            <td style="font-size:.82rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                title="${esc(j.complaint || '')}">
              ${esc(j.complaint || '—')}
            </td>
            <td style="font-size:.82rem;color:var(--fg2)">${esc(j.assignTo || '—')}</td>
            <td><span class="badge b-${JOB_COLOR[j.status]}">${JOB_STATUS[j.status]}</span></td>
            <td class="r money fc-gold">${inv ? THB(inv.grand) : '—'}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="tbl-empty">${q ? 'ไม่พบผลลัพธ์สำหรับ "'+esc(q)+'"' : 'ไม่มีงาน'}</td></tr>`;

  return `
    <!-- ── Header ── -->
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">Job Card</h1>
        <div style="font-size:.82rem;color:var(--fg2);margin-top:2px">
          ${totalJobs} งานทั้งหมด · ${openJobs} งานที่เปิดอยู่ · ${closeJobs} งานเสร็จ
        </div>
      </div>
      <button class="btn btn-gold" id="addJobBtn">
        ${svgI('<path d="M12 5v14M5 12h14"/>')} เปิดงานใหม่
      </button>
    </div>

    <!-- ── Stats cards ── -->
    <div class="g4 mb16">
      <div class="stat red" style="min-height:92px">
        <div class="sk">${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>')} งานทั้งหมด</div>
        <div class="sv" style="font-size:1.45rem">${totalJobs}</div>
        <div class="sd">${openJobs} งานเปิด • ${closeJobs} เสร็จ</div>
      </div>
      <div class="stat gold" style="min-height:92px">
        <div class="sk">${svgI('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')} ยอดรวมจากงาน</div>
        <div class="sv" style="font-size:1.45rem">${THB(totalRev)}</div>
        <div class="sd">เฉลี่ย ${THB(avgRev)}/งาน</div>
      </div>
      <div class="stat teal" style="min-height:92px">
        <div class="sk">${svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')} งานเปิดอยู่</div>
        <div class="sv" style="font-size:1.45rem">${openJobs}</div>
        <div class="sd">${totalJobs > 0 ? ((openJobs/totalJobs)*100).toFixed(0) : 0}% ของทั้งหมด</div>
      </div>
      <div class="stat warn" style="min-height:92px">
        <div class="sk">${svgI('<path d="M9 12l2 2 4-4m-6.5 10a9.5 9.5 0 1119 0 9.5 9.5 0 01-19 0z"/>')} งานเสร็จแล้ว</div>
        <div class="sv" style="font-size:1.45rem">${closeJobs}</div>
        <div class="sd">${totalJobs > 0 ? ((closeJobs/totalJobs)*100).toFixed(0) : 0}% สำเร็จ</div>
      </div>
    </div>

    <!-- ── Filter, Search and table ── -->
    <div class="fjb gap8 mb8" style="flex-wrap:wrap">
      <div class="flex gap8" style="flex-wrap:wrap;flex:1">${filterBtns}</div>
      <div style="position:relative;min-width:220px">
        <input id="jobSearchBox" value="${esc(_jobSearch)}" placeholder="🔍 ค้นหา ชื่อ / ทะเบียน / งาน…"
          style="width:100%;background:var(--ink);border:1px solid var(--ln2);color:var(--fg);
                 border-radius:8px;padding:7px 32px 7px 11px;font-size:.85rem;outline:none;box-sizing:border-box">
        ${_jobSearch ? `<button id="jobSearchClear" title="ล้าง"
          style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;
                 color:var(--fg2);cursor:pointer;font-size:.9rem;padding:0;line-height:1">✕</button>` : ''}
      </div>
    </div>
    <!-- ── Date range filter ── -->
    <div class="flex gap8 mb12" style="align-items:center;flex-wrap:wrap">
      <span style="font-size:.8rem;color:var(--fg2)">ช่วงวันที่:</span>
      <input type="date" id="jobDateFrom" value="${_jobDateFrom}"
        style="background:var(--ink);border:1px solid var(--ln2);color:var(--fg);border-radius:8px;
               padding:5px 9px;font-size:.82rem;outline:none">
      <span style="color:var(--fg2);font-size:.8rem">—</span>
      <input type="date" id="jobDateTo" value="${_jobDateTo}"
        style="background:var(--ink);border:1px solid var(--ln2);color:var(--fg);border-radius:8px;
               padding:5px 9px;font-size:.82rem;outline:none">
      ${(_jobDateFrom||_jobDateTo) ? `<button id="jobDateClear" class="btn btn-ghost btn-sm">ล้างวันที่</button>` : ''}
      ${displayed.length !== filtered.length ? `<span style="font-size:.78rem;color:var(--teal)">แสดง ${displayed.length} / ${S.jobs.length} รายการ</span>` : ''}
    </div>

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

  const sb = sel('jobSearchBox');
  if (sb) {
    sb.addEventListener('input', () => { _jobSearch = sb.value; renderPanel(); });
    sb.addEventListener('keydown', e => { if (e.key === 'Escape') { _jobSearch = ''; renderPanel(); } });
  }
  sel('jobSearchClear')?.addEventListener('click', () => { _jobSearch = ''; renderPanel(); });

  sel('jobDateFrom')?.addEventListener('change', e => { _jobDateFrom = e.target.value; renderPanel(); });
  sel('jobDateTo'  )?.addEventListener('change', e => { _jobDateTo   = e.target.value; renderPanel(); });
  sel('jobDateClear')?.addEventListener('click', () => { _jobDateFrom = ''; _jobDateTo = ''; renderPanel(); });

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

    let _newJobCloudOk = false;

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
      // Update in Supabase — only if j.id is a real Supabase UUID
      if (useSupabase) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (isUUID.test(j.id) && typeof updateJob === 'function') {
          // Map JS field names → DB column names (camelCase → snake_case)
          const dbData = {
            complaint: data.complaint || null,
            mileage:   data.mileage   || 0,
            note:      data.note      || null,
            assign_to: data.assignTo  || null,
            status_id: (data.status   || 0) + 1,
          };
          if (isUUID.test(data.vehicleId)) dbData.vehicle_id  = data.vehicleId;
          if (isUUID.test(data.custId))    dbData.customer_id = data.custId;
          updateJob(j.id, dbData).catch(e => console.warn('[Jobs] updateJob Supabase error:', e));
        } else if (typeof addJob === 'function') {
          // Local ID → create in Supabase, replace local ID
          addJob(data.vehicleId, data.custId, data.complaint, data.assignTo, data.mileage, data.note, j.no)
            .then(result => { if (result?.id) { j.id = result.id; localStorage.setItem(DB_KEY, JSON.stringify(S)); } })
            .catch(e => console.warn('[Jobs] addJob (upsert) error:', e));
        }
      }
    } else {
      const no = nextSeqNo('job').replace('job-', 'JOB-');
      const newJob = {
        id:           'J-' + Date.now(),
        no,
        createdAt:    Date.now(),
        requisitions: [],
        ...data,
      };
      S.jobs.push(newJob);
      // เขียนขึ้น Supabase ก่อน แล้วใช้ผลจริง (รอผล ไม่ใช่ fire-and-forget)
      if (useSupabase && typeof addJob === 'function') {
        try {
          const result = await addJob(data.vehicleId, data.custId, data.complaint, data.assignTo, data.mileage, data.note, no);
          if (result?.id) {
            newJob.id = result.id;     // ใช้ UUID จริงจาก Supabase
            _newJobCloudOk = true;
          }
        } catch (e) { console.warn('[Jobs] addJob Supabase error:', e); }
      }
    }

    await saveData();
    closeMod();
    renderPanel();
    renderNav();
    if (j) {
      showToast('อัปเดตงานแล้ว');
    } else if (!useSupabase) {
      showToast(`เปิดงาน ${S.jobs.slice(-1)[0]?.no} แล้ว`);
    } else if (_newJobCloudOk) {
      showToast(`เปิดงาน ${S.jobs.slice(-1)[0]?.no} แล้ว · ขึ้นคลาวด์ ☁️`);
    } else {
      showToast('เปิดงานแล้ว — ยังไม่ขึ้นคลาวด์ ระบบจะซิงค์อัตโนมัติ', 'err');
    }
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
  const inv       = S.invoices.find(i => i.jobId === jid || (j.no && i.ref === j.no));
  // คำนวณต้นทุนจาก items โดยตรง (ไม่ใช้ inv.totalCost ที่อาจเก่า)
  const calcInvCostJ = i => (i.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);
  const reqCost   = reqs.reduce((s, r) => s + r.items.reduce((ss, it) => ss + it.qty * (it.cost || 0), 0), 0);
  const totalCost = inv ? calcInvCostJ(inv) : reqCost;
  const ov        = sel('mOv');

  const statusBtns = JOB_STATUS.map((s, i) => `
    <button class="btn btn-xs ${j.status===i?'btn-red':'btn-ghost'}" data-jst="${i}">${s}</button>
  `).join('');

  const reqCards = reqs.length
    ? reqs.map(r => `
      <div class="card mb8" data-req-id="${r.id}">
        <div class="card-h" style="padding:9px 14px;display:flex;align-items:center;justify-content:space-between">
          <div style="flex:1">
            <span class="mono" style="font-size:.72rem;color:var(--teal)">${r.no}</span>
            <span style="font-size:.8rem;margin-left:8px">${dateStr(r.ts)}</span>
            ${hasPermission('canViewCost') ? `<span style="margin-left:auto;font-size:.8rem;color:var(--fg2)">
              ต้นทุน ${THB(r.items.reduce((s,it)=>s+it.qty*(it.cost||0),0))}
            </span>` : ''}
          </div>
          <div style="display:flex;gap:4px;margin-left:12px">
            <button class="btn-icon btn-edit-req" data-req-id="${r.id}" title="แก้ไขใบเบิก">
              ${svgI('<path d="M3 17.25V21h3.75L17.81 9.94m-6.75-6.75L21 7.75M11 5L9 3l-5.25 5.25"/>',14)}
            </button>
            <button class="btn-icon btn-del-req" data-req-id="${r.id}" title="ลบใบเบิก">
              ${svgI('<path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6l1.4 1.4L12 13.4l5.6 5.6 1.4-1.4-5.6-5.6L19 6.4z"/>',14)}
            </button>
          </div>
        </div>
        <div style="padding:0 14px 10px">
          <table class="tbl" style="font-size:.82rem">
            <tbody>
              ${r.items.map((it, idx) => `
                <tr data-item-idx="${idx}">
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

  const billItems = inv && Array.isArray(inv.items) ? inv.items : [];
  const billItemsList = billItems.length
    ? `<div class="mt8" style="border-top:1px dashed var(--p3);padding-top:8px">
        <div style="font-size:.76rem;color:var(--fg2);font-weight:700;margin-bottom:4px">
          รายการที่เบิก/ใช้ในงานนี้
        </div>
        <table class="tbl" style="font-size:.8rem"><tbody>
          ${billItems.map(it => `
            <tr>
              <td>${esc(it.name)}${it.sid ? ' <span style="font-size:.68rem;color:var(--teal)">(อะไหล่)</span>' : ''}</td>
              <td class="r" style="color:var(--fg2)">${numFmt(it.qty)}${it.unit ? ' '+esc(it.unit) : ''}</td>
              ${hasPermission('canViewCost') ? `<td class="r fc-gold">${THB((it.cost||0)*(it.qty||0))}</td>` : ''}
            </tr>`).join('')}
        </tbody></table>
      </div>`
    : '';

  const billSection = inv
    ? `<div style="font-size:.86rem">
        ออกใบเสร็จ <b style="color:var(--teal)">${inv.no}</b><br>
        ยอดรวม <b class="fc-gold">${THB(inv.grand)}</b><br>
        ${hasPermission('canViewCost') ? `ต้นทุน ${THB(totalCost)} ·` : ''}
        ${hasPermission('canViewProfit') ? `กำไร <span style="color:${inv.grand-totalCost>=0?'var(--grn)':'var(--bad)'}">
          ${THB(inv.grand - totalCost)}
        </span>` : ''}
      </div>
      ${billItemsList}
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

        <!-- Images -->
        <div class="card mt12">
          <div class="card-h" style="justify-content:space-between">
            <div class="flex gap8">
              ${svgI('<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 0 2 2h7"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>')}
              <h2>รูปภาพ</h2>
            </div>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer">
              ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่มรูป
              <input type="file" id="imgUpload" accept="image/*" multiple style="display:none">
            </label>
          </div>
          <div class="card-b">
            <div id="imgGrid" style="display:flex;flex-wrap:wrap;gap:8px">
              ${(j.images||[]).length
                ? (j.images||[]).map((url,idx) => `
                    <div style="position:relative">
                      <img src="${esc(url)}" style="width:100px;height:80px;object-fit:cover;
                           border-radius:7px;cursor:pointer" data-imgurl="${esc(url)}">
                      <button data-del-img="${idx}" title="ลบ"
                        style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);border:none;
                               color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;
                               font-size:.75rem;line-height:1;padding:0">×</button>
                    </div>`).join('')
                : '<span style="font-size:.82rem;color:var(--fg3)">ยังไม่มีรูปภาพ</span>'}
            </div>
            <div id="imgStatus" style="font-size:.78rem;color:var(--teal);margin-top:4px"></div>
          </div>
        </div>

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
        ${(hasPermission('canDeleteData') || hasPermission('canDeleteJob')) ? `
        <button class="btn btn-red btn-sm" id="delJobBtn">
          ${svgI('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',14)}
          ลบงาน
        </button>` : ''}
        <button class="btn btn-ghost btn-sm" id="printJobBtn"
          style="margin-left:auto">
          ${svgI('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>',14)}
          พิมพ์ใบงาน
        </button>
      </div>
    </div>`;

  openOv('mOv');

  /* Status buttons — with confirmation dialog */
  ov.querySelectorAll('[data-jst]').forEach(b => {
    b.addEventListener('click', async () => {
      const newStatus = parseInt(b.dataset.jst);
      if (newStatus === j.status) return;
      const ok = await showConfirm(
        'เปลี่ยนสถานะงาน',
        `เปลี่ยนจาก <b>${JOB_STATUS[j.status]}</b> → <b>${JOB_STATUS[newStatus]}</b> ?`,
        'ยืนยัน'
      );
      if (!ok) return;
      const oldStatus = j.status;
      j.status = newStatus;
      if (useSupabase && j.id && typeof updateJob === 'function') {
        updateJob(j.id, { status_id: j.status + 1 }).catch(e => console.warn('[Jobs] status sync failed:', e));
      }
      if (typeof addAuditLog === 'function') {
        addAuditLog('JOB_STATUS_CHANGE', 'job', j.id, j.no,
          { from: JOB_STATUS[oldStatus], to: JOB_STATUS[newStatus] });
      }
      await saveData();
      renderNav();
      renderPanel();
      openJobDetail(jid);
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

  /* Image upload */
  sel('imgUpload')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const st = sel('imgStatus');
    if (st) st.textContent = `กำลังอัปโหลด ${files.length} รูป…`;
    const urls = [];
    for (const f of files) {
      if (typeof uploadJobImage === 'function') {
        const url = await uploadJobImage(j.id, f);
        if (url) urls.push(url);
      }
    }
    if (urls.length) {
      j.images = [...(j.images || []), ...urls];
      if (useSupabase && j.id && typeof updateJob === 'function') {
        updateJob(j.id, { images: j.images }).catch(() => {});
      }
      await saveData();
      openJobDetail(jid);
      showToast(`เพิ่มรูป ${urls.length} รูปแล้ว`);
    } else {
      if (st) st.textContent = 'อัปโหลดไม่สำเร็จ';
    }
  });

  /* Image preview (click to enlarge) */
  ov.querySelectorAll('[data-imgurl]').forEach(img => {
    img.addEventListener('click', () => {
      const w = window.open(); w.document.write(`<img src="${img.dataset.imgurl}" style="max-width:100%">`);
    });
  });

  /* Delete image */
  ov.querySelectorAll('[data-del-img]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.delImg);
      j.images = (j.images || []).filter((_,i) => i !== idx);
      if (useSupabase && j.id && typeof updateJob === 'function') {
        updateJob(j.id, { images: j.images }).catch(() => {});
      }
      await saveData();
      openJobDetail(jid);
    });
  });

  /* Edit requisition */
  ov.querySelectorAll('.btn-edit-req').forEach(btn => {
    btn.addEventListener('click', () => {
      const reqId = btn.dataset.reqId;
      closeMod();
      setTimeout(() => openEditReqModal(jid, reqId), 80);
    });
  });

  /* Delete requisition */
  ov.querySelectorAll('.btn-del-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reqId = btn.dataset.reqId;
      const req = S.requisitions.find(r => r.id === reqId);
      if (!req) return;
      
      if (!confirm(`ต้องการลบใบเบิก ${req.no} และคืนสินค้ากลับสต๊อกหรือ?`)) return;
      
      /* Restore stock */
      (req.items || []).forEach(it => {
        if (!it.sid) return;
        const st = S.stockItems.find(x => x.id === it.sid);
        if (st) {
          st.qty = fmt(parseFloat(st.qty) + parseFloat(it.qty));
          st.used = fmt(Math.max(0, (st.used || 0) - it.qty));
        }
      });
      
      /* Remove requisition */
      S.requisitions = S.requisitions.filter(r => r.id !== reqId);
      j.requisitions = (j.requisitions || []).filter(rid => rid !== reqId);

      // Delete from Supabase
      if (useSupabase && typeof deleteRequisition === 'function') {
        const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (_uuidRe.test(reqId)) {
          deleteRequisition(reqId).catch(e => console.warn('[Req] Supabase delete failed:', e));
        }
      }

      await saveData();
      renderNav();
      openJobDetail(jid);
      showToast(`ลบใบเบิก ${req.no} แล้ว · คืนสินค้า ${req.items.length} รายการ`);
    });
  });

  bindModalClose(ov, '#mCl', '#mCl2');

  /* Delete job (admin + supervisor/หัวหน้าช่าง) */
  ov.querySelector('#delJobBtn')?.addEventListener('click', async () => {
    if (inv) {
      showToast('งานนี้ออกบิลแล้ว — กรุณาลบใบเสร็จก่อนจึงจะลบงานได้', 'err');
      return;
    }
    const ok = await showConfirm(
      'ลบงาน',
      `ต้องการลบงาน <b>${esc(j.no)}</b> (${esc(j.custName || '—')}) ?<br>
       ${reqs.length ? `ใบเบิก ${reqs.length} ใบจะถูกลบและคืนสินค้ากลับสต๊อก<br>` : ''}
       <span style="color:var(--bad)">การลบนี้ย้อนกลับไม่ได้</span>`,
      'ลบงาน'
    );
    if (!ok) return;

    /* คืนสต๊อกจากใบเบิกทุกใบ แล้วลบใบเบิก */
    const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const r of reqs) {
      (r.items || []).forEach(it => {
        if (!it.sid) return;
        const st = S.stockItems.find(x => x.id === it.sid);
        if (st) {
          st.qty  = fmt(parseFloat(st.qty) + parseFloat(it.qty));
          st.used = fmt(Math.max(0, (st.used || 0) - it.qty));
        }
      });
      if (useSupabase && typeof deleteRequisition === 'function' && _uuidRe.test(r.id)) {
        deleteRequisition(r.id).catch(e => console.warn('[Job] req delete failed:', e));
      }
    }
    S.requisitions = S.requisitions.filter(r => r.jobId !== jid);

    /* ลบงานออกจาก state */
    S.jobs = S.jobs.filter(x => x.id !== jid);

    /* ลบจาก Supabase */
    if (useSupabase && typeof deleteJob === 'function' && _uuidRe.test(j.id)) {
      deleteJob(j.id).catch(e => console.warn('[Job] Supabase delete failed:', e));
    }
    if (typeof addAuditLog === 'function') {
      addAuditLog('JOB_DELETE', 'job', j.id, j.no, { cust: j.custName || '' });
    }

    await saveData();
    closeMod();
    renderNav();
    renderPanel();
    showToast(`ลบงาน ${j.no} แล้ว`);
  });


  ov.querySelector('#printJobBtn')?.addEventListener('click', () => {
    const s = S.shop || {};
    let reqRows = reqs.flatMap(r => r.items.map(it =>
      `<tr><td>${esc(it.name)}</td><td class="c">${numFmt(it.qty)} ${esc(it.unit||'')}</td></tr>`
    )).join('');
    // ถ้าไม่มีใบเบิก ให้แสดงรายการจากบิลแทน (อะไหล่/บริการที่ใช้ในงาน)
    if (!reqRows && inv && Array.isArray(inv.items)) {
      reqRows = inv.items.map(it =>
        `<tr><td>${esc(it.name)}</td><td class="c">${numFmt(it.qty)} ${esc(it.unit||'')}</td></tr>`
      ).join('');
    }
    if (!reqRows) reqRows = '<tr><td colspan="2" style="color:#888;text-align:center">—</td></tr>';

    const dc = `
      <div class="doc" style="max-width:680px;margin:0 auto;font-family:sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-weight:900;font-size:1.2rem">${esc(s.name||'TBR Performance')}</div>
            <div style="font-size:.75rem;color:#555">${esc(s.addr||'')}${s.phone?' · โทร '+esc(s.phone):''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.05rem;font-weight:800">ใบงาน / Work Order</div>
            <div style="font-size:.78rem;color:#555">วันที่ ${dateStr(j.createdAt)}</div>
          </div>
        </div>
        <div style="border-top:2px solid #222;border-bottom:1px solid #ccc;padding:8px 0;
                    display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:.84rem">
          <div><b>เลขที่งาน:</b> ${j.no}</div>
          <div><b>ทะเบียน:</b> ${esc(j.plate||'—')}</div>
          <div><b>ลูกค้า:</b> ${esc(j.custName||'—')}</div>
          <div><b>รุ่นรถ:</b> ${esc(j.carModel||'—')}</div>
          <div><b>ช่าง:</b> ${esc(j.assignTo||'—')}</div>
          <div><b>เลขไมล์:</b> ${j.mileage ? numFmt(j.mileage)+' กม.' : '—'}</div>
          <div><b>สถานะ:</b> ${JOB_STATUS[j.status]||'—'}</div>
        </div>
        ${j.complaint ? `<div style="background:#f5f5f5;border-radius:6px;padding:8px 12px;
                                    font-size:.84rem;margin-bottom:10px">
          <b>แจ้งซ่อม:</b> ${esc(j.complaint)}</div>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:.83rem;margin-bottom:12px">
          <thead>
            <tr style="background:#222;color:#fff">
              <th style="padding:6px 10px;text-align:left">รายการเบิกสต๊อก</th>
              <th style="padding:6px 10px;text-align:center;width:80px">จำนวน</th>
            </tr>
          </thead>
          <tbody>${reqRows}</tbody>
        </table>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;
                    border-top:1px solid #ccc;padding-top:14px;margin-top:8px;font-size:.82rem">
          <div style="text-align:center">
            <div style="border-bottom:1px solid #555;height:36px"></div>
            <div style="color:#666;margin-top:4px">ช่างผู้รับผิดชอบ</div>
          </div>
          <div style="text-align:center">
            <div style="border-bottom:1px solid #555;height:36px"></div>
            <div style="color:#666;margin-top:4px">ผู้ตรวจสอบ</div>
          </div>
          <div style="text-align:center">
            <div style="border-bottom:1px solid #555;height:36px"></div>
            <div style="color:#666;margin-top:4px">ลูกค้ารับทราบ</div>
          </div>
        </div>
      </div>`;
    document.getElementById('pz').innerHTML = dc;
    window.print();
    setTimeout(() => { document.getElementById('pz').innerHTML = ''; }, 600);
  });
}
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
                   value="${it.qty}" data-rk="${it.k}"
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

    const no  = nextSeqNo('rq').replace('rq-', 'RQ-');

    /* Deduct stock */
    rItems.forEach(it => {
      if (!it.sid) return;
      const m = S.stockItems.find(x => x.id === it.sid);
      if (m) {
        m.qty  = fmt(m.qty  - it.qty);
        m.used = fmt((m.used || 0) + it.qty);
        // Sync stock qty to Supabase
        if (useSupabase && typeof updateStockBySku === 'function') {
          updateStockBySku(m.id, m.qty).catch(e => console.warn('[Req] stock sync failed:', e));
        }
        // Record in stock ledger
        if (typeof addToLedger === 'function') {
          addToLedger(m.id, 'out', it.qty, 'เบิก ' + no);
        }
      }
    });

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

    // Save to Supabase (รอผล — ยืนยันขึ้นคลาวด์จริง)
    let _reqCloudOk = false;
    if (useSupabase && typeof addRequisition === 'function') {
      try {
        const result = await addRequisition(jid, no, req.items, req.note);
        if (result?.id) { req.id = result.id; _reqCloudOk = true; }
      } catch (e) { console.warn('[Req] Supabase save failed:', e); }
    }

    await saveData();
    closeMod();
    renderNav();
    if (!useSupabase)     showToast(`เบิกสต๊อก ${no} แล้ว · ตัดของเรียบร้อย`);
    else if (_reqCloudOk) showToast(`เบิกสต๊อก ${no} แล้ว · ตัดของเรียบร้อย ☁️`);
    else                  showToast(`เบิกสต๊อก ${no} — ยังไม่ขึ้นคลาวด์ ระบบจะซิงค์อัตโนมัติ`, 'err');
    openJobDetail(jid);
  });

  /* Close → go back to job detail */
  ov.querySelector('#mCl').addEventListener('click',  () => { closeMod(); openJobDetail(jid); });
  ov.querySelector('#mCl2').addEventListener('click', () => { closeMod(); openJobDetail(jid); });
}

/* ══════════════════════════════════════
   EDIT REQUISITION MODAL
══════════════════════════════════════ */
function openEditReqModal(jid, reqId) {
  const j   = S.jobs.find(x => x.id === jid);
  const req = S.requisitions.find(r => r.id === reqId);
  if (!j || !req) return;

  const ov = sel('mOv');
  let editItems = JSON.parse(JSON.stringify(req.items)); /* clone items */

  const renderEditItems = () => {
    const box = sel('editReqBox');
    if (!editItems.length) {
      box.innerHTML = '<div class="bi-empty">ไม่มีรายการ</div>';
      return;
    }

    box.innerHTML = editItems.map((it, idx) => `
      <div style="display:grid;grid-template-columns:1fr 110px 70px 36px;gap:8px;
                  align-items:center;padding:7px 4px;border-bottom:1px dashed var(--ln)">
        <div>
          <div style="font-size:.86rem;font-weight:600">${esc(it.name)}</div>
          ${it.sid ? `<div style="font-size:.67rem;color:var(--fg2);font-family:'JetBrains Mono',monospace">${it.sid}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <input type="number" min="0" step="${it.unit==='ลิตร'?'0.5':'1'}"
                 value="${it.qty}" data-eidx="${idx}"
                 style="width:64px;background:var(--ink);border:1px solid var(--ln2);
                        color:var(--fg);border-radius:7px;padding:6px 7px;font-size:.84rem;
                        outline:none;text-align:right">
          <span style="font-size:.76rem;color:var(--fg2)">${it.unit}</span>
        </div>
        ${hasPermission('canViewCost') ? `<div style="font-size:.82rem;text-align:right;color:var(--fg2)">
          ${THB(it.cost * it.qty)}
        </div>` : ''}
        <button class="btn-icon" data-eirdel="${idx}">
          ${svgI('<path d="M18 6 6 18M6 6l12 12"/>',13)}
        </button>
      </div>`).join('');

    /* Bind quantity inputs */
    box.querySelectorAll('input[data-eidx]').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.eidx);
        if (editItems[idx]) editItems[idx].qty = parseFloat(inp.value) || 0;
        renderEditItems();
      });
    });

    /* Bind delete buttons */
    box.querySelectorAll('[data-eirdel]').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.eirdel);
        editItems.splice(idx, 1);
        renderEditItems();
      });
    });
  };

  ov.innerHTML = `
    <div class="modal">
      <div class="modal-h">
        <h3>แก้ไขใบเบิก — ${req.no}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div id="editReqBox"></div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="editReqCancel">ยกเลิก</button>
        <button class="btn btn-gold" id="editReqSave">บันทึกการแก้ไข</button>
      </div>
    </div>`;

  openOv('mOv');
  renderEditItems();

  /* Save changes */
  sel('editReqSave').addEventListener('click', async () => {
    if (!editItems.length) return showToast('ต้องมีรายการอย่างน้อย 1 รายการ', 'err');

    /* Calculate stock differences: restore old quantities first, then deduct new quantities.
       Using restore-all + re-deduct approach (safe when items are deleted/reordered) */
    // 1. Restore all OLD stock
    (req.items || []).forEach(it => {
      if (!it.sid) return;
      const st = S.stockItems.find(x => x.id === it.sid);
      if (st) {
        st.qty  = fmt(parseFloat(st.qty)  + parseFloat(it.qty));
        st.used = fmt(Math.max(0, (st.used || 0) - parseFloat(it.qty)));
      }
    });
    // 2. Deduct NEW stock
    editItems.forEach(it => {
      if (!it.sid) return;
      const st = S.stockItems.find(x => x.id === it.sid);
      if (st) {
        st.qty  = fmt(parseFloat(st.qty)  - parseFloat(it.qty));
        st.used = fmt((st.used || 0) + parseFloat(it.qty));
        if (useSupabase && typeof updateStockBySku === 'function')
          updateStockBySku(st.id, st.qty).catch(() => {});
      }
    });

    /* Update requisition */
    req.items = editItems;

    // Update in Supabase
    if (useSupabase && typeof updateRequisition === 'function') {
      const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (_uuidRe.test(req.id)) {
        updateRequisition(req.id, { items: req.items }).catch(e => console.warn('[Req] Supabase update failed:', e));
      }
    }

    await saveData();
    closeMod();
    renderNav();
    openJobDetail(jid);
    showToast(`อัปเดตใบเบิก ${req.no} แล้ว`);
  });

  sel('editReqCancel').addEventListener('click', () => {
    closeMod();
    openJobDetail(jid);
  });

  bindModalClose(ov, '#mCl');
}
