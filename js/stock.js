/* ============================================================
   STOCK.JS — คลังสินค้า (Stock Items / ของเหลว TBR)
              ราคาขายกำหนดเอง ไม่ใช้ +37%
   ============================================================ */

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function stockHTML() {
  const low      = S.stockItems.filter(i => i.qty <= i.reorder && i.qty > 0).length;
  const out      = S.stockItems.filter(i => i.qty <= 0).length;
  const val      = S.stockItems.reduce((s, i) => s + i.qty * i.cost, 0);
  const lowItems = S.stockItems.filter(i => i.qty <= i.reorder);

  const alert = lowItems.length ? `
    <div class="alert al-warn mb14">
      ${svgI('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>')}
      <div>
        สินค้าถึงจุดสั่งซื้อ:
        <b>${lowItems.map(i => i.name).slice(0, 4).join(', ')}${lowItems.length > 4 ? ` และอีก ${lowItems.length-4} รายการ` : ''}</b>
      </div>
    </div>` : '';

  const rows = S.stockItems.map(i => {
    const st  = i.qty <= 0 ? 'bad' : i.qty <= i.reorder ? 'warn' : 'ok';
    const pct = Math.min(100, Math.round(i.qty / (i.reorder * 2.5) * 100));

    return `
      <tr>
        <td class="mono" style="font-size:.74rem;color:var(--teal)">${esc(i.id)}</td>
        <td>
          <div style="font-weight:600">${esc(i.name)}</div>
          <span class="tag-stock">${esc(i.cat)}</span>
        </td>
        <td class="c">
          <span class="badge b-${st}">${st==='bad'?'หมด':st==='warn'?'ใกล้หมด':'พอใช้'}</span>
        </td>
        <td class="r">
          <b style="font-family:'Saira Condensed',sans-serif;font-size:1.05rem">
            ${numFmt(i.qty)}
          </b>
          <span style="color:var(--fg2);font-size:.76rem"> ${esc(i.unit)}</span>
          <div class="sbar"><i class="${st!=='ok'?st:''}" style="width:${pct}%"></i></div>
        </td>
        <td class="r" style="font-size:.8rem;color:var(--fg2)">${numFmt(i.recv||0)}</td>
        <td class="r" style="font-size:.8rem;color:var(--fg2)">${numFmt(i.used||0)}</td>
        <td class="r" style="font-size:.84rem">${THB(i.cost)}</td>
        <td class="r"><b style="color:var(--gold)">${THB(i.sell)}</b></td>
        <td class="r" style="font-size:.82rem">${THB(i.qty * i.cost)}</td>
        <td class="c">
          <div class="flex gap6" style="justify-content:center">
            <button class="btn btn-xs"
              style="background:rgba(46,204,113,.14);color:var(--grn);border:1px solid rgba(46,204,113,.3)"
              data-sadj="${i.id}" data-st="in" title="รับสินค้าเข้า">
              +รับ
            </button>
            <button class="btn btn-xs"
              style="background:rgba(238,166,28,.14);color:var(--gold);border:1px solid rgba(238,166,28,.3)"
              data-sadj="${i.id}" data-st="count" title="ตั้งยอดจริง">
              ตั้งยอด
            </button>
            <button class="btn-icon" data-esi="${i.id}" title="แก้ไขรายการ">
              ${svgI('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',13)}
            </button>
            <button class="btn-icon" data-dsi="${i.id}" title="ลบรายการ"
              style="color:var(--bad);border-color:rgba(239,83,80,.3)">
              ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',13)}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="fjb mb16">
      <div>
        <h1 class="cond" style="font-size:1.5rem;font-weight:800;text-transform:uppercase">
          สต๊อกสินค้า
        </h1>
        <div style="font-size:.82rem;color:var(--fg2);margin-top:2px">
          Stock Items — ของเหลว TBR · ราคาขายกำหนดเอง
        </div>
      </div>
      <button class="btn btn-gold btn-sm" id="addStockBtn">
        ${svgI('<path d="M12 5v14M5 12h14"/>')} เพิ่มรายการ
      </button>
    </div>

    <!-- Stats -->
    <div class="g4 mb16">
      <div class="stat">
        <div class="sk">${svgI('<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/>')} รายการทั้งหมด</div>
        <div class="sv">${S.stockItems.length}<small style="font-size:.82rem;color:var(--fg2);font-weight:600"> SKU</small></div>
      </div>
      <div class="stat warn">
        <div class="sk">${svgI('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>')} ใกล้หมด</div>
        <div class="sv">${low}<small style="font-size:.82rem;color:var(--fg2);font-weight:600"> รายการ</small></div>
      </div>
      <div class="stat bad">
        <div class="sk">${svgI('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>')} หมดสต๊อก</div>
        <div class="sv">${out}<small style="font-size:.82rem;color:var(--fg2);font-weight:600"> รายการ</small></div>
      </div>
      <div class="stat gold">
        <div class="sk">${svgI('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')} มูลค่าคงคลัง</div>
        <div class="sv" style="font-size:1.4rem">${THB(val)}</div>
      </div>
    </div>

    ${alert}

    <!-- Stock table -->
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>รหัส</th>
            <th>ชื่อสินค้า</th>
            <th class="c">สถานะ</th>
            <th class="r">คงเหลือ</th>
            <th class="r">รับเข้า</th>
            <th class="r">ใช้ไป</th>
            <th class="r">ราคาทุน</th>
            <th class="r">ราคาขาย</th>
            <th class="r">มูลค่า</th>
            <th class="c">จัดการ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindStock() {
  sel('addStockBtn')?.addEventListener('click', () => openStockItemModal(null));

  document.querySelectorAll('[data-sadj]').forEach(b =>
    b.addEventListener('click', () => openStockAdj(b.dataset.sadj, b.dataset.st))
  );

  document.querySelectorAll('[data-esi]').forEach(b =>
    b.addEventListener('click', () => openStockItemModal(b.dataset.esi))
  );

  document.querySelectorAll('[data-dsi]').forEach(b =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const m = S.stockItems.find(i => i.id === b.dataset.dsi);
      if (!confirm(`ลบ "${m?.name}" ออกจากคลัง?`)) return;
      S.stockItems = S.stockItems.filter(i => i.id !== b.dataset.dsi);
      await saveData();
      renderPanel();
      renderNav();
      showToast('ลบรายการแล้ว');
    })
  );
}

/* ══════════════════════════════════════
   STOCK ADJUSTMENT MODAL (รับเข้า / ตั้งยอด)
══════════════════════════════════════ */
function openStockAdj(id, type) {
  const m  = S.stockItems.find(i => i.id === id);
  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal sm">
      <div class="modal-h">
        <h3>${type === 'in' ? 'รับสินค้าเข้าคลัง' : 'ตั้งยอดคงเหลือ'}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div style="font-size:.82rem;color:var(--fg2);margin-bottom:14px;
                    font-family:'JetBrains Mono',monospace">
          ${esc(m.name)}<br>คงเหลือ ${numFmt(m.qty)} ${m.unit}
        </div>
        <div class="fld mb12">
          <label>${type === 'in' ? 'จำนวนที่รับเข้า' : 'ยอดจริง'} (${m.unit})</label>
          <input id="aQty" type="number" min="0"
                 step="${m.unit === 'ลิตร' ? '0.5' : '1'}"
                 value="${type === 'count' ? numFmt(m.qty) : 1}"
                 style="font-size:1.15rem">
        </div>
        <div class="fld">
          <label>หมายเหตุ</label>
          <input id="aNote" placeholder="เลขบิล / ชื่อซัพพลายเออร์…">
        </div>
      </div>
      <div class="modal-f">
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold" id="mOk">${type === 'in' ? 'รับเข้า' : 'ตั้งยอด'}</button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const q = parseFloat(sv('aQty')) || 0;

    if (type === 'in') {
      m.qty  = fmt(m.qty + q);
      m.recv = fmt((m.recv || 0) + q);
    } else {
      const diff = q - m.qty;
      if (diff > 0)  m.recv = fmt((m.recv || 0) + diff);
      else           m.used = fmt((m.used || 0) + Math.abs(diff));
      m.qty = fmt(q);
    }

    await saveData();
    closeMod();
    renderPanel();
    renderNav();
    showToast(`${type === 'in' ? 'รับเข้า' : 'ตั้งยอด'} ${esc(m.name)} = ${numFmt(type==='in'?m.qty:q)} ${m.unit}`);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}

/* ══════════════════════════════════════
   STOCK ITEM MODAL (เพิ่ม / แก้ไขรายการ)
══════════════════════════════════════ */
function openStockItemModal(id) {
  const m  = id ? S.stockItems.find(i => i.id === id) : null;
  const ov = sel('mOv');

  ov.innerHTML = `
    <div class="modal md">
      <div class="modal-h">
        <h3>${m ? 'แก้ไขรายการ' : 'เพิ่มสินค้าใหม่'}</h3>
        <button class="closex" id="mCl">${svgI('<path d="M18 6 6 18M6 6l12 12"/>')}</button>
      </div>
      <div class="modal-b">
        <div class="fgrid c2 mb12">
          <div class="fld">
            <label>รหัส SKU *</label>
            <input id="siId" value="${esc(m?.id||'')}" placeholder="S01">
          </div>
          <div class="fld">
            <label>หมวดหมู่</label>
            <input id="siCat" value="${esc(m?.cat||'')}" placeholder="น้ำมันเครื่อง / น้ำยา…">
          </div>
        </div>
        <div class="fld mb12">
          <label>ชื่อสินค้า *</label>
          <input id="siNm" value="${esc(m?.name||'')}" placeholder="น้ำมันเครื่อง 5W40 Diesel…">
        </div>
        <div class="fgrid c3 mb12">
          <div class="fld">
            <label>หน่วย</label>
            <input id="siUnit" value="${esc(m?.unit||'ลิตร')}">
          </div>
          <div class="fld">
            <label>ราคาทุน (฿)</label>
            <input id="siCost" type="number" min="0" value="${m?.cost||0}">
          </div>
          <div class="fld">
            <label>ราคาขาย (฿)</label>
            <input id="siSell" type="number" min="0" value="${m?.sell||0}">
            <div class="hint">กำหนดเองตามราคาจริง</div>
          </div>
        </div>
        <div class="fgrid c2">
          <div class="fld">
            <label>ยอดคงคลัง</label>
            <input id="siQty" type="number" step="0.5" value="${m ? numFmt(m.qty) : 0}">
          </div>
          <div class="fld">
            <label>จุดสั่งซื้อ (reorder point)</label>
            <input id="siRo" type="number" value="${m?.reorder||10}">
          </div>
        </div>
      </div>
      <div class="modal-f">
        ${m ? `
          <button class="btn btn-ghost" id="delSI"
            style="color:var(--bad);border-color:rgba(239,83,80,.3)">
            ลบรายการ
          </button>` : ''}
        <button class="btn btn-ghost" id="mCl2">ยกเลิก</button>
        <button class="btn btn-gold"  id="mOk">
          ${svgI('<path d="M20 6 9 17l-5-5"/>')} ${m ? 'บันทึก' : 'เพิ่ม'}
        </button>
      </div>
    </div>`;

  openOv('mOv');

  ov.querySelector('#mOk').addEventListener('click', async () => {
    const nId  = sv('siId').trim();
    const name = sv('siNm').trim();
    if (!nId || !name) return showToast('กรุณากรอกรหัสและชื่อสินค้า', 'err');

    const data = {
      id:      nId,
      cat:     sv('siCat') || 'ทั่วไป',
      name,
      unit:    sv('siUnit') || 'ชิ้น',
      cost:    parseFloat(sv('siCost')) || 0,
      sell:    parseFloat(sv('siSell')) || 0,
      qty:     parseFloat(sv('siQty')) || 0,
      reorder: parseFloat(sv('siRo'))  || 10,
      recv:    m?.recv ?? (parseFloat(sv('siQty')) || 0),
      used:    m?.used ?? 0,
    };

    if (m) {
      Object.assign(m, data);
    } else {
      S.stockItems.push(data);
    }

    await saveData();
    closeMod();
    renderPanel();
    renderNav();
    showToast(m ? 'อัปเดตแล้ว' : 'เพิ่มสินค้าแล้ว');
  });

  ov.querySelector('#delSI')?.addEventListener('click', async () => {
    if (!confirm('ลบรายการนี้?')) return;
    S.stockItems = S.stockItems.filter(x => x.id !== id);
    await saveData();
    closeMod();
    renderPanel();
    renderNav();
    showToast('ลบแล้ว');
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}
