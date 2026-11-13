#!/usr/bin/env node
// R2-D: binds a new guest result to independently recorded auth provenance without touching history.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const POLICIES = new Set([
  'p1-baseline.test.json', 'p2-managed-hooks-only.test.json',
  'p3-onfailure-missing-script.test.json', 'p4-onfailure-error.test.json',
  'p5-onfailure-timeout.test.json', 'p6-control-error-without-onfailure.test.json',
  'p2-permission-request-probe.test.json',
]);
const fail = (code) => { throw new Error(code); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

function checkedPath(path, { absent = false, maxBytes = null, kind = 'file' } = {}) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) {
      if (!absent || cursor !== full) fail('PATH_NOT_FOUND');
      continue;
    }
    const item = lstatSync(cursor);
    if (item.isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
    if (cursor === full && kind === 'file' && !item.isFile()) fail('REGULAR_FILE_REQUIRED');
    if (cursor === full && kind === 'dir' && !item.isDirectory()) fail('DIRECTORY_REQUIRED');
    if (cursor === full && maxBytes != null && item.size > maxBytes) fail('INPUT_SIZE_LIMIT');
  }
  return full;
}

function json(path, maxBytes, code) {
  const bytes = readFileSync(checkedPath(path, { maxBytes }));
  try { return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), bytes }; }
  catch { fail(code); }
}

function validateResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schema !== '7allab-k205c-sandbox-run/0.1') fail('RESULT_CONTRACT_INVALID');
  if (!RUN_ID.test(value.run_id) || !POLICIES.has(value.policy_file)) fail('RESULT_ID_OR_POLICY_INVALID');
  if (!['RUN_COMPLETED_UNATTESTED', 'RUN_FAILED_CLOSED'].includes(value.status) ||
      value.evidence_kind !== 'MOCK_ENDPOINT') fail('RESULT_STATUS_OR_EVIDENCE_INVALID');
  if (value.sourceTrusted !== false || value.authorityImplemented !== false ||
      value.operationalAuthority !== false || value.review_verified !== false) fail('RESULT_AUTHORITY_INVALID');
  if (Object.hasOwn(value, 'auth_mode') || Object.hasOwn(value, 'auth_provenance')) fail('RESULT_AUTH_ALREADY_PRESENT');
  if (value.status === 'RUN_COMPLETED_UNATTESTED' &&
      (value.claude_exit_code !== 0 || value.claude_timed_out !== false || value.error != null))
    fail('RESULT_SUCCESS_FIELDS_INVALID');
}

function validateProvenance(value) {
  const allowed = new Set(['auth_mode', 'credential_kind', 'endpoint_kind', 'source', 'observed_at']);
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.has(key)) || value.source !== 'RUNNER_ENVIRONMENT' ||
      typeof value.observed_at !== 'string' || !Number.isFinite(Date.parse(value.observed_at)))
    fail('AUTH_PROVENANCE_INVALID');
  if (value.auth_mode === 'MOCK_ENDPOINT' && value.credential_kind === 'SYNTHETIC_SENTINEL' &&
      value.endpoint_kind === 'LOOPBACK_MOCK') return;
  if (value.auth_mode === 'NONE' && value.credential_kind === 'NONE' && value.endpoint_kind === 'NONE') return;
  fail(value.auth_mode === 'REAL' ? 'REAL_AUTH_REFUSED' : 'AUTH_PROVENANCE_MISMATCH');
}

export function finalizeGuestResult({ draftPath, provenancePath, outputPath }) {
  const output = checkedPath(outputPath, { absent: true });
  if (existsSync(output)) fail('OUTPUT_ALREADY_EXISTS');
  checkedPath(dirname(output), { kind: 'dir' });
  const draft = json(draftPath, 1024 * 1024, 'RESULT_JSON_INVALID');
  const provenance = json(provenancePath, 128 * 1024, 'AUTH_JSON_INVALID');
  validateResult(draft.value);
  validateProvenance(provenance.value);
  const result = { ...draft.value, auth_mode: provenance.value.auth_mode,
    auth_provenance: { credential_kind: provenance.value.credential_kind,
      endpoint_kind: provenance.value.endpoint_kind, source: provenance.value.source,
      evidence_sha256: sha256(provenance.bytes), notes: 'guest runtime environment record; unattested' } };
  const bytes = Buffer.from(JSON.stringify(result, null, 2) + '\n');
  writeFileSync(output, bytes, { flag: 'wx', mode: 0o600 });
  return { result, result_sha256: sha256(bytes) };
}

export function runCli(args = process.argv.slice(2)) {
  if (args.length !== 6 || args[0] !== '--draft' || args[2] !== '--provenance' || args[4] !== '--output' ||
      !args[1] || !args[3] || !args[5]) fail('USAGE_DRAFT_PROVENANCE_OUTPUT_ONLY');
  const completed = finalizeGuestResult({ draftPath: args[1], provenancePath: args[3], outputPath: args[5] });
  process.stdout.write(`GUEST_RESULT=${completed.result.status} SHA256=${completed.result_sha256}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCli(); }
  catch (error) { process.stderr.write(`FAIL_CLOSED=${error.message}\n`); process.exitCode = 1; }
}
