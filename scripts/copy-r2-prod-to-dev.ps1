#Requires -Version 5.1
<#
.SYNOPSIS
  Optional copy of production R2 objects into mll-media-dev.

.DESCRIPTION
  Does NOT run a copy unless -ExecuteCopy is passed.
  Default mode lists source keys only (dry-run).
  Never deletes objects in either bucket.
  Never copies unless source is mll-media and destination is mll-media-dev.

  Do not execute this until explicitly approved. Initial QA should use
  local frontend/assets demo images instead of a full bucket copy.
#>
[CmdletBinding()]
param(
  [switch]$ExecuteCopy,
  [int]$Limit = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SourceBucket = 'mll-media'
$DestBucket = 'mll-media-dev'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Write-Fail([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

if ($SourceBucket -eq $DestBucket) {
  Write-Fail "Source and destination buckets are identical."
}
if ($SourceBucket -ne 'mll-media') {
  Write-Fail "Source bucket must be production mll-media."
}
if ($DestBucket -ne 'mll-media-dev') {
  Write-Fail "Destination bucket must be staging mll-media-dev."
}

Write-Host ""
Write-Host "============================================================"
Write-Host " R2 copy (optional)"
Write-Host "============================================================"
Write-Host " SOURCE      = $SourceBucket      (production media)"
Write-Host " DESTINATION = $DestBucket  (staging only)"
Write-Host " MODE        = $(if ($ExecuteCopy) { 'COPY' } else { 'DRY-RUN / LIST ONLY' })"
Write-Host "============================================================"
Write-Host ""
Write-Host "This script will not delete objects in either bucket."
Write-Host "Prefer local frontend/assets/businesses/ for first-pass QA."
Write-Host ""

Push-Location (Join-Path $RepoRoot 'workers')
try {
  Write-Host "Listing source keys (mll-media)..."
  npx wrangler r2 object list $SourceBucket
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "Failed to list $SourceBucket. No objects were copied."
  }

  if (-not $ExecuteCopy) {
    Write-Host ""
    Write-Host "STOPPED. Dry-run only. No objects were copied." -ForegroundColor Yellow
    Write-Host "After explicit approval:"
    Write-Host "  powershell -File .\scripts\copy-r2-prod-to-dev.ps1 -ExecuteCopy"
    Write-Host ""
    exit 0
  }

  Write-Fail "Automatic object-by-object copy is not enabled. Use a selective, approved copy later. Source must stay mll-media and destination mll-media-dev. Do not delete objects. Do not point staging at the production bucket."
}
finally {
  Pop-Location
}
