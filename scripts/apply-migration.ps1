param(
  [Parameter(Mandatory = $true)][string]$Migration,
  [string]$Version,
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw 'Set SUPABASE_DB_URL in the terminal environment. Never store it in the repository.'
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'psql is required.' }
if (-not (Test-Path $Migration -PathType Leaf)) { throw "Migration not found: $Migration" }

$path = (Resolve-Path $Migration).Path
$hash = (Get-FileHash -Algorithm SHA256 -Path $path).Hash.ToLowerInvariant()
$version = if ([string]::IsNullOrWhiteSpace($Version)) { [IO.Path]::GetFileNameWithoutExtension($path) } else { $Version }
$safeVersion = $version.Replace("'", "''")
$temp = Join-Path $env:TEMP "tbr-migration-$([guid]::NewGuid().ToString('N')).sql"
try {
  $sql = Get-Content -Raw -Path $path
  $record = @"

BEGIN;
UPDATE public.schema_migrations
SET checksum_sha256 = '$hash', applied_at = NOW(), applied_by = auth.uid()
WHERE version = '$safeVersion';
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version='$safeVersion' AND checksum_sha256='$hash') THEN
    RAISE EXCEPTION 'Migration checksum was not recorded';
  END IF;
END `$`$;
COMMIT;
"@
  Set-Content -Path $temp -Value ($sql + $record) -Encoding utf8
  & psql $DatabaseUrl --set ON_ERROR_STOP=1 --file $temp
  if ($LASTEXITCODE -ne 0) { throw "Migration failed with exit code $LASTEXITCODE" }
  Write-Output "Applied: $version"
  Write-Output "SHA256: $hash"
} finally {
  Remove-Item $temp -Force -ErrorAction SilentlyContinue
}
