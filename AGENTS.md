# TBR Production Safety Rules

## Default behavior
- Production access is read-only by default.
- For analysis, review, planning, or auditing: do not edit files and do not run write commands.
- Do not make changes outside the explicitly requested scope.
- Do not claim success without showing actual command or test results.

## Local code changes
- Local files may be edited only when the user explicitly asks for implementation.
- Before editing, show the plan and files that will be changed.
- After editing, show Git diff and run appropriate tests.
- Do not commit, push, deploy, or merge unless explicitly authorized.

## Supabase Production
- Before running SQL against Supabase Production, show:
  1. Exact SQL to be executed
  2. Tables and data affected
  3. Expected result
  4. Risks
  5. Backup verification
  6. Rollback SQL or recovery plan
- After showing this review, proceed without waiting for an additional approval message when the operation is within the user's requested scope.
- Review each additional SQL operation separately; one reviewed operation does not authorize unrelated operations.

## High-risk Production operations
Execute the following only when explicitly required by the user's requested scope and after completing the Production review above:
- DROP
- DELETE
- TRUNCATE
- ALTER destructive changes
- Disabling or removing RLS
- Removing policies
- Resetting the database
- Replacing Production data
- Running unreviewed migrations

## Accounting and stock data
- Issued accounting documents must not be deleted.
- Prefer cancel, void, credit note, or reversal workflows.
- Billing, stock, purchasing, and payment operations must be atomic.
- Never modify Production financial or stock records merely to make a test pass.

## Verification
- Use read-only verification first.
- Show actual outputs for migrations, policies, tests, and row counts.
- Clearly distinguish verified facts from assumptions.
- Stop whenever the next action could change Production outside the user's requested scope or when backup and rollback requirements are not satisfied.
