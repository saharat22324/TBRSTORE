BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

CREATE TABLE IF NOT EXISTS public.invoice_write_requests (
  request_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  payload JSONB NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_write_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_write_requests FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.invoice_stock_safety_issues(p_invoice_id UUID DEFAULT NULL)
RETURNS TABLE(invoice_id UUID,sku TEXT,issue TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH amounts AS (
    SELECT i.id AS invoice_id,i.job_id,it.stock_item_id,s.sku,
      sum(it.quantity) AS billed,sum(it.stock_deducted_qty) AS recorded
    FROM invoices i JOIN invoice_items it ON it.invoice_id=i.id
    JOIN stock_items s ON s.id=it.stock_item_id
    WHERE (p_invoice_id IS NULL OR i.id=p_invoice_id)
      AND i.status NOT IN ('cancelled','credited','refunded')
      AND i.document_type NOT IN ('credit_note','debit_note')
    GROUP BY i.id,i.job_id,it.stock_item_id,s.sku
  ), evidence AS (
    SELECT a.*,
      (SELECT COALESCE(sum((item->>'qty')::numeric),0)
       FROM requisitions r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.items,'[]'::jsonb)) item
       WHERE r.job_id=a.job_id AND item->>'sid' IN (a.sku,a.stock_item_id::text)) AS requested,
      (SELECT COALESCE(sum(CASE WHEN l.type='out' THEN l.qty WHEN l.type IN ('in','return') THEN -l.qty ELSE 0 END),0)
       FROM stock_ledger l WHERE l.stock_item_id=a.stock_item_id AND l.ref_id=a.invoice_id
         AND l.ref_type IN ('invoice','invoice_edit','invoice_cancel','invoice_requisition_sync','invoice_requisition_recovery')) AS invoice_net,
      (SELECT COALESCE(sum(CASE WHEN l.type='out' THEN l.qty WHEN l.type IN ('in','return') THEN -l.qty ELSE 0 END),0)
       FROM stock_ledger l WHERE l.stock_item_id=a.stock_item_id
         AND l.ref_id IN (SELECT id FROM requisitions WHERE job_id=a.job_id)) AS requisition_net
    FROM amounts a
  )
  SELECT e.invoice_id,e.sku::text,
    CASE WHEN e.recorded<>greatest(e.billed-e.requested,0) THEN 'deduction_metadata_mismatch'
      WHEN e.invoice_net<>e.recorded THEN 'invoice_ledger_mismatch'
      ELSE 'requisition_evidence_missing' END
  FROM evidence e
  WHERE e.recorded<>greatest(e.billed-e.requested,0) OR e.invoice_net<>e.recorded
    OR e.requisition_net<least(e.billed,e.requested)
  UNION ALL
  SELECT i.id,NULL::text,'stock_reference_missing' FROM invoices i
  JOIN invoice_items it ON it.invoice_id=i.id
  WHERE (p_invoice_id IS NULL OR i.id=p_invoice_id)
    AND i.status NOT IN ('cancelled','credited','refunded')
    AND it.item_type='stock' AND it.stock_item_id IS NULL
  UNION ALL
  SELECT i.id,s.sku::text,'orphan_invoice_movement'
  FROM invoices i JOIN stock_ledger l ON l.ref_id=i.id
  JOIN stock_items s ON s.id=l.stock_item_id
  WHERE (p_invoice_id IS NULL OR i.id=p_invoice_id)
    AND i.status NOT IN ('cancelled','credited','refunded')
    AND l.ref_type IN ('invoice','invoice_edit','invoice_cancel','invoice_requisition_sync','invoice_requisition_recovery')
    AND NOT EXISTS (SELECT 1 FROM invoice_items it WHERE it.invoice_id=i.id AND it.stock_item_id=l.stock_item_id)
  GROUP BY i.id,s.sku
  HAVING sum(CASE WHEN l.type='out' THEN l.qty WHEN l.type IN ('in','return') THEN -l.qty ELSE 0 END)<>0;
$$;

CREATE OR REPLACE FUNCTION public.assert_invoice_stock_safe(p_invoice_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE problem RECORD;
BEGIN
  SELECT * INTO problem FROM invoice_stock_safety_issues(p_invoice_id) LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'STOCK_RECONCILIATION_REQUIRED: % / %',COALESCE(problem.sku,'unknown stock'),problem.issue;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_invoice_stock_items(p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item JSONB;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN
    RAISE EXCEPTION 'Invoice items are required';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(item->>'item_type','service')='stock' AND NULLIF(item->>'stock_item_id','') IS NULL THEN
      RAISE EXCEPTION 'Stock item reference is required';
    END IF;
    IF COALESCE((item->>'quantity')::numeric,0)<=0
      OR (item->>'quantity')::numeric::text IN ('NaN','Infinity','-Infinity')
      OR scale((item->>'quantity')::numeric)>3 THEN
      RAISE EXCEPTION 'Invoice quantity must be positive with at most three decimal places';
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.create_invoice_atomic_stock_base(jsonb,jsonb)') IS NULL THEN
    ALTER FUNCTION public.create_invoice_atomic(JSONB,JSONB) RENAME TO create_invoice_atomic_stock_base;
    ALTER FUNCTION public.update_invoice_atomic(UUID,JSONB,JSONB) RENAME TO update_invoice_atomic_stock_base;
    ALTER FUNCTION public.cancel_invoice_atomic(UUID,TEXT) RENAME TO cancel_invoice_atomic_stock_base;
    ALTER FUNCTION public.update_requisition_atomic(UUID,JSONB,TEXT) RENAME TO update_requisition_atomic_stock_base;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_atomic(p_invoice JSONB,p_items JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  request_key UUID;
  prior_request invoice_write_requests;
  payload JSONB:=jsonb_build_object('invoice',p_invoice-'request_id','items',p_items);
  result invoices;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM validate_invoice_stock_items(p_items);
  request_key:=NULLIF(p_invoice->>'request_id','')::uuid;
  IF request_key IS NULL THEN
    IF NULLIF(p_invoice->>'invoice_number','') IS NULL THEN RAISE EXCEPTION 'Invoice request id is required'; END IF;
    request_key:=md5(auth.uid()::text||':'||(p_invoice->>'invoice_number'))::uuid;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('invoice-request:'||request_key::text,0));
  SELECT * INTO prior_request FROM invoice_write_requests WHERE request_id=request_key;
  IF FOUND THEN
    IF prior_request.user_id<>auth.uid() OR prior_request.payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Invoice request payload changed; reload before retrying';
    END IF;
    SELECT * INTO result FROM invoices WHERE id=prior_request.invoice_id;
    RETURN result;
  END IF;
  SELECT * INTO result FROM create_invoice_atomic_stock_base(p_invoice,p_items);
  PERFORM assert_invoice_stock_safe(result.id);
  INSERT INTO invoice_write_requests(request_id,user_id,payload,invoice_id)
    VALUES(request_key,auth.uid(),payload,result.id);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_invoice_atomic(p_invoice_id UUID,p_invoice JSONB,p_items JSONB)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_invoice invoices;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can edit invoices'; END IF;
  SELECT * INTO current_invoice FROM invoices WHERE id=p_invoice_id;
  PERFORM 1 FROM jobs WHERE id=current_invoice.job_id FOR UPDATE;
  SELECT * INTO current_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF NULLIF(p_invoice->>'expected_version','') IS NOT NULL
    AND current_invoice.version<>(p_invoice->>'expected_version')::integer THEN
    RAISE EXCEPTION 'Invoice version changed; reload before saving';
  END IF;
  PERFORM assert_invoice_stock_safe(p_invoice_id);
  PERFORM validate_invoice_stock_items(p_items);
  RETURN update_invoice_atomic_stock_base(p_invoice_id,p_invoice,p_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_invoice_atomic(p_invoice_id UUID,p_reason TEXT)
RETURNS invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_invoice invoices;
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can cancel invoices'; END IF;
  SELECT * INTO current_invoice FROM invoices WHERE id=p_invoice_id;
  PERFORM 1 FROM jobs WHERE id=current_invoice.job_id FOR UPDATE;
  SELECT * INTO current_invoice FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  PERFORM assert_invoice_stock_safe(p_invoice_id);
  RETURN cancel_invoice_atomic_stock_base(p_invoice_id,p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_requisition_atomic(p_requisition_id UUID,p_items JSONB,p_note TEXT DEFAULT NULL)
RETURNS requisitions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job_key UUID; invoice_key UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT job_id INTO job_key FROM requisitions WHERE id=p_requisition_id;
  PERFORM 1 FROM jobs WHERE id=job_key FOR UPDATE;
  FOR invoice_key IN SELECT id FROM invoices WHERE job_id=job_key
    AND status NOT IN ('cancelled','credited','refunded') ORDER BY id FOR UPDATE LOOP
    PERFORM assert_invoice_stock_safe(invoice_key);
  END LOOP;
  RETURN update_requisition_atomic_stock_base(p_requisition_id,p_items,p_note);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_invoice_stock_safety_report()
RETURNS TABLE(invoice_id UUID,invoice_number TEXT,sku TEXT,issue TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR current_app_role()<>'admin' THEN RAISE EXCEPTION 'Only admin can inspect stock reconciliation'; END IF;
  RETURN QUERY SELECT problems.invoice_id,i.invoice_number::text,problems.sku,problems.issue
    FROM invoice_stock_safety_issues(NULL) problems JOIN invoices i ON i.id=problems.invoice_id
    ORDER BY i.invoice_number,problems.sku;
END;
$$;

REVOKE ALL ON FUNCTION public.invoice_stock_safety_issues(UUID),public.assert_invoice_stock_safe(UUID),
  public.validate_invoice_stock_items(JSONB),public.create_invoice_atomic_stock_base(JSONB,JSONB),
  public.update_invoice_atomic_stock_base(UUID,JSONB,JSONB),public.cancel_invoice_atomic_stock_base(UUID,TEXT),
  public.update_requisition_atomic_stock_base(UUID,JSONB,TEXT),
  public.update_invoice_atomic_unlocked(UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_invoice_atomic(JSONB,JSONB),public.update_invoice_atomic(UUID,JSONB,JSONB),
  public.cancel_invoice_atomic(UUID,TEXT),public.update_requisition_atomic(UUID,JSONB,TEXT),
  public.get_invoice_stock_safety_report() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(JSONB,JSONB),public.update_invoice_atomic(UUID,JSONB,JSONB),
  public.cancel_invoice_atomic(UUID,TEXT),public.update_requisition_atomic(UUID,JSONB,TEXT),
  public.get_invoice_stock_safety_report() TO authenticated;

INSERT INTO schema_migrations(version,description,applied_by)
VALUES('20261015_invoice_stock_safety','Guard legacy stock evidence and make invoice creation retries idempotent',auth.uid())
ON CONFLICT(version) DO UPDATE SET description=EXCLUDED.description;
COMMIT;