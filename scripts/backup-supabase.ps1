param(
  [string]$OutputDirectory = ".\backups",
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw 'Set SUPABASE_DB_URL in the terminal environment. Never store it in the repository.'
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'pg_dump is required. Install PostgreSQL client tools and retry.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dumpPath = Join-Path $OutputDirectory "tbr-production-$stamp.dump"
$manifestPath = Join-Path $OutputDirectory "tbr-production-$stamp.sha256"

& pg_dump $DatabaseUrl --format=custom --no-owner --no-acl --file=$dumpPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

$hash = (Get-FileHash -Algorithm SHA256 -Path $dumpPath).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($dumpPath))" | Set-Content -Encoding ascii $manifestPath
Write-Output "Backup: $dumpPath"
Write-Output "SHA256: $hash"
Write-Output 'Restore only to staging first: pg_restore --clean --if-exists --no-owner --dbname <STAGING_URL> <dump>'
