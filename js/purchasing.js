/* ============================================================
   PURCHASING.JS — ใบสั่งซื้อสินค้า (Purchase Order)
   สร้าง PO → รับสินค้า → อัปเดตสต๊อกอัตโนมัติ
   ============================================================ */

const PO_STATUS = { pending: 'รอรับสินค้า', received: 'รับแล้ว', cancelled: 'ยกเลิก' };
const PO_BADGE  = { pending: 'warn', received: 'ok', cancelled: 'bad' };

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function purchasingHTML() {
  const pos      = (S.purchaseOrders || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const pending  = pos.filter(p => p.status === 'pending').length;
  const received = pos.filter(p => p.status === 'received').length;

  const poCards = pos.length
    ? pos.map(p => {
        const badge = PO_BADGE[p.status] || 'warn';
        const label = PO_STATUS[p.status] || p.status;
        const total = (p.items || []).reduce((s, it) => s + (it.qty || 0) * (it.cost || 0), 0);
        return `
          <div class="card mb10 po-card" data-poid="${p.id}" style="cursor:pointer">
            <div class="card-b" style="padding:14px 16px">
              <div class="fjb" style="align-items:flex-start">
                <div>
                  <div class="flex gap8 mb4" style="align-items:center">
                    <span class="mono" style="font-size:.78rem;color:var(--teal)">${esc(p.no)}</span>
                    <span class="badge b-${badge}" style="font-size:.68rem">${label}</span>
                  </div>
                  <div style="font-weight:600;font-size:.95rem">${esc(p.supplier || '—')}</div>
                  <div style="font-size:.78rem;color:var(--fg2);margin-top:3px">
                    ${(p.items || []).length} รายการ · ${dateStr(p.ts)}
                  </div>
                </div>
                <div style="text-align:right">
                  ${hasPermission('canViewCost') ? `<div class="fc-gold" style="font-size:1.05rem;font-weight:700">${THB(total)}</div>` : ''}
                  ${p.status === 'pending' ? `<button class="btn btn-teal btn-sm mt8 btn-recv-po" data-poid="${p.id}" style="font-size:.76rem">
                    ${svgI('<path d="M5 12h14M12 5l7 7-7 7"/>',13)} รับสินค้า
                  </button>` : ''}
                  ${p.status === 'received' ? `<div style="font-size:.72rem;color:var(--grn);margin-top:6px">
                    รับ ${dateStr(p.receivedAt)}
                  </div>` : ''}
                </div>
              </div>
              ${(p.items || []).length ? `
                <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:5px">
                  ${p.items.slice(0, 5).map(it =>
                    `<span style="background:var(--p3);border-radius:6px;padding:3px 8px;font-size:.72rem;color:var(--fg2)">
                      ${esc(it.name)} × ${numFmt(it.qty)} ${esc(it.unit)}
                    </span>`
                  ).join('')}
                  ${p.items.length > 5 ? `<span style="font-size:.72rem;color:var(--fg3)">+${p.items.length-5} รายการ</span>` : ''}
                </div>` : ''}
            </div>
          </div>`;
      }).join('')
    : `<div class="card"><div class="card-b" style="padding:48px;text-align:center;color:var(--fg3)">
        ${svgI('<path d="M5 8h14M5 8a2 2 0 1 0 0-4h14a2 2 0 1 0 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',28)}
        <div style="margin-top:12px;font-size:.9rem">ยังไม่มีใบสั่งซื้อ</div>
        <div style="font-size:.8rem;margin-top:4px">กดปุ่ม "สร้าง PO ใหม่" เพื่อเริ่มต้น</div>
      </div></div>`;

  return `
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">
          ใบสั่งซื้อ (Purchase Order)
        </h1>
        <div style="font-size:.82rem;color:var(--fg2);margin-top:2px">
          สั่งซื้อสต๊อกจากซัพพลายเออร์ · รับของแล้ว → อัปเดตสต๊อกอัตโนมัติ
        </div>
      </div>
      <button class="btn btn-gold btn-sm" id="newPOBtn">
        ${svgI('<path d="M12 5v14M5 12h14"/>')} สร้าง PO ใหม่
      </button>
    </div>

    <!-- Stats -->
    <div class="g3 mb16" style="grid-template-columns:repeat(3,1fr)">
      <div class="card"><div class="card-b" style="padding:14px 16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--warn)">${pending}</div>
        <div style="font-size:.78rem;color:var(--fg2)">รอรับสินค้า</div>
      </div></div>
      <div class="card"><div class="card-b" style="padding:14px 16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--grn)">${received}</div>
        <div style="font-size:.78rem;color:var(--fg2)">รับแล้วทั้งหมด</div>
      </div></div>
      <div class="card"><div class="card-b" style="padding:14px 16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--teal)">${pos.length}</div>
        <div style="font-size:.78rem;color:var(--fg2)">PO ทั้งหมด</div>
      </div></div>
    </div>

    <!-- PO list -->
    <div id="poList">${poCards}</div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindPurchasing() {
  sel('newPOBtn')?.addEventListener('click', openNewPOModal);

  /* Click PO card → view detail */
  document.querySelectorAll('.po-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.btn-recv-po')) return; // let receive button handle
      openPODetail(card.dataset.poid);
    });
  });

  /* Receive button */
  document.querySelectorAll('.btn-recv-po').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openReceivePOModal(btn.dataset.poid);
    });
  });
}

/* ══════════════════════════════════════
   NEW PO MODAL
══════════════════════════════════════ */
function openNewPOModal() {
  const ov = sel('mOv');
  let poItems = [];
  let poKey   = 0;

  const stOpts = S.stockItems.map(i =>
    `<option value="${i.id}">${esc(i.name)} [${i.unit}] — คงเหลือ ${numFmt(i.qty)}</option>`
  ).join('');

  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <h3>สร้างใบสั่งซื้อใหม่</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fgrid c2 mb12">
          <div class="fld">
            <label>ซัพพลายเออร์ / ร้านค้า *</label>
            <input id="poSupplier" placeholder="เช่น บริษัท ABC Oil…">
          </div>
          <div class="fld">
            <label>หมายเหตุ</label>
            <input id="poNote" placeholder="รายละเอียดเพิ่มเติม…">
          </div>
        </div>

        <!-- Item selector -->
        <div class="flex gap8 mb12" style="flex-wrap:wrap">
          <select id="poSel" style="flex:1;min-width:200px;background:var(--ink);border:1px solid var(--ln2);
                                    color:var(--fg);border-radius:8px;padding:9px 11px;font-size:.88rem;outline:none">
            <option value="">+ เลือกสินค้าจากสต๊อก…</option>
            ${stOpts}
          </select>
          <button class="btn btn-teal btn-sm" id="poAddSt">
            ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่มจากสต๊อก
          </button>
          <button class="btn btn-ghost btn-sm" id="poAddFr">
            ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>')} สินค้าอื่น
          </button>
        </div>

        <!-- Column headers -->
        <div style="display:grid;grid-template-columns:1fr 110px 80px 36px;gap:8px;
                    padding:0 4px 7px;font-family:'JetBrains Mono',monospace;
                    font-size:.6rem;letter-spacing:1px;color:var(--fg2);text-transform:uppercase;
                    border-bottom:1px solid var(--ln);margin-bottom:4px">
          <span>รายการ</span><span>จำนวน + หน่วย</span>
          ${hasPermission('canViewCost') ? '<span class="r">ราคาทุน</span>' : '<span></span>'}
          <span></span>
        </div>

        <div id="poRows">
          <div class="bi-empty">ยังไม่มีรายการ — เลือกจากสต๊อกหรือกรอกเอง</div>
        </div>
      </div>
      <div class="modal-f">
        <div style="font-size:.84rem;color:var(--fg2)">
          มูลค่ารวม: <b id="poTotal" class="fc-gold">฿0</b>
        </div>
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold" id="poSave" disabled>
          ${svgI('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')}
          ออก PO
        </button>
      </div>
    </div>`;

  openOv('mOv');

  function renderPORows() {
    const box = sel('poRows');
    if (!box) return;
    if (!poItems.length) {
      box.innerHTML = '<div class="bi-empty">ยังไม่มีรายการ</div>';
      sel('poSave').disabled = true;
      si('poTotal', '฿0');
      return;
    }

    box.innerHTML = poItems.map(it => `
      <div style="display:grid;grid-template-columns:1fr 110px 80px 36px;gap:8px;
                  align-items:center;padding:7px 4px;border-bottom:1px dashed var(--ln)">
        <div style="font-size:.86rem;font-weight:600">${esc(it.nm)}</div>
        <div style="display:flex;align-items:center;gap:4px">
          <input type="number" min="1" step="1" value="${it.qty}" data-pk="${it.k}"
                 style="width:64px;background:var(--ink);border:1px solid var(--ln2);
                        color:var(--fg);border-radius:7px;padding:6px 7px;font-size:.84rem;
                        outline:none;text-align:right">
          <span style="font-size:.76rem;color:var(--fg2)">${esc(it.unit)}</span>
        </div>
        ${hasPermission('canViewCost') ? `<div style="font-size:.82rem;text-align:right;color:var(--fg2)">
          ${THB(it.cost * it.qty)}
        </div>` : '<div></div>'}
        <button class="btn-icon" data-pdl="${it.k}">
          ${svgI('<path d="M18 6 6 18M6 6l12 12"/>',13)}
        </button>
      </div>`).join('');

    box.querySelectorAll('input[data-pk]').forEach(inp => {
      inp.addEventListener('input', () => {
        const it = poItems.find(x => x.k == inp.dataset.pk);
        if (it) it.qty = parseFloat(inp.value) || 1;
        renderPORows();
      });
    });
    box.querySelectorAll('[data-pdl]').forEach(b => {
      b.addEventListener('click', () => {
        poItems = poItems.filter(x => x.k != b.dataset.pdl);
        renderPORows();
      });
    });

    const tot = poItems.reduce((s, it) => s + it.qty * it.cost, 0);
    si('poTotal', hasPermission('canViewCost') ? THB(tot) : '—');
    sel('poSave').disabled = !poItems.length || !sv('poSupplier').trim();
  }

  sel('poAddSt').addEventListener('click', () => {
    const id = sv('poSel');
    if (!id) return;
    if (poItems.find(x => x.sid === id)) return showToast('มีรายการนี้แล้ว', 'err');
    const m = S.stockItems.find(x => x.id === id);
    poItems.push({ k: ++poKey, sid: id, nm: m.name, unit: m.unit, qty: 1, cost: m.cost });
    sel('poSel').value = '';
    renderPORows();
  });

  sel('poAddFr').addEventListener('click', () => {
    poItems.push({ k: ++poKey, sid: null, nm: 'สินค้าอื่น', unit: 'ชิ้น', qty: 1, cost: 0 });
    renderPORows();
  });

  sel('poSupplier').addEventListener('input', () => {
    sel('poSave').disabled = !poItems.length || !sv('poSupplier').trim();
  });

  sel('poSave').addEventListener('click', async () => {
    const supplier = sv('poSupplier').trim();
    if (!supplier) return showToast('กรุณาระบุชื่อซัพพลายเออร์', 'err');
    if (!poItems.length) return showToast('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ', 'err');

    const no    = nextSeqNo('po').replace('po-', 'PO-');
    const total = poItems.reduce((s, it) => s + it.qty * it.cost, 0);
    const po    = {
      id:       'PO-' + Date.now(),
      no,
      ts:       Date.now(),
      supplier,
      status:   'pending',
      items:    poItems.map(it => ({
        sid:  it.sid,
        name: it.nm,
        unit: it.unit,
        qty:  it.qty,
        cost: it.cost,
      })),
      total,
      note: sv('poNote'),
      receivedAt: null,
    };

    if (!S.purchaseOrders) S.purchaseOrders = [];
    S.purchaseOrders.push(po);

    // Save to Supabase
    if (useSupabase && typeof addPO === 'function') {
      addPO(po.no, po.supplier, po.items, po.total, po.note)
        .then(result => {
          if (result?.id) {
            po.id = result.id;
            localStorage.setItem(DB_KEY, JSON.stringify(S));
          }
        })
        .catch(e => console.warn('[PO] Supabase save failed:', e));
    }

    await saveData();
    closeMod();
    renderNav();
    renderPanel();
    showToast(`ออก PO ${no} แล้ว · ${poItems.length} รายการ`);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   PO DETAIL MODAL
══════════════════════════════════════ */
function openPODetail(poId) {
  const po  = (S.purchaseOrders || []).find(p => p.id === poId);
  if (!po) return;

  const total = (po.items || []).reduce((s, it) => s + (it.qty || 0) * (it.cost || 0), 0);
  const badge = PO_BADGE[po.status] || 'warn';
  const label = PO_STATUS[po.status] || po.status;
  const ov    = sel('mOv');

  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <div>
          <div class="flex gap8" style="align-items:center">
            <h3>${esc(po.no)}</h3>
            <span class="badge b-${badge}">${label}</span>
          </div>
          <div style="font-size:.78rem;color:var(--fg2);margin-top:2px">
            ${esc(po.supplier || '—')} · ${dateStr(po.ts)}
          </div>
        </div>
        <div class="flex gap8">
          ${po.status === 'pending' ? `<button class="btn btn-teal btn-sm" id="recvBtn">รับสินค้า</button>` : ''}
          ${po.status === 'pending' ? `<button class="btn btn-ghost btn-sm" id="cancelPOBtn" style="color:var(--bad)">ยกเลิก PO</button>` : ''}
          <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
        </div>
      </div>
      <div class="modal-b">
        <table class="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>รายการ</th>
              <th class="c">จำนวน</th>
              ${hasPermission('canViewCost') ? '<th class="r">ราคาทุน/หน่วย</th><th class="r">รวม</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${(po.items || []).map((it, i) => `
              <tr>
                <td class="c" style="color:var(--fg3)">${i + 1}</td>
                <td>${esc(it.name)}</td>
                <td class="c">${numFmt(it.qty)} ${esc(it.unit)}</td>
                ${hasPermission('canViewCost') ? `<td class="r fc-gold">${THB(it.cost)}</td><td class="r">${THB(it.qty * it.cost)}</td>` : ''}
              </tr>`).join('')}
          </tbody>
          ${hasPermission('canViewCost') ? `<tfoot>
            <tr>
              <td colspan="${hasPermission('canViewCost') ? 4 : 2}" class="r" style="padding-top:10px;font-size:.8rem;color:var(--fg2)">มูลค่ารวม</td>
              <td class="r"><b class="fc-gold">${THB(total)}</b></td>
            </tr>
          </tfoot>` : ''}
        </table>
        ${po.note ? `<div class="card mt12"><div class="card-b" style="padding:10px 14px;font-size:.84rem;color:var(--fg2)">หมายเหตุ: ${esc(po.note)}</div></div>` : ''}
        ${po.status === 'received' ? `<div class="card mt12" style="border-color:var(--grn)"><div class="card-b" style="padding:10px 14px;font-size:.84rem;color:var(--grn)">
          ✓ รับสินค้าแล้ว · ${dateStr(po.receivedAt)}
        </div></div>` : ''}
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ปิด</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#recvBtn')?.addEventListener('click', () => {
    closeMod();
    setTimeout(() => openReceivePOModal(poId), 80);
  });

  ov.querySelector('#cancelPOBtn')?.addEventListener('click', async () => {
    if (!confirm(`ยกเลิก PO ${po.no} ?`)) return;
    po.status = 'cancelled';

    if (useSupabase && typeof updatePO === 'function') {
      const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (_uuidRe.test(po.id)) {
        updatePO(po.id, { status: 'cancelled' }).catch(() => {});
      }
    }

    await saveData();
    closeMod();
    renderPanel();
    showToast(`ยกเลิก PO ${po.no} แล้ว`, 'inf');
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   RECEIVE PO MODAL
   รับสินค้า → อัปเดตสต๊อก
══════════════════════════════════════ */
function openReceivePOModal(poId) {
  const po  = (S.purchaseOrders || []).find(p => p.id === poId);
  if (!po || po.status !== 'pending') return;

  let recvItems = po.items.map(it => ({ ...it, recvQty: it.qty }));
  const ov      = sel('mOv');

  ov.innerHTML = `
    <div class="modal lg">
      <div class="modal-h">
        <div>
          <h3>รับสินค้า — ${esc(po.no)}</h3>
          <div style="font-size:.78rem;color:var(--fg2);margin-top:2px">ตรวจสอบจำนวนที่รับจริงก่อนยืนยัน</div>
        </div>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <!-- Column headers -->
        <div style="display:grid;grid-template-columns:1fr 120px 36px;gap:8px;
                    padding:0 4px 7px;font-family:'JetBrains Mono',monospace;
                    font-size:.6rem;letter-spacing:1px;color:var(--fg2);text-transform:uppercase;
                    border-bottom:1px solid var(--ln);margin-bottom:4px">
          <span>รายการ</span><span>จำนวนรับจริง</span><span></span>
        </div>
        <div id="recvRows"></div>
        <div class="fld mt12">
          <label>หมายเหตุ</label>
          <input id="recvNote" placeholder="เช่น ของมาครบ / ขาด 2 ชิ้น…">
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold" id="recvSave">
          ${svgI('<path d="M9 11l3 3L22 4"/>')} ยืนยันรับสินค้า &amp; อัปเดตสต๊อก
        </button>
      </div>
    </div>`;

  openOv('mOv');

  function renderRecvRows() {
    const box = sel('recvRows');
    box.innerHTML = recvItems.map((it, idx) => {
      const st = it.sid ? S.stockItems.find(x => x.id === it.sid) : null;
      return `
        <div style="display:grid;grid-template-columns:1fr 120px 36px;gap:8px;
                    align-items:center;padding:8px 4px;border-bottom:1px dashed var(--ln)">
          <div>
            <div style="font-size:.86rem;font-weight:600">${esc(it.name)}</div>
            ${st ? `<div style="font-size:.68rem;color:var(--fg2);font-family:'JetBrains Mono',monospace">
              สต๊อกปัจจุบัน: ${numFmt(st.qty)} ${esc(it.unit)}
            </div>` : `<div style="font-size:.68rem;color:var(--fg3)">ไม่มีในสต๊อก (รับเข้าเฉยๆ)</div>`}
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <input type="number" min="0" step="1" value="${it.recvQty}" data-ridx="${idx}"
                   style="width:70px;background:var(--ink);border:1px solid var(--ln2);
                          color:var(--fg);border-radius:7px;padding:6px 7px;font-size:.84rem;
                          outline:none;text-align:right">
            <span style="font-size:.76rem;color:var(--fg2)">${esc(it.unit)}</span>
          </div>
          <button class="btn-icon" data-rrdl="${idx}" title="ข้ามรายการนี้">
            ${svgI('<path d="M18 6 6 18M6 6l12 12"/>',13)}
          </button>
        </div>`;
    }).join('');

    box.querySelectorAll('input[data-ridx]').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.ridx);
        if (recvItems[idx]) recvItems[idx].recvQty = parseFloat(inp.value) || 0;
      });
    });
    box.querySelectorAll('[data-rrdl]').forEach(b => {
      b.addEventListener('click', () => {
        const idx = parseInt(b.dataset.rrdl);
        recvItems.splice(idx, 1);
        renderRecvRows();
      });
    });
  }

  renderRecvRows();

  sel('recvSave').addEventListener('click', async () => {
    const toReceive = recvItems.filter(it => it.recvQty > 0);
    if (!toReceive.length) return showToast('กรุณาระบุจำนวนที่รับอย่างน้อย 1 รายการ', 'err');
    const recvNote = sv('recvNote').trim();

    /* Add qty to stock */
    for (const it of toReceive) {
      if (!it.sid) continue;
      const st = S.stockItems.find(x => x.id === it.sid);
      if (!st) continue;
      st.qty  = fmt(parseFloat(st.qty) + parseFloat(it.recvQty));
      st.recv = fmt((st.recv || 0) + parseFloat(it.recvQty));

      // Sync stock to Supabase
      if (useSupabase && typeof updateStockBySku === 'function') {
        updateStockBySku(st.id, st.qty).catch(() => {});
      }
      // Record in ledger
      if (typeof addToLedger === 'function') {
        addToLedger(st.id, 'in', it.recvQty, `รับตาม PO ${po.no}${recvNote ? ' — ' + recvNote : ''}`);
      }
    }

    /* Mark PO as received */
    po.status     = 'received';
    po.receivedAt = Date.now();
    po.items      = po.items.map(it => {
      const recv = toReceive.find(r => r.sid === it.sid && r.name === it.name);
      return recv ? { ...it, recvQty: recv.recvQty } : it;
    });

    // Update Supabase
    if (useSupabase && typeof updatePO === 'function') {
      const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (_uuidRe.test(po.id)) {
        updatePO(po.id, {
          status:      'received',
          received_at: new Date().toISOString(),
          items:       po.items,
          note:        recvNote || po.note || null,
        }).catch(e => console.warn('[PO] receive sync failed:', e));
      }
    }

    await saveData();
    closeMod();
    renderNav();
    renderPanel();
    showToast(`รับสินค้า ${toReceive.length} รายการแล้ว · อัปเดตสต๊อกเรียบร้อย`, 'ok');
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}
