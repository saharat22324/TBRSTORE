-- TBR System: reconcile historical VAT invoices to exact two-decimal totals.
-- Paid invoices keep their settled status by adjusting the latest active payment
-- by exactly the same delta as the invoice total.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE invoices IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE invoice_payments IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS invoice_decimal_vat_backup_20260904 (
  invoice_id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  invoice_snapshot JSONB NOT NULL,
  payment_snapshots JSONB NOT NULL,
  new_grand_total NUMERIC(14,2) NOT NULL,
  payment_adjustment_id UUID,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoice_decimal_vat_backup_20260904 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_decimal_vat_backup_admin_read ON invoice_decimal_vat_backup_20260904;
CREATE POLICY invoice_decimal_vat_backup_admin_read ON invoice_decimal_vat_backup_20260904
  FOR SELECT TO authenticated
  USING (current_app_role() = 'admin');
REVOKE ALL ON TABLE invoice_decimal_vat_backup_20260904 FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE invoice_decimal_vat_backup_20260904 FROM authenticated;
GRANT SELECT ON TABLE invoice_decimal_vat_backup_20260904 TO authenticated;

CREATE TEMP TABLE decimal_vat_targets ON COMMIT DROP AS
SELECT i.id AS invoice_id,
       i.invoice_number,
       i.vat AS old_vat,
       i.grand_total AS old_grand_total,
       ROUND(
         GREATEST(COALESCE(i.subtotal, 0) - COALESCE(i.discount, 0), 0)
         + ROUND(GREATEST(COALESCE(i.subtotal, 0) - COALESCE(i.discount, 0), 0) * 7 / 100, 2),
         2
       )::NUMERIC(14,2) AS new_grand_total,
       (i.payment_status OR i.status = 'paid') AS was_paid,
       (
         SELECT COUNT(*)
         FROM invoice_payments p
         WHERE p.invoice_id = i.id AND p.reversed_at IS NULL
       ) AS active_payment_count,
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
WHERE COALESCE(i.document_type, 'invoice') NOT IN ('credit_note', 'debit_note')
  AND COALESCE(i.vat, 0) > 0
  AND (
    i.vat <> 7::NUMERIC / 100
    OR i.grand_total <> ROUND(
      GREATEST(COALESCE(i.subtotal, 0) - COALESCE(i.discount, 0), 0)
      + ROUND(GREATEST(COALESCE(i.subtotal, 0) - COALESCE(i.discount, 0), 0) * 7 / 100, 2),
      2
    )
  );

DO $$
DECLARE
  target_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO target_count FROM decimal_vat_targets;
  IF target_count <> 9 THEN
    RAISE EXCEPTION 'Historical VAT target count changed: expected 9, found %', target_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM decimal_vat_targets
    WHERE NOT was_paid
       OR active_payment_count <> 1
       OR payment_adjustment_id IS NULL
       OR active_payment_total <> old_grand_total
  ) THEN
    RAISE EXCEPTION 'Paid invoice precondition failed: every target must have one active payment matching the old grand total';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM decimal_vat_targets target
    JOIN invoice_payments payment ON payment.id = target.payment_adjustment_id
    WHERE payment.amount + (target.new_grand_total - target.old_grand_total) <= 0
  ) THEN
    RAISE EXCEPTION 'Payment adjustment would produce a non-positive payment';
  END IF;
END;
$$;

INSERT INTO invoice_decimal_vat_backup_20260904(
  invoice_id,
  invoice_number,
  invoice_snapshot,
  payment_snapshots,
  new_grand_total,
  payment_adjustment_id
)
SELECT invoice.id,
       invoice.invoice_number,
       to_jsonb(invoice),
       COALESCE((
         SELECT jsonb_agg(to_jsonb(payment) ORDER BY payment.created_at, payment.id)
         FROM invoice_payments payment
         WHERE payment.invoice_id = invoice.id
       ), '[]'::JSONB),
       target.new_grand_total,
       target.payment_adjustment_id
FROM decimal_vat_targets target
JOIN invoices invoice ON invoice.id = target.invoice_id
ON CONFLICT (invoice_id) DO NOTHING;

UPDATE invoice_payments payment
SET amount = ROUND(payment.amount + (target.new_grand_total - target.old_grand_total), 2)
FROM decimal_vat_targets target
WHERE target.was_paid
  AND payment.id = target.payment_adjustment_id
  AND payment.reversed_at IS NULL;

UPDATE invoices invoice
SET vat = 7::NUMERIC / 100,
    grand_total = target.new_grand_total,
  payment_status = CASE WHEN target.was_paid THEN TRUE ELSE invoice.payment_status END,
  status = CASE WHEN target.was_paid THEN 'paid' ELSE invoice.status END,
    version = COALESCE(invoice.version, 1) + 1,
    updated_at = NOW()
FROM decimal_vat_targets target
WHERE invoice.id = target.invoice_id;

INSERT INTO audit_logs(user_id, user_name, action, entity_type, entity_id, entity_ref, details)
SELECT auth.uid(),
       'production-decimal-vat-reconciliation',
       'VAT_DECIMAL_RECONCILE',
       'invoice',
       target.invoice_id::TEXT,
       target.invoice_number,
       jsonb_build_object(
         'old_vat', target.old_vat,
         'new_vat', 7::NUMERIC / 100,
         'old_grand_total', target.old_grand_total,
         'new_grand_total', target.new_grand_total,
         'payment_adjustment_id', target.payment_adjustment_id,
         'payment_delta', CASE WHEN target.was_paid THEN target.new_grand_total - target.old_grand_total ELSE 0 END,
         'reason', 'Reconcile historical VAT invoice and payment to two-decimal 7% calculation'
       )
FROM decimal_vat_targets target;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM invoices invoice
    WHERE COALESCE(invoice.document_type, 'invoice') NOT IN ('credit_note', 'debit_note')
      AND COALESCE(invoice.vat, 0) > 0
      AND (
        invoice.vat <> 7::NUMERIC / 100
        OR invoice.grand_total <> ROUND(
          GREATEST(COALESCE(invoice.subtotal, 0) - COALESCE(invoice.discount, 0), 0)
          + ROUND(GREATEST(COALESCE(invoice.subtotal, 0) - COALESCE(invoice.discount, 0), 0) * 7 / 100, 2),
          2
        )
      )
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: historical VAT invoice totals remain inconsistent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM decimal_vat_targets target
    JOIN invoices invoice ON invoice.id = target.invoice_id
    LEFT JOIN invoice_payments payment
      ON payment.invoice_id = invoice.id AND payment.reversed_at IS NULL
    WHERE target.was_paid
    GROUP BY target.invoice_id, invoice.grand_total
    HAVING ROUND(COALESCE(SUM(payment.amount), 0), 2) <> invoice.grand_total
  ) THEN
    RAISE EXCEPTION 'Postcondition failed: a paid invoice no longer matches its active payments';
  END IF;
END;
$$;

INSERT INTO schema_migrations(version, description, applied_by)
VALUES(
  '20260904_reconcile_decimal_vat_totals',
  'Reconcile historical VAT invoices and settled payments to exact two-decimal 7% totals',
  auth.uid()
)
ON CONFLICT(version) DO UPDATE SET description = EXCLUDED.description;

COMMIT;