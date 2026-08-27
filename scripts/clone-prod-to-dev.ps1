#Requires -Version 5.1
<#
.SYNOPSIS
  Dump production Postgres and restore into mll-dev only.

.DESCRIPTION
  SAFETY: This script never writes to production. It refuses to run unless
  PROD_DB_URL contains the production project ref and DEV_DB_URL contains
  the mll-dev project ref. Restore is disabled unless -Execute is passed
  AND the operator types: CLONE PROD TO MLL-DEV

  Dump/restore uses pg_dump and psql (data-only). Auth clone is limited to
  auth.users and auth.identities. Docker and Supabase CLI are not required.

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
    if ($arg -match "^postgres(ql)?://") {
      $shownParts.Add("[REDACTED]")
      continue
    }
    if (($arg -eq "--db-url" -or $arg -eq "--dbname" -or $arg -eq "-d") -and ($i + 1) -lt $ArgumentList.Count) {
      $shownParts.Add($arg)
      $shownParts.Add("[REDACTED]")
      $i++
      continue
    }
    if ($arg.StartsWith("--db-url=") -or $arg.StartsWith("--dbname=")) {
      $shownParts.Add(($arg.Substring(0, $arg.IndexOf("=")) + "=[REDACTED]"))
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

function Invoke-PgDumpData {
  param(
    [Parameter(Mandatory = $true)][string]$DbUrl,
    [Parameter(Mandatory = $true)][string]$OutFile,
    [string]$Schema,
    [string[]]$Tables = @()
  )
  $dumpArgs = New-Object System.Collections.Generic.List[string]
  $dumpArgs.Add("--dbname")
  $dumpArgs.Add($DbUrl)
  $dumpArgs.Add("--data-only")
  $dumpArgs.Add("--no-owner")
  $dumpArgs.Add("--no-privileges")
  $dumpArgs.Add("--file=$OutFile")
  if ($Tables.Count -gt 0) {
    foreach ($table in $Tables) {
      $dumpArgs.Add("--table=$table")
    }
  } elseif (-not [string]::IsNullOrWhiteSpace($Schema)) {
    $dumpArgs.Add("--schema=$Schema")
  } else {
    Write-Fail "pg_dump requires a schema or an explicit table list. Connection strings were not printed."
  }
  Invoke-Checked "pg_dump" $dumpArgs.ToArray()
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

if (-not (Test-HasCommand "pg_dump")) {
  Write-Fail "pg_dump is required. Install PostgreSQL client tools (no Docker / no Supabase CLI dump)."
}
if (-not (Test-HasCommand "psql")) {
  Write-Fail "psql is required. Install PostgreSQL client tools (no Docker / no Supabase CLI dump)."
}

Write-Host "pg_dump: available"
Write-Host "psql: available"
Write-Host ""

Write-Host "Plan:"
Write-Host "  Auth clone: users + identities only; no sessions/tokens/MFA runtime state"
Write-Host "  1. Create dated files under .local-backups/ (gitignored)"
Write-Host "  2. pg_dump current mll-dev public data, then auth.users + auth.identities (destination backup first)"
Write-Host "  3. pg_dump production public data, then auth.users + auth.identities (read-only on production)"
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
Write-Host "  - require Docker or supabase db dump"
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
$authTables = @(
  "auth.users",
  "auth.identities"
)

Write-Host ""
Write-Host "Backup destination (mll-dev) first..."
Invoke-PgDumpData -DbUrl $devUrl -Schema "public" -OutFile $devPublicBackup
Write-Host "  wrote $(Split-Path $devPublicBackup -Leaf)"
Invoke-PgDumpData -DbUrl $devUrl -OutFile $devAuthBackup -Tables $authTables
Write-Host "  wrote $(Split-Path $devAuthBackup -Leaf)"

Write-Host ""
Write-Host "Dump production (read-only)..."
Invoke-PgDumpData -DbUrl $prodUrl -Schema "public" -OutFile $prodPublicDump
Write-Host "  wrote $(Split-Path $prodPublicDump -Leaf)"
Invoke-PgDumpData -DbUrl $prodUrl -OutFile $prodAuthDump -Tables $authTables
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
