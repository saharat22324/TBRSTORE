/* ============================================================
   BILLING.JS — ออกบิล (Invoice / Quotation)
   ────────────────────────────────────────────
   รองรับ 3 ประเภทรายการ:
     stock  → Stock Item (ของเหลว) ราคาขายตามสต๊อก
     order  → Order Item (อะไหล่) ทุน × 1.37
     service→ Service Package ราคาตั้งเอง
   ============================================================ */

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function billingHTML() {
  const { sub, vat, grand } = bCalc();

  const stOpts  = S.stockItems.map(i =>
    `<option value="stock:${i.id}">[สต๊อก] ${esc(i.name)} [${i.unit}] — ${THB(i.sell)}</option>`
  ).join('');

  const svcOpts = S.services.map(s =>
    `<option value="svc:${s.id}">[บริการ] ${esc(s.name)} — ${THB(s.price)}</option>`
  ).join('');

  const recentInv = S.invoices.slice(-6).reverse();

  const recentList = recentInv.length
    ? recentInv.map(i => `
        <div class="fjb" style="padding:8px 14px;border-bottom:1px solid var(--ln);cursor:pointer"
             data-viewinv="${i.no}">
          <div>
            <div style="font-size:.84rem;font-weight:600">${esc(i.cust || '—')}</div>
            <div style="font-size:.68rem;color:var(--fg2);font-family:'JetBrains Mono',monospace">
              ${i.no} · ${dateStr(i.ts)}
            </div>
          </div>
          <span class="money fc-gold">${THB(i.grand)}</span>
        </div>`)
      .join('')
    : `<div style="padding:14px;font-size:.82rem;color:var(--fg3)">ยังไม่มีบิล</div>`;

  return `
    <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start">

      <!-- ── Left: form ── -->
      <div>

        <!-- Customer / vehicle info -->
        <div class="card mb14">
          <div class="card-h">
            ${svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}
            <h2>ข้อมูล</h2>
            ${bJobId
              ? `<span class="badge b-teal" style="margin-left:4px">
                   Job: ${esc(S.jobs.find(j=>j.id===bJobId)?.no||'')}
                 </span>`
              : ''}
          </div>
          <div class="card-b">
            <div class="fgrid c2 mb12">
              <div class="fld"><label>ชื่อลูกค้า</label><input id="bCust" placeholder="ชื่อ-นามสกุล"></div>
              <div class="fld"><label>เบอร์โทร</label><input id="bPhone" placeholder="08X-XXXXXXX"></div>
            </div>
            <div class="fgrid c2 mb12">
              <div class="fld"><label>ทะเบียนรถ</label><input id="bPlate" placeholder="กข 1234 กทม."></div>
              <div class="fld"><label>รุ่นรถ</label><input id="bModel" placeholder="BMW X3 2022"></div>
            </div>
            <div class="fgrid c2">
              <div class="fld"><label>เลขไมล์ (กม.)</label><input id="bMile" inputmode="numeric" placeholder="85000"></div>
              <div class="fld">
                <label>อ้างอิง Job / ใบแจ้งซ่อม</label>
                <input id="bRef" value="${bJobId ? esc(S.jobs.find(j=>j.id===bJobId)?.no||'') : ''}"
                       placeholder="JOB-…">
              </div>
            </div>
          </div>
        </div>

        <!-- Bill items -->
        <div class="card">
          <div class="card-h">
            ${svgI('<path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 12h6"/>')}
            <h2>รายการ</h2>
          </div>
          <div class="card-b">

            <!-- Add buttons row -->
            <div class="flex gap8 mb12" style="flex-wrap:wrap">
              <select id="bSel"
                style="flex:1;min-width:180px;background:var(--ink);border:1px solid var(--ln2);
                       color:var(--fg);border-radius:8px;padding:9px 11px;font-size:.88rem;outline:none">
                <option value="">+ เลือกสินค้า / บริการ…</option>
                <optgroup label="── สต๊อก (ของเหลว) ──">${stOpts}</optgroup>
                <optgroup label="── Service Package ──">${svcOpts}</optgroup>
              </select>
              <button class="btn btn-gold btn-sm"  id="bAddPick">
                ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่ม
              </button>
              <button class="btn btn-ghost btn-sm" id="bAddOrder">
                ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>')} อะไหล่สั่ง +37%
              </button>
              <button class="btn btn-ghost btn-sm" id="bAddFree">
                ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>')} รายการเอง
              </button>
              <button class="btn btn-ghost btn-sm" id="bAddLabor">
                ${svgI('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2 2 0 1 0 2.8 2.8l6-6a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.1-2.1 2.3-2.3Z"/>')} ค่าแรง
              </button>
            </div>

            <!-- Item column headers -->
            <div class="bi-head">
              <span>รายการ</span><span>จำนวน</span>
              <span>ราคา/หน่วย</span><span style="text-align:right">รวม</span><span></span>
            </div>

            <div id="biRows"></div>

            <div class="fld mt12">
              <label>หมายเหตุในบิล</label>
              <textarea id="bNote" rows="2" placeholder="หมายเหตุ…"></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Right: summary + recent ── -->
      <div style="position:sticky;top:66px">

        <!-- Summary box -->
        <div class="sum-box mb12">
          <div class="sr"><span>ยอดรวม</span><span id="sSub" class="money">${THB(sub)}</span></div>
          <div class="sr">
            <span>ส่วนลด (฿)</span>
            <input id="sDisc" type="number" min="0" value="${bDisc||''}">
          </div>
          <div class="sr">
            <label class="vat-sw ${bVat?'on':''}" id="sVat">
              <span class="sw"></span><span>VAT 7%</span>
            </label>
            <span id="sVatAmt" class="money">${THB(vat)}</span>
          </div>
          <div class="sr grand">
            <span class="lbl">รวมสุทธิ</span>
            <span class="amt" id="sGrand">${THB(grand)}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex gap8 mb12" style="flex-direction:column">
          <button class="btn btn-gold" id="bSaveInv" style="width:100%;justify-content:center" disabled>
            ${svgI('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>')}
            บันทึก &amp; ออกใบเสร็จ
          </button>
          <button class="btn btn-teal"  id="bSaveQt" style="width:100%;justify-content:center" disabled>
            ${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>')}
            ออกใบเสนอราคา
          </button>
          <button class="btn btn-ghost" id="bClear" style="width:100%;justify-content:center">
            ล้างบิล
          </button>
        </div>

        <!-- Recent invoices -->
        <div class="card">
          <div class="card-h" style="padding:10px 14px">
            ${svgI('<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',14)}
            <h2 style="font-size:.92rem">บิลล่าสุด</h2>
          </div>
          <div style="padding:4px 0">${recentList}</div>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindBilling() {

  /* ── Recalculate totals ── */
  function recalc() {
    const { sub, vat, grand } = bCalc();
    si('sSub',    THB(sub));
    si('sVatAmt', THB(vat));
    si('sGrand',  THB(grand));

    const short = bItems.some(it =>
      it.sid && it.qty > (S.stockItems.find(x => x.id === it.sid)?.qty || 0)
    );

    ['bSaveInv', 'bSaveQt'].forEach(id => {
      const btn = sel(id);
      if (btn) btn.disabled = !bItems.length || grand <= 0 || short;
    });
  }

  /* ── Render bill item rows ── */
  function renderRows() {
    const box = sel('biRows');
    if (!box) return;

    if (!bItems.length) {
      box.innerHTML = '<div class="bi-empty">ยังไม่มีรายการ</div>';
      recalc();
      return;
    }

    box.innerHTML = bItems.map(it => {
      const m     = it.sid ? S.stockItems.find(x => x.id === it.sid) : null;
      const short = m && it.qty > m.qty;

      /* Type badge */
      const badge =
        it.itemType === 'stock'   ? '<span class="tag-stock">สต๊อก</span>'   :
        it.itemType === 'order'   ? '<span class="tag-order">อะไหล่ +37%</span>' :
        it.itemType === 'service' ? '<span class="tag-svc">บริการ</span>'    : '';

      /* Name cell — stock items show SKU, others show editable input */
      const nameCell = (it.sid && it.itemType === 'stock')
        ? `<div style="font-size:.86rem;font-weight:600;display:flex;align-items:center;gap:6px">
             ${esc(it.nm)} ${badge}
           </div>
           <div style="font-size:.65rem;color:${short?'var(--bad)':'var(--fg2)'};
                       font-family:'JetBrains Mono',monospace">
             ${esc(it.sid)}${short
               ? ` · ⚠ ไม่พอ (เหลือ ${numFmt(m.qty)})`
               : ' · Stock Item'}
           </div>`
        : `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">${badge}</div>
           <input data-f="nm" value="${esc(it.nm)}" placeholder="ชื่อรายการ" style="width:100%">`;

      return `
        <div class="bi-row" data-bk="${it.k}">
          <div>${nameCell}</div>
          <div>
            <input data-f="qty" type="number" min="0"
                   step="${it.unit === 'ลิตร' ? '0.5' : '1'}"
                   value="${numFmt(it.qty)}" style="width:100%">
          </div>
          <div>
            <input data-f="price" type="number" min="0"
                   value="${it.price}" style="width:100%">
          </div>
          <div class="tot">${THB(it.qty * it.price)}</div>
          <button class="btn-icon" data-del="${it.k}">
            ${svgI('<path d="M18 6 6 18M6 6l12 12"/>',13)}
          </button>
        </div>`;
    }).join('');

    /* Bind row inputs */
    box.querySelectorAll('input[data-f]').forEach(inp => {
      inp.addEventListener('input', () => {
        const it = bItems.find(x => x.k == inp.closest('[data-bk]')?.dataset.bk);
        if (!it) return;
        const f = inp.dataset.f;
        if      (f === 'qty')   it.qty   = parseFloat(inp.value) || 0;
        else if (f === 'price') it.price = parseFloat(inp.value) || 0;
        else                    it[f]    = inp.value;
        renderRows();
      });
    });

    /* Bind delete buttons */
    box.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => {
        bItems = bItems.filter(x => x.k != b.dataset.del);
        renderRows();
      });
    });

    recalc();
  }

  /* ── Add from dropdown (Stock / Service) ── */
  sel('bAddPick')?.addEventListener('click', () => {
    const val = sv('bSel');
    if (!val) return;

    const [type, id] = val.split(':');

    if (type === 'stock') {
      const m = S.stockItems.find(x => x.id === id);
      bItems.push({
        k: ++bKey, sid: id, nm: m.name, unit: m.unit,
        qty: m.unit === 'ลิตร' ? 4 : 1,
        price: m.sell, itemType: 'stock', cost: m.cost,
      });
    } else {
      const s = S.services.find(x => x.id === id);
      bItems.push({
        k: ++bKey, sid: null, nm: s.name, unit: 'งาน',
        qty: 1, price: s.price, itemType: 'service', cost: 0,
      });
    }

    sel('bSel').value = '';
    renderRows();
  });

  /* ── Add Order Item (อะไหล่ +37%) via modal ── */
  sel('bAddOrder')?.addEventListener('click', () => openOrderItemModal());

  /* ── Add free-text item ── */
  sel('bAddFree')?.addEventListener('click', () => {
    bItems.push({ k: ++bKey, sid: null, nm: '', unit: '', qty: 1, price: 0, itemType: 'other', cost: 0 });
    renderRows();
  });

  /* ── Add labor row ── */
  sel('bAddLabor')?.addEventListener('click', () => {
    bItems.push({ k: ++bKey, sid: null, nm: 'ค่าแรง / ค่าบริการ', unit: 'งาน', qty: 1, price: 0, itemType: 'service', cost: 0 });
    renderRows();
  });

  /* ── Discount input ── */
  sel('sDisc')?.addEventListener('input', e => { bDisc = parseFloat(e.target.value) || 0; recalc(); });

  /* ── VAT toggle ── */
  sel('sVat')?.addEventListener('click', () => {
    bVat = !bVat;
    sel('sVat').classList.toggle('on', bVat);
    recalc();
  });

  /* ── Save invoice ── */
  sel('bSaveInv')?.addEventListener('click', saveInvoice);

  /* ── Save quotation ── */
  sel('bSaveQt')?.addEventListener('click', saveQuote);

  /* ── Clear bill ── */
  sel('bClear')?.addEventListener('click', () => {
    if (bItems.length && !confirm('ล้างบิลทั้งหมด?')) return;
    bItems = []; bKey = 0; bDisc = 0; bVat = false; bJobId = null;
    renderPanel();
  });

  /* ── View recent invoice ── */
  document.querySelectorAll('[data-viewinv]').forEach(el =>
    el.addEventListener('click', () => {
      const i = S.invoices.find(x => x.no === el.dataset.viewinv);
      if (i) showDoc('inv', i);
    })
  );

  renderRows();
}

/* ── Billing calc ── */
function bCalc() {
  const sub  = bItems.reduce((s, i) => s + fmt(i.qty * i.price), 0);
  const base = Math.max(0, sub - bDisc);
  const vat  = bVat ? fmt(base * 0.07) : 0;
  return { sub, base, vat, grand: fmt(base + vat) };
}

/* ══════════════════════════════════════
   ORDER ITEM MODAL (อะไหล่สั่ง +37%)
   กรอกทุน → คำนวณราคาขาย live
══════════════════════════════════════ */
function openOrderItemModal() {
  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal sm">
      <div class="modal-h">
        <h3>เพิ่มอะไหล่สั่ง (+37%)</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fld mb12">
          <label>ชื่ออะไหล่ / รายการ *</label>
          <input id="oimNm" placeholder="ลูกหมาก / ปีกนก / โช้ค…">
        </div>
        <div class="fgrid c2 mb12">
          <div class="fld"><label>หน่วย</label><input id="oimUnit" value="ชิ้น"></div>
          <div class="fld"><label>จำนวน</label><input id="oimQty" type="number" min="1" value="1"></div>
        </div>
        <div class="fgrid c2 mb4">
          <div class="fld">
            <label>ราคาทุน (฿) *</label>
            <input id="oimCost" type="number" min="0" placeholder="0" inputmode="numeric">
          </div>
          <div class="fld">
            <label>
              ราคาขาย (฿)
              <span id="oimPctHint" style="color:var(--gold);font-family:'JetBrains Mono',monospace;
                                          font-size:.7rem"></span>
            </label>
            <input id="oimSell" type="number" min="0" placeholder="คำนวณอัตโนมัติ">
            <div class="hint ok" id="oimAutoHint" style="display:none">
              ทุน × 1.37 — แก้ไขได้ถ้าต้องการ
            </div>
          </div>
        </div>

        <!-- Summary preview -->
        <div style="background:var(--p3);border-radius:9px;padding:11px 13px;margin-top:10px;font-size:.84rem">
          <div style="color:var(--fg2);margin-bottom:5px">สรุป:</div>
          <div class="flex gap12">
            <span>ทุน: <b id="oS1" class="fc-muted">฿0</b></span>
            <span>ราคาขาย: <b id="oS2" class="fc-gold">฿0</b></span>
            <span>กำไร/ชิ้น: <b id="oS3" class="fc-grn">฿0</b></span>
          </div>
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold"  id="mOk">
          ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่มลงบิล
        </button>
      </div>
    </div>`;

  openOv('mOv');

  /* ── Live calculation ── */
  function calcSell() {
    const cost = parseFloat(sv('oimCost')) || 0;
    const auto = Math.round(cost * MARKUP_RATE);

    if (cost > 0) {
      sel('oimSell').value = auto;
      sel('oimAutoHint').style.display = 'block';
      sel('oimPctHint').textContent = `= ${THB(auto)}`;
    } else {
      sel('oimSell').value = '';
      sel('oimAutoHint').style.display = 'none';
      sel('oimPctHint').textContent = '';
    }
    updateSummary();
  }

  function updateSummary() {
    const cost   = parseFloat(sv('oimCost')) || 0;
    const sell   = parseFloat(sv('oimSell')) || 0;
    const profit = fmt(sell - cost);
    si('oS1', THB(cost));
    si('oS2', THB(sell));
    si('oS3', THB(profit));
    sel('oS3').style.color = profit >= 0 ? 'var(--grn)' : 'var(--bad)';
  }

  sel('oimCost').addEventListener('input', calcSell);
  sel('oimSell').addEventListener('input', updateSummary);

  /* ── Confirm add ── */
  ov.querySelector('#mOk').addEventListener('click', () => {
    const nm   = sv('oimNm').trim();
    const cost = parseFloat(sv('oimCost')) || 0;
    const sell = parseFloat(sv('oimSell')) || 0;
    const qty  = parseFloat(sv('oimQty')) || 1;
    const unit = sv('oimUnit') || 'ชิ้น';

    if (!nm)      return showToast('กรุณากรอกชื่ออะไหล่', 'err');
    if (cost <= 0) return showToast('กรุณากรอกราคาทุน', 'err');

    bItems.push({ k: ++bKey, sid: null, nm, unit, qty, price: sell, itemType: 'order', cost });
    closeMod();

    /* Re-render billing rows (panel already rendered) */
    const box = sel('biRows');
    if (box) {
      /* Trigger re-render by re-binding */
      const ev = new CustomEvent('rerender');
      box.dispatchEvent(ev);
    }
    renderPanel();
    showToast(`เพิ่ม ${nm} ${THB(sell)}/ชิ้น · ทุน ${THB(cost)} (+37%)`);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   SAVE INVOICE
══════════════════════════════════════ */
async function saveInvoice() {
  const { sub, base, vat, grand } = bCalc();
  if (!bItems.length || grand <= 0) return;

  const cust  = sv('bCust');
  const plate = sv('bPlate');
  const model = sv('bModel');
  const mile  = sv('bMile');
  const ref   = sv('bRef');
  const note  = sv('bNote');
  const phone = sv('bPhone');

  const no        = nextSeqNo('inv').replace('inv-','INV-');
  const totalCost = bItems.reduce((s, it) => s + fmt(it.qty * (it.cost || 0)), 0);

  /* Deduct Stock Items only */
  bItems.forEach(it => {
    if (it.sid && it.itemType === 'stock') {
      const m = S.stockItems.find(x => x.id === it.sid);
      if (m) {
        m.qty  = fmt(m.qty  - it.qty);
        m.used = fmt((m.used || 0) + it.qty);
      }
    }
  });

  /* Update vehicle mileage */
  if (bJobId && mile) {
    const j = S.jobs.find(x => x.id === bJobId);
    if (j) {
      const v = S.vehicles.find(x => x.id === j.vehicleId);
      if (v) v.mileage = parseInt(mile) || v.mileage;
    }
  }

  const inv = {
    no, ts: Date.now(), jobId: bJobId,
    cust, phone, plate, model, mileage: mile, ref,
    items: bItems.map(it => ({
      name: it.nm || '-', unit: it.unit,
      qty: fmt(it.qty), price: it.price,
      cost: it.cost || 0, itemType: it.itemType, sid: it.sid,
    })),
    sub, disc: bDisc, vat, grand, totalCost, note,
  };

  /* Close job if billing from job */
  if (bJobId) {
    const j = S.jobs.find(x => x.id === bJobId);
    if (j) j.status = 5;
  }

  try {
    // Try to save to Supabase
    if (useSupabase && typeof addInvoice === 'function') {
      const supaResult = await addInvoice(
        bJobId,
        null, // customerId - can be null for now
        null, // vehicleId - can be null for now
        bItems.map(it => ({
          type: it.itemType || 'stock',
          stockItemId: it.itemType === 'stock' ? it.sid : null,
          serviceId: it.itemType === 'service' ? it.sid : null,
          description: it.nm,
          quantity: it.qty,
          unitPrice: it.price,
          total: fmt(it.qty * it.price),
          note: ''
        })),
        sub, bDisc, vat ? 0.07 : 0, grand, note, no  // Pass invoice number
      );
      if (supaResult) inv.id = supaResult.id;
    }
  } catch (err) {
    console.warn('[Billing] Supabase save failed (using localStorage):', err);
  }

  S.invoices.push(inv);
  await saveData();
  showToast(`ออกใบเสร็จ ${no} แล้ว`);

  /* Reset billing state */
  bItems = []; bKey = 0; bDisc = 0; bVat = false; bJobId = null;
  renderNav();
  renderPanel();
  showDoc('inv', inv);
}

/* ══════════════════════════════════════
   SAVE QUOTATION
══════════════════════════════════════ */
async function saveQuote() {
  const { sub, vat, grand } = bCalc();
  if (!bItems.length || grand <= 0) return;

  const no = nextSeqNo('qt').replace('qt-','QT-');
  const qt = {
    no, ts: Date.now(),
    cust:  sv('bCust'), phone: sv('bPhone'),
    plate: sv('bPlate'), model: sv('bModel'),
    ref:   sv('bRef'), note: sv('bNote'),
    items: bItems.map(it => ({
      name: it.nm||'-', unit: it.unit,
      qty: fmt(it.qty), price: it.price,
      cost: it.cost||0, itemType: it.itemType,
    })),
    sub, disc: bDisc, vat, grand, converted: false,
  };

  S.quotes.push(qt);
  await saveData();
  showToast(`ออกใบเสนอราคา ${no} แล้ว`);

  bItems = []; bKey = 0; bDisc = 0; bVat = false; bJobId = null;
  renderPanel();
  showDoc('qt', qt);
}

/* ══════════════════════════════════════
   OPEN BILLING FROM JOB
   โหลดรายการจากใบเบิกเข้าบิลอัตโนมัติ
══════════════════════════════════════ */
function openBillFromJob(jid) {
  const j = S.jobs.find(x => x.id === jid);
  if (!j) return;

  /* Reset billing state */
  bItems = []; bKey = 0; bDisc = 0; bVat = false;
  bJobId = jid;

  /* Pre-fill from requisitions */
  const reqs = S.requisitions.filter(r => r.jobId === jid);
  reqs.forEach(r => {
    r.items.forEach(it => {
      if (it.sid) {
        const m = S.stockItems.find(x => x.id === it.sid);
        if (m) bItems.push({
          k: ++bKey, sid: it.sid, nm: it.name,
          unit: it.unit, qty: it.qty,
          price: m.sell, itemType: 'stock', cost: m.cost,
        });
      }
    });
  });

  /* Navigate to billing tab */
  currentTab = 'billing';
  renderNav();
  renderPanel();

  /* Auto-fill customer / vehicle fields */
  setTimeout(() => {
    const fill = (id, val) => { const el = sel(id); if (el) el.value = val || ''; };
    fill('bCust',  j.custName);
    fill('bPlate', j.plate);
    fill('bModel', j.carModel);
    fill('bMile',  j.mileage || '');
  }, 50);
}
