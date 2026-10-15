BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DROP FUNCTION public.get_invoice_stock_safety_report();
DROP FUNCTION public.create_invoice_atomic(JSONB,JSONB);
DROP FUNCTION public.update_invoice_atomic(UUID,JSONB,JSONB);
DROP FUNCTION public.cancel_invoice_atomic(UUID,TEXT);
DROP FUNCTION public.update_requisition_atomic(UUID,JSONB,TEXT);
ALTER FUNCTION public.create_invoice_atomic_stock_base(JSONB,JSONB) RENAME TO create_invoice_atomic;
ALTER FUNCTION public.update_invoice_atomic_stock_base(UUID,JSONB,JSONB) RENAME TO update_invoice_atomic;
ALTER FUNCTION public.cancel_invoice_atomic_stock_base(UUID,TEXT) RENAME TO cancel_invoice_atomic;
ALTER FUNCTION public.update_requisition_atomic_stock_base(UUID,JSONB,TEXT) RENAME TO update_requisition_atomic;
DROP FUNCTION public.assert_invoice_stock_safe(UUID);
DROP FUNCTION public.validate_invoice_stock_items(JSONB);
DROP FUNCTION public.invoice_stock_safety_issues(UUID);
REVOKE ALL ON FUNCTION public.create_invoice_atomic(JSONB,JSONB),public.update_invoice_atomic(UUID,JSONB,JSONB),
  public.cancel_invoice_atomic(UUID,TEXT),public.update_requisition_atomic(UUID,JSONB,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(JSONB,JSONB),public.update_invoice_atomic(UUID,JSONB,JSONB),
  public.cancel_invoice_atomic(UUID,TEXT),public.update_requisition_atomic(UUID,JSONB,TEXT) TO authenticated;
UPDATE public.schema_migrations SET description='Invoice stock safety rolled back; private request history retained'
WHERE version='20261015_invoice_stock_safety';
COMMIT;