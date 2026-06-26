/* ============================================================
   NAV.JS — Navigation tabs + panel router
   ============================================================ */

const TABS = [
  { id:'dash',      label:'ภาพรวม',          icon:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { id:'customers', label:'ลูกค้า / รถ',      icon:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
  { id:'jobs',      label:'Job Card',         icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h3"/>' },
  { id:'stock',     label:'สต๊อก',            icon:'<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5"/>' },
  { id:'billing',   label:'ออกบิล',           icon:'<path d="M3 3h18v4H3zM5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M9 12h6"/>' },
  { id:'report',    label:'รายงาน',           icon:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
  { id:'settings',  label:'ตั้งค่า',          icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
];

/* ── Render navigation tabs ── */
function renderNav() {
  const lowStock = S.stockItems.filter(i => i.qty <= i.reorder).length;
  const openJobs = S.jobs.filter(j => j.status < 5).length;

  document.getElementById('NT').innerHTML = TABS.map(t => {
    let pip = '';
    if (t.id === 'stock' && lowStock) pip = `<span class="pip">${lowStock}</span>`;
    if (t.id === 'jobs'  && openJobs) pip = `<span class="pip">${openJobs}</span>`;

    return `<button class="nt ${currentTab === t.id ? 'on' : ''}" data-tab="${t.id}">
      ${svgI(t.icon)}
      <span>${t.label}</span>
      ${pip}
    </button>`;
  }).join('');

  /* Render nav-right: shop name + user info + logout button */
  let username = 'User';
  try {
    const session = localStorage.getItem('tbr_user_session');
    if (session) {
      const userData = JSON.parse(session);
      username = userData.username || 'User';
    }
  } catch (e) {
    console.warn('Could not parse user session:', e);
  }
  
  document.getElementById('NR').innerHTML = `
    <div class="nav-user">
      <div class="nav-shop">${S.shop.name || 'TBR'}</div>
      <div class="nav-info">
        <span class="nav-username">${username}</span>
        <button class="nav-logout" id="logoutBtn" title="ออกจากระบบ">
          ${svgI('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 3l4 4m-4 0l4-4M16 17l-4 4m4 0l-4-4M9 12h12"/>')}
          logout
        </button>
      </div>
    </div>
  `;

  /* Bind logout button */
  document.getElementById('logoutBtn').addEventListener('click', handleSignOut);

  /* Bind tab clicks */
  document.querySelectorAll('.nt').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      renderNav();
      renderPanel();
    });
  });
}

/* ── Route to the correct panel module ── */
function renderPanel() {
  const root = document.getElementById('root');

  switch (currentTab) {
    case 'dash':      root.innerHTML = dashboardHTML();  bindDashboard();  break;
    case 'customers': root.innerHTML = customersHTML();  bindCustomers();  break;
    case 'jobs':      root.innerHTML = jobsHTML();       bindJobs();       break;
    case 'stock':     root.innerHTML = stockHTML();      bindStock();      break;
    case 'billing':   root.innerHTML = billingHTML();    bindBilling();    break;
    case 'report':    root.innerHTML = reportHTML();     bindReport();     break;
    case 'settings':  root.innerHTML = settingsHTML();   bindSettings();   break;
    default:          root.innerHTML = dashboardHTML();  bindDashboard();
  }

  // แสดง RLS warning banner ถ้าตรวจพบว่า Supabase บล็อก invoices (เพิ่มได้ครั้งเดียว)
  if (window._rlsWarning && hasPermission('canManageTeam') && !document.getElementById('rlsBanner')) {
    const banner = document.createElement('div');
    banner.id = 'rlsBanner';
    banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);' +
      'background:#b91c1c;color:#fff;padding:10px 20px;border-radius:8px;z-index:9999;' +
      'font-size:.82rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.4);' +
      'display:flex;align-items:center;gap:10px;max-width:560px;text-align:center';
    banner.innerHTML = `
      ⚠️ Supabase RLS บล็อก invoices — ผู้ใช้บางคนเห็นยอดไม่ตรงกัน
      <br><small>แก้ไข: รัน <b>fix-data-visibility.sql</b> ใน Supabase SQL Editor</small>
      <button onclick="this.parentElement.remove();window._rlsWarning=false"
        style="background:rgba(255,255,255,.25);border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;margin-left:8px">✕</button>
    `;
    document.body.appendChild(banner);
  }
}
