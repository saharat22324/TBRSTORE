-- Emergency rollback for 20260902_round_vat_invoice_totals.sql.
-- Run only before any later payment or invoice changes, and only after backup verification.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE invoice_payments IN SHARE ROW EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS invoices_normalize_vat_whole_baht ON invoices;
DROP FUNCTION IF EXISTS normalize_invoice_vat_whole_baht();

DO $$
BEGIN
  IF to_regclass('public.invoice_vat_rounding_backup_20260902') IS NULL THEN
    RAISE EXCEPTION 'Rollback snapshot table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invoice_vat_rounding_backup_20260902 b
    JOIN invoices i ON i.id = b.invoice_id
    WHERE i.grand_total <> b.new_grand_total
       OR COALESCE(i.version, 1) <> COALESCE((b.invoice_snapshot->>'version')::INTEGER, 1) + 1
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: an affected invoice changed after the VAT migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invoice_vat_rounding_backup_20260902 b
    WHERE (SELECT COUNT(*) FROM invoice_payments p WHERE p.invoice_id = b.invoice_id)
          <> jsonb_array_length(b.payment_snapshots)
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: payment rows changed after the VAT migration';
  END IF;
END;
$$;

WITH original_payments AS (
  SELECT (payment->>'id')::UUID AS id,
         (payment->>'amount')::NUMERIC(14,2) AS amount
  FROM invoice_vat_rounding_backup_20260902 b
  CROSS JOIN LATERAL jsonb_array_elements(b.payment_snapshots) AS payment
)
UPDATE invoice_payments p
SET amount = original.amount
FROM original_payments original
WHERE p.id = original.id;

UPDATE invoices i
SET grand_total = (b.invoice_snapshot->>'grand_total')::NUMERIC(14,2),
    payment_status = (b.invoice_snapshot->>'payment_status')::BOOLEAN,
    status = b.invoice_snapshot->>'status',
    version = COALESCE((b.invoice_snapshot->>'version')::INTEGER, 1),
    updated_at = (b.invoice_snapshot->>'updated_at')::TIMESTAMPTZ
FROM invoice_vat_rounding_backup_20260902 b
WHERE i.id = b.invoice_id;

INSERT INTO audit_logs(user_id, user_name, action, entity_type, entity_id, entity_ref, details)
SELECT auth.uid(),
       'production-vat-rounding-rollback',
       'VAT_WHOLE_BAHT_RECONCILE_ROLLBACK',
       'invoice',
       b.invoice_id::TEXT,
       b.invoice_number,
       jsonb_build_object(
         'restored_grand_total', b.invoice_snapshot->>'grand_total',
         'replaced_grand_total', b.new_grand_total,
         'reason', 'Rollback whole-baht VAT invoice reconciliation'
       )
FROM invoice_vat_rounding_backup_20260902 b;

DELETE FROM schema_migrations
WHERE version = '20260902_round_vat_invoice_totals';

COMMIT;
