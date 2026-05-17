param(
  [string]$ApiBase = "http://localhost:4000",
  [string]$Origin = "http://localhost:5174",
  [string]$Suffix = $env:VITE_EIP_SUFFIX,
  [string]$ApiKey = $env:VITE_EIP_PUBLIC_API_KEY,
  [string]$ApiKeyHeader = $env:VITE_EIP_PUBLIC_API_KEY_HEADER,
  [string]$EventIdHeader = $env:VITE_EIP_EVENT_ID_HEADER,
  [string]$ConnectionCode = $env:VITE_EIP_CONNECTION_CODE,
  [string]$TemplateCode = $env:VITE_EIP_TEMPLATE_CODE,
  [string]$ManifestObjectId = $env:VITE_EIP_MANIFEST_OBJECT_ID
)

if (-not $ApiKey) { throw "Missing VITE_EIP_PUBLIC_API_KEY" }
if (-not $Suffix) { throw "Missing VITE_EIP_SUFFIX" }
if (-not $ApiKeyHeader) { $ApiKeyHeader = "X-API-Key" }
if (-not $EventIdHeader) { $EventIdHeader = "X-Event-Id" }

function New-EventId([string]$Prefix) {
  $ms = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  return "$Prefix-$ms-$([guid]::NewGuid())"
}

$gatewayHeaders = @{
  "X-API-Key" = $ApiKey
  "Origin" = $Origin
}

$commerceHeaders = @{
  "Origin" = $Origin
  "Content-Type" = "application/json"
}
$commerceHeaders[$ApiKeyHeader] = $ApiKey

Write-Host "== Gateway bootstrap =="
$bootstrapUrl = "$ApiBase/api/public/gateway/bootstrap"
$bootstrapParams = @()
if ($ConnectionCode) { $bootstrapParams += "connection_code=$ConnectionCode" }
if ($TemplateCode) { $bootstrapParams += "template_code=$TemplateCode" }
if ($bootstrapParams.Count -gt 0) {
  $bootstrapUrl = "$bootstrapUrl?$(($bootstrapParams -join '&'))"
}
$bootstrap = Invoke-RestMethod -Method Get -Uri $bootstrapUrl -Headers $gatewayHeaders
$bootstrap | ConvertTo-Json -Depth 6 | Write-Host

if ($TemplateCode) {
  Write-Host "== Gateway manifest =="
  $manifestUrl = "$ApiBase/api/public/gateway/manifest/$TemplateCode"
  if ($ManifestObjectId) { $manifestUrl = "$manifestUrl/$ManifestObjectId" }
  if ($ConnectionCode) { $manifestUrl = "$manifestUrl?connection_code=$ConnectionCode" }
  $manifest = Invoke-RestMethod -Method Get -Uri $manifestUrl -Headers $gatewayHeaders
  $manifest | ConvertTo-Json -Depth 6 | Write-Host
} else {
  Write-Host "Skipping manifest (set VITE_EIP_TEMPLATE_CODE to enable)."
}

Write-Host "== Catalog =="
$catalogUrl = "$ApiBase/api/public/commerce/$Suffix/catalog?limit=2"
$catalog = Invoke-RestMethod -Method Get -Uri $catalogUrl -Headers $commerceHeaders
$catalog | ConvertTo-Json -Depth 6 | Write-Host

$first = $null
if ($catalog -and $catalog.items -and $catalog.items.Count -gt 0) {
  $first = $catalog.items[0]
}

Write-Host "== Subscribe =="
$subscribeBody = @{
  source = "samara-web"
  form = "subscribe"
  subscriber = @{
    name = "Samara Smoke"
    email = "samara.smoke+test@example.com"
    phone = "+15551234567"
    locale = "en"
    metadata = @{ channel = "smoke" }
  }
} | ConvertTo-Json -Depth 6

$subscribeHeaders = $commerceHeaders.Clone()
$subscribeHeaders[$EventIdHeader] = New-EventId("subscribe")
$subscribeUrl = "$ApiBase/api/public/commerce/$Suffix/subscribe"
$subscribe = Invoke-RestMethod -Method Post -Uri $subscribeUrl -Headers $subscribeHeaders -Body $subscribeBody
$subscribe | ConvertTo-Json -Depth 6 | Write-Host

if (-not $first) {
  Write-Host "Skipping order: no catalog items returned."
  exit 0
}

Write-Host "== Order =="
$orderBody = @{
  channel = "WEB"
  currency = "USD"
  external_ref = "samara-smoke"
  buyer = @{
    agent_type = "person"
    name = "Samara Smoke"
    email = "samara.smoke+order@example.com"
    phone = "+15551234567"
  }
  line_items = @(
    @{ material_code = $first.code; quantity = 1 }
  )
  metadata = @{ source = "samara-web"; test = $true }
} | ConvertTo-Json -Depth 6

$orderHeaders = $commerceHeaders.Clone()
$orderHeaders[$EventIdHeader] = New-EventId("order")
$orderUrl = "$ApiBase/api/public/commerce/$Suffix/order"
$order = Invoke-RestMethod -Method Post -Uri $orderUrl -Headers $orderHeaders -Body $orderBody
$order | ConvertTo-Json -Depth 6 | Write-Host
