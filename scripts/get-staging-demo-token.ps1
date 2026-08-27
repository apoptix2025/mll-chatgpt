#Requires -Version 5.1
<#
.SYNOPSIS
  Obtain a short-lived mll-dev access token for staging QA.

.DESCRIPTION
  Targets only https://bjtfrmkhishoadjtpzgg.supabase.co
  Sets $env:STAGING_DEMO_TOKEN in the current session.
  Never prints the token or password.

  Dot-source so the env var survives:
    . .\scripts\get-staging-demo-token.ps1

  Clear:
    Remove-Item Env:\STAGING_DEMO_TOKEN
#>
[CmdletBinding()]
param(
  [string]$Email = 'qa.owner@demo.mylatinolist.io'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProdRef = 'jhjdhmjkcnjtbojocjam'
$StagingRef = 'bjtfrmkhishoadjtpzgg'
$StagingAuthUrl = "https://$StagingRef.supabase.co"

function Write-Fail([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

$supabaseUrl = $env:SUPABASE_URL
if ([string]::IsNullOrWhiteSpace($supabaseUrl)) {
  $supabaseUrl = $StagingAuthUrl
}
$supabaseUrl = $supabaseUrl.TrimEnd('/')

if ($supabaseUrl -match [regex]::Escape($ProdRef) -or $supabaseUrl -like '*api.mylatinolist.io*') {
  Write-Fail "Refuses to request tokens from production."
}
if ($supabaseUrl -notmatch [regex]::Escape($StagingRef)) {
  Write-Fail "Auth URL is not mll-dev ($StagingRef)."
}

$anon = $env:SUPABASE_ANON_KEY
if ([string]::IsNullOrWhiteSpace($anon)) {
  Write-Fail "Set SUPABASE_ANON_KEY for mll-dev (staging anon key). Do not paste it into source."
}

$password = $env:QA_DEMO_PASSWORD
if ([string]::IsNullOrWhiteSpace($password)) {
  $secure = Read-Host "QA demo password" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}
if ([string]::IsNullOrWhiteSpace($password)) {
  Write-Fail "QA password is required (QA_DEMO_PASSWORD or secure prompt)."
}

$tokenUrl = "$supabaseUrl/auth/v1/token?grant_type=password"
$headers = @{
  apikey         = $anon
  Authorization  = "Bearer $anon"
  'Content-Type' = 'application/json'
}
$bodyObj = @{ email = $Email; password = $password }
$bodyJson = $bodyObj | ConvertTo-Json -Compress
$password = $null
$bodyObj = $null

try {
  $response = Invoke-RestMethod -Uri $tokenUrl -Method POST -Headers $headers -Body $bodyJson -TimeoutSec 30
} catch {
  Write-Fail "Staging login failed. Password and token were not printed."
}

if (-not $response.access_token) {
  Write-Fail "Login response did not include an access token."
}

$env:STAGING_DEMO_TOKEN = $response.access_token
$expiresIn = $response.expires_in
Write-Host "STAGING_DEMO_TOKEN = SET"
if ($expiresIn) {
  Write-Host "expires_in_seconds = $expiresIn"
}
Write-Host "email = $Email"
Write-Host "host = $StagingRef.supabase.co"
Write-Host "Clear with: Remove-Item Env:\STAGING_DEMO_TOKEN"
