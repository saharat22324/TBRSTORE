-- TBR System: Production hardening phase 1
-- Run AFTER add-tax-invoice-support.sql and fix-schema-mismatch.sql.
-- This migration is additive and idempotent. Test in staging before production.

BEGIN;

-- ── Document lifecycle ───────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS original_invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) NOT NULL DEFAULT 'invoice',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft','issued','paid','cancelled','credited','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE invoices ADD CONSTRAINT invoices_document_type_check
    CHECK (document_type IN ('invoice','tax_invoice','credit_note','debit_note'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_original_invoice_id ON invoices(original_invoice_id);

-- ── Payment ledger (replaces a single paid boolean over time) ────────────────
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash','transfer','promptpay','card','other')),
  reference VARCHAR(255),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_paid_at ON invoice_payments(paid_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id TEXT,
  entity_ref VARCHAR(255),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ── Atomic document sequences ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequences (
  document_type VARCHAR(30) NOT NULL,
  buddhist_year INTEGER NOT NULL,
  branch_code VARCHAR(10) NOT NULL DEFAULT '00000',
  last_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_type, buddhist_year, branch_code)
);

CREATE OR REPLACE FUNCTION next_document_number(
  p_document_type VARCHAR,
  p_prefix VARCHAR,
  p_branch_code VARCHAR DEFAULT '00000'
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 543;
  v_next BIGINT;
BEGIN
  INSERT INTO document_sequences(document_type, buddhist_year, branch_code, last_number)
  VALUES (p_document_type, v_year, COALESCE(NULLIF(p_branch_code,''), '00000'), 1)
  ON CONFLICT (document_type, buddhist_year, branch_code)
  DO UPDATE SET last_number = document_sequences.last_number + 1, updated_at = NOW()
  RETURNING last_number INTO v_next;

  RETURN p_prefix || '-' || v_year::TEXT || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

-- ── Header + line items are committed or rolled back together ───────────────
CREATE OR REPLACE FUNCTION create_invoice_atomic(
  p_invoice JSONB,
  p_items JSONB
) RETURNS invoices
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_invoice invoices;
  v_item JSONB;
BEGIN
  INSERT INTO invoices (
    invoice_number, job_id, customer_id, vehicle_id,
    customer_name, plate, phone, car_model,
    subtotal, discount, vat, grand_total, note, created_by,
    status, document_type, invoice_type
  ) VALUES (
    p_invoice->>'invoice_number',
    NULLIF(p_invoice->>'job_id','')::UUID,
    NULLIF(p_invoice->>'customer_id','')::UUID,
    NULLIF(p_invoice->>'vehicle_id','')::UUID,
    NULLIF(p_invoice->>'customer_name',''),
    NULLIF(p_invoice->>'plate',''),
    NULLIF(p_invoice->>'phone',''),
    NULLIF(p_invoice->>'car_model',''),
    COALESCE((p_invoice->>'subtotal')::DECIMAL, 0),
    COALESCE((p_invoice->>'discount')::DECIMAL, 0),
    COALESCE((p_invoice->>'vat')::DECIMAL, 0),
    COALESCE((p_invoice->>'grand_total')::DECIMAL, 0),
    NULLIF(p_invoice->>'note',''),
    auth.uid(),
    COALESCE(NULLIF(p_invoice->>'status',''), 'issued'),
    COALESCE(NULLIF(p_invoice->>'document_type',''), 'invoice'),
    COALESCE(NULLIF(p_invoice->>'invoice_type',''), 'receipt')
  ) RETURNING * INTO v_invoice;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::JSONB)) LOOP
    INSERT INTO invoice_items (
      invoice_id, item_type, stock_item_id, service_id, description,
      quantity, unit_price, cost_price, total, note
    ) VALUES (
      v_invoice.id,
      COALESCE(NULLIF(v_item->>'item_type',''), 'service'),
      NULLIF(v_item->>'stock_item_id','')::UUID,
      NULLIF(v_item->>'service_id','')::UUID,
      COALESCE(v_item->>'description',''),
      COALESCE((v_item->>'quantity')::DECIMAL, 0),
      COALESCE((v_item->>'unit_price')::DECIMAL, 0),
      COALESCE((v_item->>'cost_price')::DECIMAL, 0),
      COALESCE((v_item->>'total')::DECIMAL, 0),
      NULLIF(v_item->>'note','')
    );
  END LOOP;

  RETURN v_invoice;
END;
$$;

-- Cancels once and restores stock once. The invoice row remains for audit/tax.
CREATE OR REPLACE FUNCTION cancel_invoice_atomic(
  p_invoice_id UUID,
  p_reason TEXT
) RETURNS invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice invoices;
BEGIN
  IF COALESCE((SELECT role::TEXT FROM profiles WHERE id = auth.uid()), '') <> 'admin' THEN
    RAISE EXCEPTION 'Only admin can cancel an invoice';
  END IF;

  IF COALESCE(BTRIM(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status = 'cancelled' THEN RETURN v_invoice; END IF;

  UPDATE stock_items s
  SET quantity = s.quantity + x.quantity,
      updated_at = NOW()
  FROM (
    SELECT stock_item_id, SUM(quantity) AS quantity
    FROM invoice_items
    WHERE invoice_id = p_invoice_id AND stock_item_id IS NOT NULL
    GROUP BY stock_item_id
  ) x
  WHERE s.id = x.stock_item_id;

  UPDATE invoices
  SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = auth.uid(),
      cancellation_reason = BTRIM(p_reason), payment_status = FALSE,
      version = version + 1, updated_at = NOW()
  WHERE id = p_invoice_id
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

-- Prevent destructive deletion of issued accounting documents.
CREATE OR REPLACE FUNCTION prevent_issued_invoice_delete() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Issued invoices must be cancelled, not deleted';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_issued_invoice_delete ON invoices;
CREATE TRIGGER trg_prevent_issued_invoice_delete
BEFORE DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION prevent_issued_invoice_delete();

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_read_invoice_payments ON invoice_payments;
DROP POLICY IF EXISTS team_write_invoice_payments ON invoice_payments;
CREATE POLICY team_read_invoice_payments ON invoice_payments
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY team_write_invoice_payments ON invoice_payments
  FOR INSERT TO authenticated WITH CHECK (received_by IS NULL OR received_by = auth.uid());

DROP POLICY IF EXISTS team_read_document_sequences ON document_sequences;
DROP POLICY IF EXISTS team_write_document_sequences ON document_sequences;
CREATE POLICY team_read_document_sequences ON document_sequences
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY team_write_document_sequences ON document_sequences
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT EXECUTE ON FUNCTION next_document_number(VARCHAR,VARCHAR,VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION create_invoice_atomic(JSONB,JSONB) TO authenticated;
REVOKE ALL ON FUNCTION cancel_invoice_atomic(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_invoice_atomic(UUID,TEXT) TO authenticated;

COMMIT;
