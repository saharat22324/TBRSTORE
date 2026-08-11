-- TBR System: require requisition-linked stock quantities to be edited from the Job Card.
-- Apply after 20260820_atomic_billed_requisition_invoice_sync.sql.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $$
BEGIN
  IF to_regprocedure('public.update_invoice_atomic_unlocked(uuid,jsonb,jsonb)') IS NULL THEN
    ALTER FUNCTION public.update_invoice_atomic(UUID,JSONB,JSONB)
      RENAME TO update_invoice_atomic_unlocked;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_invoice_atomic(
  p_invoice_id UUID,
  p_invoice JSONB,
  p_items JSONB
) RETURNS invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_invoice invoices;
  v_mismatch BOOLEAN;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  WITH requisition_stock AS (
    SELECT DISTINCT stock.id
    FROM requisitions requisition
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(requisition.items,'[]'::JSONB)) requisition_item
    JOIN stock_items stock
      ON stock.sku=requisition_item->>'sid' OR stock.id::TEXT=requisition_item->>'sid'
    WHERE requisition.job_id=v_invoice.job_id
  ), old_quantities AS (
    SELECT invoice_item.stock_item_id,COALESCE(SUM(invoice_item.quantity),0)::NUMERIC quantity
    FROM invoice_items invoice_item
    JOIN requisition_stock linked ON linked.id=invoice_item.stock_item_id
    WHERE invoice_item.invoice_id=p_invoice_id
    GROUP BY invoice_item.stock_item_id
  ), new_quantities AS (
    SELECT (item->>'stock_item_id')::UUID stock_item_id,
      COALESCE(SUM((item->>'quantity')::NUMERIC),0)::NUMERIC quantity
    FROM jsonb_array_elements(COALESCE(p_items,'[]'::JSONB)) item
    JOIN requisition_stock linked ON linked.id=(item->>'stock_item_id')::UUID
    WHERE NULLIF(item->>'stock_item_id','') IS NOT NULL
    GROUP BY (item->>'stock_item_id')::UUID
  )
  SELECT EXISTS(
    SELECT 1
    FROM old_quantities old_quantity
    FULL JOIN new_quantities new_quantity USING(stock_item_id)
    WHERE COALESCE(old_quantity.quantity,0)<>COALESCE(new_quantity.quantity,0)
  ) INTO v_mismatch;

  IF v_mismatch THEN
    RAISE EXCEPTION 'Requisition-linked stock quantities must be edited from the Job Card';
  END IF;

  RETURN public.update_invoice_atomic_unlocked(p_invoice_id,p_invoice,p_items);
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_atomic_unlocked(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_invoice_atomic(UUID,JSONB,JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(UUID,JSONB,JSONB) TO authenticated;

COMMIT;