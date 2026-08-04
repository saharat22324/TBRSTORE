-- TBR System: atomic customer and vehicle lifecycle.
-- Apply after 20260814_atomic_service_catalog.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION save_customer_atomic(p_customer_id UUID,p_customer JSONB)
RETURNS customers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_customer customers; v_name TEXT:=BTRIM(COALESCE(p_customer->>'name','')); v_tax_id TEXT:=NULLIF(BTRIM(p_customer->>'tax_id'),''); v_branch TEXT:=COALESCE(NULLIF(BTRIM(p_customer->>'branch_no'),''),'00000');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF (p_customer_id IS NULL OR p_customer?'name') AND v_name='' THEN RAISE EXCEPTION 'Customer name is required'; END IF;
  IF p_customer?'tax_id' AND v_tax_id IS NOT NULL AND v_tax_id !~ '^[0-9]{13}$' THEN RAISE EXCEPTION 'Tax ID must contain 13 digits'; END IF;
  IF p_customer?'branch_no' AND v_branch !~ '^[0-9]{5}$' THEN RAISE EXCEPTION 'Branch number must contain 5 digits'; END IF;

  IF p_customer_id IS NULL THEN
    INSERT INTO customers(name,phone,email,line_id,address,note,company_name,tax_id,branch_no,billing_address,created_by,created_at,updated_at)
    VALUES(v_name,NULLIF(p_customer->>'phone',''),NULLIF(p_customer->>'email',''),NULLIF(p_customer->>'line_id',''),
      NULLIF(p_customer->>'address',''),NULLIF(p_customer->>'note',''),NULLIF(p_customer->>'company_name',''),v_tax_id,v_branch,
      NULLIF(p_customer->>'billing_address',''),auth.uid(),NOW(),NOW()) RETURNING * INTO v_customer;
  ELSE
    SELECT * INTO v_customer FROM customers WHERE id=p_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    UPDATE customers SET
      name=CASE WHEN p_customer?'name' THEN v_name ELSE name END,
      phone=CASE WHEN p_customer?'phone' THEN NULLIF(p_customer->>'phone','') ELSE phone END,
      email=CASE WHEN p_customer?'email' THEN NULLIF(p_customer->>'email','') ELSE email END,
      line_id=CASE WHEN p_customer?'line_id' THEN NULLIF(p_customer->>'line_id','') ELSE line_id END,
      address=CASE WHEN p_customer?'address' THEN NULLIF(p_customer->>'address','') ELSE address END,
      note=CASE WHEN p_customer?'note' THEN NULLIF(p_customer->>'note','') ELSE note END,
      company_name=CASE WHEN p_customer?'company_name' THEN NULLIF(p_customer->>'company_name','') ELSE company_name END,
      tax_id=CASE WHEN p_customer?'tax_id' THEN v_tax_id ELSE tax_id END,
      branch_no=CASE WHEN p_customer?'branch_no' THEN v_branch ELSE branch_no END,
      billing_address=CASE WHEN p_customer?'billing_address' THEN NULLIF(p_customer->>'billing_address','') ELSE billing_address END,
      updated_at=NOW()
    WHERE id=p_customer_id RETURNING * INTO v_customer;
  END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'CUSTOMER_SAVE','customer',v_customer.id::TEXT,v_customer.name);
  RETURN v_customer;
END; $$;

CREATE OR REPLACE FUNCTION delete_unused_customer_atomic(p_customer_id UUID)
RETURNS customers LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_customer customers;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_customer FROM customers WHERE id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF EXISTS(SELECT 1 FROM vehicles WHERE customer_id=p_customer_id)
    OR EXISTS(SELECT 1 FROM jobs WHERE customer_id=p_customer_id)
    OR EXISTS(SELECT 1 FROM invoices WHERE customer_id=p_customer_id)
    OR EXISTS(SELECT 1 FROM quotes WHERE customer_id=p_customer_id)
  THEN RAISE EXCEPTION 'Customer has business history and cannot be deleted'; END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'CUSTOMER_DELETE_UNUSED','customer',v_customer.id::TEXT,v_customer.name);
  DELETE FROM customers WHERE id=p_customer_id;
  RETURN v_customer;
END; $$;

CREATE OR REPLACE FUNCTION save_vehicle_atomic(p_vehicle_id UUID,p_vehicle JSONB)
RETURNS vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_vehicle vehicles; v_customer_id UUID; v_plate TEXT; v_year INTEGER; v_mileage INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF p_vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM vehicles WHERE id=p_vehicle_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  END IF;
  v_plate:=CASE WHEN p_vehicle?'plate' THEN BTRIM(COALESCE(p_vehicle->>'plate','')) ELSE v_vehicle.plate END;
  IF v_plate IS NULL OR v_plate='' THEN RAISE EXCEPTION 'Vehicle plate is required'; END IF;
  BEGIN v_customer_id:=CASE WHEN p_vehicle?'customer_id' THEN (p_vehicle->>'customer_id')::UUID ELSE v_vehicle.customer_id END; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Valid customer is required'; END;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Valid customer is required'; END IF;
  v_year:=CASE WHEN p_vehicle?'year' THEN NULLIF(p_vehicle->>'year','')::INTEGER ELSE v_vehicle.year END;
  v_mileage:=CASE WHEN p_vehicle?'mileage' THEN COALESCE(NULLIF(p_vehicle->>'mileage','')::INTEGER,0) ELSE COALESCE(v_vehicle.mileage,0) END;
  IF v_mileage<0 THEN RAISE EXCEPTION 'Mileage cannot be negative'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(LOWER(v_plate),0));
  PERFORM 1 FROM customers WHERE id=v_customer_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  IF p_vehicle_id IS NULL THEN
    IF EXISTS(SELECT 1 FROM vehicles WHERE LOWER(plate)=LOWER(v_plate)) THEN RAISE EXCEPTION 'Vehicle plate already exists'; END IF;
    INSERT INTO vehicles(customer_id,plate,brand,model,year,color,mileage,engine_number,chassis_number,note,created_by,created_at,updated_at)
    VALUES(v_customer_id,v_plate,NULLIF(p_vehicle->>'brand',''),NULLIF(p_vehicle->>'model',''),v_year,NULLIF(p_vehicle->>'color',''),v_mileage,
      NULLIF(p_vehicle->>'engine_number',''),NULLIF(p_vehicle->>'chassis_number',''),NULLIF(p_vehicle->>'note',''),auth.uid(),NOW(),NOW())
    RETURNING * INTO v_vehicle;
  ELSE
    IF EXISTS(SELECT 1 FROM vehicles WHERE LOWER(plate)=LOWER(v_plate) AND id<>p_vehicle_id) THEN RAISE EXCEPTION 'Vehicle plate already exists'; END IF;
    UPDATE vehicles SET customer_id=v_customer_id,plate=v_plate,
      brand=CASE WHEN p_vehicle?'brand' THEN NULLIF(p_vehicle->>'brand','') ELSE brand END,
      model=CASE WHEN p_vehicle?'model' THEN NULLIF(p_vehicle->>'model','') ELSE model END,
      year=v_year,color=CASE WHEN p_vehicle?'color' THEN NULLIF(p_vehicle->>'color','') ELSE color END,mileage=v_mileage,
      engine_number=CASE WHEN p_vehicle?'engine_number' THEN NULLIF(p_vehicle->>'engine_number','') ELSE engine_number END,
      chassis_number=CASE WHEN p_vehicle?'chassis_number' THEN NULLIF(p_vehicle->>'chassis_number','') ELSE chassis_number END,
      note=CASE WHEN p_vehicle?'note' THEN NULLIF(p_vehicle->>'note','') ELSE note END,updated_at=NOW()
    WHERE id=p_vehicle_id RETURNING * INTO v_vehicle;
  END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'VEHICLE_SAVE','vehicle',v_vehicle.id::TEXT,v_vehicle.plate,jsonb_build_object('customer_id',v_vehicle.customer_id));
  RETURN v_vehicle;
END; $$;

CREATE OR REPLACE FUNCTION delete_unused_vehicle_atomic(p_vehicle_id UUID)
RETURNS vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_vehicle vehicles;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_vehicle FROM vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF EXISTS(SELECT 1 FROM jobs WHERE vehicle_id=p_vehicle_id)
    OR EXISTS(SELECT 1 FROM invoices WHERE vehicle_id=p_vehicle_id)
    OR EXISTS(SELECT 1 FROM quotes WHERE vehicle_id=p_vehicle_id)
  THEN RAISE EXCEPTION 'Vehicle has business history and cannot be deleted'; END IF;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'VEHICLE_DELETE_UNUSED','vehicle',v_vehicle.id::TEXT,v_vehicle.plate);
  DELETE FROM vehicles WHERE id=p_vehicle_id;
  RETURN v_vehicle;
END; $$;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE v_policy RECORD; v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['customers','vehicles'] LOOP
    FOR v_policy IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=v_table AND cmd<>'SELECT'
    LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',v_policy.policyname,v_table); END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION save_customer_atomic(UUID,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION delete_unused_customer_atomic(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION save_vehicle_atomic(UUID,JSONB) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION delete_unused_vehicle_atomic(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION save_customer_atomic(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_unused_customer_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION save_vehicle_atomic(UUID,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_unused_vehicle_atomic(UUID) TO authenticated;
COMMIT;