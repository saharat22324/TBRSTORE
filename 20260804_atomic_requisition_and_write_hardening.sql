-- TBR System: atomic requisitions and direct-write hardening.
-- Apply after production-accounting-completion.sql and 20260803_accounting_payment_rbac.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION create_requisition_atomic(
  p_job_id UUID,
  p_no TEXT,
  p_items JSONB,
  p_note TEXT DEFAULT NULL
) RETURNS requisitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisition requisitions;
  v_item JSONB;
  v_stock stock_items;
  v_qty NUMERIC;
  v_clean_items JSONB := '[]'::JSONB;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin','supervisor','technician') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jobs WHERE id = p_job_id) THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF COALESCE(BTRIM(p_no),'') = '' THEN RAISE EXCEPTION 'Requisition number is required'; END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB)) = 0 THEN RAISE EXCEPTION 'Requisition requires items'; END IF;

  INSERT INTO requisitions(job_id,no,items,note,created_by,updated_at)
  VALUES(p_job_id,BTRIM(p_no),'[]'::JSONB,NULLIF(BTRIM(p_note),''),auth.uid(),NOW())
  RETURNING * INTO v_requisition;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::NUMERIC,0);
    IF v_qty <= 0 OR v_qty <> TRUNC(v_qty) THEN RAISE EXCEPTION 'Stock quantity must be a positive whole number'; END IF;
    v_stock := NULL;

    IF NULLIF(v_item->>'sid','') IS NOT NULL THEN
      SELECT * INTO v_stock FROM stock_items
      WHERE id::TEXT = v_item->>'sid' OR sku = v_item->>'sid'
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
      IF COALESCE(v_stock.quantity,0) < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for % (available %, requested %)', v_stock.sku, v_stock.quantity, v_qty;
      END IF;
      UPDATE stock_items SET quantity=quantity-v_qty::INTEGER,updated_at=NOW() WHERE id=v_stock.id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock.id,'out',v_qty,'requisition',v_requisition.id,'เบิก '||v_requisition.no,auth.uid());
    END IF;

    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'sid', CASE WHEN v_stock.id IS NULL THEN NULL ELSE v_stock.sku END,
      'name', COALESCE(NULLIF(v_item->>'name',''),v_stock.name,'รายการอื่น'),
      'unit', COALESCE(NULLIF(v_item->>'unit',''),v_stock.unit,'ชิ้น'),
      'qty', v_qty,
      'cost', CASE WHEN v_stock.id IS NULL THEN 0 ELSE v_stock.cost_price END
    ));
  END LOOP;

  UPDATE requisitions SET items=v_clean_items,updated_at=NOW() WHERE id=v_requisition.id RETURNING * INTO v_requisition;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'REQUISITION_CREATE','requisition',v_requisition.id::TEXT,v_requisition.no,jsonb_build_object('job_id',p_job_id));
  RETURN v_requisition;
END;
$$;

CREATE OR REPLACE FUNCTION update_requisition_atomic(
  p_requisition_id UUID,
  p_items JSONB,
  p_note TEXT DEFAULT NULL
) RETURNS requisitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requisition requisitions;
  v_item JSONB;
  v_stock stock_items;
  v_qty NUMERIC;
  v_clean_items JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_requisition FROM requisitions WHERE id=p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition not found'; END IF;
  IF current_app_role() NOT IN ('admin','supervisor') AND v_requisition.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF jsonb_array_length(COALESCE(p_items,'[]'::JSONB)) = 0 THEN RAISE EXCEPTION 'Requisition requires items'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_requisition.items,'[]'::JSONB)) LOOP
    IF NULLIF(v_item->>'sid','') IS NULL THEN CONTINUE; END IF;
    v_qty := COALESCE((v_item->>'qty')::NUMERIC,0);
    SELECT * INTO v_stock FROM stock_items WHERE id::TEXT=v_item->>'sid' OR sku=v_item->>'sid' FOR UPDATE;
    IF FOUND THEN
      UPDATE stock_items SET quantity=quantity+v_qty::INTEGER,updated_at=NOW() WHERE id=v_stock.id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock.id,'in',v_qty,'requisition_edit',v_requisition.id,'คืนก่อนแก้ใบเบิก '||v_requisition.no,auth.uid());
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'qty')::NUMERIC,0);
    IF v_qty <= 0 OR v_qty <> TRUNC(v_qty) THEN RAISE EXCEPTION 'Stock quantity must be a positive whole number'; END IF;
    v_stock := NULL;
    IF NULLIF(v_item->>'sid','') IS NOT NULL THEN
      SELECT * INTO v_stock FROM stock_items WHERE id::TEXT=v_item->>'sid' OR sku=v_item->>'sid' FOR UPDATE;
      IF NOT FOUND OR COALESCE(v_stock.quantity,0) < v_qty THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
      UPDATE stock_items SET quantity=quantity-v_qty::INTEGER,updated_at=NOW() WHERE id=v_stock.id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock.id,'out',v_qty,'requisition_edit',v_requisition.id,'ตัดใหม่หลังแก้ใบเบิก '||v_requisition.no,auth.uid());
    END IF;
    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'sid', CASE WHEN v_stock.id IS NULL THEN NULL ELSE v_stock.sku END,
      'name', COALESCE(NULLIF(v_item->>'name',''),v_stock.name,'รายการอื่น'),
      'unit', COALESCE(NULLIF(v_item->>'unit',''),v_stock.unit,'ชิ้น'),
      'qty', v_qty,
      'cost', CASE WHEN v_stock.id IS NULL THEN 0 ELSE v_stock.cost_price END
    ));
  END LOOP;

  UPDATE requisitions SET items=v_clean_items,note=NULLIF(BTRIM(p_note),''),updated_at=NOW()
  WHERE id=p_requisition_id RETURNING * INTO v_requisition;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'REQUISITION_UPDATE','requisition',v_requisition.id::TEXT,v_requisition.no);
  RETURN v_requisition;
END;
$$;

CREATE OR REPLACE FUNCTION delete_requisition_atomic(p_requisition_id UUID)
RETURNS requisitions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_requisition requisitions; v_item JSONB; v_stock stock_items; v_qty NUMERIC;
BEGIN
  SELECT * INTO v_requisition FROM requisitions WHERE id=p_requisition_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisition not found'; END IF;
  IF current_app_role() NOT IN ('admin','supervisor') AND v_requisition.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_requisition.items,'[]'::JSONB)) LOOP
    IF NULLIF(v_item->>'sid','') IS NULL THEN CONTINUE; END IF;
    v_qty:=COALESCE((v_item->>'qty')::NUMERIC,0);
    SELECT * INTO v_stock FROM stock_items WHERE id::TEXT=v_item->>'sid' OR sku=v_item->>'sid' FOR UPDATE;
    IF FOUND THEN
      UPDATE stock_items SET quantity=quantity+v_qty::INTEGER,updated_at=NOW() WHERE id=v_stock.id;
      INSERT INTO stock_ledger(stock_item_id,type,qty,ref_type,ref_id,note,created_by)
      VALUES(v_stock.id,'in',v_qty,'requisition_delete',v_requisition.id,'คืนจากลบใบเบิก '||v_requisition.no,auth.uid());
    END IF;
  END LOOP;
  DELETE FROM requisitions WHERE id=p_requisition_id;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'REQUISITION_DELETE','requisition',v_requisition.id::TEXT,v_requisition.no);
  RETURN v_requisition;
END;
$$;

CREATE OR REPLACE FUNCTION delete_job_atomic(p_job_id UUID)
RETURNS jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_job jobs; v_requisition RECORD;
BEGIN
  IF current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO v_job FROM jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF EXISTS (SELECT 1 FROM invoices WHERE job_id=p_job_id) THEN RAISE EXCEPTION 'A billed job cannot be deleted'; END IF;
  FOR v_requisition IN SELECT id FROM requisitions WHERE job_id=p_job_id FOR UPDATE LOOP
    PERFORM delete_requisition_atomic(v_requisition.id);
  END LOOP;
  DELETE FROM jobs WHERE id=p_job_id;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref)
  VALUES(auth.uid(),'JOB_DELETE','job',v_job.id::TEXT,v_job.job_number);
  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION create_requisition_atomic(UUID,TEXT,JSONB,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION update_requisition_atomic(UUID,JSONB,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION delete_requisition_atomic(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION delete_job_atomic(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_requisition_atomic(UUID,TEXT,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_requisition_atomic(UUID,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_requisition_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_job_atomic(UUID) TO authenticated;

DROP POLICY IF EXISTS prod_stock_update ON stock_items;
CREATE POLICY prod_stock_update ON stock_items FOR UPDATE TO authenticated
  USING (current_app_role() IN ('admin','supervisor'))
  WITH CHECK (current_app_role() IN ('admin','supervisor'));

DROP POLICY IF EXISTS prod_requisitions_insert ON requisitions;
DROP POLICY IF EXISTS prod_requisitions_update ON requisitions;
DROP POLICY IF EXISTS prod_requisitions_delete ON requisitions;
DROP POLICY IF EXISTS allow_auth_insert_requisition_items ON requisition_items;
DROP POLICY IF EXISTS allow_auth_update_requisition_items ON requisition_items;
DROP POLICY IF EXISTS allow_auth_delete_requisition_items ON requisition_items;

DROP POLICY IF EXISTS prod_jobs_delete ON jobs;

DROP POLICY IF EXISTS prod_invoices_insert ON invoices;
DROP POLICY IF EXISTS prod_invoices_update ON invoices;
CREATE POLICY prod_invoices_update ON invoices FOR UPDATE TO authenticated
  USING (current_app_role()='admin' AND status<>'cancelled')
  WITH CHECK (current_app_role()='admin' AND status<>'cancelled');
DROP POLICY IF EXISTS prod_invoice_items_insert ON invoice_items;
DROP POLICY IF EXISTS prod_invoice_items_update ON invoice_items;
DROP POLICY IF EXISTS prod_invoice_items_delete ON invoice_items;
CREATE POLICY prod_invoice_items_insert ON invoice_items FOR INSERT TO authenticated WITH CHECK (current_app_role()='admin');
CREATE POLICY prod_invoice_items_update ON invoice_items FOR UPDATE TO authenticated
  USING (current_app_role()='admin' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id=invoice_id AND i.status<>'cancelled'))
  WITH CHECK (current_app_role()='admin');
CREATE POLICY prod_invoice_items_delete ON invoice_items FOR DELETE TO authenticated
  USING (current_app_role()='admin' AND EXISTS (SELECT 1 FROM invoices i WHERE i.id=invoice_id AND i.status<>'cancelled'));

DROP POLICY IF EXISTS team_write_invoice_payments ON invoice_payments;

INSERT INTO schema_migrations(version,description,applied_by)
VALUES('20260804_atomic_requisition_and_write_hardening','Atomic requisitions and direct-write hardening',auth.uid())
ON CONFLICT(version) DO UPDATE SET description=EXCLUDED.description;

COMMIT;