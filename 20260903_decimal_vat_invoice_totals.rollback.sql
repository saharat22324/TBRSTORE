-- Roll back the invoice trigger/function change from 20260903.
-- The additive quotes.vat_enabled column and compatible quote RPC are retained
-- so quotations created while the migration was active do not lose VAT state.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP TRIGGER IF EXISTS invoices_normalize_vat_totals ON invoices;
DROP FUNCTION IF EXISTS normalize_invoice_vat_totals();

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

CREATE TRIGGER invoices_normalize_vat_whole_baht
BEFORE INSERT OR UPDATE OF subtotal, discount, vat, grand_total ON invoices
FOR EACH ROW EXECUTE FUNCTION normalize_invoice_vat_whole_baht();

DELETE FROM schema_migrations
WHERE version = '20260903_decimal_vat_invoice_totals';

COMMIT;