#!/usr/bin/env node
// K2-05-C R2-C2: bounded current-user `wsb list --raw` collector.
import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createReadStream, existsSync, lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PACKAGE = 'MicrosoftWindows.WindowsSandbox_0.8.114.0_x64__cw5n1h2txyewy';
const EXPECTED_VERSION = '0.8.114.0';
const EXPECTED_HASH = '4F9FE30377550174CDDA53FBA78D76F83692E0B10334D6C42E1AF3771A6BA07C';
const APPEXECLINK = '0x8000001b';
const MAX_STREAM_BYTES = 1024 * 1024;
const TIMEOUT_MS = 15000;
const TERMINATION_MS = 5000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const fail = (code) => { throw new Error(code); };
async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex').toUpperCase();
}

function safePath(path, { absent = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) {
      if (!absent || cursor !== full) fail('PATH_NOT_FOUND');
      continue;
    }
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
  }
  return full;
}

const samePath = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

export async function validateBinaryIdentity(identity, env = process.env, hashFileImpl = hashFile) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) fail('BINARY_IDENTITY_INVALID');
  const expectedAlias = join(env.LOCALAPPDATA ?? '', 'Microsoft', 'WindowsApps', 'wsb.exe');
  if (identity.packageFullName !== EXPECTED_PACKAGE || identity.version !== EXPECTED_VERSION ||
      identity.status !== 'Ok' || identity.signatureKind !== 'Store') fail('PACKAGE_IDENTITY_CHANGED');
  if (!samePath(identity.aliasPath, expectedAlias) || identity.aliasIsReparse !== true ||
      String(identity.aliasReparseTag).toLowerCase() !== APPEXECLINK ||
      !Array.isArray(identity.resolvedCommands) || identity.resolvedCommands.length !== 1 ||
      !samePath(identity.resolvedCommands[0], expectedAlias)) fail('ALIAS_IDENTITY_CHANGED');
  const executable = safePath(identity.executablePath);
  const item = lstatSync(executable);
  if (!item.isFile() || item.isSymbolicLink()) fail('TARGET_BINARY_TYPE_INVALID');
  const actualHash = await hashFileImpl(executable);
  if (actualHash !== EXPECTED_HASH) fail('TARGET_BINARY_HASH_CHANGED');
  return {
    package_full_name: EXPECTED_PACKAGE, package_version: EXPECTED_VERSION,
    alias_path: expectedAlias, alias_reparse_tag: 'APPEXECLINK',
    executable_path: executable, executable_sha256: EXPECTED_HASH,
    sourceTrusted: false, authorityImplemented: false,
    operationalAuthority: false, review_verified: false,
  };
}

const INSPECT_SCRIPT = String.raw`$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$p=@(Get-AppxPackage -Name 'MicrosoftWindows.WindowsSandbox')
if($p.Count -ne 1){throw 'PACKAGE_COUNT_INVALID'}
$a=Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\wsb.exe'
$i=Get-Item -LiteralPath $a -Force
$e=Join-Path $p[0].InstallLocation 'wsb.exe'
$t=@(& (Join-Path $env:WINDIR 'System32\fsutil.exe') reparsepoint query $a)
if($LASTEXITCODE -ne 0){throw 'REPARSE_QUERY_FAILED'}
$tag=if(($t -join [Environment]::NewLine) -match '(?i)0x8000001b'){'0x8000001b'}else{''}
$c=@(Get-Command wsb.exe -All -CommandType Application|ForEach-Object{$_.Source})
[ordered]@{packageFullName=$p[0].PackageFullName;version=[string]$p[0].Version;status=[string]$p[0].Status;signatureKind=[string]$p[0].SignatureKind;executablePath=$e;aliasPath=$a;aliasIsReparse=[bool]($i.Attributes-band[IO.FileAttributes]::ReparsePoint);aliasReparseTag=$tag;resolvedCommands=$c}|ConvertTo-Json -Compress`;

export function inspectWindowsSandboxBinary({ execFileImpl = execFile, env = process.env } = {}) {
  return new Promise((resolvePromise, reject) => {
    const powershell = join(env.SystemRoot ?? env.WINDIR ?? '', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    execFileImpl(powershell, ['-NoProfile', '-NonInteractive', '-Command', INSPECT_SCRIPT], {
      shell: false, windowsHide: true, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024,
    }, (error, stdout, stderr) => {
      if (error || stderr) return reject(new Error('BINARY_INSPECTION_FAILED'));
      try { resolvePromise(JSON.parse(stdout)); }
      catch { reject(new Error('BINARY_INSPECTION_INVALID')); }
    });
  });
}

function captureProcess(child, timers) {
  return new Promise((resolvePromise, reject) => {
    const chunks = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 };
    let reason = null, spawnError = null, closed = false;
    const finishTimer = timers.setTimeout(() => {
      if (!closed) reject(new Error('CLI_PROCESS_TERMINATION_UNVERIFIED'));
    }, TIMEOUT_MS + TERMINATION_MS);
    const stop = (why) => {
      if (!reason) reason = why;
      if (!child.killed) child.kill();
    };
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', (value) => {
      const bytes = Buffer.from(value), remaining = MAX_STREAM_BYTES - sizes[stream];
      if (remaining > 0) chunks[stream].push(bytes.subarray(0, remaining));
      sizes[stream] += Math.min(bytes.length, Math.max(remaining, 0));
      if (bytes.length > remaining) stop(`${stream.toUpperCase()}_OVERFLOW`);
    });
    const timeout = timers.setTimeout(() => stop('CLI_TIMEOUT'), TIMEOUT_MS);
    child.once('error', (error) => { spawnError = error; stop('SPAWN_ERROR'); });
    child.once('close', (code, signal) => {
      closed = true; timers.clearTimeout(timeout); timers.clearTimeout(finishTimer);
      resolvePromise({ stdout: Buffer.concat(chunks.stdout), stderr: Buffer.concat(chunks.stderr),
        exitCode: Number.isSafeInteger(code) ? code : null, signal, reason, spawnError });
    });
  });
}

function classify(run) {
  if (run.reason) return { status: 'INCONCLUSIVE', reason: run.reason, count: null };
  if (run.exitCode !== 0) return { status: 'INCONCLUSIVE', reason: 'CLI_NONZERO_EXIT', count: null };
  if (run.stderr.length) return { status: 'INCONCLUSIVE', reason: 'STDERR_NOT_EMPTY', count: null };
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(run.stdout)); }
  catch { return { status: 'INCONCLUSIVE', reason: 'INVENTORY_JSON_INVALID', count: null }; }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.WindowsSandboxEnvironments))
    return { status: 'INCONCLUSIVE', reason: 'INVENTORY_SCHEMA_INVALID', count: null };
  const ids = new Set();
  for (const item of data.WindowsSandboxEnvironments) {
    if (!item || typeof item.Id !== 'string' || !ID.test(item.Id) || ids.has(item.Id))
      return { status: 'INCONCLUSIVE', reason: 'INVENTORY_ID_INVALID', count: null };
    ids.add(item.Id);
  }
  return { status: 'READ_ONLY_OBSERVATION_UNATTESTED', reason: null, count: ids.size };
}

function persist(outputDir, identity, report, stdout, stderr) {
  const out = safePath(outputDir, { absent: true });
  if (existsSync(out)) fail('OUTPUT_ALREADY_EXISTS');
  const parent = safePath(dirname(out));
  const stage = join(parent, `.${basename(out)}.tmp-${randomUUID()}`);
  try {
    mkdirSync(stage, { recursive: false, mode: 0o700 });
    writeFileSync(join(stage, 'wsb-list.stdout.bin'), stdout, { flag: 'wx', mode: 0o600 });
    writeFileSync(join(stage, 'wsb-list.stderr.bin'), stderr, { flag: 'wx', mode: 0o600 });
    writeFileSync(join(stage, 'binary-identity.json'), JSON.stringify(identity, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    writeFileSync(join(stage, 'inventory-observation.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(stage, out);
  } catch (error) {
    if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

export async function collectReadOnlyInventory({ outputDir, identityProvider = inspectWindowsSandboxBinary,
  binaryValidator = validateBinaryIdentity, spawnImpl = spawn, env = process.env, now = () => new Date().toISOString(),
  timers = { setTimeout, clearTimeout } }) {
  safePath(outputDir, { absent: true });
  if (existsSync(outputDir)) fail('OUTPUT_ALREADY_EXISTS');
  const identity = await binaryValidator(await identityProvider({ env }), env);
  const started = now();
  const child = spawnImpl(identity.alias_path, ['list', '--raw'], {
    shell: false, windowsHide: true, cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'],
  });
  const run = await captureProcess(child, timers);
  const result = classify(run);
  const report = {
    schema: '7allab-k205c-current-user-inventory/0.1', command: 'wsb list --raw',
    inventory_scope: 'CURRENT_USER_WSB_CLI', status: result.status, reason: result.reason,
    observed_at_start: started, observed_at_end: now(), exit_code: run.exitCode,
    timed_out: result.reason === 'CLI_TIMEOUT', current_user_visible_count: result.count,
    system_wide_empty: 'NOT_ATTESTED', stdout_sha256: sha256(run.stdout), stderr_sha256: sha256(run.stderr),
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false, review_verified: false,
  };
  persist(outputDir, identity, report, run.stdout, run.stderr);
  return report;
}

export async function runCli(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--output-dir' || !args[1]) fail('USAGE_OUTPUT_DIR_ONLY');
  const result = await collectReadOnlyInventory({ outputDir: args[1] });
  process.stdout.write(`READ_ONLY_OBSERVATION=${result.status}\n`);
  return result.status === 'READ_ONLY_OBSERVATION_UNATTESTED' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`FAIL_CLOSED=${error.message}\n`); process.exitCode = 1;
  });
}
