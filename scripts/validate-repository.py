import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []


def require(path: str, pattern: str, message: str) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    if not re.search(pattern, text, re.MULTILINE):
        ERRORS.append(f"{path}: {message}")


def forbid(path: str, pattern: str, message: str) -> None:
    text = (ROOT / path).read_text(encoding="utf-8")
    if re.search(pattern, text, re.MULTILINE):
        ERRORS.append(f"{path}: {message}")


def main() -> int:
    require(
        "index.html",
        r"@supabase/supabase-js@2\.57\.4",
        "Supabase JS must be pinned to the reviewed version",
    )
    require(
        "20260804_atomic_requisition_and_write_hardening.sql",
        r"CREATE OR REPLACE FUNCTION create_requisition_atomic",
        "atomic requisition creation RPC is missing",
    )
    require(
        "20260804_atomic_requisition_and_write_hardening.sql",
        r"DROP POLICY IF EXISTS team_write_invoice_payments",
        "direct payment writes are not removed",
    )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_stock_update[\s\S]{0,160}USING \(TRUE\)",
        "stock updates must remain role restricted",
    )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_requisitions_(insert|update|delete)",
        "requisition writes must use atomic RPCs",
    )
    forbid(
        "js/jobs.js",
        r"updateStockBySku",
        "job requisitions must not update stock outside their RPC transaction",
    )
    require(
        "20260805_fractional_stock_quantities.sql",
        r"ALTER COLUMN quantity TYPE NUMERIC\(12,3\)",
        "fractional stock quantity migration is missing",
    )
    forbid(
        "20260805_fractional_stock_quantities.sql",
        r"v_qty::INTEGER|positive whole number",
        "active requisition RPCs must preserve fractional quantities",
    )
    require(
        "20260806_atomic_stock_operations.sql",
        r"CREATE OR REPLACE FUNCTION receive_purchase_order_atomic",
        "atomic purchase-order receiving RPC is missing",
    )
    require(
        "js/stock.js",
        r"await adjustStockAtomic",
        "manual stock adjustment must await its atomic RPC",
    )
    require(
        "js/purchasing.js",
        r"await receivePurchaseOrderAtomic",
        "purchase-order receiving must await its atomic RPC",
    )
    forbid(
        "js/stock.js",
        r"updateStockBySku",
        "manual stock adjustment must not write quantity directly",
    )
    forbid(
        "js/purchasing.js",
        r"updateStockBySku",
        "purchase-order receiving must not write quantity directly",
    )
    require(
        "js/stock.js",
        r"await saveStockItemAtomic",
        "stock item saves must await their atomic RPC",
    )
    forbid(
        "js/stock.js",
        r"upsertStockItemBySku",
        "stock item UI must not use direct upserts",
    )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_stock_(insert|update)",
        "stock item insert/update policies must remain RPC-only",
    )
    require(
        "scripts/backup-supabase.py",
        r"os\.environ\.get\(name, \"\"\)\.strip\(\) or default",
        "blank optional backup settings must use connection defaults",
    )
    require(
        ".github/workflows/backup.yml",
        r"postgresql-client-17",
        "Production backups must use the reviewed PostgreSQL 17 client",
    )
    require(
        ".github/workflows/backup.yml",
        r"--decrypt backups-ci/\*\.dump\.gpg[\s\S]*pg_restore --list backups-ci/restore-check\.dump",
        "encrypted backups must pass a decryption and restore-catalog check",
    )
    require(
        "js/stock.js",
        r"await archiveStockItemAtomic",
        "stock removal must await the archive RPC",
    )
    forbid(
        "js/stock.js",
        r"deleteStockItemBySku",
        "stock UI must not delete historical items",
    )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_stock_delete",
        "direct stock deletion must remain disabled",
    )
    require(
        "secure-cost-data.sql",
        r"quantity NUMERIC\(12,3\)[\s\S]*WHERE s\.active",
        "secure stock reads must preserve fractions and hide archived items",
    )
    require(
        "20260809_atomic_purchase_order_lifecycle.sql",
        r"CREATE OR REPLACE FUNCTION create_purchase_order_atomic[\s\S]*pg_advisory_xact_lock",
        "purchase-order creation must be atomic and number locked",
    )
    require(
        "20260809_atomic_purchase_order_lifecycle.sql",
        r"CREATE OR REPLACE FUNCTION cancel_purchase_order_atomic[\s\S]*FOR UPDATE[\s\S]*status<>'pending'",
        "purchase-order cancellation must lock and guard pending status",
    )
    require(
        "js/purchasing.js",
        r"await createPurchaseOrderAtomic[\s\S]*S\.purchaseOrders\.push\(po\)",
        "local purchase-order creation must follow server success",
    )
    require(
        "js/purchasing.js",
        r"await cancelPurchaseOrderAtomic[\s\S]*po\.status = 'cancelled'",
        "local purchase-order cancellation must follow server success",
    )
    forbid(
        "js/purchasing.js",
        r"\b(addPO|updatePO|deletePO)\(",
        "purchase-order UI must not use direct writes",
    )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_purchase_orders_(insert|update|delete)",
        "purchase-order writes must remain RPC-only",
    )
    require(
        "20260810_atomic_job_updates.sql",
        r"CREATE OR REPLACE FUNCTION update_job_atomic[\s\S]*jsonb_object_keys\(p_updates\)[\s\S]*FOR UPDATE[\s\S]*p_updates\?'status_id'",
        "job updates must lock rows and preserve omitted patch fields",
    )
    require(
        "20260810_atomic_job_updates.sql",
        r"UPDATE vehicles SET mileage=v_mileage[\s\S]*UPDATE jobs SET",
        "job and vehicle mileage updates must share one transaction",
    )
    require(
        "js/jobs.js",
        r"await updateJobAtomic[\s\S]*Object\.assign\(j,data\)",
        "local job edits must follow server success",
    )
    require(
        "js/jobs.js",
        r"await updateJobAtomic\(j\.id,oldStatus \+ 1[\s\S]*j\.status = newStatus",
        "local job status changes must follow server success",
    )
    forbid(
        "js/jobs.js",
        r"\b(updateJob|updateVehicle)\(",
        "job workflows must not use direct updates",
    )
    require(
        "js/jobs.js",
        r"\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$",
        "job cloud writes must use complete UUID validation",
    )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_jobs_update",
        "job updates must remain RPC-only",
    )
    require(
        "20260811_atomic_job_creation.sql",
        r"CREATE OR REPLACE FUNCTION create_job_atomic[\s\S]*pg_advisory_xact_lock[\s\S]*FOR UPDATE[\s\S]*UPDATE vehicles[\s\S]*INSERT INTO jobs",
        "job creation and vehicle mileage updates must be atomic",
    )
    require(
        "js/jobs.js",
        r"await createJobAtomic[\s\S]*S\.jobs\.push\(newJob\)",
        "local job creation must follow server success",
    )
    for path in ("js/supabaseService.js", "js/jobs.js", "js/db.js"):
        forbid(
            path,
            r"\baddJob\(",
            "job creation must not use direct inserts",
        )
    forbid(
        "production-role-policies.sql",
        r"CREATE POLICY prod_jobs_insert",
        "job creation must remain RPC-only",
    )
    require(
        "20260812_fractional_invoice_stock.sql",
        r"v_qty NUMERIC\(12,3\)[\s\S]*quantity=quantity-v_qty[\s\S]*quantity=quantity\+v_old\.qty[\s\S]*quantity=quantity\+v_item\.qty",
        "invoice create, edit and cancellation must preserve fractional stock",
    )
    forbid(
        "20260812_fractional_invoice_stock.sql",
        r"TRUNC\(|::INTEGER|whole number",
        "invoice stock quantities must not be truncated to integers",
    )
    forbid(
        "production-accounting-completion.sql",
        r"v_(qty|old\.qty|item\.qty)::INTEGER|Stock quantity must be a whole number",
        "authoritative invoice lifecycle must preserve fractional stock",
    )
    require(
        "js/supabaseService.js",
        r"reportSupabaseWriteError\(err, 'addInvoice'\);\s*throw err;",
        "invoice RPC errors must reach the billing workflow",
    )
    require(
        "js/billing.js",
        r"if \(useSupabase && !_invCloudOk\)[\s\S]*return;[\s\S]*if \(billedJob\) billedJob\.status = 5",
        "job closure must follow successful invoice creation",
    )
    require(
        "20260813_atomic_quote_lifecycle.sql",
        r"CREATE OR REPLACE FUNCTION create_quote_atomic[\s\S]*pg_advisory_xact_lock[\s\S]*INSERT INTO quotes",
        "quotation creation must be atomic and number locked",
    )
    require(
        "20260813_atomic_quote_lifecycle.sql",
        r"CREATE OR REPLACE FUNCTION convert_quote_atomic[\s\S]*FOR UPDATE[\s\S]*already converted",
        "quotation conversion must lock and guard the current state",
    )
    require(
        "js/billing.js",
        r"await createQuoteAtomic\(qt\)[\s\S]*S\.quotes\.push\(qt\)",
        "local quotation creation must follow server success",
    )
    require(
        "js/docs.js",
        r"await convertQuoteAtomic\(q\.id\)[\s\S]*q\.converted = true",
        "local quotation conversion must follow server success",
    )
    forbid(
        "js/supabaseService.js",
        r"\b(addQuote|updateQuote|deleteQuote)\(",
        "quotation writes must use atomic RPCs",
    )
    forbid(
        "SQL_FINAL_MIGRATION.sql",
        r"CREATE POLICY \"quotes_(insert|update|delete)\"",
        "authoritative migration must keep quotation writes RPC-only",
    )

    if ERRORS:
        print("Repository validation failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print("Repository security invariants verified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
