-- Transactional role smoke test. All writes are rolled back.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);

DO $$
DECLARE
  v_invoice invoices;
  v_payment invoice_payments;
  v_note invoices;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
  SELECT * INTO v_invoice FROM create_invoice_atomic(
    jsonb_build_object('invoice_number','SMOKE-RBAC-INV','subtotal',100,'discount',0,'vat',0,'grand_total',100,'customer_name','RBAC Smoke'),
    jsonb_build_array(jsonb_build_object('item_type','service','description','RBAC test','quantity',1,'unit_price',100,'total',100))
  );

  PERFORM set_config('request.jwt.claim.sub','67eba67a-8829-4610-a127-dffae8041914',true);
  SELECT * INTO v_payment FROM record_invoice_payment(v_invoice.id,10,'cash',NULL,'supervisor smoke');
  SELECT * INTO v_note FROM create_adjustment_note_atomic(v_invoice.id,'debit_note',5,'supervisor smoke');
  IF v_payment.id IS NULL OR v_note.id IS NULL THEN RAISE EXCEPTION 'Supervisor finance action failed'; END IF;

  PERFORM set_config('request.jwt.claim.sub','96710ae9-e02b-4c6d-a1c3-f1f070986b5e',true);
  BEGIN
    PERFORM record_invoice_payment(v_invoice.id,1,'cash',NULL,'must fail');
    RAISE EXCEPTION 'Technician payment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Not permitted' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO invoice_payments(invoice_id,amount,method,received_by) VALUES(v_invoice.id,1,'cash',auth.uid());
    RAISE EXCEPTION 'Technician direct payment insert unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM create_adjustment_note_atomic(v_invoice.id,'debit_note',1,'must fail');
    RAISE EXCEPTION 'Technician adjustment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Not permitted' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub','2fd34ed6-d87b-4f66-91f4-5eca292c07e6',true);
  PERFORM reverse_invoice_payment(v_payment.id,'admin smoke cleanup');
  PERFORM cancel_invoice_atomic(v_invoice.id,'admin smoke cleanup');
END $$;

SELECT 'accounting role permission smoke tests passed' AS result;
ROLLBACK;