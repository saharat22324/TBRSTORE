-- Read-only verification for 20260904_reconcile_decimal_vat_totals.sql.
BEGIN READ ONLY;

DO $$
DECLARE
  invalid_invoice_count INTEGER;
  invalid_paid_count INTEGER;
  backup_count INTEGER;
  month_summary RECORD;
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

  FOR month_summary IN
    WITH invoice_audit AS (
      SELECT COALESCE(invoice.invoice_date, invoice.created_at::DATE) AS document_date,
             COALESCE(invoice.vat, 0) AS vat_rate,
             ROUND(GREATEST(COALESCE(invoice.subtotal, 0) - COALESCE(invoice.discount, 0), 0), 2) AS base_amount,
             ROUND(COALESCE(invoice.grand_total, 0), 2) AS actual_grand_total
      FROM invoices invoice
      WHERE COALESCE(invoice.document_type, 'invoice') NOT IN ('credit_note', 'debit_note')
    ),
    evaluated AS (
      SELECT invoice_audit.*,
             CASE
               WHEN vat_rate > 0 THEN ROUND(base_amount + ROUND(base_amount * 7 / 100, 2), 2)
               ELSE base_amount
             END AS expected_grand_total,
             CASE
               WHEN vat_rate > 0 THEN ROUND(actual_grand_total * 7 / 107, 2)
               ELSE 0
             END AS included_vat
      FROM invoice_audit
    )
    SELECT TO_CHAR(document_date, 'YYYY-MM') AS billing_month,
           COUNT(*) AS invoice_count,
           COUNT(*) FILTER (WHERE actual_grand_total <> expected_grand_total) AS historical_difference_count,
           COUNT(*) FILTER (
             WHERE ROUND((actual_grand_total - included_vat) + included_vat, 2) <> actual_grand_total
           ) AS breakdown_error_count
    FROM evaluated
    GROUP BY TO_CHAR(document_date, 'YYYY-MM')
    ORDER BY billing_month
  LOOP
    RAISE NOTICE 'VAT month %, invoices %, historical differences %, breakdown errors %',
      month_summary.billing_month,
      month_summary.invoice_count,
      month_summary.historical_difference_count,
      month_summary.breakdown_error_count;

    IF month_summary.historical_difference_count <> 0 OR month_summary.breakdown_error_count <> 0 THEN
      RAISE EXCEPTION 'Monthly VAT verification failed for %', month_summary.billing_month;
    END IF;
  END LOOP;

  IF backup_count = 0 THEN
    RAISE EXCEPTION 'Historical VAT reconciliation backup is empty';
  END IF;
  IF invalid_invoice_count <> 0 OR invalid_paid_count <> 0 THEN
    RAISE EXCEPTION 'Historical VAT reconciliation verification failed';
  END IF;
END;
$$;

ROLLBACK;