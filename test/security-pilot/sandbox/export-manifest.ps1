# export-manifest.ps1 — K2-05-C hazırlık, Option A kanıt-export betiği (DRAFT, ÇALIŞTIRILMADI)
#
# BU GOREVDE (Task 13/14) HICBIR SEKILDE CALISTIRILMAMISTIR. Yalniz
# check-package.mjs'in PowerShell parse-only kontrolunden gecmesi icin
# hazirlanmistir. Gelecekte, SANDBOX ICINDE, yalniz yetkili bir kosuda
# calistirilmasi ongorulur.
#
# Amac: C:\evidence altindaki izin verilen (allowlist) dosyalari,
# C:\export altina SHA-256 manifestiyle birlikte kopyalamak. Host'un
# kendisi bu betigi degil, sandbox ICI bu betigi calistirir; host
# tarafi yalniz export mapped folder'i okur (bkz. ../EXPORT-DESIGN.md).
#
# IKI ASAMALI CALISMA (Task 14, bolum A.2):
#   FAZ 1 (preflight, salt-okunur): tum kaynak dosyalar taranir; hicbir
#     host-export dosyasi/dizini OLUSTURULMAZ. Herhangi bir sorun
#     (okunamayan dosya, allowlist disi, secret, path collision, kapsam
#     disi yol, reparse point/symlink) varsa FAIL-CLOSED ile durulur ve
#     $RunExportDir hic olusturulmaz.
#   FAZ 2 (kopyalama + dogrulama + manifest + completion marker): FAZ 1
#     tamamen temiz gectiginde baslar. Once dosyalar kopyalanir ve
#     kaynak/hedef SHA-256 esitligi dogrulanir; ardindan manifest
#     yazilir; EN SON EXPORT.COMPLETE.json olusturulur. Bu marker
#     olmadan host tarafi export'u GECERLI KABUL ETMEMELIDIR. Hata
#     durumunda hicbir "basarili" mesaji veya marker uretilmez.
#
# ZORUNLU KURALLAR:
#  - Onceki export dizinini SILMEZ veya BOSALTMAZ (hicbir Remove-Item
#    /-Recurse komutu yoktur).
#  - RunId: yalniz ASCII harf/rakam/nokta/alt cizgi/tire; ilk karakter
#    harf/rakam; path separator, drive prefix, wildcard, rooted path,
#    "." veya ".." KABUL EDILMEZ; makul uzunluk siniri vardir.
#  - Hedef yol, cozumlenmis (GetFullPath) ExportRoot altinda kalmak
#    ZORUNDADIR; aksi halde FAIL-CLOSED.
#  - Export edilen dosyalarin EvidenceDir altindaki GORELI dizin yapisi
#    korunur; manifest dosya adini degil normalize edilmis GORELI yolu
#    kaydeder; iki kaynagin ayni normalize hedefe cozumlenmesi (path
#    collision) REDDEDILIR.
#  - Yalniz allowlist'teki uzantilara uyan dosyalar export edilir.
#  - Her dosyanin HER dizin bileseni dahil reparse point/symlink
#    kontrolunden gecer; biri bile tespit edilirse FAIL-CLOSED.
#  - Basit bir secret-deseni taramasi uygulanir; eslesme varsa o dosya
#    FAIL-CLOSED olarak reddedilir (kismi export yoktur: secret
#    tespitinde butun preflight basarisiz sayilir).
#
# Kullanim (SADECE gelecekteki yetkili sandbox kosusunda):
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File export-manifest.ps1 -RunId <unique-run-id>

param(
  [Parameter(Mandatory = $true)]
  [string]$RunId,
  [string]$EvidenceDir = "C:\evidence",
  [string]$ExportRoot = "C:\export"
)

$ErrorActionPreference = "Stop"

$AllowedExtensions = @(".json", ".jsonl", ".log", ".txt", ".sha256")
$SecretPatterns = @("sk-[A-Za-z0-9_-]{10,}", "BEGIN PRIVATE KEY", "Bearer [A-Za-z0-9._-]+")
$MaxRunIdLength = 128

function Invoke-FailClosed {
  param([string]$Message)
  Write-Error "FAIL-CLOSED: $Message"
  exit 1
}

function Test-ValidRunId {
  param([string]$Id)
  if ([string]::IsNullOrEmpty($Id)) { return $false }
  if ($Id.Length -gt $MaxRunIdLength) { return $false }
  if ($Id -eq "." -or $Id -eq "..") { return $false }
  if ($Id -match '[\\/]') { return $false }
  if ($Id -match '^[A-Za-z]:') { return $false }
  if ($Id -match '[\*\?]') { return $false }
  if ([System.IO.Path]::IsPathRooted($Id)) { return $false }
  if ($Id -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { return $false }
  return $true
}

if (-not (Test-ValidRunId -Id $RunId)) {
  Invoke-FailClosed "RunId gecersiz. Yalniz ASCII harf/rakam/nokta/alt_cizgi/tire; ilk karakter harf/rakam; path separator/drive-prefix/wildcard/rooted-path/'.'/'..' icermemeli; uzunluk <= $MaxRunIdLength olmali."
}

$ResolvedExportRoot = [System.IO.Path]::GetFullPath($ExportRoot)
$ResolvedRunExportDir = [System.IO.Path]::GetFullPath((Join-Path $ResolvedExportRoot $RunId))

if (-not ($ResolvedRunExportDir.StartsWith($ResolvedExportRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))) {
  Invoke-FailClosed "Cozumlenmis export dizini ExportRoot disinda kaliyor: $ResolvedRunExportDir"
}

if (Test-Path -LiteralPath $ResolvedRunExportDir) {
  Invoke-FailClosed "RunId '$RunId' icin export dizini ZATEN VAR. Onceki kosunun uzerine yazilmaz; yeni benzersiz RunId kullanin."
}

$ResolvedEvidenceDir = [System.IO.Path]::GetFullPath($EvidenceDir)
if (-not (Test-Path -LiteralPath $ResolvedEvidenceDir)) {
  Invoke-FailClosed "EvidenceDir bulunamadi: $ResolvedEvidenceDir"
}

function Test-PathHasReparsePoint {
  param([string]$FullPath)
  # Kok (EvidenceDir) ile hedef arasindaki HER dizin bileseni dahil kontrol.
  $relative = $FullPath.Substring($ResolvedEvidenceDir.Length).TrimStart('\', '/')
  $cur = $ResolvedEvidenceDir
  foreach ($part in ($relative -split '[\\/]')) {
    if ([string]::IsNullOrEmpty($part)) { continue }
    $cur = Join-Path $cur $part
    if (Test-Path -LiteralPath $cur) {
      $item = Get-Item -LiteralPath $cur -Force
      if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { return $true }
    }
  }
  return $false
}

function Test-ContainsSecretPattern {
  param([string]$Text)
  foreach ($pattern in $SecretPatterns) {
    if ($Text -match $pattern) { return $true }
  }
  return $false
}

# ---------------------------------------------------------------------------
# FAZ 1 — PREFLIGHT (salt-okunur; hicbir host-export dosyasi olusturulmaz)
# ---------------------------------------------------------------------------

$preflightErrors = New-Object System.Collections.Generic.List[string]
$planned = New-Object System.Collections.Generic.List[object]
$seenTargets = @{}

$sourceFiles = @(Get-ChildItem -LiteralPath $ResolvedEvidenceDir -Recurse -File -Force -ErrorAction SilentlyContinue)

# Dizin reparse point/symlink taramasi: Get-ChildItem -Recurse, bir junction/symlink
# dizinin ICERIGINE inmez; bu nedenle yukaridaki -File taramasi, oyle bir dizinin
# ALTINDAKI dosyalari HICBIR ZAMAN gormez (ne kabul ne ret - sessizce atlanir). Junction/
# symlink dizinin KENDISI ise -Directory taramasinda ayri bir girdi olarak gorunur; bu
# yuzden dosya bazli kontrolden BAGIMSIZ olarak dizin seviyesinde ayrica kontrol edilir.
$sourceDirs = @(Get-ChildItem -LiteralPath $ResolvedEvidenceDir -Recurse -Directory -Force -ErrorAction SilentlyContinue)
foreach ($d in $sourceDirs) {
  if (Test-PathHasReparsePoint -FullPath $d.FullName) {
    $preflightErrors.Add("reparse point/symlink tespit edildi (dizin): $($d.FullName)")
  }
}

foreach ($item in $sourceFiles) {
  $fullPath = $item.FullName

  if (Test-PathHasReparsePoint -FullPath $fullPath) {
    $preflightErrors.Add("reparse point/symlink tespit edildi: $fullPath")
    continue
  }

  $relPath = $fullPath.Substring($ResolvedEvidenceDir.Length).TrimStart('\', '/')
  $relPathNormalized = $relPath -replace '/', '\'

  if ($relPathNormalized -match '\.\.') {
    $preflightErrors.Add("kapsam disi (traversal icerir) goreli yol: $fullPath")
    continue
  }

  $ext = $item.Extension.ToLowerInvariant()
  if ($AllowedExtensions -notcontains $ext) {
    $preflightErrors.Add("allowlist disi dosya: $fullPath")
    continue
  }

  $content = ""
  if ($item.Length -gt 0) {
    try {
      $content = Get-Content -LiteralPath $fullPath -Raw -ErrorAction Stop
    } catch {
      $preflightErrors.Add("okunamayan dosya: $fullPath ($($_.Exception.Message))")
      continue
    }
  }

  if ($content -and (Test-ContainsSecretPattern -Text $content)) {
    $preflightErrors.Add("secret deseni tespit edildi: $fullPath")
    continue
  }

  $targetPathCandidate = [System.IO.Path]::GetFullPath((Join-Path $ResolvedRunExportDir $relPathNormalized))
  if (-not ($targetPathCandidate.StartsWith($ResolvedRunExportDir + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))) {
    $preflightErrors.Add("hedef yol run export dizini disina cikiyor: $fullPath -> $targetPathCandidate")
    continue
  }

  $targetKey = $targetPathCandidate.ToLowerInvariant()
  if ($seenTargets.ContainsKey($targetKey)) {
    $preflightErrors.Add("path collision: '$fullPath' ve '$($seenTargets[$targetKey])' ayni hedefe cozumleniyor ($targetPathCandidate)")
    continue
  }
  $seenTargets[$targetKey] = $fullPath

  $planned.Add([PSCustomObject]@{
    SourcePath   = $fullPath
    RelativePath = $relPathNormalized
    TargetPath   = $targetPathCandidate
  })
}

if ($preflightErrors.Count -gt 0) {
  Write-Error "FAIL-CLOSED: preflight basarisiz. Hicbir dosya export edilmedi, hicbir export dizini olusturulmadi."
  foreach ($e in $preflightErrors) { Write-Error "  - $e" }
  exit 1
}

# ---------------------------------------------------------------------------
# FAZ 2 — KOPYALA + DOGRULA + MANIFEST + COMPLETION MARKER (bu sirada, EN SON marker)
# ---------------------------------------------------------------------------

try {
  New-Item -ItemType Directory -Path $ResolvedRunExportDir -Force | Out-Null

  $manifestEntries = New-Object System.Collections.Generic.List[object]

  foreach ($p in $planned) {
    $destDir = Split-Path -Parent $p.TargetPath
    if (-not (Test-Path -LiteralPath $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $p.SourcePath -Destination $p.TargetPath -ErrorAction Stop

    $srcHash = (Get-FileHash -LiteralPath $p.SourcePath -Algorithm SHA256).Hash
    $dstHash = (Get-FileHash -LiteralPath $p.TargetPath -Algorithm SHA256).Hash
    if ($srcHash -ne $dstHash) {
      throw "SHA-256 mismatch after copy: $($p.RelativePath) (src=$srcHash dst=$dstHash)"
    }

    $manifestEntries.Add([PSCustomObject]@{
      relative_path = $p.RelativePath
      sha256        = $dstHash
      bytes         = (Get-Item -LiteralPath $p.TargetPath).Length
    })
  }

  $manifest = [PSCustomObject]@{
    run_id       = $RunId
    generated_at = (Get-Date).ToString("o")
    note         = "Sandbox-internal export manifest. Host must re-verify each sha256 after reading this mapped folder. No file here should ever be auto-executed on the host."
    files        = $manifestEntries
  }
  $manifestPath = Join-Path $ResolvedRunExportDir "MANIFEST.sha256.json"
  ($manifest | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $manifestPath

  # Completion marker EN SON yazilir. Bunun yoklugu = export gecersiz/eksik,
  # butun diger dosyalar mevcut olsa dahi.
  $completion = [PSCustomObject]@{
    run_id       = $RunId
    completed_at = (Get-Date).ToString("o")
    file_count   = $manifestEntries.Count
    note         = "Presence of this file is the ONLY valid completion signal. Its absence means the export is incomplete/invalid regardless of what other files are present."
  }
  $completionPath = Join-Path $ResolvedRunExportDir "EXPORT.COMPLETE.json"
  ($completion | ConvertTo-Json -Depth 3) | Set-Content -LiteralPath $completionPath

  Write-Output "Export tamamlandi: $ResolvedRunExportDir ($($manifestEntries.Count) dosya)"
} catch {
  Write-Error "FAIL-CLOSED: export sirasinda hata: $($_.Exception.Message)"
  Write-Error "Hicbir 'basarili' mesaji veya completion marker uretilmedi (FAZ 2 hatali sonlandi)."
  exit 1
}
