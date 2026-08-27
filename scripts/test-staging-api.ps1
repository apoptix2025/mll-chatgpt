#Requires -Version 5.1
<#
.SYNOPSIS
  Safe GET smoke tests against the staging Worker only.
#>
[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://mll-api-staging.sparkling-hill-934f.workers.dev',
  [string]$Token
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$AllowedHost = 'mll-api-staging.sparkling-hill-934f.workers.dev'
$ProductionMarkers = @(
  'api.mylatinolist.io',
  'mll-api-production',
  'mylatinolist.io'
)

function Write-Fail([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

$uri = [Uri]$BaseUrl
if ($uri.Host -ne $AllowedHost) {
  Write-Fail "Refusing to test host '$($uri.Host)'. Staging Worker only: $AllowedHost"
}
foreach ($marker in $ProductionMarkers) {
  if ($BaseUrl -like "*$marker*") {
    Write-Fail "Refusing production URL marker: $marker"
  }
}

$paths = @(
  '/api/health',
  '/api/businesses',
  '/api/jobs',
  '/api/marketplace',
  '/api/resources',
  '/api/affiliates',
  '/api/stats'
)

Write-Host ""
Write-Host "Staging API smoke tests"
Write-Host "  base: $BaseUrl"
Write-Host "  production endpoints are not called"
Write-Host ""

$failed = 0
$results = @()

foreach ($path in $paths) {
  $url = $BaseUrl.TrimEnd('/') + $path
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
    $code = [int]$response.StatusCode
    $ok = $code -ge 200 -and $code -lt 300
    $note = ''
    if ($path -eq '/api/health') {
      $json = $response.Content | ConvertFrom-Json
      $note = "worker=$($json.services.worker.status); supabase=$($json.services.supabase.status); stripe=$($json.services.stripe.status); resend=$($json.services.resend.status); businesses=$($json.stats.businesses)"
      if ($json.services.stripe.status -eq 'healthy' -and $json.env_vars.STRIPE_SECRET_KEY) {
        $note += '; WARN: Stripe key present — confirm TEST mode only'
      }
    }
    $line = [PSCustomObject]@{
      Status = $code
      Path   = $path
      Pass   = $ok
      Notes  = $note
    }
    $results += $line
    $color = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("  {0} {1}  {2}" -f $code, $path, $note) -ForegroundColor $color
    if (-not $ok) { $failed += 1 }
  } catch {
    $code = 0
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    Write-Host ("  FAIL {0} {1}" -f $path, $_.Exception.Message) -ForegroundColor Red
    $results += [PSCustomObject]@{ Status = $code; Path = $path; Pass = $false; Notes = $_.Exception.Message }
    $failed += 1
  }
}

$authToken = if ($Token) { $Token } elseif ($env:STAGING_DEMO_TOKEN) { $env:STAGING_DEMO_TOKEN } else { $null }
if ($authToken) {
  Write-Host ""
  Write-Host "Authenticated GET /api/auth/me (token value not printed)"
  try {
    $headers = @{ Authorization = "Bearer $authToken" }
    $response = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + '/api/auth/me') -Headers $headers -UseBasicParsing -TimeoutSec 30
    Write-Host ("  {0} /api/auth/me" -f [int]$response.StatusCode) -ForegroundColor Green
  } catch {
    Write-Host "  FAIL /api/auth/me (token not printed)" -ForegroundColor Yellow
    $failed += 1
  }
} else {
  Write-Host ""
  Write-Host "Authenticated tests skipped. Set STAGING_DEMO_TOKEN for a staging demo session only."
}

Write-Host ""
if ($failed -gt 0) {
  Write-Host "RESULT: $failed check(s) failed." -ForegroundColor Red
  exit 1
}
Write-Host "RESULT: staging GET smoke tests passed." -ForegroundColor Green
Write-Host "No billing, no production calls, no writes."
Write-Host ""
