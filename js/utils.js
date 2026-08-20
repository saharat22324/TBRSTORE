/* ============================================================
   UTILS.JS — Helper functions used across all modules
   ============================================================ */

/* ── Business constants ── */
const MARKUP_RATE = 1.37; // อะไหล่สั่ง: ราคาขาย = ทุน × 1.37

const JOB_STATUS = ['เปิดงาน','ตรวจสอบ','รออนุมัติ','กำลังซ่อม','รอส่งมอบ','ปิดงาน'];
const JOB_COLOR  = ['teal','warn','purple','gold','grn','gray'];
const JOB_DOT    = ['#28C2C9','#EEA61C','#9b59b6','#F39C12','#2ecc71','#95a5a6'];

/* ── Number formatting ── */
const fmt   = (n) => parseFloat((Math.round(n * 100) / 100).toFixed(2));
const THB   = (n) => {
  const amount = fmt(n) || 0;
  return `${amount < 0 ? '-' : ''}฿${Math.abs(amount).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
};
const numFmt= (n) => fmt(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

const invoiceRevenueBeforeVat = (invoice) => {
  const subtotal = Number(invoice?.sub);
  if (Number.isFinite(subtotal)) return fmt(subtotal - Number(invoice?.disc || 0));
  return fmt(Number(invoice?.grand || 0) - Number(invoice?.vat || 0));
};

/* ── Thai number to words ── */
function bahtWords(n) {
  const units = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const places = ['','สิบ','ร้อย','พัน','หมื่น','แสน'];
  const integerWords = (value, useEtForOne = false) => {
    const number = Math.floor(value);
    if (number === 0) return units[0];
    if (number >= 1000000) {
      const millions = Math.floor(number / 1000000);
      const remainder = number % 1000000;
      return integerWords(millions) + 'ล้าน' + (remainder ? integerWords(remainder, true) : '');
    }
    const digits = String(number);
    let words = '';
    for (let index = 0; index < digits.length; index++) {
      const digit = Number(digits[index]);
      if (!digit) continue;
      const place = digits.length - index - 1;
      if (place === 1 && digit === 1) words += 'สิบ';
      else if (place === 1 && digit === 2) words += 'ยี่สิบ';
      else if (place === 0 && digit === 1 && (number > 10 || useEtForOne)) words += 'เอ็ด';
      else words += units[digit] + places[place];
    }
    return words;
  };

  const totalSatang = Math.round(Math.abs(Number(n) || 0) * 100);
  const baht = Math.floor(totalSatang / 100);
  const satang = totalSatang % 100;
  const prefix = Number(n) < 0 ? 'ลบ' : '';
  return prefix + integerWords(baht) + 'บาท' + (satang ? integerWords(satang) + 'สตางค์' : 'ถ้วน');
}

/* ── Date / time formatting ── */
const dateStr = (ts) => new Date(ts || Date.now()).toLocaleDateString('th-TH', {
  day: '2-digit', month: 'short', year: 'numeric'
});

const timeStr = (ts) => new Date(ts || Date.now()).toLocaleTimeString('th-TH', {
  hour: '2-digit', minute: '2-digit'
});

const nowYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const dateFmt = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

/* ── ID generators ── */
function nextSeqNo(type) {
  const no = `${type}-${dateFmt()}-${String(S.seq[type] || 1).padStart(3, '0')}`;
  S.seq[type] = (S.seq[type] || 1) + 1;
  return no;
}

/* ── HTML string escaping ── */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ── DOM shortcuts ── */
const sv  = (id) => document.getElementById(id)?.value || '';
const si  = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
const sel = (id) => document.getElementById(id);

/* ── SVG icon builder ── */
function svgI(pathData, size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round">
    ${pathData}
  </svg>`;
}

/* ── Toast notification ── */
let _toastTimer;

function showToast(msg, type = 'ok') {
  const el    = document.getElementById('tst');
  const paths = {
    ok:  'M20 6 9 17l-5-5',
    err: 'M18 6 6 18M6 6l12 12',
    inf: 'M13 16h-1v-4h-1m1-4h.01',
  };

  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.setAttribute('aria-live', type === 'err' ? 'assertive' : 'polite');
  el.querySelector('svg path')?.setAttribute('d', paths[type] || paths.ok);
  document.getElementById('tm').textContent = msg;
  el.classList.add('show');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── Modal / overlay helpers ── */
const _modalReturnFocus = new Map();

function openOv(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  _modalReturnFocus.set(id, document.activeElement);
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lock');
  requestAnimationFrame(() => {
    const focusTarget = overlay.querySelector('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    focusTarget?.focus();
  });
}

function closeOv(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.ov.open')) document.body.classList.remove('lock');
  if (id === 'mOv') document.getElementById('mOv').innerHTML = '';
  const returnFocus = _modalReturnFocus.get(id);
  if (returnFocus?.isConnected) returnFocus.focus();
  _modalReturnFocus.delete(id);
}

function closeMod() { closeOv('mOv'); }
function closeDoc() {
  closeOv('dOv');
  document.getElementById('dOv').innerHTML = '';
}

/* ── Confirmation dialog (Promise-based, dark-theme) ── */
function showConfirm(title, msg, btnLabel = 'ยืนยัน') {
  return new Promise((resolve) => {
    const ov = document.getElementById('cfOv');
    ov.innerHTML = `
      <div class="modal sm" style="max-width:360px">
        <div class="modal-h"><h3>${title}</h3></div>
        <div class="modal-b">
          <p style="margin:0;color:var(--fg2);line-height:1.6">${msg}</p>
        </div>
        <div class="modal-f">
          <button class="btn btn-ghost" id="cfNo">ยกเลิก</button>
          <button class="btn btn-red"   id="cfYes">${btnLabel}</button>
        </div>
      </div>`;
    openOv('cfOv');
    const done = (v) => {
      closeOv('cfOv');
      ov.innerHTML = '';
      resolve(v);
    };
    ov.querySelector('#cfYes').addEventListener('click', () => done(true));
    ov.querySelector('#cfNo' ).addEventListener('click', () => done(false));
  });
}

/* Close on Escape key */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const confirmOverlay = document.getElementById('cfOv');
    if (confirmOverlay?.classList.contains('open')) confirmOverlay.querySelector('#cfNo')?.click();
    else if (document.getElementById('mOv')?.classList.contains('open')) closeMod();
    else if (document.getElementById('dOv')?.classList.contains('open')) closeDoc();
    return;
  }
  if (e.key === 'Tab') {
    const overlay = [...document.querySelectorAll('.ov.open')].pop();
    if (!overlay) return;
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ── Bind standard modal close buttons ── */
function bindModalClose(ov, ...ids) {
  ids.forEach((id) => {
    ov.querySelector(id)?.addEventListener('click', closeMod);
  });
}
