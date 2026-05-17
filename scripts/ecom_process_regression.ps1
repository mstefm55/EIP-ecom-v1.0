param(
  [string]$ApiBase = "http://localhost:4000",
  [string]$AdminOrigin = "http://localhost:5173",
  [string]$ShopOrigin = "http://localhost:5174",
  [string]$Suffix = "samara",
  [string]$EcomAdminPrefix = "/api/eip/ecom",
  [string]$ApiKey = "",
  [string]$ApiKeyHeader = "plug-play",
  [string]$EventIdHeader = "X-Event-Id",
  [string]$Sid = "",
  [string]$Csrf = "",
  [switch]$AutoAdminSession = $false,
  [string]$AdminLogin = "mstefm55@gmail.com",
  [string]$AdminTenantCode = "eip_ecom",
  [string]$DbUrl = "",
  [string]$CsrfPepper = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-EventId([string]$Prefix) {
  $ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  return "$Prefix-$ms-$([guid]::NewGuid())"
}

function SqlEscape([string]$Value) {
  if ($null -eq $Value) { return "" }
  return $Value.Replace("'", "''")
}

function Read-EnvVarFromFile {
  param(
    [string]$FilePath,
    [string]$Name
  )
  if (-not (Test-Path $FilePath)) { return "" }
  $line = Get-Content $FilePath | Where-Object { $_ -match "^\s*$Name=" } | Select-Object -First 1
  if (-not $line) { return "" }
  $value = ($line -split "=", 2)[1]
  if ($null -eq $value) { return "" }
  return [string]$value.Trim().Trim('"').Trim("'")
}

function Read-EnvVar {
  param([string]$Name)
  $fromRoot = Read-EnvVarFromFile -FilePath ".env" -Name $Name
  if ($fromRoot) { return $fromRoot }
  $fromApi = Read-EnvVarFromFile -FilePath "services/api/.env" -Name $Name
  if ($fromApi) { return $fromApi }
  return ""
}

function Build-DbUrlFromConfig {
  param(
    [string]$DbHost,
    [string]$Port,
    [string]$User,
    [string]$Password,
    [string]$Database
  )
  if (-not $DbHost -or -not $User -or -not $Database) {
    return ""
  }
  $portValue = if ($Port) { $Port } else { "5432" }
  $userEnc = [uri]::EscapeDataString($User)
  $passEnc = [uri]::EscapeDataString($Password)
  $dbEnc = [uri]::EscapeDataString($Database)
  return "postgresql://$userEnc`:$passEnc@$DbHost`:$portValue/$dbEnc"
}

function Get-Sha256Hex([string]$Input) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Input)
    $hash = $sha.ComputeHash($bytes)
    return -join ($hash | ForEach-Object { $_.ToString("x2") })
  } finally {
    $sha.Dispose()
  }
}

function Invoke-DbScalar {
  param(
    [string]$DbUrl,
    [string]$Sql
  )
  $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($psqlCmd) {
    $result = & psql "$DbUrl" -Atc $Sql
    return ([string]$result).Trim()
  }

  $prevDbUrl = $env:EIP_DB_URL
  $prevDbSql = $env:EIP_DB_SQL
  try {
    $env:EIP_DB_URL = $DbUrl
    $env:EIP_DB_SQL = $Sql
    $nodeScript = @"
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.EIP_DB_URL });
  await client.connect();
  const res = await client.query(process.env.EIP_DB_SQL);
  const row = (res.rows && res.rows[0]) || null;
  if (!row) {
    process.stdout.write('');
  } else {
    const val = row[Object.keys(row)[0]];
    process.stdout.write(val == null ? '' : String(val));
  }
  await client.end();
})().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
"@
    $out = & node -e $nodeScript
    if ($null -eq $out) { return "" }
    return ([string]$out).Trim()
  } finally {
    $env:EIP_DB_URL = $prevDbUrl
    $env:EIP_DB_SQL = $prevDbSql
  }
}

function Invoke-DbNonQuery {
  param(
    [string]$DbUrl,
    [string]$Sql
  )
  $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
  if ($psqlCmd) {
    & psql "$DbUrl" -v ON_ERROR_STOP=1 -c $Sql | Out-Null
    return
  }

  $prevDbUrl = $env:EIP_DB_URL
  $prevDbSql = $env:EIP_DB_SQL
  try {
    $env:EIP_DB_URL = $DbUrl
    $env:EIP_DB_SQL = $Sql
    $nodeScript = @"
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.EIP_DB_URL });
  await client.connect();
  await client.query(process.env.EIP_DB_SQL);
  await client.end();
})().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
"@
    & node -e $nodeScript | Out-Null
    return
  } finally {
    $env:EIP_DB_URL = $prevDbUrl
    $env:EIP_DB_SQL = $prevDbSql
  }
}

function Invoke-ApiJson {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [object]$BodyObj = $null,
    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession = $null
  )

  $bodyJson = $null
  if ($null -ne $BodyObj) {
    $bodyJson = ($BodyObj | ConvertTo-Json -Depth 20 -Compress)
  }

  try {
    $invokeArgs = @{
      Method  = $Method
      Uri     = $Url
      Headers = $Headers
    }
    if ($WebSession) {
      $invokeArgs["WebSession"] = $WebSession
    }

    $resp = if ($null -eq $bodyJson) {
      Invoke-RestMethod @invokeArgs
    } else {
      $invokeArgs["Body"] = $bodyJson
      Invoke-RestMethod @invokeArgs
    }
    return @{ ok = $true; status = 200; body = $resp }
  } catch {
    $status = 0
    $raw = ""
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
      }
    }
    $parsed = $null
    if ($raw) {
      try { $parsed = $raw | ConvertFrom-Json } catch {}
    }
    return @{ ok = $false; status = $status; body = $parsed; raw = $raw }
  }
}

function Assert-Api {
  param(
    [hashtable]$Result,
    [string]$Label
  )
  if (-not $Result.ok) {
    Write-Host "[FAIL] $Label -> HTTP $($Result.status)" -ForegroundColor Red
    if ($Result.body) {
      ($Result.body | ConvertTo-Json -Depth 10) | Write-Host
    } elseif ($Result.raw) {
      $Result.raw | Write-Host
    }
    throw "Stopping on failed step: $Label"
  }
  Write-Host "[OK]   $Label" -ForegroundColor Green
}

if (-not $ApiKey) {
  if ($env:VITE_EIP_PUBLIC_API_KEY) {
    $ApiKey = $env:VITE_EIP_PUBLIC_API_KEY
  }
}
if (-not $ApiKey) {
  throw "Missing ApiKey param (or VITE_EIP_PUBLIC_API_KEY env var)."
}

if ($AutoAdminSession -and (-not ($Sid -and $Csrf))) {
  if (-not $DbUrl) {
    if ($env:DATABASE_URL) {
      $DbUrl = $env:DATABASE_URL
    } else {
      $DbUrl = Read-EnvVar -Name "DATABASE_URL"
      if (-not $DbUrl) {
        $dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { Read-EnvVar -Name "DB_HOST" }
        $dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { Read-EnvVar -Name "DB_PORT" }
        $dbUser = if ($env:DB_USER) { $env:DB_USER } else { Read-EnvVar -Name "DB_USER" }
        $dbPass = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { Read-EnvVar -Name "DB_PASSWORD" }
        $dbName = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { Read-EnvVar -Name "DB_DATABASE" }
        $DbUrl = Build-DbUrlFromConfig -DbHost $dbHost -Port $dbPort -User $dbUser -Password $dbPass -Database $dbName
      }
    }
  }
  if (-not $DbUrl) {
    throw "Missing DB URL. Provide -DbUrl or set DATABASE_URL in env/services/api/.env."
  }

  if (-not $CsrfPepper) {
    if ($env:CSRF_PEPPER) {
      $CsrfPepper = $env:CSRF_PEPPER
    } else {
      $CsrfPepper = Read-EnvVar -Name "CSRF_PEPPER"
    }
  }
  if (-not $CsrfPepper) {
    throw "Missing CSRF pepper. Provide -CsrfPepper or set CSRF_PEPPER in env/services/api/.env."
  }

  $loginEsc = SqlEscape $AdminLogin
  $tenantEsc = SqlEscape $AdminTenantCode
  $sidQuery = @"
SELECT s.id
FROM eip_auth.auth_session s
JOIN eip_auth.auth_identity i ON i.id = s.identity_id AND i.tenant_id = s.tenant_id
JOIN eip_core.tenant t ON t.id = s.tenant_id
WHERE i.login = '$loginEsc'
  AND t.code = '$tenantEsc'
  AND COALESCE(s.is_revoked, false) = false
  AND s.expires_at > now()
ORDER BY s.created_at DESC
LIMIT 1;
"@
  $sidFromDb = Invoke-DbScalar -DbUrl $DbUrl -Sql $sidQuery
  $sidFromDb = [string]$sidFromDb
  $sidFromDb = $sidFromDb.Trim()
  if (-not $sidFromDb) {
    $sidFallbackQuery = @"
SELECT s.id
FROM eip_auth.auth_session s
JOIN eip_auth.auth_identity i ON i.id = s.identity_id AND i.tenant_id = s.tenant_id
WHERE i.login = '$loginEsc'
  AND COALESCE(s.is_revoked, false) = false
  AND s.expires_at > now()
ORDER BY s.created_at DESC
LIMIT 1;
"@
    $sidFromDb = Invoke-DbScalar -DbUrl $DbUrl -Sql $sidFallbackQuery
    $sidFromDb = [string]$sidFromDb
    $sidFromDb = $sidFromDb.Trim()
  }
  if (-not $sidFromDb) {
    throw "No active admin SID found for $AdminLogin (tenant filter: $AdminTenantCode)."
  }

  $generatedCsrf = "devcsrf-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$([guid]::NewGuid().ToString('N').Substring(0,8))"
  $csrfHash = Get-Sha256Hex "$generatedCsrf`:$CsrfPepper"
  $sidEsc = SqlEscape $sidFromDb
  $hashEsc = SqlEscape $csrfHash

  $updateSql = "UPDATE eip_auth.auth_session SET csrf_secret_hash = '$hashEsc' WHERE id = '$sidEsc';"
  Invoke-DbNonQuery -DbUrl $DbUrl -Sql $updateSql

  $Sid = $sidFromDb
  $Csrf = $generatedCsrf
  Write-Host "AutoAdminSession: SID loaded and CSRF refreshed for $AdminLogin/$AdminTenantCode"
}

$publicHeaders = @{
  "Origin" = $ShopOrigin
  "Content-Type" = "application/json"
}
$publicHeaders[$ApiKeyHeader] = $ApiKey

$adminHeaders = @{
  "Origin" = $AdminOrigin
  "Content-Type" = "application/json"
}
$adminWebSession = $null
if ($Sid -and $Csrf) {
  $adminWebSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $apiUri = [System.Uri]$ApiBase
  $sidCookie = New-Object System.Net.Cookie("sid", $Sid, "/", $apiUri.Host)
  $csrfCookie = New-Object System.Net.Cookie("csrf", $Csrf, "/", $apiUri.Host)
  $adminWebSession.Cookies.Add($sidCookie)
  $adminWebSession.Cookies.Add($csrfCookie)
  $adminHeaders["x-csrf"] = $Csrf
}

Write-Host "== Public flow checks ==" -ForegroundColor Cyan

$catalog = Invoke-ApiJson -Method "GET" -Url "$ApiBase/api/public/commerce/$Suffix/catalog?limit=3" -Headers $publicHeaders
Assert-Api -Result $catalog -Label "catalog"
if (-not $catalog.body.items -or $catalog.body.items.Count -lt 1) {
  throw "Catalog returned no products; cannot continue review/order checks."
}
$first = $catalog.body.items[0]
$firstCode = [string]$first.code
Write-Host "Using product: $firstCode"

$reviewPayload = @{
  material_code = $firstCode
  rating = 5
  title = "Smoke review"
  comment = "Process regression smoke review."
  reviewer = @{
    name = "Smoke User"
    email = "smoke.review@example.com"
  }
  source = "ecom_process_regression"
}
$reviewRes = Invoke-ApiJson -Method "POST" -Url "$ApiBase/api/public/commerce/$Suffix/reviews" -Headers $publicHeaders -BodyObj $reviewPayload
Assert-Api -Result $reviewRes -Label "create public review"
$reviewId = [string]$reviewRes.body.item.id
Write-Host "Created review id: $reviewId"

$orderPayload = @{
  channel = "WEB"
  currency = "USD"
  external_ref = "regression-$([guid]::NewGuid())"
  buyer = @{
    agent_type = "person"
    name = "Smoke Buyer"
    email = "smoke.order@example.com"
    phone = "+15551234567"
  }
  line_items = @(
    @{ material_code = $firstCode; quantity = 1 }
  )
}
$orderHeaders = @{}
$publicHeaders.GetEnumerator() | ForEach-Object { $orderHeaders[$_.Key] = $_.Value }
$orderHeaders[$EventIdHeader] = New-EventId "order"
$orderRes = Invoke-ApiJson -Method "POST" -Url "$ApiBase/api/public/commerce/$Suffix/order" -Headers $orderHeaders -BodyObj $orderPayload
Assert-Api -Result $orderRes -Label "create order"

if (-not ($Sid -and $Csrf)) {
  Write-Host ""
  Write-Host "Admin session not provided, skipping admin-process checks." -ForegroundColor Yellow
  Write-Host "To run full checks pass -Sid and -Csrf."
  exit 0
}

Write-Host ""
Write-Host "== Admin process checks ==" -ForegroundColor Cyan

$reviewHide = Invoke-ApiJson -Method "PATCH" -Url "$ApiBase$EcomAdminPrefix/reviews/$reviewId" -Headers $adminHeaders -BodyObj @{ status = "hidden"; note = "smoke hide" } -WebSession $adminWebSession
Assert-Api -Result $reviewHide -Label "moderate review -> hidden"

$reviewReject = Invoke-ApiJson -Method "PATCH" -Url "$ApiBase$EcomAdminPrefix/reviews/$reviewId" -Headers $adminHeaders -BodyObj @{ status = "rejected"; note = "smoke reject" } -WebSession $adminWebSession
Assert-Api -Result $reviewReject -Label "moderate review -> rejected"

$reviewApprove = Invoke-ApiJson -Method "PATCH" -Url "$ApiBase$EcomAdminPrefix/reviews/$reviewId" -Headers $adminHeaders -BodyObj @{ status = "approved"; note = "smoke approve" } -WebSession $adminWebSession
Assert-Api -Result $reviewApprove -Label "moderate review -> approved"

$slot = "qa.smoke.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$contentBody = @{
  title = "QA Smoke Slot"
  is_active = $true
  slides = @(
    @{
      id = "s1"
      title = "Smoke slide"
      subtitle = "Storefront process test"
      image = [string]($first.attrs.media.main_url)
      cta_action = "navigate_internal"
      cta_target = "#shop"
      cta_label = "Shop now"
    }
  )
}
$contentUpsert = Invoke-ApiJson -Method "PUT" -Url "$ApiBase$EcomAdminPrefix/storefront/content/$slot" -Headers $adminHeaders -BodyObj $contentBody -WebSession $adminWebSession
Assert-Api -Result $contentUpsert -Label "upsert storefront content"

$actions = @("INTAKE", "DRAFT_READY", "APPROVE", "PUBLISH", "REJECT", "INTAKE")
foreach ($a in $actions) {
  $res = Invoke-ApiJson -Method "POST" -Url "$ApiBase$EcomAdminPrefix/storefront/content/$slot/actions" -Headers $adminHeaders -BodyObj @{ action = $a } -WebSession $adminWebSession
  Assert-Api -Result $res -Label "storefront action $a"
}

$finalContent = Invoke-ApiJson -Method "GET" -Url "$ApiBase$EcomAdminPrefix/storefront/content?slot=$slot" -Headers $adminHeaders -WebSession $adminWebSession
Assert-Api -Result $finalContent -Label "fetch storefront content"
Write-Host "Final slot status: $($finalContent.body.item.status)"

Write-Host ""
Write-Host "Regression script completed successfully." -ForegroundColor Green
