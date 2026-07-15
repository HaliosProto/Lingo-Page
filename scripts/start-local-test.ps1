[CmdletBinding()]
param(
  [ValidateSet('', 'mock', 'gemini', 'openai', 'anthropic', 'deepl', 'deepseek', 'kimi', 'glm', 'qwen', 'xai', 'mistral', 'minimax', 'cohere', 'custom-openai-compatible')]
  [string]$Provider = '',
  [switch]$BuildReleaseCandidate
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$apiDirectory = Join-Path $root 'apps/api'
$stateDirectory = Join-Path $root '.local'
$pidPath = Join-Path $stateDirectory 'api.pid'
$stdoutPath = Join-Path $stateDirectory 'api.stdout.log'
$stderrPath = Join-Path $stateDirectory 'api.stderr.log'
$healthUrl = 'http://127.0.0.1:8787/v1/health'

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command '$name' was not found. Install it and run this command again."
  }
}

Require-Command 'pnpm.cmd'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

if (Test-Path -LiteralPath $pidPath) {
  & (Join-Path $PSScriptRoot 'stop-local-test.ps1')
}

if ($Provider -eq 'deepl') {
  $devVarsPath = Join-Path $apiDirectory '.dev.vars'
  if (-not (Test-Path -LiteralPath $devVarsPath)) {
    throw "DeepL mode needs apps/api/.dev.vars. Copy apps/api/.dev.vars.example there and add the key locally; it will not be printed or bundled."
  }
  $hasKey = Get-Content -LiteralPath $devVarsPath | Where-Object {
    $_ -match '^DEEPL_API_KEY\s*=\s*(\S.*)$'
  }
  if (-not $hasKey) {
    throw 'DeepL mode needs a non-empty DEEPL_API_KEY in apps/api/.dev.vars. The key was not displayed.'
  }
}

if ($BuildReleaseCandidate) {
  Write-Host 'Building the local release candidate (verification and production artifacts)...'
  & pnpm.cmd run build:release-candidate
  if ($LASTEXITCODE -ne 0) { throw 'Release-candidate build failed.' }
}

Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
$arguments = @(
  'exec', 'wrangler', 'dev', '--config', 'wrangler.toml', '--local',
  '--ip', '127.0.0.1', '--port', '8787',
  '--var', 'TRANSLATION_ENABLED:true'
)
if ($Provider) {
  $arguments += @('--var', "TRANSLATION_DEFAULT_PROVIDER:$Provider")
}

$mode = if ($Provider) { $Provider } else { 'configured providers' }
Write-Host "Starting the local backend in $mode mode on http://127.0.0.1:8787 ..."
$process = Start-Process -FilePath (Get-Command 'pnpm.cmd').Source `
  -ArgumentList $arguments `
  -WorkingDirectory $apiDirectory `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -WindowStyle Hidden `
  -PassThru
$process.Id | Set-Content -LiteralPath $pidPath -NoNewline

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
  Start-Sleep -Milliseconds 500
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
    if ($health.service -eq 'translation-api') {
      $ready = $true
      break
    }
  } catch {
    if ($process.HasExited) { break }
  }
}

if (-not $ready) {
  Write-Host 'The local backend did not become ready.'
  Write-Host "See $stdoutPath and $stderrPath for local diagnostics."
  & (Join-Path $PSScriptRoot 'stop-local-test.ps1')
  exit 1
}

$extensionPath = if ($BuildReleaseCandidate) {
  Join-Path $root 'artifacts/translation-extension-local-rc/extension'
} else {
  Join-Path $root 'apps/extension/.output/chrome-mv3'
}

Write-Host ''
Write-Host 'Local backend is ready.'
Write-Host 'Backend URL: http://127.0.0.1:8787'
Write-Host "Health URL:  $healthUrl"
Write-Host "Extension folder: $extensionPath"
Write-Host "Provider mode: $mode"
Write-Host "Backend logs: $stdoutPath"
Write-Host 'Run pnpm local:stop when your testing session is complete.'
