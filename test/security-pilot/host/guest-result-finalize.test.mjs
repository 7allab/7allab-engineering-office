import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { finalizeGuestResult, runCli } from '../sandbox/guest-result-finalize.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'k205c-r2d-result-'));
  const draftPath = join(root, 'result.draft.json'), provenancePath = join(root, 'auth.json');
  const outputPath = join(root, 'result.json');
  const draft = { schema: '7allab-k205c-sandbox-run/0.1', run_id: 'future-run-p2',
    policy_file: 'p2-managed-hooks-only.test.json', status: 'RUN_COMPLETED_UNATTESTED',
    evidence_kind: 'MOCK_ENDPOINT', claude_exit_code: 0, claude_timed_out: false, error: null,
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false, review_verified: false };
  const provenance = { auth_mode: 'MOCK_ENDPOINT', credential_kind: 'SYNTHETIC_SENTINEL',
    endpoint_kind: 'LOOPBACK_MOCK', source: 'RUNNER_ENVIRONMENT', observed_at: '2026-11-10T20:30:00.000Z' };
  writeFileSync(draftPath, JSON.stringify(draft)); writeFileSync(provenancePath, JSON.stringify(provenance));
  return { root, draftPath, provenancePath, outputPath, draft, provenance };
}
async function useFixture(run) {
  const f = fixture();
  try { return await run(f); }
  finally { assert.ok(resolve(f.root).startsWith(resolve(tmpdir()) + sep)); rmSync(f.root, { recursive: true, force: true }); }
}
const save = f => writeFileSync(f.draftPath, JSON.stringify(f.draft));
const auth = f => writeFileSync(f.provenancePath, JSON.stringify(f.provenance));

test('new guest result binds exact provenance bytes and preserves inputs', () => useFixture(f => {
  const draftBefore = readFileSync(f.draftPath), authBefore = readFileSync(f.provenancePath);
  const completed = finalizeGuestResult(f);
  assert.equal(completed.result.auth_mode, 'MOCK_ENDPOINT');
  assert.match(completed.result.auth_provenance.evidence_sha256, /^[A-F0-9]{64}$/);
  assert.deepEqual(readFileSync(f.draftPath), draftBefore); assert.deepEqual(readFileSync(f.provenancePath), authBefore);
  assert.deepEqual(JSON.parse(readFileSync(f.outputPath)), completed.result);
}));
test('NONE provenance remains explicit and unattested', () => useFixture(f => {
  f.provenance = { auth_mode: 'NONE', credential_kind: 'NONE', endpoint_kind: 'NONE',
    source: 'RUNNER_ENVIRONMENT', observed_at: f.provenance.observed_at }; auth(f);
  assert.equal(finalizeGuestResult(f).result.auth_mode, 'NONE');
}));
test('REAL provenance is always refused', () => useFixture(f => {
  f.provenance.auth_mode = 'REAL'; f.provenance.credential_kind = 'REAL_CREDENTIAL';
  f.provenance.endpoint_kind = 'REAL_SERVICE'; auth(f);
  assert.throws(() => finalizeGuestResult(f), /REAL_AUTH_REFUSED/);
}));
test('contradictory provenance is refused', () => useFixture(f => {
  f.provenance.credential_kind = 'NONE'; auth(f);
  assert.throws(() => finalizeGuestResult(f), /AUTH_PROVENANCE_MISMATCH/);
}));
test('pre-filled auth fields cannot bypass the independent record', () => useFixture(f => {
  f.draft.auth_mode = 'MOCK_ENDPOINT'; save(f);
  assert.throws(() => finalizeGuestResult(f), /RESULT_AUTH_ALREADY_PRESENT/);
}));
test('authority inflation and contradictory success are refused', () => useFixture(f => {
  f.draft.authorityImplemented = true; save(f);
  assert.throws(() => finalizeGuestResult(f), /RESULT_AUTHORITY_INVALID/);
  delete f.draft.authorityImplemented; f.draft.authorityImplemented = false; f.draft.claude_exit_code = 9; save(f);
  assert.throws(() => finalizeGuestResult(f), /RESULT_SUCCESS_FIELDS_INVALID/);
}));
test('existing output is never overwritten', () => useFixture(f => {
  writeFileSync(f.outputPath, 'keep');
  assert.throws(() => finalizeGuestResult(f), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(f.outputPath, 'utf8'), 'keep');
}));
test('symlinked provenance is refused where supported', t => useFixture(f => {
  const target = join(f.root, 'auth-target.json'); writeFileSync(target, readFileSync(f.provenancePath)); rmSync(f.provenancePath);
  try { symlinkSync(target, f.provenancePath); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('no symlink privilege'); throw error; }
  assert.throws(() => finalizeGuestResult(f), /SYMLINK_PATH_REFUSED/);
}));
test('unknown policy and invalid run ID are refused', () => useFixture(f => {
  f.draft.policy_file = 'unknown.json'; save(f);
  assert.throws(() => finalizeGuestResult(f), /RESULT_ID_OR_POLICY_INVALID/);
  f.draft.policy_file = 'p2-managed-hooks-only.test.json'; f.draft.run_id = '../escape'; save(f);
  assert.throws(() => finalizeGuestResult(f), /RESULT_ID_OR_POLICY_INVALID/);
}));
test('CLI accepts only three data paths', () => {
  assert.throws(() => runCli(['--execute', 'claude']), /USAGE_DRAFT_PROVENANCE_OUTPUT_ONLY/);
});
