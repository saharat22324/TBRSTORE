-- รองรับใบกำกับภาษีเต็มรูปและเก็บ snapshot ข้อมูลผู้ซื้อไว้กับเอกสาร
-- รันไฟล์นี้ครั้งเดียวใน Supabase SQL Editor ก่อนใช้งานฟีเจอร์บนหลายอุปกรณ์

BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(13),
  ADD COLUMN IF NOT EXISTS branch_no VARCHAR(5) DEFAULT '00000',
  ADD COLUMN IF NOT EXISTS billing_address TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'receipt',
  ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS buyer_address TEXT,
  ADD COLUMN IF NOT EXISTS buyer_tax_id VARCHAR(13),
  ADD COLUMN IF NOT EXISTS buyer_branch VARCHAR(100);

COMMENT ON COLUMN customers.branch_no IS '00000 = สำนักงานใหญ่, ค่าอื่น = เลขสาขา 5 หลัก';
COMMENT ON COLUMN invoices.invoice_type IS 'receipt หรือ tax_invoice';
COMMENT ON COLUMN invoices.buyer_name IS 'Snapshot ชื่อผู้ซื้อ ณ วันที่ออกเอกสาร';
COMMENT ON COLUMN invoices.buyer_address IS 'Snapshot ที่อยู่ผู้ซื้อ ณ วันที่ออกเอกสาร';
COMMENT ON COLUMN invoices.buyer_tax_id IS 'Snapshot เลขประจำตัวผู้เสียภาษี 13 หลัก';
COMMENT ON COLUMN invoices.buyer_branch IS 'Snapshot สำนักงานใหญ่หรือสาขาของผู้ซื้อ';

CREATE INDEX IF NOT EXISTS idx_customers_tax_id ON customers(tax_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);

COMMIT;
