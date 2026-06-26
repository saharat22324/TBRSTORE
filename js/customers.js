/* ============================================================
   CUSTOMERS.JS — ลูกค้า, รถ, ประวัติการซ่อม
   ============================================================ */

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function customersHTML() {
  const custs = S.customers;
  const vehs  = S.vehicles;
  
  /* ── Stats ── */
  const totalJobs = S.jobs.filter(j => j.custId).length;
  const activeJobs = S.jobs.filter(j => j.custId && j.status < 5).length;
  const totalMileage = vehs.reduce((s, v) => s + (v.mileage || 0), 0);

  /* ── Service Reminders (vehicles with no job in last 90 days) ── */
  const now90 = Date.now() - 90 * 86400000;
  const remindRows = vehs.map(v => {
    const c = S.customers.find(x => x.id === v.custId);
    const lastJob = S.jobs
      .filter(j => j.vehicleId === v.id)
      .sort((a,b) => (b.createdAt||0) - (a.createdAt||0))[0];
    const lastTs = lastJob?.createdAt || v.createdAt || 0;
    if (lastTs > now90) return null; // serviced recently
    const daysAgo = Math.floor((Date.now() - lastTs) / 86400000);
    return `
      <tr>
        <td style="font-weight:700;color:var(--teal);font-family:'JetBrains Mono',monospace">${esc(v.plate)}</td>
        <td style="font-size:.84rem">${esc(c?.name || '—')}</td>
        <td style="font-size:.8rem;color:var(--fg2)">${lastJob ? dateStr(lastJob.createdAt) : '—'}</td>
        <td><span class="badge b-warn">${daysAgo} วันที่แล้ว</span></td>
      </tr>`;
  }).filter(Boolean);

  const custRows = custs.length
    ? custs.map(c => {
        const vCnt = S.vehicles.filter(v => v.custId === c.id).length;
        const jCnt = S.jobs.filter(j => j.custId === c.id).length;
        return `
          <tr>
            <td style="font-weight:600">${esc(c.name)}</td>
            <td style="font-size:.82rem;color:var(--fg2)">${esc(c.phone || '—')}</td>
            <td class="c"><span class="badge b-teal">${vCnt} คัน</span></td>
            <td class="c"><span class="badge b-gold">${jCnt} งาน</span></td>
            <td class="c">
              <div class="flex gap6" style="justify-content:center">
                <button class="btn-icon" data-hist="${c.id}" title="ประวัติบริการ">
                  ${svgI('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>',14)}
                </button>
                <button class="btn-icon" data-vc="${c.id}" title="ดูรถของลูกค้า">
                  ${svgI('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>',14)}
                </button>
                <button class="btn-icon" data-ec="${c.id}" title="แก้ไขลูกค้า">
                  ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',14)}
                </button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="5" class="tbl-empty">ยังไม่มีลูกค้า — กด "เพิ่มลูกค้า"</td></tr>`;

  const vehRows = S.vehicles.length
    ? S.vehicles.map(v => {
        const c    = S.customers.find(x => x.id === v.custId);
        const jCnt = S.jobs.filter(j => j.vehicleId === v.id).length;
        return `
          <tr data-eveh="${v.id}">
            <td style="font-weight:700;color:var(--teal);font-family:'JetBrains Mono',monospace">
              ${esc(v.plate)}
            </td>
            <td style="font-size:.84rem">${esc([v.brand, v.model, v.year].filter(Boolean).join(' '))}</td>
            <td style="font-size:.82rem;color:var(--fg2)">${esc(c?.name || '—')}</td>
            <td style="font-size:.8rem;color:var(--fg2)">
              ${v.mileage ? numFmt(v.mileage) + ' กม.' : '—'}
            </td>
            <td class="c"><span class="badge b-gold">${jCnt}</span></td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="5" class="tbl-empty">ยังไม่มีรถ</td></tr>`;

  return `
    <!-- ── Header ── -->
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">ลูกค้า &amp; รถ</h1>
        <div style="font-size:.82rem;color:var(--fg2);margin-top:2px">
          ${custs.length} ลูกค้า · ${vehs.length} คัน
        </div>
      </div>
      <div class="flex gap8">
        <button class="btn btn-teal btn-sm" id="addVehBtn">
          ${svgI('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>')}
          เพิ่มรถ
        </button>
        <button class="btn btn-gold btn-sm" id="addCustBtn">
          ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่มลูกค้า
        </button>
      </div>
    </div>

    <!-- ── Stats cards ── -->
    <div class="g4 mb16">
      <div class="stat red" style="min-height:92px">
        <div class="sk">${svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')} ลูกค้าทั้งหมด</div>
        <div class="sv" style="font-size:1.45rem">${custs.length}</div>
        <div class="sd">${vehs.length} คัน ที่บันทึก</div>
      </div>
      <div class="stat gold" style="min-height:92px">
        <div class="sk">${svgI('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>')} งานทั้งหมด</div>
        <div class="sv" style="font-size:1.45rem">${totalJobs}</div>
        <div class="sd">${activeJobs} งานที่เปิดอยู่</div>
      </div>
      <div class="stat teal" style="min-height:92px">
        <div class="sk">${svgI('<path d="M12 3c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 22c-5.523 0-10-4.477-10-10s4.477-10 10-10 10 4.477 10 10-4.477 10-10 10zm3.5-11c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm-7 0c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5zm3.5 6.5c2.33 0 4.31-1.46 5.16-3.5h-10.32c.85 2.04 2.83 3.5 5.16 3.5z"/>')} ไมล์รวม</div>
        <div class="sv" style="font-size:1.45rem">${numFmt(Math.round(totalMileage))}</div>
        <div class="sd">ข้อมูลจากรถทั้งหมด</div>
      </div>
      <div class="stat warn" style="min-height:92px">
        <div class="sk">${svgI('<path d="M12 9v2m0 4v2m-8.39-6.11l1.414 1.414M17.97 2.03l1.414 1.414M2.03 17.97l1.414 1.414M17.97 17.97l1.414 1.414m-13.64-8.84l-1.414 1.414M19.97 2.03l-1.414 1.414M2.03 2.03l-1.414 1.414M19.97 19.97l-1.414 1.414"/>')} โดยเฉลี่ยต่อรถ</div>
        <div class="sv" style="font-size:1.45rem">${vehs.length > 0 ? numFmt(Math.round(totalMileage / vehs.length)) : '—'}</div>
        <div class="sd">${vehs.length || 0} คันบันทึกไมล์</div>
      </div>
    </div>

    <!-- ── Data tables ── -->
    <div class="g2">
      <!-- Customer list -->
      <div class="card">
        <div class="card-h">
          ${svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}
          <h2>รายชื่อลูกค้า</h2>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>ชื่อลูกค้า</th><th>เบอร์โทร</th><th>จำนวนรถ</th><th>งานทั้งหมด</th><th></th></tr></thead>
            <tbody>${custRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Vehicle list -->
      <div class="card">
        <div class="card-h">
          ${svgI('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>',16)}
          <h2>ทะเบียนรถ</h2>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>ทะเบียน</th><th>รถ</th><th>เจ้าของ</th><th>ไมล์ล่าสุด</th><th>งาน</th></tr></thead>
            <tbody>${vehRows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Service Reminders ── -->
    ${remindRows.length ? `
    <div class="card" style="margin-top:16px;border-left:3px solid var(--warn)">
      <div class="card-h">
        ${svgI('<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/>',16)}
        <h2>แจ้งเตือนบริการที่ครบกำหนด (${remindRows.length} คัน)</h2>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th>ทะเบียน</th><th>เจ้าของ</th><th>ซ่อมครั้งล่าสุด</th><th>ครบกำหนดใน</th></tr></thead>
          <tbody>${remindRows.join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
    `;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindCustomers() {
  sel('addCustBtn')?.addEventListener('click', () => openCustModal(null));
  sel('addVehBtn')?.addEventListener('click',  () => openVehModal(null, null));

  document.querySelectorAll('[data-hist]').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); openCustHistory(b.dataset.hist); })
  );
  document.querySelectorAll('[data-ec]').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); openCustModal(b.dataset.ec); })
  );
  document.querySelectorAll('[data-eveh]').forEach(r =>
    r.addEventListener('click', () => openVehDetail(r.dataset.eveh))
  );
  document.querySelectorAll('[data-vc]').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); openCustDetail(b.dataset.vc); })
  );
}

/* ══════════════════════════════════════
   CUSTOMER HISTORY MODAL
══════════════════════════════════════ */
function openCustHistory(cid) {
  const c = S.customers.find(x => x.id === cid);
  if (!c) return;

  const cVehs = S.vehicles.filter(v => v.custId === cid);
  const vIds  = cVehs.map(v => v.id);

  const cInvs = S.invoices.filter(i => {
    if ((i.cust || '').trim() === (c.name || '').trim()) return true;
    return S.jobs.some(j => i.jobId === j.id && vIds.includes(j.vehicleId));
  }).slice().reverse();

  const totalSpent = cInvs.reduce((s, i) => s + i.grand, 0);
  const pendingAmt = cInvs.filter(i => !i.paid).reduce((s, i) => s + i.grand, 0);

  const invRows = cInvs.length
    ? cInvs.map(i => `
        <tr>
          <td class="mono" style="font-size:.75rem;color:var(--teal);cursor:pointer"
              data-vi="${i.no}">${i.no}</td>
          <td style="font-size:.8rem">${dateStr(i.ts)}</td>
          <td style="font-size:.8rem">${esc(i.plate || '—')}</td>
          <td class="r money fc-gold">${THB(i.grand)}</td>
          <td class="c">
            <span class="badge ${i.paid ? 'b-grn' : 'b-bad'}" style="font-size:.65rem">
              ${i.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}
            </span>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="tbl-empty">ยังไม่มีบิล</td></tr>`;

  const ov = sel('mOv');
  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <div>
          <h3>${esc(c.name)}</h3>
          <div style="font-size:.76rem;color:var(--fg2);margin-top:2px">
            ${esc(c.phone || '')}${c.line ? ' · LINE: '+esc(c.line) : ''}
          </div>
        </div>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="g4 mb14">
          <div class="stat gold" style="min-height:72px">
            <div class="sk">ยอดรวมที่ใช้</div>
            <div class="sv">${THB(totalSpent)}</div>
          </div>
          <div class="stat teal" style="min-height:72px">
            <div class="sk">จำนวนบิล</div>
            <div class="sv">${cInvs.length}</div>
          </div>
          <div class="stat red" style="min-height:72px">
            <div class="sk">จำนวนรถ</div>
            <div class="sv">${cVehs.length} คัน</div>
          </div>
          <div class="stat ${pendingAmt > 0 ? 'bad' : 'grn'}" style="min-height:72px">
            <div class="sk">ค้างชำระ</div>
            <div class="sv">${THB(pendingAmt)}</div>
          </div>
        </div>

        ${cVehs.length ? `
        <div class="card mb14">
          <div class="card-h">${svgI('<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/><circle cx="7" cy="14" r="1"/><circle cx="17" cy="14" r="1"/>')} <h2>รถ</h2></div>
          <div class="card-b">
            ${cVehs.map(v => `<span class="badge b-teal" style="margin:2px;font-size:.78rem">
              ${esc(v.plate)} ${esc([v.brand,v.model].filter(Boolean).join(' '))}
            </span>`).join('')}
          </div>
        </div>` : ''}

        <div class="card">
          <div class="card-h">${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>')} <h2>ประวัติบิล</h2></div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>เลขที่</th><th>วันที่</th><th>ทะเบียน</th><th class="r">ยอด</th><th class="c">สถานะ</th></tr></thead>
              <tbody>${invRows}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ปิด</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelectorAll('[data-vi]').forEach(el =>
    el.addEventListener('click', () => {
      const i = S.invoices.find(x => x.no === el.dataset.vi);
      if (i) { closeMod(); showDoc('inv', i); }
    })
  );

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   CUSTOMER VEHICLES QUICK VIEW
══════════════════════════════════════ */
function openCustDetail(cid) {
  const c = S.customers.find(x => x.id === cid);
  if (!c) return;
  const cVehs = S.vehicles.filter(v => v.custId === cid);
  if (cVehs.length === 1) { openVehDetail(cVehs[0].id); return; }
  if (cVehs.length === 0) { openVehModal(null, cid); return; }

  const ov = sel('mOv');
  ov.innerHTML = `
    <div class="modal sm">
      <div class="modal-h">
        <h3>รถของ ${esc(c.name)}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        ${cVehs.map(v => `
          <div class="fjb" style="padding:10px 0;border-bottom:1px solid var(--ln);cursor:pointer"
               data-eveh2="${v.id}">
            <div>
              <div style="font-weight:700;color:var(--teal)">${esc(v.plate)}</div>
              <div style="font-size:.78rem;color:var(--fg2)">${esc([v.brand,v.model,v.year].filter(Boolean).join(' '))}</div>
            </div>
            <span style="font-size:.75rem;color:var(--fg2)">${S.jobs.filter(j=>j.vehicleId===v.id).length} งาน</span>
          </div>`).join('')}
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ปิด</button>
        <button class="btn btn-teal" id="addVehHere">เพิ่มรถ</button>
      </div>
    </div>`;
  openOv('mOv');
  ov.querySelectorAll('[data-eveh2]').forEach(r =>
    r.addEventListener('click', () => { closeMod(); openVehDetail(r.dataset.eveh2); })
  );
  ov.querySelector('#addVehHere')?.addEventListener('click', () => { closeMod(); openVehModal(null, cid); });
  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   MODALS
══════════════════════════════════════ */
function openCustModal(id) {
  const m  = id ? S.customers.find(c => c.id === id) : null;
  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal md">
      <div class="modal-h">
        <h3>${m ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fgrid c2 mb12">
          <div class="fld"><label>ชื่อ-นามสกุล *</label><input id="cName" value="${esc(m?.name||'')}" placeholder="ชื่อลูกค้า"></div>
          <div class="fld"><label>เบอร์โทร</label><input id="cPhone" value="${esc(m?.phone||'')}" placeholder="08X-XXXXXXX"></div>
        </div>
        <div class="fgrid c2 mb12">
          <div class="fld"><label>LINE ID</label><input id="cLine" value="${esc(m?.line||'')}"></div>
          <div class="fld"><label>อีเมล</label><input id="cEmail" value="${esc(m?.email||'')}" type="email"></div>
        </div>
        <div class="fld"><label>หมายเหตุ</label><textarea id="cNote" rows="2">${esc(m?.note||'')}</textarea></div>
      </div>
      <div class="modal-f">
        ${m && hasPermission('canDeleteData') ? `<button class="btn btn-ghost" id="delCust" style="color:var(--bad);border-color:rgba(239,83,80,.3)">ลบลูกค้า</button>` : ''}
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold"  id="mOk">${svgI('<path d="M20 6 9 17l-5-5"/>')} ${m ? 'บันทึก' : 'เพิ่มลูกค้า'}</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const name = sv('cName').trim();
    if (!name) return showToast('กรุณากรอกชื่อลูกค้า', 'err');

    const data = {
      name, phone: sv('cPhone'), line: sv('cLine'),
      email: sv('cEmail'), note: sv('cNote'),
    };

    try {
      const isUUID = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (m) {
        // Update existing
        if (useSupabase) {
          if (isUUID(m.id)) {
            // Real Supabase ID → update (map JS field names to DB column names)
            await updateCustomer(m.id, {
              name:    data.name,
              phone:   data.phone,
              email:   data.email,
              line_id: data.line,   // local state uses 'line', DB uses 'line_id'
              note:    data.note,
            });
          } else {
            // Local ID → create in Supabase and replace local ID
            const result = await addCustomer(data.name, data.phone, data.email, data.line, '', data.note);
            if (result) m.id = result.id;
          }
        }
        Object.assign(m, data);
      } else {
        // Add new
        const newCust = { id: 'C-' + Date.now(), createdAt: Date.now(), ...data };
        if (useSupabase && typeof addCustomer === 'function') {
          const result = await addCustomer(data.name, data.phone, data.email, data.line, '', data.note);
          if (result) newCust.id = result.id;
        }
        S.customers.push(newCust);
      }
      await saveData();
      closeMod();
      renderPanel();
      renderNav();
      showToast(m ? 'อัปเดตลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว');
    } catch (err) {
      console.error('Save customer error:', err);
      showToast('บันทึกลูกค้าไม่สำเร็จ', 'err');
    }
  });

  ov.querySelector('#delCust')?.addEventListener('click', async () => {
    if (!confirm('ลบลูกค้านี้?')) return;
    try {
      if (useSupabase && typeof deleteCustomer === 'function') {
        await deleteCustomer(id);
      }
      S.customers = S.customers.filter(c => c.id !== id);
      await saveData();
      closeMod();
      renderPanel();
      renderNav();
      showToast('ลบลูกค้าแล้ว');
    } catch (err) {
      console.error('Delete customer error:', err);
      showToast('ลบลูกค้าไม่สำเร็จ', 'err');
    }
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ── Vehicle modal ── */
function openVehModal(vid, prefCustId) {
  const v   = vid ? S.vehicles.find(x => x.id === vid) : null;
  const ov  = sel('mOv');
  const sel2 = (val) => (v?.custId || prefCustId) === val ? ' selected' : '';

  const custOpts = S.customers.map(c =>
    `<option value="${c.id}"${sel2(c.id)}>${esc(c.name)}</option>`
  ).join('');

  ov.innerHTML = `
    <div class="modal md">
      <div class="modal-h">
        <h3>${v ? 'แก้ไขรถ' : 'เพิ่มรถใหม่'}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fgrid c2 mb12">
          <div class="fld"><label>เจ้าของรถ *</label>
            <select id="vCust"><option value="">— เลือกลูกค้า —</option>${custOpts}</select>
          </div>
          <div class="fld"><label>ทะเบียนรถ *</label>
            <input id="vPlate" value="${esc(v?.plate||'')}" placeholder="กข 1234 กทม.">
          </div>
        </div>
        <div class="fgrid c3 mb12">
          <div class="fld"><label>ยี่ห้อ</label><input id="vBrand" value="${esc(v?.brand||'')}" placeholder="BMW / Mercedes"></div>
          <div class="fld"><label>รุ่น</label><input id="vModel" value="${esc(v?.model||'')}" placeholder="X3 / S300"></div>
          <div class="fld"><label>ปี</label><input id="vYear" value="${esc(v?.year||'')}" placeholder="2022" inputmode="numeric"></div>
        </div>
        <div class="fgrid c2 mb12">
          <div class="fld"><label>สี</label><input id="vColor" value="${esc(v?.color||'')}"></div>
          <div class="fld"><label>เลขไมล์ล่าสุด (กม.)</label>
            <input id="vMile" type="number" value="${v?.mileage||''}" placeholder="85000">
          </div>
        </div>
        <div class="fld"><label>เลขตัวถัง / VIN</label><input id="vVin" value="${esc(v?.vin||'')}"></div>
      </div>
      <div class="modal-f">
        ${v && hasPermission('canDeleteData') ? `<button class="btn btn-ghost" id="delVeh" style="color:var(--bad);border-color:rgba(239,83,80,.3)">ลบรถ</button>` : ''}
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold" id="mOk">${svgI('<path d="M20 6 9 17l-5-5"/>')} ${v ? 'บันทึก' : 'เพิ่มรถ'}</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const custId = sv('vCust');
    const plate  = sv('vPlate').trim();
    if (!custId) return showToast('กรุณาเลือกเจ้าของรถ', 'err');
    if (!plate)  return showToast('กรุณากรอกทะเบียน', 'err');

    const data = {
      custId, plate,
      brand:   sv('vBrand'),
      model:   sv('vModel'),
      year:    sv('vYear'),
      color:   sv('vColor'),
      mileage: parseInt(sv('vMile')) || 0,
      vin:     sv('vVin'),
    };

    try {
      const isUUID = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const safeCustId = isUUID(custId) ? custId : null;
      if (v) {
        // Update existing
        if (useSupabase) {
          if (isUUID(v.id)) {
            // Real Supabase ID → update (map JS field names to DB column names)
            const vUpdates = {
              plate:   data.plate,
              brand:   data.brand,
              model:   data.model,
              year:    data.year,
              color:   data.color,
              mileage: data.mileage,
            };
            if (safeCustId)  vUpdates.customer_id    = safeCustId;
            if (data.vin)    vUpdates.chassis_number = data.vin;
            await updateVehicle(v.id, vUpdates);
          } else {
            // Local ID → create in Supabase and replace local ID
            const result = await addVehicle(safeCustId, data.plate, data.brand, data.model, data.year, data.color, data.mileage, '', data.vin, '');
            if (result) v.id = result.id;
          }
        }
        Object.assign(v, data);
      } else {
        // Add new
        const newVeh = { id: 'V-' + Date.now(), createdAt: Date.now(), custId, ...data };
        if (useSupabase && typeof addVehicle === 'function') {
          const result = await addVehicle(safeCustId, data.plate, data.brand, data.model, data.year, data.color, data.mileage, '', data.vin, '');
          if (result) newVeh.id = result.id;
        }
        S.vehicles.push(newVeh);
      }
      await saveData();
      closeMod();
      renderPanel();
      renderNav();
      showToast(v ? 'อัปเดตรถแล้ว' : 'เพิ่มรถแล้ว');
    } catch (err) {
      console.error('Save vehicle error:', err);
      showToast('บันทึกรถไม่สำเร็จ', 'err');
    }
  });

  ov.querySelector('#delVeh')?.addEventListener('click', async () => {
    if (!confirm('ลบรถนี้?')) return;
    try {
      if (useSupabase && typeof deleteVehicle === 'function') {
        await deleteVehicle(vid);
      }
      S.vehicles = S.vehicles.filter(x => x.id !== vid);
      await saveData();
      closeMod();
      renderPanel();
      showToast('ลบรถแล้ว');
    } catch (err) {
      console.error('Delete vehicle error:', err);
      showToast('ลบรถไม่สำเร็จ', 'err');
    }
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ── Vehicle detail / history ── */
function openVehDetail(vid) {
  const v = S.vehicles.find(x => x.id === vid);
  if (!v) return;

  const c     = S.customers.find(x => x.id === v.custId);
  const vJobs = S.jobs.filter(j => j.vehicleId === vid).slice().sort((a,b) => (b.createdAt||0)-(a.createdAt||0));
  const ov    = sel('mOv');

  /* Stats */
  const vInvs     = vJobs.map(j => S.invoices.find(i => i.jobId === j.id || (j.no && i.ref === j.no))).filter(Boolean);
  const totalSpent= vInvs.reduce((s, i) => s + i.grand, 0);
  const lastJob   = vJobs[0];
  const daysSince = lastJob ? Math.floor((Date.now() - lastJob.createdAt) / 86400000) : null;

  /* Mileage intervals */
  const mileSorted = vJobs.filter(j => j.mileage).sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
  let avgMileInterval = null;
  if (mileSorted.length >= 2) {
    const intervals = [];
    for (let i = 1; i < mileSorted.length; i++) {
      const diff = mileSorted[i].mileage - mileSorted[i-1].mileage;
      if (diff > 0) intervals.push(diff);
    }
    if (intervals.length) avgMileInterval = Math.round(intervals.reduce((s,n)=>s+n,0) / intervals.length);
  }
  const nextMileSuggested = (v.mileage && avgMileInterval) ? v.mileage + avgMileInterval : null;

  const histRows = vJobs.length
    ? vJobs.map(j => {
        const inv = S.invoices.find(i => i.jobId === j.id || (j.no && i.ref === j.no));
        const itemSummary = inv ? (inv.items||[]).slice(0,3).map(it => esc(it.name)).join(', ') : '';
        return `
          <tr>
            <td class="mono" style="font-size:.75rem;color:var(--teal)">${j.no}</td>
            <td style="font-size:.8rem">${dateStr(j.createdAt)}</td>
            <td style="font-size:.84rem">
              <div>${esc((j.complaint || '—').slice(0, 30))}</div>
              ${itemSummary ? `<div style="font-size:.72rem;color:var(--fg2)">${itemSummary}${(inv?.items||[]).length>3?'...':''}</div>` : ''}
            </td>
            <td style="font-size:.78rem;color:var(--fg2)">${j.mileage ? numFmt(j.mileage)+' กม.' : '—'}</td>
            <td><span class="badge b-${JOB_COLOR[j.status]}">${JOB_STATUS[j.status]}</span></td>
            <td class="r money fc-gold">${inv ? THB(inv.grand) : '—'}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="6" class="tbl-empty">ยังไม่มีประวัติการซ่อม</td></tr>`;

  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <div>
          <h3>${esc(v.plate)} — ${esc([v.brand, v.model].filter(Boolean).join(' ') || 'รถ')}</h3>
          <div style="font-size:.76rem;color:var(--fg2);margin-top:2px">${esc(c?.name || '')}</div>
        </div>
        <div class="flex gap8">
          <button class="btn btn-ghost btn-sm" id="editVehBtn">แก้ไขรถ</button>
          <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
        </div>
      </div>
      <div class="modal-b">
        <!-- Stats row -->
        <div class="g4 mb14">
          <div class="stat teal" style="min-height:76px">
            <div class="sk">บริการทั้งหมด</div>
            <div class="sv">${vJobs.length}<small style="font-size:.8rem;font-weight:500;color:var(--fg2)"> งาน</small></div>
          </div>
          <div class="stat gold" style="min-height:76px">
            <div class="sk">ยอดรวมทั้งหมด</div>
            <div class="sv" style="font-size:1.1rem">${THB(totalSpent)}</div>
          </div>
          <div class="stat ${daysSince !== null && daysSince > 90 ? 'bad' : 'grn'}" style="min-height:76px">
            <div class="sk">ซ่อมครั้งล่าสุด</div>
            <div class="sv">${daysSince !== null ? daysSince+'<small style="font-size:.75rem;font-weight:500"> วันที่แล้ว</small>' : '—'}</div>
          </div>
          <div class="stat warn" style="min-height:76px">
            <div class="sk">นัดครั้งต่อไป ~</div>
            <div class="sv" style="font-size:.95rem">${nextMileSuggested ? numFmt(nextMileSuggested)+' <small style="font-size:.7rem">กม.</small>' : '—'}</div>
            ${avgMileInterval ? `<div class="sd">ทุก ~${numFmt(avgMileInterval)} กม.</div>` : ''}
          </div>
        </div>

        <div class="g2 mb14">
          <div class="card"><div class="card-b">
            <div style="font-size:.72rem;color:var(--fg2);font-family:'JetBrains Mono',monospace;margin-bottom:4px">ข้อมูลรถ</div>
            <div style="font-size:.9rem;line-height:1.8">
              ทะเบียน: <b>${esc(v.plate)}</b><br>
              รุ่น: <b>${esc([v.brand, v.model, v.year].filter(Boolean).join(' ') || '—')}</b><br>
              สี: ${esc(v.color || '—')}<br>
              VIN: ${esc(v.vin || '—')}<br>
              เลขไมล์ล่าสุด: <b>${v.mileage ? numFmt(v.mileage)+' กม.' : '—'}</b>
            </div>
          </div></div>
          <div class="card"><div class="card-b">
            <div style="font-size:.72rem;color:var(--fg2);font-family:'JetBrains Mono',monospace;margin-bottom:4px">เจ้าของ</div>
            <div style="font-size:.9rem;line-height:1.8">
              ชื่อ: <b>${esc(c?.name || '—')}</b><br>
              โทร: ${esc(c?.phone || '—')}<br>
              LINE: ${esc(c?.line || '—')}
            </div>
          </div></div>
        </div>

        <div class="card">
          <div class="card-h">
            ${svgI('<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>')}
            <h2>ประวัติการซ่อม (${vJobs.length} งาน)</h2>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>เลขที่</th><th>วันที่เข้า</th><th>แจ้งซ่อม / รายการ</th><th>ไมล์</th><th>สถานะ</th><th class="r">ยอด</th></tr></thead>
              <tbody>${histRows}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost"  id="mCl2">ปิด</button>
        <button class="btn btn-teal"   id="newJobBtn">+ เปิดงานใหม่</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#editVehBtn').addEventListener('click', () => {
    closeMod();
    setTimeout(() => openVehModal(vid, null), 80);
  });

  ov.querySelector('#newJobBtn').addEventListener('click', () => {
    closeMod();
    setTimeout(() => openJobModal(null, vid), 80);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}
