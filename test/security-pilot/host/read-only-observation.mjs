#!/usr/bin/env node
// K2-05-C R2-C1: offline validation of a previously captured `wsb list --raw` observation.
// No WSB, PowerShell, shell, subprocess, Hyper-V, network, or real-credential operations.
// Validates supplied bytes; it cannot prove that the claimed command actually ran.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const INPUT_SCHEMA = '7allab-k205c-current-user-inventory/0.1';
const OUTPUT_SCHEMA = '7allab-k205c-read-only-observation-audit/0.1';
const SCOPE = 'CURRENT_USER_WSB_CLI';
const CMD = 'wsb list --raw';
const MAX_LOG_BYTES = 1024 * 1024;
const MAX_REPORT_BYTES = 128 * 1024;
const SHA256 = /^[0-9a-f]{64}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REASON = /^[A-Za-z0-9_ :.-]{1,256}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const ALLOWED = new Set([
  'schema', 'command', 'inventory_scope', 'status', 'reason',
  'observed_at_start', 'observed_at_end', 'exit_code', 'timed_out',
  'current_user_visible_count', 'system_wide_empty', 'stdout_sha256',
  'stderr_sha256', 'sourceTrusted', 'authorityImplemented',
  'operationalAuthority', 'review_verified',
]);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const fail = (code) => { throw new Error(code); };
const inside = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

function safePath(path, { kind = 'file', mayBeAbsent = false } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = join(cursor, part);
    if (!existsSync(cursor)) {
      if (!mayBeAbsent || cursor !== full) fail('PATH_NOT_FOUND');
      continue;
    }
    const st = lstatSync(cursor);
    if (st.isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
    if (cursor === full && kind === 'file' && !st.isFile()) fail('NOT_A_FILE');
    if (cursor === full && kind === 'dir' && !st.isDirectory()) fail('NOT_A_DIRECTORY');
  }
  return full;
}

function readBounded(path, limit) {
  const full = safePath(path);
  if (lstatSync(full).size > limit) fail('EVIDENCE_SIZE_LIMIT');
  const bytes = readFileSync(full);
  if (bytes.length > limit) fail('EVIDENCE_SIZE_LIMIT');
  return bytes;
}

function parseJson(bytes, reason) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { fail(reason); }
}

function validUtc(value) {
  if (typeof value !== 'string' || !UTC.test(value) || !Number.isFinite(Date.parse(value))) fail('OBSERVATION_TIMESTAMP_INVALID');
  return Date.parse(value);
}

function loadObservation(observationDir) {
  const dir = safePath(observationDir, { kind: 'dir' });
  const inputBytes = readBounded(join(dir, 'inventory-observation.json'), MAX_REPORT_BYTES);
  const stdout = readBounded(join(dir, 'wsb-list.stdout.bin'), MAX_LOG_BYTES);
  const stderr = readBounded(join(dir, 'wsb-list.stderr.bin'), MAX_LOG_BYTES);
  const source = parseJson(inputBytes, 'OBSERVATION_JSON_INVALID');
  const reasons = [];
  let verdict = 'INCONCLUSIVE';
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail('OBSERVATION_CONTRACT_INVALID');
  if (Object.keys(source).some((key) => !ALLOWED.has(key))) fail('OBSERVATION_UNKNOWN_FIELD');
  if (source.schema !== INPUT_SCHEMA || source.command !== CMD || source.inventory_scope !== SCOPE ||
      source.system_wide_empty !== 'NOT_ATTESTED' || source.sourceTrusted !== false ||
      source.authorityImplemented !== false || source.operationalAuthority !== false ||
      source.review_verified !== false) fail('OBSERVATION_AUTHORITY_OR_SCOPE_INVALID');
  if (!SHA256.test(source.stdout_sha256) || !SHA256.test(source.stderr_sha256) ||
      sha256(stdout) !== source.stdout_sha256.toUpperCase() || sha256(stderr) !== source.stderr_sha256.toUpperCase()) {
    fail('OBSERVATION_HASH_MISMATCH');
  }
  const start = validUtc(source.observed_at_start), end = validUtc(source.observed_at_end);
  if (start > end) fail('OBSERVATION_TIME_ORDER_INVALID');
  if (source.timed_out !== true && source.timed_out !== false) fail('OBSERVATION_TIMEOUT_INVALID');
  if (source.exit_code !== null && (!Number.isSafeInteger(source.exit_code) ||
      source.exit_code < -2147483648 || source.exit_code > 2147483647)) fail('OBSERVATION_EXIT_INVALID');
  if (!['READ_ONLY_OBSERVATION_UNATTESTED', 'INCONCLUSIVE'].includes(source.status)) fail('OBSERVATION_STATUS_INVALID');
  if (source.status === 'READ_ONLY_OBSERVATION_UNATTESTED') {
    if (source.exit_code !== 0 || source.timed_out !== false ||
        (source.reason !== null && source.reason !== '') ||
        !Number.isSafeInteger(source.current_user_visible_count) || source.current_user_visible_count < 0) {
      fail('OBSERVATION_POSITIVE_FIELDS_CONTRADICTORY');
    }
    const inventory = parseJson(stdout, 'INVENTORY_JSON_INVALID');
    if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory) ||
        !Array.isArray(inventory.WindowsSandboxEnvironments)) fail('INVENTORY_SCHEMA_INVALID');
    const ids = new Set();
    for (const item of inventory.WindowsSandboxEnvironments) {
      if (!item || typeof item.Id !== 'string' || !ID.test(item.Id) || ids.has(item.Id)) fail('INVENTORY_ID_INVALID');
      ids.add(item.Id);
    }
    if (ids.size !== source.current_user_visible_count) fail('OBSERVATION_COUNT_MISMATCH');
    if (stderr.length !== 0) {
      reasons.push('STDERR_NOT_EMPTY');
    } else {
      verdict = 'READ_ONLY_OBSERVATION_UNATTESTED';
    }
  } else {
    if (typeof source.reason !== 'string' || !REASON.test(source.reason)) fail('INCONCLUSIVE_REASON_REQUIRED');
    if (source.current_user_visible_count != null &&
        (!Number.isSafeInteger(source.current_user_visible_count) || source.current_user_visible_count < 0)) {
      fail('INCONCLUSIVE_COUNT_INVALID');
    }
    reasons.push('COLLECTOR_REPORTED_INCONCLUSIVE');
  }
  const audit = {
    schema: OUTPUT_SCHEMA, status: verdict, reasons,
    command: CMD, inventory_scope: SCOPE, system_wide_empty: 'NOT_ATTESTED',
    source_report_sha256: sha256(inputBytes), stdout_sha256: sha256(stdout), stderr_sha256: sha256(stderr),
    source_status: source.status, source_exit_code: source.exit_code, source_timed_out: source.timed_out,
    current_user_visible_count: verdict === 'READ_ONLY_OBSERVATION_UNATTESTED' ? source.current_user_visible_count : null,
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false, review_verified: false,
    evidence_origin_attested: false,
  };
  return { dir, inputBytes, stdout, stderr, audit };
}

export function inspectObservation(observationDir) {
  return loadObservation(observationDir).audit;
}

export function preserveObservation({ observationDir, outputDir }) {
  const out = safePath(outputDir, { kind: 'dir', mayBeAbsent: true });
  if (existsSync(out)) fail('OUTPUT_ALREADY_EXISTS');
  const root = safePath(observationDir, { kind: 'dir' });
  if (inside(root, out) || inside(out, root)) fail('OUTPUT_INPUT_OVERLAP');
  safePath(dirname(out), { kind: 'dir' });
  const captured = loadObservation(root);
  mkdirSync(out, { recursive: false });
  for (const [name, bytes] of [
    ['inventory-observation.json', captured.inputBytes],
    ['wsb-list.stdout.bin', captured.stdout],
    ['wsb-list.stderr.bin', captured.stderr],
  ]) writeFileSync(join(out, name), bytes, { flag: 'wx', mode: 0o600 });
  writeFileSync(join(out, 'read-only-audit.json'), JSON.stringify(captured.audit, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 });
  return captured.audit;
}

export function runCli(args = process.argv.slice(2)) {
  if (args.length !== 4 || args[0] !== '--observation-dir' || args[2] !== '--output-dir' ||
      !args[1] || !args[3]) fail('USAGE_OBSERVATION_OUTPUT_ONLY');
  const result = preserveObservation({ observationDir: args[1], outputDir: args[3] });
  process.stdout.write(`READ_ONLY_AUDIT=${result.status}\n`);
  return result.status === 'READ_ONLY_OBSERVATION_UNATTESTED' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runCli(); }
  catch (error) { process.stderr.write(`FAIL_CLOSED=${error.message}\n`); process.exitCode = 1; }
}
