/* ============================================================
   REPORT.JS — รายงาน & บัญชี
   ────────────────────────────────────────────
   - ยอดขาย / กำไรขั้นต้น / กำไรสุทธิ
   - กราฟ 6 เดือน
   - ค่าใช้จ่ายร้าน (เพิ่ม/ลบได้)
   - ตารางบิลพร้อมปุ่มลบ (คืนสต๊อก)
   - รายการรับ-จ่ายรายวัน (Daily Transaction Log)
   ============================================================ */

let reportMonth = nowYM(); // yyyy-MM ที่แสดงอยู่
let reportTab   = 'summary'; // 'summary' | 'daily'

/* ── Daily tab filter state ── */
let _dailyFrom   = '';
let _dailyTo     = '';
let _dailyType   = 'all'; // 'all' | 'oil' | 'parts'
let _dailyCust   = '';    // customer name filter
let _dailyPlate  = '';    // vehicle plate filter
let _bonusHeads  = 0;     // จำนวนช่างที่หาร (0 = ดึงจาก profiles)

/* ══════════════════════════════════════
   HTML
══════════════════════════════════════ */
function reportHTML() {

  /* ── Tab bar ── */
  const tabBar = `
    <div class="flex gap8 mb16" style="border-bottom:1px solid var(--ln);padding-bottom:0">
      <button class="btn btn-sm ${reportTab==='summary'?'btn-red':'btn-ghost'}"
              data-rtab="summary" style="border-radius:8px 8px 0 0;border-bottom:none">
        ${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>',14)} รายงาน & บัญชี
      </button>
      <button class="btn btn-sm ${reportTab==='daily'?'btn-red':'btn-ghost'}"
              data-rtab="daily" style="border-radius:8px 8px 0 0;border-bottom:none">
        ${svgI('<path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 12h6"/>',14)} รายการรับ-จ่ายรายวัน
      </button>
    </div>`;

  if (reportTab === 'daily') return tabBar + dailyTransactionHTML();

  const mInvs = S.invoices.filter(i => {
    const d = new Date(i.ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === reportMonth;
  });

  // Calculate cost from invoice items (qty * cost per item) — more reliable than stored totalCost
  const calcInvCost = inv => (inv.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);
  /* Revenue = ex-VAT (VAT belongs to Revenue Dept, not shop income) */
  const mRev    = fmt(mInvs.reduce((s, i) => s + i.grand - (i.vat || 0), 0));
  const mVat    = fmt(mInvs.reduce((s, i) => s + (i.vat || 0), 0));          // VAT to remit
  const mCost   = mInvs.reduce((s, i) => s + calcInvCost(i), 0);
  const mGross  = fmt(mRev - mCost);

  const mExp    = S.expenses
    .filter(e => (e.date || '').startsWith(reportMonth))
    .reduce((s, e) => s + (+e.amount || 0), 0);

  const mNet    = fmt(mGross - mExp);

  /* ── Today revenue (ex-VAT) ── */
  const today   = new Date().toDateString();
  const todayRev= S.invoices
    .filter(i => new Date(i.ts).toDateString() === today)
    .reduce((s, i) => s + i.grand - (i.vat || 0), 0);

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
      .reduce((s, i) => s + i.grand - (i.vat || 0), 0) // ex-VAT
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
        const invCost = (i.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);
        const gp = fmt(i.grand - (i.vat || 0) - invCost); // ex-VAT gross profit
        return `
          <tr>
            <td class="mono" style="font-size:.75rem;color:var(--teal);cursor:pointer"
                data-vi="${i.no}">${i.no}</td>
            <td style="font-size:.8rem">${dateStr(i.ts)}</td>
            <td style="font-weight:600">${esc(i.cust || '—')}</td>
            <td style="font-size:.8rem;color:var(--fg2)">${esc(i.plate || '—')}</td>
            <td class="r money fc-gold">${THB(i.grand)}</td>
            ${hasPermission('canViewCost') ? `<td class="r" style="font-size:.82rem;color:var(--bad)">${THB(invCost)}</td>` : ''}
            <td class="r" style="font-weight:700;color:${gp>=0?'var(--grn)':'var(--bad)'}">${THB(gp)}</td>
            <td class="c">
              <span class="badge ${i.paid ? 'b-grn' : 'b-bad'}" style="cursor:pointer;font-size:.65rem"
                    data-togglepaid="${i.no}">
                ${i.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}
              </span>
            </td>
            <td class="c">
              <div class="flex gap6" style="justify-content:center">
                <button class="btn-icon" data-vi="${i.no}" title="ดูใบเสร็จ">
                  ${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',13)}
                </button>
                ${hasPermission('canDeleteData') ? `<button class="btn-icon" data-dinv="${i.no}" title="ลบบิล (คืนสต๊อก)"
                  style="color:var(--bad);border-color:rgba(239,83,80,.3)">
                  ${svgI('<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',13)}
                </button>` : ''}
              </div>
            </td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="9" class="tbl-empty">ยังไม่มีบิลในเดือนนี้</td></tr>`;

  /* ── โบนัสช่าง ── */
  const [ym_y, ym_m] = reportMonth.split('-').map(Number);
  const lastDay = new Date(ym_y, ym_m, 0).getDate(); // last day of month
  const p1From  = `${reportMonth}-01`;
  const p1To    = `${reportMonth}-15`;
  const p2From  = `${reportMonth}-16`;
  const p2To    = `${reportMonth}-${String(lastDay).padStart(2,'0')}`;

  const invInRange = (inv, from, to) => {
    const d = new Date(inv.ts).toISOString().slice(0,10);
    return d >= from && d <= to;
  };
  const periodProfit = (from, to) => {
    const invs = mInvs.filter(i => invInRange(i, from, to));
    const sell = invs.reduce((s, i) => s + i.grand - (i.vat || 0), 0); // ex-VAT
    const cost = invs.reduce((s, i) => s + calcInvCost(i), 0);
    return { sell: fmt(sell), cost: fmt(cost), profit: fmt(sell - cost), count: invs.length };
  };

  const p1 = periodProfit(p1From, p1To);
  const p2 = periodProfit(p2From, p2To);
  const BONUS_RATE = 0.10;
  const defaultHeads = S.profiles?.filter(p => p.role !== 'admin').length || 3;
  const heads = _bonusHeads > 0 ? _bonusHeads : defaultHeads;

  const bonusPeriodCard = (label, p, from, to) => {
    const pool      = fmt(p.profit * BONUS_RATE);
    const perPerson = heads > 0 ? fmt(pool / heads) : 0;
    return `
      <div class="card" style="flex:1;min-width:240px">
        <div class="card-h" style="background:var(--p3)">
          <span style="font-size:.9rem;font-weight:700">${label}</span>
          <span style="font-size:.72rem;color:var(--fg2);margin-left:6px">${from} — ${to}</span>
          <span class="badge b-gold" style="margin-left:auto">${p.count} บิล</span>
        </div>
        <div class="card-b" style="padding:12px 14px">
          <div class="flex gap16 mb10" style="flex-wrap:wrap">
            <div>
              <div style="font-size:.67rem;color:var(--fg2)">ยอดขาย</div>
              <div class="money fc-gold" style="font-weight:700">${THB(p.sell)}</div>
            </div>
            ${hasPermission('canViewCost') ? `<div>
              <div style="font-size:.67rem;color:var(--fg2)">ต้นทุน</div>
              <div class="money" style="font-weight:700;color:var(--bad)">${THB(p.cost)}</div>
            </div>` : ''}
            <div>
              <div style="font-size:.67rem;color:var(--fg2)">กำไร</div>
              <div class="money" style="font-weight:700;color:${p.profit>=0?'var(--grn)':'var(--bad)'}">${THB(p.profit)}</div>
            </div>
          </div>
          <div style="border-top:1px dashed var(--ln);padding-top:10px">
            <div style="font-size:.72rem;color:var(--fg2);margin-bottom:6px">
              โบนัสทีม = กำไร × 10%
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <div style="background:var(--p3);border-radius:8px;padding:8px 14px;text-align:center">
                <div style="font-size:.65rem;color:var(--fg2)">โบนัสรวม</div>
                <div class="money" style="font-size:1.15rem;font-weight:800;color:var(--teal)">${THB(pool)}</div>
              </div>
              <div style="font-size:1.1rem;color:var(--fg2)">÷ ${heads} คน</div>
              <div style="background:var(--p3);border-radius:8px;padding:8px 14px;text-align:center;border:2px solid var(--teal)">
                <div style="font-size:.65rem;color:var(--fg2)">ต่อคน</div>
                <div class="money" style="font-size:1.2rem;font-weight:800;color:var(--teal)">${THB(perPerson)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  };

  const bonusHTML = `
    <div class="card" style="margin-top:16px">
      <div class="card-h">
        ${svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M9 21h6"/>')}
        <h2>โบนัสช่าง — ตัดยอดทุก 15 วัน (10% จากกำไร)</h2>
        <div class="flex gap6" style="margin-left:auto;align-items:center">
          <label style="font-size:.75rem;color:var(--fg2)">หารกี่คน</label>
          <input type="number" id="bonusHeads" min="1" max="20" value="${heads}"
            style="width:64px;background:var(--ink);border:1px solid var(--ln2);color:var(--fg);
                   border-radius:8px;padding:6px 10px;font-size:.9rem;outline:none;text-align:center">
        </div>
      </div>
      <div class="card-b" style="padding:12px 14px">
        <div class="flex gap12" style="flex-wrap:wrap">
          ${bonusPeriodCard('รอบ 1 — ต้นเดือน', p1, p1From, p1To)}
          ${bonusPeriodCard('รอบ 2 — ปลายเดือน', p2, p2From, p2To)}
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--p3);border-radius:8px">
          <div class="flex gap16" style="flex-wrap:wrap;align-items:center">
            <div>
              <div style="font-size:.67rem;color:var(--fg2)">โบนัสรวมทั้งเดือน</div>
              <div class="money" style="font-size:1.1rem;font-weight:800;color:var(--teal)">${THB(fmt((p1.profit + p2.profit) * BONUS_RATE))}</div>
            </div>
            <div>
              <div style="font-size:.67rem;color:var(--fg2)">รวมต่อคน/เดือน</div>
              <div class="money" style="font-size:1.1rem;font-weight:800;color:var(--teal)">${THB(fmt((p1.profit + p2.profit) * BONUS_RATE / heads))}</div>
            </div>
            <div style="font-size:.73rem;color:var(--fg2);align-self:center">
              กำไรรวม ${THB(mGross)} × 10% = ${THB(fmt(mGross * BONUS_RATE))} ÷ ${heads} คน
            </div>
          </div>
        </div>
      </div>
    </div>`;

  /* ── Top customers (all-time) ── */
  const custSpend = {};
  for (const inv of S.invoices) {
    const key = (inv.cust || '').trim();
    if (key) custSpend[key] = (custSpend[key] || 0) + inv.grand;
  }
  const topCusts = Object.entries(custSpend).sort((a,b)=>b[1]-a[1]).slice(0, 10);
  const topMax   = topCusts[0]?.[1] || 1;
  const topRows  = topCusts.map(([name, total], idx) => `
    <tr>
      <td class="c" style="font-size:.8rem;color:var(--fg2);width:24px">${idx+1}</td>
      <td style="font-weight:600;font-size:.87rem">${esc(name)}</td>
      <td style="width:50%">
        <div style="background:var(--p3);border-radius:99px;height:8px;overflow:hidden">
          <div style="background:var(--gold);height:8px;width:${Math.round(total/topMax*100)}%;border-radius:99px"></div>
        </div>
      </td>
      <td class="r money fc-gold">${THB(total)}</td>
    </tr>`).join('');

  return tabBar + `
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
        <div class="sk">${svgI('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')} ยอดขาย <span style="font-size:.65rem;opacity:.7">(ไม่รวม VAT)</span></div>
        <div class="sv" style="font-size:1.4rem">${THB(mRev)}</div>
        <div class="sd">${mInvs.length} บิล · วันนี้ ${THB(todayRev)}${mVat > 0 ? ` · <span style="color:var(--warn)">VAT นำส่ง ${THB(mVat)}</span>` : ''}</div>
      </div>
      <div class="stat gold">
        <div class="sk">${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>')} กำไรขั้นต้น</div>
        <div class="sv" style="font-size:1.4rem;color:${mGross>=0?'var(--grn)':'var(--bad)'}">${THB(mGross)}</div>
        <div class="sd">${hasPermission('canViewCost') ? `COGS ${THB(mCost)}` : '••••••'}</div>
      </div>
      <div class="stat ${mNet>=0?'grn':'bad'}">
        <div class="sk">${svgI('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>')} กำไรสุทธิ</div>
        <div class="sv" style="font-size:1.4rem">${THB(mNet)}</div>
        <div class="sd">${hasPermission('canViewCost') ? `หัก ค่าใช้จ่าย ${THB(mExp)}` : '••••••'}</div>
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

      ${hasPermission('canManageTeam') ? `
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
      </div>` : ''}
    </div>

    <!-- ── Invoice table ── -->
    <div class="card">
      <div class="card-h">
        ${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>')}
        <h2>บิลเดือนนี้ (${mInvs.length} บิล)</h2>
        <button class="btn btn-ghost btn-xs" id="rExportCSV" style="margin-left:auto">
          ${svgI('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',13)}
          ดาวน์โหลด CSV
        </button>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>ทะเบียน</th>
              <th class="r">ยอดรวม</th>
              ${hasPermission('canViewCost') ? '<th class="r">COGS</th>' : ''}
              <th class="r">กำไร</th>
              <th class="c">ชำระ</th>
              <th class="c"></th>
            </tr>
          </thead>
          <tbody>${invRows}</tbody>
        </table>
      </div>
    </div>

    <!-- ── โบนัสช่าง ── -->
    ${bonusHTML}

    <!-- ── Top Customers ── -->
    <div class="card" style="margin-top:16px">
      <div class="card-h">
        ${svgI('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')}
        <h2>ลูกค้ารายใหญ่ (ตลอดเวลา)</h2>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr><th class="c">#</th><th>ชื่อลูกค้า</th><th></th><th class="r">ยอดรวม</th></tr></thead>
          <tbody>${topRows.length ? topRows : `<tr><td colspan="4" class="tbl-empty">ยังไม่มีข้อมูล</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   DAILY TRANSACTION LOG
══════════════════════════════════════ */
function dailyTransactionHTML() {

  /* ── Determine if a stock item is oil ── */
  const isOilItem = (item) => {
    const si    = S.stockItems.find(s => s.id === item.sid);
    const cat   = (si?.cat || '').toLowerCase();
    const name  = (item.name || '').toLowerCase();
    return cat.includes('น้ำมัน') || cat.includes('oil') || cat.includes('fluid')
        || name.includes('น้ำมัน') || name.includes('น้ำยา');
  };

  /* ── Default date range: current month ── */
  const today   = new Date();
  const fromDef = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
  const toDef   = today.toISOString().slice(0,10);
  const from    = _dailyFrom || fromDef;
  const to      = _dailyTo   || toDef;

  /* ── Unique customers + plates for dropdowns ── */
  const allCusts  = [...new Set(S.invoices.map(i => i.cust).filter(Boolean))].sort();
  const allPlates = _dailyCust
    ? [...new Set(S.invoices.filter(i => i.cust === _dailyCust).map(i => i.plate).filter(Boolean))].sort()
    : [...new Set(S.invoices.map(i => i.plate).filter(Boolean))].sort();

  /* ── Filter invoices by date range + customer + plate ── */
  const filtered = S.invoices.filter(inv => {
    const d = new Date(inv.ts).toISOString().slice(0,10);
    if (d < from || d > to) return false;
    if (_dailyCust  && inv.cust  !== _dailyCust)  return false;
    if (_dailyPlate && inv.plate !== _dailyPlate) return false;
    return true;
  });

  /* ── Group items by day ── */
  const dayMap = {};
  for (const inv of filtered) {
    const dayKey  = new Date(inv.ts).toISOString().slice(0,10);
    const job     = S.jobs.find(j => j.id === inv.jobId);
    const custName= inv.cust || job?.custName || '—';
    const jobNo   = job?.no  || '—';

    for (const item of (inv.items || [])) {
      const isOil  = isOilItem(item);
      if (_dailyType === 'oil'   && !isOil) continue;
      if (_dailyType === 'parts' &&  isOil) continue;

      const qty     = item.qty   || 0;
      const cost    = item.cost  || 0;
      const price   = item.price || 0;
      const tCost   = fmt(qty * cost);
      const tSell   = fmt(qty * price);
      const profit  = fmt(tSell - tCost);

      if (!dayMap[dayKey]) dayMap[dayKey] = { oil: [], parts: [] };
      dayMap[dayKey][isOil ? 'oil' : 'parts'].push({
        name: item.name || '—', qty, unit: item.unit || '',
        tCost, tSell, profit, jobNo, custName, invNo: inv.no,
      });
    }
  }

  /* ── Grand totals — sum from dayMap rows (consistent with visible rows) ── */
  let gSell = 0, gCost = 0;
  for (const day of Object.values(dayMap)) {
    for (const row of [...day.oil, ...day.parts]) {
      gSell += row.tSell;
      gCost += row.tCost;
    }
  }
  gSell = fmt(gSell);
  gCost = fmt(gCost);
  let gProfit = fmt(gSell - gCost);

  // Row count from dayMap
  let gRows = 0;
  for (const day of Object.values(dayMap)) {
    gRows += [...day.oil, ...day.parts].length;
  }

  /* ── Day blocks ── */
  const days = Object.keys(dayMap).sort().reverse();

  const dayBlocks = days.length ? days.map(day => {
    const { oil, parts } = dayMap[day];
    const all  = [...oil, ...parts];
    const dCost   = fmt(all.reduce((s, i) => s + i.tCost, 0));
    const dSell   = fmt(all.reduce((s, i) => s + i.tSell, 0));
    const dProfit = fmt(all.reduce((s, i) => s + i.profit, 0));
    const dDate   = dateStr(new Date(day).getTime() + 12*3600*1000); // noon to avoid tz shift

    const oilRows = oil.length ? oil.map(r => `
      <tr>
        <td style="font-size:.83rem">${esc(r.name)}</td>
        <td class="c" style="font-size:.78rem;color:var(--fg2)">${r.qty}${r.unit?' '+r.unit:' ล.'}</td>
        ${hasPermission('canViewCost') ? `<td class="r money" style="font-size:.8rem;color:var(--bad)">${THB(r.tCost)}</td>` : ''}
        <td class="r money fc-gold" style="font-size:.8rem">${THB(r.tSell)}</td>
        <td class="r" style="font-size:.8rem;font-weight:600;color:${r.profit>=0?'var(--grn)':'var(--bad)'}">${THB(r.profit)}</td>
        <td class="mono" style="font-size:.7rem;color:var(--teal)">${esc(r.jobNo)}</td>
        <td style="font-size:.8rem">${esc(r.custName)}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--fg3);font-size:.78rem;padding:6px">—</td></tr>`;

    const partsRows = parts.length ? parts.map(r => `
      <tr>
        <td style="font-size:.83rem">${esc(r.name)}</td>
        ${hasPermission('canViewCost') ? `<td class="r money" style="font-size:.8rem;color:var(--bad)">${THB(r.tCost)}</td>` : ''}
        <td class="r money fc-gold" style="font-size:.8rem">${THB(r.tSell)}</td>
        <td class="r" style="font-size:.8rem;font-weight:600;color:${r.profit>=0?'var(--grn)':'var(--bad)'}">${THB(r.profit)}</td>
        <td class="mono" style="font-size:.7rem;color:var(--teal)">${esc(r.jobNo)}</td>
        <td style="font-size:.8rem">${esc(r.custName)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:var(--fg3);font-size:.78rem;padding:6px">—</td></tr>`;

    const costCol = hasPermission('canViewCost');

    return `
      <div class="card mb12">
        <div class="card-h" style="background:var(--p3)">
          <span style="font-size:.95rem;font-weight:700">${dDate}</span>
          <span style="margin-left:auto;font-size:.78rem;color:var(--fg2)">${all.length} รายการ</span>
        </div>

        ${_dailyType !== 'parts' ? `
        <div style="padding:8px 14px 6px">
          <div style="font-size:.78rem;font-weight:700;color:var(--teal);margin-bottom:4px">
            🛢️ น้ำมัน (${oil.length} รายการ)
          </div>
          <div class="tbl-wrap">
            <table class="tbl" style="font-size:.82rem">
              <thead><tr>
                <th>ชื่อน้ำมัน</th><th class="c">ปริมาณ</th>
                ${costCol ? '<th class="r">ทุน</th>' : ''}
                <th class="r">ขาย</th><th class="r">กำไร</th><th>Job</th><th>ลูกค้า</th>
              </tr></thead>
              <tbody>${oilRows}</tbody>
            </table>
          </div>
        </div>` : ''}

        ${_dailyType !== 'oil' ? `
        <div style="padding:${_dailyType==='all'?'2':'8'}px 14px 6px">
          <div style="font-size:.78rem;font-weight:700;color:var(--warn);margin-bottom:4px">
            🔧 อะไหล่ / บริการ (${parts.length} รายการ)
          </div>
          <div class="tbl-wrap">
            <table class="tbl" style="font-size:.82rem">
              <thead><tr>
                <th>ชื่อรายการ</th>
                ${costCol ? '<th class="r">ทุน</th>' : ''}
                <th class="r">ขาย (+37%)</th><th class="r">กำไร</th><th>Job</th><th>ลูกค้า</th>
              </tr></thead>
              <tbody>${partsRows}</tbody>
            </table>
          </div>
        </div>` : ''}

        <div style="display:flex;gap:20px;flex-wrap:wrap;padding:10px 14px;
                    border-top:1px solid var(--ln);background:var(--p3);
                    border-radius:0 0 10px 10px">
          ${costCol ? `<div>
            <div style="font-size:.68rem;color:var(--fg2)">รวมทุน</div>
            <div class="money" style="font-weight:700;color:var(--bad)">${THB(dCost)}</div>
          </div>` : ''}
          <div>
            <div style="font-size:.68rem;color:var(--fg2)">รวมขาย</div>
            <div class="money fc-gold" style="font-weight:700">${THB(dSell)}</div>
          </div>
          <div>
            <div style="font-size:.68rem;color:var(--fg2)">รวมกำไร</div>
            <div class="money" style="font-weight:700;color:${dProfit>=0?'var(--grn)':'var(--bad)'}">${THB(dProfit)}</div>
          </div>
        </div>
      </div>`;
  }).join('')
  : `<div class="tbl-empty" style="padding:40px;text-align:center">ไม่มีรายการในช่วงวันที่เลือก</div>`;

  const costCol = hasPermission('canViewCost');

  return `
    <!-- ── Daily Header ── -->
    <div class="fjb mb12" style="flex-wrap:wrap;gap:8px">
      <div>
        <h1 class="cond" style="font-size:1.4rem;font-weight:800;text-transform:uppercase">
          รายการรับ-จ่ายรายวัน
        </h1>
        <div style="font-size:.8rem;color:var(--fg2);margin-top:2px">${gRows} รายการ</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="dailyExportCSV">
        ${svgI('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',13)}
        Export CSV
      </button>
    </div>

    <!-- ── Filters ── -->
    <div class="card mb16">
      <div class="card-b" style="padding:12px 14px">
        <div class="flex gap12" style="flex-wrap:wrap;align-items:flex-end">
          <div class="fld" style="min-width:130px;margin:0">
            <label style="font-size:.75rem;color:var(--fg2);display:block;margin-bottom:3px">จาก</label>
            <input type="date" id="dailyFrom" value="${from}"
              style="background:var(--ink);border:1px solid var(--ln2);color:var(--fg);
                     border-radius:8px;padding:7px 10px;font-size:.85rem;outline:none">
          </div>
          <div class="fld" style="min-width:130px;margin:0">
            <label style="font-size:.75rem;color:var(--fg2);display:block;margin-bottom:3px">ถึง</label>
            <input type="date" id="dailyTo" value="${to}"
              style="background:var(--ink);border:1px solid var(--ln2);color:var(--fg);
                     border-radius:8px;padding:7px 10px;font-size:.85rem;outline:none">
          </div>
          <div class="flex gap6">
            <button class="btn btn-sm ${_dailyType==='all'?'btn-red':'btn-ghost'}" data-dtype="all">ทั้งหมด</button>
            <button class="btn btn-sm ${_dailyType==='oil'?'btn-red':'btn-ghost'}" data-dtype="oil">🛢️ น้ำมัน</button>
            <button class="btn btn-sm ${_dailyType==='parts'?'btn-red':'btn-ghost'}" data-dtype="parts">🔧 อะไหล่</button>
          </div>
        </div>
        <div class="flex gap12 mt8" style="flex-wrap:wrap;align-items:flex-end">
          <div class="fld" style="min-width:140px;margin:0">
            <label style="font-size:.75rem;color:var(--fg2);display:block;margin-bottom:3px">ลูกค้า</label>
            <select id="dailyCust"
              style="background:var(--ink);border:1px solid var(--ln2);color:var(--fg);
                     border-radius:8px;padding:7px 10px;font-size:.85rem;outline:none;width:100%">
              <option value="">— ทั้งหมด —</option>
              ${allCusts.map(c => `<option value="${esc(c)}" ${_dailyCust===c?'selected':''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="fld" style="min-width:130px;margin:0">
            <label style="font-size:.75rem;color:var(--fg2);display:block;margin-bottom:3px">รถ (ทะเบียน)</label>
            <select id="dailyPlate"
              style="background:var(--ink);border:1px solid var(--ln2);color:var(--fg);
                     border-radius:8px;padding:7px 10px;font-size:.85rem;outline:none;width:100%">
              <option value="">— ทั้งหมด —</option>
              ${allPlates.map(p => `<option value="${esc(p)}" ${_dailyPlate===p?'selected':''}>${esc(p)}</option>`).join('')}
            </select>
          </div>
          ${(_dailyCust || _dailyPlate) ? `<button class="btn btn-ghost btn-sm" id="dailyClearFilter">✕ ล้างตัวกรอง</button>` : ''}
        </div>
      </div>
    </div>

    <!-- ── Grand Summary ── -->
    ${gRows > 0 ? `
    <div class="g4 mb16">
      <div class="stat gold" style="min-height:76px">
        <div class="sk">${svgI('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')} ยอดขายรวม</div>
        <div class="sv" style="font-size:1.3rem">${THB(gSell)}</div>
      </div>
      ${costCol ? `<div class="stat red" style="min-height:76px">
        <div class="sk">${svgI('<path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7"/>')} ต้นทุนรวม</div>
        <div class="sv" style="font-size:1.3rem">${THB(gCost)}</div>
      </div>` : ''}
      <div class="stat grn" style="min-height:76px">
        <div class="sk">${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>')} กำไรรวม</div>
        <div class="sv" style="font-size:1.3rem">${THB(gProfit)}</div>
      </div>
      <div class="stat teal" style="min-height:76px">
        <div class="sk">${svgI('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')} จำนวนรายการ</div>
        <div class="sv" style="font-size:1.3rem">${gRows}</div>
      </div>
    </div>` : ''}

    <!-- ── Day Blocks ── -->
    ${dayBlocks}`;
}

/* ══════════════════════════════════════
   BIND
══════════════════════════════════════ */
function bindReport() {

  /* ── Tab switching ── */
  document.querySelectorAll('[data-rtab]').forEach(b =>
    b.addEventListener('click', () => {
      reportTab = b.dataset.rtab;
      renderPanel();
    })
  );

  /* ── Daily tab bindings ── */
  if (reportTab === 'daily') {
    sel('dailyFrom')?.addEventListener('change',  e => { _dailyFrom  = e.target.value; renderPanel(); });
    sel('dailyTo')?.addEventListener('change',    e => { _dailyTo    = e.target.value; renderPanel(); });
    sel('dailyCust')?.addEventListener('change',  e => { _dailyCust  = e.target.value; _dailyPlate = ''; renderPanel(); });
    sel('dailyPlate')?.addEventListener('change', e => { _dailyPlate = e.target.value; renderPanel(); });
    sel('dailyClearFilter')?.addEventListener('click', () => { _dailyCust = ''; _dailyPlate = ''; renderPanel(); });

    document.querySelectorAll('[data-dtype]').forEach(b =>
      b.addEventListener('click', () => { _dailyType = b.dataset.dtype; renderPanel(); })
    );

    sel('dailyExportCSV')?.addEventListener('click', () => {
      const today   = new Date();
      const from    = _dailyFrom || `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
      const to      = _dailyTo   || today.toISOString().slice(0,10);
      const isOilIt = (item) => {
        const si = S.stockItems.find(s => s.id === item.sid);
        const c  = (si?.cat || '').toLowerCase();
        const n  = (item.name || '').toLowerCase();
        return c.includes('น้ำมัน')||c.includes('oil')||c.includes('fluid')||n.includes('น้ำมัน')||n.includes('น้ำยา');
      };
      const rows = [];
      const hdrs = ['วันที่','ประเภท','ชื่อรายการ','ปริมาณ','ทุน','ขาย','กำไร','Job','ลูกค้า','เลขที่บิล'];
      for (const inv of S.invoices) {
        const d = new Date(inv.ts).toISOString().slice(0,10);
        if (d < from || d > to) continue;
        const job     = S.jobs.find(j => j.id === inv.jobId);
        const custName= inv.cust || job?.custName || '';
        const jobNo   = job?.no || '';
        for (const item of (inv.items || [])) {
          const isOil = isOilIt(item);
          if (_dailyType === 'oil' && !isOil) continue;
          if (_dailyType === 'parts' && isOil) continue;
          const qty   = item.qty || 0;
          const tCost = fmt(qty * (item.cost || 0));
          const tSell = fmt(qty * (item.price || 0));
          rows.push([
            d, isOil ? 'น้ำมัน' : 'อะไหล่/บริการ',
            `"${(item.name||'').replace(/"/g,'""')}"`, qty, tCost, tSell, fmt(tSell-tCost),
            `"${jobNo.replace(/"/g,'""')}"`, `"${custName.replace(/"/g,'""')}"`, inv.no
          ].join(','));
        }
      }
      if (!rows.length) return showToast('ไม่มีรายการในช่วงที่เลือก', 'err');
      const csv = [hdrs.join(','), ...rows].join('\n');
      const a   = document.createElement('a');
      a.href    = URL.createObjectURL(new Blob(["\uFEFF"+csv], { type:'text/csv;charset=utf-8' }));
      a.download = `TBR-รายวัน-${from}-${to}.csv`;
      a.click();
      showToast('Export CSV สำเร็จ', 'ok');
    });

    return; // skip summary bindings
  }

  /* Month selector */
  sel('rMSel')?.addEventListener('input', e => {
    reportMonth = e.target.value;
    renderPanel();
  });

  /* Bonus headcount */
  sel('bonusHeads')?.addEventListener('input', e => {
    _bonusHeads = parseInt(e.target.value) || 0;
    renderPanel();
  });

  /* Add expense button */
  sel('addExpBtn')?.addEventListener('click', openExpModal);

  /* Export CSV */
  sel('rExportCSV')?.addEventListener('click', () => {
    const mInvs2 = S.invoices.filter(i => {
      const d = new Date(i.ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === reportMonth;
    });
    if (!mInvs2.length) return showToast('ไม่มีบิลในเดือนนี้', 'err');
    const header = 'เลขที่,วันที่,ลูกค้า,ทะเบียน,ยอดรวม,ชำระ';
    const rows = mInvs2.map(i =>
      `"${i.no}","${dateStr(i.ts)}","${(i.cust||'').replace(/"/g,'""')}","${(i.plate||'').replace(/"/g,'""')}",${i.grand},${i.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}`
    );
    const csv = [header, ...rows].join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob(["\uFEFF"+csv], { type:'text/csv;charset=utf-8' }));
    a.download = `TBR-บิล-${reportMonth}.csv`;
    a.click();
    showToast('ดาวน์โหลด CSV แล้ว', 'ok');
  });

  /* Paid toggle */
  document.querySelectorAll('[data-togglepaid]').forEach(b =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const inv = S.invoices.find(x => x.no === b.dataset.togglepaid);
      if (!inv) return;
      inv.paid = !inv.paid;
      if (useSupabase && inv.id && typeof updateInvoicePaid === 'function') {
        updateInvoicePaid(inv.id, inv.paid).catch(() => {});
      }
      await saveData();
      renderPanel();
      showToast(`บิล ${inv.no} ${inv.paid ? 'ชำระแล้ว ✓' : 'ยังไม่ชำระ'}`);
    })
  );

  /* Delete expense */
  document.querySelectorAll('[data-dex]').forEach(b =>
    b.addEventListener('click', async () => {
      const expId = b.dataset.dex;
      S.expenses = S.expenses.filter(e => e.id !== expId);
      // Delete from Supabase
      if (useSupabase && typeof deleteExpense === 'function') {
        const _uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (_uuidRe.test(expId)) {
          deleteExpense(expId).catch(e => console.warn('[Exp] Supabase delete failed:', e));
        }
      }
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

    const exp = {
      id:     'EX-' + Date.now(),
      label,
      amount: amt,
      date:   sv('eDt'),
    };
    S.expenses.push(exp);

    // Save to Supabase
    if (useSupabase && typeof addExpense === 'function') {
      addExpense(label, amt, exp.date)
        .then(result => {
          if (result?.id) {
            exp.id = result.id;
            localStorage.setItem(DB_KEY, JSON.stringify(S));
          }
        })
        .catch(e => console.warn('[Exp] Supabase save failed:', e));
    }

    await saveData();
    closeMod();
    renderPanel();
    showToast(`เพิ่ม ${label} ${THB(amt)}`);
  });

  bindModalClose(ov, '#mCl', '#mCl2');
}
