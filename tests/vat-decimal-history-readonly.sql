-- Read-only verification for 20260904_reconcile_decimal_vat_totals.sql.
BEGIN READ ONLY;

DO $$
DECLARE
  invalid_invoice_count INTEGER;
  invalid_paid_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_invoice_count
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
    );

  SELECT COUNT(*) INTO invalid_paid_count
  FROM (
    SELECT invoice.id
    FROM invoices invoice
    LEFT JOIN invoice_payments payment
      ON payment.invoice_id = invoice.id AND payment.reversed_at IS NULL
    WHERE invoice.payment_status OR invoice.status = 'paid'
    GROUP BY invoice.id, invoice.grand_total
    HAVING ROUND(COALESCE(SUM(payment.amount), 0), 2) <> invoice.grand_total
  ) invalid_paid;

  SELECT COUNT(*) INTO backup_count
  FROM invoice_decimal_vat_backup_20260904;

  RAISE NOTICE 'Historical VAT backup rows: %, invalid VAT invoices: %, invalid paid ledgers: %',
    backup_count, invalid_invoice_count, invalid_paid_count;

  IF backup_count = 0 THEN
    RAISE EXCEPTION 'Historical VAT reconciliation backup is empty';
  END IF;
  IF invalid_invoice_count <> 0 OR invalid_paid_count <> 0 THEN
    RAISE EXCEPTION 'Historical VAT reconciliation verification failed';
  END IF;
END;
$$;

ROLLBACK;