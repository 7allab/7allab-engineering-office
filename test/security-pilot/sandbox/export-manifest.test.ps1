# export-manifest.test.ps1 — Task 14B / bolum 2: export-manifest.ps1'in GERCEK
# davranisini dogrulayan, kalici, tekrar uretilebilir, kucuk bir test dosyasi.
#
# BU TEST DOSYASI gercek C:\export veya C:\evidence'i ASLA kullanmaz.
# Sistem temp koku altinda, bu kosuya ait BENZERSIZ bir dizin agaci olusturur,
# export-manifest.ps1'i o agac icindeki sentetik EvidenceDir/ExportRoot
# parametreleriyle cagirir, ve en sonda SADECE kendi olusturdugu kesin
# dizini - containment dogrulamasindan sonra - temizler.
#
# Kullanim:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File export-manifest.test.ps1
#
# Cikis kodu: 0 = tum testler PASS (veya SKIP), >0 = en az bir FAIL.
# check-package.mjs bu dosyanin VAR OLDUGUNU ve uretim yollarini
# (C:\export, C:\evidence) KULLANMADIGINI statik olarak dogrular
# (bkz. checkExportTestFile).

$ErrorActionPreference = "Stop"

$script:passCount = 0
$script:failCount = 0
$script:skipCount = 0
$script:lines = New-Object System.Collections.Generic.List[string]

function Write-Result {
  param([string]$Status, [string]$Name, [string]$Detail = "")
  $line = "$Status  $Name"
  if ($Detail) { $line = "$line  $Detail" }
  $script:lines.Add($line)
  Write-Output $line
  switch ($Status) {
    "PASS" { $script:passCount++ }
    "FAIL" { $script:failCount++ }
    "SKIP" { $script:skipCount++ }
  }
}

function Assert-True {
  param([string]$Name, [bool]$Condition, [string]$Detail = "")
  if ($Condition) { Write-Result "PASS" $Name $Detail } else { Write-Result "FAIL" $Name $Detail }
}

$ExportScript = Join-Path $PSScriptRoot "export-manifest.ps1"
if (-not (Test-Path -LiteralPath $ExportScript)) {
  Write-Result "FAIL" "export-manifest.ps1 bulunamadi" $ExportScript
  Write-Output ""
  Write-Output "$($script:passCount) PASS, $($script:failCount) FAIL, $($script:skipCount) SKIP"
  exit 1
}

# Sistem temp koku altinda, bu kosuya ait BENZERSIZ dizin agaci.
# Gercek C:\export veya C:\evidence ASLA kullanilmaz.
$tmpRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$RunRoot = Join-Path $tmpRoot ("export-manifest-test-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $RunRoot -Force | Out-Null

function New-Case {
  param([string]$CaseName)
  $caseDir = Join-Path $RunRoot $CaseName
  $evidence = Join-Path $caseDir "evidence"
  $exportRoot = Join-Path $caseDir "export"
  New-Item -ItemType Directory -Path $evidence -Force | Out-Null
  New-Item -ItemType Directory -Path $exportRoot -Force | Out-Null
  return [PSCustomObject]@{ Evidence = $evidence; ExportRoot = $exportRoot }
}

function Invoke-Export {
  param([string]$RunId, [string]$Evidence, [string]$ExportRoot)
  # $ErrorActionPreference="Stop" burada degil, cagrilan ALT surecin kendi
  # oturumunda gecerlidir; ancak 2>&1 ile birlesen stderr, BU surecin
  # ErrorActionPreference'i "Stop" ise ErrorRecord olarak ele alinip
  # betigi erken sonlandirabilir (beklenen FAIL-CLOSED durumlarinda stderr
  # normaldir). Bu yuzden yalniz bu cagri icin yerel olarak "Continue"ya
  # alinir.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ExportScript -RunId $RunId -EvidenceDir $Evidence -ExportRoot $ExportRoot 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEap
  }
  return [PSCustomObject]@{ ExitCode = $code; Output = ($out | Out-String) }
}

# --- Case 1: gecerli export - basarili, SHA-256 esitligi, manifest-once/marker-sonra sirasi ---
$c1 = New-Case "case1-valid"
Set-Content -LiteralPath (Join-Path $c1.Evidence "a.json") -Value '{"ok":true}'
Set-Content -LiteralPath (Join-Path $c1.Evidence "installed-policy.sha256") -Value ("A" * 64)
$sub1 = Join-Path $c1.Evidence "sub"
New-Item -ItemType Directory -Path $sub1 -Force | Out-Null
Set-Content -LiteralPath (Join-Path $sub1 "b.log") -Value "log line"
$r1 = Invoke-Export -RunId "run-valid-001" -Evidence $c1.Evidence -ExportRoot $c1.ExportRoot
Assert-True "gecerli export: exit code 0" ($r1.ExitCode -eq 0) $r1.Output
$runDir1 = Join-Path $c1.ExportRoot "run-valid-001"
$manifestPath1 = Join-Path $runDir1 "MANIFEST.sha256.json"
$completePath1 = Join-Path $runDir1 "EXPORT.COMPLETE.json"
Assert-True "gecerli export: MANIFEST.sha256.json olusturuldu" (Test-Path -LiteralPath $manifestPath1)
Assert-True "gecerli export: EXPORT.COMPLETE.json olusturuldu" (Test-Path -LiteralPath $completePath1)
if ((Test-Path -LiteralPath $manifestPath1) -and (Test-Path -LiteralPath $completePath1)) {
  $manifest1 = Get-Content -LiteralPath $manifestPath1 -Raw | ConvertFrom-Json
  $aEntry = $manifest1.files | Where-Object { $_.relative_path -eq "a.json" }
  $policyHashEntry = $manifest1.files | Where-Object { $_.relative_path -eq "installed-policy.sha256" }
  $srcHashA = (Get-FileHash -LiteralPath (Join-Path $c1.Evidence "a.json") -Algorithm SHA256).Hash
  Assert-True "gecerli export: a.json kaynak/hedef SHA-256 esitligi" ($null -ne $aEntry -and $aEntry.sha256 -eq $srcHashA)
  Assert-True "gecerli export: .sha256 kanit dosyasi allowlist'te" ($null -ne $policyHashEntry)
  Assert-True "gecerli export: manifest once, completion marker en son (mtime)" ((Get-Item -LiteralPath $manifestPath1).LastWriteTimeUtc -le (Get-Item -LiteralPath $completePath1).LastWriteTimeUtc)
} else {
  Write-Result "FAIL" "gecerli export: manifest/marker icerik kontrolleri atlandi (dosyalar yok)"
}

# --- Case 2: path traversal RunId -> tam ret ---
$c2 = New-Case "case2-traversal"
Set-Content -LiteralPath (Join-Path $c2.Evidence "a.json") -Value '{"ok":true}'
$r2 = Invoke-Export -RunId "..\escape" -Evidence $c2.Evidence -ExportRoot $c2.ExportRoot
Assert-True "path traversal RunId: exit code != 0" ($r2.ExitCode -ne 0) $r2.Output
Assert-True "path traversal RunId: hicbir export dizini olusmadi" ((Get-ChildItem -LiteralPath $c2.ExportRoot -Directory -ErrorAction SilentlyContinue).Count -eq 0)

# --- Case 3: rooted/drive-qualified RunId -> tam ret ---
$c3 = New-Case "case3-rooted"
Set-Content -LiteralPath (Join-Path $c3.Evidence "a.json") -Value '{"ok":true}'
$r3 = Invoke-Export -RunId "C:\windows" -Evidence $c3.Evidence -ExportRoot $c3.ExportRoot
Assert-True "rooted/drive RunId: exit code != 0" ($r3.ExitCode -ne 0) $r3.Output
Assert-True "rooted/drive RunId: hicbir export dizini olusmadi" ((Get-ChildItem -LiteralPath $c3.ExportRoot -Directory -ErrorAction SilentlyContinue).Count -eq 0)

# --- Case 4: secret deseni -> tam ret, completion marker YOK ---
$c4 = New-Case "case4-secret"
Set-Content -LiteralPath (Join-Path $c4.Evidence "clean.json") -Value '{"ok":true}'
Set-Content -LiteralPath (Join-Path $c4.Evidence "dirty.log") -Value "token=sk-fakeTestOnly1234567890"
$r4 = Invoke-Export -RunId "run-secret-001" -Evidence $c4.Evidence -ExportRoot $c4.ExportRoot
Assert-True "secret dosyasi: exit code != 0" ($r4.ExitCode -ne 0) $r4.Output
$runDir4 = Join-Path $c4.ExportRoot "run-secret-001"
Assert-True "secret dosyasi: export dizini hic olusmadi (clean.json dahi kismi export edilmedi)" (-not (Test-Path -LiteralPath $runDir4))
Assert-True "secret dosyasi: completion marker YOK" (-not (Test-Path -LiteralPath (Join-Path $runDir4 "EXPORT.COMPLETE.json")))

# --- Case 5: allowlist disi uzanti -> tam ret ---
$c5 = New-Case "case5-disallowed-ext"
Set-Content -LiteralPath (Join-Path $c5.Evidence "ok.json") -Value '{"ok":true}'
Set-Content -LiteralPath (Join-Path $c5.Evidence "bad.exe") -Value "not really a PE, just text"
$r5 = Invoke-Export -RunId "run-ext-001" -Evidence $c5.Evidence -ExportRoot $c5.ExportRoot
Assert-True "allowlist disi uzanti: exit code != 0" ($r5.ExitCode -ne 0) $r5.Output
$runDir5 = Join-Path $c5.ExportRoot "run-ext-001"
Assert-True "allowlist disi uzanti: export dizini hic olusmadi (ok.json dahi kismi export edilmedi)" (-not (Test-Path -LiteralPath $runDir5))

# --- Case 6: ayni RunId tekrarinda ret ---
$c6 = New-Case "case6-rerun"
Set-Content -LiteralPath (Join-Path $c6.Evidence "a.json") -Value '{"ok":true}'
$r6a = Invoke-Export -RunId "run-dup-001" -Evidence $c6.Evidence -ExportRoot $c6.ExportRoot
Assert-True "ayni RunId tekrari: ilk kosu basarili" ($r6a.ExitCode -eq 0) $r6a.Output
$r6b = Invoke-Export -RunId "run-dup-001" -Evidence $c6.Evidence -ExportRoot $c6.ExportRoot
Assert-True "ayni RunId tekrari: ikinci kosu reddedildi" ($r6b.ExitCode -ne 0) $r6b.Output

# --- Case 7: hedef yolun ExportRoot altinda kalmasi (pozitif regresyon kontrolu) ---
$c7 = New-Case "case7-contained"
Set-Content -LiteralPath (Join-Path $c7.Evidence "a.json") -Value '{"ok":true}'
$r7 = Invoke-Export -RunId "run-contained-001" -Evidence $c7.Evidence -ExportRoot $c7.ExportRoot
$runDir7 = Join-Path $c7.ExportRoot "run-contained-001"
$resolvedRoot7 = [System.IO.Path]::GetFullPath($c7.ExportRoot)
$resolvedRunDir7 = [System.IO.Path]::GetFullPath($runDir7)
Assert-True "hedef yol ExportRoot altinda kaliyor" ($r7.ExitCode -eq 0 -and $resolvedRunDir7.StartsWith($resolvedRoot7 + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) $r7.Output

# --- Case 8: alt dizinlerde AYNI basename'e sahip iki dosya - goreli yollarla ayri korunur ---
$c8 = New-Case "case8-same-basename-subdirs"
$sub8a = Join-Path $c8.Evidence "subA"
$sub8b = Join-Path $c8.Evidence "subB"
New-Item -ItemType Directory -Path $sub8a -Force | Out-Null
New-Item -ItemType Directory -Path $sub8b -Force | Out-Null
Set-Content -LiteralPath (Join-Path $sub8a "dup.json") -Value '{"from":"subA"}'
Set-Content -LiteralPath (Join-Path $sub8b "dup.json") -Value '{"from":"subB"}'
$r8 = Invoke-Export -RunId "run-samebase-001" -Evidence $c8.Evidence -ExportRoot $c8.ExportRoot
Assert-True "ayni basename farkli alt dizin: exit code 0 (collision DEGIL, farkli goreli yol)" ($r8.ExitCode -eq 0) $r8.Output
$runDir8 = Join-Path $c8.ExportRoot "run-samebase-001"
$copiedA8 = Join-Path $runDir8 "subA\dup.json"
$copiedB8 = Join-Path $runDir8 "subB\dup.json"
Assert-True "ayni basename farkli alt dizin: subA\dup.json goreli yoluyla kopyalandi" (Test-Path -LiteralPath $copiedA8)
Assert-True "ayni basename farkli alt dizin: subB\dup.json goreli yoluyla kopyalandi" (Test-Path -LiteralPath $copiedB8)
if ((Test-Path -LiteralPath $copiedA8) -and (Test-Path -LiteralPath $copiedB8)) {
  $contentA8 = Get-Content -LiteralPath $copiedA8 -Raw
  $contentB8 = Get-Content -LiteralPath $copiedB8 -Raw
  Assert-True "ayni basename farkli alt dizin: icerikler birbirine KARISMADI" ($contentA8 -ne $contentB8 -and $contentA8.Contains("subA") -and $contentB8.Contains("subB"))
}

# --- Case 9: reparse point / symlink icerigi -> tam ret; guvenle olusturulamazsa SKIP ---
$c9 = New-Case "case9-reparse"
Set-Content -LiteralPath (Join-Path $c9.Evidence "clean9.json") -Value '{"ok":true}'
$reparseTargetDir = Join-Path $RunRoot "case9-reparse-target"
New-Item -ItemType Directory -Path $reparseTargetDir -Force | Out-Null
Set-Content -LiteralPath (Join-Path $reparseTargetDir "inside.json") -Value '{"via":"junction"}'
$junctionPath = Join-Path $c9.Evidence "linked-sub"
$junctionCreated = $false
$junctionSkipReason = ""
try {
  New-Item -ItemType Junction -Path $junctionPath -Target $reparseTargetDir -ErrorAction Stop | Out-Null
  $junctionCreated = $true
} catch {
  $junctionSkipReason = $_.Exception.Message
}
if ($junctionCreated) {
  $r9 = Invoke-Export -RunId "run-reparse-001" -Evidence $c9.Evidence -ExportRoot $c9.ExportRoot
  Assert-True "reparse/symlink icerik: exit code != 0 (tam ret)" ($r9.ExitCode -ne 0) $r9.Output
  $runDir9 = Join-Path $c9.ExportRoot "run-reparse-001"
  Assert-True "reparse/symlink icerik: export dizini hic olusmadi (clean9.json dahi kismi export edilmedi)" (-not (Test-Path -LiteralPath $runDir9))
} else {
  Write-Result "SKIP" "reparse/symlink icerik testi" "platform fixture guvenle olusturulamadi (Junction basarisiz): $junctionSkipReason"
}

Write-Output ""
$totalRun = $script:passCount + $script:failCount
Write-Output "$($script:passCount) PASS, $($script:failCount) FAIL, $($script:skipCount) SKIP (toplam calisan: $totalRun, toplam: $($script:passCount + $script:failCount + $script:skipCount))"

# Cleanup: SADECE bu kosunun KENDI olusturdugu kesin $RunRoot dizinini sil.
# Containment dogrulamasi: cozumlenmis yol, sistem temp kokunun ALTINDA mi
# VE bu kosunun benzersiz adiyla mi eslesiyor? Kullanicinin veya baska bir
# kosunun temp dizinine ASLA dokunulmaz.
$cleanupOk = $false
$cleanupDetail = ""
try {
  $resolvedRunRoot = [System.IO.Path]::GetFullPath($RunRoot)
  $resolvedTmpRootWithSep = if ($tmpRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) { $tmpRoot } else { $tmpRoot + [System.IO.Path]::DirectorySeparatorChar }
  $containedUnderTmpRoot = $resolvedRunRoot.StartsWith($resolvedTmpRootWithSep, [System.StringComparison]::OrdinalIgnoreCase)
  $nameMatches = (Split-Path -Leaf $resolvedRunRoot) -eq (Split-Path -Leaf $RunRoot)
  if (-not ($containedUnderTmpRoot -and $nameMatches)) {
    throw "containment check failed: resolved=$resolvedRunRoot tmpRoot=$resolvedTmpRootWithSep nameMatches=$nameMatches (silme REDDEDILDI)"
  }
  Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force -ErrorAction Stop
  $cleanupOk = $true
  $cleanupDetail = $resolvedRunRoot
} catch {
  $cleanupDetail = $_.Exception.Message
}
Write-Output "$(if ($cleanupOk) { 'PASS' } else { 'FAIL' })  cleanup: bu kosunun kendi temp dizini silindi ($RunRoot) -> $cleanupDetail"
if (-not $cleanupOk) {
  Write-Output "      CLEANUP BASARISIZ OLDU; gizlenmiyor. Elle temizlik gerekebilir: $RunRoot"
}

if ($script:failCount -gt 0 -or -not $cleanupOk) { exit 1 } else { exit 0 }
