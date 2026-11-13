// Offline integrity + syntax check of THIS package only (K2-03-D). It runs nothing from the package, installs nothing,
// uses no network, and says nothing about enforcement: PASS here = "package files are well-formed and unchanged".
// Usage: node check-package.mjs [--write-manifest] [--self-test]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MANIFEST = join(HERE, 'MANIFEST.sha256.json');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const rel = (p) => relative(HERE, p).split(sep).join('/');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const BS = String.fromCharCode(92);

// ---- pure validators (text in, problem list out) so --self-test can prove they reject bad input
export function checkWsb(x) {
  const p = [];
  for (const [t, v] of [['Networking', 'Disable'], ['ClipboardRedirection', 'Disable'], ['VGpu', 'Disable'], ['AudioInput', 'Disable'], ['VideoInput', 'Disable'], ['PrinterRedirection', 'Disable']]) {
    if (!new RegExp(`<${t}>${v}</${t}>`).test(x)) p.push(`${t} is not ${v}`);
  }
  // Task 13 / Option-A hazirligi: tam olarak 2 MappedFolder beklenir: C:\payload (RO) ve C:\export (RW, placeholder).
  const folderBlocks = x.match(/<MappedFolder>[\s\S]*?<\/MappedFolder>/g) ?? [];
  if (folderBlocks.length !== 2) p.push(`expected exactly 2 MappedFolder entries (payload RO + export RW), got ${folderBlocks.length}`);
  const parsed = folderBlocks.map((b) => ({
    host: (b.match(/<HostFolder>(.*?)<\/HostFolder>/) ?? [])[1],
    sandbox: (b.match(/<SandboxFolder>(.*?)<\/SandboxFolder>/) ?? [])[1],
    readOnly: (b.match(/<ReadOnly>(.*?)<\/ReadOnly>/) ?? [])[1],
  }));
  const payload = parsed.find((f) => f.sandbox === `C:${BS}payload`);
  const exp = parsed.find((f) => f.sandbox === `C:${BS}export`);
  if (!payload) p.push(`missing C:${BS}payload mapped folder`);
  else {
    if (payload.readOnly !== 'true') p.push('payload mapped folder must stay ReadOnly=true (export must not be mapped writable onto the payload slot)');
    if (payload.host !== '__HOST_PAYLOAD_DIR__') p.push('payload HostFolder must stay the placeholder in the repo draft');
  }
  if (!exp) p.push(`missing C:${BS}export mapped folder`);
  else {
    if (exp.readOnly !== 'false') p.push('export mapped folder must stay ReadOnly=false (writable); a read-only export mapping cannot receive evidence');
    if (exp.host !== '__HOST_EXPORT_DIR_PLACEHOLDER__') p.push('export HostFolder must stay the placeholder in the repo draft');
  }
  if (payload && exp) {
    if (payload.host === exp.host) p.push('export and payload HostFolder placeholders must not be the same directory');
    if (payload.sandbox === exp.sandbox) p.push('export and payload SandboxFolder must not be the same directory');
  }
  if (/Projeler|Users|\.claude|ProgramData/i.test(x.replace(/<!--[\s\S]*?-->/g, ''))) p.push('draft names a real host path');
  return p;
}
export function checkMockEndpoint(text) {
  const p = [];
  if (!/MOCK_BIND_ADDRESS\s*=\s*"127\.0\.0\.1"/.test(text)) p.push('mock endpoint must hard-code bind address to 127.0.0.1');
  if (/0\.0\.0\.0/.test(text)) p.push('mock endpoint must not reference 0.0.0.0 (loopback-only requirement)');
  if (!/EVIDENCE_KIND\s*=\s*"MOCK_ENDPOINT"/.test(text)) p.push('mock endpoint must label all evidence as MOCK_ENDPOINT');
  if (/evidence_kind['"]?\s*[:=]\s*['"]LIVE_REAL_MODEL['"]/.test(text)) p.push('mock endpoint must never label evidence as LIVE_REAL_MODEL');
  if (!/REDACT_HEADERS/.test(text) || !/authorization/i.test(text)) p.push('mock endpoint must redact Authorization/credential headers before logging');
  if (/sk-ant-/.test(text)) p.push('mock endpoint contains a forbidden secret-like pattern');

  // Task 14 / bolum B+C hardening checks.
  if (!text.includes('checkEvidenceWritable')) p.push('mock endpoint must verify evidence dir/log writability before listen()');
  // Task 14B: evidenceDir/logFile artik PARAMETRE (bkz. checkMockEndpointEvidenceIsolation);
  // bu yuzden cagri artik parametrelenmis adlarla yapilir, sabit isimlerle degil.
  // ONEMLI: sonundaki ';' KASITLIDIR - onsuz bu metin fonksiyon TANIMIYLA da
  // eslesir ("function checkEvidenceWritable(evidenceDir, logFile) {"), ki o
  // tanim HER ZAMAN dosyanin basinda, listen()'dan once yer alir ve bu da
  // kontrolu yanlislikla hep "basarili" gosterirdi (gercek cagri yeri degil).
  const idxWritableCheck = text.indexOf('checkEvidenceWritable(evidenceDir, logFile);');
  const idxListen = text.indexOf('server.listen(');
  if (idxWritableCheck < 0 || idxListen < 0 || idxWritableCheck > idxListen) p.push('writability check must run strictly before listen()');
  if (!text.includes('MAX_BODY_BYTES')) p.push('mock endpoint must enforce an explicit request body size limit (MAX_BODY_BYTES)');
  if (!text.includes('EXPECTED_METHOD') || !text.includes('EXPECTED_PATH')) p.push('mock endpoint must validate exact method and path');
  if (!text.includes('EXPECTED_QUERIES') || !text.includes('?beta=true')) p.push('mock endpoint must explicitly allowlist Claude Code 2.1.319.0 beta query without relaxing other paths/queries');
  if (!text.includes('rejected: "unexpected_method_or_path"') || !text.includes('method: req.method') || !text.includes('path: req.url')) {
    p.push('mock endpoint must log rejected request method/path metadata so protocol drift is diagnosable');
  }
  if (!text.includes('EXPECTED_CONTENT_TYPE')) p.push('mock endpoint must validate content-type');
  if (!text.includes('isLoopbackRemote')) p.push('mock endpoint must validate the remote address is loopback');
  if (!text.includes('SYNTHETIC_AUTH_SENTINEL')) p.push('mock endpoint must require a documented synthetic auth sentinel');
  if (!text.includes('log_write_failed')) p.push('mock endpoint must respond with an explicit error (never 200) when logging fails');
  if (!text.includes('buildMessagesApiResponse') || !text.includes('stop_reason') || !text.includes('tool_use')) {
    p.push('mock endpoint must respond in an Anthropic Messages API compatible shape (tool_use content block, stop_reason)');
  }
  if (!text.includes('hasToolResult') || !text.includes('buildTerminalResponse') || !text.includes('end_turn')) {
    p.push('mock endpoint must terminate after the first tool_result instead of returning an endless tool_use loop');
  }
  if (/SYNTHETIC_RESPONSES\s*\[\s*toolName\s*\]/.test(text)) p.push('mock endpoint must not guess the tool from the request body (bespoke tool_name lookup found)');
  if (!text.includes('--scenario')) p.push('mock endpoint must select its scenario explicitly via --scenario at startup, not from the request');
  return p;
}
// Task 14B / bolum 1: --self-test hicbir kosulda gercek C:\evidence'i kullanmamali.
export function checkMockEndpointEvidenceIsolation(text) {
  const p = [];
  if (!/function startServer\(\{\s*port,\s*scenario,\s*evidenceDir\s*=\s*DEFAULT_EVIDENCE_DIR,\s*logFile\s*=\s*DEFAULT_LOG_FILE\s*\}\)/.test(text)) {
    p.push('startServer must take evidenceDir/logFile as parameters defaulting to DEFAULT_EVIDENCE_DIR/DEFAULT_LOG_FILE (production default), not hard-coded unconditionally');
  }
  if (!/function appendLogOrThrow\(logFile,\s*entry\)/.test(text)) p.push('appendLogOrThrow must take logFile as a parameter (no module-level hard-coded path)');
  if (!/function handleRequest\(scenario,\s*logFile,\s*req,\s*res\)/.test(text)) p.push('handleRequest must take logFile as a parameter');
  if (!text.includes('mkdtempSync')) p.push('self-test must create its own unique dir via fs.mkdtempSync');
  if (!/os\.tmpdir\(\)/.test(text)) p.push('self-test must root its temp dir under the system temp directory (os.tmpdir())');
  if (!/startServer\(\{\s*port:\s*0,\s*scenario:\s*"Write",\s*evidenceDir:\s*selfTestDir,\s*logFile:\s*selfTestLogFile\s*\}\)/.test(text)) {
    p.push('runSelfTest must call startServer with its own selfTestDir/selfTestLogFile, never the production default');
  }
  if (!text.includes('snapshotDirReadOnly')) p.push('self-test must take a read-only before/after snapshot of the production evidence dir');
  if (!text.includes('snapshotsEqual')) p.push('self-test must compare before/after snapshots to prove the evidence dir was untouched');
  if (!text.includes('evidenceUntouched')) p.push('self-test must compute and report an evidenceUntouched result');
  const realpathIdx = text.indexOf('fs.realpathSync(selfTestDir)');
  const rmIdx = text.indexOf('fs.rmSync(resolvedSelfTestDir');
  if (realpathIdx < 0 || rmIdx < 0 || realpathIdx > rmIdx) {
    p.push('cleanup must resolve the real path and verify containment under the temp root BEFORE deleting it');
  }
  if (!text.includes('containedUnderTmpRoot') || !text.includes('nameMatches')) {
    p.push("cleanup containment check must verify both: resolved path is under the temp root AND its basename matches this run's generated unique directory name");
  }
  if (!/CLEANUP BASARISIZ/.test(text)) p.push('cleanup failure must be reported in the self-test result, not hidden');
  if (!/process\.exitCode\s*=\s*failed\s*\|\|\s*!evidenceUntouched\s*\|\|\s*!cleanupOk/.test(text)) {
    p.push('self-test exit code must reflect failed assertions, evidence-untouched violation, AND cleanup failure');
  }
  return p;
}
export function checkExportScript(text) {
  const p = [];
  if (/Remove-Item[^\n]*-Recurse/i.test(text)) p.push('export script must not delete/clear a prior export directory (Remove-Item -Recurse found)');
  if (/\brd\s+\/s\b|\brmdir\s+\/s\b/i.test(text)) p.push('export script must not delete/clear a prior export directory (rd/rmdir /s found)');
  if (!/Get-FileHash/i.test(text)) p.push('export script must compute SHA-256 (Get-FileHash) for exported files');
  if (!/MANIFEST\.sha256\.json/i.test(text)) p.push('export script must write MANIFEST.sha256.json');
  if (!/SecretPatterns|secret.?pattern/i.test(text)) p.push('export script must apply secret-pattern scanning before export');
  if (!/ReparsePoint|symlink/i.test(text)) p.push('export script must fail-closed on symlink/reparse-point entries');
  if (!/FAIL-CLOSED/i.test(text)) p.push('export script must fail-closed on violations');
  if (!/AllowedExtensions[^\n]*\.sha256/i.test(text)) p.push('export script must allow the installed-policy.sha256 evidence emitted by inside-sandbox-setup.ps1');

  // Task 14B regresyon kilidi: Get-ChildItem -Recurse -File bir junction/symlink
  // dizinin ICERIGINE inmez (gercek PowerShell davranisi, Task 14B'de bir test
  // kosusuyla kanitlandi); bu nedenle dizin seviyesinde AYRI bir tarama olmadan
  // junction altindaki dosyalar hic goruntlenmez ve sessizce kabul edilir.
  if (!text.includes('Get-ChildItem -LiteralPath $ResolvedEvidenceDir -Recurse -Directory -Force')) {
    p.push('export script must separately enumerate directories (not just files) to detect a reparse-point/junction directory whose contents Get-ChildItem -Recurse -File never descends into (Task 14B regression)');
  }

  // Task 14 / bolum A hardening checks.
  if (!text.includes('IsPathRooted')) p.push('export script must reject a rooted RunId (IsPathRooted check missing)');
  if (!text.includes("'^[A-Za-z]:'")) p.push('export script must reject a drive-qualified RunId');
  if (!text.includes('[\\*\\?]')) p.push('export script must reject wildcard characters in RunId');
  if (!text.includes("$Id -match '[\\\\/]'")) p.push('export script must reject path separators in RunId');
  if (!text.includes('$Id -eq "."') || !text.includes('$Id -eq ".."')) p.push("export script must reject '.' / '..' as RunId");

  const idxPreflightGate = text.indexOf('preflightErrors.Count -gt 0');
  const idxRunExportDirCreate = text.indexOf('New-Item -ItemType Directory -Path $ResolvedRunExportDir');
  if (idxPreflightGate < 0) p.push('export script must gate on collected preflight errors before any export file is created');
  if (idxRunExportDirCreate < 0) p.push('export script must explicitly create the run export directory (not implicitly)');
  if (idxPreflightGate >= 0 && idxRunExportDirCreate >= 0 && idxPreflightGate > idxRunExportDirCreate) {
    p.push('export script must run its FAZ 1 preflight gate BEFORE creating the run export directory (two-phase requirement)');
  }

  if (!text.includes('seenTargets') || !/path collision/i.test(text)) p.push('export script must detect path collisions between two sources resolving to the same target');

  const idxManifestWrite = text.indexOf('Set-Content -LiteralPath $manifestPath');
  const idxCompletionWrite = text.indexOf('Set-Content -LiteralPath $completionPath');
  const idxHashEquality = text.indexOf('srcHash -ne $dstHash');
  if (idxManifestWrite < 0 || idxCompletionWrite < 0) p.push('export script must write both MANIFEST.sha256.json and EXPORT.COMPLETE.json');
  if (idxHashEquality < 0) p.push('export script must verify source/destination SHA-256 equality after each copy');
  if (idxHashEquality >= 0 && idxManifestWrite >= 0 && idxHashEquality > idxManifestWrite) p.push('export script must verify hash equality BEFORE writing the manifest');
  if (idxManifestWrite >= 0 && idxCompletionWrite >= 0 && idxManifestWrite > idxCompletionWrite) p.push('export script must write the manifest BEFORE the completion marker');

  // FAZ 1 preflight has its own small try/catch (per-file read error handling);
  // the FAZ 2 try/catch that actually performs the copy+manifest+marker is the
  // LAST '} catch {' in the file, so lastIndexOf (not indexOf) must be used
  // here or this would inspect the wrong (earlier, unrelated) catch block.
  const catchIdx = text.lastIndexOf('} catch {');
  const catchBlock = catchIdx >= 0 ? text.slice(catchIdx) : '';
  if (/EXPORT\.COMPLETE/.test(catchBlock)) p.push('export script must never create a completion marker inside its error/catch path');
  if (/tamamlandi/i.test(catchBlock)) p.push('export script must never emit a success message inside its error/catch path');

  return p;
}
// Task 14B / bolum 2: export-manifest.test.ps1'in var oldugunu ve uretim
// yollarini (C:\export, C:\evidence) kullanmadigini statik olarak dogrular.
export function checkExportTestFilePresent(haveRelPaths) {
  const need = 'sandbox/export-manifest.test.ps1';
  return haveRelPaths.includes(need) ? [] : [`${need}: missing (Task 14B bolum 2 gereksinimi)`];
}
export function checkExportTestFile(text) {
  const p = [];
  if (!/\$tmpRoot\s*=\s*\[System\.IO\.Path\]::GetFullPath\(\$env:TEMP\)/.test(text)) {
    p.push('export-manifest.test.ps1 must root its own run directory under the system temp root ($env:TEMP)');
  }
  if (/-EvidenceDir\s+["']?C:\\(evidence|export)\b/i.test(text) || /-ExportRoot\s+["']?C:\\(evidence|export)\b/i.test(text)) {
    p.push('export-manifest.test.ps1 must never pass the real C:\\evidence or C:\\export production paths to export-manifest.ps1');
  }
  if (!text.includes('passCount') || !text.includes('failCount') || !text.includes('skipCount')) {
    p.push('export-manifest.test.ps1 must track explicit PASS/FAIL/SKIP counts');
  }
  if (!/exit 1/.test(text) || !/exit 0/.test(text)) {
    p.push('export-manifest.test.ps1 must produce an explicit non-zero exit code on failure and zero on success');
  }
  const realpathIdx = text.indexOf('$resolvedRunRoot = [System.IO.Path]::GetFullPath($RunRoot)');
  const removeIdx = text.indexOf('Remove-Item -LiteralPath $resolvedRunRoot -Recurse -Force');
  if (realpathIdx < 0 || removeIdx < 0 || realpathIdx > removeIdx) {
    p.push('export-manifest.test.ps1 cleanup must resolve the real path and verify containment under the temp root BEFORE deleting it');
  }
  if (!text.includes('containedUnderTmpRoot') || !text.includes('nameMatches')) {
    p.push("export-manifest.test.ps1 cleanup containment check must verify both: resolved path is under the temp root AND its basename matches this run's unique directory name");
  }
  if (!/CLEANUP BASARISIZ/.test(text)) p.push('export-manifest.test.ps1 must report (not hide) a cleanup failure');
  const requiredMarkers = [
    'gecerli export',
    'traversal RunId',
    'rooted/drive RunId',
    'secret dosyasi',
    'allowlist disi',
    'ayni RunId tekrari',
    'ExportRoot altinda kaliyor',
    'ayni basename farkli alt dizin',
    'reparse/symlink',
  ];
  for (const m of requiredMarkers) {
    if (!text.includes(m)) p.push(`export-manifest.test.ps1 missing required scenario coverage: ${m}`);
  }
  if (!text.includes('junctionSkipReason')) {
    p.push('export-manifest.test.ps1 reparse/symlink case must SKIP with a stated reason when the platform fixture cannot be safely created');
  }
  return p;
}
export function checkHostManagedHooks(text) {
  const p = [];
  for (const marker of ['ADMIN_REQUIRED', 'CLEAN_BASELINE_REQUIRED', 'SOURCE_HASH_MISMATCH', 'INSTALL_STATE_TARGET_NOT_ALLOWED', 'RESTORE_REFUSED_CHANGED_TARGET', 'ABSENCE_CHECK_FAILED']) {
    if (!text.includes(marker)) p.push(`host managed-hooks tool missing fail-closed marker: ${marker}`);
  }
  if (!text.includes("Get-FullPath 'C:\\Program Files'")) p.push('host managed-hooks tool must pin the production target root');
  if (!text.includes("Get-FullPath 'C:\\ProgramData\\7allab-k205c'")) p.push('host managed-hooks tool must pin the production state root');
  if (/Remove-Item[^\n]*-Recurse/i.test(text)) p.push('host managed-hooks tool must not recursively delete production targets');
  if (!text.includes('shortcut: only a clean-baseline pilot is supported')) p.push('host managed-hooks clean-baseline limitation must stay explicit');
  return p;
}
export function checkHostManagedHooksTest(text) {
  const p = [];
  for (const marker of ['unknown/existing target is rejected', 'RestoreGood rejects a state target outside canonical target directories', 'RestoreGood refuses a changed target', 'absence verification passes after RestoreGood']) {
    if (!text.includes(marker)) p.push(`host managed-hooks test missing scenario: ${marker}`);
  }
  if (!text.includes("[IO.Path]::GetFullPath($env:TEMP)")) p.push('host managed-hooks test must use the system temp root');
  if (!text.includes('CLEANUP_CONTAINMENT_FAILED')) p.push('host managed-hooks test must fail closed on cleanup containment');
  return p;
}
export function checkHostInstallManifestTemplate(x) {
  const p = [];
  const files = Array.isArray(x?.files) ? x.files : [];
  if (x?.schema !== '7allab-k205c-host-install/0.1') p.push('host install manifest template schema invalid');
  if (files.filter((f) => f.target === 'managed-settings.json').length !== 1) p.push('host install manifest template requires exactly one managed settings target');
  if (!files.some((f) => /^security\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(f.target))) p.push('host install manifest template requires a security target');
  if (!files.length || files.some((f) => f.sha256 !== '0'.repeat(64))) p.push('host install manifest template must remain inert with zero hashes');
  return p;
}
export function checkHostInstallManifest(x, sourceHashes) {
  const p = [];
  const files = Array.isArray(x?.files) ? x.files : [];
  if (x?.schema !== '7allab-k205c-host-install/0.1') p.push('host install manifest schema invalid');
  if (files.filter((f) => f.target === 'managed-settings.json').length !== 1) p.push('host install manifest requires exactly one managed settings target');
  if (files.filter((f) => /^security\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(f.target)).length < 1) p.push('host install manifest requires a security target');
  for (const f of files) {
    if (f.target !== 'managed-settings.json' && !/^security\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(f.target)) p.push(`host install manifest target not allowed: ${f.target}`);
    if (!sourceHashes[f.source] || sourceHashes[f.source].toUpperCase() !== f.sha256) p.push(`host install manifest source hash mismatch: ${f.source}`);
  }
  return p;
}
export function checkHostManagedSettings(x) {
  const p = [];
  const events = ['PreToolUse', 'PermissionRequest'];
  if (Object.keys(x?.hooks ?? {}).sort().join(',') !== events.sort().join(',')) p.push('host managed settings events must be exactly PreToolUse and PermissionRequest');
  for (const event of events) {
    const group = x?.hooks?.[event]?.[0];
    const hook = group?.hooks?.[0];
    const args = ['C:\\Program Files\\7allab-security\\identity-gate.mjs', 'C:\\Program Files\\7allab-security\\guard.mjs', 'C:\\Program Files\\7allab-security\\decision-gate-event-adapter.mjs', '--event', event];
    if (x?.hooks?.[event]?.length !== 1 || group?.matcher !== '*' || group?.hooks?.length !== 1 || hook?.type !== 'command' || hook?.command !== 'C:\\Program Files\\nodejs\\node.exe' || JSON.stringify(hook?.args) !== JSON.stringify(args) || hook?.timeout !== 10 || hook?.onFailure !== 'block') p.push(`host managed settings ${event} contract invalid`);
  }
  return p;
}
export function checkPluginLayout(haveRelPaths) {
  const need = ['plugins/o3-marker-plugin/.claude-plugin/plugin.json', 'plugins/o3-marker-plugin/hooks/hooks.json', 'plugins/o3-marker-plugin/scripts/marker.mjs'];
  return need.filter((n) => !haveRelPaths.includes(n)).map((n) => `${n}: missing (official layout per code.claude.com/docs/en/plugins/create.md)`);
}
export function checkO3HookEvent(text) {
  try {
    const hooks = JSON.parse(text).hooks ?? {};
    const p = Array.isArray(hooks.SessionStart) && !hooks.PreToolUse ? [] : ['O3 fixture must use SessionStart so managed PreToolUse denial cannot short-circuit the baseline marker'];
    const command = hooks.SessionStart?.[0]?.hooks?.[0]?.command;
    if (command !== 'C:\\payload\\bin\\node.exe') p.push('O3 fixture must use the pinned payload node.exe; clean sandbox PATH has no node executable');
    return p;
  } catch { return ['O3 hooks.json is not valid JSON']; }
}
export function checkMarkerFailClosed(text) {
  const p = [];
  const catchIdx = text.indexOf('} catch (err) {');
  const catchBlock = catchIdx >= 0 ? text.slice(catchIdx) : '';
  if (!catchBlock) return ['marker script has no catch block to inspect'];
  if (/process\.exit\(0\)/.test(catchBlock)) p.push('marker script must not exit 0 from its catch block (a marker-write failure must not look like success)');
  if (!/process\.exit\(1\)/.test(catchBlock)) p.push('marker script must exit non-zero when marker write fails');
  return p;
}
export function checkO6Lock(observations) {
  const p = [];
  const o6 = (observations ?? []).find((o) => o.id === 'O6');
  if (!o6) return p;
  if (!['NOT_TESTED', 'DIAGNOSTIC_ONLY'].includes(o6.status)) p.push('O6 status must stay NOT_TESTED or DIAGNOSTIC_ONLY; it can never be PASS/FAIL or an acceptance criterion');
  if (o6.max_claim !== 'NONE') p.push('O6 max_claim must stay NONE');
  return p;
}
export function checkRuntimePinningContract(pmObj, runtimeDocText) {
  const p = [];
  for (const entry of pmObj.owner_must_supply_not_in_repo ?? []) {
    if ((entry.to === 'bin/node.exe' || entry.to === 'bin/claude.exe') && !entry.runtime_pinning_contract) p.push(`${entry.to}: missing runtime_pinning_contract reference`);
  }
  for (const f of ['source_path', 'product_version', 'file_size_bytes', 'sha256', 'authenticode_signature', 'authenticode_signer', 'prerun_payload_hash_equality']) {
    if (!runtimeDocText.includes(f)) p.push(`RUNTIME-PINNING.md missing required field: ${f}`);
  }
  if (!runtimeDocText.includes('2.1.295')) p.push('RUNTIME-PINNING.md missing minimum version requirement 2.1.295');
  return p;
}
export function checkPolicy(name, text) {
  const p = [];
  let j; try { j = JSON.parse(text); } catch { return ['not JSON']; }
  // nested shape taken from the schema embedded in the installed claude.exe 2.1.312 (read-only string inspection, behaviour NOT run):
  // settings.hooks.<Event>[] = { matcher?: string, hooks: [ { type:'command', command, args?, timeout?(s), onFailure?('continue'|'block') } ] }
  const EVENTS = ['PreToolUse', 'PermissionRequest'], HOOK_KEYS = ['type', 'command', 'args', 'timeout', 'onFailure'];
  for (const k of Object.keys(j)) if (!['hooks', 'allowManagedHooksOnly'].includes(k)) p.push(`unexpected top-level key ${k}`);
  if (Object.hasOwn(j, 'allowManagedHooksOnly') && j.allowManagedHooksOnly !== true) p.push('allowManagedHooksOnly must be boolean true when present');
  if (!j.hooks || typeof j.hooks !== 'object' || Array.isArray(j.hooks)) return [...p, 'hooks must be an object keyed by event'];
  const hooks = [];
  for (const [ev, groups] of Object.entries(j.hooks)) {
    if (!EVENTS.includes(ev)) p.push(`unexpected event ${ev}`);
    if (!Array.isArray(groups) || groups.length === 0) { p.push(`${ev}: must be a non-empty array of matcher groups`); continue; }
    for (const g of groups) {
      if (g.matcher !== undefined && typeof g.matcher !== 'string') p.push(`${ev}: matcher must be a string`);
      if (!Array.isArray(g.hooks) || g.hooks.length === 0) { p.push(`${ev}: group.hooks must be a non-empty array (hooks nested inside the matcher group)`); continue; }
      for (const h of g.hooks) {
        hooks.push(h);
        for (const k of Object.keys(h)) if (!HOOK_KEYS.includes(k)) p.push(`${ev}: unexpected hook key ${k}`);
        if (h.type !== 'command') p.push(`${ev}: hook type must be command`);
        if (typeof h.command !== 'string' || !h.command.startsWith(`C:${BS}payload${BS}`) || h.command.includes('"')) p.push(`${ev}: command must be a bare C:\\payload path (exec form)`);
        if (!Array.isArray(h.args) || h.args.length === 0 || h.args.some((a) => typeof a !== 'string')) p.push(`${ev}: args must be a non-empty string array (a quoted-string command is not a program under PowerShell)`);
        else if (h.args.some((a) => /^[A-Za-z]:/.test(a) && !a.startsWith(`C:${BS}payload${BS}`))) p.push(`${ev}: arg path outside C:\\payload`);
        if (!Number.isInteger(h.timeout) || h.timeout < 1 || h.timeout > 30) p.push(`${ev}: timeout (seconds) missing/out of range`);
        if (h.onFailure !== undefined && !['continue', 'block'].includes(h.onFailure)) p.push(`${ev}: onFailure must be continue|block`);
      }
    }
  }
  if (hooks.length === 0) p.push('no hooks');
  if (name.startsWith('p1-') || name.startsWith('p2-')) {
    const pr = (j.hooks.PermissionRequest ?? []).flatMap((g) => g.hooks ?? []);
    if (!pr.some((h) => h.args?.includes('PermissionRequest'))) p.push('p1/p2 must register the guard for PermissionRequest');
  }
  const hasMo = Object.hasOwn(j, 'allowManagedHooksOnly');
  if (hasMo !== name.startsWith('p2-')) p.push('allowManagedHooksOnly must appear only in p2');
  const ofCount = hooks.filter((h) => h.onFailure === 'block').length;
  const wantOf = name.startsWith('p6-') ? 0 : name === 'p2-pretooluse-guard-allow-control.test.json' ? 3 : name.startsWith('p1-') || name.startsWith('p2-') ? 2 : hooks.length;
  if (ofCount !== wantOf) p.push(`onFailure:block count ${ofCount}, expected ${wantOf}`);
  return p;
}
export function checkPs1(x) {
  const g = x.indexOf('WDAGUtilityAccount'), w = Math.min(...['Copy-Item', 'New-Item', 'Set-Content'].map((k) => (x.indexOf(k) < 0 ? Infinity : x.indexOf(k))));
  const m = x.indexOf('Win32_ComputerSystem');
  return g < 0 || g > w || m < 0 || m > w ? ['sandbox-only refusals (account + Hyper-V guest) must precede every write'] : [];
}
export function checkSecrets(text) {
  return [/sk-ant-/, /ANTHROPIC_(API_KEY|AUTH_TOKEN)\s*[=:]/, /Bearer\s+[A-Za-z0-9._-]{12,}/, /\.credentials/i, /oauth.?token/i, /C:[\\/]+Users[\\/]+crypt/i, /C:[\\/]+Projeler/i].filter((r) => r.test(text)).map((r) => `forbidden pattern ${r}`);
}
export function checkAuthProvenance(t, s, template = false) {
  const p = [], a = t.auth_provenance;
  if (!s.auth_mode_enum.includes(t.auth_mode)) p.push('auth_mode enum violation');
  if (!a || typeof a !== 'object' || Array.isArray(a)) return [...p, 'auth_provenance missing/not an object'];
  for (const k of s.auth_provenance_required) if (!(k in a)) p.push(`auth_provenance.${k} missing`);
  if (!s.auth_credential_kind_enum.includes(a.credential_kind)) p.push('auth_provenance.credential_kind enum violation');
  if (!s.auth_endpoint_kind_enum.includes(a.endpoint_kind)) p.push('auth_provenance.endpoint_kind enum violation');
  if (!s.auth_provenance_source_enum.includes(a.source)) p.push('auth_provenance.source enum violation');
  const combinations = {
    NONE: ['NONE', 'NONE'],
    MOCK_ENDPOINT: ['SYNTHETIC_SENTINEL', 'LOOPBACK_MOCK'],
    REAL: ['REAL_CREDENTIAL', 'REAL_SERVICE'],
  };
  const expected = combinations[t.auth_mode];
  if (expected && (a.credential_kind !== expected[0] || a.endpoint_kind !== expected[1])) {
    p.push(`auth_mode ${t.auth_mode} conflicts with independently recorded credential_kind/endpoint_kind`);
  }
  if (template) {
    if (a.source !== 'TEMPLATE_DEFAULT' || a.evidence_sha256 !== null) p.push('template auth provenance must remain an unevidenced default');
  } else {
    if (a.source === 'TEMPLATE_DEFAULT') p.push('run auth provenance cannot use TEMPLATE_DEFAULT');
    if (typeof a.evidence_sha256 !== 'string' || !/^[A-Fa-f0-9]{64}$/.test(a.evidence_sha256)) p.push('run auth provenance requires an evidence SHA-256');
  }
  return p;
}
export function checkRunEvidence(t, s) {
  const p = [];
  for (const k of s.run_required) if (!(k in t)) p.push(`run key ${k} missing`);
  p.push(...checkAuthProvenance(t, s));
  p.push(...checkO6Lock(t.observations));
  return p;
}
export function checkEvidenceTemplate(t, s) {
  const p = [];
  for (const k of s.run_required) if (!(k in t)) p.push(`run key ${k} missing`);
  if (t.auth_mode !== 'NONE') p.push('template auth_mode must start as NONE');
  p.push(...checkAuthProvenance(t, s, true));
  if (!Array.isArray(t.observations) || t.observations.map((o) => o.id).join() !== 'O1,O2,O3,O4,O5,O6,O7') p.push('observations must be O1..O7');
  for (const o of t.observations ?? []) {
    for (const k of s.observation_required) if (!(k in o)) p.push(`${o.id}: ${k} missing`);
    if (o.status !== 'NOT_TESTED' || o.observed !== null || o.evidence_sha256 !== null) p.push(`${o.id}: template must be empty/NOT_TESTED`);
    if (!s.max_claim_enum.includes(o.max_claim) || !s.evidence_kind_enum.includes(o.evidence_kind)) p.push(`${o.id}: enum violation`);
  }
  const o1 = t.observations?.find((o) => o.id === 'O1');
  if (o1 && o1.max_claim !== 'LOADED') p.push('O1 may claim at most LOADED');
  p.push(...checkO6Lock(t.observations));
  return p;
}
export function checkFixtures(f) {
  const p = [], ids = new Set();
  for (const e of f.events ?? []) {
    if (ids.has(e.id)) p.push(`duplicate id ${e.id}`); ids.add(e.id);
    if ((e.raw === null) === (e.event === null)) p.push(`${e.id}: exactly one of raw/event`);
    if (!e.expect || !Number.isInteger(e.expect.exit)) p.push(`${e.id}: expect.exit missing`);
    if (e.event && !JSON.stringify(e.event).includes('{{PROJECT}}') && e.event.tool_name !== 'Read') p.push(`${e.id}: no {{PROJECT}} placeholder`);
  }
  for (const t of ['Write', 'Edit', 'Bash', 'PowerShell']) if (!(f.events ?? []).some((e) => e.event?.tool_name === t && e.expect.exit === 2)) p.push(`no blocked fixture for ${t}`);
  return p;
}

// ---- run
const results = [];
const rec = (name, problems) => results.push({ name, ok: problems.length === 0, problems });
const read = (p) => readFileSync(join(HERE, p), 'utf8');

function selfTest() {
  const wsb = read('sandbox/pilot.wsb.draft.xml');
  const cases = [
    ['wsb: network enabled', checkWsb(wsb.replace('<Networking>Disable', '<Networking>Enable'))],
    ['wsb: clipboard enabled', checkWsb(wsb.replace('<ClipboardRedirection>Disable', '<ClipboardRedirection>Enable'))],
    ['wsb: writable mapping', checkWsb(wsb.replace('<ReadOnly>true', '<ReadOnly>false'))],
    ['wsb: third mapping added', checkWsb(wsb.replace('</MappedFolders>', '<MappedFolder><HostFolder>x</HostFolder><SandboxFolder>C:' + BS + 'extra</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder></MappedFolders>'))],
    ['wsb: export mapped read-only (cannot receive evidence)', checkWsb(wsb.replace('<ReadOnly>false</ReadOnly>', '<ReadOnly>true</ReadOnly>'))],
    ['wsb: export and payload same host placeholder', checkWsb(wsb.replaceAll('__HOST_EXPORT_DIR_PLACEHOLDER__', '__HOST_PAYLOAD_DIR__'))],
    ['wsb: real host path', checkWsb(wsb.replaceAll('__HOST_PAYLOAD_DIR__', 'C:' + BS + 'Users' + BS + 'x'))],
    ['mock: binds beyond loopback', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replace('"127.0.0.1"', '"0.0.0.0"'))],
    ['mock: credential header not redacted', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('REDACT_HEADERS', 'XHEADERS'))],
    ['mock: mislabeled as LIVE_REAL_MODEL', checkMockEndpoint(read('mocks/mock-endpoint.mjs') + '\nconst x = { evidence_kind: "LIVE_REAL_MODEL" };')],
    ['mock: real-looking secret present', checkMockEndpoint(read('mocks/mock-endpoint.mjs') + '\n// sk-ant-fake0000000000000000')],
    ['export script: deletes prior export dir', checkExportScript(read('sandbox/export-manifest.ps1') + '\nRemove-Item $RunExportDir -Recurse -Force')],
    ['export script: manifest hashing removed', checkExportScript(read('sandbox/export-manifest.ps1').replaceAll('Get-FileHash', 'XGetHash'))],
    ['export script: secret scan removed', checkExportScript(read('sandbox/export-manifest.ps1').replaceAll('SecretPatterns', 'XPatterns').replaceAll('ContainsSecretPattern', 'XContains'))],
    ['export script: RunId traversal check removed', checkExportScript(read('sandbox/export-manifest.ps1').replace('if ($Id -match \'[\\\\/]\') { return $false }', ''))],
    ['export script: rooted/drive RunId check removed', checkExportScript(read('sandbox/export-manifest.ps1').replace("if ($Id -match '^[A-Za-z]:') { return $false }", ''))],
    ['export script: wildcard RunId check removed', checkExportScript(read('sandbox/export-manifest.ps1').replace("if ($Id -match '[\\*\\?]') { return $false }", ''))],
    ['export script: reparse-point check removed', checkExportScript(read('sandbox/export-manifest.ps1').replaceAll('ReparsePoint', 'XRPCHECK').replaceAll('symlink', 'XSYMCHECK'))],
    ['export script: required .sha256 evidence extension removed', checkExportScript(read('sandbox/export-manifest.ps1').replace(', ".sha256"', ''))],
    ['export script: collision detection removed', checkExportScript(read('sandbox/export-manifest.ps1').replaceAll('seenTargets', 'xTargets').replaceAll('path collision', 'x collision'))],
    ['export script: preflight gate placed after dir creation', checkExportScript((() => {
      const t = read('sandbox/export-manifest.ps1');
      const gateStart = t.indexOf('if ($preflightErrors.Count -gt 0) {');
      const endMarker = 'exit 1\n}';
      const gateEnd = t.indexOf(endMarker, gateStart) + endMarker.length;
      const gateBlock = t.slice(gateStart, gateEnd);
      const withoutGate = t.slice(0, gateStart) + t.slice(gateEnd);
      const createMarker = 'New-Item -ItemType Directory -Path $ResolvedRunExportDir -Force | Out-Null';
      const createIdx = withoutGate.indexOf(createMarker);
      const insertAt = createIdx + createMarker.length;
      return withoutGate.slice(0, insertAt) + '\n  ' + gateBlock + withoutGate.slice(insertAt);
    })())],
    ['export script: completion marker before manifest', checkExportScript((() => { const t = read('sandbox/export-manifest.ps1'); const a = t.indexOf('$manifestPath = Join-Path'); const b = t.indexOf('Write-Output "Export tamamlandi'); return t.slice(0, a) + t.slice(a, b).split('\n').reverse().join('\n') + t.slice(b); })())],
    ['export script: hash-equality check removed (manifest trusted blindly)', checkExportScript(read('sandbox/export-manifest.ps1').replaceAll('srcHash -ne $dstHash', 'false'))],
    ['export script: success message inside catch block', checkExportScript(read('sandbox/export-manifest.ps1').replace('Write-Error "FAIL-CLOSED: export sirasinda hata:', 'Write-Output "Export tamamlandi (hata sirasinda da)"; Write-Error "FAIL-CLOSED: export sirasinda hata:'))],
    ['export script: directory-level reparse scan removed (Task 14B junction blind-spot regression)', checkExportScript(read('sandbox/export-manifest.ps1').replace('$sourceDirs = @(Get-ChildItem -LiteralPath $ResolvedEvidenceDir -Recurse -Directory -Force -ErrorAction SilentlyContinue)', '$sourceDirs = @()'))],
    ['export test file: missing', checkExportTestFilePresent(['sandbox/export-manifest.ps1'])],
    ['export test file: hardcodes real production paths', checkExportTestFile(read('sandbox/export-manifest.test.ps1').replace('-EvidenceDir $Evidence -ExportRoot $ExportRoot', '-EvidenceDir "C:\\evidence" -ExportRoot "C:\\export"'))],
    ['export test file: PASS/FAIL/SKIP counters removed', checkExportTestFile(read('sandbox/export-manifest.test.ps1').replaceAll('passCount', 'xPassCount').replaceAll('failCount', 'xFailCount').replaceAll('skipCount', 'xSkipCount'))],
    ['export test file: cleanup containment check removed', checkExportTestFile(read('sandbox/export-manifest.test.ps1').replaceAll('containedUnderTmpRoot', 'xContained').replaceAll('nameMatches', 'xNameMatches'))],
    ['export test file: cleanup failure hidden', checkExportTestFile(read('sandbox/export-manifest.test.ps1').replace('CLEANUP BASARISIZ OLDU; gizlenmiyor. Elle temizlik gerekebilir: $RunRoot', ''))],
    ['export test file: reparse/symlink SKIP-with-reason removed', checkExportTestFile(read('sandbox/export-manifest.test.ps1').replaceAll('junctionSkipReason', 'xJunctionSkipReason'))],
    ['export test file: scenario coverage marker missing (secret case renamed away)', checkExportTestFile(read('sandbox/export-manifest.test.ps1').replaceAll('secret dosyasi', 'xsecret-case'))],
    ['host managed-hooks: clean-baseline guard removed', checkHostManagedHooks(read('host/managed-hooks.ps1').replaceAll('CLEAN_BASELINE_REQUIRED', 'xCleanBaseline'))],
    ['host managed-hooks: recursive production deletion added', checkHostManagedHooks(read('host/managed-hooks.ps1') + '\nRemove-Item $TargetRoot -Recurse -Force')],
    ['host managed-hooks test: tamper-safe restore scenario removed', checkHostManagedHooksTest(read('host/managed-hooks.test.ps1').replaceAll('RestoreGood refuses a changed target', 'xRestoreScenario'))],
    ['host install manifest template: executable hash inserted', checkHostInstallManifestTemplate((() => { const t = JSON.parse(read('host/install-manifest.template.json')); t.files[0].sha256 = 'A'.repeat(64); return t; })())],
    ['host install manifest: source hash changed', checkHostInstallManifest((() => { const t = JSON.parse(read('host/install-manifest.json')); t.files[0].sha256 = 'A'.repeat(64); return t; })(), Object.fromEntries(JSON.parse(read('host/install-manifest.json')).files.map((f) => [f.source, f.sha256])))],
    ['host managed settings: onFailure removed', checkHostManagedSettings((() => { const t = JSON.parse(read('host/managed-settings.json')); delete t.hooks.PreToolUse[0].hooks[0].onFailure; return t; })())],
    ['mock: startServer no longer defaults evidenceDir/logFile to production constants', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('evidenceDir = DEFAULT_EVIDENCE_DIR, logFile = DEFAULT_LOG_FILE', 'evidenceDir, logFile'))],
    ['mock: appendLogOrThrow no longer takes logFile as a parameter', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('function appendLogOrThrow(logFile, entry)', 'function appendLogOrThrow(entry)'))],
    ['mock: handleRequest no longer takes logFile as a parameter', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('function handleRequest(scenario, logFile, req, res)', 'function handleRequest(scenario, req, res)'))],
    ['mock: self-test no longer uses its own mkdtempSync temp dir', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replaceAll('mkdtempSync', 'xMkdtemp'))],
    ['mock: self-test temp dir no longer rooted under os.tmpdir()', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('os.tmpdir()', 'os.homedir()'))],
    ['mock: self-test calls startServer without its own evidenceDir/logFile (would hit production default)', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('startServer({ port: 0, scenario: "Write", evidenceDir: selfTestDir, logFile: selfTestLogFile })', 'startServer({ port: 0, scenario: "Write" })'))],
    ['mock: before/after evidence-dir snapshot comparison removed', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replaceAll('snapshotDirReadOnly', 'xSnapshotDir').replaceAll('snapshotsEqual', 'xSnapshotsEqual').replaceAll('evidenceUntouched', 'xEvidenceUntouched'))],
    ['mock: cleanup containment check removed', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replaceAll('containedUnderTmpRoot', 'xContained').replaceAll('nameMatches', 'xNameMatches'))],
    ['mock: self-test cleanup failure hidden', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('CLEANUP BASARISIZ OLDU; gizlenmiyor. Elle temizlik gerekebilir: ${selfTestDir}', ''))],
    ['mock: self-test exit code no longer reflects evidence-untouched/cleanup failure', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs').replace('process.exitCode = failed || !evidenceUntouched || !cleanupOk ? 1 : 0;', 'process.exitCode = failed ? 1 : 0;'))],
    ['plugin layout: manifest removed from official location', checkPluginLayout(['plugins/o3-marker-plugin/hooks/hooks.json', 'plugins/o3-marker-plugin/scripts/marker.mjs'])],
    ['plugin layout: hooks.json removed from official location', checkPluginLayout(['plugins/o3-marker-plugin/.claude-plugin/plugin.json', 'plugins/o3-marker-plugin/scripts/marker.mjs'])],
    ['plugin hook regressed to PreToolUse', checkO3HookEvent(read('plugins/o3-marker-plugin/hooks/hooks.json').replace('"SessionStart"', '"PreToolUse"'))],
    ['plugin hook regressed to PATH-dependent node', checkO3HookEvent(read('plugins/o3-marker-plugin/hooks/hooks.json').replace('C:\\\\payload\\\\bin\\\\node.exe', 'node'))],
    ['marker script: write failure hidden behind exit 0', checkMarkerFailClosed(read('plugins/o3-marker-plugin/scripts/marker.mjs').replace(/\} catch \(err\) \{([\s\S]*?)process\.exit\(1\);/, (m, inner) => `} catch (err) {${inner}process.exit(0);`))],
    ['mock: unlimited body (size limit removed)', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('MAX_BODY_BYTES', 'XBodyLimit'))],
    ['mock: method/path check removed', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('EXPECTED_METHOD', 'XMethod').replaceAll('EXPECTED_PATH', 'XPath'))],
    ['mock: beta query allowlist removed', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('EXPECTED_QUERIES', 'XQueries').replace('?beta=true', '?anything=true'))],
    ['mock: rejected method/path metadata logging removed', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replace('rejected: "unexpected_method_or_path"', 'rejected: "unknown"'))],
    ['mock: auth sentinel check removed', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('SYNTHETIC_AUTH_SENTINEL', 'XSentinel'))],
    ['mock: non-Anthropic response shape', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('buildMessagesApiResponse', 'xBuildResponse').replaceAll('stop_reason', 'xStopReason').replaceAll('tool_use', 'xToolUse'))],
    ['mock: terminal response removed', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replaceAll('buildTerminalResponse', 'xTerminal').replaceAll('hasToolResult', 'xToolResult').replaceAll('end_turn', 'xEnd'))],
    ['mock: writability check moved after listen()', checkMockEndpoint(read('mocks/mock-endpoint.mjs').replace(/[ \t]*checkEvidenceWritable\(evidenceDir, logFile\);\r?\n/, '').replace('server.listen(port, MOCK_BIND_ADDRESS, () => {', 'server.listen(port, MOCK_BIND_ADDRESS, () => {\n    checkEvidenceWritable(evidenceDir, logFile);'))],
    ['O6: becomes PASS', checkO6Lock([{ id: 'O6', status: 'PASS', max_claim: 'NONE' }])],
    ['O6: gains enforcement max_claim', checkO6Lock([{ id: 'O6', status: 'NOT_TESTED', max_claim: 'ENFORCEMENT_LIVE' }])],
    ['runtime pinning: required field missing', checkRuntimePinningContract(JSON.parse(read('payload-manifest.json')), read('RUNTIME-PINNING.md').replaceAll('authenticode_signer', 'xsigner'))],
    ['runtime pinning: owner_must_supply entry missing contract ref', checkRuntimePinningContract({ owner_must_supply_not_in_repo: [{ to: 'bin/claude.exe' }] }, read('RUNTIME-PINNING.md'))],
    ['policy: managed-only leaked into p1', checkPolicy('p1-baseline.test.json', JSON.stringify({ allowManagedHooksOnly: true, hooks: JSON.parse(read('policies/p1-baseline.test.json')).hooks }))],
    ['policy: control gained onFailure', checkPolicy('p6-control-error-without-onfailure.test.json', read('policies/p4-onfailure-error.test.json'))],
    ['policy: command outside payload', checkPolicy('p4-onfailure-error.test.json', read('policies/p4-onfailure-error.test.json').replaceAll('payload', 'elsewhere'))],
    ['policy: legacy quoted command, no args', checkPolicy('p4-onfailure-error.test.json', JSON.stringify({ hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: '"C:' + BS + 'payload' + BS + 'bin' + BS + 'node.exe" x', timeout: 5, onFailure: 'block' }] }] } }))],
    ['policy: hook not nested in matcher group', checkPolicy('p4-onfailure-error.test.json', JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'C:' + BS + 'payload' + BS + 'x', args: ['a'], timeout: 5 }] } }))],
    ['policy: onFailure outside enum', checkPolicy('p4-onfailure-error.test.json', read('policies/p4-onfailure-error.test.json').replace('"block"', '"deny"'))],
    ['policy: p1 lost PermissionRequest', checkPolicy('p1-baseline.test.json', JSON.stringify({ hooks: { PreToolUse: JSON.parse(read('policies/p1-baseline.test.json')).hooks.PreToolUse } }))],
    ['ps1: refusal removed', checkPs1(read('sandbox/inside-sandbox-setup.ps1').replace(/if \(\$env:USERNAME[^\n]*\n/, ''))],
    ['secrets: api key', checkSecrets('ANTHROPIC_API_KEY=abc')],
    ['secrets: real user path', checkSecrets('C:' + BS + 'Users' + BS + 'crypt' + BS + '.claude')],
    ['evidence: pre-filled PASS', checkEvidenceTemplate(JSON.parse(read('evidence-template.json').replace('"status": "NOT_TESTED"', '"status": "PASS"')), JSON.parse(read('evidence-schema.json')))],
    ['evidence: O1 claims enforcement', checkEvidenceTemplate(JSON.parse(read('evidence-template.json').replace('"max_claim": "LOADED"', '"max_claim": "ENFORCEMENT_LIVE"')), JSON.parse(read('evidence-schema.json')))],
    ['evidence: auth provenance removed', checkEvidenceTemplate((() => { const t = JSON.parse(read('evidence-template.json')); delete t.auth_provenance; return t; })(), JSON.parse(read('evidence-schema.json')))],
    ['run evidence: legacy result missing auth_mode/provenance', checkRunEvidence((() => { const t = JSON.parse(read('evidence-template.json')); delete t.auth_mode; delete t.auth_provenance; return t; })(), JSON.parse(read('evidence-schema.json')))],
    ['run evidence: MOCK_ENDPOINT inferred without matching auth provenance', checkRunEvidence((() => { const t = JSON.parse(read('evidence-template.json')); t.auth_mode = 'MOCK_ENDPOINT'; t.auth_provenance.source = 'RUNNER_ENVIRONMENT'; t.auth_provenance.evidence_sha256 = 'A'.repeat(64); return t; })(), JSON.parse(read('evidence-schema.json')))],
    ['fixtures: Bash fixture removed', checkFixtures({ events: JSON.parse(read('fixtures/events.json')).events.filter((e) => e.event?.tool_name !== 'Bash') })],
  ];
  for (const [n, probs] of cases) rec(`self-test rejects: ${n}`, probs.length > 0 ? [] : ['validator accepted bad input']);
}

const argv = process.argv.slice(2);
const files = walk(HERE).filter((p) => rel(p) !== 'MANIFEST.sha256.json').sort();

// integrity
const hashes = Object.fromEntries(files.map((p) => [rel(p), sha(readFileSync(p))]));
if (argv.includes('--write-manifest')) { writeFileSync(MANIFEST, JSON.stringify({ about: 'SHA-256 of every package file except this one. Integrity only; not a test result.', files: hashes }, null, 2) + '\n'); console.log('manifest written'); }
let man; try { man = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { man = null; }
if (!man) rec('manifest present', ['MANIFEST.sha256.json missing/unreadable']);
else {
  const bad = [];
  for (const [k, v] of Object.entries(hashes)) if (man.files[k] !== v) bad.push(`${k}: ${man.files[k] ? 'hash differs' : 'not in manifest'}`);
  for (const k of Object.keys(man.files)) if (!(k in hashes)) bad.push(`${k}: listed but missing`);
  rec(`package integrity (${files.length} files vs manifest)`, bad);
}

// syntax
const syn = [];
for (const p of files) {
  const r = rel(p);
  if (r.endsWith('.json')) { try { JSON.parse(readFileSync(p, 'utf8')); } catch (e) { syn.push(`${r}: ${e.message}`); } }
  else if (r.endsWith('.mjs')) { const c = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' }); if (c.status !== 0) syn.push(`${r}: ${c.stderr.split('\n')[0]}`); }
  else if (r.endsWith('.xml')) { const t = readFileSync(p, 'utf8'); const o = (t.match(/<([A-Za-z]+)>/g) ?? []).length, c = (t.match(/<\/[A-Za-z]+>/g) ?? []).length; if (o !== c) syn.push(`${r}: unbalanced tags ${o}/${c}`); }
  else if (r.endsWith('.ps1')) {
    const q = `$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${p}',[ref]$null,[ref]$e);if($e){$e|%{$_.Message};exit 1}`;
    const c = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', q], { encoding: 'utf8' });
    if (c.error) syn.push(`${r}: powershell unavailable (NOT CHECKED)`); else if (c.status !== 0) syn.push(`${r}: ${c.stdout.trim()}`);
  }
}
rec('syntax (json, mjs --check, xml tag balance, ps1 parse-only)', syn);

// content rules
rec('sandbox draft is closed-by-default (payload RO + export RW, Option A hazirligi)', checkWsb(read('sandbox/pilot.wsb.draft.xml')));
for (const p of files.filter((f) => rel(f).startsWith('policies/'))) rec(`policy ${rel(p)}`, checkPolicy(rel(p).split('/')[1], readFileSync(p, 'utf8')));
rec('setup script refuses outside sandbox before any write', checkPs1(read('sandbox/inside-sandbox-setup.ps1')));
rec('evidence template matches schema (incl. O6 structural lock)', checkEvidenceTemplate(JSON.parse(read('evidence-template.json')), JSON.parse(read('evidence-schema.json'))));
rec('fixtures well-formed, blocked tools covered', checkFixtures(JSON.parse(read('fixtures/events.json'))));
rec('no credential / real-host-path patterns in package', files.filter((p) => !rel(p).endsWith('check-package.mjs')).flatMap((p) => checkSecrets(readFileSync(p, 'utf8')).map((m) => `${rel(p)}: ${m}`)));
rec('mock endpoint fixture safety (loopback-only, no credentials, never LIVE_REAL_MODEL)', checkMockEndpoint(read('mocks/mock-endpoint.mjs')));
rec('export script safety (no prior-dir deletion, manifest+secret-scan present, fail-closed)', checkExportScript(read('sandbox/export-manifest.ps1')));
rec('export behavior test file present at official location (Task 14B bolum 2)', checkExportTestFilePresent(files.map(rel)));
rec('export behavior test file uses temp root only (no C:\\export/C:\\evidence), full PASS/FAIL/SKIP+exit code, safe cleanup', checkExportTestFile(read('sandbox/export-manifest.test.ps1')));
rec('host managed-hooks tool is clean-baseline, hash-bound, tamper-safe and non-recursive', checkHostManagedHooks(read('host/managed-hooks.ps1')));
rec('host managed-hooks behavior test covers existing-target, tamper and absence paths in temp only', checkHostManagedHooksTest(read('host/managed-hooks.test.ps1')));
rec('host install manifest template is structurally complete and inert', checkHostInstallManifestTemplate(JSON.parse(read('host/install-manifest.template.json'))));
const hostInstallManifest = JSON.parse(read('host/install-manifest.json'));
const hostSourceHashes = Object.fromEntries(hostInstallManifest.files.map((f) => [f.source, sha(readFileSync(join(ROOT, f.source)))]));
rec('host install manifest is target-constrained and source-hash-bound', checkHostInstallManifest(hostInstallManifest, hostSourceHashes));
rec('host managed settings pins the fail-closed production hook chain', checkHostManagedSettings(JSON.parse(read('host/managed-settings.json'))));
rec('mock endpoint self-test evidence-path isolation (Task 14B bolum 1: --self-test never touches C:\\evidence)', checkMockEndpointEvidenceIsolation(read('mocks/mock-endpoint.mjs')));
rec('runtime pinning contract fields present (node.exe/claude.exe)', checkRuntimePinningContract(JSON.parse(read('payload-manifest.json')), read('RUNTIME-PINNING.md')));
rec('O3 synthetic marker-plugin fixture present at official plugin layout', checkPluginLayout(files.map(rel)));
rec('O3 plugin marker uses SessionStart (not short-circuited by managed PreToolUse denial)', checkO3HookEvent(read('plugins/o3-marker-plugin/hooks/hooks.json')));
rec('O3 marker script fails closed on write error (no silent exit 0)', checkMarkerFailClosed(read('plugins/o3-marker-plugin/scripts/marker.mjs')));

// pinned existing sources (read-only hashing; they must be unchanged)
const pm = JSON.parse(read('payload-manifest.json'));
rec('pinned existing sources unchanged', pm.pinned_existing_sources.flatMap((s) => { const h = sha(readFileSync(join(ROOT, s.from))); return h === s.sha256 ? [] : [`${s.from}: ${h}`]; }));

selfTest();

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.problems.join('\n      ')}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} package checks passed (integrity+syntax only; NOT an enforcement result)`);
process.exitCode = failed ? 1 : 0;
