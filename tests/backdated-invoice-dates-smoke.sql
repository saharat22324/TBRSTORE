-- Transactional smoke test for controlled backdated invoice creation.
-- All writes are rolled back. Run as postgres in Supabase SQL Editor.

BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  v_admin UUID:=auth.uid();
  v_non_admin UUID;
  v_customer UUID;
  v_invoice invoices;
  v_today DATE:=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::DATE;
  v_entry_date DATE:=CURRENT_DATE;
  v_backdate DATE:=(v_today-INTERVAL '4 months')::DATE;
BEGIN
  IF v_backdate>=v_today-INTERVAL '3 months' THEN
    RAISE EXCEPTION 'Smoke-test invoice date is not older than three months';
  END IF;

  INSERT INTO customers(name)
  VALUES('Backdated invoice smoke '||txid_current())
  RETURNING id INTO v_customer;

  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object(
      'invoice_number','',
      'invoice_date',v_backdate,
      'backdate_reason','Historical invoice entered after system adoption',
      'customer_id',v_customer,
      'customer_name','Backdated invoice smoke',
      'subtotal',100,'discount',0,'vat',0,'grand_total',100
    ),
    jsonb_build_array(jsonb_build_object(
      'item_type','service','description','Backdated service smoke',
      'quantity',1,'unit_price',100,'cost_price',0,'total',100
    ))
  );

  IF v_invoice.invoice_date<>v_backdate THEN
    RAISE EXCEPTION 'Invoice date mismatch: %',v_invoice.invoice_date;
  END IF;
  IF v_invoice.created_at::DATE<>v_entry_date THEN
    RAISE EXCEPTION 'System entry date was backdated: %',v_invoice.created_at;
  END IF;
  IF v_invoice.invoice_number NOT LIKE 'INV-'||TO_CHAR(v_backdate,'YYYYMMDD')||'-%' THEN
    RAISE EXCEPTION 'Backdated invoice number has wrong date prefix: %',v_invoice.invoice_number;
  END IF;
  IF v_invoice.backdate_reason<>'Historical invoice entered after system adoption' THEN
    RAISE EXCEPTION 'Backdate reason was not stored';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM audit_logs
    WHERE entity_id=v_invoice.id::TEXT
      AND action='INVOICE_CREATE_BACKDATED'
      AND details->>'invoice_date'=v_backdate::TEXT
      AND NULLIF(details->>'created_at','') IS NOT NULL
  ) THEN RAISE EXCEPTION 'Backdated invoice audit event is missing'; END IF;

  SELECT id INTO v_non_admin
  FROM profiles
  WHERE role::TEXT<>'admin' AND COALESCE(is_active,true)
  ORDER BY created_at
  LIMIT 1;
  IF v_non_admin IS NULL THEN RAISE EXCEPTION 'Smoke test requires one active non-admin profile'; END IF;

  PERFORM set_config('request.jwt.claim.sub',v_non_admin::TEXT,true);
  BEGIN
    PERFORM create_invoice_atomic(
      jsonb_build_object(
        'invoice_number','SMOKE-NONADMIN-'||txid_current(),
        'invoice_date',v_backdate,
        'backdate_reason','Unauthorized backdate smoke',
        'customer_id',v_customer,
        'customer_name','Unauthorized backdate smoke',
        'subtotal',1,'discount',0,'vat',0,'grand_total',1
      ),
      jsonb_build_array(jsonb_build_object(
        'item_type','service','description','Unauthorized service smoke',
        'quantity',1,'unit_price',1,'cost_price',0,'total',1
      ))
    );
    RAISE EXCEPTION 'Non-admin backdated invoice unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Non-admin backdated invoice unexpectedly succeeded' THEN RAISE; END IF;
    IF SQLERRM NOT ILIKE '%Only admin can create a backdated invoice%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_admin::TEXT,true);

  BEGIN
    UPDATE invoices SET invoice_date=v_backdate+1 WHERE id=v_invoice.id;
    RAISE EXCEPTION 'Issued invoice date update unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Issued invoice date update unexpectedly succeeded' THEN RAISE; END IF;
    IF SQLERRM NOT ILIKE '%immutable after issue%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM create_invoice_atomic(
      jsonb_build_object(
        'invoice_number','SMOKE-FUTURE-'||txid_current(),
        'invoice_date',v_today+1,
        'customer_id',v_customer,
        'customer_name','Future invoice smoke',
        'subtotal',1,'discount',0,'vat',0,'grand_total',1
      ),
      jsonb_build_array(jsonb_build_object(
        'item_type','service','description','Future service smoke',
        'quantity',1,'unit_price',1,'cost_price',0,'total',1
      ))
    );
    RAISE EXCEPTION 'Future invoice unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Future invoice unexpectedly succeeded' THEN RAISE; END IF;
    IF SQLERRM NOT ILIKE '%cannot be in the future%' THEN RAISE; END IF;
  END;
END $$;

SELECT 'backdated invoice dates smoke tests passed' AS verification;
ROLLBACK;
