[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$extensionOutput = Join-Path $root 'apps/extension/.output/chrome-mv3'
$apiOutput = Join-Path $root 'apps/api/dist'
$artifactRoot = Join-Path $root 'artifacts/translation-extension-local-rc'

if (-not (Get-Command 'pnpm.cmd' -ErrorAction SilentlyContinue)) {
  throw "Required command 'pnpm.cmd' was not found. Install pnpm 11.7.x first."
}

Write-Host 'Running the full local verification gate...'
& pnpm.cmd run verify
if ($LASTEXITCODE -ne 0) { throw 'Verification failed; no release-candidate artifact was created.' }

if (-not (Test-Path -LiteralPath $extensionOutput)) { throw 'Production extension output was not created.' }
if (-not (Test-Path -LiteralPath $apiOutput)) { throw 'Production API output was not created.' }

if (Test-Path -LiteralPath $artifactRoot) {
  Remove-Item -LiteralPath $artifactRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
Copy-Item -LiteralPath $extensionOutput -Destination (Join-Path $artifactRoot 'extension') -Recurse
Copy-Item -LiteralPath $apiOutput -Destination (Join-Path $artifactRoot 'backend') -Recurse

$manifestPath = Join-Path $artifactRoot 'extension/manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$allPermissions = @($manifest.permissions) + @($manifest.host_permissions)
if ($allPermissions -contains '<all_urls>') {
  throw 'Release-candidate manifest unexpectedly contains <all_urls>.'
}

$commit = (& git -C $root rev-parse HEAD).Trim()
$version = [ordered]@{
  product = 'Lingo Page'
  version = $manifest.version
  mode = 'local-release-candidate'
  providerDefault = 'mock'
  commit = $commit
  builtAtUtc = [DateTime]::UtcNow.ToString('o')
  extensionFolder = 'extension'
  backendFolder = 'backend'
  recreate = 'pnpm build:release-candidate'
}
$version | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactRoot 'version.json')

$hashes = Get-ChildItem -LiteralPath $artifactRoot -File -Recurse |
  Where-Object { $_.Name -ne 'checksums.sha256' } |
  ForEach-Object {
    $relative = $_.FullName.Substring($artifactRoot.Length + 1).Replace('\', '/')
    "$(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256 | Select-Object -ExpandProperty Hash)  $relative"
  }
$hashes | Set-Content -LiteralPath (Join-Path $artifactRoot 'checksums.sha256')

Write-Host ''
Write-Host 'Local release candidate created.'
Write-Host "Extension folder: $($artifactRoot)\extension"
Write-Host "Backend folder:   $($artifactRoot)\backend"
Write-Host "Metadata:         $($artifactRoot)\version.json"
Write-Host "Checksums:        $($artifactRoot)\checksums.sha256"
