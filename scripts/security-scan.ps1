[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$extensionRoots = @(
  (Join-Path $root 'apps/extension'),
  (Join-Path $root 'artifacts/translation-extension-local-rc/extension')
) | Where-Object { Test-Path -LiteralPath $_ }

$forbiddenExtensionPatterns = @(
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPL_API_KEY',
  'DEEPSEEK_API_KEY', 'MOONSHOT_API_KEY', 'ZAI_API_KEY', 'DASHSCOPE_API_KEY',
  'XAI_API_KEY', 'MISTRAL_API_KEY', 'MINIMAX_API_KEY', 'COHERE_API_KEY',
  'CUSTOM_OPENAI_API_KEY', 'CUSTOM_OPENAI_BASE_URL', 'DeepL-Auth-Key',
  'x-goog-api-key', 'x-api-key', 'api.openai.com', 'api.anthropic.com',
  'generativelanguage.googleapis.com', 'api.deepseek.com', 'api.moonshot.ai',
  'api.z.ai', 'dashscope.aliyuncs.com', 'api.x.ai', 'api.mistral.ai',
  'api.minimax.io', 'api.cohere.com', 'api.deepl.com'
)

$textExtensions = @('.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.map', '.html', '.css', '.md')
$structuralMatches = New-Object System.Collections.Generic.List[string]
foreach ($scanRoot in $extensionRoots) {
  $files = Get-ChildItem -LiteralPath $scanRoot -File -Recurse | Where-Object {
    $textExtensions -contains $_.Extension -and
    $_.FullName -notmatch '[\\/]node_modules[\\/]'
  }
  foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    foreach ($pattern in $forbiddenExtensionPatterns) {
      if ($content.IndexOf($pattern, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        $relative = $file.FullName.Substring($root.Length + 1)
        $structuralMatches.Add("$relative ($pattern)")
      }
    }
  }
}
if ($structuralMatches.Count -gt 0) {
  throw "Extension boundary scan failed: $($structuralMatches -join ', ')"
}

$secretPath = Join-Path $root 'apps/api/.dev.vars'
$secretValues = New-Object System.Collections.Generic.List[string]
if (Test-Path -LiteralPath $secretPath) {
  foreach ($line in Get-Content -LiteralPath $secretPath) {
    if ($line -match '^\s*([A-Z0-9_]*(?:API_KEY|AUTH_TOKEN)|CUSTOM_OPENAI_BASE_URL)\s*=\s*(.+?)\s*$') {
      $value = $Matches[2].Trim().Trim('"').Trim("'")
      if ($value -and $value.Length -ge 8 -and $value -notmatch '^(https?://127\.0\.0\.1|replace-|example)') {
        $secretValues.Add($value)
      }
    }
  }
}

if ($secretValues.Count -gt 0) {
  $candidateFiles = Get-ChildItem -LiteralPath $root -File -Recurse | Where-Object {
    $_.FullName -ne $secretPath -and
    $_.FullName -notmatch '[\\/](node_modules|\.git|\.pnpm-store)[\\/]' -and
    $_.Length -le 20MB
  }
  foreach ($file in $candidateFiles) {
    try { $content = [System.IO.File]::ReadAllText($file.FullName) } catch { continue }
    foreach ($secret in $secretValues) {
      if ($content.IndexOf($secret, [System.StringComparison]::Ordinal) -ge 0) {
        throw "A configured secret value was found outside the ignored secret file: $($file.FullName.Substring($root.Length + 1))"
      }
    }
  }
  $history = (& git -C $root log -p --all 2>$null | Out-String)
  foreach ($secret in $secretValues) {
    if ($history.IndexOf($secret, [System.StringComparison]::Ordinal) -ge 0) {
      throw 'A configured secret value was found in Git history.'
    }
  }
}

Write-Host 'Security scan passed.'
Write-Host "Extension roots scanned: $($extensionRoots.Count)"
Write-Host "Configured secret values checked without display: $($secretValues.Count)"
