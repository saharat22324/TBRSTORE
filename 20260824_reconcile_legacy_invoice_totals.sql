BEGIN;

CREATE TEMP TABLE expected_invoice_reconciliation (
  invoice_id UUID PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  old_grand_total NUMERIC(14,2) NOT NULL,
  new_grand_total NUMERIC(14,2) NOT NULL,
  payment_id UUID,
  old_payment_amount NUMERIC(14,2),
  new_payment_amount NUMERIC(14,2)
) ON COMMIT DROP;

INSERT INTO expected_invoice_reconciliation VALUES
  ('fc957f89-613f-4d0f-8f86-0a167a1f7e56', 'INV-20260627-001', 10315.00, 10314.80, '109a3aee-35f5-414a-a978-3534ca3d3d4e', 10315.00, 10314.80),
  ('e846682e-1df4-4e49-b792-ff64e2544561', 'INV-20260628-001',  5446.00,  5446.30, '097e626b-4646-4e94-82f7-654a2e64a2df',  5446.00,  5446.30),
  ('77dbe0ff-d16a-404d-898f-2286a9178302', 'INV-20260704-001',  5446.00,  5446.30, '5f9981ea-c89a-4a7d-9117-49a3ac8e6b97',  5446.00,  5446.30),
  ('f319226a-15e8-41da-8df3-b2e495a93f0f', 'INV-20260802-001',  5446.00,  5446.30, NULL,                                   NULL,     NULL),
  ('0f36f384-e13b-4a08-bb19-a39ba86c9b41', 'INV-20260811-001',  5446.00,  5446.30, '7dee8b11-120b-45d1-b3e1-c64b265328ff',  5446.00,  5446.30),
  ('0e813c26-776a-49ef-ac1d-dc3752b126b6', 'INV-20260815-001',  6418.00,  6417.86, '66c0d304-565e-44d9-8082-09539aa88c3a',  6418.00,  6417.86),
  ('965b808d-80a5-4dea-a46c-73cfe98c8030', 'INV-20260827-005',  8967.00,  8966.60, '9ca61eb1-2d40-4bb3-acdc-4a221255638c',  8967.00,  8966.60);

DO $$
DECLARE
  matched_invoices INTEGER;
  matched_payments INTEGER;
  active_payments INTEGER;
BEGIN
  PERFORM 1
  FROM invoices i
  JOIN expected_invoice_reconciliation e ON e.invoice_id = i.id
  ORDER BY i.id
  FOR UPDATE OF i;

  PERFORM 1
  FROM invoice_payments p
  JOIN expected_invoice_reconciliation e ON e.payment_id = p.id
  ORDER BY p.id
  FOR UPDATE OF p;

  SELECT COUNT(*) INTO matched_invoices
  FROM invoices i
  JOIN expected_invoice_reconciliation e
    ON e.invoice_id = i.id
   AND e.invoice_number = i.invoice_number
   AND e.old_grand_total = i.grand_total
   AND e.new_grand_total = ROUND(
     (i.subtotal - i.discount)
     + CASE WHEN i.vat > 0 AND i.vat <= 1
       THEN (i.subtotal - i.discount) * i.vat
       ELSE i.vat
     END,
     2
   );

  IF matched_invoices <> 7 THEN
    RAISE EXCEPTION 'Invoice precondition failed: expected 7 rows, matched %', matched_invoices;
  END IF;

  SELECT COUNT(*) INTO matched_payments
  FROM invoice_payments p
  JOIN expected_invoice_reconciliation e
    ON e.payment_id = p.id
   AND e.invoice_id = p.invoice_id
   AND e.old_payment_amount = p.amount
  WHERE p.reversed_at IS NULL;

  IF matched_payments <> 6 THEN
    RAISE EXCEPTION 'Payment precondition failed: expected 6 rows, matched %', matched_payments;
  END IF;

  SELECT COUNT(*) INTO active_payments
  FROM invoice_payments p
  JOIN expected_invoice_reconciliation e ON e.invoice_id = p.invoice_id
  WHERE p.reversed_at IS NULL;

  IF active_payments <> 6 THEN
    RAISE EXCEPTION 'Unexpected active payment count: expected 6, found %', active_payments;
  END IF;
END;
$$;

UPDATE invoices i
SET grand_total = e.new_grand_total,
    version = i.version + 1,
    updated_at = NOW()
FROM expected_invoice_reconciliation e
WHERE i.id = e.invoice_id;

UPDATE invoice_payments p
SET amount = e.new_payment_amount
FROM expected_invoice_reconciliation e
WHERE p.id = e.payment_id;

INSERT INTO audit_logs(user_id, user_name, action, entity_type, entity_id, entity_ref, details)
SELECT auth.uid(),
       'production-reconciliation',
       'LEGACY_INVOICE_TOTAL_RECONCILE',
       'invoice',
       e.invoice_id::TEXT,
       e.invoice_number,
       jsonb_build_object(
         'old_grand_total', e.old_grand_total,
         'new_grand_total', e.new_grand_total,
         'payment_id', e.payment_id,
         'old_payment_amount', e.old_payment_amount,
         'new_payment_amount', e.new_payment_amount,
         'reason', 'Replace legacy whole-baht total with exact taxable base plus VAT'
       )
FROM expected_invoice_reconciliation e;

DO $$
DECLARE
  reconciled_invoices INTEGER;
  reconciled_payments INTEGER;
BEGIN
  SELECT COUNT(*) INTO reconciled_invoices
  FROM invoices i
  JOIN expected_invoice_reconciliation e
    ON e.invoice_id = i.id
   AND e.new_grand_total = i.grand_total;

  SELECT COUNT(*) INTO reconciled_payments
  FROM invoice_payments p
  JOIN expected_invoice_reconciliation e
    ON e.payment_id = p.id
   AND e.new_payment_amount = p.amount
  WHERE p.reversed_at IS NULL;

  IF reconciled_invoices <> 7 OR reconciled_payments <> 6 THEN
    RAISE EXCEPTION 'Postcondition failed: invoices %, payments %', reconciled_invoices, reconciled_payments;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM expected_invoice_reconciliation e
    JOIN invoices i ON i.id = e.invoice_id
    LEFT JOIN invoice_payments p ON p.invoice_id = i.id AND p.reversed_at IS NULL
    GROUP BY e.invoice_id, i.status, i.payment_status, i.grand_total
    HAVING (i.status = 'paid' AND (
              NOT i.payment_status
              OR ROUND(COALESCE(SUM(p.amount), 0), 2) <> i.grand_total
            ))
        OR (i.status = 'issued' AND (
              i.payment_status
              OR ROUND(COALESCE(SUM(p.amount), 0), 2) <> 0
            ))
  ) THEN
    RAISE EXCEPTION 'Invoice status no longer agrees with the active payment ledger';
  END IF;
END;
$$;

COMMIT;