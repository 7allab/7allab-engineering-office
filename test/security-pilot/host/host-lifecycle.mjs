// K2-05-C R2-A: executable lifecycle composition with an injected transport.
// This module does NOT launch processes, Windows Sandbox, Hyper-V or the network.
// The transport MUST capture real command outcomes separately; faked outcomes
// remain synthetic and are never elevated into operational authority.
import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { correlateOffline } from './offline-integrate.mjs';
import { parseFinalInventory } from './runner-evidence.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const POLICIES = new Set([
  'p1-baseline.test.json', 'p2-managed-hooks-only.test.json',
  'p3-onfailure-missing-script.test.json', 'p4-onfailure-error.test.json',
  'p5-onfailure-timeout.test.json', 'p6-control-error-without-onfailure.test.json',
  'p2-permission-request-probe.test.json',
]);
const SCHEMA = '7allab-k205c-host-observability-input/0.1';
const MAX_LOG_BYTES = 1024 * 1024;
const HOST_SOURCES = ['host/w1b-live-runner.mjs','host/campaign-driver.mjs',
  'host/wsb-stateful-transport.mjs','host/wsb-read-only-adapter.mjs'];
const fail = (code) => { throw new Error(code); };
const inside = (parent, child) => {
  const r = relative(parent, child);
  return r === '' || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r));
};
function checkedPath(path, { directory = false, absent = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let current = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (!existsSync(current)) {
      if (!absent || current !== full) fail('PATH_NOT_FOUND');
      continue;
    }
    const st = lstatSync(current);
    if (st.isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
    if (current === full && directory && !st.isDirectory()) fail('NOT_A_DIRECTORY');
    if (current === full && !directory && !absent && !st.isFile()) fail('NOT_A_FILE');
  }
  return full;
}
function codeFor(error) {
  const candidate = String(error?.code || error?.message || 'ADAPTER_ERROR').toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,90}$/.test(candidate) ? candidate : 'ADAPTER_ERROR';
}
function bytes(value) {
  if (value == null) return Buffer.alloc(0);
  if (!Buffer.isBuffer(value) && typeof value !== 'string') fail('ADAPTER_LOG_TYPE_INVALID');
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  if (raw.length > MAX_LOG_BYTES) fail('ADAPTER_LOG_TOO_LARGE');
  return raw;
}
function execution(value) {
  if (value == null) return null;
  if (!value || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['argv','executable','shell','source']) ||
      (value.executable !== null && (typeof value.executable !== 'string' || value.executable.length > 32768)) ||
      !Array.isArray(value.argv) || value.argv.length > 16 || value.argv.some(x => typeof x !== 'string' || x.length > 32768) ||
      value.shell !== false || !['CURRENT_USER_WSB_CLI','INTERNAL_WAIT','WSB_CLI'].includes(value.source)) fail('EXECUTION_EVIDENCE_INVALID');
  return value;
}
function hostSources(value) {
  if (value == null) return null;
  if (!value || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...HOST_SOURCES].sort()) ||
      Object.values(value).some(x => typeof x !== 'string' || !/^[A-F0-9]{64}$/.test(x))) fail('HOST_SOURCE_EVIDENCE_INVALID');
  return value;
}
function checkTransportResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('ADAPTER_RESULT_INVALID');
  if (result.timed_out !== true && result.timed_out !== false) fail('ADAPTER_TIMEOUT_NOT_RECORDED');
  if (result.exit_code !== null && (!Number.isSafeInteger(result.exit_code) || result.exit_code < -2147483648 || result.exit_code > 2147483647)) fail('ADAPTER_EXIT_INVALID');
  if (result.exit_code === null && !result.timed_out && !result.error_code) fail('ADAPTER_FAILURE_REASON_MISSING');
  if (result.error_code != null && !/^[A-Z][A-Z0-9_:-]{1,99}$/.test(result.error_code)) fail('ADAPTER_ERROR_CODE_INVALID');
  const stdout = bytes(result.stdout), stderr = bytes(result.stderr);
  return { exit_code: result.exit_code, timed_out: result.timed_out,
    error_code: result.error_code ?? null, stdout, stderr,
    inventory_source: typeof result.inventory_source === 'string' &&
      result.inventory_source.length <= 64 ? result.inventory_source : null,
    execution: execution(result.execution) };
}
export function syntheticStep({ exit_code = 0, timed_out = false, error_code = null,
  stdout = '', stderr = '', inventory_source = null, execution = null } = {}) {
  return { exit_code, timed_out, error_code, stdout, stderr, inventory_source, execution };
}
// This is not a live WSB entry point. The caller owns the transport and any
// OS permissions. Tests inject an inert transport; no subprocess is created here.
export async function captureAndCorrelate({ runId, sandboxId, policy, exportRunDir,
  outputDir, authProvenancePath = null, transport, hostSourceSha256 = null }) {
  if (typeof runId !== 'string' || !ID.test(runId) || runId === '.' || runId === '..') fail('INVALID_RUN_ID');
  if (typeof sandboxId !== 'string' || !ID.test(sandboxId) || sandboxId === '.' || sandboxId === '..') fail('INVALID_SANDBOX_ID');
  if (!POLICIES.has(policy)) fail('POLICY_NOT_ALLOWLISTED');
  if (!transport || typeof transport !== 'object') fail('TRANSPORT_REQUIRED');
  const exportDir = checkedPath(exportRunDir, { directory: true, absent: true });
  if (!existsSync(exportDir)) checkedPath(dirname(exportDir), { directory: true });
  const out = checkedPath(outputDir, { directory: true, absent: true });
  if (existsSync(out)) fail('OUTPUT_ALREADY_EXISTS');
  if (inside(exportDir, out) || inside(out, exportDir)) fail('OUTPUT_EXPORT_OVERLAP');
  if (authProvenancePath !== null) {
    const futureAuth = resolve(exportDir, 'guest-auth.json');
    const auth = existsSync(authProvenancePath)
      ? checkedPath(authProvenancePath)
      : resolve(authProvenancePath);
    if (!existsSync(auth) && auth !== futureAuth) fail('FUTURE_AUTH_PATH_INVALID');
    if (inside(out, auth)) fail('OUTPUT_AUTH_OVERLAP');
  }
  checkedPath(dirname(out), { directory: true });
  mkdirSync(out);  // exclusive new directory; never write into the immutable export
  const captures = join(out, 'captured-commands');
  mkdirSync(captures);
  const events = [];
  let sequence = 0;
  const record = async (phase, command) => {
    const index = sequence++;
    const phaseName = `${String(index).padStart(2, '0')}-${phase.toLowerCase()}`;
    const stdoutPath = join(captures, `${phaseName}-stdout.log`);
    const stderrPath = join(captures, `${phaseName}-stderr.log`);
    let result;
    try {
      if (typeof command !== 'function') fail('TRANSPORT_METHOD_MISSING');
      result = checkTransportResult(await command());
    } catch (error) {
      result = { exit_code: null, timed_out: false, error_code: codeFor(error),
        stdout: Buffer.alloc(0), stderr: Buffer.from(String(error?.message || 'ADAPTER_ERROR').slice(0, 512)) };
    }
    writeFileSync(stdoutPath, result.stdout, { flag: 'wx', mode: 0o600 });
    writeFileSync(stderrPath, result.stderr, { flag: 'wx', mode: 0o600 });
    const event = {
      phase, observed_at: new Date().toISOString(), exit_code: result.exit_code,
      timed_out: result.timed_out, error_code: result.error_code,
      stdout_path: stdoutPath, stderr_path: stderrPath,
      ...(['PREFLIGHT', 'FINAL_INVENTORY'].includes(phase) ?
        { inventory_source: result.inventory_source } : {}),
      ...(phase === 'FINAL_INVENTORY' ? { sandbox_id: sandboxId } : {}),
      ...(result.execution ? { execution: result.execution } : {}),
    };
    events.push(event);
    return { ...result, success: result.exit_code === 0 && !result.timed_out && result.error_code === null };
  };
  const invoke = (method, args) => {
    if (typeof transport[method] !== 'function') fail('TRANSPORT_METHOD_MISSING');
    return transport[method](args);
  };
  let startAttempted = false;
  let stopRequired = false;
  const preflight = await record('PREFLIGHT', () => invoke('preflight', { runId, sandboxId, policy }));
  let mayStart = preflight.success;
  if (mayStart) {
    try {
      const inventory = parseFinalInventory(preflight.stdout.toString('utf8'), sandboxId,
        preflight.inventory_source);
      // This synthetic transport gate only sees current-user WSB sessions.
      // It does not establish system-wide emptiness or authorize a live runner.
      mayStart = inventory.current_user_sessions_empty;
    } catch { mayStart = false; }
    if (!mayStart) {
      // Preserve original raw list response and explicitly prevent start.
      events[events.length - 1].error_code = 'PREFLIGHT_NOT_PROVEN_EMPTY';
    }
  }
  if (mayStart) {
    startAttempted = true;
    const started = await record('SANDBOX_START', () => invoke('start', { runId, sandboxId, policy }));
    // A zero exit is insufficient without the exact reserved ID in JSON.
    let startValid = started.success;
    if (startValid) {
      try {
        const parsed = JSON.parse(started.stdout.toString('utf8'));
        startValid = parsed && parsed.Id === sandboxId;
      } catch { startValid = false; }
      if (!startValid) events[events.length - 1].error_code = 'SANDBOX_START_ID_UNVERIFIED';
    }
    stopRequired = startAttempted; // attempted start may have created a sandbox even on failure
    if (startValid) {
      const connected = await record('CONNECT', () => invoke('connect', { runId, sandboxId, policy }));
      if (connected.success) await record('WAIT_FOR_EXPORT', () => invoke('waitForExport', { runId, sandboxId, policy }));
    }
  }
  // Cleanup is never short-circuited by a failed connect or export wait.
  if (stopRequired) await record('SANDBOX_STOP', () => invoke('stop', { runId, sandboxId, policy }));
  await record('FINAL_INVENTORY', () => invoke('finalInventory', { runId, sandboxId, policy }));
  // We keep incomplete evidence, including failures; this is a record of
  // attempted operations, never proof that the transport actually ran WSB.
  const input = {
    schema: SCHEMA, run_id: runId, sandbox_id: sandboxId,
    collected_at: new Date().toISOString(), events,
    auth_provenance_path: authProvenancePath,
    ...(hostSourceSha256 ? { host_source_sha256: hostSources(hostSourceSha256) } : {}),
  };
  const inputPath = join(out, 'runner-input.json');
  writeFileSync(inputPath, JSON.stringify(input, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const correlation = await correlateOffline({ runDir: exportDir, runId, policy,
    runnerInput: inputPath, reportDir: join(out, 'offline-report') });
  return Object.freeze({ run_id: runId, status: correlation.status, reasons: correlation.reasons,
    runner_input: inputPath, report_dir: join(out, 'offline-report'),
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false, review_verified: false });
}
