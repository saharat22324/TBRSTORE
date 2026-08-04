-- TBR System: atomic service catalog writes.
-- Apply after 20260813_atomic_quote_lifecycle.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION save_service_atomic(p_original_code TEXT,p_service JSONB)
RETURNS services LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_service services; v_code TEXT:=BTRIM(COALESCE(p_service->>'service_code','')); v_original TEXT:=NULLIF(BTRIM(p_original_code),'');
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF v_code='' OR BTRIM(COALESCE(p_service->>'name',''))='' THEN RAISE EXCEPTION 'Service code and name are required'; END IF;
  IF COALESCE((p_service->>'price')::NUMERIC,0)<0 THEN RAISE EXCEPTION 'Service price cannot be negative'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_code,0));

  IF v_original IS NOT NULL THEN
    SELECT * INTO v_service FROM services WHERE service_code=v_original FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
    IF v_code<>v_original AND EXISTS(SELECT 1 FROM services WHERE service_code=v_code) THEN RAISE EXCEPTION 'Service code already exists'; END IF;
    UPDATE services SET service_code=v_code,name=BTRIM(p_service->>'name'),description=COALESCE(p_service->>'description',''),
      price=COALESCE((p_service->>'price')::NUMERIC,0),active=TRUE,updated_at=NOW()
    WHERE id=v_service.id RETURNING * INTO v_service;
  ELSE
    IF EXISTS(SELECT 1 FROM services WHERE service_code=v_code) THEN RAISE EXCEPTION 'Service code already exists'; END IF;
    INSERT INTO services(service_code,name,description,price,active,created_at,updated_at)
    VALUES(v_code,BTRIM(p_service->>'name'),COALESCE(p_service->>'description',''),COALESCE((p_service->>'price')::NUMERIC,0),TRUE,NOW(),NOW())
    RETURNING * INTO v_service;
  END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'SERVICE_SAVE','service',v_service.id::TEXT,v_service.service_code,jsonb_build_object('price',v_service.price));
  RETURN v_service;
END; $$;

CREATE OR REPLACE FUNCTION archive_service_atomic(p_service_code TEXT)
RETURNS services LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_service services;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_service FROM services WHERE service_code=BTRIM(p_service_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found'; END IF;
  IF NOT v_service.active THEN RAISE EXCEPTION 'Service is already archived'; END IF;
  UPDATE services SET active=FALSE,updated_at=NOW() WHERE id=v_service.id RETURNING * INTO v_service;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'SERVICE_ARCHIVE','service',v_service.id::TEXT,v_service.service_code);
  RETURN v_service;
END; $$;

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD;
BEGIN
  FOR v_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='services' AND cmd<>'SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.services',v_policy.policyname); END LOOP;
END $$;

REVOKE ALL ON FUNCTION save_service_atomic(TEXT,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION archive_service_atomic(TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_service_atomic(TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_service_atomic(TEXT) TO authenticated;
COMMIT;
