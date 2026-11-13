param([Parameter(Mandatory=$true)][string]$Policy,[Parameter(Mandatory=$true)][string]$RunId)
# Guest runner for the PermissionRequest S1/S2 live test. Runs ONLY inside the disposable Windows Sandbox (refusals below).
# Same loopback mock + synthetic sentinel as the Write/Edit/Bash/PowerShell matrix; no real credential, model or network.
# S1: managed PermissionRequest = observe marker + production guard (deny)  -> target file must NOT appear.
# S3 (O4-NC guarded arm): S2 policy plus the production guard on PreToolUse -> target file must NOT appear. S3 runs BEFORE S2
#     because S2 creates the target and nothing is removed between scenarios (TARGET_EXISTS_BEFORE_<name> would throw).
# S2: managed PermissionRequest = narrow fixture-only allow hook (control)    -> target file is expected to appear.
# Per-scenario evidence is kept in separate files; nothing is deleted or cleared. The summary fields written to
# target-<scenario>.json are unattested guest observations; the raw logs next to them are the evidence of record.
# HOOKLOG makes the production guard write its own decision record (read by the guard itself, not by this script).
$ErrorActionPreference='Stop'
if($Policy -cne 'p2-permission-request-probe.test.json' -or $RunId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'){exit 10}
if($env:USERNAME -cne 'WDAGUtilityAccount'){exit 11}
$cs=Get-CimInstance Win32_ComputerSystem
if($cs.Manufacturer -cne 'Microsoft Corporation' -or $cs.Model -cne 'Virtual Machine'){exit 12}
$node='C:\payload\bin\node.exe';$claude='C:\payload\bin\claude.exe';$evidence='C:\evidence';$work='C:\work';$target='C:\work\mock-write-target.txt'
$scenarios=@(@{Name='S1';Policy='p2-permission-request-probe.test.json'},@{Name='S3';Policy='p2-pretooluse-guard-allow-control.test.json'},@{Name='S2';Policy='p2-permission-request-allow-control.test.json'})
New-Item -ItemType Directory -Force $evidence,$work|Out-Null
$mock=$null;$claudeProcess=$null;$current=$null;$currentPolicy=$null;$existedBefore=$false;$running=$false;$rotated=@{}
$draft=[ordered]@{schema='7allab-k205c-sandbox-run/0.1';run_id=$RunId;policy_file=$Policy;evidence_kind='MOCK_ENDPOINT';sourceTrusted=$false;authorityImplemented=$false;operationalAuthority=$false;review_verified=$false;status='RUN_FAILED_CLOSED';claude_exit_code=$null;claude_timed_out=$false;error=$null}
function Save-Evidence([string]$name,[string]$policyFile,[bool]$existedBefore,[bool]$completed){
  $debug="$work\claude-$name-debug.log";$guard="$evidence\guard-hooklog.log";$diskPolicy="$evidence\installed-policy-$name.sha256"
  $record=[ordered]@{scenario=$name;policy_file=$policyFile;completed=$completed;target_path=$target;existed_before=$existedBefore;exists_after=(Test-Path -LiteralPath $target -PathType Leaf);bytes=$null;sha256=$null;content_matches=$null;installed_policy_sha256=$null;debug_log_present=(Test-Path -LiteralPath $debug -PathType Leaf);debug_log_sha256=$null;debug_managed_settings_seen=$false;debug_allow_managed_hooks_only_seen=$false;debug_permission_hook_lines=0;hook_marker_present=(Test-Path -LiteralPath "$evidence\hook-marker.log");permission_marker_present=(Test-Path -LiteralPath "$evidence\permission-marker.log");mock_log_present=(Test-Path -LiteralPath "$evidence\mock-endpoint.jsonl");guard_log_present=(Test-Path -LiteralPath $guard);guard_log_lines=0}
  if($record.exists_after){$record.bytes=[int64](Get-Item -LiteralPath $target).Length;$record.sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash;$record.content_matches=([IO.File]::ReadAllText($target) -ceq 'synthetic-mock-content')}
  if(Test-Path -LiteralPath $diskPolicy -PathType Leaf){$record.installed_policy_sha256=((Get-Content -LiteralPath $diskPolicy -TotalCount 1)|Out-String).Trim()}
  if($record.debug_log_present){
    $record.debug_log_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $debug).Hash
    $record.debug_managed_settings_seen=[bool](Select-String -LiteralPath $debug -SimpleMatch 'this machine has managed settings' -Quiet)
    $record.debug_allow_managed_hooks_only_seen=[bool](Select-String -LiteralPath $debug -SimpleMatch 'allowManagedHooksOnly is enabled' -Quiet)
    $record.debug_permission_hook_lines=@(Select-String -LiteralPath $debug -SimpleMatch 'Hooks: PermissionRequest').Count
  }
  if($record.guard_log_present){$record.guard_log_lines=@(Get-Content -LiteralPath $guard).Count}
  foreach($pair in @(@('hook-marker.log',"hook-marker-$name.log"),@('permission-marker.log',"permission-marker-$name.log"),@('mock-endpoint.jsonl',"mock-endpoint-$name.jsonl"),@('guard-hooklog.log',"guard-hooklog-$name.log"))){
    if(Test-Path -LiteralPath "$evidence\$($pair[0])" -PathType Leaf){Move-Item -LiteralPath "$evidence\$($pair[0])" -Destination "$evidence\$($pair[1])"}
  }
  [IO.File]::WriteAllText("$evidence\target-$name.json",($record|ConvertTo-Json -Depth 4),(New-Object Text.UTF8Encoding($false)))
  $rotated[$name]=$true
}
try{
  $env:ANTHROPIC_BASE_URL='http://127.0.0.1:8765';[Environment]::SetEnvironmentVariable(('ANTHROPIC_'+'API_KEY'),'mock-fixture-sentinel-not-a-real-key-0000','Process');$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1'
  & $node 'C:\payload\sandbox\guest-auth-provenance.mjs' --mode MOCK_ENDPOINT --output "$evidence\guest-auth.json"
  if($LASTEXITCODE -ne 0){throw 'AUTH_PROVENANCE_FAILED'}
  foreach($s in $scenarios){
    $name=$s.Name;$current=$name;$currentPolicy=$s.Policy;$running=$false
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'C:\payload\sandbox\inside-sandbox-setup.ps1' -Policy $s.Policy
    if($LASTEXITCODE -ne 0){throw "SETUP_${name}_EXIT_$LASTEXITCODE"}
    Copy-Item -LiteralPath "$evidence\installed-policy.sha256" -Destination "$evidence\installed-policy-$name.sha256"
    $existedBefore=Test-Path -LiteralPath $target
    if($existedBefore){throw "TARGET_EXISTS_BEFORE_$name"}
    foreach($stale in @('hook-marker.log','permission-marker.log','mock-endpoint.jsonl','guard-hooklog.log')){if(Test-Path -LiteralPath "$evidence\$stale"){throw "STALE_EVIDENCE_BEFORE_$name"}}
    $env:HOOKLOG="$evidence\guard-hooklog.log"
    $running=$true
    $mock=Start-Process -FilePath $node -ArgumentList @('C:\payload\mocks\mock-endpoint.mjs','--port','8765','--scenario','Write') -WorkingDirectory $work -PassThru -WindowStyle Hidden -RedirectStandardOutput "$evidence\mock-$name-stdout.txt" -RedirectStandardError "$evidence\mock-$name-stderr.txt"
    $ready=$false
    for($i=0;$i -lt 40;$i++){Start-Sleep -Milliseconds 250;if($mock.HasExited){throw "MOCK_${name}_EXIT_$($mock.ExitCode)"};if(Test-NetConnection 127.0.0.1 -Port 8765 -InformationLevel Quiet -WarningAction SilentlyContinue){$ready=$true;break}}
    if(-not $ready){throw "MOCK_${name}_NOT_READY"}
    $psi=New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName=$claude;$psi.Arguments="-p READY --model claude-opus-5-5 --output-format stream-json --verbose --debug-file `"C:\work\claude-$name-debug.log`"";$psi.WorkingDirectory=$work
    $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    $claudeProcess=New-Object System.Diagnostics.Process;$claudeProcess.StartInfo=$psi
    if(-not $claudeProcess.Start()){throw "CLAUDE_${name}_START_FAILED"}
    $stdoutTask=$claudeProcess.StandardOutput.ReadToEndAsync();$stderrTask=$claudeProcess.StandardError.ReadToEndAsync()
    $timedOut=-not $claudeProcess.WaitForExit(120000)
    if($timedOut){$claudeProcess.Kill();$claudeProcess.WaitForExit()}
    $stdout=$stdoutTask.GetAwaiter().GetResult();$stderr=$stderrTask.GetAwaiter().GetResult()
    [IO.File]::WriteAllText("$evidence\claude-$name-output.jsonl",$stdout,(New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText("$evidence\claude-$name-stderr.txt",$stderr,(New-Object Text.UTF8Encoding($false)))
    if($timedOut){$draft['claude_timed_out']=$true;$draft['claude_exit_code']=124;throw "CLAUDE_${name}_TIMEOUT"}
    $draft['claude_exit_code']=[int]$claudeProcess.ExitCode
    if($draft.claude_exit_code -ne 0){throw "CLAUDE_${name}_EXIT_$($draft.claude_exit_code)"}
    if(-not $mock.HasExited){$mock.Kill();$mock.WaitForExit()}
    $mock=$null;$claudeProcess=$null
    Save-Evidence $name $s.Policy $existedBefore $true
    $running=$false
  }
  $draft['status']='RUN_COMPLETED_UNATTESTED'
}catch{
  $draft.error=$_.Exception.Message
  if($running -and $current -and -not $rotated.ContainsKey($current)){
    try{
      if($claudeProcess -and -not $claudeProcess.HasExited){$claudeProcess.Kill();$claudeProcess.WaitForExit()}
      if($mock -and -not $mock.HasExited){$mock.Kill();$mock.WaitForExit()}
      Save-Evidence $current $currentPolicy $existedBefore $false
    }catch{$draft.error="$($draft.error);EVIDENCE_CAPTURE_FAILED"}
  }
}
finally{
  if($claudeProcess -and -not $claudeProcess.HasExited){$claudeProcess.Kill();$claudeProcess.WaitForExit()}
  if($mock -and -not $mock.HasExited){$mock.Kill();$mock.WaitForExit()}
  foreach($s in $scenarios){$name=$s.Name;if(Test-Path -LiteralPath "$work\claude-$name-debug.log" -PathType Leaf){Copy-Item -LiteralPath "$work\claude-$name-debug.log" -Destination "$evidence\claude-$name-debug.log"}}
  $draft|ConvertTo-Json -Depth 6|Set-Content -LiteralPath "$work\result.draft.json" -Encoding utf8
  & $node 'C:\payload\sandbox\guest-result-finalize.mjs' --draft "$work\result.draft.json" --provenance "$evidence\guest-auth.json" --output "$evidence\result.json"
  if($LASTEXITCODE -ne 0){throw 'RESULT_FINALIZE_FAILED'}
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'C:\payload\sandbox\export-manifest.ps1' -RunId $RunId -EvidenceDir $evidence -ExportRoot 'C:\export'
  if($LASTEXITCODE -ne 0){throw 'EXPORT_FAILED'}
}
