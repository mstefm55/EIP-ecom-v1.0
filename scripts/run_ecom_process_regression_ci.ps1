param(
  [string]$SummaryPath = "",
  [string]$LogPath = "",
  [string]$StatusPath = "",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RegressionArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-ParentDirectory {
  param([string]$PathValue)
  if (-not $PathValue) { return }
  $parent = Split-Path -Path $PathValue -Parent
  if ($parent -and -not (Test-Path $parent)) {
    New-Item -Path $parent -ItemType Directory -Force | Out-Null
  }
}

function Resolve-OutputPath {
  param(
    [string]$PathValue,
    [string]$BaseDir
  )
  if (-not $PathValue) { return "" }
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }
  return Join-Path $BaseDir $PathValue
}

function Mask-Args {
  param([string[]]$ArgsIn)
  if (-not $ArgsIn) { return @() }
  $sensitiveKeys = @(
    "-ApiKey", "-Csrf", "-Sid", "-DbUrl", "-CsrfPepper", "-AdminLogin"
  )
  $masked = New-Object System.Collections.Generic.List[string]
  $i = 0
  while ($i -lt $ArgsIn.Count) {
    $arg = [string]$ArgsIn[$i]
    $masked.Add($arg)
    if ($sensitiveKeys -contains $arg -and ($i + 1) -lt $ArgsIn.Count) {
      $masked.Add("***")
      $i += 2
      continue
    }
    if ($arg -match "^(--?[^=]+)=(.+)$") {
      $key = $matches[1]
      if ($sensitiveKeys -contains $key) {
        $masked[$masked.Count - 1] = "$key=***"
      }
    }
    $i += 1
  }
  return $masked.ToArray()
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$repoRoot = Split-Path -Path $PSScriptRoot -Parent
if (-not $SummaryPath) {
  $SummaryPath = "reports/ecom-process-regression-$timestamp.json"
}
if (-not $LogPath) {
  $LogPath = "reports/ecom-process-regression-$timestamp.log"
}
if (-not $StatusPath) {
  $StatusPath = "reports/ecom-process-regression-$timestamp.status.txt"
}

$SummaryPath = Resolve-OutputPath -PathValue $SummaryPath -BaseDir $repoRoot
$LogPath = Resolve-OutputPath -PathValue $LogPath -BaseDir $repoRoot
$StatusPath = Resolve-OutputPath -PathValue $StatusPath -BaseDir $repoRoot

Ensure-ParentDirectory -PathValue $SummaryPath
Ensure-ParentDirectory -PathValue $LogPath
Ensure-ParentDirectory -PathValue $StatusPath

$scriptPath = Join-Path $PSScriptRoot "ecom_process_regression.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Regression script not found: $scriptPath"
}

$startAt = Get-Date
$success = $true
$exitCode = 0
$outputLines = New-Object System.Collections.Generic.List[string]

Write-Host "== CI Smoke Runner =="
Write-Host "Script   : $scriptPath"
Write-Host "Summary  : $SummaryPath"
Write-Host "Log      : $LogPath"
Write-Host "Status   : $StatusPath"

try {
  $psExe = (Get-Command powershell -ErrorAction SilentlyContinue).Source
  if (-not $psExe) { throw "Unable to locate powershell executable for nested runner." }
  $runnerArgs = @("-ExecutionPolicy", "Bypass", "-File", $scriptPath) + $RegressionArgs
  & $psExe @runnerArgs 2>&1 | ForEach-Object {
    $line = $_.ToString()
    $outputLines.Add($line)
    Write-Host $line
  }
  if ($LASTEXITCODE -ne 0) {
    $success = $false
    $exitCode = [int]$LASTEXITCODE
  }
} catch {
  $success = $false
  $exitCode = 1
  $errText = $_.ToString()
  $outputLines.Add($errText)
  Write-Host $errText -ForegroundColor Red
}

$endAt = Get-Date
$durationSec = [Math]::Round((New-TimeSpan -Start $startAt -End $endAt).TotalSeconds, 3)

$summary = [ordered]@{
  ok = $success
  started_at = $startAt.ToString("o")
  ended_at = $endAt.ToString("o")
  duration_sec = $durationSec
  command = [ordered]@{
    script = $scriptPath
    args = (Mask-Args -ArgsIn $RegressionArgs)
  }
  artifacts = [ordered]@{
    summary_path = $SummaryPath
    log_path = $LogPath
    status_path = $StatusPath
  }
  stats = [ordered]@{
    output_lines = $outputLines.Count
  }
}

$outputLines | Set-Content -Path $LogPath -Encoding utf8
$summary | ConvertTo-Json -Depth 12 | Set-Content -Path $SummaryPath -Encoding utf8

$statusLine = if ($success) { "PASS" } else { "FAIL" }
@(
  "status=$statusLine"
  "started_at=$($startAt.ToString("o"))"
  "ended_at=$($endAt.ToString("o"))"
  "duration_sec=$durationSec"
  "summary_path=$SummaryPath"
  "log_path=$LogPath"
) | Set-Content -Path $StatusPath -Encoding utf8

if (-not $success) {
  Write-Host "CI smoke run failed. See $StatusPath, $SummaryPath, and $LogPath" -ForegroundColor Red
  exit $exitCode
}

Write-Host "CI smoke run passed. See $StatusPath, $SummaryPath, and $LogPath" -ForegroundColor Green
exit 0
