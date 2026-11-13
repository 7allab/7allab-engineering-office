$ErrorActionPreference = 'Stop'
$tool = Join-Path $PSScriptRoot 'managed-hooks.ps1'
$tmp = [IO.Path]::GetFullPath($env:TEMP)
$root = Join-Path $tmp ('k205c-managed-hooks-test-' + [Guid]::NewGuid().ToString('N'))
$source = Join-Path $root 'source'
$target = Join-Path $root 'target'
$state = Join-Path $root 'state'
$pass = 0
$fail = 0

function Assert-True([string]$Name, [bool]$Condition) {
  if ($Condition) { $script:pass++; Write-Output "PASS  $Name" }
  else { $script:fail++; Write-Output "FAIL  $Name" }
}

try {
  New-Item -ItemType Directory -Path $source,$target -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $source 'managed-settings.json') -Value '{"hooks":{}}' -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $source 'guard.mjs') -Value 'process.exit(2);' -Encoding UTF8
  $manifest = [ordered]@{
    schema = '7allab-k205c-host-install/0.1'
    files = @(
      [ordered]@{ source='managed-settings.json'; target='managed-settings.json'; sha256=(Get-FileHash (Join-Path $source 'managed-settings.json') -Algorithm SHA256).Hash },
      [ordered]@{ source='guard.mjs'; target='security/guard.mjs'; sha256=(Get-FileHash (Join-Path $source 'guard.mjs') -Algorithm SHA256).Hash }
    )
  }
  $manifestPath = Join-Path $source 'install-manifest.json'
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

  & $tool -Action Install -SourceRoot $source -ManifestPath $manifestPath -TargetRoot $target -StateRoot $state -TestMode -TestRoot $root | Out-Null
  Assert-True 'install creates managed settings' (Test-Path -LiteralPath (Join-Path $target 'ClaudeCode\managed-settings.json'))
  Assert-True 'install creates security file' (Test-Path -LiteralPath (Join-Path $target '7allab-security\guard.mjs'))

  $secondInstallRejected = $false
  try { & $tool -Action Install -SourceRoot $source -ManifestPath $manifestPath -TargetRoot $target -StateRoot $state -TestMode -TestRoot $root | Out-Null } catch { $secondInstallRejected = $_.Exception.Message -match 'CLEAN_BASELINE_REQUIRED' }
  Assert-True 'unknown/existing target is rejected' $secondInstallRejected

  $statePath = Join-Path $state 'install-state.json'
  $originalState = Get-Content -LiteralPath $statePath -Raw
  $tamperedState = $originalState | ConvertFrom-Json
  $tamperedState.files[0].target = Join-Path $source 'managed-settings.json'
  $tamperedState | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8
  $stateTargetRejected = $false
  try { & $tool -Action RestoreGood -TargetRoot $target -StateRoot $state -TestMode -TestRoot $root | Out-Null } catch { $stateTargetRejected = $_.Exception.Message -match 'INSTALL_STATE_TARGET_NOT_ALLOWED' }
  Assert-True 'RestoreGood rejects a state target outside canonical target directories' ($stateTargetRejected -and (Test-Path -LiteralPath (Join-Path $source 'managed-settings.json')))
  Set-Content -LiteralPath $statePath -Value $originalState -Encoding UTF8

  $guardTarget = Join-Path $target '7allab-security\guard.mjs'
  Add-Content -LiteralPath $guardTarget -Value '// tampered'
  $tamperedRestoreRejected = $false
  try { & $tool -Action RestoreGood -TargetRoot $target -StateRoot $state -TestMode -TestRoot $root | Out-Null } catch { $tamperedRestoreRejected = $_.Exception.Message -match 'RESTORE_REFUSED_CHANGED_TARGET' }
  Assert-True 'RestoreGood refuses a changed target' $tamperedRestoreRejected

  Copy-Item -LiteralPath (Join-Path $source 'guard.mjs') -Destination $guardTarget -Force
  & $tool -Action RestoreGood -TargetRoot $target -StateRoot $state -TestMode -TestRoot $root | Out-Null
  Assert-True 'RestoreGood removes only manifest-bound files' (-not (Test-Path -LiteralPath $guardTarget))
  & $tool -Action VerifyAbsent -TargetRoot $target -StateRoot $state -TestMode -TestRoot $root | Out-Null
  Assert-True 'absence verification passes after RestoreGood' $true
} finally {
  $resolved = [IO.Path]::GetFullPath($root)
  $prefix = $tmp.TrimEnd('\') + '\'
  if ($resolved.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'k205c-managed-hooks-test-*') {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction SilentlyContinue
  } else {
    throw 'CLEANUP_CONTAINMENT_FAILED'
  }
}

Write-Output "$pass PASS, $fail FAIL"
if ($fail) { exit 1 }
