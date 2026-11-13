// K2-05-C R1.6. Pure offline fixture tests; no WSB, subprocess, network, host writes.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { correlateOffline, runCli } from './offline-integrate.mjs';
import { finalizeGuestResult } from '../sandbox/guest-result-finalize.mjs';

const RUN = 'k205c-r16-fixture';
const SANDBOX = '00000000-0000-0000-0000-000000000001';
const NOW = '2026-11-10T12:00:00.000Z';
const POLICY = 'p2-managed-hooks-only.test.json';
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex').toUpperCase();
function fixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'k205c-r16-test-'));
  const runDir = join(tmp, 'export', RUN);
  mkdirSync(runDir, { recursive: true });
  let result = {
    schema: '7allab-k205c-sandbox-run/0.1', run_id: RUN, policy_file: POLICY,
    status: 'RUN_COMPLETED_UNATTESTED', evidence_kind: 'MOCK_ENDPOINT',
    claude_exit_code: 0, claude_timed_out: false,
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false,
    review_verified: false,
  };
  const stdout = join(tmp, 'final-stdout.txt');
  const stderr = join(tmp, 'final-stderr.txt');
  const auth = join(tmp, 'auth.json');
  const runnerInput = join(tmp, 'runner-input.json');
  const reportDir = join(tmp, 'fresh-report');
  const phases = ['PREFLIGHT', 'SANDBOX_START', 'CONNECT', 'WAIT_FOR_EXPORT', 'SANDBOX_STOP', 'FINAL_INVENTORY'];
  const events = phases.map((phase, i) => ({
    phase, observed_at: new Date(Date.parse(NOW) + i * 1000).toISOString(),
    exit_code: 0, timed_out: false, stdout_path: phase === 'FINAL_INVENTORY' ? stdout : null,
    stderr_path: phase === 'FINAL_INVENTORY' ? stderr : null,
    ...(phase === 'FINAL_INVENTORY' ?
      { sandbox_id: SANDBOX, inventory_source: 'CURRENT_USER_WSB_CLI' } : {}),
  }));
  const runner = {
    schema: '7allab-k205c-host-observability-input/0.1', run_id: RUN,
    sandbox_id: SANDBOX, collected_at: NOW, events, auth_provenance_path: auth,
  };
  const authData = { auth_mode: 'MOCK_ENDPOINT', credential_kind: 'SYNTHETIC_SENTINEL',
    endpoint_kind: 'LOOPBACK_MOCK', source: 'RUNNER_ENVIRONMENT', observed_at: NOW };
  writeFileSync(stdout, JSON.stringify({ WindowsSandboxEnvironments: [] }));
  writeFileSync(stderr, '');
  const authBytes = Buffer.from(JSON.stringify(authData));
  writeFileSync(auth, authBytes);
  const draftPath = join(tmp, 'result.draft.json');
  writeFileSync(draftPath, JSON.stringify(result));
  result = finalizeGuestResult({ draftPath, provenancePath: auth,
    outputPath: join(runDir, 'result.json') }).result;
  const f = { tmp, runDir, result, runnerInput, reportDir, runner, stdout, stderr, auth,
    policy: POLICY, runId: RUN, authData };
  const resultBytes = readFileSync(join(runDir, 'result.json'));
  writeFileSync(join(runDir, 'MANIFEST.sha256.json'), JSON.stringify({ run_id: RUN,
    files: [{ relative_path: 'result.json', bytes: resultBytes.length, sha256: sha(resultBytes) }] }));
  writeFileSync(join(runDir, 'EXPORT.COMPLETE.json'), JSON.stringify({ run_id: RUN, file_count: 1 }));
  saveRunner(f);
  return f;
}
function saveGuest(f) {
  const bytes = Buffer.from(JSON.stringify(f.result) + '\n');
  writeFileSync(join(f.runDir, 'result.json'), bytes);
  const manifest = { run_id: RUN, files: [{ relative_path: 'result.json', bytes: bytes.length, sha256: sha(bytes) }] };
  writeFileSync(join(f.runDir, 'MANIFEST.sha256.json'), JSON.stringify(manifest));
  writeFileSync(join(f.runDir, 'EXPORT.COMPLETE.json'), JSON.stringify({ run_id: RUN, file_count: 1 }));
}
function saveRunner(f) { writeFileSync(f.runnerInput, JSON.stringify(f.runner)); }
async function withFixture(fn) {
  const f = fixture();
  try { return await fn(f); }
  finally {
    const root = resolve(tmpdir()) + sep;
    assert.ok(resolve(f.tmp).startsWith(root) && f.tmp.split(sep).pop().startsWith('k205c-r16-test-'));
    rmSync(f.tmp, { recursive: true, force: true });
  }
}
const run = (f) => correlateOffline({ runDir: f.runDir, runId: f.runId, policy: f.policy,
  runnerInput: f.runnerInput, reportDir: f.reportDir });
const report = (f) => JSON.parse(readFileSync(join(f.reportDir, 'offline-correlation.json'), 'utf8'));

test('fully consistent synthetic data is OFFLINE_CONSISTENT_UNATTESTED, never accepted', async () => withFixture(async (f) => {
  const v = await run(f);
  assert.equal(v.status, 'OFFLINE_CONSISTENT_UNATTESTED');
  assert.deepEqual(v.reasons, []);
  assert.equal(v.export.host_manifest_verified, true);
  assert.equal(v.guest.status, 'RUN_COMPLETED_UNATTESTED');
  assert.equal(v.host.auth.auth_mode, 'MOCK_ENDPOINT');
  assert.equal(v.guest.auth.auth_mode, 'MOCK_ENDPOINT');
  assert.equal(v.guest.auth.auth_provenance.evidence_sha256,
    v.host.auth.auth_provenance.evidence_sha256);
  assert.equal(v.host.final_inventory.current_user_sessions_empty, true);
  assert.equal(v.host.final_inventory.inventory_scope, 'CURRENT_USER_WSB_CLI');
  assert.equal(v.host.final_inventory.system_wide_empty, 'NOT_ATTESTED');
  assert.equal(v.sourceTrusted, false);
  assert.equal(v.authorityImplemented, false);
  assert.equal(v.operationalAuthority, false);
  assert.equal(v.review_verified, false);
  assert.ok(existsSync(join(f.reportDir, 'host-evidence', 'host-runner-evidence.json')));
  assert.equal(report(f).status, v.status);
}));

test('all positive conditions yield exit code 0, but still unattested', async () => withFixture(async (f) => {
  const args = ['--run-dir', f.runDir, '--run-id', RUN, '--policy', POLICY,
    '--runner-input', f.runnerInput, '--report-dir', f.reportDir];
  assert.equal(await runCli(args), 0);
  assert.equal(report(f).review_verified, false);
}));

test('missing final inventory is INCONCLUSIVE', async () => withFixture(async (f) => {
  f.runner.events.pop(); saveRunner(f);
  const v = await run(f);
  assert.equal(v.status, 'INCONCLUSIVE');
  assert.ok(v.reasons.some((x) => x.includes('FINAL_INVENTORY')));
}));

test('missing independent auth provenance is INCONCLUSIVE, not inferred from guest evidence_kind', async () => withFixture(async (f) => {
  delete f.runner.auth_provenance_path; saveRunner(f);
  const v = await run(f);
  assert.equal(v.status, 'INCONCLUSIVE');
  assert.equal(v.host.auth.auth_mode, null);
  assert.ok(v.reasons.includes('MOCK_AUTH_PROVENANCE_NOT_RECORDED'));
}));

test('missing guest runtime provenance stays INCONCLUSIVE for immutable legacy evidence', async () => withFixture(async (f) => {
  delete f.result.auth_mode; delete f.result.auth_provenance; saveGuest(f);
  const v = await run(f);
  assert.equal(v.status, 'INCONCLUSIVE');
  assert.ok(v.reasons.includes('GUEST_AUTH_PROVENANCE_NOT_RECORDED'));
}));

test('guest provenance hash mismatch fails closed', async () => withFixture(async (f) => {
  f.result.auth_provenance.evidence_sha256 = 'A'.repeat(64); saveGuest(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('HOST_GUEST_AUTH_PROVENANCE_MISMATCH'));
}));

test('guest provenance fields cannot be inferred from evidence_kind', async () => withFixture(async (f) => {
  f.result.auth_provenance.credential_kind = 'NONE'; saveGuest(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('EXPORT_OR_GUEST_GUEST_AUTH_PROVENANCE_INVALID'));
}));

test('other current-user-visible Sandbox means INCONCLUSIVE, not globally empty', async () => withFixture(async (f) => {
  writeFileSync(f.stdout, JSON.stringify({ WindowsSandboxEnvironments: [{ Id: 'another-sandbox' }] }));
  const v = await run(f);
  assert.equal(v.status, 'INCONCLUSIVE');
  assert.equal(v.host.final_inventory.current_user_sessions_empty, false);
  assert.equal(v.host.final_inventory.system_wide_empty, 'NOT_ATTESTED');
  assert.ok(v.reasons.includes('CURRENT_USER_WSB_INVENTORY_NOT_EMPTY'));
}));

test('failed sandbox stop is FAIL_CLOSED', async () => withFixture(async (f) => {
  f.runner.events[4].exit_code = 1; f.runner.events[4].error_code = 'SANDBOX_STOP_FAILED'; saveRunner(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('HOST_EVENT_FAILED'));
}));

test('timeout with exit zero cannot be treated as success', async () => withFixture(async (f) => {
  f.runner.events[2].timed_out = true; saveRunner(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('guest RUN_FAILED_CLOSED cannot be consistent success', async () => withFixture(async (f) => {
  f.result.status = 'RUN_FAILED_CLOSED'; saveGuest(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('GUEST_RUN_FAILED_CLOSED'));
}));

test('guest status may not be inflated to PASS', async () => withFixture(async (f) => {
  f.result.status = 'PASS'; saveGuest(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('a missing result.json fails even with syntactically valid manifest', async () => withFixture(async (f) => {
  const m = { run_id: RUN, files: [{ relative_path: 'other.json', bytes: 2, sha256: sha('{}') }] };
  rmSync(join(f.runDir, 'result.json'));
  writeFileSync(join(f.runDir, 'other.json'), '{}');
  writeFileSync(join(f.runDir, 'MANIFEST.sha256.json'), JSON.stringify(m));
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('changed exported result hash fails closed', async () => withFixture(async (f) => {
  writeFileSync(join(f.runDir, 'result.json'), '{}');
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('missing completion marker fails closed', async () => withFixture(async (f) => {
  rmSync(join(f.runDir, 'EXPORT.COMPLETE.json'));
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('policy mismatch fails closed even when manifest is correctly rehashed', async () => withFixture(async (f) => {
  f.result.policy_file = 'p1-baseline.test.json'; saveGuest(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('guest run id mismatch fails closed', async () => withFixture(async (f) => {
  f.result.run_id = 'other-run'; saveGuest(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('host run id mismatch fails closed, independent of export', async () => withFixture(async (f) => {
  f.runner.run_id = 'different-run'; saveRunner(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('falsely claimed authority fails closed', async () => withFixture(async (f) => {
  f.result.authorityImplemented = true; saveGuest(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('host auth REAL is rejected, not interpreted as success', async () => withFixture(async (f) => {
  f.authData.auth_mode = 'REAL'; f.authData.credential_kind = 'REAL_CREDENTIAL';
  f.authData.endpoint_kind = 'REAL_SERVICE'; writeFileSync(f.auth, JSON.stringify(f.authData));
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('different host auth NONE contradicts a MOCK_ENDPOINT guest and fails closed', async () => withFixture(async (f) => {
  f.authData.auth_mode = 'NONE'; f.authData.credential_kind = 'NONE'; f.authData.endpoint_kind = 'NONE';
  writeFileSync(f.auth, JSON.stringify(f.authData));
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('HOST_GUEST_AUTH_PROVENANCE_MISMATCH'));
}));

test('duplicate host lifecycle phase fails closed', async () => withFixture(async (f) => {
  f.runner.events.splice(2, 0, { ...f.runner.events[2] }); saveRunner(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('DUPLICATE_HOST_PHASE'));
}));

test('final inventory preceding stop in observed time fails closed', async () => withFixture(async (f) => {
  f.runner.events[5].observed_at = new Date(Date.parse(NOW) - 1000).toISOString(); saveRunner(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('FINAL_INVENTORY_BEFORE_STOP'));
}));


test('a claimed guest success with failed Claude exit cannot pass', async () => withFixture(async (f) => {
  f.result.claude_exit_code = 13; saveGuest(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('a claimed guest success with missing timeout status cannot pass', async () => withFixture(async (f) => {
  delete f.result.claude_timed_out; saveGuest(f);
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
}));

test('out-of-order lifecycle stages fail closed even when every exit code is zero', async () => withFixture(async (f) => {
  const swap = f.runner.events[1]; f.runner.events[1] = f.runner.events[2]; f.runner.events[2] = swap;
  saveRunner(f);
  const v = await run(f);
  assert.equal(v.status, 'FAIL_CLOSED');
  assert.ok(v.reasons.includes('HOST_LIFECYCLE_ORDER_INVALID'));
}));

test('existing output directory never overwritten', async () => withFixture(async (f) => {
  mkdirSync(f.reportDir); writeFileSync(join(f.reportDir, 'keep.txt'), 'user data');
  await assert.rejects(run(f), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(join(f.reportDir, 'keep.txt'), 'utf8'), 'user data');
}));

test('output inside export is prohibited; no report directory created', async () => withFixture(async (f) => {
  f.reportDir = join(f.runDir, 'new-report');
  await assert.rejects(run(f), /OUTPUT_INPUT_OVERLAP/);
  assert.equal(existsSync(f.reportDir), false);
}));

test('symlink runner input is rejected where supported', async (t) => withFixture(async (f) => {
  const link = join(f.tmp, 'runner-link.json');
  try { symlinkSync(f.runnerInput, link); }
  catch (e) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(e.code)) return t.skip('no symlink privilege'); throw e; }
  f.runnerInput = link;
  await assert.rejects(run(f), /SYMLINK_PATH_REFUSED/);
}));

test('unknown or dangerous CLI flags refused', async () => {
  await assert.rejects(runCli(['--execute', 'wsb']), /INVALID_CLI_ARGUMENTS/);
});

test('empty CLI JSON without an inventory source never achieves positive correlation',async()=>withFixture(async(f)=>{
  delete f.runner.events[5].inventory_source;saveRunner(f);
  const v=await run(f);
  assert.equal(v.status,'INCONCLUSIVE');
  assert.ok(v.reasons.includes('FINAL_INVENTORY_INCONCLUSIVE'));
  assert.equal(v.host.final_inventory.reason,'INVENTORY_SOURCE_UNVERIFIED');
  assert.equal(v.review_verified,false);
}));

test('global-looking source label cannot upgrade user-visible empty list',async()=>withFixture(async(f)=>{
  f.runner.events[5].inventory_source='GLOBAL_WSB_CLI';saveRunner(f);
  const v=await run(f);
  assert.equal(v.status,'INCONCLUSIVE');
  assert.ok(v.reasons.includes('FINAL_INVENTORY_INCONCLUSIVE'));
  assert.equal(v.authorityImplemented,false);
}));
