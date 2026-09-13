-- Emergency rollback for 20260904_reconcile_decimal_vat_totals.sql.
-- Run only when affected invoices and payments have not changed since migration.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE invoice_payments IN SHARE ROW EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS invoices_normalize_vat_totals ON invoices;

DO $$
BEGIN
  IF to_regclass('public.invoice_decimal_vat_backup_20260904') IS NULL THEN
    RAISE EXCEPTION 'Rollback snapshot table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invoice_decimal_vat_backup_20260904 backup
    JOIN invoices invoice ON invoice.id = backup.invoice_id
    WHERE invoice.grand_total <> backup.new_grand_total
       OR COALESCE(invoice.version, 1) <> COALESCE((backup.invoice_snapshot->>'version')::INTEGER, 1) + 1
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: an affected invoice changed after reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invoice_decimal_vat_backup_20260904 backup
    WHERE (SELECT COUNT(*) FROM invoice_payments payment WHERE payment.invoice_id = backup.invoice_id)
          <> jsonb_array_length(backup.payment_snapshots)
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: payment rows changed after reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM invoice_decimal_vat_backup_20260904 backup
    CROSS JOIN LATERAL jsonb_array_elements(backup.payment_snapshots) original
    JOIN invoice_payments payment ON payment.id = (original->>'id')::UUID
    WHERE payment.amount <> (original->>'amount')::NUMERIC
          + CASE
              WHEN payment.id = backup.payment_adjustment_id
                THEN backup.new_grand_total - (backup.invoice_snapshot->>'grand_total')::NUMERIC
              ELSE 0
            END
       OR payment.reversed_at IS DISTINCT FROM (original->>'reversed_at')::TIMESTAMPTZ
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: an affected payment changed after reconciliation';
  END IF;
END;
$$;

WITH original_payments AS (
  SELECT (payment->>'id')::UUID AS id,
         (payment->>'amount')::NUMERIC(14,2) AS amount
  FROM invoice_decimal_vat_backup_20260904 backup
  CROSS JOIN LATERAL jsonb_array_elements(backup.payment_snapshots) AS payment
)
UPDATE invoice_payments payment
SET amount = original.amount
FROM original_payments original
WHERE payment.id = original.id;

UPDATE invoices invoice
SET vat = (backup.invoice_snapshot->>'vat')::NUMERIC,
    grand_total = (backup.invoice_snapshot->>'grand_total')::NUMERIC,
    payment_status = (backup.invoice_snapshot->>'payment_status')::BOOLEAN,
    status = backup.invoice_snapshot->>'status',
    version = COALESCE((backup.invoice_snapshot->>'version')::INTEGER, 1),
    updated_at = (backup.invoice_snapshot->>'updated_at')::TIMESTAMPTZ
FROM invoice_decimal_vat_backup_20260904 backup
WHERE invoice.id = backup.invoice_id;

CREATE TRIGGER invoices_normalize_vat_totals
BEFORE INSERT OR UPDATE OF subtotal, discount, vat, grand_total ON invoices
FOR EACH ROW EXECUTE FUNCTION normalize_invoice_vat_totals();

INSERT INTO audit_logs(user_id, user_name, action, entity_type, entity_id, entity_ref, details)
SELECT auth.uid(),
       'production-decimal-vat-reconciliation-rollback',
       'VAT_DECIMAL_RECONCILE_ROLLBACK',
       'invoice',
       backup.invoice_id::TEXT,
       backup.invoice_number,
       jsonb_build_object(
         'restored_vat', backup.invoice_snapshot->>'vat',
         'restored_grand_total', backup.invoice_snapshot->>'grand_total',
         'replaced_grand_total', backup.new_grand_total,
         'reason', 'Rollback historical decimal VAT reconciliation'
       )
FROM invoice_decimal_vat_backup_20260904 backup;

DELETE FROM schema_migrations
WHERE version = '20260904_reconcile_decimal_vat_totals';

COMMIT;