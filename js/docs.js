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

function documentMoney(value, whole = false) {
  const amount = whole ? Math.round(Number(value) || 0) : fmt(Number(value) || 0);
  const formatted = Math.abs(amount).toLocaleString('th-TH', whole
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}฿${formatted}`;
}

function documentPrintMetaHTML(title, reference) {
  return `<div class="doc-print-meta">
    <span>${esc(title)} · ${esc(reference || '—')}</span>
    <span class="doc-print-page"></span>
  </div>`;
}

function addPdfPageFooters(pdf, documentElement) {
  const totalPages = pdf.internal.getNumberOfPages();
  const rawReference = documentElement.querySelector('.doc-ref b')?.textContent?.trim() || 'Document';
  const reference = rawReference.replace(/[^\x20-\x7E]/g, '') || 'Document';
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    pdf.setPage(pageNumber);
    pdf.setDrawColor(210, 210, 210);
    pdf.setLineWidth(0.2);
    pdf.line(12, pageHeight - 7, pageWidth - 12, pageHeight - 7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(reference, 12, pageHeight - 4);
    pdf.text(`Page ${pageNumber} / ${totalPages}`, pageWidth - 12, pageHeight - 4, { align: 'right' });
  }
}

async function printDocumentHTML(html) {
  const printZone = document.getElementById('pz');
  printZone.innerHTML = html;

  const cleanup = () => { printZone.innerHTML = ''; };
  window.addEventListener('afterprint', cleanup, { once: true });

  if (document.fonts?.ready) await document.fonts.ready;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.print();
}

function documentPdfFilename(type, data) {
  const prefix = type === 'tax' ? 'tax-invoice'
    : type === 'qt' ? 'quotation'
      : data.documentType === 'credit_note' ? 'credit-note'
        : data.documentType === 'debit_note' ? 'debit-note' : 'receipt';
  const reference = String(data.no || dateFmt()).replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  return `${prefix}-${reference}.pdf`;
}

async function downloadDocumentPdf(html, filename, button) {
  const originalButtonHTML = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = 'กำลังสร้าง PDF...';
  }

  const stage = document.createElement('div');
  stage.className = 'pdf-stage';
  stage.innerHTML = html;
  document.body.appendChild(stage);

  try {
    if (typeof window.html2pdf !== 'function') throw new Error('PDF library is unavailable');
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const documentElement = stage.querySelector('.doc');
    const worker = window.html2pdf().set({
      margin: [10, 12, 10, 12],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['tr', '.doc-summary', '.doc-sigs', '.doc-foot'],
      },
    }).from(documentElement).toPdf();
    const pdf = await worker.get('pdf');
    addPdfPageFooters(pdf, documentElement);
    pdf.save(filename);
    showToast('ดาวน์โหลด PDF แล้ว', 'ok');
  } catch (error) {
    console.error('[PDF] Generate failed:', error);
    showToast('สร้าง PDF อัตโนมัติไม่สำเร็จ · เปิดหน้าพิมพ์เพื่อบันทึกเป็น PDF แทน', 'err');
    printDocumentHTML(html);
  } finally {
    stage.remove();
    if (button) {
      button.disabled = false;
      button.innerHTML = originalButtonHTML;
    }
  }
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
  const isCancelled = d.status === 'cancelled';
  const documentType = d.documentType || 'invoice';
  const documentTitle = documentType === 'credit_note' ? 'ใบลดหนี้'
    : documentType === 'debit_note' ? 'ใบเพิ่มหนี้' : 'ใบเสร็จรับเงิน';
  const documentTitleEn = documentType === 'credit_note' ? 'CREDIT NOTE'
    : documentType === 'debit_note' ? 'DEBIT NOTE' : 'RECEIPT';
  const original = d.originalInvoiceId ? S.invoices.find(i => i.id === d.originalInvoiceId) : null;
  const nextMile = d.mileage
    ? (parseInt(String(d.mileage).replace(/\D/g,'')) + 10000).toLocaleString('th-TH')
    : null;

  const R = n => documentMoney(n);
  const taxableBase = fmt(Math.max(0, Number(d.sub || 0) - Number(d.disc || 0)));
  const vatAmount = fmt(Number(d.vat || 0));
  const hasVat = vatAmount > 0;
  const grandTotal = Number(d.grand || 0);
  const grandTotalDisplay = !hasVat && Number.isInteger(grandTotal)
    ? documentMoney(grandTotal, true)
    : R(grandTotal);

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
    <div class="doc" style="position:relative">
      ${documentPrintMetaHTML(documentTitle, d.no)}
      ${isCancelled ? `<div style="position:absolute;z-index:5;inset:42% 0 auto;text-align:center;
        transform:rotate(-18deg);font-size:4rem;font-weight:900;color:rgba(190,30,45,.18);pointer-events:none">ยกเลิก</div>` : ''}
      <!-- Header -->
      <div class="doc-hd">
        ${docLogoHTML()}
        <div class="doc-ta">
          <div class="doc-tt">${documentTitle}</div>
          <div class="doc-te">${documentTitleEn}</div>
        </div>
      </div>
      <div class="doc-stripe"></div>

      <!-- Body -->
      <div class="doc-bd">
        <!-- Reference row -->
        <div class="doc-ref">
          <span>เลขที่: <b>${d.no}</b></span>
          ${d.ref ? `<span>อ้างอิง: <b>${esc(d.ref)}</b></span>` : ''}
          ${original ? `<span>อ้างอิงเอกสารเดิม: <b>${esc(original.no)}</b></span>` : ''}
          <span>วันที่เอกสาร: <b>${dateStr(d.ts)}</b></span>
          <span style="background:${d.paid ? '#d4edda' : '#f8d7da'};color:${d.paid ? '#155724' : '#721c24'};
                      padding:2px 8px;border-radius:99px;font-size:.7rem;font-weight:700">
            ${isCancelled ? '✕ ยกเลิกแล้ว' : (documentType === 'credit_note' ? 'เอกสารลดหนี้' : (d.paid ? '✓ ชำระแล้ว' : '● ค้างชำระ'))}
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
        <div class="doc-summary" style="display:flex;justify-content:space-between;align-items:flex-end">
          <div class="doc-words">(${d.grand < 0 ? 'ลบ' : ''}${bahtWords(Math.abs(d.grand))})</div>
          <div style="display:flex;justify-content:flex-end">
            <div class="doc-sum-box">
              <div class="dsr"><span>จำนวนเงิน</span><span>${R(d.sub)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${d.disc > 0 ? R(d.disc) : '—'}</span></div>
              ${hasVat ? `
              <div class="dsr"><span>จำนวนเงินก่อน VAT 7%</span><span>${R(taxableBase)}</span></div>
              <div class="dsr"><span>VAT 7%</span><span>${R(vatAmount)}</span></div>` : `
              <div class="dsr"><span>จำนวนเงินหลังหักส่วนลด</span><span>${R(taxableBase)}</span></div>`}
              <div class="dsr tot">
                <span class="lbl">จำนวนเงินทั้งสิ้น</span>
                <span class="lv">${grandTotalDisplay}</span>
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
  const isCancelled = d.status === 'cancelled';
  const documentType = d.documentType || 'invoice';
  const isCredit = documentType === 'credit_note';
  const isAdjustment = isCredit || documentType === 'debit_note';
  const paidBtn = isCancelled || isCredit ? '' : `<button class="btn-cdoc" id="dPaid"
    style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7">
    ${svgI('<path d="M20 6 9 17l-5-5"/>')} ${d.paid || !hasPermission('canRecordPayment') ? 'ประวัติรับชำระ' : 'รับชำระเงิน'}
  </button>`;
  return `
    <div class="doc-acts">
      <button class="btn-cdoc" id="dCl">
        ${svgI('<path d="M18 6 6 18M6 6l12 12"/>')} ปิด
      </button>
      ${!isCancelled && hasPermission('canCancelInvoice') ? `<button class="btn-cdoc" id="dDel"
        style="background:#fde8e8;color:var(--bad)">
        ${svgI('<path d="M18 6 6 18M6 6l12 12"/>')} ยกเลิกบิล
      </button>` : ''}
      ${!isCancelled && !isAdjustment && hasPermission('canEditIssuedInvoice') ? `<button class="btn-cdoc" id="dEditBill"
        style="background:#fff8e1;color:#f57f17;border-color:#ffe082">
        ${svgI('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')} แก้ไขบิล
      </button>` : ''}
      ${paidBtn}
      ${!isCancelled && !isAdjustment && hasPermission('canCreateAdjustment') ? `<button class="btn-cdoc" id="dAdj"
        style="background:#f3e5f5;color:#6a1b9a;border-color:#ce93d8">
        ${svgI('<path d="M12 5v14M5 12h14"/>')} ลดหนี้ / เพิ่มหนี้
      </button>` : ''}
      ${!isCancelled && !isAdjustment ? `<button class="btn-cdoc" id="dTax"
        style="background:#e3f2fd;color:#1565c0;border-color:#90caf9">
        ${svgI('<path d="M9 12h6M9 16h6M9 8h2M14 2v6h6"/><path d="M4 2h10l6 6v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>')}
        ใบกำกับภาษี
      </button>` : ''}
      <button class="btn-pdf" id="dPdf">
        ${svgI('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')}
        ดาวน์โหลด PDF
      </button>
      <button class="btn-prt" id="dPr">
        ${svgI('<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>')}
        พิมพ์ใบเสร็จ
      </button>
    </div>`;
}

function invoicePaymentsFor(inv) {
  return (S.invoicePayments || []).filter(p => p.invoiceId === inv.id)
    .sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
}

function paymentWriteErrorMessage(error) {
  const message = String(error?.message || error || '');
  if (/exceeds outstanding balance/i.test(message)) return 'ยอดรับชำระเกินยอดคงเหลือ กรุณาโหลดข้อมูลใหม่';
  if (/cannot receive payment/i.test(message)) return 'บิลนี้ไม่สามารถรับชำระได้';
  if (/only admin|not permitted|permission|unauthorized/i.test(message)) return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการ';
  if (/already.*revers|reversed/i.test(message)) return 'รายการรับชำระนี้ถูกย้อนแล้ว';
  if (/request id.*reused|request id is required/i.test(message)) return 'ข้อมูลคำขอรับชำระไม่ตรงกัน กรุณาปิดหน้าต่างแล้วเปิดใหม่';
  return message.replace(/^.*?:\s*/, '').slice(0, 140) || 'ระบบไม่สามารถทำรายการได้';
}

function recalculateInvoicePaymentState(inv) {
  const active = invoicePaymentsFor(inv)
    .filter(payment => !payment.reversedAt)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  inv.paidAmount = fmt(active);
  inv.balance = fmt(Math.max(0, Number(inv.grand || 0) - active));
  inv.paid = Number(inv.grand || 0) > 0 && inv.balance <= .01;
  inv.status = inv.paid ? 'paid' : 'issued';
}

function openPaymentModal(inv) {
  const ov = sel('mOv');
  const paymentRequestId = crypto.randomUUID();
  const canRecord = hasPermission('canRecordPayment');
  const payments = invoicePaymentsFor(inv);
  const paid = payments.filter(p => !p.reversedAt).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, Number(inv.grand || 0) - paid);
  const methodName = { cash:'เงินสด', transfer:'โอนเงิน', promptpay:'พร้อมเพย์', card:'บัตร', other:'อื่น ๆ' };
  const rows = payments.length ? payments.map(p => `<div style="padding:8px 0;border-bottom:1px solid var(--ln);opacity:${p.reversedAt ? '.55' : '1'}">
    <div class="fjb"><b>${THB(p.amount)} · ${methodName[p.method] || esc(p.method)}</b><span>${dateStr(p.paidAt)}</span></div>
    <div style="font-size:.75rem;color:var(--fg2)">${esc(p.reference || p.note || '')}${p.reversedAt ? ` · ย้อนรายการ: ${esc(p.reversalReason)}` : ''}</div>
    ${!p.reversedAt && hasPermission('canReversePayment') ? `<button class="btn btn-sm btn-ghost" data-reverse-payment="${p.id}" style="margin-top:5px;color:var(--bad)">ย้อนรายการรับชำระ</button>` : ''}
  </div>`).join('') : '<div class="tbl-empty">ยังไม่มีรายการรับชำระ</div>';
  ov.innerHTML = `<div class="modal md"><div class="modal-h"><h3>การรับชำระ — ${esc(inv.no)}</h3><button class="closex" id="mCl">×</button></div>
    <div class="modal-b"><div class="fgrid c3 mb12"><div><small>ยอดเอกสาร</small><b class="money">${THB(inv.grand)}</b></div><div><small>รับแล้ว</small><b class="money fc-grn">${THB(paid)}</b></div><div><small>คงเหลือ</small><b class="money fc-bad">${THB(balance)}</b></div></div>
    ${balance > .01 && canRecord ? `<div class="fgrid c2 mb12"><div class="fld"><label>จำนวนเงิน *</label><input id="payAmt" type="number" min="0.01" max="${balance}" value="${balance}"></div><div class="fld"><label>วิธีชำระ</label><select id="payMethod"><option value="cash">เงินสด</option><option value="transfer">โอนเงิน</option><option value="promptpay">พร้อมเพย์</option><option value="card">บัตร</option><option value="other">อื่น ๆ</option></select></div></div><div class="fgrid c2 mb12"><div class="fld"><label>เลขอ้างอิง</label><input id="payRef"></div><div class="fld"><label>หมายเหตุ</label><input id="payNote"></div></div>` : ''}
    <h4 style="margin:12px 0 4px">ประวัติ</h4>${rows}</div><div class="modal-f"><button class="btn btn-ghost" id="mCl2">ปิด</button>${balance > .01 && canRecord ? '<button class="btn btn-gold" id="payOk">บันทึกรับชำระ</button>' : ''}</div></div>`;
  openOv('mOv');
  bindModalClose(ov, '#mCl', '#mCl2');
  ov.querySelector('#payOk')?.addEventListener('click', async () => {
    const button = ov.querySelector('#payOk');
    if (!button || button.disabled) return;
    const amount = Number(sv('payAmt'));
    if (!useSupabase || !inv.id) return showToast('ต้องเชื่อมต่อ Supabase เพื่อบันทึกรับชำระ', 'err');
    if (!(amount > 0) || amount > balance + .01) return showToast('จำนวนเงินไม่ถูกต้อง', 'err');
    button.disabled = true;
    button.textContent = 'กำลังบันทึก…';
    try {
      const payment = await recordInvoicePayment(inv.id, amount, sv('payMethod'), sv('payRef'), sv('payNote'), paymentRequestId);
      await syncRemoteData({ force: true });
      if (!(S.invoicePayments || []).some(item => item.id === payment.id)) {
        S.invoicePayments.push({ id: payment.id, invoiceId: payment.invoice_id, amount:Number(payment.amount), method:payment.method, reference:payment.reference||'', note:payment.note||'', paidAt:new Date(payment.paid_at).getTime(), reversedAt:null, reversalReason:'' });
      }
      recalculateInvoicePaymentState(inv);
      await saveData(); closeMod(); closeDoc(); renderPanel(); showToast('บันทึกรับชำระแล้ว', 'ok');
    } catch (error) {
      console.error('[Docs] payment recording failed:', error);
      showToast(`บันทึกรับชำระไม่สำเร็จ · ${paymentWriteErrorMessage(error)}`, 'err');
      button.disabled = false;
      button.textContent = 'บันทึกรับชำระ';
    }
  });
  ov.querySelectorAll('[data-reverse-payment]').forEach(btn => btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    const reason = prompt('ระบุเหตุผลย้อนรายการรับชำระ');
    if (!reason?.trim()) return;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'กำลังย้อนรายการ…';
    try {
      const reversed = await reverseInvoicePayment(btn.dataset.reversePayment, reason.trim());
      await syncRemoteData({ force: true });
      const payment = (S.invoicePayments || []).find(p => p.id === reversed.id);
      if (payment && !payment.reversedAt) {
        payment.reversedAt = new Date(reversed.reversed_at).getTime();
        payment.reversalReason = reversed.reversal_reason || reason.trim();
      }
      recalculateInvoicePaymentState(inv);
      await saveData(); closeMod(); closeDoc(); renderPanel(); showToast('ย้อนรายการรับชำระแล้ว', 'ok');
    } catch (error) {
      console.error('[Docs] payment reversal failed:', error);
      showToast(`ย้อนรายการไม่สำเร็จ · ${paymentWriteErrorMessage(error)}`, 'err');
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }));
}

function openAdjustmentModal(inv) {
  if (!hasPermission('canCreateAdjustment')) return showToast('ไม่มีสิทธิ์ออกใบลดหนี้หรือใบเพิ่มหนี้', 'err');
  const ov = sel('mOv');
  ov.innerHTML = `<div class="modal sm"><div class="modal-h"><h3>ออกเอกสารปรับปรุง — ${esc(inv.no)}</h3><button class="closex" id="mCl">×</button></div><div class="modal-b"><div class="fld mb12"><label>ประเภท</label><select id="adjType"><option value="credit_note">ใบลดหนี้</option><option value="debit_note">ใบเพิ่มหนี้</option></select></div><div class="fld mb12"><label>จำนวนเงิน *</label><input id="adjAmt" type="number" min="0.01" value="${Math.abs(inv.grand)}"></div><div class="fld"><label>เหตุผล *</label><textarea id="adjReason" rows="3"></textarea></div></div><div class="modal-f"><button class="btn btn-ghost" id="mCl2">ยกเลิก</button><button class="btn btn-gold" id="adjOk">ออกเอกสาร</button></div></div>`;
  openOv('mOv'); bindModalClose(ov, '#mCl', '#mCl2');
  ov.querySelector('#adjOk').addEventListener('click', async () => {
    const type=sv('adjType'), amount=Number(sv('adjAmt')), reason=sv('adjReason').trim();
    if (!reason || !(amount>0)) return showToast('กรอกจำนวนเงินและเหตุผลให้ครบ', 'err');
    if (!useSupabase || !inv.id) return showToast('ต้องเชื่อมต่อ Supabase', 'err');
    const note=await createAdjustmentNote(inv.id,type,amount,reason);
    if (!note) return showToast('ออกเอกสารไม่สำเร็จ', 'err');
    await syncRemoteData({force:true}); closeMod(); closeDoc(); renderPanel(); showToast(`ออก${type==='credit_note'?'ใบลดหนี้':'ใบเพิ่มหนี้'} ${note.invoice_number} แล้ว`, 'ok');
  });
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

function isValidThaiTaxId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 13) return false;
  const sum = digits.slice(0, 12).split('').reduce((total, digit, index) =>
    total + Number(digit) * (13 - index), 0);
  return Number(digits[12]) === ((11 - (sum % 11)) % 10);
}

function openTaxInvoiceModal(d) {
  const ov    = sel('mOv');
  const customer = S.customers.find(c => (c.name || '').trim() === (d.cust || '').trim());
  const branchNo = customer?.branchNo || '00000';
  const customerBuyer = customer ? {
    name: customer.companyName || customer.name || '',
    address: customer.billingAddress || customer.address || '',
    taxId: customer.taxId || '',
    branch: branchNo === '00000' ? 'สำนักงานใหญ่' : `สาขา ${branchNo}`,
  } : {};
  const saved = { ...customerBuyer, ...(loadTaxBuyers()[d.cust] || {}), ...(d.taxBuyer || {}) };

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

  ov.querySelector('#txOk').addEventListener('click', async () => {
    const name = sv('txName').trim();
    const addr = sv('txAddr').trim();
    const taxId = sv('txTax').replace(/\D/g, '');
    if (!name)  return showToast('กรุณากรอกชื่อผู้ซื้อ', 'err');
    if (!addr)  return showToast('กรุณากรอกที่อยู่ผู้ซื้อ', 'err');
    if (!isValidThaiTaxId(taxId))
      return showToast('เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง กรุณาตรวจสอบ 13 หลัก', 'err');

    const branchSel = sv('txBranch');
    const enteredBranchNo = sv('txBranchNo').replace(/\D/g, '');
    if (branchSel !== 'สำนักงานใหญ่' && enteredBranchNo.length !== 5)
      return showToast('เลขสาขาต้องมี 5 หลัก', 'err');
    const branch = branchSel === 'สำนักงานใหญ่' ? 'สำนักงานใหญ่' : `สาขา ${enteredBranchNo}`;

    const buyer = { name, address: addr, taxId, branch };
    let cloudOk = !useSupabase;

    if (customer) {
      const customerUpdates = {
        companyName: name,
        billingAddress: addr,
        taxId,
        branchNo: branch === 'สำนักงานใหญ่' ? '00000' : enteredBranchNo,
      };
      if (useSupabase && typeof updateCustomer === 'function' && /^[0-9a-f-]{36}$/i.test(customer.id || '')) {
        await updateCustomer(customer.id, {
          company_name: customerUpdates.companyName,
          billing_address: customerUpdates.billingAddress,
          tax_id: customerUpdates.taxId,
          branch_no: customerUpdates.branchNo,
        });
        delete customer._syncPending;
      }
      Object.assign(customer, customerUpdates);
    }

    if (useSupabase && d.id && typeof updateInvoiceTaxDetails === 'function') {
      try {
        cloudOk = Boolean(await updateInvoiceTaxDetails(d.id, buyer));
      } catch (err) {
        console.error('Save invoice tax details error:', err);
        cloudOk = false;
      }
    }
    saveTaxBuyer(d.cust, buyer);
    d.invoiceType = 'tax_invoice';
    d.taxBuyer = buyer;
    d._taxSyncPending = useSupabase && !cloudOk;
    await saveData();
    closeMod();
    showTaxDoc(d, buyer);
    if (useSupabase) {
      showToast(cloudOk
        ? 'บันทึกใบกำกับภาษีขึ้น Supabase แล้ว ☁️'
        : 'บันทึกในเครื่องแล้ว · รอซิงค์ Supabase อัตโนมัติ', cloudOk ? 'ok' : 'err');
    }
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
        <button class="btn-pdf" id="dPdfTax">
          ${svgI('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')}
          ดาวน์โหลด PDF
        </button>
      </div>
    </div>`;
  openOv('dOv');
  ov.querySelector('#dCl2').addEventListener('click', closeDoc);
  ov.querySelector('#dTaxBack').addEventListener('click', () => openTaxInvoiceModal(d));
  ov.querySelector('#dPdfTax').addEventListener('click', event => {
    downloadDocumentPdf(dc, documentPdfFilename('tax', d), event.currentTarget);
  });
  ov.querySelector('#dPrTax').addEventListener('click', () => {
    printDocumentHTML(dc);
  });
}

function buildTaxInvoiceHTML(d, buyer) {
  const s = S.shop;
  const R = n => documentMoney(n);
  const Rd = R;

  /* Preserve issued VAT values. For legacy non-VAT bills, derive the
     tax-exclusive amount from the stored total when issuing a tax invoice. */
  const hasVat   = (d.vat || 0) > 0;
    const total    = fmt(Number(d.grand || 0));
    const subTotal = fmt(Number(d.sub || 0));
    const discAmt  = fmt(Number(d.disc || 0));
    const preVat   = hasVat ? fmt(Math.max(0, subTotal - discAmt)) : fmt(total / 1.07);
    const vatAmt   = hasVat ? fmt(Number(d.vat || 0)) : fmt(Math.max(0, total - preVat));
    const displayedSubTotal = hasVat ? subTotal : preVat;

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
      ${documentPrintMetaHTML('ใบกำกับภาษี', d.no)}
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

        <div class="doc-summary" style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px">
          <div class="doc-words">(${bahtWords(total)})</div>
          <div style="display:flex;justify-content:flex-end">
            <div class="doc-sum-box">
              <div class="dsr"><span>จำนวนเงิน</span><span>${Rd(displayedSubTotal)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${discAmt > 0 ? Rd(discAmt) : '—'}</span></div>
              <div class="dsr"><span>จำนวนเงินก่อน VAT 7%</span><span>${Rd(preVat)}</span></div>
              <div class="dsr"><span>VAT 7%</span><span>${Rd(vatAmt)}</span></div>
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
  const R = n => documentMoney(n);
  const taxableBase = fmt(Math.max(0, Number(d.sub || 0) - Number(d.disc || 0)));
  const vatAmount = fmt(Number(d.vat || 0));
  const hasVat = vatAmount > 0;
  const grandTotal = Number(d.grand || 0);
  const grandTotalDisplay = !hasVat && Number.isInteger(grandTotal)
    ? documentMoney(grandTotal, true)
    : R(grandTotal);

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
      ${documentPrintMetaHTML('ใบเสนอราคา', d.no)}
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

        <div class="doc-summary" style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div class="doc-words">(${bahtWords(d.grand)})</div>
            ${d.note ? `<div style="font-size:.76rem;color:#7a5500;margin-top:6px">เงื่อนไข: ${esc(d.note)}</div>` : ''}
          </div>
          <div style="display:flex;justify-content:flex-end">
            <div class="doc-sum-box">
              <div class="dsr"><span>จำนวนเงิน</span><span>${R(d.sub)}</span></div>
              <div class="dsr"><span>ส่วนลด</span><span>${d.disc > 0 ? R(d.disc) : '—'}</span></div>
              ${hasVat ? `
              <div class="dsr"><span>จำนวนเงินก่อน VAT 7%</span><span>${R(taxableBase)}</span></div>
              <div class="dsr"><span>VAT 7%</span><span>${R(vatAmount)}</span></div>` : `
              <div class="dsr"><span>จำนวนเงินหลังหักส่วนลด</span><span>${R(taxableBase)}</span></div>`}
              <div class="dsr tot"><span class="lbl">รวมสุทธิ</span><span class="lv">${grandTotalDisplay}</span></div>
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
      <button class="btn-pdf" id="dPdf">${svgI('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')} ดาวน์โหลด PDF</button>
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
    printDocumentHTML(dc);
  });

  ov.querySelector('#dPdf')?.addEventListener('click', event => {
    downloadDocumentPdf(dc, documentPdfFilename(type, data), event.currentTarget);
  });

  /* Tax invoice (ใบกำกับภาษีเต็มรูป) */
  ov.querySelector('#dTax')?.addEventListener('click', () => openTaxInvoiceModal(data));

  /* Edit invoice — load into billing form */
  ov.querySelector('#dEditBill')?.addEventListener('click', () => {
    if (!hasPermission('canEditIssuedInvoice')) return showToast('ไม่มีสิทธิ์แก้ไขบิลที่ออกแล้ว', 'err');
    const inv = S.invoices.find(x => x.no === data.no);
    if (!inv) return;
    const activePayments = invoicePaymentsFor(inv).filter(payment => !payment.reversedAt);
    if (activePayments.length) {
      const activeTotal = activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      showToast(`บิลนี้รับชำระแล้ว ${THB(activeTotal)} · ต้องย้อนรายการรับชำระก่อนแก้ไขบิล`, 'err');
      openPaymentModal(inv);
      return;
    }

    const requisitionStockIds = new Set(
      S.requisitions
        .filter(requisition => requisition.jobId === inv.jobId)
        .flatMap(requisition => requisition.items || [])
        .map(item => item.sid)
        .filter(Boolean)
    );

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
      requisitionLinked: it.itemType === 'stock' && requisitionStockIds.has(it.sid),
      originalQty: Number(it.qty || 0),
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
      invoiceDate: inv.invoiceDate || new Date(inv.ts).toISOString().slice(0, 10),
    };

    closeDoc();
    currentTab = 'billing';
    renderNav();
    renderPanel();
    showToast(requisitionStockIds.size
      ? `แก้ไขบิล ${inv.no} — จำนวนอะไหล่จากใบเบิกต้องแก้ที่ Job Card`
      : `แก้ไขบิล ${inv.no} — แก้รายการแล้วกด บันทึกการแก้ไข`, 'inf');
  });

  /* Payment ledger */
  ov.querySelector('#dPaid')?.addEventListener('click', () => {
    const inv = S.invoices.find(x => x.no === data.no);
    if (!inv) return;
    openPaymentModal(inv);
  });

  ov.querySelector('#dAdj')?.addEventListener('click', () => openAdjustmentModal(data));

  /* Cancel invoice — accounting documents remain in history */
  ov.querySelector('#dDel')?.addEventListener('click', async () => {
    if (type !== 'inv') return;
    if (!hasPermission('canCancelInvoice')) return showToast('ไม่มีสิทธิ์ยกเลิกบิล', 'err');
    const activePayments = invoicePaymentsFor(data).filter(payment => !payment.reversedAt);
    if (activePayments.length) {
      const activeTotal = activePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      showToast(`บิลนี้รับชำระแล้ว ${THB(activeTotal)} · ต้องย้อนรายการรับชำระก่อนยกเลิกบิล`, 'err');
      openPaymentModal(data);
      return;
    }
    const reason = prompt(`ระบุเหตุผลยกเลิกใบเสร็จ ${data.no}\n\nสต๊อกจะถูกคืนและเอกสารจะยังอยู่ในประวัติ`);
    if (reason === null) return;
    if (!reason.trim()) return showToast('กรุณาระบุเหตุผลการยกเลิก', 'err');

    if (useSupabase) {
      if (!data.id || typeof cancelInvoiceAtomic !== 'function')
        return showToast('ยังไม่สามารถยกเลิกบน Supabase ได้ กรุณาตรวจสอบ migration', 'err');
      const cancelled = await cancelInvoiceAtomic(data.id, reason.trim());
      if (!cancelled) return showToast('ยกเลิกบิลไม่สำเร็จ ข้อมูลเดิมยังไม่ถูกเปลี่ยน', 'err');
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

    data.status = 'cancelled';
    data.cancelledAt = Date.now();
    data.cancellationReason = reason.trim();
    data.paid = false;
    await saveData();
    closeDoc();
    renderNav();
    renderPanel();
    if (typeof addAuditLog === 'function')
      addAuditLog('INVOICE_CANCEL', 'invoice', data.id || null, data.no, { reason: reason.trim() });
    showToast(`ยกเลิกใบเสร็จ ${data.no} แล้ว · คืนสต๊อกเรียบร้อย`, 'inf');
  });

  /* Convert quotation → invoice */
  ov.querySelector('#dCv')?.addEventListener('click', async () => {
    const q = S.quotes.find(x => x.no === data.no);
    if (!q) return;

    if (useSupabase) {
      try {
        if (typeof convertQuoteAtomic !== 'function') throw new Error('Atomic quotation conversion service is unavailable');
        await convertQuoteAtomic(q.id);
      } catch (error) {
        console.error('[Quote] atomic conversion failed:',error);
        showToast(`แปลงใบเสนอราคาไม่สำเร็จ · ${String(error?.message || 'กรุณาลองใหม่').slice(0,120)}`, 'err');
        return;
      }
    }
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
