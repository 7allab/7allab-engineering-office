// W1b source-only bounded transport. Live use requires separate W1B-LIVE-EXECUTION approval.
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { inspectWindowsSandboxBinary, validateBinaryIdentity } from './wsb-read-only-adapter.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POLICY = 'p2-managed-hooks-only.test.json';
// Exact guest profiles by policy name (no prefix/regex). The S2 allow-control and S3 guarded allow-control policies are payload-only, never plan policies.
const GUEST_PROFILES = Object.freeze({
  [POLICY]: Object.freeze({ script: 'w1b-run.ps1', extra: Object.freeze([]) }),
  'p2-permission-request-probe.test.json': Object.freeze({ script: 'w1b-permission-run.ps1',
    extra: Object.freeze(['policies/p2-permission-request-allow-control.test.json', 'policies/p2-pretooluse-guard-allow-control.test.json', 'hooks/permission-probe.mjs']) }),
});
const MAX_STREAM = 1024 * 1024;
const COMMAND_TIMEOUT = 30000;
const CONNECT_TIMEOUT = 15000;
const CONNECT_GRACE = 250;
const TERMINATION_TIMEOUT = 5000;
const EXPORT_TIMEOUT = 4 * 60 * 1000;
const fail = (code) => { throw new Error(code); };
const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

function checked(path, kind) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) fail('PATH_NOT_FOUND');
    const item = lstatSync(cursor);
    if (item.isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
    if (cursor === full && kind === 'directory' && !item.isDirectory()) fail('DIRECTORY_REQUIRED');
    if (cursor === full && kind === 'file' && !item.isFile()) fail('FILE_REQUIRED');
  }
  return full;
}
const xml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export function buildSandboxConfig({ payloadRoot, exportRoot, runId, policy }) {
  const profile = typeof policy === 'string' && Object.hasOwn(GUEST_PROFILES, policy) ? GUEST_PROFILES[policy] : null;
  if (!ID.test(runId) || runId === '.' || runId === '..' || !profile) fail('PLAN_ID_OR_POLICY_INVALID');
  const payload = checked(payloadRoot, 'directory'), output = checked(exportRoot, 'directory');
  if (inside(payload, output) || inside(output, payload)) fail('MAPPING_PATH_OVERLAP');
  if (readdirSync(output).length) fail('EXPORT_ROOT_NOT_EMPTY');
  for (const name of ['bin/node.exe', 'bin/claude.exe', `policies/${policy}`,
    `sandbox/${profile.script}`, 'sandbox/guest-auth-provenance.mjs',
    'sandbox/guest-result-finalize.mjs', 'sandbox/export-manifest.ps1', ...profile.extra])
    checked(join(payload, ...name.split('/')), 'file');
  const command = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:\\payload\\sandbox\\${profile.script} -Policy ${policy} -RunId ${runId}`;
  return `<Configuration><VGpu>Disable</VGpu><Networking>Disable</Networking>` +
    `<ClipboardRedirection>Disable</ClipboardRedirection><AudioInput>Disable</AudioInput>` +
    `<VideoInput>Disable</VideoInput><PrinterRedirection>Disable</PrinterRedirection>` +
    `<ProtectedClient>Enable</ProtectedClient><MemoryInMB>8192</MemoryInMB><MappedFolders>` +
    `<MappedFolder><HostFolder>${xml(payload)}</HostFolder><SandboxFolder>C:\\payload</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>` +
    `<MappedFolder><HostFolder>${xml(output)}</HostFolder><SandboxFolder>C:\\export</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>` +
    `</MappedFolders><LogonCommand><Command>${xml(command)}</Command></LogonCommand></Configuration>`;
}

function watch(child, label, timers, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const chunks = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 };
    let reason = null, closed = false;
    const stop = (code) => { if (!reason) reason = code; if (!child.killed) child.kill(); };
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', (value) => {
      const bytes = Buffer.from(value), room = MAX_STREAM - sizes[stream];
      if (room > 0) chunks[stream].push(bytes.subarray(0, room));
      sizes[stream] += Math.min(bytes.length, Math.max(room, 0));
      if (bytes.length > room) stop(`${label}_${stream.toUpperCase()}_OVERFLOW`);
    });
    const timeout = timers.setTimeout(() => stop(`${label}_TIMEOUT`), timeoutMs);
    const termination = timers.setTimeout(() => {
      if (!closed) reject(new Error(`${label}_TERMINATION_UNVERIFIED`));
    }, timeoutMs + TERMINATION_TIMEOUT);
    child.once('error', () => stop(`${label}_SPAWN_ERROR`));
    child.once('close', (code) => {
      closed = true; timers.clearTimeout(timeout); timers.clearTimeout(termination);
      const stdout = Buffer.concat(chunks.stdout), stderr = Buffer.concat(chunks.stderr);
      const exit = Number.isSafeInteger(code) ? code : null;
      const error = reason || (exit !== 0 ? `${label}_NONZERO_EXIT` : stderr.length ? `${label}_STDERR_NOT_EMPTY` : null);
      resolvePromise({ exit_code: exit, timed_out: reason === `${label}_TIMEOUT`,
        error_code: error, stdout, stderr });
    });
  });
}

export function createWsbStatefulTransport({ payloadRoot, exportRoot, runId, sandboxId, policy,
  identityProvider = inspectWindowsSandboxBinary, binaryValidator = validateBinaryIdentity,
  spawnImpl = spawn, env = process.env, timers = { setTimeout, clearTimeout },
  clock = () => Date.now(), sleep = (ms) => new Promise((done) => setTimeout(done, ms)) }) {
  if (!GUID.test(sandboxId)) fail('SANDBOX_ID_INVALID');
  const config = buildSandboxConfig({ payloadRoot, exportRoot, runId, policy });
  const completion = join(resolve(exportRoot), runId, 'EXPORT.COMPLETE.json');
  let identityPromise, startAttempted = false, started = false, connected = false;
  let connection = null, connectionClosed = false, connectionIssue = null, stopping = false;
  const identity = () => identityPromise ??= Promise.resolve(identityProvider({ env }))
    .then((value) => binaryValidator(value, env));
  const execution = (executable, argv, source='WSB_CLI') => ({ executable, argv, shell: false, source });
  const internalWait = execution(null, [], 'INTERNAL_WAIT');
  const call = (args) => {
    if (!args || JSON.stringify(Object.keys(args).sort()) !== JSON.stringify(['policy','runId','sandboxId']) ||
        args.runId !== runId || args.sandboxId !== sandboxId || args.policy !== policy) fail('CAMPAIGN_CALL_MISMATCH');
  };
  const launch = async (label, args) => {
    const pinned = await identity();
    const child = spawnImpl(pinned.alias_path, args, { shell: false, windowsHide: true,
      cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] });
    return { ...(await watch(child, label, timers, COMMAND_TIMEOUT)),
      execution: execution(pinned.alias_path, args) };
  };
  const start = async (args) => {
    call(args); if (startAttempted) fail('START_ALREADY_ATTEMPTED');
    startAttempted = true;
    const result = await launch('START', ['start', '--id', sandboxId, '--config', config, '--raw']);
    if (!result.error_code) {
      try { started = JSON.parse(result.stdout.toString('utf8'))?.Id === sandboxId; }
      catch { started = false; }
    }
    return result;
  };
  const connect = async (args) => {
    call(args); if (!started || connected || connection) fail('CONNECT_STATE_INVALID');
    const pinned = await identity();
    const argv = ['connect', '--id', sandboxId];
    const child = spawnImpl(pinned.alias_path, argv, { shell: false,
      windowsHide: true, cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] });
    connection = child;
    const chunks = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 };
    const stop = (code) => { if (!connectionIssue) connectionIssue = code; if (!child.killed) child.kill(); };
    for (const stream of ['stdout', 'stderr']) child[stream].on('data', (value) => {
      const bytes = Buffer.from(value), room = MAX_STREAM - sizes[stream];
      if (room > 0) chunks[stream].push(bytes.subarray(0, room));
      sizes[stream] += Math.min(bytes.length, Math.max(room, 0));
      if (bytes.length > room) stop(`CONNECT_${stream.toUpperCase()}_OVERFLOW`);
    });
    return new Promise((resolvePromise) => {
      let settled = false;
      const finish = (error = null) => {
        if (settled) return; settled = true;
        timers.clearTimeout(timeout); timers.clearTimeout(grace);
        connected = error === null;
        resolvePromise({ exit_code: error ? null : 0, timed_out: error === 'CONNECT_TIMEOUT',
          error_code: error, stdout: Buffer.concat(chunks.stdout), stderr: Buffer.concat(chunks.stderr),
          execution: execution(pinned.alias_path, argv) });
      };
      const timeout = timers.setTimeout(() => { stop('CONNECT_TIMEOUT'); finish('CONNECT_TIMEOUT'); }, CONNECT_TIMEOUT);
      let grace;
      child.once('spawn', () => { grace = timers.setTimeout(() => finish(connectionIssue), CONNECT_GRACE); });
      child.once('error', () => { stop('CONNECT_SPAWN_ERROR'); finish('CONNECT_SPAWN_ERROR'); });
      child.once('close', () => {
        connectionClosed = true;
        if (!stopping) connectionIssue ||= 'CONNECT_EARLY_EXIT';
        finish(connectionIssue);
      });
    });
  };
  const waitForExport = async (args) => {
    call(args); if (!connected) fail('WAIT_STATE_INVALID');
    const deadline = clock() + EXPORT_TIMEOUT;
    while (clock() <= deadline) {
      if (connectionIssue) return { exit_code: null, timed_out: false, error_code: connectionIssue, stdout: '', stderr: '', execution: internalWait };
      if (existsSync(completion)) {
        try {
          const completionPath = checked(completion, 'file');
          if (lstatSync(completionPath).size > 128 * 1024) fail('EXPORT_COMPLETION_INVALID');
          const bytes = readFileSync(completionPath);
          const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
          if (value.run_id !== runId || !Number.isSafeInteger(value.file_count) || value.file_count < 1)
            fail('EXPORT_COMPLETION_INVALID');
          return { exit_code: 0, timed_out: false, error_code: null, stdout: bytes, stderr: '', execution: internalWait };
        } catch { return { exit_code: null, timed_out: false, error_code: 'EXPORT_COMPLETION_INVALID', stdout: '', stderr: '', execution: internalWait }; }
      }
      await sleep(500);
    }
    return { exit_code: null, timed_out: true, error_code: 'EXPORT_TIMEOUT', stdout: '', stderr: '', execution: internalWait };
  };
  const stop = async (args) => {
    call(args); if (!startAttempted || stopping) fail('STOP_STATE_INVALID');
    stopping = true;
    const result = await launch('STOP', ['stop', '--id', sandboxId]);
    if (connection && !connectionClosed) {
      const terminated = await new Promise((done) => {
        const timeout = timers.setTimeout(() => done(false), TERMINATION_TIMEOUT);
        connection.once('close', () => { timers.clearTimeout(timeout); done(true); });
        if (!connection.killed) connection.kill();
      });
      if (!terminated && !result.error_code) result.error_code = 'CONNECT_TERMINATION_UNVERIFIED';
    }
    if (connectionIssue && !result.error_code) result.error_code = connectionIssue;
    return result;
  };
  return Object.freeze({ start, connect, waitForExport, stop });
}
