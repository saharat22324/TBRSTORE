-- Read-only verification for 20260902_round_vat_invoice_totals.sql.
BEGIN READ ONLY;

DO $$
DECLARE
  vat_invoice_count INTEGER;
  invalid_total_count INTEGER;
  invalid_paid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO vat_invoice_count
  FROM invoices
  WHERE vat > 0;

  SELECT COUNT(*) INTO invalid_total_count
  FROM invoices
  WHERE vat > 0
    AND grand_total <> ROUND(
      GREATEST(subtotal - COALESCE(discount, 0), 0)
      + CASE
          WHEN vat > 0 AND vat <= 1
            THEN GREATEST(subtotal - COALESCE(discount, 0), 0) * vat
          ELSE vat
        END,
      0
    );

  SELECT COUNT(*) INTO invalid_paid_count
  FROM (
    SELECT i.id
    FROM invoices i
    LEFT JOIN invoice_payments p
      ON p.invoice_id = i.id AND p.reversed_at IS NULL
    WHERE i.payment_status OR i.status = 'paid'
    GROUP BY i.id, i.grand_total
    HAVING ROUND(COALESCE(SUM(p.amount), 0), 2) <> i.grand_total
  ) invalid_paid;

  RAISE NOTICE 'VAT invoices: %, invalid whole-baht totals: %, invalid paid ledgers: %',
    vat_invoice_count, invalid_total_count, invalid_paid_count;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.invoices'::regclass
      AND tgname = 'invoices_normalize_vat_whole_baht'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'VAT whole-baht trigger is missing';
  END IF;

  IF invalid_total_count <> 0 OR invalid_paid_count <> 0 THEN
    RAISE EXCEPTION 'VAT whole-baht verification failed';
  END IF;
END;
$$;

ROLLBACK;
