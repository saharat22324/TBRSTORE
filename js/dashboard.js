/* ============================================================
   DASHBOARD.JS — หน้าภาพรวม (สถิติ + งานล่าสุด + กราฟ)
   ============================================================ */

let _dashInterval = null; // global so we can clear on re-entry

function dashboardHTML() {
  const today    = new Date().toDateString();
  const ym       = nowYM();

  /* ── Monthly invoice stats ── */
  const calcInvCost = inv => (inv.items || []).reduce((s, it) => s + ((it.qty || 0) * (it.cost || 0)), 0);

  const mInv     = S.invoices.filter(i => {
    const d = new Date(i.ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === ym;
  });
  const mRev     = mInv.reduce((s, i) => s + i.grand, 0);
  const mCost    = mInv.reduce((s, i) => s + calcInvCost(i), 0);
  const mProfit  = mRev - mCost;
  const mAvgBill = mInv.length > 0 ? mRev / mInv.length : 0;

  /* ── Today ── */
  const todayJobs = S.jobs.filter(j => new Date(j.createdAt).toDateString() === today);
  const todayInv  = S.invoices.filter(i => new Date(i.ts).toDateString() === today);
  const todayRev  = todayInv.reduce((s, i) => s + i.grand, 0);

  /* ── Stock alerts ── */
  const lowStock  = S.stockItems.filter(i => i.qty <= i.reorder);
  const openJobs  = S.jobs.filter(j => j.status < 5);
  const recent    = S.jobs.slice(-6).reverse();

  /* ── 6-month sales chart data ── */
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const mSales = months.map(m =>
    S.invoices.filter(i => {
      const d = new Date(i.ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === m;
    }).reduce((s, i) => s + i.grand, 0)
  );
  const maxS = Math.max(...mSales, 1);

  /* ── Monthly breakdown ── */
  const monthBreakdown = months.map((m, i) => {
    const inv = S.invoices.filter(x => {
      const d = new Date(x.ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === m;
    });
    const rev = mSales[i];
    const cost = inv.reduce((s, x) => s + calcInvCost(x), 0);
    const profit = rev - cost;
    const [y, mo] = m.split('-');
    return {y, mo, rev, cost, profit, count: inv.length};
  });

  const chartBars = months.map((m, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:3px;cursor:pointer;transition:opacity .2s" class="hv70">
      <div style="background:${m===ym?'var(--gold)':'var(--red)'};border-radius:4px 4px 0 0;
                  width:100%;height:${Math.round((mSales[i]/maxS)*100)||4}px;min-height:4px;opacity:.8;transition:opacity .2s"></div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.55rem;color:var(--fg2);text-align:center;font-weight:600">
        ${THB(mSales[i])}
      </div>
      <div style="font-size:.6rem;color:var(--fg2);font-weight:600">${m.slice(5)}</div>
    </div>
  `).join('');

  /* ── Recent jobs table rows ── */
  const jobRows = recent.length
    ? recent.map(j => `
      <tr data-goto="jobs" data-job="${j.id}" style="cursor:pointer;transition:background .15s">
        <td class="mono" style="font-size:.75rem;color:var(--teal)">${j.no}</td>
        <td style="font-weight:600">${esc(j.custName || '—')}</td>
        <td style="font-size:.82rem;color:var(--fg2)">${esc(j.plate || '—')}</td>
        <td><span class="badge b-${JOB_COLOR[j.status]}">${JOB_STATUS[j.status]}</span></td>
        <td style="font-size:.78rem;color:var(--fg2)">${dateStr(j.createdAt)}</td>
      </tr>`)
      .join('')
    : `<tr><td colspan="5" class="tbl-empty">ยังไม่มีงาน</td></tr>`;

  /* ── Low stock list ── */
  const stockAlert = lowStock.length ? `
    <div class="card mb12">
      <div class="card-h">
        ${svgI('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>')}
        <h2>สต๊อกใกล้หมด</h2>
      </div>
      <div class="card-b" style="padding:8px 14px">
        ${lowStock.slice(0, 6).map(i => `
          <div class="fjb" style="padding:7px 0;border-bottom:1px solid var(--ln)">
            <span style="font-size:.86rem">${esc(i.name)}</span>
            <span class="badge ${i.qty <= 0 ? 'b-bad' : 'b-warn'}">${numFmt(i.qty)} ${i.unit}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  /* ── Monthly detail rows ── */
  const monthRows = monthBreakdown.map(m => `
    <tr>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--teal)">${m.mo}/${m.y.slice(2)}</td>
      <td style="text-align:right">${m.count} บิล</td>
      <td style="text-align:right;color:var(--grn);font-weight:600">${THB(m.rev)}</td>
      <td style="text-align:right;font-size:.85rem;color:var(--fg2)">${hasPermission('canViewCost')?THB(m.cost):'••••'}</td>
      <td style="text-align:right;font-weight:600;color:${m.profit>=0?'var(--grn)':'var(--bad)'}">${hasPermission('canViewProfit')?THB(m.profit):'••••'}</td>
    </tr>
  `).join('');

  return `
    <!-- ── Stat cards ── -->
    <div class="g4 mb16">
      <div class="stat red">
        <div class="sk">${svgI('<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')} ยอดขายเดือนนี้</div>
        <div class="sv" style="font-size:1.45rem">${THB(mRev)}</div>
        <div class="sd">${mInv.length} บิล • วันนี้ ${THB(todayRev)}</div>
      </div>
      <div class="stat gold">
        <div class="sk">${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>')} กำไรเดือนนี้</div>
        <div class="sv" style="font-size:1.45rem;color:${mProfit>=0?'var(--grn)':'var(--bad)'}">
          ${hasPermission('canViewProfit') ? THB(mProfit) : '••••••'}
        </div>
        <div class="sd">${hasPermission('canViewCost') ? `ต้นทุน ${THB(mCost)} • ค่าเฉลี่ย ${THB(mAvgBill)}` : ''}</div>
      </div>
      <div class="stat teal">
        <div class="sk">${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>')} งานที่เปิดอยู่</div>
        <div class="sv">${openJobs.length}<small style="font-size:.85rem;color:var(--fg2);font-weight:600"> งาน</small></div>
        <div class="sd">วันนี้ ${todayJobs.length} งานใหม่</div>
      </div>
      <div class="stat warn">
        <div class="sk">${svgI('<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/>')} สต๊อกใกล้หมด</div>
        <div class="sv">${lowStock.length}<small style="font-size:.85rem;color:var(--fg2);font-weight:600"> รายการ</small></div>
        <div class="sd">${S.stockItems.filter(i=>i.qty<=0).length} รายการหมดแล้ว</div>
      </div>
    </div>

    <!-- ── Main grid ── -->
    <div class="g2 mb16">
      <!-- Left: Chart + Recent jobs -->
      <div>
        <!-- 6-month sales chart -->
        <div class="card mb16">
          <div class="card-h">
            ${svgI('<path d="M18 20V10M12 20V4M6 20v-6"/>')}
            <h2>ยอดขาย 6 เดือนล่าสุด</h2>
          </div>
          <div class="card-b">
            <div style="display:flex;align-items:flex-end;gap:5px;height:120px;padding:0 8px">
              ${chartBars}
            </div>
          </div>
        </div>

        <!-- Recent jobs -->
        <div class="card">
          <div class="card-h">
            ${svgI('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>')}
            <h2>งานล่าสุด</h2>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>เลขที่</th><th>ลูกค้า</th><th>รถ</th><th>สถานะ</th><th>วันที่</th></tr></thead>
              <tbody>${jobRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right column: Stock alerts + Monthly breakdown -->
      <div>
        ${stockAlert}
        
        <!-- Monthly breakdown table -->
        <div class="card">
          <div class="card-h">
            ${svgI('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>')}
            <h2>ยอดรายเดือน</h2>
          </div>
          <div class="tbl-wrap">
            <table class="tbl" style="font-size:.82rem">
              <thead><tr><th>เดือน</th><th>บิล</th><th>ยอดขาย</th><th>ต้นทุน</th><th>กำไร</th></tr></thead>
              <tbody>${monthRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}

function bindDashboard() {
  /* Click job row → go to jobs tab */
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => {
      currentTab = el.dataset.goto;
      renderNav();
      renderPanel();
    });
  });

  /* Auto-refresh dashboard data every 30 seconds — clear old interval first */
  if (_dashInterval) { clearInterval(_dashInterval); _dashInterval = null; }
  if (useSupabase && typeof getInvoices === 'function') {
    _dashInterval = setInterval(async () => {
      if (currentTab === 'dash') {
        try {
          const freshData = await getInvoices();
          if (freshData && freshData.length > 0) {
            // Convert raw Supabase format to app state format
            const converted = freshData.map(i => ({
              id: i.id,
              no: i.invoice_number,
              ts: new Date(i.created_at).getTime(),
              jobId: i.job_id,
              cust: i.customer_name || i.customers?.name || '',
              phone: i.phone || '',
              plate: i.plate || i.vehicles?.plate || '',
              model: i.car_model || i.model || '',
              mileage: i.mileage,
              ref: i.note || '',
              paid: i.payment_status || false,
              items: (i.invoice_items || []).map(it => ({
                _itemId: it.id,
                name: it.description,
                unit: '',
                qty: it.quantity,
                price: it.unit_price,
                cost: it.cost_price > 0 ? it.cost_price : 0,
                itemType: it.item_type,
                sid: it.stock_item_id,
              })),
              sub: i.subtotal,
              disc: i.discount || 0,
              vat: (i.vat > 0) ? fmt(Math.max(0, (i.subtotal || 0) - (i.discount || 0)) * 0.07) : 0,
              grand: i.grand_total,
              totalCost: 0,
              note: i.note || ''
            }));
            // Preserve invoices that only exist in localStorage (not yet synced to Supabase)
            const supabaseNos = new Set(converted.map(i => i.no).filter(Boolean));
            const localOnly = S.invoices.filter(i => i.no && !supabaseNos.has(i.no));
            S.invoices = [...converted, ...localOnly];
            renderPanel();
          }
        } catch(err) {
          console.warn('[Dashboard] Auto-refresh failed:', err);
        }
      }
    }, 30000);
  }
}
