#!/usr/bin/env node
// K2-05-C R1.6: offline-only correlation of existing guest export + captured host evidence.
// This script NEVER invokes WSB, PowerShell, Claude, Hyper-V, network, or real credentials.
// Its positive status is consistency of supplied files, NOT execution proof / security acceptance.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyExport } from './verify-export.mjs';
import { recordEvidence } from './runner-evidence.mjs';

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const POLICIES = new Set([
  'p1-baseline.test.json',
  'p2-managed-hooks-only.test.json',
  'p3-onfailure-missing-script.test.json',
  'p4-onfailure-error.test.json',
  'p5-onfailure-timeout.test.json',
  'p6-control-error-without-onfailure.test.json',
  'p2-permission-request-probe.test.json',
]);
const REQUIRED_HOST_PHASES = [
  'PREFLIGHT', 'SANDBOX_START', 'CONNECT', 'WAIT_FOR_EXPORT', 'SANDBOX_STOP', 'FINAL_INVENTORY',
];
const SCHEMA = '7allab-k205c-offline-correlation/0.1';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const fail = (code) => { throw new Error(code); };
const within = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
function noLinks(path, { mustExist = true, directory = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path);
  const root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) {
      if (mustExist || cursor !== full) fail('PATH_NOT_FOUND');
      continue;
    }
    const st = lstatSync(cursor);
    if (st.isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
    if (cursor === full && directory && !st.isDirectory()) fail('DIRECTORY_REQUIRED');
    if (cursor === full && !directory && mustExist && !st.isFile()) fail('FILE_REQUIRED');
  }
  return full;
}
function readBoundedJson(path, maxBytes, code) {
  const full = noLinks(path);
  const st = lstatSync(full);
  if (st.size > maxBytes) fail(`${code}_TOO_LARGE`);
  const bytes = readFileSync(full);
  try { return { value: JSON.parse(bytes.toString('utf8')), bytes }; }
  catch { fail(`${code}_INVALID_JSON`); }
}
function failureCode(error) {
  const code = error?.code || error?.message;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,90}$/.test(code)
    ? code : 'UNCLASSIFIED_ERROR';
}
function guestResult(runDir, runId, policy, exportVerified) {
  // The guest result must itself be part of the verified export manifest.
  const manifestFile = join(runDir, 'MANIFEST.sha256.json');
  const manifestRaw = readBoundedJson(manifestFile, 2 * 1024 * 1024, 'MANIFEST');
  if (sha256(manifestRaw.bytes) !== exportVerified.manifest_sha256) fail('MANIFEST_CHANGED_DURING_CORRELATION');
  const entries = manifestRaw.value?.files;
  if (!Array.isArray(entries)) fail('MANIFEST_ENTRIES_INVALID');
  const results = entries.filter((entry) => entry?.relative_path === 'result.json');
  if (results.length !== 1) fail('RESULT_NOT_IN_MANIFEST');
  const resultFile = join(runDir, 'result.json');
  const result = readBoundedJson(resultFile, 1024 * 1024, 'RESULT');
  if (results[0].sha256?.toUpperCase() !== sha256(result.bytes) ||
      results[0].bytes !== result.bytes.length) fail('RESULT_CHANGED_DURING_CORRELATION');
  const data = result.value;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.schema !== '7allab-k205c-sandbox-run/0.1' ||
      data.run_id !== runId || data.policy_file !== policy) fail('GUEST_RESULT_CONTRACT_MISMATCH');
  if (!['RUN_COMPLETED_UNATTESTED', 'RUN_FAILED_CLOSED'].includes(data.status)) fail('GUEST_STATUS_INVALID');
  if (data.sourceTrusted !== false || data.authorityImplemented !== false ||
      data.operationalAuthority !== false || data.review_verified === true) fail('GUEST_AUTHORITY_CLAIM_INVALID');
  if (data.evidence_kind !== 'MOCK_ENDPOINT') fail('GUEST_EVIDENCE_KIND_INVALID');
  if (data.status === 'RUN_COMPLETED_UNATTESTED' &&
      (data.claude_exit_code !== 0 || data.claude_timed_out !== false || data.error != null)) {
    fail('GUEST_SUCCESS_FIELDS_CONTRADICTORY');
  }
  let auth = { status: 'NOT_RECORDED', auth_mode: null, auth_provenance: null };
  if (data.auth_mode != null || data.auth_provenance != null) {
    const provenance = data.auth_provenance;
    if (data.auth_mode !== 'MOCK_ENDPOINT' || !provenance ||
        provenance.credential_kind !== 'SYNTHETIC_SENTINEL' ||
        provenance.endpoint_kind !== 'LOOPBACK_MOCK' ||
        provenance.source !== 'RUNNER_ENVIRONMENT' ||
        typeof provenance.evidence_sha256 !== 'string' ||
        !/^[A-Fa-f0-9]{64}$/.test(provenance.evidence_sha256) ||
        typeof provenance.notes !== 'string') fail('GUEST_AUTH_PROVENANCE_INVALID');
    auth = { status: 'RECORDED_UNATTESTED', auth_mode: data.auth_mode,
      auth_provenance: { credential_kind: provenance.credential_kind,
        endpoint_kind: provenance.endpoint_kind, source: provenance.source,
        evidence_sha256: provenance.evidence_sha256.toUpperCase() } };
  }
  return { schema: data.schema, run_id: data.run_id, policy_file: data.policy_file,
    status: data.status, evidence_kind: data.evidence_kind, auth, sha256: sha256(result.bytes) };
}
function assessHost(report, runId) {
  const hard = [];
  const unknown = [];
  if (report.run_id !== runId || report.status !== 'EVIDENCE_COLLECTED_UNATTESTED' ||
      report.authorityImplemented !== false || report.operationalAuthority !== false ||
      report.review_verified !== false || report.sourceTrusted !== false) hard.push('HOST_CONTRACT_MISMATCH');
  if (!Array.isArray(report.events)) hard.push('HOST_EVENTS_INVALID');
  if (hard.length) return { hard, unknown };
  const phases = new Map();
  for (const event of report.events) {
    if (phases.has(event.stage)) hard.push('DUPLICATE_HOST_PHASE');
    phases.set(event.stage, event);
    if (event.stage === 'HOST_ERROR' || event.outcome !== 'COMMAND_EXIT_ZERO' ||
        event.exit_code !== 0 || event.timed_out !== false || event.error_code != null) {
      hard.push('HOST_EVENT_FAILED');
    }
  }
  let previousPosition = -1;
  let previousTime = -Infinity;
  for (const phase of REQUIRED_HOST_PHASES) {
    const event = phases.get(phase);
    if (!event) {
      unknown.push(`HOST_PHASE_NOT_RECORDED_${phase}`);
      continue;
    }
    const position = report.events.indexOf(event);
    const moment = Date.parse(event.observed_at);
    if (position <= previousPosition || moment < previousTime) hard.push('HOST_LIFECYCLE_ORDER_INVALID');
    previousPosition = position;
    previousTime = moment;
  }
  const start = phases.get('SANDBOX_START');
  const stop = phases.get('SANDBOX_STOP');
  const final = phases.get('FINAL_INVENTORY');
  if (start && stop && Date.parse(stop.observed_at) < Date.parse(start.observed_at)) hard.push('HOST_TIME_ORDER_INVALID');
  if (stop && final && Date.parse(final.observed_at) < Date.parse(stop.observed_at)) hard.push('FINAL_INVENTORY_BEFORE_STOP');
  if (stop && final && report.events.indexOf(final) <= report.events.indexOf(stop)) hard.push('FINAL_INVENTORY_EVENT_ORDER_INVALID');
  if (final && (!final.stdout || !final.stdout.sha256)) unknown.push('FINAL_INVENTORY_RAW_NOT_RECORDED');
  if (!report.final_inventory || report.final_inventory.status === 'NOT_RECORDED' ||
      report.final_inventory.status === 'INCONCLUSIVE') unknown.push('FINAL_INVENTORY_INCONCLUSIVE');
  else if (report.final_inventory.inventory_scope !== 'CURRENT_USER_WSB_CLI' ||
           report.final_inventory.system_wide_empty !== 'NOT_ATTESTED') {
    unknown.push('FINAL_INVENTORY_SCOPE_UNVERIFIED');
  } else if (report.final_inventory.current_user_sessions_empty !== true ||
             report.final_inventory.owned_sandbox_absent_in_current_user_view !== true ||
             report.final_inventory.current_user_visible_count !== 0) {
    unknown.push('CURRENT_USER_WSB_INVENTORY_NOT_EMPTY');
  }
  if (report.auth?.status !== 'RECORDED_UNATTESTED' ||
      report.auth.auth_mode !== 'MOCK_ENDPOINT' ||
      report.auth.auth_provenance?.source !== 'RUNNER_ENVIRONMENT' ||
      typeof report.auth.auth_provenance?.evidence_sha256 !== 'string') {
    unknown.push('MOCK_AUTH_PROVENANCE_NOT_RECORDED');
  }
  return { hard, unknown };
}

export async function correlateOffline({ runDir, runId, policy, runnerInput, reportDir }) {
  if (typeof runId !== 'string' || !RUN_ID.test(runId) || runId === '.' || runId === '..') fail('RUN_ID_INVALID');
  if (!POLICIES.has(policy)) fail('POLICY_NOT_ALLOWLISTED');
  const exportRoot = noLinks(runDir, { mustExist: false, directory: true });
  if (!existsSync(exportRoot)) noLinks(dirname(exportRoot), { directory: true });
  const input = noLinks(runnerInput);
  const output = noLinks(reportDir, { mustExist: false, directory: true });
  if (existsSync(output)) fail('OUTPUT_ALREADY_EXISTS');
  if (within(exportRoot, output) || within(output, exportRoot) ||
      within(output, input) || within(input, output)) fail('OUTPUT_INPUT_OVERLAP');
  // Require an existing parent. Never recursively create arbitrary host paths.
  noLinks(dirname(output), { directory: true });
  mkdirSync(output);
  const report = {
    schema: SCHEMA, recorded_at_utc: new Date().toISOString(),
    run_id: runId, policy_file: policy, status: 'INCONCLUSIVE',
    reasons: [], export: null, host: null, guest: null,
    sourceTrusted: false, authorityImplemented: false,
    operationalAuthority: false, review_verified: false,
  };
  const hard = [], unknown = [];
  try {
    try {
      // Run the existing recorder once, in a new private report subdirectory.
      const host = recordEvidence(input, join(output, 'host-evidence'));
      const rawHost = readFileSync(join(output, 'host-evidence', 'host-runner-evidence.json'));
      report.host = { status: host.status, run_id: host.run_id,
        report_sha256: sha256(rawHost), event_count: host.events.length,
        final_inventory: host.final_inventory, auth: host.auth };
      const assessed = assessHost(host, runId);
      hard.push(...assessed.hard);
      unknown.push(...assessed.unknown);
    } catch (error) {
      hard.push(`HOST_EVIDENCE_${failureCode(error)}`);
    }
    try {
      if (!existsSync(exportRoot)) fail('EXPORT_DIRECTORY_NOT_FOUND');
      const verified = await verifyExport(exportRoot, runId);
      report.export = verified;
      report.guest = guestResult(exportRoot, runId, policy, verified);
      if (report.guest.status !== 'RUN_COMPLETED_UNATTESTED') hard.push('GUEST_RUN_FAILED_CLOSED');
      if (report.guest.auth.status !== 'RECORDED_UNATTESTED') unknown.push('GUEST_AUTH_PROVENANCE_NOT_RECORDED');
    } catch (error) {
      hard.push(`EXPORT_OR_GUEST_${failureCode(error)}`);
    }
    if (report.host?.auth?.status === 'RECORDED_UNATTESTED' &&
        report.guest?.auth?.status === 'RECORDED_UNATTESTED') {
      const hostAuth = report.host.auth, guestAuth = report.guest.auth;
      if (hostAuth.auth_mode !== guestAuth.auth_mode ||
          hostAuth.auth_provenance.credential_kind !== guestAuth.auth_provenance.credential_kind ||
          hostAuth.auth_provenance.endpoint_kind !== guestAuth.auth_provenance.endpoint_kind ||
          hostAuth.auth_provenance.source !== guestAuth.auth_provenance.source ||
          hostAuth.auth_provenance.evidence_sha256 !== guestAuth.auth_provenance.evidence_sha256) {
        hard.push('HOST_GUEST_AUTH_PROVENANCE_MISMATCH');
      }
    }
    // A nonzero/contradictory input dominates missing evidence. No acceptance is possible here.
    report.status = hard.length ? 'FAIL_CLOSED' : unknown.length ? 'INCONCLUSIVE' : 'OFFLINE_CONSISTENT_UNATTESTED';
    report.reasons = [...new Set([...hard, ...unknown])].sort();
    writeFileSync(join(output, 'offline-correlation.json'), JSON.stringify(report, null, 2) + '\n',
      { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return report;
  } catch (error) {
    // Never write an artificial successful summary on a report write failure.
    throw error;
  }
}
function parseCli(args) {
  const allowed = ['--run-dir', '--run-id', '--policy', '--runner-input', '--report-dir'];
  if (args.length !== 10) fail('INVALID_CLI_ARGUMENTS');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!allowed.includes(args[i]) || Object.hasOwn(options, args[i])) fail('INVALID_CLI_ARGUMENTS');
    options[args[i]] = args[i + 1];
  }
  if (Object.keys(options).length !== allowed.length || allowed.some((k) => !options[k])) fail('INVALID_CLI_ARGUMENTS');
  return options;
}
export async function runCli(args = process.argv.slice(2)) {
  const options = parseCli(args);
  const report = await correlateOffline({ runDir: options['--run-dir'], runId: options['--run-id'],
    policy: options['--policy'], runnerInput: options['--runner-input'], reportDir: options['--report-dir'] });
  process.stdout.write(`OFFLINE_CORRELATION=${report.status}\n`);
  return report.status === 'OFFLINE_CONSISTENT_UNATTESTED' ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`FAIL_CLOSED=${failureCode(error)}\n`);
    process.exitCode = 1;
  });
}
