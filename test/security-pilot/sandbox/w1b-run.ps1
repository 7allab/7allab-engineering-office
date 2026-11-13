param([Parameter(Mandatory=$true)][string]$Policy,[Parameter(Mandatory=$true)][string]$RunId)
$ErrorActionPreference='Stop'
if($Policy -cne 'p2-managed-hooks-only.test.json' -or $RunId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'){exit 10}
if($env:USERNAME -cne 'WDAGUtilityAccount'){exit 11}
$cs=Get-CimInstance Win32_ComputerSystem
if($cs.Manufacturer -cne 'Microsoft Corporation' -or $cs.Model -cne 'Virtual Machine'){exit 12}
$node='C:\payload\bin\node.exe';$claude='C:\payload\bin\claude.exe';$evidence='C:\evidence';$work='C:\work'
New-Item -ItemType Directory -Force $evidence,$work|Out-Null
$mock=$null;$claudeProcess=$null;$draft=[ordered]@{schema='7allab-k205c-sandbox-run/0.1';run_id=$RunId;policy_file=$Policy;evidence_kind='MOCK_ENDPOINT';sourceTrusted=$false;authorityImplemented=$false;operationalAuthority=$false;review_verified=$false;status='RUN_FAILED_CLOSED';claude_exit_code=$null;claude_timed_out=$false;error=$null}
try{
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'C:\payload\sandbox\inside-sandbox-setup.ps1' -Policy $Policy
  if($LASTEXITCODE -ne 0){throw "SETUP_EXIT_$LASTEXITCODE"}
  $env:ANTHROPIC_BASE_URL='http://127.0.0.1:8765';[Environment]::SetEnvironmentVariable(('ANTHROPIC_'+'API_KEY'),'mock-fixture-sentinel-not-a-real-key-0000','Process');$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1'
  & $node 'C:\payload\sandbox\guest-auth-provenance.mjs' --mode MOCK_ENDPOINT --output "$evidence\guest-auth.json"
  if($LASTEXITCODE -ne 0){throw 'AUTH_PROVENANCE_FAILED'}
  Set-Content -LiteralPath "$work\readme.txt" -Value 'synthetic read fixture' -Encoding ascii
  & $node 'C:\payload\sandbox\w1b-direct-feed.mjs' --project $work --output "$evidence\direct-feed.json"
  if($LASTEXITCODE -ne 0){throw 'DIRECT_FEED_FAILED'}
  foreach($scenario in @('Write','Edit','Bash','PowerShell')){
    $mock=Start-Process -FilePath $node -ArgumentList @('C:\payload\mocks\mock-endpoint.mjs','--port','8765','--scenario',$scenario) -WorkingDirectory $work -PassThru -WindowStyle Hidden -RedirectStandardOutput "$evidence\mock-$scenario-stdout.txt" -RedirectStandardError "$evidence\mock-$scenario-stderr.txt"
    $ready=$false
    for($i=0;$i -lt 40;$i++){Start-Sleep -Milliseconds 250;if($mock.HasExited){throw "MOCK_${scenario}_EXIT_$($mock.ExitCode)"};if(Test-NetConnection 127.0.0.1 -Port 8765 -InformationLevel Quiet -WarningAction SilentlyContinue){$ready=$true;break}}
    if(-not $ready){throw "MOCK_${scenario}_NOT_READY"}
    $psi=New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName=$claude;$psi.Arguments="-p READY --model claude-opus-5-5 --output-format stream-json --verbose --debug-file `"C:\work\claude-$scenario-debug.log`"";$psi.WorkingDirectory=$work
    $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    $claudeProcess=New-Object System.Diagnostics.Process;$claudeProcess.StartInfo=$psi
    if(-not $claudeProcess.Start()){throw "CLAUDE_${scenario}_START_FAILED"}
    $stdoutTask=$claudeProcess.StandardOutput.ReadToEndAsync();$stderrTask=$claudeProcess.StandardError.ReadToEndAsync()
    $timedOut=-not $claudeProcess.WaitForExit(120000)
    if($timedOut){$claudeProcess.Kill();$claudeProcess.WaitForExit()}
    $stdout=$stdoutTask.GetAwaiter().GetResult();$stderr=$stderrTask.GetAwaiter().GetResult()
    [IO.File]::WriteAllText("$evidence\claude-$scenario-output.jsonl",$stdout,(New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText("$evidence\claude-$scenario-stderr.txt",$stderr,(New-Object Text.UTF8Encoding($false)))
    if($timedOut){$draft['claude_timed_out']=$true;$draft['claude_exit_code']=124;throw "CLAUDE_${scenario}_TIMEOUT"}
    $draft['claude_exit_code']=[int]$claudeProcess.ExitCode
    if($draft.claude_exit_code -ne 0){throw "CLAUDE_${scenario}_EXIT_$($draft.claude_exit_code)"}
    if(-not $mock.HasExited){$mock.Kill();$mock.WaitForExit()}
    $mock=$null;$claudeProcess=$null
  }
  $draft['status']='RUN_COMPLETED_UNATTESTED'
}catch{$draft.error=$_.Exception.Message}
finally{
  if($claudeProcess -and -not $claudeProcess.HasExited){$claudeProcess.Kill();$claudeProcess.WaitForExit()}
  if($mock -and -not $mock.HasExited){$mock.Kill();$mock.WaitForExit()}
  foreach($scenario in @('Write','Edit','Bash','PowerShell')){if(Test-Path -LiteralPath "$work\claude-$scenario-debug.log" -PathType Leaf){Copy-Item -LiteralPath "$work\claude-$scenario-debug.log" -Destination "$evidence\claude-$scenario-debug.log"}}
  $draft|ConvertTo-Json -Depth 6|Set-Content -LiteralPath "$work\result.draft.json" -Encoding utf8
  & $node 'C:\payload\sandbox\guest-result-finalize.mjs' --draft "$work\result.draft.json" --provenance "$evidence\guest-auth.json" --output "$evidence\result.json"
  if($LASTEXITCODE -ne 0){throw 'RESULT_FINALIZE_FAILED'}
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'C:\payload\sandbox\export-manifest.ps1' -RunId $RunId -EvidenceDir $evidence -ExportRoot 'C:\export'
  if($LASTEXITCODE -ne 0){throw 'EXPORT_FAILED'}
}
