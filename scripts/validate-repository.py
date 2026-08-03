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

    if ERRORS:
        print("Repository validation failed:")
        for error in ERRORS:
            print(f"- {error}")
        return 1

    print("Repository security invariants verified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
