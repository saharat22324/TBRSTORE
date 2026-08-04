-- TBR System: atomic quotation creation and conversion.
-- Apply after 20260812_fractional_invoice_stock.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

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

  INSERT INTO quotes(no,cust_name,phone,plate,car_model,items,sub,disc,vat,grand,note,ref,converted,created_by,created_at,updated_at)
  VALUES(v_number,NULLIF(p_quote->>'cust_name',''),NULLIF(p_quote->>'phone',''),NULLIF(p_quote->>'plate',''),
    NULLIF(p_quote->>'car_model',''),COALESCE(p_quote->'items','[]'::JSONB),COALESCE((p_quote->>'sub')::NUMERIC,0),
    COALESCE((p_quote->>'disc')::NUMERIC,0),COALESCE((p_quote->>'vat')::NUMERIC,0),
    COALESCE((p_quote->>'grand')::NUMERIC,0),NULLIF(p_quote->>'note',''),NULLIF(p_quote->>'ref',''),FALSE,auth.uid(),NOW(),NOW())
  RETURNING * INTO v_quote;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'QUOTE_CREATE','quote',v_quote.id::TEXT,v_quote.no,jsonb_build_object('grand',v_quote.grand));
  RETURN v_quote;
END; $$;

CREATE OR REPLACE FUNCTION convert_quote_atomic(p_quote_id UUID)
RETURNS quotes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_quote quotes;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_quote FROM quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found'; END IF;
  IF v_quote.converted THEN RAISE EXCEPTION 'Quotation was already converted'; END IF;
  UPDATE quotes SET converted=TRUE,updated_at=NOW() WHERE id=v_quote.id RETURNING * INTO v_quote;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'QUOTE_CONVERT','quote',v_quote.id::TEXT,v_quote.no);
  RETURN v_quote;
END; $$;

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='quotes' AND cmd<>'SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.quotes',v_policy.policyname); END LOOP;
END $$;
DROP POLICY IF EXISTS quotes_all ON quotes;
DROP POLICY IF EXISTS team_write_qt ON quotes;
DROP POLICY IF EXISTS team_update_qt ON quotes;
DROP POLICY IF EXISTS team_delete_qt ON quotes;
DROP POLICY IF EXISTS quotes_insert ON quotes;
DROP POLICY IF EXISTS quotes_update ON quotes;
DROP POLICY IF EXISTS quotes_delete ON quotes;

REVOKE ALL ON FUNCTION create_quote_atomic(JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION convert_quote_atomic(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_quote_atomic(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_quote_atomic(UUID) TO authenticated;
COMMIT;
