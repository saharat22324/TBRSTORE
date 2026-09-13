-- TBR System: calculate invoice VAT at 7% after discount and store satang.
-- Existing issued documents are not rewritten; future inserts/updates are normalized.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DROP TRIGGER IF EXISTS invoices_normalize_vat_whole_baht ON invoices;
DROP FUNCTION IF EXISTS normalize_invoice_vat_whole_baht();

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN;
UPDATE quotes SET vat_enabled = COALESCE(vat_enabled, vat > 0);
ALTER TABLE quotes ALTER COLUMN vat_enabled SET DEFAULT FALSE;
ALTER TABLE quotes ALTER COLUMN vat_enabled SET NOT NULL;

CREATE OR REPLACE FUNCTION normalize_invoice_vat_totals()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  base_amount NUMERIC(14,2);
  vat_added NUMERIC(14,2);
BEGIN
  IF COALESCE(NEW.document_type, 'invoice') IN ('credit_note', 'debit_note') THEN
    NEW.subtotal := ROUND(COALESCE(NEW.subtotal, 0), 2);
    NEW.discount := ROUND(COALESCE(NEW.discount, 0), 2);
    NEW.grand_total := ROUND(COALESCE(NEW.grand_total, 0), 2);
    RETURN NEW;
  END IF;

  NEW.subtotal := ROUND(COALESCE(NEW.subtotal, 0), 2);
  NEW.discount := ROUND(COALESCE(NEW.discount, 0), 2);
  base_amount := ROUND(GREATEST(NEW.subtotal - NEW.discount, 0), 2);

  IF COALESCE(NEW.vat, 0) > 0 THEN
    NEW.vat := 7::NUMERIC / 100;
    vat_added := ROUND(base_amount * 7 / 100, 2);
    NEW.grand_total := base_amount + vat_added;
  ELSE
    NEW.vat := 0;
    NEW.grand_total := base_amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_normalize_vat_totals ON invoices;
CREATE TRIGGER invoices_normalize_vat_totals
BEFORE INSERT OR UPDATE OF subtotal, discount, vat, grand_total ON invoices
FOR EACH ROW EXECUTE FUNCTION normalize_invoice_vat_totals();

CREATE OR REPLACE FUNCTION create_quote_atomic(p_quote JSONB)
RETURNS quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_quote quotes; v_number TEXT;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  v_number:=BTRIM(COALESCE(p_quote->>'no',''));
  IF v_number='' THEN RAISE EXCEPTION 'Quotation number is required'; END IF;
  IF jsonb_array_length(COALESCE(p_quote->'items','[]'::JSONB))=0 THEN RAISE EXCEPTION 'Quotation requires items'; END IF;
  IF COALESCE((p_quote->>'grand')::NUMERIC,0)<=0 THEN RAISE EXCEPTION 'Quotation total must be positive'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_number,0));
  IF EXISTS(SELECT 1 FROM quotes WHERE no=v_number) THEN RAISE EXCEPTION 'Quotation number already exists'; END IF;

  INSERT INTO quotes(no,cust_name,phone,plate,car_model,items,sub,disc,vat,vat_enabled,grand,note,ref,converted,created_by,created_at,updated_at)
  VALUES(v_number,NULLIF(p_quote->>'cust_name',''),NULLIF(p_quote->>'phone',''),NULLIF(p_quote->>'plate',''),
    NULLIF(p_quote->>'car_model',''),COALESCE(p_quote->'items','[]'::JSONB),COALESCE((p_quote->>'sub')::NUMERIC,0),
    COALESCE((p_quote->>'disc')::NUMERIC,0),COALESCE((p_quote->>'vat')::NUMERIC,0),
    COALESCE((p_quote->>'vat_enabled')::BOOLEAN,COALESCE((p_quote->>'vat')::NUMERIC,0)>0),
    COALESCE((p_quote->>'grand')::NUMERIC,0),NULLIF(p_quote->>'note',''),NULLIF(p_quote->>'ref',''),FALSE,auth.uid(),NOW(),NOW())
  RETURNING * INTO v_quote;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'QUOTE_CREATE','quote',v_quote.id::TEXT,v_quote.no,jsonb_build_object('grand',v_quote.grand));
  RETURN v_quote;
END; $$;

REVOKE ALL ON FUNCTION create_quote_atomic(JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_quote_atomic(JSONB) TO authenticated;

INSERT INTO schema_migrations(version, description, applied_by)
VALUES(
  '20260903_decimal_vat_invoice_totals',
  'Calculate 7% VAT after discount with NUMERIC arithmetic and persist quotation VAT state',
  auth.uid()
)
ON CONFLICT(version) DO UPDATE SET description = EXCLUDED.description;

COMMIT;