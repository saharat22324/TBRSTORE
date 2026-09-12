-- TBR System: round every VAT invoice grand total to whole baht.
-- The taxable base and VAT amount are derived by the application from that total.
-- Requires a verified pre-migration backup. Transactional and idempotent.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE invoice_payments IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS invoice_vat_rounding_backup_20260902 (
  invoice_id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  invoice_snapshot JSONB NOT NULL,
  payment_snapshots JSONB NOT NULL,
  new_grand_total NUMERIC(14,2) NOT NULL,
  payment_adjustment_id UUID,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoice_vat_rounding_backup_20260902 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_vat_rounding_backup_admin_read ON invoice_vat_rounding_backup_20260902;
CREATE POLICY invoice_vat_rounding_backup_admin_read ON invoice_vat_rounding_backup_20260902
  FOR SELECT TO authenticated
  USING (current_app_role() = 'admin');
REVOKE ALL ON TABLE invoice_vat_rounding_backup_20260902 FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE invoice_vat_rounding_backup_20260902 FROM authenticated;
GRANT SELECT ON TABLE invoice_vat_rounding_backup_20260902 TO authenticated;

CREATE OR REPLACE FUNCTION normalize_invoice_vat_whole_baht()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  taxable_base NUMERIC(14,2);
BEGIN
  IF COALESCE(NEW.vat, 0) > 0 THEN
    taxable_base := GREATEST(COALESCE(NEW.subtotal, 0) - COALESCE(NEW.discount, 0), 0);
    NEW.grand_total := ROUND(
      taxable_base
      + CASE WHEN NEW.vat <= 1 THEN taxable_base * NEW.vat ELSE NEW.vat END,
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_normalize_vat_whole_baht ON invoices;
CREATE TRIGGER invoices_normalize_vat_whole_baht
BEFORE INSERT OR UPDATE OF subtotal, discount, vat, grand_total ON invoices
FOR EACH ROW EXECUTE FUNCTION normalize_invoice_vat_whole_baht();

CREATE TEMP TABLE vat_rounding_targets ON COMMIT DROP AS
SELECT i.id AS invoice_id,
       i.invoice_number,
       i.grand_total AS old_grand_total,
       ROUND(
         GREATEST(i.subtotal - COALESCE(i.discount, 0), 0)
         + CASE
             WHEN i.vat > 0 AND i.vat <= 1
               THEN GREATEST(i.subtotal - COALESCE(i.discount, 0), 0) * i.vat
             ELSE i.vat
           END,
         0
       )::NUMERIC(14,2) AS new_grand_total,
       (i.payment_status OR i.status = 'paid') AS was_paid,
       COALESCE((
         SELECT SUM(p.amount)
         FROM invoice_payments p
         WHERE p.invoice_id = i.id AND p.reversed_at IS NULL
       ), 0)::NUMERIC(14,2) AS active_payment_total,
       CASE WHEN i.payment_status OR i.status = 'paid' THEN (
         SELECT p.id
         FROM invoice_payments p
         WHERE p.invoice_id = i.id AND p.reversed_at IS NULL
         ORDER BY p.paid_at DESC, p.created_at DESC, p.id DESC
         LIMIT 1
       ) END AS payment_adjustment_id
FROM invoices i
WHERE i.vat > 0
  AND i.grand_total <> ROUND(
    GREATEST(i.subtotal - COALESCE(i.discount, 0), 0)
    + CASE
        WHEN i.vat > 0 AND i.vat <= 1
          THEN GREATEST(i.subtotal - COALESCE(i.discount, 0), 0) * i.vat
        ELSE i.vat
      END,
    0
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM vat_rounding_targets
    WHERE was_paid
      AND (payment_adjustment_id IS NULL OR active_payment_total <> old_grand_total)
  ) THEN
    RAISE EXCEPTION 'Paid invoice precondition failed: active payments must exactly match the old grand total';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM vat_rounding_targets t
    JOIN invoice_payments p ON p.id = t.payment_adjustment_id
    WHERE p.amount + (t.new_grand_total - t.old_grand_total) <= 0
  ) THEN
    RAISE EXCEPTION 'Payment adjustment would produce a non-positive payment';
  END IF;
END;
$$;

INSERT INTO invoice_vat_rounding_backup_20260902(
  invoice_id,
  invoice_number,
  invoice_snapshot,
  payment_snapshots,
  new_grand_total,
  payment_adjustment_id
)
SELECT i.id,
       i.invoice_number,
       to_jsonb(i),
       COALESCE((
         SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at, p.id)
         FROM invoice_payments p
         WHERE p.invoice_id = i.id
       ), '[]'::JSONB),
       t.new_grand_total,
       t.payment_adjustment_id
FROM vat_rounding_targets t
JOIN invoices i ON i.id = t.invoice_id
ON CONFLICT (invoice_id) DO NOTHING;

UPDATE invoice_payments p
SET amount = ROUND(p.amount + (t.new_grand_total - t.old_grand_total), 2)
FROM vat_rounding_targets t
WHERE t.was_paid
  AND p.id = t.payment_adjustment_id;

UPDATE invoices i
SET grand_total = t.new_grand_total,
    version = COALESCE(i.version, 1) + 1,
    updated_at = NOW()
FROM vat_rounding_targets t
WHERE i.id = t.invoice_id;

INSERT INTO audit_logs(user_id, user_name, action, entity_type, entity_id, entity_ref, details)
SELECT auth.uid(),
       'production-vat-rounding',
       'VAT_WHOLE_BAHT_RECONCILE',
       'invoice',
       t.invoice_id::TEXT,
       t.invoice_number,
       jsonb_build_object(
         'old_grand_total', t.old_grand_total,
         'new_grand_total', t.new_grand_total,
         'payment_adjustment_id', t.payment_adjustment_id,
         'payment_delta', CASE WHEN t.was_paid THEN t.new_grand_total - t.old_grand_total ELSE 0 END,
         'reason', 'Round VAT invoice grand total to whole baht and preserve paid status'
       )
FROM vat_rounding_targets t;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM invoices i
    WHERE i.vat > 0
      AND i.grand_total <> ROUND(
        GREATEST(i.subtotal - COALESCE(i.discount, 0), 0)
        + CASE
            WHEN i.vat > 0 AND i.vat <= 1
              THEN GREATEST(i.subtotal - COALESCE(i.discount, 0), 0) * i.vat
            ELSE i.vat
          END,
        0
      )
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: VAT invoice totals are not whole-baht totals';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM vat_rounding_targets t
    JOIN invoices i ON i.id = t.invoice_id
    LEFT JOIN invoice_payments p
      ON p.invoice_id = i.id AND p.reversed_at IS NULL
    WHERE t.was_paid
    GROUP BY t.invoice_id, i.grand_total
    HAVING ROUND(COALESCE(SUM(p.amount), 0), 2) <> i.grand_total
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: a paid invoice no longer matches its active payments';
  END IF;
END;
$$;

INSERT INTO schema_migrations(version, description, applied_by)
VALUES(
  '20260902_round_vat_invoice_totals',
  'Round all VAT invoice totals to whole baht, preserve settled payments, and enforce future totals',
  auth.uid()
)
ON CONFLICT(version) DO UPDATE SET description = EXCLUDED.description;

COMMIT;
