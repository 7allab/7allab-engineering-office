# DRAFT (K2-03-D/E), never executed. Meant to run ONLY inside a disposable Windows Sandbox started with the pilot .wsb.
# The checks below are LOCAL, SPOOFABLE signals and fail closed; they are NOT an isolation guarantee. The real guarantee is
# procedural: this script is started only by the .wsb LogonCommand, never by hand on the host.
# Installs the chosen managed test policy into the sandbox's own C:\Program Files\ClaudeCode. No network, no credentials.
param([string]$Policy)
if ($env:USERNAME -ne 'WDAGUtilityAccount') { Write-Error 'REFUSED: not the sandbox account'; exit 3 }
$cs = Get-CimInstance Win32_ComputerSystem
if ($cs.Manufacturer -ne 'Microsoft Corporation' -or $cs.Model -ne 'Virtual Machine') { Write-Error 'REFUSED: not a Hyper-V guest'; exit 6 }
if (-not (Test-Path -LiteralPath 'C:\payload\policy-to-install.txt')) { Write-Error 'REFUSED: payload not mapped'; exit 7 }
if (-not $Policy) { $Policy = Get-Content -LiteralPath 'C:\payload\policy-to-install.txt' -TotalCount 1 }
if ($Policy -notmatch '^p[1-6]-[a-z0-9-]+\.test\.json$') { Write-Error 'REFUSED: unexpected policy name'; exit 4 }
$src = Join-Path 'C:\payload\policies' $Policy
if (-not (Test-Path -LiteralPath $src)) { Write-Error 'REFUSED: policy not in payload'; exit 5 }
New-Item -ItemType Directory -Force 'C:\Program Files\ClaudeCode', 'C:\evidence', 'C:\work' | Out-Null
Copy-Item -LiteralPath $src -Destination 'C:\Program Files\ClaudeCode\managed-settings.json' -Force
(Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Program Files\ClaudeCode\managed-settings.json').Hash | Set-Content -Encoding ascii 'C:\evidence\installed-policy.sha256'
