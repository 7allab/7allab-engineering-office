// R2-C1: all fixtures and writes remain under a fresh OS temp directory; no WSB execution.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { readFileSync as readSource } from 'node:fs';
import { test } from 'node:test';
import { inspectObservation, preserveObservation, runCli } from './read-only-observation.mjs';

const sha = (raw) => createHash('sha256').update(raw).digest('hex').toUpperCase();
const NOW = '2026-11-10T17:00:00.0000000Z';
function fixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'k205c-r2c1-fixture-'));
  const observationDir = join(tmp, 'observation');
  mkdirSync(observationDir);
  const stdout = Buffer.from(JSON.stringify({ WindowsSandboxEnvironments: [] }));
  const stderr = Buffer.alloc(0);
  const report = {
    schema: '7allab-k205c-current-user-inventory/0.1', command: 'wsb list --raw',
    inventory_scope: 'CURRENT_USER_WSB_CLI', status: 'READ_ONLY_OBSERVATION_UNATTESTED',
    reason: null, observed_at_start: NOW, observed_at_end: NOW,
    exit_code: 0, timed_out: false, current_user_visible_count: 0,
    system_wide_empty: 'NOT_ATTESTED', stdout_sha256: sha(stdout), stderr_sha256: sha(stderr),
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false, review_verified: false,
  };
  const f = { tmp, observationDir, outputDir: join(tmp, 'fresh-audit'), stdout, stderr, report };
  save(f);
  return f;
}
function save(f) {
  f.report.stdout_sha256 = sha(f.stdout);
  f.report.stderr_sha256 = sha(f.stderr);
  writeFileSync(join(f.observationDir, 'inventory-observation.json'), JSON.stringify(f.report) + '\n');
  writeFileSync(join(f.observationDir, 'wsb-list.stdout.bin'), f.stdout);
  writeFileSync(join(f.observationDir, 'wsb-list.stderr.bin'), f.stderr);
}
async function withFixture(run) {
  const f = fixture();
  try { return await run(f); }
  finally {
    const root = resolve(tmpdir()) + sep;
    assert.ok(resolve(f.tmp).startsWith(root) && f.tmp.split(sep).pop().startsWith('k205c-r2c1-fixture-'));
    rmSync(f.tmp, { recursive: true, force: true });
  }
}
const inspect = (f) => inspectObservation(f.observationDir);
const persist = (f) => preserveObservation({ observationDir: f.observationDir, outputDir: f.outputDir });

test('valid empty current-user observation stays UNATTESTED, never security acceptance', () => withFixture(f => {
  const got = inspect(f);
  assert.equal(got.status, 'READ_ONLY_OBSERVATION_UNATTESTED');
  assert.equal(got.current_user_visible_count, 0);
  assert.equal(got.system_wide_empty, 'NOT_ATTESTED');
  for (const claim of ['sourceTrusted', 'authorityImplemented', 'operationalAuthority', 'review_verified', 'evidence_origin_attested']) {
    assert.equal(got[claim], false);
  }
}));
test('nonempty current-user observation is recorded without a system-wide claim', () => withFixture(f => {
  f.stdout = Buffer.from('{"WindowsSandboxEnvironments":[{"Id":"one-id"}]}');
  f.report.current_user_visible_count = 1;
  save(f);
  const got = inspect(f);
  assert.equal(got.status, 'READ_ONLY_OBSERVATION_UNATTESTED');
  assert.equal(got.current_user_visible_count, 1);
  assert.equal(got.system_wide_empty, 'NOT_ATTESTED');
}));
test('preserved evidence is copied byte-for-byte and SHA bound', () => withFixture(f => {
  const got = persist(f);
  for (const filename of ['inventory-observation.json', 'wsb-list.stdout.bin', 'wsb-list.stderr.bin']) {
    assert.deepEqual(readFileSync(join(f.outputDir, filename)), readFileSync(join(f.observationDir, filename)));
  }
  assert.equal(got.source_report_sha256, sha(readFileSync(join(f.outputDir, 'inventory-observation.json'))));
  assert.deepEqual(JSON.parse(readFileSync(join(f.outputDir, 'read-only-audit.json'))), got);
}));
test('source stdout tampering is refused before any output', () => withFixture(f => {
  writeFileSync(join(f.observationDir, 'wsb-list.stdout.bin'), '{"WindowsSandboxEnvironments":[{"Id":"tampered"}]}');
  assert.throws(() => persist(f), /OBSERVATION_HASH_MISMATCH/);
  assert.equal(existsSync(f.outputDir), false);
}));
test('source stderr tampering is refused', () => withFixture(f => {
  writeFileSync(join(f.observationDir, 'wsb-list.stderr.bin'), 'warning');
  assert.throws(() => inspect(f), /OBSERVATION_HASH_MISMATCH/);
}));
test('anything other than exact list --raw command is refused', () => withFixture(f => {
  f.report.command = 'wsb start'; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_AUTHORITY_OR_SCOPE_INVALID/);
}));
test('system-wide source is never accepted', () => withFixture(f => {
  f.report.inventory_scope = 'GLOBAL_WSB_CLI'; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_AUTHORITY_OR_SCOPE_INVALID/);
}));
test('system-wide empty true is never accepted', () => withFixture(f => {
  f.report.system_wide_empty = true; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_AUTHORITY_OR_SCOPE_INVALID/);
}));
test('any elevated authority assertion is refused', () => withFixture(f => {
  f.report.authorityImplemented = true; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_AUTHORITY_OR_SCOPE_INVALID/);
}));
test('positive outcome may not be inflated to PASS', () => withFixture(f => {
  f.report.status = 'PASS'; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_STATUS_INVALID/);
}));
test('nonzero exit with positive outcome is refused', () => withFixture(f => {
  f.report.exit_code = 2; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_POSITIVE_FIELDS_CONTRADICTORY/);
}));
test('timeout with zero exit and positive outcome is refused', () => withFixture(f => {
  f.report.timed_out = true; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_POSITIVE_FIELDS_CONTRADICTORY/);
}));
test('missing inventory file is refused', () => withFixture(f => {
  rmSync(join(f.observationDir, 'wsb-list.stdout.bin'));
  assert.throws(() => inspect(f), /PATH_NOT_FOUND/);
}));
test('positive status with malformed inventory JSON is refused', () => withFixture(f => {
  f.stdout = Buffer.from('{oops'); save(f);
  assert.throws(() => inspect(f), /INVENTORY_JSON_INVALID/);
}));
test('positive status cannot misreport current-user count', () => withFixture(f => {
  f.report.current_user_visible_count = 1; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_COUNT_MISMATCH/);
}));
test('duplicated sandbox IDs are refused', () => withFixture(f => {
  f.stdout = Buffer.from('{"WindowsSandboxEnvironments":[{"Id":"x"},{"Id":"x"}]}');
  f.report.current_user_visible_count = 2; save(f);
  assert.throws(() => inspect(f), /INVENTORY_ID_INVALID/);
}));
test('stderr warning downgrades success to INCONCLUSIVE', () => withFixture(f => {
  f.stderr = Buffer.from('diagnostic-warning'); save(f);
  const got = inspect(f);
  assert.equal(got.status, 'INCONCLUSIVE');
  assert.equal(got.current_user_visible_count, null);
  assert.ok(got.reasons.includes('STDERR_NOT_EMPTY'));
}));
test('collector-declared INCONCLUSIVE stays inconclusive and retains output', () => withFixture(f => {
  f.report.status = 'INCONCLUSIVE'; f.report.reason = 'CLI_TIMEOUT';
  f.report.timed_out = true; f.report.exit_code = null; f.report.current_user_visible_count = null;
  f.stdout = Buffer.from('partial data'); save(f);
  assert.equal(persist(f).status, 'INCONCLUSIVE');
  assert.equal(readFileSync(join(f.outputDir, 'wsb-list.stdout.bin'), 'utf8'), 'partial data');
}));
test('existing output directory and user file are never overwritten', () => withFixture(f => {
  mkdirSync(f.outputDir); writeFileSync(join(f.outputDir, 'user.txt'), 'keep');
  assert.throws(() => persist(f), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(join(f.outputDir, 'user.txt'), 'utf8'), 'keep');
}));
test('output inside observation source is refused', () => withFixture(f => {
  f.outputDir = join(f.observationDir, 'new');
  assert.throws(() => persist(f), /OUTPUT_INPUT_OVERLAP/);
  assert.equal(existsSync(f.outputDir), false);
}));
test('output ancestor of source is refused', () => withFixture(f => {
  f.outputDir = f.tmp;
  assert.throws(() => persist(f), /OUTPUT_ALREADY_EXISTS/);
}));
test('symlinked source file is refused where supported', (t) => withFixture(f => {
  const target = join(f.tmp, 'indirection.bin');
  const link = join(f.observationDir, 'wsb-list.stdout.bin');
  writeFileSync(target, f.stdout);
  rmSync(link);
  try { symlinkSync(target, link); }
  catch (e) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(e.code)) return t.skip('no symlink privileges'); throw e; }
  assert.throws(() => inspect(f), /SYMLINK_PATH_REFUSED/);
}));
test('oversized raw stdout is refused before JSON processing', () => withFixture(f => {
  f.stdout = Buffer.alloc(1024 * 1024 + 1, 0x20); save(f);
  assert.throws(() => inspect(f), /EVIDENCE_SIZE_LIMIT/);
}));
test('invalid UTC timestamp and future-before-start are refused', () => withFixture(f => {
  f.report.observed_at_end = '2026-11-10T16:00:00.000Z'; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_TIME_ORDER_INVALID/);
  f.report.observed_at_end = 'not-a-date'; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_TIMESTAMP_INVALID/);
}));
test('unknown keys cannot smuggle an authority claim', () => withFixture(f => {
  f.report.acceptance = 'PASS'; save(f);
  assert.throws(() => inspect(f), /OBSERVATION_UNKNOWN_FIELD/);
}));
test('CLI allows only two data paths and cannot invoke a host command', () => {
  assert.throws(() => runCli(['--start', 'yes']), /USAGE_OBSERVATION_OUTPUT_ONLY/);
  assert.throws(() => runCli(['--observation-dir', '/tmp', '--output-dir', '/tmp', '--execute', 'wsb']), /USAGE_OBSERVATION_OUTPUT_ONLY/);
  const raw = readSource(new URL('./read-only-observation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(raw, /\b(?:spawn|execFile|execSync|child_process)\s*\(/);
});
