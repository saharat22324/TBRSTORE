/* ============================================================
   REPORT.JS — รายงาน & บัญชี
   ────────────────────────────────────────────
   - ยอดขาย / กำไรขั้นต้น / กำไรสุทธิ
   - กราฟ 6 เดือน
   - ค่าใช้จ่ายร้าน (เพิ่ม/ลบได้)
   - ตารางบิลพร้อมปุ่มลบ (คืนสต๊อก)
   ============================================================ */

let reportMonth = nowYM(); // yyyy-MM ที่แสดงอยู่

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function reportHTML() {

  /* ── Filter invoices by month ── */
  const mInvs = S.invoices.filter(i => {
    const d = new Date(i.ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === reportMonth;
  });

  const mRev    = mInvs.reduce((s, i) => s + i.grand, 0);
  const mCost   = mInvs.reduce((s, i) => s + (i.totalCost || 0), 0);
  const mGross  = fmt(mRev - mCost);

  const mExp    = S.expenses
    .filter(e => (e.date || '').startsWith(reportMonth))
    .reduce((s, e) => s + (+e.amount || 0), 0);

  const mNet    = fmt(mGross - mExp);

  /* ── Today revenue ── */
  const today   = new Date().toDateString();
  const todayRev= S.invoices
    .filter(i => new Date(i.ts).toDateString() === today)
    .reduce((s, i) => s + i.grand, 0);

  const stockVal= S.stockItems.reduce((s, i) => s + i.qty * i.cost, 0);

  /* ── 6-month chart ── */
  const months  = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const mSales  = months.map(m =>
    S.invoices
      .filter(i => {
        const d = new Date(i.ts);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === m;
      })
      .reduce((s, i) => s + i.grand, 0)
  );
  const maxS    = Math.max(...mSales, 1);

  const chartBars = months.map((m, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:3px">
      <div style="background:${m===reportMonth?'var(--gold)':'var(--red)'};
                  border-radius:4px 4px 0 0;width:100%;
                  height:${Math.round((mSales[i]/maxS)*100)||4}px;min-height:4px"></div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.55rem;
                  color:var(--fg2);text-align:center">
        ${THB(mSales[i])}
      </div>
      <div style="font-size:.6rem;color:var(--fg2)">${m.slice(5)}</div>
    </div>`).join('');

  /* ── Expense rows ── */
  const expItems  = S.expenses.filter(e => (e.date||'').startsWith(reportMonth));
  const expTotal  = expItems.reduce((s, e) => s + (+e.amount||0), 0);

  const expRows = expItems.length
    ? expItems.map(e => `
        <div class="fjb" style="padding:7px 0;border-bottom:1px solid var(--ln)">
          <span style="font-size:.86rem">${esc(e.label)}</span>
          <div class="flex gap8">
            <span class="money fc-bad">${THB(e.amount)}</span>
            <button class="btn-icon" data-dex="${e.id}"
              style="width:24px;height:24px;border:none">
              ${svgI('<path d="M18 6 6 18M6 6l12 12"/>',12)}
            </button>
          </div>
        </div>`)
      .join('')
    : `<div style="font-size:.83rem;color:var(--fg3);padding:8px 0">ยังไม่มีรายการ</div>`;

  /* ── Invoice table rows ── */
  const invRows = mInvs.length
    ? [...mInvs].reverse().map(i => {
        const gp = fmt(i.grand - (i.totalCost || 0));
        return `
          <tr>
            <td class="mono" style="font-size:.75rem;color:var(--teal);cursor:pointer"
                data-vi="${i.no}">${i.no}</td>
            <td style="font-size:.8rem">${dateStr(i.ts)}</td>
            <td style="font-weight:600">${esc(i.cust || '—')}</td>
            <td style="font-size:.8rem;color:var(--fg2)">${esc(i.plate || '—')}</td>
            <td class="r money fc-gold">${THB(i.grand)}</td>
            <td class="r" style="font-size:.82rem;color:var(--bad)">${THB(i.totalCost||0)}</td>
            <td class="r" style="font-weight:700;
                color:${gp>=0?'var(--grn)':'var(--bad)'}">
              ${THB(gp)}
            </td>
            <td class="c">
              <div class="flex gap6" style="justify-content:center">
                <button class="btn-icon" data-vi="${i.no}" title="ดูใบเสร็จ">
                  ${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',13)}
                </button>
                <button class="btn-icon" data-dinv="${i.no}" title="ลบบิล (คืนสต๊อก)"
                  style="color:var(--bad);border-color:rgba(239,83,80,.3)">
                  ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',13)}
                </button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="8" class="tbl-empty">ยังไม่มีบิลในเดือนนี้</td></tr>`;

  return `
    <!-- ── Header ── -->
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">
          รายงาน &amp; บัญชี
        </h1>
      </div>
      <div class="flex gap8" style="align-items:center">
        <label style="font-size:.8rem;color:var(--fg2)">เดือน</label>
        <input type="month" id="rMSel" value="${reportMonth}"
          style="background:var(--p2);border:1px solid var(--ln2);color:var(--fg);
                 border-radius:8px;padding:8px 11px;font-size:.87rem;outline:none">
      </div>
    </div>

    <!-- ── Stats ── -->
    <div class="g4 mb16">
      <div class="stat red">
        <div class="sk">${svgI('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')} ยอดขาย</div>
        <div class="sv" style="font-size:1.4rem">${THB(mRev)}</div>
        <div class="sd">${mInvs.length} บิล · วันนี้ ${THB(todayRev)}</div>
      </div>
      <div class="stat gold">
        <div class="sk">${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>')} กำไรขั้นต้น</div>
        <div class="sv" style="font-size:1.4rem;color:${mGross>=0?'var(--grn)':'var(--bad)'}">${THB(mGross)}</div>
        <div class="sd">COGS ${THB(mCost)}</div>
      </div>
      <div class="stat ${mNet>=0?'grn':'bad'}">
        <div class="sk">${svgI('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>')} กำไรสุทธิ</div>
        <div class="sv" style="font-size:1.4rem">${THB(mNet)}</div>
        <div class="sd">หัก ค่าใช้จ่าย ${THB(mExp)}</div>
      </div>
      <div class="stat teal">
        <div class="sk">${svgI('<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/>')} มูลค่าคงคลัง</div>
        <div class="sv" style="font-size:1.4rem">${THB(stockVal)}</div>
      </div>
    </div>

    <!-- ── Charts + Expenses ── -->
    <div class="g2 mb16">
      <!-- 6-month sales chart -->
      <div class="card">
        <div class="card-h">${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>')} <h2>ยอดขาย 6 เดือนล่าสุด</h2></div>
        <div class="card-b">
          <div style="display:flex;align-items:flex-end;gap:5px;height:110px">
            ${chartBars}
          </div>
        </div>
      </div>

      <!-- Expenses -->
      <div class="card">
        <div class="card-h">
          ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')}
          <h2>ค่าใช้จ่ายเดือนนี้</h2>
          <button class="btn btn-ghost btn-xs" id="addExpBtn" style="margin-left:auto">+ เพิ่ม</button>
        </div>
        <div class="card-b" style="padding:10px 14px">
          ${expRows}
          <div style="padding-top:8px;margin-top:4px;border-top:1px solid var(--ln);
                      font-size:.84rem;font-weight:700">
            รวม ${THB(expTotal)}
          </div>
        </div>
      </div>
    </div>

    <!-- ── Invoice table ── -->
    <div class="card">
      <div class="card-h">
        ${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>')}
        <h2>บิลเดือนนี้ (${mInvs.length} บิล)</h2>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>ทะเบียน</th>
              <th class="r">ยอดรวม</th><th class="r">COGS</th><th class="r">กำไร</th>
              <th class="c"></th>
            </tr>
          </thead>
          <tbody>${invRows}</tbody>
        </table>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindReport() {

  /* Month selector */
  sel('rMSel')?.addEventListener('input', e => {
    reportMonth = e.target.value;
    renderPanel();
  });

  /* Add expense button */
  sel('addExpBtn')?.addEventListener('click', openExpModal);

  /* Delete expense */
  document.querySelectorAll('[data-dex]').forEach(b =>
    b.addEventListener('click', async () => {
      S.expenses = S.expenses.filter(e => e.id !== b.dataset.dex);
      await saveData();
      renderPanel();
    })
  );

  /* View invoice */
  document.querySelectorAll('[data-vi]').forEach(el =>
    el.addEventListener('click', () => {
      const i = S.invoices.find(x => x.no === el.dataset.vi);
      if (i) showDoc('inv', i);
    })
  );

  /* Delete invoice (with stock restore) */
  document.querySelectorAll('[data-dinv]').forEach(b =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const inv = S.invoices.find(x => x.no === b.dataset.dinv);
      if (!inv) return;

      if (!confirm(
        `ลบใบเสร็จ ${inv.no} (${inv.cust||'ลูกค้า'}) ยอด ${THB(inv.grand)}?\n\n` +
        `⚠ สต๊อกที่ตัดไปแล้วจะถูกคืนกลับ`
      )) return;

      try {
        /* Delete from Supabase if available */
        if (useSupabase && inv.id && typeof deleteInvoice === 'function') {
          await deleteInvoice(inv.id);
        }
      } catch (err) {
        console.warn('[Report] Supabase delete failed (using localStorage):', err);
      }

      /* Restore stock */
      inv.items.forEach(it => {
        if (it.sid && it.itemType === 'stock') {
          const m = S.stockItems.find(x => x.id === it.sid);
          if (m) {
            m.qty  = fmt(m.qty  + it.qty);
            m.used = fmt(Math.max(0, (m.used || 0) - it.qty));
          }
        }
      });

      /* Reopen job if it was closed */
      if (inv.jobId) {
        const j = S.jobs.find(x => x.id === inv.jobId);
        if (j && j.status === 5) j.status = 4;
      }

      S.invoices = S.invoices.filter(x => x.no !== b.dataset.dinv);
      await saveData();
      renderPanel();
      renderNav();
      showToast(`ลบใบเสร็จ ${inv.no} แล้ว · คืนสต๊อกเรียบร้อย`, 'inf');
    })
  );
}

/* ══════════════════════════════════════
   EXPENSE MODAL
══════════════════════════════════════ */
function openExpModal() {
  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal sm">
      <div class="modal-h">
        <h3>เพิ่มค่าใช้จ่าย</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fld mb12">
          <label>รายการ</label>
          <input id="eLbl" placeholder="ค่าเช่า / เงินเดือน / น้ำไฟ…">
        </div>
        <div class="fgrid c2">
          <div class="fld">
            <label>จำนวน (฿)</label>
            <input id="eAmt" type="number" min="0">
          </div>
          <div class="fld">
            <label>วันที่</label>
            <input id="eDt" type="date" value="${new Date().toISOString().slice(0,10)}">
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-red" id="mOk">เพิ่ม</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const label = sv('eLbl').trim();
    const amt   = parseFloat(sv('eAmt')) || 0;
    if (!label || amt <= 0) return showToast('กรุณากรอกรายการและจำนวนเงิน', 'err');

    S.expenses.push({
      id:     'EX-' + Date.now(),
      label,
      amount: amt,
      date:   sv('eDt'),
    });

    await saveData();
    closeMod();
    renderPanel();
    showToast(`เพิ่ม ${label} ${THB(amt)}`);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}
