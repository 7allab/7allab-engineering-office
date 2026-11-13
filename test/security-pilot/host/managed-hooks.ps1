param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Install','RestoreGood','VerifyAbsent')]
  [string]$Action,
  [string]$SourceRoot,
  [string]$ManifestPath,
  [string]$TargetRoot = 'C:\Program Files',
  [string]$StateRoot = 'C:\ProgramData\7allab-k205c',
  [switch]$TestMode,
  [string]$TestRoot
)

$ErrorActionPreference = 'Stop'
$managedDir = Join-Path $TargetRoot 'ClaudeCode'
$securityDir = Join-Path $TargetRoot '7allab-security'
$statePath = Join-Path $StateRoot 'install-state.json'

function Get-FullPath([string]$Path) { [IO.Path]::GetFullPath($Path) }
function Test-Contained([string]$Path, [string]$Root) {
  $full = Get-FullPath $Path
  $base = (Get-FullPath $Root).TrimEnd('\') + '\'
  $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-NoReparseAncestor([string]$Path) {
  $full = Get-FullPath $Path
  $probe = [IO.Path]::GetPathRoot($full)
  foreach ($part in ($full.Substring($probe.Length) -split '\\')) {
    if (-not $part) { continue }
    $probe = Join-Path $probe $part
    if ((Test-Path -LiteralPath $probe) -and ((Get-Item -LiteralPath $probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw "REPARSE_POINT_REFUSED: $probe"
    }
  }
}

function Assert-Context {
  if ($TestMode) {
    if (-not $TestRoot) { throw 'TEST_ROOT_REQUIRED' }
    foreach ($path in @($TargetRoot,$StateRoot)) {
      if (-not (Test-Contained $path $TestRoot)) { throw 'TEST_PATH_OUTSIDE_TEST_ROOT' }
    }
    return
  }
  if ($env:OS -ne 'Windows_NT') { throw 'WINDOWS_REQUIRED' }
  if ((Get-FullPath $TargetRoot) -cne (Get-FullPath 'C:\Program Files')) { throw 'TARGET_ROOT_NOT_CANONICAL' }
  if ((Get-FullPath $StateRoot) -cne (Get-FullPath 'C:\ProgramData\7allab-k205c')) { throw 'STATE_ROOT_NOT_CANONICAL' }
  if ($Action -ne 'VerifyAbsent') {
    $admin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'ADMIN_REQUIRED' }
  }
}

function Resolve-Target([string]$Name) {
  if ($Name -eq 'managed-settings.json') { return Join-Path $managedDir $Name }
  if ($Name -match '^security/([A-Za-z0-9][A-Za-z0-9._-]*)$') { return Join-Path $securityDir $Matches[1] }
  throw "TARGET_NOT_ALLOWED: $Name"
}

function Assert-AllowedStateTarget([string]$Target) {
  $full = Get-FullPath $Target
  $managedSettings = Get-FullPath (Join-Path $managedDir 'managed-settings.json')
  if ($full -ceq $managedSettings) { return }
  if ((Split-Path -Parent $full) -ceq (Get-FullPath $securityDir) -and
      (Split-Path -Leaf $full) -match '^[A-Za-z0-9][A-Za-z0-9._-]*$') { return }
  throw "INSTALL_STATE_TARGET_NOT_ALLOWED: $Target"
}

function Read-InstallPlan {
  if (-not $SourceRoot -or -not $ManifestPath) { throw 'SOURCE_AND_MANIFEST_REQUIRED' }
  $sourceRootFull = Get-FullPath $SourceRoot
  $manifestFull = Get-FullPath $ManifestPath
  Assert-NoReparseAncestor $sourceRootFull
  Assert-NoReparseAncestor $manifestFull
  if (-not (Test-Contained $manifestFull $sourceRootFull)) { throw 'MANIFEST_OUTSIDE_SOURCE_ROOT' }
  $manifest = Get-Content -LiteralPath $manifestFull -Raw | ConvertFrom-Json
  if ($manifest.schema -cne '7allab-k205c-host-install/0.1') { throw 'MANIFEST_SCHEMA_INVALID' }
  $files = @($manifest.files)
  if ($files.Count -eq 0) { throw 'MANIFEST_EMPTY' }
  if (@($files | Where-Object { $_.target -ceq 'managed-settings.json' }).Count -ne 1) { throw 'MANAGED_SETTINGS_TARGET_REQUIRED_ONCE' }
  if (@($files | Where-Object { $_.target -is [string] -and $_.target.StartsWith('security/', [StringComparison]::Ordinal) }).Count -eq 0) { throw 'SECURITY_TARGET_REQUIRED' }
  $seen = @{}
  $plan = foreach ($entry in $files) {
    if ($entry.source -isnot [string] -or $entry.source -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$' -or $entry.source -match '(^|/)\.\.(/|$)') { throw 'SOURCE_PATH_INVALID' }
    if ($entry.sha256 -isnot [string] -or $entry.sha256 -notmatch '^[A-Fa-f0-9]{64}$') { throw 'SOURCE_HASH_INVALID' }
    $source = Get-FullPath (Join-Path $sourceRootFull ($entry.source -replace '/', '\'))
    if (-not (Test-Contained $source $sourceRootFull) -or -not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'SOURCE_FILE_INVALID' }
    Assert-NoReparseAncestor $source
    $target = Resolve-Target ([string]$entry.target)
    $key = (Get-FullPath $target).ToLowerInvariant()
    if ($seen[$key]) { throw 'TARGET_COLLISION' }
    $seen[$key] = $true
    $actual = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    if ($actual -cne ([string]$entry.sha256).ToUpperInvariant()) { throw 'SOURCE_HASH_MISMATCH' }
    [pscustomobject]@{ source=$source; target=(Get-FullPath $target); sha256=$actual }
  }
  $plan
}

function Set-ProtectedAcl([string]$Path) {
  if ($TestMode) { return 'TEST_MODE_NOT_APPLIED' }
  & icacls.exe $Path '/inheritance:r' '/grant:r' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "ACL_APPLY_FAILED: $Path" }
  & icacls.exe $Path '/setowner' '*S-1-5-32-544' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "OWNER_APPLY_FAILED: $Path" }
  (Get-Acl -LiteralPath $Path).Sddl
}

function Assert-CleanBaseline {
  foreach ($path in @($managedDir,$securityDir,$StateRoot)) {
    if (Test-Path -LiteralPath $path) { throw "CLEAN_BASELINE_REQUIRED: $path" }
  }
}

function Undo-InstallPlan([object[]]$Files) {
  foreach ($entry in $Files) {
    Assert-AllowedStateTarget ([string]$entry.target)
    foreach ($candidate in @([string]$entry.target, ([string]$entry.target + '.new'))) {
      if ((Test-Path -LiteralPath $candidate -PathType Leaf) -and
          (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash -cne ([string]$entry.sha256).ToUpperInvariant()) {
        throw "ROLLBACK_REFUSED_CHANGED_TARGET: $candidate"
      }
    }
  }
  foreach ($entry in $Files) {
    foreach ($candidate in @([string]$entry.target, ([string]$entry.target + '.new'))) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { Remove-Item -LiteralPath $candidate -Force -ErrorAction Stop }
    }
  }
  foreach ($dir in @($securityDir,$managedDir)) {
    if ((Test-Path -LiteralPath $dir) -and -not (Get-ChildItem -LiteralPath $dir -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $dir -Force }
  }
}

function Install-ManagedHooks {
  Assert-CleanBaseline
  $plan = @(Read-InstallPlan)
  New-Item -ItemType Directory -Path $StateRoot -Force | Out-Null
  Assert-NoReparseAncestor $StateRoot
  $stateAcl = Set-ProtectedAcl $StateRoot
  $state = [ordered]@{
    schema = '7allab-k205c-host-state/0.1'
    status = 'INSTALLING'
    created_at = (Get-Date).ToUniversalTime().ToString('o')
    files = @($plan | ForEach-Object { [ordered]@{ target=$_.target; sha256=$_.sha256 } })
    created_directories = @($managedDir,$securityDir)
    acl = [ordered]@{ state=$stateAcl }
  }
  $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
  try {
    New-Item -ItemType Directory -Path $managedDir,$securityDir -Force | Out-Null
    Assert-NoReparseAncestor $managedDir
    Assert-NoReparseAncestor $securityDir
    $state.acl.managed = Set-ProtectedAcl $managedDir
    $state.acl.security = Set-ProtectedAcl $securityDir
    foreach ($entry in $plan) {
      $tmp = $entry.target + '.new'
      Copy-Item -LiteralPath $entry.source -Destination $tmp -ErrorAction Stop
      if ((Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash -cne $entry.sha256) { throw 'TARGET_HASH_MISMATCH_BEFORE_MOVE' }
      Move-Item -LiteralPath $tmp -Destination $entry.target -ErrorAction Stop
    }
    foreach ($entry in $plan) {
      if ((Get-FileHash -LiteralPath $entry.target -Algorithm SHA256).Hash -cne $entry.sha256) { throw 'TARGET_HASH_MISMATCH_AFTER_INSTALL' }
    }
    $state.status = 'INSTALLED_UNATTESTED'
    $state.completed_at = (Get-Date).ToUniversalTime().ToString('o')
    $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8
    [pscustomobject]@{ status='INSTALLED_UNATTESTED'; files=$plan.Count; state=$statePath }
  } catch {
    $installError = $_.Exception.Message
    $state.status = 'INSTALL_FAILED_CLOSED'
    $state.error = $installError
    $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8 -ErrorAction SilentlyContinue
    try {
      Undo-InstallPlan @($state.files)
      if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath -Force }
      if ((Test-Path -LiteralPath $StateRoot) -and -not (Get-ChildItem -LiteralPath $StateRoot -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $StateRoot -Force }
    } catch {
      throw "INSTALL_FAILED_AND_ROLLBACK_INCOMPLETE: $installError; $($_.Exception.Message)"
    }
    throw "INSTALL_FAILED_ROLLED_BACK: $installError"
  }
}

function Restore-Good {
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { throw 'INSTALL_STATE_MISSING' }
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if ($state.schema -cne '7allab-k205c-host-state/0.1') { throw 'INSTALL_STATE_INVALID' }
  $files = @($state.files)
  if ($files.Count -eq 0) { throw 'INSTALL_STATE_EMPTY' }
  $seen = @{}
  foreach ($entry in $files) {
    Assert-AllowedStateTarget ([string]$entry.target)
    if ($entry.sha256 -isnot [string] -or $entry.sha256 -notmatch '^[A-Fa-f0-9]{64}$') { throw 'INSTALL_STATE_HASH_INVALID' }
    $key = (Get-FullPath ([string]$entry.target)).ToLowerInvariant()
    if ($seen[$key]) { throw 'INSTALL_STATE_TARGET_COLLISION' }
    $seen[$key] = $true
    Assert-NoReparseAncestor ([string]$entry.target)
    if (-not (Test-Path -LiteralPath $entry.target -PathType Leaf)) { throw "RESTORE_TARGET_MISSING: $($entry.target)" }
    if ((Get-FileHash -LiteralPath $entry.target -Algorithm SHA256).Hash -cne ([string]$entry.sha256).ToUpperInvariant()) { throw "RESTORE_REFUSED_CHANGED_TARGET: $($entry.target)" }
  }
  foreach ($entry in $files) { Remove-Item -LiteralPath $entry.target -Force -ErrorAction Stop }
  foreach ($dir in @($securityDir,$managedDir)) {
    if ((Test-Path -LiteralPath $dir) -and -not (Get-ChildItem -LiteralPath $dir -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $dir -Force }
  }
  Remove-Item -LiteralPath $statePath -Force
  if ((Test-Path -LiteralPath $StateRoot) -and -not (Get-ChildItem -LiteralPath $StateRoot -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $StateRoot -Force }
  [pscustomobject]@{ status='RESTORED_GOOD_ABSENT'; files_removed=$files.Count }
}

function Verify-Absent {
  $present = @($managedDir,$securityDir,$StateRoot) | Where-Object { Test-Path -LiteralPath $_ }
  if ($present.Count) { throw "ABSENCE_CHECK_FAILED: $($present -join ', ')" }
  [pscustomobject]@{ status='ABSENT'; managed_dir=$managedDir; security_dir=$securityDir }
}

Assert-Context
switch ($Action) {
  'Install' { Install-ManagedHooks }
  'RestoreGood' { Restore-Good }
  'VerifyAbsent' { Verify-Absent }
}

# shortcut: only a clean-baseline pilot is supported; add signed backup manifests before allowing upgrades.
