/* ============================================================
   DOCS.JS — Document renderer (ใบเสร็จ / ใบเสนอราคา)
   ────────────────────────────────────────────
   ใช้ print.css สำหรับสไตล์ทุกอย่าง
   ฟังก์ชันหลัก: showDoc(type, data)
   ============================================================ */

/* ══════════════════════════════════════
   LOGO + SHOP INFO (ใช้ซ้ำทุกเอกสาร)
══════════════════════════════════════ */
function docLogoHTML() {
  const s = S.shop;
  return `
    <div class="doc-logo">
      <!-- TBR logo box -->
      <div class="doc-lb">
        <div style="text-align:center">
          <div class="doc-tbr">TBR<span>.</span></div>
          <div class="doc-bull">TOP BULL RACE</div>
        </div>
      </div>
      <!-- Shop info -->
      <div class="doc-si">
        <div class="doc-sn">${esc(s.name || 'TBR Performance')}</div>
        <div class="doc-ss">
          ${esc(s.addr || '')}
          ${s.phone ? '<br>โทร ' + esc(s.phone) : ''}
          ${s.tax   ? '<br>เลขประจำตัวผู้เสียภาษี: ' + esc(s.tax) : ''}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   MAIN: showDoc
   type: 'inv' | 'qt'
══════════════════════════════════════ */
function showDoc(type, data) {
  const ov  = sel('dOv');
  let dc    = '';
  let acts  = '';

  if (type === 'inv') {
    dc   = buildInvoiceHTML(data);
    acts = buildInvoiceActions(data);
  } else if (type === 'qt') {
    dc   = buildQuoteHTML(data);
    acts = buildQuoteActions(data);
  }

  ov.innerHTML = `
    <div style="width:min(780px,100%);animation:pop .18s ease">
      ${dc}
      ${acts}
    </div>`;

  openOv('dOv');
  bindDocActions(type, data, dc);
}

/* ══════════════════════════════════════
   INVOICE HTML
══════════════════════════════════════ */
function buildInvoiceHTML(d) {
  const s        = S.shop;
  const nextMile = d.mileage
    ? (parseInt(String(d.mileage).replace(/\D/g,'')) + 10000).toLocaleString('th-TH')
    : null;

  /* ราคาในใบเสร็จ — ปัดเป็นจำนวนเต็ม */
  const R = n => '฿' + Math.round(n).toLocaleString('th-TH');

  /* Item rows — fill to min 8 rows */
  const itemRows = (d.items || []).map((it, i) => `
      <tr>
        <td class="c" style="color:#888">${i+1}</td>
        <td>${esc(it.name)}</td>
        <td class="r" style="white-space:nowrap">${numFmt(it.qty)}${it.unit ? '\u00a0'+esc(it.unit) : ''}</td>
        <td class="r">—</td>
        <td class="r">${R(it.price)}</td>
        <td class="r" style="font-weight:700">${R(it.qty * it.price)}</td>
      </tr>`).join('');

  const blankRows = Array(Math.max(0, 8 - (d.items || []).length))
    .fill('<tr><td class="c" style="color:#ddd">·</td><td></td><td></td><td></td><td></td><td></td></tr>')
    .join('');

  const noteBox = d.note
    ? `<div style="background:#fffbf0;border:1px solid #ffd47a;border-radius:6px;
                   padding:8px 11px;font-size:.76rem;color:#7a5500;margin-bottom:10px">
         หมายเหตุ: ${esc(d.note)}
       </div>`
    : '';

  return `
    <div class="doc">
      <!-- Header -->
      <div class="doc-hd">
        ${docLogoHTML()}
        <div class="doc-ta">
          <div class="doc-tt">ใบเสร็จรับเงิน</div>
          <div class="doc-te">RECEIPT / TAX INVOICE</div>
        </div>
      </div>
      <div class="doc-stripe"></div>

      <!-- Body -->
      <div class="doc-bd">
        <!-- Reference row -->
        <div class="doc-ref">
          <span>เลขที่: <b>${d.no}</b></span>
          ${d.ref ? `<span>อ้างอิง: <b>${esc(d.ref)}</b></span>` : ''}
          <span>วันที่: <b>${dateStr(d.ts)} ${timeStr(d.ts)}</b></span>
          <span style="background:${d.paid ? '#d4edda' : '#f8d7da'};color:${d.paid ? '#155724' : '#721c24'};
                      padding:2px 8px;border-radius:99px;font-size:.7rem;font-weight:700">
            ${d.paid ? '✓ ชำระแล้ว' : '● ค้างชำระ'}
          </span>
        </div>

        <!-- Customer + Vehicle boxes -->
        <div class="doc-2col">
          <div class="doc-box">
            <div class="lbl">ลูกค้า / Customer</div>
            <div class="nm">${esc(d.cust || 'ลูกค้าทั่วไป')}</div>
            <div class="sb">${esc(d.phone || '')}</div>
          </div>
          <div class="doc-box">
            <div class="lbl">รถ / Vehicle</div>
            <div class="nm">${esc(d.plate || '—')}</div>
            <div class="sb">
              ${esc(d.model || '')}
              ไมล์: ${d.mileage
                ? parseInt(String(d.mileage).replace(/\D/g,'')).toLocaleString('th-TH')+' กม.'
                : '—'}
              ${nextMile ? `<br>นัดครั้งต่อไป ~<b>${nextMile} กม.</b>` : ''}
            </div>
          </div>
        </div>

        <!-- Items table -->
        <table class="dt">
          <thead>
            <tr>
              <th style="width:24px">ลำดับ</th>
              <th>รายการ / Description</th>
              <th class="r" style="width:55px">จำนวน</th>
              <th class="r" style="width:50px">ส่วนลด</th>
              <th class="r" style="width:82px">ราคา/หน่วย</th>
              <th class="r" style="width:82px">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>${itemRows}${blankRows}</tbody>
        </table>

        ${noteBox}

        <!-- Totals -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div class="doc-words">(${bahtWords(d.grand)})</div>
          <div style="display:flex;justify-content:flex-end">
            <div class="doc-sum-box">
              <div class="dsr"><span>จำนวนเงิน</span><span>${R(d.sub)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${d.disc > 0 ? R(d.disc) : '—'}</span></div>
              <div class="dsr"><span>หลังหักส่วนลด</span><span>${R(Math.max(0, d.sub - d.disc))}</span></div>
              <div class="dsr"><span>Vat 7%</span><span>${d.vat > 0 ? R(d.vat) : '—'}</span></div>
              <div class="dsr tot">
                <span class="lbl">จำนวนเงินทั้งสิ้น</span>
                <span class="lv">${R(d.grand)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Signatures -->
        <div class="doc-sigs">
          <div class="doc-sig"><div class="line">ผู้รับเงิน<div class="dt2">วันที่………………………</div></div></div>
          <div class="doc-sig"><div class="line">ผู้ตรวจสอบ<div class="dt2">วันที่………………………</div></div></div>
          <div class="doc-sig"><div class="line">ผู้มีอำนาจลงนาม<div class="dt2">วันที่………………………</div></div></div>
        </div>

        <div class="doc-foot">${esc(s.note || 'ขอบคุณที่ใช้บริการ')}</div>
      </div>
    </div>`;
}

function buildInvoiceActions(d) {
  const paidBtn = d.paid
    ? `<span style="background:#d4edda;color:#155724;padding:6px 14px;border-radius:8px;font-size:.84rem;font-weight:600">
         ✓ ชำระแล้ว
       </span>`
    : `<button class="btn-cdoc" id="dPaid" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7">
         ${svgI('<path d="M20 6 9 17l-5-5"/>')} ชำระแล้ว
       </button>`;
  return `
    <div class="doc-acts">
      <button class="btn-cdoc" id="dCl">
        ${svgI('<path d="M18 6 6 18M6 6l12 12"/>')} ปิด
      </button>
      <button class="btn-cdoc" id="dDel"
        style="background:#fde8e8;color:var(--bad)">
        ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')} ลบบิล
      </button>
      <button class="btn-cdoc" id="dEditBill"
        style="background:#fff8e1;color:#f57f17;border-color:#ffe082">
        ${svgI('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')} แก้ไขบิล
      </button>
      ${paidBtn}
      <button class="btn-cdoc" id="dTax"
        style="background:#e3f2fd;color:#1565c0;border-color:#90caf9">
        ${svgI('<path d="M9 12h6M9 16h6M9 8h2M14 2v6h6"/><path d="M4 2h10l6 6v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>')}
        ใบกำกับภาษี
      </button>
      <button class="btn-prt" id="dPr">
        ${svgI('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>')}
        พิมพ์ใบเสร็จ
      </button>
    </div>`;
}

/* ══════════════════════════════════════
   TAX INVOICE (ใบกำกับภาษีเต็มรูป)
══════════════════════════════════════ */
const TAX_BUYERS_KEY = 'tbr-tax-buyers';

function loadTaxBuyers() {
  try { return JSON.parse(localStorage.getItem(TAX_BUYERS_KEY)) || {}; }
  catch { return {}; }
}
function saveTaxBuyer(key, buyer) {
  if (!key) return;
  const all = loadTaxBuyers();
  all[key] = buyer;
  try { localStorage.setItem(TAX_BUYERS_KEY, JSON.stringify(all)); } catch {}
}

function openTaxInvoiceModal(d) {
  const ov    = sel('mOv');
  const saved = loadTaxBuyers()[d.cust] || {};

  ov.innerHTML = `
    <div class="modal md">
      <div class="modal-h">
        <h3>ออกใบกำกับภาษี — ${d.no}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div style="font-size:.8rem;color:var(--fg2);margin-bottom:12px">
          กรอกข้อมูลผู้ซื้อสำหรับใบกำกับภาษีเต็มรูป (ระบบจะจำไว้ครั้งถัดไป)
        </div>
        <div class="fld mb12">
          <label>ชื่อผู้ซื้อ / บริษัท *</label>
          <input id="txName" value="${esc(saved.name || d.cust || '')}" placeholder="ชื่อ-นามสกุล หรือ ชื่อบริษัท">
        </div>
        <div class="fld mb12">
          <label>ที่อยู่ผู้ซื้อ *</label>
          <textarea id="txAddr" rows="2" placeholder="บ้านเลขที่ / ถนน / ตำบล / อำเภอ / จังหวัด / รหัสไปรษณีย์">${esc(saved.address || '')}</textarea>
        </div>
        <div class="fgrid c2 mb12">
          <div class="fld">
            <label>เลขประจำตัวผู้เสียภาษี (13 หลัก) *</label>
            <input id="txTax" value="${esc(saved.taxId || '')}" maxlength="17" inputmode="numeric" placeholder="0-0000-00000-00-0">
          </div>
          <div class="fld">
            <label>สำนักงาน</label>
            <select id="txBranch" style="width:100%;background:var(--ink);border:1px solid var(--ln2);
                    color:var(--fg);border-radius:8px;padding:9px 11px;font-size:.88rem;outline:none">
              <option value="สำนักงานใหญ่" ${(saved.branch||'สำนักงานใหญ่')==='สำนักงานใหญ่'?'selected':''}>สำนักงานใหญ่</option>
              <option value="สาขา" ${saved.branch && saved.branch!=='สำนักงานใหญ่'?'selected':''}>สาขา…</option>
            </select>
          </div>
        </div>
        <div class="fld" id="txBranchNoWrap" style="display:${saved.branch && saved.branch!=='สำนักงานใหญ่'?'block':'none'}">
          <label>เลขที่สาขา</label>
          <input id="txBranchNo" value="${esc(saved.branch && saved.branch!=='สำนักงานใหญ่' ? saved.branch.replace(/\D/g,'') : '')}" placeholder="เช่น 00001">
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold" id="txOk">${svgI('<path d="M20 6 9 17l-5-5"/>')} สร้างใบกำกับภาษี</button>
      </div>
    </div>`;

  openOv('mOv');
  bindModalClose(ov, '#mCl', '#mCl2');

  ov.querySelector('#txBranch').addEventListener('change', e => {
    sel('txBranchNoWrap').style.display = e.target.value === 'สำนักงานใหญ่' ? 'none' : 'block';
  });

  ov.querySelector('#txOk').addEventListener('click', () => {
    const name = sv('txName').trim();
    const addr = sv('txAddr').trim();
    const taxId = sv('txTax').trim();
    if (!name)  return showToast('กรุณากรอกชื่อผู้ซื้อ', 'err');
    if (!addr)  return showToast('กรุณากรอกที่อยู่ผู้ซื้อ', 'err');
    if (taxId.replace(/\D/g, '').length !== 13)
      return showToast('เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก', 'err');

    const branchSel = sv('txBranch');
    const branch = branchSel === 'สำนักงานใหญ่'
      ? 'สำนักงานใหญ่'
      : ('สาขา ' + (sv('txBranchNo').trim() || ''));

    const buyer = { name, address: addr, taxId, branch };
    saveTaxBuyer(d.cust, buyer);
    closeMod();
    showTaxDoc(d, buyer);
  });
}

function showTaxDoc(d, buyer) {
  const ov = sel('dOv');
  const dc = buildTaxInvoiceHTML(d, buyer);
  ov.innerHTML = `
    <div style="width:min(780px,100%);animation:pop .18s ease">
      ${dc}
      <div class="doc-acts">
        <button class="btn-cdoc" id="dCl2">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')} ปิด</button>
        <button class="btn-cdoc" id="dTaxBack" style="background:#e3f2fd;color:#1565c0;border-color:#90caf9">
          ${svgI('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')} แก้ไขข้อมูลผู้ซื้อ
        </button>
        <button class="btn-prt" id="dPrTax">
          ${svgI('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>')}
          พิมพ์ใบกำกับภาษี
        </button>
      </div>
    </div>`;
  openOv('dOv');
  ov.querySelector('#dCl2').addEventListener('click', closeDoc);
  ov.querySelector('#dTaxBack').addEventListener('click', () => openTaxInvoiceModal(d));
  ov.querySelector('#dPrTax').addEventListener('click', () => {
    document.getElementById('pz').innerHTML = dc;
    window.print();
    setTimeout(() => { document.getElementById('pz').innerHTML = ''; }, 600);
  });
}

function buildTaxInvoiceHTML(d, buyer) {
  const s = S.shop;
  const R = n => '฿' + Math.round(n).toLocaleString('th-TH');
  const Rd = n => '฿' + (Math.round(n * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 });

  /* แยกฐานภาษีและ VAT ให้ยอดลงตัวเสมอ (ผลรวมแยก VAT = ยอดสุทธิจริง)
     - บิลคิด VAT: ฐาน = ยอดสินค้า − ส่วนลด, VAT = ยอดสุทธิ − ฐาน
     - บิลไม่คิด VAT: ถือว่าราคารวม VAT แล้ว (VAT-inclusive) ถอด 7% ออกจากยอดสุทธิ */
  const hasVat   = (d.vat || 0) > 0;
  const total    = d.grand;
  const subTotal = (d.sub || 0);
  const discAmt  = (d.disc || 0);
  const preVat   = hasVat ? Math.max(0, subTotal - discAmt) : (total / 1.07);
  const vatAmt   = Math.max(0, total - preVat);
  const showDisc = hasVat && discAmt > 0;

  const itemRows = (d.items || []).map((it, i) => `
      <tr>
        <td class="c" style="color:#888">${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="r" style="white-space:nowrap">${numFmt(it.qty)}${it.unit ? '\u00a0' + esc(it.unit) : ''}</td>
        <td class="r">${R(it.price)}</td>
        <td class="r" style="font-weight:700">${R(it.qty * it.price)}</td>
      </tr>`).join('');

  const blankRows = Array(Math.max(0, 8 - (d.items || []).length))
    .fill('<tr><td class="c" style="color:#ddd">·</td><td></td><td></td><td></td><td></td></tr>')
    .join('');

  return `
    <div class="doc">
      <div class="doc-hd">
        ${docLogoHTML()}
        <div class="doc-ta">
          <div class="doc-tt">ใบกำกับภาษี</div>
          <div class="doc-te">TAX INVOICE / ใบเสร็จรับเงิน</div>
        </div>
      </div>
      <div class="doc-stripe"></div>

      <div class="doc-bd">
        <div class="doc-ref">
          <span>เลขที่: <b>${d.no}</b></span>
          <span>วันที่: <b>${dateStr(d.ts)}</b></span>
          <span>สำนักงานผู้ขาย: <b>สำนักงานใหญ่</b></span>
        </div>

        <!-- Buyer box -->
        <div class="doc-box" style="margin-bottom:12px">
          <div class="lbl">ลูกค้า / ผู้ซื้อ (Customer)</div>
          <div class="nm">${esc(buyer.name)}</div>
          <div class="sb" style="white-space:pre-line">${esc(buyer.address)}</div>
          <div class="sb">
            เลขประจำตัวผู้เสียภาษี: <b>${esc(buyer.taxId)}</b>
            &nbsp;·&nbsp; ${esc(buyer.branch || 'สำนักงานใหญ่')}
          </div>
          ${d.plate ? `<div class="sb">รถ: ${esc(d.plate)} ${esc(d.model || '')}</div>` : ''}
        </div>

        <table class="dt">
          <thead>
            <tr>
              <th style="width:24px">ลำดับ</th>
              <th>รายการ / Description</th>
              <th class="r" style="width:55px">จำนวน</th>
              <th class="r" style="width:90px">ราคา/หน่วย</th>
              <th class="r" style="width:90px">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>${itemRows}${blankRows}</tbody>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px">
          <div class="doc-words">(${bahtWords(total)})</div>
          <div style="display:flex;justify-content:flex-end">
            <div class="doc-sum-box">
              ${showDisc ? `
              <div class="dsr"><span>มูลค่าสินค้า/บริการ</span><span>${Rd(subTotal)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${Rd(discAmt)}</span></div>
              <div class="dsr"><span>มูลค่าหลังหักส่วนลด</span><span>${Rd(preVat)}</span></div>` : `
              <div class="dsr"><span>มูลค่าสินค้า/บริการ</span><span>${Rd(preVat)}</span></div>`}
              <div class="dsr"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${Rd(vatAmt)}</span></div>
              <div class="dsr tot">
                <span class="lbl">จำนวนเงินรวมทั้งสิ้น</span>
                <span class="lv">${R(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="doc-sigs">
          <div class="doc-sig"><div class="line">ผู้รับเงิน<div class="dt2">วันที่………………………</div></div></div>
          <div class="doc-sig"><div class="line">ผู้รับสินค้า/บริการ<div class="dt2">วันที่………………………</div></div></div>
          <div class="doc-sig"><div class="line">ผู้มีอำนาจลงนาม<div class="dt2">วันที่………………………</div></div></div>
        </div>

        <div class="doc-foot">เอกสารออกเป็นชุด / ต้นฉบับ (Original) · ${esc(s.note || 'ขอบคุณที่ใช้บริการ')}</div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   QUOTATION HTML
══════════════════════════════════════ */
function buildQuoteHTML(d) {
  const expD = new Date((d.ts || Date.now()) + 7 * 86400000);
  const R = n => '฿' + Math.round(n).toLocaleString('th-TH');

  const itemRows = (d.items || []).map((it, i) => `
    <tr>
      <td class="c" style="color:#888">${i+1}</td>
      <td>${esc(it.name)}</td>
      <td class="r" style="white-space:nowrap">${numFmt(it.qty)}${it.unit ? '\u00a0'+esc(it.unit) : ''}</td>
      <td class="r">—</td>
      <td class="r">${R(it.price)}</td>
      <td class="r" style="font-weight:700">${R(it.qty * it.price)}</td>
    </tr>`).join('');

  const blankRows = Array(Math.max(0, 8 - (d.items || []).length))
    .fill('<tr><td class="c" style="color:#ddd">·</td><td></td><td></td><td></td><td></td><td></td></tr>')
    .join('');

  return `
    <div class="doc">
      <div class="doc-hd">
        ${docLogoHTML()}
        <div class="doc-ta">
          <div class="doc-tt">ใบเสนอราคา</div>
          <div class="doc-te">QUOTATION</div>
        </div>
      </div>
      <div class="doc-stripe"></div>
      <div class="doc-bd">
        <div class="doc-ref">
          <span>เลขที่: <b>${d.no}</b></span>
          ${d.ref ? `<span>อ้างอิง: <b>${esc(d.ref)}</b></span>` : ''}
          <span>วันที่: <b>${dateStr(d.ts)}</b></span>
          <span>ใช้ได้ถึง: <b>${dateStr(expD.getTime())}</b></span>
        </div>

        <div class="doc-2col">
          <div class="doc-box">
            <div class="lbl">เสนอให้ / To</div>
            <div class="nm">${esc(d.cust || '—')}</div>
            <div class="sb">${esc(d.phone || '')}</div>
          </div>
          <div class="doc-box">
            <div class="lbl">รถ / Vehicle</div>
            <div class="nm">${esc(d.plate || '—')}</div>
            <div class="sb">${esc(d.model || '')}</div>
          </div>
        </div>

        <table class="dt">
          <thead>
            <tr>
              <th style="width:24px">ลำดับ</th><th>รายการ</th>
              <th class="r">จำนวน</th><th class="r">ส่วนลด</th>
              <th class="r">ราคา/หน่วย</th><th class="r">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>${itemRows}${blankRows}</tbody>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div class="doc-words">(${bahtWords(d.grand)})</div>
            ${d.note ? `<div style="font-size:.76rem;color:#7a5500;margin-top:6px">เงื่อนไข: ${esc(d.note)}</div>` : ''}
          </div>
          <div style="display:flex;justify-content:flex-end">
            <div class="doc-sum-box">
              <div class="dsr"><span>ยอดรวม</span><span>${R(d.sub)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${d.disc > 0 ? R(d.disc) : '—'}</span></div>
              <div class="dsr"><span>VAT 7%</span><span>${d.vat > 0 ? R(d.vat) : '—'}</span></div>
              <div class="dsr tot"><span class="lbl">รวมสุทธิ</span><span class="lv">${R(d.grand)}</span></div>
            </div>
          </div>
        </div>

        <div class="doc-sigs">
          <div class="doc-sig"><div class="line">ผู้เสนอราคา<div class="dt2">วันที่………………………</div></div></div>
          <div class="doc-sig"><div class="line">ผู้อนุมัติ<div class="dt2">วันที่………………………</div></div></div>
          <div class="doc-sig"><div class="line">ลูกค้าตอบรับ<div class="dt2">วันที่………………………</div></div></div>
        </div>
      </div>
    </div>`;
}

function buildQuoteActions(d) {
  const convertBtn = !d.converted
    ? `<button class="btn-cvt" id="dCv">
         ${svgI('<path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 12h6"/>')} แปลงเป็นบิล
       </button>`
    : `<span style="color:var(--grn);font-size:.84rem">✓ แปลงเป็นบิลแล้ว</span>`;

  return `
    <div class="doc-acts">
      <button class="btn-cdoc" id="dCl">ปิด</button>
      ${convertBtn}
      <button class="btn-prt" id="dPr">พิมพ์ใบเสนอราคา</button>
    </div>`;
}

/* ══════════════════════════════════════
   BIND DOC ACTIONS
══════════════════════════════════════ */
function bindDocActions(type, data, dc) {
  const ov = sel('dOv');

  /* Close */
  ov.querySelector('#dCl')?.addEventListener('click', closeDoc);

  /* Print */
  ov.querySelector('#dPr')?.addEventListener('click', () => {
    document.getElementById('pz').innerHTML = dc;
    window.print();
    setTimeout(() => { document.getElementById('pz').innerHTML = ''; }, 600);
  });

  /* Tax invoice (ใบกำกับภาษีเต็มรูป) */
  ov.querySelector('#dTax')?.addEventListener('click', () => openTaxInvoiceModal(data));

  /* Edit invoice — load into billing form */
  ov.querySelector('#dEditBill')?.addEventListener('click', () => {
    const inv = S.invoices.find(x => x.no === data.no);
    if (!inv) return;

    // โหลด items กลับเข้าฟอร์ม billing
    bItems = (inv.items || []).map(it => ({
      k: ++bKey,
      sid:      it.sid || null,
      nm:       it.name || '',
      unit:     it.unit || '',
      qty:      it.qty  || 1,
      price:    it.price || 0,
      itemType: it.itemType || 'other',
      cost:     it.cost || 0,
    }));
    bDisc      = inv.disc || 0;
    bVat       = (inv.vat || 0) > 0;
    bJobId     = inv.jobId || null;
    bEditInvNo = inv.no;
    bEditData  = {
      cust:    inv.cust    || '',
      phone:   inv.phone   || '',
      plate:   inv.plate   || '',
      model:   inv.model   || '',
      mileage: inv.mileage || '',
      ref:     inv.ref     || '',
      note:    inv.note    || '',
    };

    closeDoc();
    currentTab = 'billing';
    renderNav();
    renderPanel();
    showToast(`แก้ไขบิล ${inv.no} — แก้รายการแล้วกด บันทึกการแก้ไข`, 'inf');
  });

  /* Mark as paid */
  ov.querySelector('#dPaid')?.addEventListener('click', async () => {
    const inv = S.invoices.find(x => x.no === data.no);
    if (!inv) return;
    inv.paid = true;
    if (useSupabase && inv.id && typeof updateInvoicePaid === 'function') {
      updateInvoicePaid(inv.id, true).catch(e => console.warn('[Docs] paid sync:', e));
    }
    await saveData();
    closeDoc();
    renderPanel();
    showToast(`บิล ${data.no} ชำระแล้ว ✓`, 'ok');
  });

  /* Delete invoice */
  ov.querySelector('#dDel')?.addEventListener('click', async () => {
    if (type !== 'inv') return;
    if (!confirm(`ลบใบเสร็จ ${data.no}?\n\n⚠ สต๊อกที่ตัดไปแล้วจะถูกคืนกลับ`)) return;

    /* Delete from Supabase first */
    try {
      if (useSupabase && data.id && typeof deleteInvoice === 'function') {
        await deleteInvoice(data.id);
      }
    } catch (err) {
      console.warn('[Docs] Supabase deleteInvoice failed:', err);
    }

    /* Restore stock */
    (data.items || []).forEach(it => {
      if (it.sid && it.itemType === 'stock') {
        const m = S.stockItems.find(x => x.id === it.sid);
        if (m) {
          m.qty  = fmt(m.qty  + it.qty);
          m.used = fmt(Math.max(0, (m.used||0) - it.qty));
        }
      }
    });

    /* Reopen job */
    if (data.jobId) {
      const j = S.jobs.find(x => x.id === data.jobId);
      if (j && j.status === 5) j.status = 4;
    }

    S.invoices = S.invoices.filter(x => x.no !== data.no);
    await saveData();
    closeDoc();
    renderNav();
    renderPanel();
    showToast(`ลบใบเสร็จ ${data.no} แล้ว · คืนสต๊อกเรียบร้อย`, 'inf');
  });

  /* Convert quotation → invoice */
  ov.querySelector('#dCv')?.addEventListener('click', async () => {
    const q = S.quotes.find(x => x.no === data.no);
    if (!q) return;

    q.converted = true;

    // Update converted status in Supabase
    if (useSupabase && q.id && typeof updateQuote === 'function') {
      const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (_uuidRe.test(q.id)) {
        updateQuote(q.id, { converted: true }).catch(e => console.warn('[Quote] Supabase convert failed:', e));
      }
    }

    /* Load QT items into billing */
    bItems = data.items.map(it => ({
      k: ++bKey, sid: null, nm: it.name, unit: it.unit,
      qty: it.qty, price: it.price,
      itemType: it.itemType || 'other', cost: it.cost || 0,
    }));
    bDisc  = data.disc  || 0;
    bVat   = (data.vat  || 0) > 0;
    bJobId = null;

    await saveData();
    closeDoc();
    currentTab = 'billing';
    renderNav();
    renderPanel();
    showToast('แปลงใบเสนอราคาเป็นบิลแล้ว — ตรวจสอบก่อนบันทึก');
  });

  /* Close on backdrop click */
  ov.addEventListener('click', e => {
    if (e.target === ov) closeDoc();
  });
}
