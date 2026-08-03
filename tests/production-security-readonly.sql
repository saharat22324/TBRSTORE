-- Read-only Production verification for anonymous access, RLS and roles.
-- Safe to rerun: no data-changing functions are invoked.

BEGIN TRANSACTION READ ONLY;

SELECT
  count(*) FILTER (WHERE grantee = 'anon') AS anon_table_grants,
  count(*) FILTER (WHERE grantee = 'anon' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE')) AS anon_dml_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public';

SELECT tablename, count(*) AS anon_policy_count,
       string_agg(policyname, ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public' AND 'anon' = ANY(roles)
GROUP BY tablename
ORDER BY tablename;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
ORDER BY c.relname;

SELECT count(*) = 0 AS all_public_tables_have_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

SELECT conname, confdeltype,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.invoices'::regclass
  AND conname = 'invoices_customer_id_fkey';

SELECT
  NOT has_function_privilege(
    'anon', 'public.create_invoice_atomic(jsonb,jsonb)', 'EXECUTE'
  ) AS anon_cannot_create_invoice,
  has_function_privilege(
    'authenticated', 'public.create_invoice_atomic(jsonb,jsonb)', 'EXECUTE'
  ) AS authenticated_can_create_invoice,
  NOT has_function_privilege(
    'anon',
    'public.next_document_number(character varying,character varying,character varying)',
    'EXECUTE'
  ) AS anon_cannot_next_document_number,
  has_function_privilege(
    'authenticated',
    'public.next_document_number(character varying,character varying,character varying)',
    'EXECUTE'
  ) AS authenticated_can_next_document_number;

SELECT p.role::text AS app_role,
       CASE p.role::text
         WHEN 'admin' THEN COALESCE((
           SELECT bool_and(r.cost_price = s.cost_price)
           FROM get_stock_items_secure() r
           JOIN stock_items s USING (id)
         ), TRUE)
         ELSE COALESCE((
           SELECT bool_and(cost_price = 0)
           FROM get_stock_items_secure()
         ), TRUE)
       END AS cost_visibility_correct
FROM profiles p
WHERE p.id = auth.uid();

ROLLBACK;
