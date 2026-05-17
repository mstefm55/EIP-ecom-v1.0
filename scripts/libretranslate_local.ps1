param(
  [ValidateSet("setup", "start", "stop", "status", "test")]
  [string]$Action = "status",
  [int]$Port = 5000,
  [string]$BindHost = "127.0.0.1",
  [string]$ApiKey = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:PYTHONWARNINGS = "ignore"

$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$LtRoot = Join-Path $RepoRoot "apps\libre translate\LibreTranslate-main"
$EnvFile = Join-Path $RepoRoot ".env"
$VenvPython = Join-Path $LtRoot ".venv\Scripts\python.exe"
$VenvLibretranslate = Join-Path $LtRoot ".venv\Scripts\libretranslate.exe"
$VenvLtManage = Join-Path $LtRoot ".venv\Scripts\ltmanage.exe"
$ApiDbPath = Join-Path $LtRoot "db\api_keys.db"
$StdoutLog = Join-Path $LtRoot "lt.stdout.log"
$StderrLog = Join-Path $LtRoot "lt.stderr.log"

function Write-Info([string]$Message) {
  Write-Host "[libretranslate] $Message"
}

function Ensure-LibreTranslateRoot {
  if (!(Test-Path $LtRoot)) {
    throw "LibreTranslate source folder not found: $LtRoot"
  }
}

function Ensure-Venv {
  if (!(Test-Path $VenvPython)) {
    Write-Info "Creating Python virtual environment..."
    Push-Location $LtRoot
    try {
      python -m venv .venv
    } finally {
      Pop-Location
    }
  }

  if (!(Test-Path $VenvLibretranslate)) {
    Push-Location $LtRoot
    try {
      Write-Info "Installing LibreTranslate package..."
      & $VenvPython -m pip install --upgrade pip
      & $VenvPython -m pip install .
    } finally {
      Pop-Location
    }
  }
}

function Ensure-ApiDb {
  $dbDir = Split-Path -Parent $ApiDbPath
  if (!(Test-Path $dbDir)) {
    New-Item -ItemType Directory -Path $dbDir | Out-Null
  }
  if (!(Test-Path $ApiDbPath)) {
    New-Item -ItemType File -Path $ApiDbPath | Out-Null
  }
}

function Ensure-LanguageModels {
  Push-Location $LtRoot
  try {
    $script = @'
import argostranslate.package
import argostranslate.translate

required_pairs = [("en", "fr"), ("en", "ru"), ("en", "ar")]
installed_pairs = set()
for language in argostranslate.translate.get_installed_languages():
    for translation in language.translations_from:
        installed_pairs.add((translation.from_lang.code, translation.to_lang.code))

missing_pairs = [pair for pair in required_pairs if pair not in installed_pairs]
if not missing_pairs:
    print("models-ready")
    raise SystemExit(0)

argostranslate.package.update_package_index()
available = argostranslate.package.get_available_packages()

for source, target in missing_pairs:
    match = next((pkg for pkg in available if pkg.from_code == source and pkg.to_code == target), None)
    if match is None:
        raise SystemExit("missing-model:%s->%s" % (source, target))
    package_path = match.download()
    argostranslate.package.install_from_path(package_path)

print("models-installed")
'@
    $tempFile = Join-Path $LtRoot ".lt_model_setup_tmp.py"
    Set-Content -Path $tempFile -Value $script -Encoding ASCII
    try {
      & $VenvPython $tempFile | Out-Null
    } finally {
      if (Test-Path $tempFile) {
        Remove-Item -Path $tempFile -Force
      }
    }
  } finally {
    Pop-Location
  }
}

function Generate-ApiKey {
  Push-Location $LtRoot
  try {
    return (& $VenvPython -c "import secrets; print(secrets.token_urlsafe(32))").Trim()
  } finally {
    Pop-Location
  }
}

function Get-ExistingApiKeys {
  Push-Location $LtRoot
  try {
    $output = & $VenvLtManage keys --api-keys-db-path "db/api_keys.db" 2>&1
    if (!$output) { return @() }
    return @($output | ForEach-Object {
      $line = "$_".Trim()
      if (!$line) { return $null }
      if ($line -like "*RequestsDependencyWarning*") { return $null }
      if ($line.StartsWith("There are no API keys")) { return $null }
      $parts = $line.Split(":")
      if ($parts.Length -lt 1) { return $null }
      return $parts[0].Trim()
    } | Where-Object { $_ })
  } finally {
    Pop-Location
  }
}

function Ensure-ApiKey([string]$RequestedApiKey) {
  $resolvedApiKey = $RequestedApiKey
  if ([string]::IsNullOrWhiteSpace($resolvedApiKey)) {
    [array]$existing = Get-ExistingApiKeys
    if ($existing.Count -gt 0) {
      $resolvedApiKey = $existing[0]
    }
  }
  if ([string]::IsNullOrWhiteSpace($resolvedApiKey)) {
    $resolvedApiKey = Generate-ApiKey
  }

  [array]$existingKeys = Get-ExistingApiKeys
  if ($existingKeys -notcontains $resolvedApiKey) {
    Push-Location $LtRoot
    try {
      & $VenvLtManage keys --api-keys-db-path "db/api_keys.db" add 1000 --key $resolvedApiKey 2>&1 | Out-Null
    } finally {
      Pop-Location
    }
  }
  return $resolvedApiKey
}

function Upsert-EnvVar([string[]]$Lines, [string]$Key, [string]$Value) {
  $prefix = "$Key="
  for ($i = 0; $i -lt $Lines.Length; $i += 1) {
    if ($Lines[$i].StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $Lines[$i] = "$Key=$Value"
      return $Lines
    }
  }
  return @($Lines + "$Key=$Value")
}

function Configure-EipEnv([string]$ResolvedApiKey) {
  if (!(Test-Path $EnvFile)) {
    throw "EIP .env file not found: $EnvFile"
  }
  $lines = Get-Content -Path $EnvFile
  $lines = Upsert-EnvVar $lines "TRANSLATION_PROVIDER_ENABLED" "true"
  $lines = Upsert-EnvVar $lines "TRANSLATION_PROVIDER_CODE" "libretranslate"
  $lines = Upsert-EnvVar $lines "TRANSLATION_PROVIDER_BASE_URL" "http://$BindHost`:$Port"
  $lines = Upsert-EnvVar $lines "TRANSLATION_PROVIDER_API_KEY" $ResolvedApiKey
  $lines = Upsert-EnvVar $lines "TRANSLATION_PROVIDER_API_REGION" ""
  $lines = Upsert-EnvVar $lines "TRANSLATION_PROVIDER_TIMEOUT_MS" "15000"
  $lines = Upsert-EnvVar $lines "TRANSLATION_SOURCE_LANG" "en"
  $lines = Upsert-EnvVar $lines "TRANSLATION_TARGET_LANGS" "fr,ru,ar"
  Set-Content -Path $EnvFile -Value $lines -Encoding ASCII
}

function Get-ListeningProcessId {
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) {
      return [int]$conn.OwningProcess
    }
  } catch {
    return $null
  }
  return $null
}

function Wait-ForHealth([int]$TimeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri "http://$BindHost`:$Port/languages" -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  return $false
}

function Start-LibreTranslate {
  $existingPid = Get-ListeningProcessId
  if ($existingPid) {
    Write-Info "Already running on ${BindHost}:$Port (PID $existingPid)."
    return
  }

  Push-Location $LtRoot
  try {
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    $args = @(
      "--host", $BindHost,
      "--port", "$Port",
      "--load-only", "en,fr,ru,ar",
      "--api-keys",
      "--under-attack",
      "--api-keys-db-path", "db/api_keys.db"
    )
    Start-Process -FilePath $VenvLibretranslate -ArgumentList $args -WindowStyle Hidden -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog | Out-Null
  } finally {
    Pop-Location
  }

  if (!(Wait-ForHealth -TimeoutSec 120)) {
    throw "LibreTranslate did not become healthy. Check logs at $StdoutLog and $StderrLog"
  }
  $procId = Get-ListeningProcessId
  Write-Info "Started on http://${BindHost}:$Port (PID $procId)."
}

function Stop-LibreTranslate {
  $procId = Get-ListeningProcessId
  if (!$procId) {
    Write-Info "No listener found on port $Port."
    return
  }
  Stop-Process -Id $procId -Force
  Write-Info "Stopped process PID $procId."
}

function Show-Status {
  $procId = Get-ListeningProcessId
  if (!$procId) {
    Write-Info "Offline (no listener on ${BindHost}:$Port)."
    return
  }
  try {
    $resp = Invoke-WebRequest -Uri "http://$BindHost`:$Port/languages" -UseBasicParsing -TimeoutSec 10
    Write-Info "Online (PID $procId) status=$($resp.StatusCode)"
    Write-Output $resp.Content
  } catch {
    Write-Info "Listener exists (PID $procId) but health check failed."
  }
}

function Invoke-Test {
  if (!(Test-Path $EnvFile)) {
    throw "EIP .env file not found."
  }
  $apiKeyLine = Get-Content -Path $EnvFile | Where-Object { $_ -like "TRANSLATION_PROVIDER_API_KEY=*" } | Select-Object -First 1
  if (!$apiKeyLine) {
    throw "TRANSLATION_PROVIDER_API_KEY not found in .env"
  }
  $apiKeyValue = ($apiKeyLine -split "=", 2)[1]
  $payload = @{
    q = @("this is a test")
    source = "en"
    target = "ru"
    format = "text"
    api_key = $apiKeyValue
  } | ConvertTo-Json -Depth 5
  $resp = Invoke-RestMethod -Uri "http://$BindHost`:$Port/translate" -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 20
  Write-Info "Test translation response:"
  $resp | ConvertTo-Json -Depth 8
}

Ensure-LibreTranslateRoot

switch ($Action) {
  "setup" {
    Ensure-Venv
    Ensure-LanguageModels
    Ensure-ApiDb
    $resolvedKey = Ensure-ApiKey -RequestedApiKey $ApiKey
    Configure-EipEnv -ResolvedApiKey $resolvedKey
    Write-Info "Setup complete."
    Write-Info "API key: $resolvedKey"
  }
  "start" {
    Start-LibreTranslate
  }
  "stop" {
    Stop-LibreTranslate
  }
  "status" {
    Show-Status
  }
  "test" {
    Invoke-Test
  }
}
