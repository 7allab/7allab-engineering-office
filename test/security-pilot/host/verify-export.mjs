#!/usr/bin/env node
// K2-05-C-R1: offline host-side verification of a completed guest export.
// No Sandbox/Hyper-V calls, network, package installation, or source modification.
// An attestation is written to a NEW, caller-chosen report directory; never to the export.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const VALID_SHA256 = /^[a-fA-F0-9]{64}$/;
const RESERVED = new Set(['manifest.sha256.json', 'export.complete.json']);
const ALLOWED_EXTENSIONS = new Set(['.json', '.jsonl', '.log', '.txt', '.sha256']);
const MAX_JSON_BYTES = 2 * 1024 * 1024;

function fail(code) { throw new Error(code); }
function checkRunId(runId) {
  if (!VALID_RUN_ID.test(runId) || runId === '.' || runId === '..') fail('INVALID_RUN_ID');
}
function isInside(root, path) {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function assertNoLinks(path, label) {
  const absolute = resolve(path);
  let segment = parse(absolute).root;
  for (const part of absolute.slice(segment.length).split(sep).filter(Boolean)) {
    segment = join(segment, part);
    const st = lstatSync(segment);
    if (st.isSymbolicLink()) fail(`${label}_SYMLINK_REFUSED`);
  }
}
function normalizedRelativePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0') || path.includes(':')) fail('INVALID_MANIFEST_PATH');
  const slash = path.replaceAll('\\', '/');
  if (slash.startsWith('/') || slash.includes('//') || slash.includes('\u0000')) fail('INVALID_MANIFEST_PATH');
  const parts = slash.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || /[\x00-\x1f*?<>|]/.test(p))) fail('INVALID_MANIFEST_PATH');
  if (RESERVED.has(slash.toLowerCase())) fail('RESERVED_MANIFEST_PATH');
  return parts.join('/');
}
async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex').toUpperCase();
}
function parseJsonFile(path) {
  const st = lstatSync(path);
  if (!st.isFile() || st.size > MAX_JSON_BYTES) fail('INVALID_JSON_FILE');
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { fail('INVALID_JSON_CONTENT'); }
}
function listExportFiles(root) {
  const found = [];
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const full = join(folder, name);
      const entry = lstatSync(full);
      if (entry.isSymbolicLink()) fail('SYMLINK_IN_EXPORT');
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) found.push(relative(root, full).split(sep).join('/'));
      else fail('UNEXPECTED_EXPORT_FILE_TYPE');
    }
  };
  walk(root);
  return found;
}

export async function verifyExport(runDir, expectedRunId) {
  checkRunId(expectedRunId);
  assertNoLinks(runDir, 'EXPORT_ROOT');
  const root = realpathSync(runDir);
  if (!lstatSync(root).isDirectory()) fail('EXPORT_NOT_DIRECTORY');
  const manifestPath = join(root, 'MANIFEST.sha256.json');
  const completionPath = join(root, 'EXPORT.COMPLETE.json');
  assertNoLinks(manifestPath, 'MANIFEST');
  assertNoLinks(completionPath, 'COMPLETION');
  const manifest = parseJsonFile(manifestPath);
  const completion = parseJsonFile(completionPath);
  if (manifest.run_id !== expectedRunId || completion.run_id !== expectedRunId) fail('RUN_ID_MISMATCH');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) fail('EMPTY_MANIFEST');
  if (!Number.isSafeInteger(completion.file_count) || completion.file_count !== manifest.files.length) fail('FILE_COUNT_MISMATCH');

  const keys = new Set();
  for (const file of manifest.files) {
    if (!file || typeof file !== 'object') fail('INVALID_MANIFEST_ENTRY');
    const name = normalizedRelativePath(file.relative_path);
    const key = name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extname(key))) fail('DISALLOWED_EXPORT_EXTENSION');
    if (keys.has(key)) fail('DUPLICATE_MANIFEST_ENTRY');
    keys.add(key);
    if (typeof file.sha256 !== 'string' || !VALID_SHA256.test(file.sha256)) fail('INVALID_ENTRY_HASH');
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) fail('INVALID_ENTRY_SIZE');
    const candidate = resolve(root, ...name.split('/'));
    if (!isInside(root, candidate)) fail('MANIFEST_PATH_ESCAPE');
    assertNoLinks(candidate, 'FILE');
    const st = lstatSync(candidate);
    if (!st.isFile() || st.size !== file.bytes) fail('ENTRY_SIZE_MISMATCH');
    if ((await hashFile(candidate)) !== file.sha256.toUpperCase()) fail('ENTRY_SHA256_MISMATCH');
  }
  const present = listExportFiles(root);
  const actual = new Set(present.map((name) => name.toLowerCase()));
  if (actual.size !== present.length) fail('CASE_COLLISION_IN_EXPORT');
  const expected = new Set([...keys, ...RESERVED]);
  if (actual.size !== expected.size || [...actual].some((name) => !expected.has(name))) fail('UNLISTED_OR_MISSING_EXPORT_FILE');

  return Object.freeze({
    run_id: expectedRunId,
    host_manifest_verified: true,
    verified_file_count: manifest.files.length,
    manifest_sha256: await hashFile(manifestPath),
    completion_sha256: await hashFile(completionPath),
  });
}

function argsFromCli(argv) {
  const options = {};
  const allowed = new Set(['--run-dir', '--run-id', '--report-dir']);
  for (let i = 0; i < argv.length; i += 2) {
    if (!allowed.has(argv[i]) || i + 1 >= argv.length || Object.hasOwn(options, argv[i])) fail('INVALID_CLI_ARGUMENTS');
    options[argv[i]] = argv[i + 1];
  }
  if (Object.keys(options).length !== 3) fail('MISSING_CLI_ARGUMENTS');
  return options;
}

export async function runCli(argv) {
  const options = argsFromCli(argv);
  const runDir = resolve(options['--run-dir']);
  const reportDir = resolve(options['--report-dir']);
  const runId = options['--run-id'];
  checkRunId(runId);
  if (isInside(runDir, reportDir) || isInside(reportDir, runDir) || runDir === reportDir) fail('REPORT_EXPORT_OVERLAP');
  if (existsSync(reportDir)) fail('REPORT_DIRECTORY_ALREADY_EXISTS');
  assertNoLinks(dirname(reportDir), 'REPORT_PARENT');
  // Refuse silently recreating an existing directory, including concurrent races.
  mkdirSync(reportDir);
  const recordedAt = new Date().toISOString();
  let status;
  try {
    const verified = await verifyExport(runDir, runId);
    status = { schema: '7allab-k205c-host-verification/0.1', recorded_at_utc: recordedAt, ...verified, failure_code: null };
  } catch (error) {
    status = {
      schema: '7allab-k205c-host-verification/0.1', recorded_at_utc: recordedAt,
      run_id: runId, host_manifest_verified: false,
      verified_file_count: 0, manifest_sha256: null, completion_sha256: null,
      failure_code: error?.code || (error?.message || 'UNEXPECTED_ERROR').replace(/[^A-Z0-9_]/g, '_').slice(0, 96),
    };
  }
  // Never claim success before the verification report has been persisted.
  writeFileSync(join(reportDir, 'host-manifest-verification.json'), JSON.stringify(status, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`host_manifest_verified=${status.host_manifest_verified}\n`);
  if (!status.host_manifest_verified) process.stderr.write(`FAIL_CLOSED=${status.failure_code}\n`);
  return status.host_manifest_verified ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`VERIFY_EXPORT_FAILED_CLOSED: ${error?.message || 'UNKNOWN'}\n`);
    process.exitCode = 1;
  });
}
