/* ============================================================
   STATE.JS — Application state (S), seed data, migration
   ============================================================ */

/** Global state object — populated by db.js → loadData() */
let S = null;

/* ── Active tab tracker ── */
let currentTab = 'dash';
let settingsTab = 'shop';

/* ── Billing state (persists while open) ── */
let bItems  = [];
let bKey    = 0;
let bDisc   = 0;
let bVat    = false;
let bJobId  = null;

/* ══════════════════════════════════════
   SEED DATA — ค่าเริ่มต้นสำหรับระบบใหม่
══════════════════════════════════════ */
function seedData() {
  return {

    /* ── ข้อมูลร้าน ── */
    shop: {
      name:  'บริษัท ทีบีอาร์ เพอร์ฟอร์แมนซ์ จำกัด',
      addr:  '1991/192 หมู่บ้านอารียา แมนดารีนา ถนนอ่อนนุช แขวงสวนหลวง เขตสวนหลวง กทม 10250',
      phone: '065-953-5241',
      tax:   '0105562178451',
      line:  '@topbullrace',
      note:  'ขอบคุณที่ใช้บริการ TBR Performance',
    },

    /* ── Running sequences ── */
    seq: { job: 1, inv: 1, qt: 1, po: 1, rq: 1 },

    /* ── ลูกค้า & รถ ── */
    customers: [],
    vehicles:  [],

    /* ── Job Cards ── */
    jobs: [],

    /* ── ใบเบิกสต๊อก ── */
    requisitions: [],

    /* ──────────────────────────────────
       สต๊อกสินค้า (Stock Items)
       ของเหลว TBR — ราคาขายกำหนดเอง
       ────────────────────────────────── */
    stockItems: [
      { id:'S01', cat:'น้ำมันเครื่อง',  name:'น้ำมันเครื่อง 5W40 Diesel',          unit:'ลิตร',  cost:210, sell:300, qty:24, reorder:16, recv:24, used:0 },
      { id:'S02', cat:'น้ำมันเครื่อง',  name:'น้ำมันเครื่อง 5W40 Benzine',         unit:'ลิตร',  cost:230, sell:330, qty:48, reorder:20, recv:48, used:0 },
      { id:'S03', cat:'น้ำมันเครื่อง',  name:'น้ำมันเครื่อง 5W30 Benzine',         unit:'ลิตร',  cost:220, sell:320, qty:40, reorder:20, recv:40, used:0 },
      { id:'S04', cat:'น้ำยา',           name:'Coolant น้ำยาหล่อเย็น',              unit:'ลิตร',  cost:120, sell:190, qty:28, reorder:16, recv:28, used:0 },
      { id:'S05', cat:'น้ำมันเกียร์',    name:'ATF Dexron III',                     unit:'ลิตร',  cost:160, sell:250, qty:20, reorder:12, recv:20, used:0 },
      { id:'S06', cat:'น้ำมันเกียร์',    name:'ATF Dexron VI',                      unit:'ลิตร',  cost:180, sell:280, qty:20, reorder:12, recv:20, used:0 },
      { id:'S07', cat:'น้ำยา',           name:'TBR Fuel Plus',                      unit:'ขวด',   cost:200, sell:290, qty:30, reorder:10, recv:30, used:0 },
      { id:'S08', cat:'น้ำยา',           name:'Premium F1 Flushing',                unit:'ขวด',   cost:420, sell:590, qty:24, reorder:8,  recv:24, used:0 },
      { id:'S09', cat:'น้ำยา',           name:'Premium S1 Flushing',                unit:'ขวด',   cost:380, sell:540, qty:20, reorder:8,  recv:20, used:0 },
      { id:'S10', cat:'น้ำมันเกียร์',    name:'Gear Oil GL-5 90',                   unit:'ลิตร',  cost:160, sell:240, qty:11, reorder:8,  recv:11, used:0 },
      { id:'S11', cat:'น้ำมันเกียร์',    name:'ULV Gear Limited GLS',               unit:'ลิตร',  cost:380, sell:520, qty:6,  reorder:4,  recv:6,  used:0 },
      { id:'S12', cat:'น้ำมันเบรก',     name:'น้ำมันเบรก DOT4',                    unit:'ลิตร',  cost:140, sell:220, qty:12, reorder:8,  recv:12, used:0 },
      { id:'S13', cat:'น้ำยา',           name:'น้ำมันพวงมาลัยเพาเวอร์',             unit:'ลิตร',  cost:130, sell:200, qty:9,  reorder:6,  recv:9,  used:0 },
      { id:'C01', cat:'ไส้กรอง',         name:'ไส้กรองน้ำมันเครื่อง เบนซิน',       unit:'ชิ้น',  cost:120, sell:164, qty:40, reorder:15, recv:40, used:0 },
      { id:'C02', cat:'ไส้กรอง',         name:'ไส้กรองน้ำมันเครื่อง ดีเซล',        unit:'ชิ้น',  cost:180, sell:247, qty:12, reorder:8,  recv:12, used:0 },
      { id:'C03', cat:'ไส้กรอง',         name:'แหวนน็อตถ่ายน้ำมัน',                unit:'ชิ้น',  cost:8,   sell:11,  qty:80, reorder:30, recv:80, used:0 },
    ],

    /* ──────────────────────────────────
       Service Packages
       ราคาตั้งเอง — ไม่ตัดสต๊อกอัตโนมัติ
       ────────────────────────────────── */
    services: [
      { id:'SV01', name:'เปลี่ยนน้ำมันเครื่อง + ฟลัชชิ่ง', detail:'รวมค่าแรง + ฟรีตรวจ 15 รายการ', price:4500 },
      { id:'SV02', name:'ฟลัชชิ่งเกียร์ (Vacuum)',           detail:'ระบบดูดสุญญากาศ ไม่ต้องถอดอ่าง', price:2000 },
      { id:'SV03', name:'เปิดอ่างเกียร์ + ล้างสมองเกียร์',  detail:'รวมน้ำยาคลีนนิ่ง',              price:1500 },
      { id:'SV04', name:'Hybrid Service',                     detail:'บริการสำหรับรถ Hybrid โดยเฉพาะ', price:4000 },
      { id:'SV05', name:'เปลี่ยนน้ำมันเฟืองท้าย',           detail:'รวมค่าแรงและน้ำมัน',             price:2400 },
      { id:'SV06', name:'เปลี่ยนน้ำมันเบรก + ไล่ลม',        detail:'ไล่ลมครบ 4 ล้อ',                price:650  },
      { id:'SV07', name:'เปลี่ยนน้ำยาหล่อเย็น',             detail:'ล้างระบบ + เติมใหม่',            price:890  },
      { id:'SV08', name:'ตรวจเช็คช่วงล่าง',                 detail:'ด้วยเครื่องจำลองถนนจริง',        price:300  },
      { id:'SV09', name:'ค่าแรง / ค่าบริการทั่วไป',          detail:'',                               price:0    },
    ],

    /* ── Documents ── */
    invoices:       [],
    quotes:         [],
    purchaseOrders: [],

    /* ── Accounting ── */
    expenses: [],
  };
}

/* ══════════════════════════════════════
   MIGRATION — เพิ่มฟีลด์ใหม่ถ้าขาด
══════════════════════════════════════ */
function migrateData() {
  if (!S.vehicles)       S.vehicles       = [];
  if (!S.requisitions)   S.requisitions   = [];
  if (!S.stockItems)     S.stockItems     = seedData().stockItems;
  if (!S.services)       S.services       = seedData().services;
  if (!S.expenses)       S.expenses       = [];
  if (!S.purchaseOrders) S.purchaseOrders = [];
  if (!S.seq)            S.seq            = { job:1, inv:1, qt:1, po:1, rq:1 };
  if (!S.seq.rq)         S.seq.rq         = 1;
  if (!S.seq.po)         S.seq.po         = 1;
}
