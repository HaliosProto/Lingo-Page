[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $root '.local'
$pidPath = Join-Path $stateDirectory 'api.pid'

if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Host 'No local backend process is recorded.'
  exit 0
}

$pidValue = [int](Get-Content -LiteralPath $pidPath -Raw).Trim()
$processIds = New-Object System.Collections.Generic.List[int]
$processIds.Add($pidValue)

function Add-ChildProcessIds([int]$parentId) {
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$parentId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    if (-not $processIds.Contains([int]$child.ProcessId)) {
      $processIds.Add([int]$child.ProcessId)
      Add-ChildProcessIds -parentId ([int]$child.ProcessId)
    }
  }
}

Add-ChildProcessIds -parentId $pidValue
foreach ($processId in ($processIds | Sort-Object -Descending)) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Write-Host 'Local backend stopped.'
