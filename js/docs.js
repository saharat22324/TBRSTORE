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

  /* Item rows — fill to min 8 rows */
  const itemRows = d.items.map((it, i) => {
    const typeNote =
      it.itemType === 'order'   ? ` <span style="font-size:.65rem;color:#C9850D">(อะไหล่)</span>` :
      it.itemType === 'service' ? ` <span style="font-size:.65rem;color:#9b59b6">(บริการ)</span>`      : '';
    return `
      <tr>
        <td class="c" style="color:#888">${i+1}</td>
        <td>${esc(it.name)}${typeNote}</td>
        <td class="r">${numFmt(it.qty)}${it.unit ? ' '+esc(it.unit) : ''}</td>
        <td class="r">—</td>
        <td class="r">${THB(it.price)}</td>
        <td class="r" style="font-weight:700">${THB(it.qty * it.price)}</td>
      </tr>`;
  }).join('');

  const blankRows = Array(Math.max(0, 8 - d.items.length))
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
              <div class="dsr"><span>จำนวนเงิน</span><span>${THB(d.sub)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${d.disc > 0 ? THB(d.disc) : '—'}</span></div>
              <div class="dsr"><span>หลังหักส่วนลด</span><span>${THB(Math.max(0, d.sub - d.disc))}</span></div>
              <div class="dsr"><span>Vat 7%</span><span>${d.vat > 0 ? THB(d.vat) : '—'}</span></div>
              <div class="dsr tot">
                <span class="lbl">จำนวนเงินทั้งสิ้น</span>
                <span class="lv">${THB(d.grand)}</span>
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
  return `
    <div class="doc-acts">
      <button class="btn-cdoc" id="dCl">
        ${svgI('<path d="M18 6 6 18M6 6l12 12"/>')} ปิด
      </button>
      <button class="btn-cdoc" id="dDel"
        style="background:#fde8e8;color:var(--bad)">
        ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')} ลบบิล
      </button>
      <button class="btn-prt" id="dPr">
        ${svgI('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>')}
        พิมพ์ใบเสร็จ
      </button>
    </div>`;
}

/* ══════════════════════════════════════
   QUOTATION HTML
══════════════════════════════════════ */
function buildQuoteHTML(d) {
  const expD = new Date((d.ts || Date.now()) + 7 * 86400000);

  const itemRows = d.items.map((it, i) => `
    <tr>
      <td class="c" style="color:#888">${i+1}</td>
      <td>${esc(it.name)}${it.itemType==='order'
        ? ` <span style="font-size:.65rem;color:#C9850D">(อะไหล่ +37%)</span>`
        : ''}</td>
      <td class="r">${numFmt(it.qty)}${it.unit ? ' '+esc(it.unit) : ''}</td>
      <td class="r">—</td>
      <td class="r">${THB(it.price)}</td>
      <td class="r" style="font-weight:700">${THB(it.qty * it.price)}</td>
    </tr>`).join('');

  const blankRows = Array(Math.max(0, 8 - d.items.length))
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
              <div class="dsr"><span>ยอดรวม</span><span>${THB(d.sub)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${d.disc > 0 ? THB(d.disc) : '—'}</span></div>
              <div class="dsr"><span>VAT 7%</span><span>${d.vat > 0 ? THB(d.vat) : '—'}</span></div>
              <div class="dsr tot"><span class="lbl">รวมสุทธิ</span><span class="lv">${THB(d.grand)}</span></div>
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

  /* Delete invoice */
  ov.querySelector('#dDel')?.addEventListener('click', async () => {
    if (type !== 'inv') return;
    if (!confirm(`ลบใบเสร็จ ${data.no}?\n\n⚠ สต๊อกที่ตัดไปแล้วจะถูกคืนกลับ`)) return;

    /* Restore stock */
    data.items.forEach(it => {
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
