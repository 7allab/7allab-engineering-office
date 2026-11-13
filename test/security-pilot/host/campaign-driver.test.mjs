// W1a injected campaign tests. No process, WSB, shell, network or real credential use.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { runCampaign } from './campaign-driver.mjs';
import { syntheticStep } from './host-lifecycle.mjs';
import { recordGuestAuthProvenance } from '../sandbox/guest-auth-provenance.mjs';
import { finalizeGuestResult } from '../sandbox/guest-result-finalize.mjs';

const RUN = 'k205c-w1a-fixture';
const SANDBOX = '00000000-0000-0000-0000-000000000001';
const POLICY = 'p2-managed-hooks-only.test.json';
const EMPTY = Buffer.from(JSON.stringify({ WindowsSandboxEnvironments: [] }));
const SENTINEL = 'mock-fixture-sentinel-not-a-real-key-0000';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'k205c-w1a-test-'));
  const runDir = join(base, 'export', RUN), outputDir = join(base, 'campaign-output');
  mkdirSync(runDir, { recursive: true });
  const authPath = join(base, 'guest-auth.json');
  recordGuestAuthProvenance({ mode: 'MOCK_ENDPOINT', output: authPath,
    env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8765',
      ['ANTHROPIC_API_KEY']: SENTINEL },
    now: () => '2026-11-10T12:00:00.000Z' });
  const draft = join(base, 'result.draft.json');
  writeFileSync(draft, JSON.stringify({ schema: '7allab-k205c-sandbox-run/0.1',
    run_id: RUN, policy_file: POLICY, status: 'RUN_COMPLETED_UNATTESTED',
    evidence_kind: 'MOCK_ENDPOINT', claude_exit_code: 0, claude_timed_out: false,
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false,
    review_verified: false }));
  finalizeGuestResult({ draftPath: draft, provenancePath: authPath,
    outputPath: join(runDir, 'result.json') });
  const result = readFileSync(join(runDir, 'result.json'));
  writeFileSync(join(runDir, 'MANIFEST.sha256.json'), JSON.stringify({ run_id: RUN,
    files: [{ relative_path: 'result.json', bytes: result.length, sha256: sha(result) }] }));
  writeFileSync(join(runDir, 'EXPORT.COMPLETE.json'), JSON.stringify({ run_id: RUN, file_count: 1 }));
  const calls = [];
  const statefulTransport = {
    start: async () => { calls.push('start'); return syntheticStep({ stdout: JSON.stringify({ Id: SANDBOX }) }); },
    connect: async () => { calls.push('connect'); return syntheticStep(); },
    waitForExport: async () => { calls.push('waitForExport'); return syntheticStep(); },
    stop: async () => { calls.push('stop'); return syntheticStep(); },
  };
  const inventoryCalls = [];
  const inventoryCollector = async ({ outputDir: out }) => {
    inventoryCalls.push(out); writeInventory(out); return { status: 'READ_ONLY_OBSERVATION_UNATTESTED' };
  };
  return { base, runDir, outputDir, authPath, calls, statefulTransport, inventoryCalls, inventoryCollector };
}

function writeInventory(out, change = {}) {
  mkdirSync(out);
  const stdout = change.stdout ?? EMPTY, stderr = change.stderr ?? Buffer.alloc(0);
  const report = { schema: '7allab-k205c-current-user-inventory/0.1', command: 'wsb list --raw',
    inventory_scope: 'CURRENT_USER_WSB_CLI', status: 'READ_ONLY_OBSERVATION_UNATTESTED', reason: null,
    exit_code: 0, timed_out: false, current_user_visible_count: 0, system_wide_empty: 'NOT_ATTESTED',
    stdout_sha256: sha(stdout), stderr_sha256: sha(stderr), sourceTrusted: false,
    authorityImplemented: false, operationalAuthority: false, review_verified: false, ...change.report };
  writeFileSync(join(out, 'wsb-list.stdout.bin'), stdout);
  writeFileSync(join(out, 'wsb-list.stderr.bin'), stderr);
  writeFileSync(join(out, 'binary-identity.json'), '{}');
  writeFileSync(join(out, 'inventory-observation.json'), JSON.stringify(report));
}

async function useFixture(fn) {
  const f = fixture();
  try { return await fn(f); }
  finally {
    assert.ok(resolve(f.base).startsWith(resolve(tmpdir()) + sep));
    assert.ok(f.base.split(sep).pop().startsWith('k205c-w1a-test-'));
    rmSync(f.base, { recursive: true, force: true });
  }
}
const run = (f, extra = {}) => runCampaign({ runId: RUN, sandboxId: SANDBOX, policy: POLICY,
  exportRunDir: f.runDir, outputDir: f.outputDir, authProvenancePath: f.authPath,
  statefulTransport: f.statefulTransport, inventoryCollector: f.inventoryCollector, ...extra });

test('bounded inventory evidence is wired into one full synthetic campaign', async () => useFixture(async f => {
  const result = await run(f);
  assert.equal(result.status, 'OFFLINE_CONSISTENT_UNATTESTED');
  assert.deepEqual(f.calls, ['start', 'connect', 'waitForExport', 'stop']);
  assert.equal(f.inventoryCalls.length, 2);
  assert.notEqual(f.inventoryCalls[0], f.inventoryCalls[1]);
  assert.equal(result.authorityImplemented, false);
  const input = JSON.parse(readFileSync(join(f.outputDir, 'runner-input.json')));
  assert.equal(input.events[0].inventory_source, 'CURRENT_USER_WSB_CLI');
  assert.equal(input.events.at(-1).inventory_source, 'CURRENT_USER_WSB_CLI');
}));

test('forged inventory authority fails closed before start', async () => useFixture(async f => {
  f.inventoryCollector = async ({ outputDir }) => {
    f.inventoryCalls.push(outputDir); writeInventory(outputDir,
      { report: { authorityImplemented: true } });
  };
  const result = await run(f);
  assert.equal(result.status, 'FAIL_CLOSED');
  assert.deepEqual(f.calls, []);
  assert.equal(f.inventoryCalls.length, 2);
}));

test('raw inventory hash mismatch cannot reach start', async () => useFixture(async f => {
  f.inventoryCollector = async ({ outputDir }) => {
    f.inventoryCalls.push(outputDir); writeInventory(outputDir);
    writeFileSync(join(outputDir, 'wsb-list.stdout.bin'), 'changed');
  };
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
  assert.deepEqual(f.calls, []);
}));

test('collector error is recorded twice and never starts stateful operations', async () => useFixture(async f => {
  f.inventoryCollector = async ({ outputDir }) => {
    f.inventoryCalls.push(outputDir); throw new Error('COLLECTOR_FAILED');
  };
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
  assert.deepEqual(f.calls, []);
  assert.equal(f.inventoryCalls.length, 2);
}));

test('stateful failure still stops and collects final independent inventory', async () => useFixture(async f => {
  f.statefulTransport.connect = async () => { f.calls.push('connect'); throw new Error('CONNECT_FAILED'); };
  assert.equal((await run(f)).status, 'FAIL_CLOSED');
  assert.deepEqual(f.calls, ['start', 'connect', 'stop']);
  assert.equal(f.inventoryCalls.length, 2);
}));

test('output collision and transport ambiguity are refused before collection', async () => useFixture(async f => {
  mkdirSync(f.outputDir); writeFileSync(join(f.outputDir, 'keep.txt'), 'KEEP');
  await assert.rejects(run(f), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(join(f.outputDir, 'keep.txt'), 'utf8'), 'KEEP');
  rmSync(f.outputDir, { recursive: true });
  f.statefulTransport.execute = async () => syntheticStep();
  await assert.rejects(run(f), /CAMPAIGN_TRANSPORT_INVALID/);
  assert.equal(existsSync(f.outputDir), false);
}));

test('driver source has no CLI or process execution path', () => {
  const source = readFileSync(new URL('./campaign-driver.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /node:child_process|\bspawn\s*\(|\bexecFile\s*\(|process\.argv/);
});
