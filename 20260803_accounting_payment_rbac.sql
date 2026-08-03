-- Restrict payment mutation to finance-authorized roles and align direct inserts.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,p_amount DECIMAL,p_method VARCHAR,p_reference VARCHAR DEFAULT NULL,p_note TEXT DEFAULT NULL
) RETURNS invoice_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice invoices; v_payment invoice_payments; v_paid DECIMAL; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF current_app_role() NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF p_amount<=0 OR p_method NOT IN ('cash','transfer','promptpay','card','other') THEN RAISE EXCEPTION 'Invalid payment'; END IF;
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND OR v_invoice.status IN ('cancelled','credited','refunded') OR v_invoice.document_type='credit_note' THEN RAISE EXCEPTION 'Invoice cannot receive payment'; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM invoice_payments WHERE invoice_id=p_invoice_id AND reversed_at IS NULL;
  IF v_paid+p_amount>v_invoice.grand_total+0.01 THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
  INSERT INTO invoice_payments(invoice_id,amount,method,reference,received_by,note)
  VALUES(p_invoice_id,p_amount,p_method,NULLIF(BTRIM(p_reference),''),auth.uid(),NULLIF(BTRIM(p_note),'')) RETURNING * INTO v_payment;
  v_paid:=v_paid+p_amount;
  UPDATE invoices SET payment_status=(v_paid>=grand_total-0.01),status=CASE WHEN v_paid>=grand_total-0.01 THEN 'paid' ELSE 'issued' END,updated_at=NOW() WHERE id=p_invoice_id;
  INSERT INTO audit_logs(user_id,action,entity_type,entity_id,entity_ref,details)
  VALUES(auth.uid(),'PAYMENT_RECORD','invoice_payment',v_payment.id::TEXT,v_invoice.invoice_number,jsonb_build_object('amount',p_amount,'method',p_method));
  RETURN v_payment;
END; $$;

DROP POLICY IF EXISTS team_write_invoice_payments ON invoice_payments;
CREATE POLICY team_write_invoice_payments ON invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (received_by=auth.uid() AND current_app_role() IN ('admin','supervisor'));

REVOKE ALL ON FUNCTION record_invoice_payment(UUID,DECIMAL,VARCHAR,VARCHAR,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID,DECIMAL,VARCHAR,VARCHAR,TEXT) TO authenticated;

INSERT INTO schema_migrations(version,description,applied_by)
VALUES('20260803_accounting_payment_rbac','Restrict payment writes to admin and supervisor',auth.uid())
ON CONFLICT(version) DO UPDATE SET description=EXCLUDED.description;

COMMIT;