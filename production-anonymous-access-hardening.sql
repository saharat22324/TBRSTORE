-- TBR System: close anonymous access and protect invoice retention.
-- Production precondition: backup_20260802 row counts must still match.
-- This migration is transactional; any error rolls back every change.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Refuse to continue if the verified backup is no longer current for the
-- accounting/customer tables affected by this migration.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.customers) <>
     (SELECT count(*) FROM backup_20260802.customers) THEN
    RAISE EXCEPTION 'customers backup row count is stale';
  END IF;
  IF (SELECT count(*) FROM public.invoices) <>
     (SELECT count(*) FROM backup_20260802.invoices) THEN
    RAISE EXCEPTION 'invoices backup row count is stale';
  END IF;
END $$;

-- The application requires Supabase Auth. Anonymous clients must not access
-- application tables or sequences directly.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon;

-- Remove the known policies that explicitly bypass authentication.
DROP POLICY IF EXISTS anon_read_profiles ON public.profiles;
DROP POLICY IF EXISTS anon_read_services ON public.services;
DROP POLICY IF EXISTS anon_write_services ON public.services;
DROP POLICY IF EXISTS anon_read_ledger ON public.stock_ledger;
DROP POLICY IF EXISTS anon_write_ledger ON public.stock_ledger;

-- Enable RLS on every application table found without it during the full audit.
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- RPCs that mutate sequence/invoice state must require an authenticated role.
REVOKE ALL ON FUNCTION public.create_invoice_atomic(JSONB, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(JSONB, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(JSONB, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.next_document_number(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_document_number(VARCHAR, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(VARCHAR, VARCHAR, VARCHAR) TO authenticated;

-- Customer deletion must never cascade into issued accounting documents.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id)
  ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_customer_id_fkey;

-- Fail closed if any intended protection is missing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee = 'anon'
      AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'anonymous table privileges remain';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND 'anon' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'anonymous RLS policies remain';
  END IF;

  IF has_function_privilege(
    'anon', 'public.create_invoice_atomic(jsonb,jsonb)', 'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.next_document_number(character varying,character varying,character varying)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous mutating RPC execution remains';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'one or more public tables do not have RLS enabled';
  END IF;

  IF COALESCE((
    SELECT confdeltype
    FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_customer_id_fkey'
  ), '') <> 'r' THEN
    RAISE EXCEPTION 'invoice customer FK is not ON DELETE RESTRICT';
  END IF;
END $$;

COMMIT;

-- Recovery plan (only if explicitly required): restore from backup_20260802;
-- do not re-enable anonymous access. A failed run needs no recovery because the
-- transaction rolls back automatically.
