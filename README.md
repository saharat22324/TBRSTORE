# TBR Service Center — ระบบบริหารอู่ครบวงจร

## 🚀 Quick Start

### Development (Local)
```bash
# Option 1: Simple Python Server
python -m http.server 8000
# Access: http://localhost:8000

# Option 2: Deploy Script
python deploy-simple.py 8080

# Option 3: Docker
docker-compose up -d
```

### Production (Deploy)
**See:** [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions

1. **Update Credentials:** [UPDATE_CREDENTIALS.md](UPDATE_CREDENTIALS.md)
   - Get production Supabase keys
   - Update `index.html`

2. **Enable RLS:** [ENABLE_RLS_GUIDE.md](ENABLE_RLS_GUIDE.md)
   - Run `enable-rls-policies.sql`
   - Verify 3 roles working

3. **Deploy:** Choose one option:
   - Windows: `powershell -ExecutionPolicy Bypass -File deploy-windows.ps1`
   - Docker: `docker-compose up -d`
   - Python: `python deploy-simple.py 8080`

4. **Test:** Create invoice → verify dashboard updates

**Time to Production:** ~60 minutes

---

## โครงสร้างโปรเจกต์

```
TBR-System/
├── index.html              ← หน้าหลัก (HTML เท่านั้น)
│
├── css/
│   ├── base.css            ← CSS Variables, Reset, Layout, Navigation
│   ├── components.css      ← Cards, Buttons, Tables, Forms, Badges,
│   │                          Modals, Stats, Alerts, Stock bar,
│   │                          Sum box, Bill rows, Item type tags
│   └── print.css           ← สไตล์ใบเสร็จ/QT + @media print
│
└── js/
    ├── db.js               ← localStorage (load/save/export/import)
    ├── utils.js            ← Helpers: THB, dateStr, svgI, toast, modal
    ├── state.js            ← Global state (S), seed data, migration
    ├── nav.js              ← Navigation tabs + panel router
    ├── dashboard.js        ← หน้าภาพรวม
    ├── customers.js        ← ลูกค้า + รถ + ประวัติการซ่อม
    ├── jobs.js             ← Job Card + ใบเบิกสต๊อก (Requisition)
    ├── stock.js            ← คลังสินค้า (Stock Items)
    ├── billing.js          ← ออกบิล (Invoice + Quotation)
    ├── report.js           ← รายงาน + บัญชี
    ├── settings.js         ← ตั้งค่าร้าน + Service Package
    └── docs.js             ← Renderer ใบเสร็จ/QT (print)
```

---

## Logic ราคา

| ประเภท | คำนวณ | ตัดสต๊อก |
|--------|--------|----------|
| **Stock Item** (ของเหลว TBR) | ราคาขายตามที่ตั้งไว้ | ✅ ตัดเมื่อออกบิล |
| **Order Item** (อะไหล่สั่ง) | ทุน × 1.37 | ❌ ไม่มีสต๊อก |
| **Service Package** | ราคาตั้งเอง | ❌ ไม่ตัดอัตโนมัติ |

ตัดสต๊อกจริง → ใบเบิกสต๊อก (Requisition) ผูกกับ Job

---

## ข้อมูล

- เก็บใน `localStorage` key: `tbr-system-v1`
- Export/Import ได้จาก ตั้งค่า → ระบบ & ข้อมูล
- ลบบิลแล้ว → สต๊อกคืนกลับอัตโนมัติ
