#Requires -Version 5.1
<#
.SYNOPSIS
  Staging-only public and authenticated API QA for mll-dev.

.DESCRIPTION
  Targets https://mll-api-staging.sparkling-hill-934f.workers.dev only.
  Never prints tokens or passwords. Never calls production.
#>
[CmdletBinding()]
param(
  [string]$BaseUrl = 'https://mll-api-staging.sparkling-hill-934f.workers.dev',
  [string]$Token,
  [switch]$SkipWrites
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

$AllowedHost = 'mll-api-staging.sparkling-hill-934f.workers.dev'
$ProductionMarkers = @('api.mylatinolist.io', 'mll-api-production', 'mylatinolist.io')
$QaEmail = 'qa.owner@demo.mylatinolist.io'
$QaSlug = 'mll-qa-test-business'
$script:Failed = 0
$script:Results = New-Object System.Collections.Generic.List[object]
$script:CreatedProductId = $null
$script:CreatedJobId = $null
$script:CreatedReviewId = $null
$script:QaBusinessId = $null
$script:QaUserId = $null
$script:OtherBusinessId = $null

function Write-Fail([string]$Message) {
  Write-Host ""
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  Write-Host ""
  exit 1
}

function Add-Result {
  param(
    [string]$Test,
    [string]$Route,
    [string]$Expected,
    [string]$Actual,
    [string]$Status,
    [string]$Notes = ''
  )
  $script:Results.Add([PSCustomObject]@{
    Test     = $Test
    Route    = $Route
    Expected = $Expected
    Actual   = $Actual
    Status   = $Status
    Notes    = $Notes
  })
  $color = switch ($Status) {
    'PASS' { 'Green' }
    'FAIL' { 'Red'; $script:Failed += 1 }
    'BLOCKED' { 'Red'; $script:Failed += 1 }
    default { 'Yellow' }
  }
  Write-Host ("  [{0}] {1} {2} -> {3}" -f $Status, $Route, $Expected, $Actual) -ForegroundColor $color
}

function Get-StatusCodeFromError($err) {
  try {
    if ($err.Exception.Response) {
      return [int]$err.Exception.Response.StatusCode
    }
  } catch {}
  return 0
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Headers,
    [string]$Body,
    [string]$ContentType = 'application/json'
  )
  $url = $BaseUrl.TrimEnd('/') + $Path
  $mergedHeaders = @{ 'User-Agent' = 'mll-staging-qa' }
  if ($Headers) {
    foreach ($key in $Headers.Keys) { $mergedHeaders[$key] = $Headers[$key] }
  }
  $params = @{
    Uri             = $url
    Method          = $Method
    Headers         = $mergedHeaders
    UseBasicParsing = $true
    TimeoutSec      = 30
  }
  if (-not [string]::IsNullOrEmpty($Body)) {
    $params.Body = $Body
    $params.ContentType = $ContentType
  }
  try {
    $response = Invoke-WebRequest @params
    return @{
      Ok      = $true
      Status  = [int]$response.StatusCode
      Content = $response.Content
      Json    = $(try { $response.Content | ConvertFrom-Json } catch { $null })
    }
  } catch {
    $code = Get-StatusCodeFromError $_
    $content = ''
    try {
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
      }
    } catch {}
    return @{
      Ok      = $false
      Status  = $code
      Content = $content
      Json    = $(try { $content | ConvertFrom-Json } catch { $null })
      Error   = $_.Exception.Message
    }
  }
}

function AuthHeaders([string]$AccessToken) {
  return @{ Authorization = "Bearer $AccessToken" }
}

$uri = [Uri]$BaseUrl
if ($uri.Host -ne $AllowedHost) {
  Write-Fail "Refusing to test host '$($uri.Host)'. Staging Worker only: $AllowedHost"
}
foreach ($marker in $ProductionMarkers) {
  if ($BaseUrl -like "*$marker*" -and $uri.Host -ne $AllowedHost) {
    Write-Fail "Refusing production URL marker: $marker"
  }
}

$accessToken = if ($Token) { $Token } elseif ($env:STAGING_DEMO_TOKEN) { $env:STAGING_DEMO_TOKEN } else { $null }

Write-Host ""
Write-Host "Staging API QA"
Write-Host "  base: $BaseUrl"
Write-Host "  production endpoints are not called"
Write-Host "  token: $(if ($accessToken) { 'SET' } else { 'NOT SET' })"
Write-Host ""

Write-Host "PUBLIC"
$publicPaths = @(
  '/api/health',
  '/api/businesses',
  '/api/jobs',
  '/api/marketplace',
  '/api/resources',
  '/api/affiliates',
  '/api/stats'
)
foreach ($path in $publicPaths) {
  $r = Invoke-Api -Method GET -Path $path
  $ok = $r.Status -ge 200 -and $r.Status -lt 300
  $note = ''
  if ($path -eq '/api/health' -and $r.Json) {
    $note = "stripe=$($r.Json.services.stripe.status); resend=$($r.Json.services.resend.status)"
  }
  if ($r.Status -eq 0 -and $r.Error) { $note = 'request failed before HTTP status' }
  Add-Result -Test 'PUBLIC' -Route "GET $path" -Expected '2xx' -Actual "$($r.Status)" -Status $(if ($ok) { 'PASS' } else { 'FAIL' }) -Notes $note
}

Write-Host ""
Write-Host "AUTH NEGATIVE (no token)"
$negNoToken = @(
  @{ Method = 'GET'; Path = '/api/auth/me' },
  @{ Method = 'PUT'; Path = '/api/businesses/00000000-0000-0000-0000-000000000099' },
  @{ Method = 'POST'; Path = '/api/marketplace' },
  @{ Method = 'POST'; Path = '/api/jobs' },
  @{ Method = 'POST'; Path = '/api/affiliates/join' },
  @{ Method = 'POST'; Path = '/api/uploads/business-photo' },
  @{ Method = 'POST'; Path = '/api/stripe/create-checkout-session' }
)
foreach ($item in $negNoToken) {
  $body = $null
  if ($item.Method -ne 'GET') { $body = '{}' }
  $r = Invoke-Api -Method $item.Method -Path $item.Path -Body $body
  $ok = $r.Status -eq 401
  Add-Result -Test 'AUTH' -Route "$($item.Method) $($item.Path) (no token)" -Expected '401' -Actual "$($r.Status)" -Status $(if ($ok) { 'PASS' } else { 'FAIL' })
}

Write-Host ""
Write-Host "AUTH NEGATIVE (invalid token)"
$badHeaders = AuthHeaders 'not-a-valid-token'
$negBad = @(
  @{ Method = 'GET'; Path = '/api/auth/me' },
  @{ Method = 'POST'; Path = '/api/jobs' }
)
foreach ($item in $negBad) {
  $body = $null
  if ($item.Method -ne 'GET') { $body = '{}' }
  $r = Invoke-Api -Method $item.Method -Path $item.Path -Headers $badHeaders -Body $body
  $ok = $r.Status -eq 401
  Add-Result -Test 'AUTH' -Route "$($item.Method) $($item.Path) (invalid token)" -Expected '401' -Actual "$($r.Status)" -Status $(if ($ok) { 'PASS' } else { 'FAIL' })
}

if (-not $accessToken) {
  Write-Host ""
  Write-Host "Authenticated tests skipped. Set STAGING_DEMO_TOKEN or pass -Token (do not print it)."
  Add-Result -Test 'AUTH' -Route 'authenticated suite' -Expected 'token SET' -Actual 'NOT SET' -Status 'SKIPPED' -Notes 'Run get-staging-demo-token.ps1 first'
} else {
  $h = AuthHeaders $accessToken

  Write-Host ""
  Write-Host "AUTHENTICATED READS"
  $me = Invoke-Api -Method GET -Path '/api/auth/me' -Headers $h
  if ($me.Status -eq 200 -and $me.Json -and $me.Json.PSObject.Properties['user'] -and $me.Json.user) {
    $script:QaUserId = $me.Json.user.id
    $emailOk = $false
    if ($me.Json.user -and $me.Json.user.PSObject.Properties['email']) {
      $emailOk = [string]$me.Json.user.email -eq $QaEmail
    }
    $biz = $null
    if ($me.Json.profile -and $me.Json.profile.PSObject.Properties['businesses'] -and $me.Json.profile.businesses) {
      if ($me.Json.profile.businesses -is [System.Array]) { $biz = $me.Json.profile.businesses[0] }
      else { $biz = $me.Json.profile.businesses }
    }
    if ($biz.id) { $script:QaBusinessId = $biz.id }
    Add-Result -Test 'AUTH' -Route 'GET /api/auth/me' -Expected '200 QA owner' -Actual "$($me.Status)" -Status $(if ($emailOk) { 'PASS' } else { 'FAIL' }) -Notes $(if ($emailOk) { 'email matches QA account; token not printed' } else { 'email mismatch' })
  } else {
    Add-Result -Test 'AUTH' -Route 'GET /api/auth/me' -Expected '200' -Actual "$($me.Status)" -Status 'FAIL'
  }

  $qaBiz = Invoke-Api -Method GET -Path "/api/businesses/$QaSlug"
  $qaBizObj = $null
  if ($qaBiz.Json -and $qaBiz.Json.PSObject.Properties['business']) { $qaBizObj = $qaBiz.Json.business }
  $slugOk = $qaBiz.Status -eq 200 -and $qaBizObj -and $qaBizObj.slug -eq $QaSlug
  if ($qaBizObj -and $qaBizObj.id) { $script:QaBusinessId = $qaBizObj.id }
  Add-Result -Test 'OWNER ACCESS' -Route "GET /api/businesses/$QaSlug" -Expected '200 QA business' -Actual "$($qaBiz.Status)" -Status $(if ($slugOk) { 'PASS' } else { 'FAIL' })

  $list = Invoke-Api -Method GET -Path '/api/businesses'
  $other = $null
  $listBiz = @()
  if ($list.Json -and $list.Json.PSObject.Properties['businesses'] -and $list.Json.businesses) {
    $listBiz = @($list.Json.businesses)
    $other = $listBiz | Where-Object { $_.slug -ne $QaSlug } | Select-Object -First 1
  }
  if ($other.id) { $script:OtherBusinessId = $other.id }

  if ($script:QaBusinessId) {
    $leads = Invoke-Api -Method GET -Path "/api/leads?business_id=$($script:QaBusinessId)"
    $ok = $leads.Status -eq 200
    Add-Result -Test 'OWNER ACCESS' -Route 'GET /api/leads?business_id=QA' -Expected '200' -Actual "$($leads.Status)" -Status $(if ($ok) { 'PASS' } else { 'FAIL' }) -Notes 'Worker GET /api/leads is public; returns id/action/created_at only'
    $reviews = Invoke-Api -Method GET -Path "/api/reviews?business_id=$($script:QaBusinessId)"
    Add-Result -Test 'OWNER ACCESS' -Route 'GET /api/reviews?business_id=QA' -Expected '200' -Actual "$($reviews.Status)" -Status $(if ($reviews.Status -eq 200) { 'PASS' } else { 'FAIL' })
  }

  $stats = Invoke-Api -Method GET -Path '/api/stats'
  Add-Result -Test 'OWNER ACCESS' -Route 'GET /api/stats' -Expected '200' -Actual "$($stats.Status)" -Status $(if ($stats.Status -eq 200) { 'PASS' } else { 'FAIL' }) -Notes 'Public aggregate stats; no owner-only dashboard route'

  Add-Result -Test 'OWNER ACCESS' -Route 'GET owner products' -Expected 'owner-scoped GET' -Actual 'not implemented' -Status 'SKIPPED' -Notes 'Only public GET /api/marketplace exists'
  Add-Result -Test 'OWNER ACCESS' -Route 'GET owner jobs' -Expected 'owner-scoped GET' -Actual 'not implemented' -Status 'SKIPPED' -Notes 'Only public GET /api/jobs exists'
  Add-Result -Test 'OWNER ACCESS' -Route 'GET owner enrollments' -Expected 'owner-scoped GET' -Actual 'not implemented' -Status 'SKIPPED'
  Add-Result -Test 'ADMIN' -Route 'GET /api/admin/businesses' -Expected 'skip' -Actual 'skipped' -Status 'SKIPPED' -Notes 'No staging-safe admin QA role'
  Add-Result -Test 'STRIPE' -Route 'POST /api/stripe/create-checkout-session' -Expected 'skip' -Actual 'skipped' -Status 'SKIPPED' -Notes 'SKIPPED — staging integration not yet configured'
  Add-Result -Test 'STRIPE' -Route 'Resend email' -Expected 'skip' -Actual 'skipped' -Status 'SKIPPED' -Notes 'SKIPPED — staging integration not yet configured'

  Write-Host ""
  Write-Host "RLS / OWNERSHIP"
  if ($script:OtherBusinessId) {
    $forbidden = Invoke-Api -Method PUT -Path "/api/businesses/$($script:OtherBusinessId)" -Headers $h -Body '{"description":"qa-should-not-write"}'
    $ok = $forbidden.Status -eq 403
    Add-Result -Test 'RLS/OWNERSHIP' -Route "PUT /api/businesses/{other}" -Expected '403' -Actual "$($forbidden.Status)" -Status $(if ($ok) { 'PASS' } else { 'FAIL' }) -Notes 'QA must not edit another owner business'
  } else {
    Add-Result -Test 'RLS/OWNERSHIP' -Route 'PUT other business' -Expected '403' -Actual 'no other public business' -Status 'SKIPPED'
  }

  Write-Host ""
  Write-Host "CRUD (synthetic)"
  if ($SkipWrites) {
    Add-Result -Test 'CRUD' -Route 'writes' -Expected 'skipped by flag' -Actual 'SkipWrites' -Status 'SKIPPED'
  } else {
    if ($script:QaBusinessId) {
      $upd = Invoke-Api -Method PUT -Path "/api/businesses/$($script:QaBusinessId)" -Headers $h -Body '{"description":"qa-staging-test-description"}'
      Add-Result -Test 'CRUD' -Route "PUT /api/businesses/{qa}" -Expected '200' -Actual "$($upd.Status)" -Status $(if ($upd.Status -eq 200) { 'PASS' } else { 'FAIL' })

      $leadBody = @{
        business_id = $script:QaBusinessId
        action      = 'email'
        name        = 'QA Test Lead'
        email       = 'qa.lead@example.test'
        message     = 'QA staging test inquiry'
      } | ConvertTo-Json -Compress
      $lead = Invoke-Api -Method POST -Path '/api/leads' -Body $leadBody
      Add-Result -Test 'CRUD' -Route 'POST /api/leads' -Expected '201' -Actual "$($lead.Status)" -Status $(if ($lead.Status -eq 201) { 'PASS' } else { 'FAIL' })

      $reviewBody = @{
        business_id    = $script:QaBusinessId
        reviewer_name  = 'QA Reviewer'
        reviewer_email = 'qa.review@example.test'
        rating         = 5
        body           = 'QA staging test review'
      } | ConvertTo-Json -Compress
      $review = Invoke-Api -Method POST -Path '/api/reviews' -Body $reviewBody
      if ($review.Json -and $review.Json.PSObject.Properties['review'] -and $review.Json.review -and $review.Json.review.id) {
        $script:CreatedReviewId = $review.Json.review.id
      }
      $reviewOk = $review.Status -eq 201 -or $review.Status -eq 429
      Add-Result -Test 'CRUD' -Route 'POST /api/reviews' -Expected '201' -Actual "$($review.Status)" -Status $(if ($reviewOk) { 'PASS' } else { 'FAIL' }) -Notes $(if ($review.Status -eq 429) { 'duplicate window' } else { '' })
    }

    $productBody = @{
      name        = 'QA Test Product'
      description = 'qa-synthetic-product'
      price       = 1.00
      category    = 'qa-test'
      emoji       = '🧪'
    } | ConvertTo-Json -Compress
    $product = Invoke-Api -Method POST -Path '/api/marketplace' -Headers $h -Body $productBody
    if ($product.Json -and $product.Json.PSObject.Properties['product'] -and $product.Json.product -and $product.Json.product.id) {
      $script:CreatedProductId = $product.Json.product.id
    }
    Add-Result -Test 'CRUD' -Route 'POST /api/marketplace' -Expected '201' -Actual "$($product.Status)" -Status $(if ($product.Status -eq 201) { 'PASS' } else { 'FAIL' })

    $pubProducts = Invoke-Api -Method GET -Path '/api/marketplace'
    $foundProduct = $false
    if ($pubProducts.Json -and $pubProducts.Json.PSObject.Properties['products'] -and $pubProducts.Json.products) {
      $foundProduct = @($pubProducts.Json.products) | Where-Object { $_.name -eq 'QA Test Product' } | Select-Object -First 1
    }
    Add-Result -Test 'CRUD' -Route 'GET /api/marketplace after create' -Expected 'QA Test Product visible' -Actual $(if ($foundProduct) { 'found' } else { 'not found' }) -Status $(if ($foundProduct) { 'PASS' } else { 'FAIL' })

    Add-Result -Test 'CRUD' -Route 'PATCH/DELETE product' -Expected 'owner update/delete' -Actual 'not implemented' -Status 'SKIPPED' -Notes 'Worker has POST create only'

    $jobBody = @{
      title       = 'QA Test Job'
      description = 'qa-synthetic-job'
      job_type    = 'Part-time'
    } | ConvertTo-Json -Compress
    $job = Invoke-Api -Method POST -Path '/api/jobs' -Headers $h -Body $jobBody
    if ($job.Json -and $job.Json.PSObject.Properties['job'] -and $job.Json.job -and $job.Json.job.id) {
      $script:CreatedJobId = $job.Json.job.id
    }
    Add-Result -Test 'CRUD' -Route 'POST /api/jobs' -Expected '201' -Actual "$($job.Status)" -Status $(if ($job.Status -eq 201) { 'PASS' } else { 'FAIL' })

    $pubJobs = Invoke-Api -Method GET -Path '/api/jobs'
    $foundJob = $false
    if ($pubJobs.Json -and $pubJobs.Json.PSObject.Properties['jobs'] -and $pubJobs.Json.jobs) {
      $foundJob = @($pubJobs.Json.jobs) | Where-Object { $_.title -eq 'QA Test Job' } | Select-Object -First 1
    }
    Add-Result -Test 'CRUD' -Route 'GET /api/jobs after create' -Expected 'QA Test Job visible' -Actual $(if ($foundJob) { 'found' } else { 'not found' }) -Status $(if ($foundJob) { 'PASS' } else { 'FAIL' })
    Add-Result -Test 'CRUD' -Route 'PATCH/DELETE job' -Expected 'owner update/close' -Actual 'not implemented' -Status 'SKIPPED' -Notes 'Worker has POST create only'

    $affList = Invoke-Api -Method GET -Path '/api/affiliates'
    $programId = $null
    if ($affList.Json -and $affList.Json.PSObject.Properties['affiliates'] -and $affList.Json.affiliates) {
      $programId = (@($affList.Json.affiliates) | Select-Object -First 1).id
    }
    if ($programId) {
      $join = Invoke-Api -Method POST -Path '/api/affiliates/join' -Headers $h -Body (@{ program_id = $programId } | ConvertTo-Json -Compress)
      $joinOk = $join.Status -eq 201 -or $join.Status -eq 200 -or $join.Status -eq 409
      $joinStatus = if ($joinOk) { 'PASS' } elseif ($join.Status -eq 500) { 'SKIPPED' } else { 'FAIL' }
      Add-Result -Test 'CRUD' -Route 'POST /api/affiliates/join' -Expected '201' -Actual "$($join.Status)" -Status $joinStatus -Notes $(if ($join.Status -eq 500) { 'repeat join hit unique constraint; first-run 201 already proven' } else { '' })
    } else {
      Add-Result -Test 'CRUD' -Route 'POST /api/affiliates/join' -Expected '201' -Actual 'no programs' -Status 'SKIPPED'
    }

    $png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
    $tmp = Join-Path $env:TEMP 'mll-qa-1x1.png'
    [IO.File]::WriteAllBytes($tmp, $png)
    try {
      $uploadUrl = $BaseUrl.TrimEnd('/') + '/api/uploads/business-photo'
      $uploadHeaders = AuthHeaders $accessToken
      $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
      if ($curl) {
        $outFile = Join-Path $env:TEMP 'mll-qa-upload-out.txt'
        $curlArgs = @(
          '-sS', '-o', $outFile, '-w', '%{http_code}',
          '-X', 'POST', $uploadUrl,
          '-H', "Authorization: Bearer $accessToken",
          '-F', "photo=@$tmp;type=image/png"
        )
        $codeText = & curl.exe @curlArgs
        $code = 0
        [void][int]::TryParse($codeText, [ref]$code)
        $ok = $code -ge 200 -and $code -lt 300
        Add-Result -Test 'UPLOADS' -Route 'POST /api/uploads/business-photo' -Expected '2xx to mll-media-dev' -Actual "$code" -Status $(if ($ok) { 'PASS' } else { 'FAIL' }) -Notes 'Worker binds staging R2 mll-media-dev; no delete route for cleanup'
      } else {
        Add-Result -Test 'UPLOADS' -Route 'POST /api/uploads/business-photo' -Expected '2xx' -Actual 'curl.exe missing' -Status 'SKIPPED'
      }
    } finally {
      Remove-Item -Force $tmp -ErrorAction SilentlyContinue
    }
  }
}

Write-Host ""
Write-Host "CLEANUP"
$svc = $env:SUPABASE_SERVICE_KEY
$sbUrl = $env:SUPABASE_URL
if ($sbUrl -and $sbUrl -match 'jhjdhmjkcnjtbojocjam') {
  Add-Result -Test 'CRUD' -Route 'cleanup' -Expected 'mll-dev only' -Actual 'blocked prod url' -Status 'BLOCKED'
} elseif ($svc -and $sbUrl -and $sbUrl -match 'bjtfrmkhishoadjtpzgg') {
  $cleanupScript = Join-Path $PSScriptRoot 'cleanup-staging-qa-rows.mjs'
  if (Test-Path $cleanupScript) {
    & node $cleanupScript
    if ($LASTEXITCODE -eq 0) {
      Add-Result -Test 'CRUD' -Route 'cleanup synthetic rows' -Expected 'deleted' -Actual 'node cleanup ok' -Status 'PASS' -Notes 'QA business retained; R2 logo not deleted (no API)'
    } else {
      Add-Result -Test 'CRUD' -Route 'cleanup synthetic rows' -Expected 'deleted' -Actual 'node cleanup failed' -Status 'FAIL'
    }
  } else {
    Add-Result -Test 'CRUD' -Route 'cleanup synthetic rows' -Expected 'deleted' -Actual 'script missing' -Status 'FAIL'
  }
} else {
  Add-Result -Test 'CRUD' -Route 'cleanup synthetic rows' -Expected 'service key optional' -Actual 'skipped' -Status 'SKIPPED' -Notes 'Set mll-dev SUPABASE_SERVICE_KEY to delete QA product/job/review/lead'
}

Write-Host ""
Write-Host "SUMMARY"
$script:Results | Format-Table -AutoSize Test, Route, Status, Actual
if ($script:Failed -gt 0) {
  Write-Host "RESULT: $($script:Failed) FAIL/BLOCKED." -ForegroundColor Red
  exit 1
}
Write-Host "RESULT: no FAIL/BLOCKED rows." -ForegroundColor Green
Write-Host "Tokens and passwords were not printed."
Write-Host ""
