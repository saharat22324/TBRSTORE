-- Allow a cancelled job invoice to be replaced while preventing concurrent
-- active invoices from being linked to the same job.

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_active_job
ON invoices(job_id)
WHERE job_id IS NOT NULL
  AND status NOT IN ('cancelled','credited','refunded')
  AND document_type NOT IN ('credit_note','debit_note');