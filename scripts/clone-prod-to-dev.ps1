#Requires -Version 5.1
<#
.SYNOPSIS
  Dump production Postgres and restore into mll-dev only.

.DESCRIPTION
  SAFETY: This script never writes to production. It refuses to run unless
  PROD_DB_URL contains the production project ref and DEV_DB_URL contains
  the mll-dev project ref. Restore is disabled unless -Execute is passed
  AND the operator types: CLONE PROD TO MLL-DEV

  Do not run this until the clone has been explicitly approved.

.PARAMETER Execute
  Perform dump + restore. Without this flag the script only validates
  environment and prints the plan (no dump, no restore).

.PARAMETER SkipRestore
  With -Execute: dump production and back up mll-dev, but do not restore.

.PARAMETER ConfirmPhrase
  Optional. If set, must equal CLONE PROD TO MLL-DEV. Otherwise the
  script prompts interactively.
#>
[CmdletBinding()]
param(
  [switch]$Execute,
  [switch]$SkipRestore,
  [string]$ConfirmPhrase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProdRef = "jhjdhmjkcnjtbojocjam"
$DevRef = "bjtfrmkhishoadjtpzgg"
$RequiredPhrase = "CLONE PROD TO MLL-DEV"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackupRoot = Join-Path $RepoRoot ".local-backups"

function Write-Fail([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

function Test-HasCommand([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-Checked([string]$File, [string[]]$ArgumentList) {
  $shownParts = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $ArgumentList.Count; $i++) {
    $arg = $ArgumentList[$i]
    if ($arg -eq "--db-url" -and ($i + 1) -lt $ArgumentList.Count) {
      $shownParts.Add("--db-url")
      $shownParts.Add("[REDACTED]")
      $i++
      continue
    }
    if ($arg -eq "--dbname" -and ($i + 1) -lt $ArgumentList.Count) {
      $shownParts.Add("--dbname")
      $shownParts.Add("[REDACTED]")
      $i++
      continue
    }
    $shownParts.Add($arg)
  }
  $shown = $shownParts -join " "
  Write-Host "  > $File $shown" -ForegroundColor DarkGray
  & $File @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "$File failed with exit code $LASTEXITCODE. Connection strings were not printed."
  }
}

$prodUrl = $env:PROD_DB_URL
$devUrl = $env:DEV_DB_URL

Write-Host ""
Write-Host "============================================================"
Write-Host " My Latino List - production to mll-dev clone"
Write-Host "============================================================"
Write-Host " SOURCE      = production  ($ProdRef)"
Write-Host " DESTINATION = mll-dev     ($DevRef)"
if ($Execute) { $modeLabel = "EXECUTE" } else { $modeLabel = "PLAN / DRY-RUN (no dump, no restore)" }
Write-Host " MODE        = $modeLabel"
Write-Host "============================================================"
Write-Host ""

if ([string]::IsNullOrWhiteSpace($prodUrl)) {
  Write-Fail "Set PROD_DB_URL to the production Postgres connection string (do not paste it into git)."
}
if ([string]::IsNullOrWhiteSpace($devUrl)) {
  Write-Fail "Set DEV_DB_URL to the mll-dev Postgres connection string (do not paste it into git)."
}
if ($prodUrl -eq $devUrl) {
  Write-Fail "PROD_DB_URL and DEV_DB_URL are identical. Refusing to run."
}
if ($devUrl -match [regex]::Escape($ProdRef)) {
  Write-Fail "DEV_DB_URL contains the production project ref. Destination must be mll-dev only."
}
if ($prodUrl -notmatch [regex]::Escape($ProdRef)) {
  Write-Fail "PROD_DB_URL does not contain the production project ref ($ProdRef)."
}
if ($devUrl -notmatch [regex]::Escape($DevRef)) {
  Write-Fail "DEV_DB_URL does not contain the mll-dev project ref ($DevRef)."
}
if ($prodUrl -match [regex]::Escape($DevRef)) {
  Write-Fail "PROD_DB_URL contains the mll-dev project ref. Source must be production only."
}

Write-Host "Connection check:"
Write-Host "  PROD_DB_URL = SET"
Write-Host "  DEV_DB_URL  = SET"
Write-Host ""

if (-not (Test-HasCommand "supabase")) {
  Write-Fail "Supabase CLI is not installed. Install with: scoop install supabase   or   npm install -g supabase"
}

$supabaseVersion = (& supabase --version 2>$null | Select-Object -First 1)
Write-Host "Supabase CLI: $supabaseVersion"

$psqlReady = Test-HasCommand "psql"
if ($psqlReady) {
  Write-Host "psql:          available"
} else {
  Write-Host "psql:          MISSING (required for restore)"
  Write-Host "  Install: scoop install postgresql   OR  https://www.postgresql.org/download/windows/"
}

Write-Host ""
Write-Host "Plan:"
Write-Host "  1. Create dated files under .local-backups/ (gitignored)"
Write-Host "  2. Dump current mll-dev (public data + auth data) as a rollback copy"
Write-Host "  3. Dump production public data and auth data (read-only on production)"
Write-Host "  4. Restore ONLY into mll-dev (truncate destination, then psql)"
Write-Host "  5. Operator runs scripts/sanitize-dev.sql in the mll-dev SQL editor"
Write-Host "  6. Operator runs: node scripts/sanitize-dev-auth.mjs"
Write-Host "  7. Re-apply supabase/migrations/004_worker_schema_align.sql on mll-dev if needed"
Write-Host "  8. Run scripts/validate-clone.sql (read-only)"
Write-Host ""
Write-Host "This script does NOT:"
Write-Host "  - write to production"
Write-Host "  - copy R2 / Storage"
Write-Host "  - enable Stripe live mode"
Write-Host "  - send email"
Write-Host "  - commit backup files"
Write-Host ""

if (-not $Execute) {
  Write-Host "STOPPED. No dump or restore was performed." -ForegroundColor Yellow
  Write-Host "After explicit approval, the execute command is:"
  Write-Host ""
  Write-Host "  `$env:PROD_DB_URL = <production session-pooler URI>"
  Write-Host "  `$env:DEV_DB_URL  = <mll-dev session-pooler URI>"
  Write-Host "  powershell -File .\scripts\clone-prod-to-dev.ps1 -Execute"
  Write-Host ""
  Write-Host "You will be required to type: $RequiredPhrase"
  Write-Host ""
  exit 0
}

if (-not $psqlReady -and -not $SkipRestore) {
  Write-Fail "psql is required to restore into mll-dev. Install PostgreSQL client tools, or pass -SkipRestore to dump only."
}

$typed = $ConfirmPhrase
if ([string]::IsNullOrWhiteSpace($typed)) {
  Write-Host "Type exactly: $RequiredPhrase" -ForegroundColor Yellow
  $typed = Read-Host "Confirmation"
}
if ($typed -cne $RequiredPhrase) {
  Write-Fail "Confirmation phrase did not match. Restore aborted."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$devPublicBackup = Join-Path $BackupRoot "mll-dev-public-$stamp.sql"
$devAuthBackup = Join-Path $BackupRoot "mll-dev-auth-$stamp.sql"
$prodPublicDump = Join-Path $BackupRoot "prod-public-$stamp.sql"
$prodAuthDump = Join-Path $BackupRoot "prod-auth-$stamp.sql"

Write-Host ""
$authExclude = @(
  "-x", "auth.sessions",
  "-x", "auth.refresh_tokens",
  "-x", "auth.audit_log_entries"
)

Write-Host "Backup destination (mll-dev) first..."
Invoke-Checked "supabase" @("db", "dump", "--db-url", $devUrl, "-f", $devPublicBackup, "--data-only", "--use-copy", "--schema", "public")
Invoke-Checked "supabase" (@("db", "dump", "--db-url", $devUrl, "-f", $devAuthBackup, "--data-only", "--use-copy", "--schema", "auth") + $authExclude)
Write-Host "  wrote $(Split-Path $devPublicBackup -Leaf)"
Write-Host "  wrote $(Split-Path $devAuthBackup -Leaf)"

Write-Host ""
Write-Host "Dump production (read-only)..."
Invoke-Checked "supabase" @("db", "dump", "--db-url", $prodUrl, "-f", $prodPublicDump, "--data-only", "--use-copy", "--schema", "public")
Invoke-Checked "supabase" (@("db", "dump", "--db-url", $prodUrl, "-f", $prodAuthDump, "--data-only", "--use-copy", "--schema", "auth") + $authExclude)
Write-Host "  wrote $(Split-Path $prodPublicDump -Leaf)"
Write-Host "  wrote $(Split-Path $prodAuthDump -Leaf)"

if ($SkipRestore) {
  Write-Host ""
  Write-Host "SkipRestore set. mll-dev was NOT modified after the backup dump." -ForegroundColor Yellow
  Write-Host "Dump files are under .local-backups/ (gitignored)."
  exit 0
}

Write-Host ""
Write-Host "Restoring into mll-dev only..."
$truncateSql = Join-Path $PSScriptRoot "clone-truncate-dev.sql"
if (-not (Test-Path $truncateSql)) {
  Write-Fail "Missing $truncateSql"
}

$env:PGPASSWORD = $null
$psqlCommon = @("--dbname", $devUrl, "--single-transaction", "--set=ON_ERROR_STOP=1")
Invoke-Checked "psql" ($psqlCommon + @("-f", $truncateSql))
Invoke-Checked "psql" ($psqlCommon + @("-f", $prodAuthDump))
Invoke-Checked "psql" ($psqlCommon + @("-f", $prodPublicDump))

Write-Host ""
Write-Host "Restore into mll-dev finished." -ForegroundColor Green
Write-Host "NEXT (required before using staging with this data):"
Write-Host "  1. Run scripts/sanitize-dev.sql in the mll-dev SQL editor"
Write-Host "  2. node scripts/sanitize-dev-auth.mjs   (requires SUPABASE_URL + SUPABASE_SERVICE_KEY for mll-dev)"
Write-Host "  3. Apply supabase/migrations/004_worker_schema_align.sql on mll-dev if columns are missing"
Write-Host "  4. Run scripts/validate-clone.sql in the mll-dev SQL editor"
Write-Host ""
Write-Host "Do not point staging at production. Do not enable Stripe live keys."
Write-Host ""
