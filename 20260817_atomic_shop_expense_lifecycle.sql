-- TBR System: atomic shop configuration and expense lifecycle.
-- Apply after 20260816_atomic_invoice_maintenance.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE OR REPLACE FUNCTION save_shop_config_atomic(p_config JSONB)
RETURNS shop_config LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_config shop_config; v_name TEXT:=BTRIM(COALESCE(p_config->>'name','')); v_tax_id TEXT:=REGEXP_REPLACE(COALESCE(p_config->>'tax_id',''),'[^0-9]','','g');
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can update shop configuration'; END IF;
  IF v_name='' THEN RAISE EXCEPTION 'Shop name is required'; END IF;
  IF v_tax_id<>'' AND v_tax_id !~ '^[0-9]{13}$' THEN RAISE EXCEPTION 'Shop tax ID must contain 13 digits'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('shop_config',0));
  SELECT * INTO v_config FROM shop_config ORDER BY id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE shop_config SET name=v_name,address=NULLIF(p_config->>'address',''),phone=NULLIF(p_config->>'phone',''),
      tax_id=NULLIF(v_tax_id,''),line_id=NULLIF(p_config->>'line_id',''),note=NULLIF(p_config->>'note',''),updated_at=NOW()
    WHERE id=v_config.id RETURNING * INTO v_config;
  ELSE
    INSERT INTO shop_config(name,address,phone,tax_id,line_id,note,created_at,updated_at)
    VALUES(v_name,NULLIF(p_config->>'address',''),NULLIF(p_config->>'phone',''),NULLIF(v_tax_id,''),
      NULLIF(p_config->>'line_id',''),NULLIF(p_config->>'note',''),NOW(),NOW()) RETURNING * INTO v_config;
  END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'SHOP_CONFIG_SAVE','shop_config',v_config.id::TEXT,v_config.name);
  RETURN v_config;
END; $$;

CREATE OR REPLACE FUNCTION create_expense_atomic(p_label TEXT,p_amount NUMERIC,p_date DATE,p_note TEXT DEFAULT NULL)
RETURNS expenses LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expense expenses; v_label TEXT:=BTRIM(COALESCE(p_label,''));
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF v_label='' OR COALESCE(p_amount,0)<=0 THEN RAISE EXCEPTION 'Expense label and positive amount are required'; END IF;
  INSERT INTO expenses(category,description,amount,expense_date,reference,created_by,created_at)
  VALUES('ทั่วไป',v_label,p_amount,COALESCE(p_date,CURRENT_DATE),NULLIF(BTRIM(p_note),''),auth.uid(),NOW())
  RETURNING * INTO v_expense;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'EXPENSE_CREATE','expense',v_expense.id::TEXT,v_expense.description,
    jsonb_build_object('amount',v_expense.amount,'expense_date',v_expense.expense_date));
  RETURN v_expense;
END; $$;

CREATE OR REPLACE FUNCTION void_expense_atomic(p_expense_id UUID,p_reason TEXT)
RETURNS expenses LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expense expenses; v_reason TEXT:=BTRIM(COALESCE(p_reason,''));
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can void expenses'; END IF;
  IF v_reason='' THEN RAISE EXCEPTION 'Void reason is required'; END IF;
  SELECT * INTO v_expense FROM expenses WHERE id=p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF v_expense.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Expense is already voided'; END IF;
  UPDATE expenses SET voided_at=NOW(),voided_by=auth.uid(),void_reason=v_reason
  WHERE id=p_expense_id RETURNING * INTO v_expense;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'EXPENSE_VOID','expense',v_expense.id::TEXT,v_expense.description,
    jsonb_build_object('amount',v_expense.amount,'reason',v_reason));
  RETURN v_expense;
END; $$;

ALTER TABLE shop_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD; v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['shop_config','expenses'] LOOP
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=v_table AND cmd<>'SELECT'
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_policy.policyname,v_table); END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION save_shop_config_atomic(JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION create_expense_atomic(TEXT,NUMERIC,DATE,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION void_expense_atomic(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_shop_config_atomic(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_expense_atomic(TEXT,NUMERIC,DATE,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION void_expense_atomic(UUID,TEXT) TO authenticated;
COMMIT;