-- ✅ FIX: Invoice Number Sequence
-- Run this in Supabase SQL Editor to enable invoice creation

-- 1. Create sequence if not exists
CREATE SEQUENCE IF NOT EXISTS invoice_seq 
  START WITH 20260619001 
  INCREMENT BY 1;

-- 2. Update invoices table to use sequence for invoice_number
ALTER TABLE invoices 
ALTER COLUMN invoice_number SET DEFAULT (
  'INV-' || 
  TO_CHAR(NOW(), 'YYYYMMDD') || 
  '-' || LPAD(NEXTVAL('invoice_seq')::TEXT, 3, '0')
);

-- 3. Verify (should return current value)
SELECT CURRVAL('invoice_seq');
