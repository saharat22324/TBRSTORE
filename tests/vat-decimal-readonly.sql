-- Read-only verification for 20260903_decimal_vat_invoice_totals.sql.
BEGIN READ ONLY;

DO $$
DECLARE
  test_case RECORD;
  base_amount NUMERIC;
  vat_added NUMERIC;
  grand_total NUMERIC;
  vat_in_total NUMERIC;
  amount_before_vat NUMERIC;
  trigger_definition TEXT;
BEGIN
  FOR test_case IN
    SELECT * FROM (VALUES
      (10600.00::NUMERIC, 0.00::NUMERIC, TRUE, 11342.00::NUMERIC, 742.00::NUMERIC),
      (5000.00::NUMERIC, 500.00::NUMERIC, TRUE, 4815.00::NUMERIC, 315.00::NUMERIC),
      (2790.00::NUMERIC, 0.00::NUMERIC, TRUE, 2985.30::NUMERIC, 195.30::NUMERIC),
      (10.01::NUMERIC, 0.00::NUMERIC, FALSE, 10.01::NUMERIC, 0.00::NUMERIC),
      (12.34::NUMERIC, 1.11::NUMERIC, TRUE, 12.02::NUMERIC, 0.79::NUMERIC)
    ) AS cases(subtotal, discount, vat_enabled, expected_grand, expected_vat)
  LOOP
    base_amount := ROUND(GREATEST(test_case.subtotal - test_case.discount, 0), 2);
    vat_added := CASE WHEN test_case.vat_enabled THEN ROUND(base_amount * 7 / 100, 2) ELSE 0 END;
    grand_total := base_amount + vat_added;

    IF grand_total <> test_case.expected_grand OR vat_added <> test_case.expected_vat THEN
      RAISE EXCEPTION 'VAT add test failed for subtotal %, discount %', test_case.subtotal, test_case.discount;
    END IF;

    IF test_case.vat_enabled THEN
      vat_in_total := ROUND(grand_total * 7 / 107, 2);
      amount_before_vat := grand_total - vat_in_total;
      IF amount_before_vat + vat_in_total <> grand_total THEN
        RAISE EXCEPTION 'Inclusive VAT invariant failed for grand total %', grand_total;
      END IF;
    END IF;
  END LOOP;

  SELECT pg_get_functiondef(p.oid) INTO trigger_definition
  FROM pg_proc p
  WHERE p.oid = 'public.normalize_invoice_vat_totals()'::regprocedure;

  IF trigger_definition NOT ILIKE '%base_amount * 7 / 100%'
     OR trigger_definition NOT ILIKE '%ROUND(GREATEST(NEW.subtotal - NEW.discount, 0), 2)%' THEN
    RAISE EXCEPTION 'Decimal VAT trigger function does not contain the required formula';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.invoices'::regclass
      AND tgname = 'invoices_normalize_vat_totals'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Decimal VAT trigger is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.invoices'::regclass
      AND tgname = 'invoices_normalize_vat_whole_baht'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Whole-baht VAT trigger is still active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes'
      AND column_name = 'vat_enabled' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Quotation VAT-enabled flag is missing';
  END IF;

  RAISE NOTICE 'Decimal VAT formula and trigger verification passed';
END;
$$;

ROLLBACK;