/* ============================================================
   CUSTOMERS.JS — ลูกค้า, รถ, ประวัติการซ่อม
   ============================================================ */

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function customersHTML() {
  const custs = S.customers;

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
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">ลูกค้า &amp; รถ</h1>
        <div style="font-size:.82rem;color:var(--fg2);margin-top:2px">
          ${custs.length} ลูกค้า · ${S.vehicles.length} คัน
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
    </div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindCustomers() {
  sel('addCustBtn')?.addEventListener('click', () => openCustModal(null));
  sel('addVehBtn')?.addEventListener('click',  () => openVehModal(null, null));

  document.querySelectorAll('[data-ec]').forEach(b =>
    b.addEventListener('click', e => { e.stopPropagation(); openCustModal(b.dataset.ec); })
  );
  document.querySelectorAll('[data-eveh]').forEach(r =>
    r.addEventListener('click', () => openVehDetail(r.dataset.eveh))
  );
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
        ${m ? `<button class="btn btn-ghost" id="delCust" style="color:var(--bad);border-color:rgba(239,83,80,.3)">ลบลูกค้า</button>` : ''}
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
      if (m) {
        // Update existing
        if (useSupabase && typeof updateCustomer === 'function') {
          await updateCustomer(m.id, data);
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
        ${v ? `<button class="btn btn-ghost" id="delVeh" style="color:var(--bad);border-color:rgba(239,83,80,.3)">ลบรถ</button>` : ''}
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
      if (v) {
        // Update existing
        if (useSupabase && typeof updateVehicle === 'function') {
          await updateVehicle(v.id, { ...data, customer_id: custId });
        }
        Object.assign(v, data);
      } else {
        // Add new
        const newVeh = { id: 'V-' + Date.now(), createdAt: Date.now(), ...data };
        if (useSupabase && typeof addVehicle === 'function') {
          const result = await addVehicle(custId, data.plate, data.brand, data.model, data.year, data.color, data.mileage, '', data.vin, '');
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
  const vJobs = S.jobs.filter(j => j.vehicleId === vid).slice().reverse();
  const ov    = sel('mOv');

  const histRows = vJobs.length
    ? vJobs.map(j => {
        const inv = S.invoices.find(i => i.jobId === j.id);
        return `
          <tr>
            <td class="mono" style="font-size:.75rem;color:var(--teal)">${j.no}</td>
            <td style="font-size:.8rem">${dateStr(j.createdAt)}</td>
            <td style="font-size:.84rem">${esc((j.complaint || '—').slice(0, 30))}</td>
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
        <div class="g2 mb16">
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
              <thead><tr><th>เลขที่</th><th>วันที่เข้า</th><th>แจ้งซ่อม</th><th>ไมล์</th><th>สถานะ</th><th class="r">ยอด</th></tr></thead>
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
