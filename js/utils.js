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
const THB   = (n) => '฿' + (fmt(n) || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const numFmt= (n) => fmt(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });

/* ── Thai number to words ── */
function bahtWords(n) {
  const m = Math.round(n);
  const u = ['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const p = ['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
  if (m === 0) return 'ศูนย์บาทถ้วน';
  const digits = m.toString().split('').reverse();
  let w = '';
  digits.forEach((d, i) => {
    if (d === '0') return;
    const pos = i % 6;
    if (pos === 1 && d === '2')      w = `${p[pos]}สอง${w}`;
    else if (pos === 1 && d === '1') w = `${p[pos]}${w}`;
    else                             w = `${u[+d]}${p[pos]}${w}`;
  });
  return w + 'บาทถ้วน';
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
  el.querySelector('svg path')?.setAttribute('d', paths[type] || paths.ok);
  document.getElementById('tm').textContent = msg;
  el.classList.add('show');

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── Modal / overlay helpers ── */
function openOv(id) {
  document.getElementById(id).classList.add('open');
  document.body.classList.add('lock');
}

function closeOv(id) {
  document.getElementById(id).classList.remove('open');
  document.body.classList.remove('lock');
  if (id === 'mOv') document.getElementById('mOv').innerHTML = '';
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
    ov.classList.add('open');
    const done = (v) => {
      ov.classList.remove('open');
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
    closeMod();
    closeDoc();
  }
});

/* ── Bind standard modal close buttons ── */
function bindModalClose(ov, ...ids) {
  ids.forEach((id) => {
    ov.querySelector(id)?.addEventListener('click', closeMod);
  });
}
