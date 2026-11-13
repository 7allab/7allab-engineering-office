// Local synthetic tests for the PermissionRequest S1/S2 probe and the S3 guarded allow-control arm (source-only; no Sandbox, no network, no credentials).
// PASS here = source contracts hold. It is NOT a live enforcement result and does not raise any acceptance status.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { executeLivePlan, payloadSourcesFor, validatePayload } from './w1b-live-runner.mjs';
import { buildSandboxConfig } from './wsb-stateful-transport.mjs';
import { captureAndCorrelate } from './host-lifecycle.mjs';
import { correlateOffline } from './offline-integrate.mjs';
import { finalizeGuestResult } from '../sandbox/guest-result-finalize.mjs';
import { decide } from '../hooks/permission-probe.mjs';

const PACKAGE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROBE_POLICY = 'p2-permission-request-probe.test.json';
const ALLOW_POLICY = 'p2-permission-request-allow-control.test.json';
const GUARDED_POLICY = 'p2-pretooluse-guard-allow-control.test.json';
const P2_POLICY = 'p2-managed-hooks-only.test.json';
const P2_POLICY_SHA256 = 'a1acf555f52f12285f571e0bdc1cba1bf2dd3328e051f10877b6b738679d5772';
const REPO = resolve(PACKAGE, '..', '..');
const HOOK = join(PACKAGE, 'hooks', 'permission-probe.mjs');
const read = (...parts) => readFileSync(join(PACKAGE, ...parts), 'utf8');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const created = [];
const temp = (prefix) => { const dir = mkdtempSync(join(tmpdir(), prefix)); created.push(dir); return dir; };
after(() => {
  for (const dir of created) {
    // Only remove directories this file created itself, directly under the OS temp root.
    if (dirname(dir) === resolve(tmpdir()) && basename(dir).startsWith('k205c-perm-')) rmSync(dir, { recursive: true, force: true });
  }
});

const TARGET = 'C:\\work\\mock-write-target.txt';
const goodEvent = (over = {}) => ({
  hook_event_name: 'PermissionRequest', session_id: 's', cwd: 'C:\\work', tool_name: 'Write',
  tool_input: { file_path: 'mock-write-target.txt', content: 'synthetic-mock-content' }, ...over,
});

// ---------- 1. policy files (static) ----------
const policy = (name) => JSON.parse(read('policies', name));
const hooksOf = (p, event) => p.hooks[event].flatMap((g) => g.hooks);

test('S1 probe policy: managed-only, marker-only PreToolUse, observe + real guard on PermissionRequest', () => {
  const p = policy(PROBE_POLICY);
  assert.deepEqual(Object.keys(p).sort(), ['allowManagedHooksOnly', 'hooks']);
  assert.equal(p.allowManagedHooksOnly, true);
  assert.deepEqual(Object.keys(p.hooks).sort(), ['PermissionRequest', 'PreToolUse']);
  assert.equal(p.hooks.PreToolUse.length, 1);
  assert.equal(p.hooks.PreToolUse[0].matcher, '*');
  assert.deepEqual(hooksOf(p, 'PreToolUse'), [{ type: 'command', command: 'C:\\payload\\bin\\node.exe',
    args: ['C:\\payload\\hooks\\probe-marker.mjs'], timeout: 10, onFailure: 'block' }]);
  const pr = hooksOf(p, 'PermissionRequest');
  assert.equal(pr.length, 2);
  assert.deepEqual(pr[0].args, ['C:\\payload\\hooks\\permission-probe.mjs', '--mode', 'observe', '--event', 'PermissionRequest']);
  assert.equal(pr[0].onFailure, undefined, 'observe hook takes no decision');
  assert.deepEqual(pr[1].args, ['C:\\payload\\scripts\\guard.mjs', 'C:\\payload\\scripts\\decision-gate-event-adapter.mjs', '--event', 'PermissionRequest']);
  assert.equal(pr[1].onFailure, 'block');
  assert.equal(pr.filter((h) => h.onFailure === 'block').length + hooksOf(p, 'PreToolUse').filter((h) => h.onFailure === 'block').length, 2);
});

test('S2 allow-control policy: only the narrow allow hook decides; PreToolUse stays a pass-through marker', () => {
  const p = policy(ALLOW_POLICY);
  assert.deepEqual(Object.keys(p).sort(), ['allowManagedHooksOnly', 'hooks']);
  assert.equal(p.allowManagedHooksOnly, true);
  assert.deepEqual(hooksOf(p, 'PreToolUse').map((h) => h.args), [['C:\\payload\\hooks\\probe-marker.mjs']]);
  const pr = hooksOf(p, 'PermissionRequest');
  assert.equal(pr.length, 1);
  assert.deepEqual(pr[0].args, ['C:\\payload\\hooks\\permission-probe.mjs', '--mode', 'allow-fixture-write', '--event', 'PermissionRequest']);
  assert.equal(pr[0].onFailure, 'block');
  assert.ok(!read('policies', ALLOW_POLICY).includes('guard.mjs'), 'allow control must not load the production guard');
  assert.equal(hooksOf(p, 'PermissionRequest').filter((h) => h.onFailure === 'block').length + 1, 2);
});

test('S3 guarded allow-control policy (C0): C1 plus exactly one PreToolUse guard entry, nothing else differs', () => {
  const c0 = policy(GUARDED_POLICY), c1 = policy(ALLOW_POLICY);
  assert.deepEqual(Object.keys(c0).sort(), ['allowManagedHooksOnly', 'hooks']);
  assert.equal(c0.allowManagedHooksOnly, true);
  assert.deepEqual(Object.keys(c0.hooks).sort(), Object.keys(c1.hooks).sort());
  assert.deepEqual(c0.hooks.PermissionRequest, c1.hooks.PermissionRequest, 'PermissionRequest is identical to C1');
  assert.equal(c0.hooks.PreToolUse.length, 1);
  assert.equal(c0.hooks.PreToolUse[0].matcher, c1.hooks.PreToolUse[0].matcher);
  const pre0 = hooksOf(c0, 'PreToolUse'), pre1 = hooksOf(c1, 'PreToolUse');
  assert.equal(pre0.length, pre1.length + 1);
  assert.deepEqual(pre0[0], pre1[0], 'probe-marker entry is identical to C1');
  assert.deepEqual(pre0[1], { type: 'command', command: 'C:\\payload\\bin\\node.exe',
    args: ['C:\\payload\\scripts\\guard.mjs', 'C:\\payload\\scripts\\decision-gate-event-adapter.mjs', '--event', 'PreToolUse'], timeout: 10, onFailure: 'block' });
  // Removing the added guard entry yields exactly the C1 structure: the guard hook is the single configuration variable.
  assert.deepEqual({ ...c0, hooks: { ...c0.hooks, PreToolUse: [{ ...c0.hooks.PreToolUse[0], hooks: [pre0[0]] }] } }, c1);
});

test('S3 guarded policy (C0) is payload-only: shipped with the permission profile, never a plan policy', () => {
  assert.ok(Object.hasOwn(payloadSourcesFor(PROBE_POLICY), `policies/${GUARDED_POLICY}`));
  assert.ok(!Object.hasOwn(payloadSourcesFor(P2_POLICY), `policies/${GUARDED_POLICY}`));
  assert.throws(() => payloadSourcesFor(GUARDED_POLICY), /PLAN_CONTRACT_INVALID/);
});

test('test PreToolUse behavior never becomes a general allow mechanism', () => {
  const marker = read('hooks', 'probe-marker.mjs') + read('hooks', '_marker.mjs');
  assert.ok(!/permissionDecision|"allow"|'allow'|behavior|hookSpecificOutput|process\.stdout/.test(marker));
  for (const name of [PROBE_POLICY, ALLOW_POLICY, GUARDED_POLICY]) {
    const text = read('policies', name);
    assert.ok(!/dangerously|bypassPermissions|permissionDecision|"permissions"|defaultMode|allowedTools/i.test(text), name);
    assert.ok(!text.includes('probe-error') && !text.includes('probe-timeout'));
  }
});

test('P2 deny policy and its pinned source are untouched and absent from the new profile', () => {
  const bytes = readFileSync(join(PACKAGE, 'policies', P2_POLICY));
  assert.equal(sha(bytes), P2_POLICY_SHA256);
  assert.ok(!bytes.toString('utf8').includes('permission-probe'));
  assert.ok(!Object.hasOwn(payloadSourcesFor(PROBE_POLICY), `policies/${P2_POLICY}`));
  assert.ok(Object.hasOwn(payloadSourcesFor(P2_POLICY), `policies/${P2_POLICY}`));
});

// ---------- 2. decision logic ----------
test('decide: observe never takes a decision', () => {
  assert.equal(decide('observe', goodEvent()).decision, 'none');
  assert.equal(decide('observe', { garbage: true }).decision, 'none');
  assert.equal(decide('observe', null).decision, 'none');
});

test('decide: allow only for the exact Write / path / content / cwd fixture', () => {
  assert.equal(decide('allow-fixture-write', goodEvent()).decision, 'allow');
  assert.equal(decide('allow-fixture-write', goodEvent({ tool_input: { file_path: TARGET, content: 'synthetic-mock-content' } })).decision, 'allow');
  assert.equal(decide('allow-fixture-write', goodEvent({ cwd: 'c:\\WORK', tool_input: { file_path: 'c:\\work\\MOCK-WRITE-TARGET.TXT', content: 'synthetic-mock-content' } })).decision, 'allow');
  const denied = [
    ['other tool', goodEvent({ tool_name: 'Edit' })],
    ['bash', goodEvent({ tool_name: 'Bash', tool_input: { command: 'dir' } })],
    ['wrong event', goodEvent({ hook_event_name: 'PreToolUse' })],
    ['missing event name', (() => { const e = goodEvent(); delete e.hook_event_name; return e; })()],
    ['other file', goodEvent({ tool_input: { file_path: 'other.txt', content: 'synthetic-mock-content' } })],
    ['suffix', goodEvent({ tool_input: { file_path: 'mock-write-target.txt.bak', content: 'synthetic-mock-content' } })],
    ['traversal', goodEvent({ tool_input: { file_path: '..\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['subdir', goodEvent({ tool_input: { file_path: 'sub\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['other drive path', goodEvent({ tool_input: { file_path: 'D:\\work\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['alternate stream', goodEvent({ tool_input: { file_path: `${TARGET}:evil`, content: 'synthetic-mock-content' } })],
    ['trailing space', goodEvent({ tool_input: { file_path: `${TARGET} `, content: 'synthetic-mock-content' } })],
    ['wrong content', goodEvent({ tool_input: { file_path: TARGET, content: 'x' } })],
    ['extra tool_input key', goodEvent({ tool_input: { file_path: TARGET, content: 'synthetic-mock-content', extra: 1 } })],
    ['missing content', goodEvent({ tool_input: { file_path: TARGET } })],
    ['non-string path', goodEvent({ tool_input: { file_path: 7, content: 'synthetic-mock-content' } })],
    ['wrong cwd', goodEvent({ cwd: 'C:\\elsewhere' })],
    ['missing cwd', (() => { const e = goodEvent(); delete e.cwd; return e; })()],
    ['relative cwd', goodEvent({ cwd: 'work' })],
    ['tool_input absent', goodEvent({ tool_input: undefined })],
    ['tool_input array', goodEvent({ tool_input: [] })],
    ['NUL in path', goodEvent({ tool_input: { file_path: 'mock-write-target.txt\0.png', content: 'synthetic-mock-content' } })],
    ['NUL in cwd', goodEvent({ cwd: 'C:\\work\0' })],
    ['Kelvin sign in path', goodEvent({ tool_input: { file_path: 'moc\u212A-write-target.txt', content: 'synthetic-mock-content' } })],
    ['Kelvin sign in cwd', goodEvent({ cwd: 'C:\\wor\u212A' })],
    ['Kelvin sign in absolute path', goodEvent({ tool_input: { file_path: 'C:\\work\\moc\u212A-write-target.txt', content: 'synthetic-mock-content' } })],
    ['dotless i', goodEvent({ tool_input: { file_path: 'mock-wr\u0131te-target.txt', content: 'synthetic-mock-content' } })],
    ['fullwidth letter', goodEvent({ tool_input: { file_path: '\uFF4Dock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['UNC path', goodEvent({ tool_input: { file_path: '\\\\server\\share\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['extended-length prefix', goodEvent({ tool_input: { file_path: '\\\\?\\C:\\work\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['device namespace prefix', goodEvent({ tool_input: { file_path: '\\\\.\\C:\\work\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['over-long path', goodEvent({ tool_input: { file_path: `C:\\work\\${'a'.repeat(300)}\\..\\mock-write-target.txt`, content: 'synthetic-mock-content' } })],
    ['8.3 short name', goodEvent({ tool_input: { file_path: 'MOCK-W~1.TXT', content: 'synthetic-mock-content' } })],
    ['drive-relative path', goodEvent({ tool_input: { file_path: 'c:mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['dot-dot normalizing to target', goodEvent({ tool_input: { file_path: 'sub\\..\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['dot segment', goodEvent({ tool_input: { file_path: '.\\mock-write-target.txt', content: 'synthetic-mock-content' } })],
    ['trailing dot', goodEvent({ tool_input: { file_path: 'mock-write-target.txt.', content: 'synthetic-mock-content' } })],
    ['cwd trailing backslash', goodEvent({ cwd: 'C:\\work\\' })],
    ['cwd trailing space', goodEvent({ cwd: 'C:\\work ' })],
    ['cwd forward slash', goodEvent({ cwd: 'C:/work' })],
    ['content with trailing newline', goodEvent({ tool_input: { file_path: TARGET, content: 'synthetic-mock-content\n' } })],
    ['control char in path', goodEvent({ tool_input: { file_path: 'mock-write-target.txt\u0007', content: 'synthetic-mock-content' } })],
    ['null event', null],
    ['array event', []],
    ['string event', 'Write'],
  ];
  for (const [label, event] of denied) assert.equal(decide('allow-fixture-write', event).decision, 'deny', label);
});

test('decide is total: an event whose property access throws is denied, never allowed', () => {
  const hostile = new Proxy({}, { get() { throw new Error('hostile getter'); } });
  assert.equal(decide('allow-fixture-write', hostile).decision, 'deny');
  assert.equal(decide('allow-fixture-write', hostile).reason, 'DECIDE_INTERNAL_ERROR');
  const hostileInput = goodEvent({ tool_input: new Proxy({}, { ownKeys() { throw new Error('hostile keys'); } }) });
  assert.equal(decide('allow-fixture-write', hostileInput).decision, 'deny');
});

test('decide: unknown or missing mode never allows', () => {
  for (const mode of [undefined, null, '', 'allow', 'allow-all', 'ALLOW-FIXTURE-WRITE', 'deny', 'observe ']) {
    assert.notEqual(decide(mode, goodEvent()).decision, 'allow', String(mode));
    assert.equal(decide(mode, goodEvent()).decision, 'deny', String(mode));
  }
});

// ---------- 3. CLI behavior (child process, synthetic stdin) ----------
function run(args, input, evidenceDir) {
  const result = spawnSync(process.execPath, [HOOK, ...args], { input, encoding: 'utf8',
    env: { ...process.env, PILOT_EVIDENCE_DIR: evidenceDir }, timeout: 20000 });
  const markerPath = join(evidenceDir, 'permission-marker.log');
  const marker = existsSync(markerPath) ? readFileSync(markerPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, marker };
}
const OBSERVE = ['--mode', 'observe', '--event', 'PermissionRequest'];
const ALLOW = ['--mode', 'allow-fixture-write', '--event', 'PermissionRequest'];
const isAllowJson = (s) => { try { const j = JSON.parse(s); return j.hookSpecificOutput?.hookEventName === 'PermissionRequest' && j.hookSpecificOutput?.decision?.behavior === 'allow'; } catch { return false; } };
const isDenyJson = (s) => { try { const j = JSON.parse(s); return j.hookSpecificOutput?.hookEventName === 'PermissionRequest' && j.hookSpecificOutput?.decision?.behavior === 'deny' && typeof j.hookSpecificOutput.decision.message === 'string'; } catch { return false; } };

test('CLI observe: marker only, exit 0, no stdout', () => {
  const dir = temp('k205c-perm-observe-');
  const input = JSON.stringify(goodEvent());
  const r = run(OBSERVE, input, dir);
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
  assert.equal(r.marker.length, 1);
  assert.equal(r.marker[0].hook, 'permission-probe');
  assert.equal(r.marker[0].mode, 'observe');
  assert.equal(r.marker[0].hook_event_name, 'PermissionRequest');
  assert.equal(r.marker[0].tool_name, 'Write');
  assert.equal(r.marker[0].decision, 'none');
  assert.equal(r.marker[0].stdin_sha256, sha(Buffer.from(input)));
});

test('CLI allow: allow JSON only for the exact fixture, with a marker written first', () => {
  const dir = temp('k205c-perm-allow-');
  const r = run(ALLOW, JSON.stringify(goodEvent()), dir);
  assert.equal(r.status, 0); assert.ok(isAllowJson(r.stdout));
  assert.equal(r.marker.length, 1); assert.equal(r.marker[0].decision, 'allow');
});

test('CLI allow mode denies everything else with an explicit deny JSON', () => {
  const dir = temp('k205c-perm-deny-');
  const cases = [JSON.stringify(goodEvent({ tool_name: 'Edit' })), JSON.stringify(goodEvent({ tool_input: { file_path: 'x.txt', content: 'synthetic-mock-content' } })),
    '{not json', '', '[]', 'null', JSON.stringify({ hook_event_name: 'PermissionRequest' })];
  for (const input of cases) {
    const r = run(ALLOW, input, dir);
    assert.equal(r.status, 0, input); assert.ok(isDenyJson(r.stdout), input); assert.ok(!isAllowJson(r.stdout), input);
  }
  assert.equal(readFileSync(join(dir, 'permission-marker.log'), 'utf8').trim().split('\n').length, cases.length);
});

test('CLI oversize stdin is denied, not parsed', () => {
  const dir = temp('k205c-perm-big-');
  const r = run(ALLOW, 'x'.repeat(200 * 1024), dir);
  assert.equal(r.status, 0); assert.ok(isDenyJson(r.stdout));
});

test('CLI bad or missing arguments fail closed (exit 2, no stdout)', () => {
  const dir = temp('k205c-perm-args-');
  const input = JSON.stringify(goodEvent());
  const bad = [[], ['--mode', 'observe'], ['--mode', 'allow', '--event', 'PermissionRequest'], ['--mode', 'allow-fixture-write'],
    ['--event', 'PermissionRequest', '--mode', 'observe'], ['--mode', 'observe', '--event', 'PreToolUse'],
    ['--mode', 'observe', '--event', 'PermissionRequest', '--extra'], ['--mode', 'allow-fixture-write', '--mode', 'observe', '--event', 'PermissionRequest']];
  for (const args of bad) {
    const r = run(args, input, dir);
    assert.equal(r.status, 2, args.join(' ')); assert.equal(r.stdout, '', args.join(' '));
  }
  assert.ok(!existsSync(join(dir, 'permission-marker.log')), 'invalid invocations must not write markers');
});

test('CLI marker write failure: allow mode emits an explicit deny (exit 0); observe mode takes no decision (exit 2)', () => {
  const base = temp('k205c-perm-marker-');
  const blocker = join(base, 'not-a-directory'); writeFileSync(blocker, 'file');
  const broken = join(blocker, 'sub');
  const allow = run(ALLOW, JSON.stringify(goodEvent()), broken);
  assert.equal(allow.status, 0); assert.ok(isDenyJson(allow.stdout)); assert.ok(!isAllowJson(allow.stdout));
  assert.ok(JSON.parse(allow.stdout).hookSpecificOutput.decision.message.includes('MARKER_WRITE_FAILED'));
  const observe = run(OBSERVE, JSON.stringify(goodEvent()), broken);
  assert.equal(observe.status, 2); assert.equal(observe.stdout, '');
  assert.ok(!existsSync(join(broken, 'permission-marker.log')));
});

test('S1 production chain: the real guard + adapter answer a PermissionRequest Write with deny JSON and log it (HOOKLOG)', () => {
  const dir = temp('k205c-perm-guard-');
  const log = join(dir, 'guard-hooklog.log');
  const result = spawnSync(process.execPath, [join(REPO, 'scripts', 'guard.mjs'), join(REPO, 'scripts', 'decision-gate-event-adapter.mjs'), '--event', 'PermissionRequest'],
    { input: JSON.stringify(goodEvent()), encoding: 'utf8', env: { ...process.env, HOOKLOG: log }, timeout: 20000 });
  assert.equal(result.status, 0);
  assert.ok(isDenyJson(result.stdout)); assert.ok(!isAllowJson(result.stdout));
  assert.ok(JSON.parse(result.stdout).hookSpecificOutput.decision.message.startsWith('BLOCKED(wrapper): PERMISSION_REQUEST_PILOT_DENY_'));
  const lines = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);
  assert.equal(lines[0].event, 'PermissionRequest'); assert.equal(lines[0].tool, 'Write');
  assert.ok(lines[0].reason.startsWith('PERMISSION_REQUEST_PILOT_DENY_')); assert.equal(lines[0].exit, 0);
  // Without HOOKLOG the guard still denies but leaves no record: that is why the guest sets HOOKLOG per scenario.
  const bare = spawnSync(process.execPath, [join(REPO, 'scripts', 'guard.mjs'), join(REPO, 'scripts', 'decision-gate-event-adapter.mjs'), '--event', 'PermissionRequest'],
    { input: JSON.stringify(goodEvent()), encoding: 'utf8', env: { ...process.env, HOOKLOG: '' }, timeout: 20000 });
  assert.ok(isDenyJson(bare.stdout));
});

// ---------- 4. exact allowlists / profile gates ----------
const PLAN = { schema: '7allab-k205c-w1b-live-plan/0.1', run_id: 'perm-fixture', sandbox_id: '00000000-0000-4000-8000-000000000002',
  policy: PROBE_POLICY, payload_root: 'C:\\payload-source', export_root: 'C:\\fresh-export', output_dir: 'C:\\fresh-report' };
// p1-baseline is a pre-existing allowlisted name in the host/guest allowlists (not part of this change); it is still refused by the runner/transport gates.
const PRE_EXISTING_ALLOWLISTED = 'p1-baseline.test.json';
const NEAR_MISSES = [ALLOW_POLICY, GUARDED_POLICY, 'p1-baseline.test.json', `${PROBE_POLICY} `, `${PROBE_POLICY}.bak`, 'p2-permission-request-probe', 'P2-PERMISSION-REQUEST-PROBE.TEST.JSON',
  'p2-permission-request-probe.test.json\0', 'p2-permission-request-other.test.json', '../p2-permission-request-probe.test.json', 'p2-permission-request-probe.test.jsonx', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf',
  [PROBE_POLICY], { toString: () => PROBE_POLICY }, new String(PROBE_POLICY), '', null, undefined];

test('payload sets: P2 profile unchanged (17 sources), permission profile exact (18 sources)', () => {
  assert.deepEqual(Object.keys(payloadSourcesFor(P2_POLICY)).sort(), ['fixtures/events.json', 'hooks/_marker.mjs', 'hooks/probe-marker.mjs',
    'mocks/mock-endpoint.mjs', 'policies/p2-managed-hooks-only.test.json', 'policy-to-install.txt', 'sandbox/export-manifest.ps1',
    'sandbox/guest-auth-provenance.mjs', 'sandbox/guest-result-finalize.mjs', 'sandbox/inside-sandbox-setup.ps1', 'sandbox/w1b-direct-feed.mjs',
    'sandbox/w1b-run.ps1', 'scripts/authority-grant.mjs', 'scripts/decision-gate-event-adapter.mjs', 'scripts/guard-scope.mjs', 'scripts/guard.mjs',
    'scripts/validate-director-decision.mjs'].sort());
  assert.deepEqual(Object.keys(payloadSourcesFor(PROBE_POLICY)).sort(), ['hooks/_marker.mjs', 'hooks/permission-probe.mjs', 'hooks/probe-marker.mjs',
    'mocks/mock-endpoint.mjs', `policies/${ALLOW_POLICY}`, `policies/${GUARDED_POLICY}`, `policies/${PROBE_POLICY}`, 'policy-to-install.txt', 'sandbox/export-manifest.ps1',
    'sandbox/guest-auth-provenance.mjs', 'sandbox/guest-result-finalize.mjs', 'sandbox/inside-sandbox-setup.ps1', 'sandbox/w1b-permission-run.ps1',
    'scripts/authority-grant.mjs', 'scripts/decision-gate-event-adapter.mjs', 'scripts/guard-scope.mjs', 'scripts/guard.mjs',
    'scripts/validate-director-decision.mjs'].sort());
  assert.equal(Buffer.from(payloadSourcesFor(PROBE_POLICY)['policy-to-install.txt']).toString('utf8'), `${PROBE_POLICY}\r\n`);
  for (const bad of NEAR_MISSES) assert.throws(() => payloadSourcesFor(bad), /PLAN_CONTRACT_INVALID/);
});

test('validatePayload enforces the exact permission file set (synthetic copy, runtimes injected)', () => {
  const sources = payloadSourcesFor(PROBE_POLICY);
  const root = temp('k205c-perm-payload-');
  for (const [relative, source] of Object.entries(sources)) {
    const target = join(root, ...relative.split('/')); mkdirSync(dirname(target), { recursive: true });
    if (Buffer.isBuffer(source)) writeFileSync(target, source); else copyFileSync(source, target);
  }
  const ok = validatePayload(root, { sources, runtimes: {} });
  assert.equal(ok.file_count, 18); assert.equal(ok.authorityImplemented, false);
  writeFileSync(join(root, 'extra.txt'), 'x');
  assert.throws(() => validatePayload(root, { sources, runtimes: {} }), /PAYLOAD_FILE_SET_INVALID/);
  rmSync(join(root, 'extra.txt'));
  writeFileSync(join(root, 'hooks', 'permission-probe.mjs'), '// tampered');
  assert.throws(() => validatePayload(root, { sources, runtimes: {} }), /PAYLOAD_SOURCE_HASH_MISMATCH/);
  copyFileSync(sources['hooks/permission-probe.mjs'], join(root, 'hooks', 'permission-probe.mjs'));
  rmSync(join(root, 'policies', ALLOW_POLICY));
  assert.throws(() => validatePayload(root, { sources, runtimes: {} }), /PAYLOAD_FILE_SET_INVALID/);
});

test('validatePayload keeps the pinned runtime default when only sources are injected (as executeLivePlan does)', () => {
  const sources = payloadSourcesFor(PROBE_POLICY);
  const root = temp('k205c-perm-runtimes-');
  for (const [relative, source] of Object.entries(sources)) {
    const target = join(root, ...relative.split('/')); mkdirSync(dirname(target), { recursive: true });
    if (Buffer.isBuffer(source)) writeFileSync(target, source); else copyFileSync(source, target);
  }
  // Default RUNTIMES expect bin/node.exe and bin/claude.exe; their absence must fail the exact-set check.
  assert.throws(() => validatePayload(root, { sources }), /PAYLOAD_FILE_SET_INVALID/);
  mkdirSync(join(root, 'bin'));
  writeFileSync(join(root, 'bin', 'node.exe'), 'not the pinned runtime'); writeFileSync(join(root, 'bin', 'claude.exe'), 'not the pinned runtime');
  assert.throws(() => validatePayload(root, { sources }), /PAYLOAD_RUNTIME_HASH_MISMATCH/);
});

test('executeLivePlan: accepts exactly the S1 primary policy and passes its exact payload sources', async () => {
  let validatorArgs, transportArgs;
  await executeLivePlan(PLAN, {
    payloadValidator: (...args) => { validatorArgs = args; },
    transportFactory: (value) => { transportArgs = value; return Object.freeze({}); },
    campaignRunner: async () => ({ status: 'INCONCLUSIVE', authorityImplemented: false }),
  });
  assert.equal(transportArgs.policy, PROBE_POLICY);
  assert.deepEqual(Object.keys(validatorArgs[1].sources).sort(), Object.keys(payloadSourcesFor(PROBE_POLICY)).sort());
  let p2Args;
  await executeLivePlan({ ...PLAN, policy: P2_POLICY }, { payloadValidator: (...args) => { p2Args = args; }, transportFactory: () => Object.freeze({}),
    campaignRunner: async () => ({ status: 'INCONCLUSIVE', authorityImplemented: false }) });
  assert.deepEqual(Object.keys(p2Args[1].sources).sort(), Object.keys(payloadSourcesFor(P2_POLICY)).sort());
});

test('executeLivePlan rejects every near-miss policy before any factory runs', async () => {
  let called = false;
  const deps = { payloadValidator: () => { called = true; }, transportFactory: () => { called = true; }, campaignRunner: () => { called = true; } };
  for (const bad of NEAR_MISSES) await assert.rejects(executeLivePlan({ ...PLAN, policy: bad }, deps), /PLAN_CONTRACT_INVALID/);
  assert.equal(called, false);
});

function payloadFixture(names) {
  const base = temp('k205c-perm-cfg-'); const payload = join(base, 'payload'); const output = join(base, 'export');
  mkdirSync(payload); mkdirSync(output);
  for (const name of names) { const path = join(payload, ...name.split('/')); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, 'fixture'); }
  return { payload, output };
}
const COMMON_FILES = ['bin/node.exe', 'bin/claude.exe', 'sandbox/guest-auth-provenance.mjs', 'sandbox/guest-result-finalize.mjs', 'sandbox/export-manifest.ps1'];
const PERM_FILES = [...COMMON_FILES, `policies/${PROBE_POLICY}`, `policies/${ALLOW_POLICY}`, `policies/${GUARDED_POLICY}`, 'hooks/permission-probe.mjs', 'sandbox/w1b-permission-run.ps1'];

test('buildSandboxConfig: permission profile launches the permission guest script, P2 command is unchanged', () => {
  const f = payloadFixture(PERM_FILES);
  const config = buildSandboxConfig({ payloadRoot: f.payload, exportRoot: f.output, runId: 'perm-run', policy: PROBE_POLICY });
  assert.ok(config.includes(`C:\\payload\\sandbox\\w1b-permission-run.ps1 -Policy ${PROBE_POLICY} -RunId perm-run`));
  assert.ok(!config.includes('w1b-run.ps1'));
  assert.ok(config.includes('<Networking>Disable</Networking>') && config.includes('<ClipboardRedirection>Disable</ClipboardRedirection>'));
  assert.ok(config.includes('<ReadOnly>true</ReadOnly>') && config.includes('<ReadOnly>false</ReadOnly>'));
  const g = payloadFixture([...COMMON_FILES, `policies/${P2_POLICY}`, 'sandbox/w1b-run.ps1']);
  const p2 = buildSandboxConfig({ payloadRoot: g.payload, exportRoot: g.output, runId: 'p2-run', policy: P2_POLICY });
  assert.ok(p2.includes(`-File C:\\payload\\sandbox\\w1b-run.ps1 -Policy ${P2_POLICY} -RunId p2-run`));
});

test('buildSandboxConfig: near-miss policies and incomplete permission payloads are refused', () => {
  const f = payloadFixture(PERM_FILES);
  for (const bad of NEAR_MISSES) assert.throws(() => buildSandboxConfig({ payloadRoot: f.payload, exportRoot: f.output, runId: 'perm-run', policy: bad }), /PLAN_ID_OR_POLICY_INVALID/);
  for (const missing of [`policies/${ALLOW_POLICY}`, `policies/${GUARDED_POLICY}`, 'hooks/permission-probe.mjs', 'sandbox/w1b-permission-run.ps1', `policies/${PROBE_POLICY}`]) {
    const g = payloadFixture(PERM_FILES.filter((n) => n !== missing));
    assert.throws(() => buildSandboxConfig({ payloadRoot: g.payload, exportRoot: g.output, runId: 'perm-run', policy: PROBE_POLICY }), /PATH_NOT_FOUND/, missing);
  }
});

test('host lifecycle and offline correlation allowlists: exact next-step errors for accepted names, POLICY_NOT_ALLOWLISTED for near-misses', async () => {
  const lifecycle = (policy) => captureAndCorrelate({ runId: 'perm-run', sandboxId: 'perm-sandbox', policy, exportRunDir: 'C:\\x', outputDir: 'C:\\y' });
  const offline = (policy) => correlateOffline({ runDir: 'relative', runId: 'perm-run', policy, runnerInput: 'relative', reportDir: 'relative' });
  // An accepted name passes the allowlist and then fails on the NEXT exact, unrelated precondition, so a pass on a wrong error is impossible.
  for (const accepted of [PROBE_POLICY, PRE_EXISTING_ALLOWLISTED, P2_POLICY]) {
    await assert.rejects(lifecycle(accepted), { message: 'TRANSPORT_REQUIRED' }, accepted);
    await assert.rejects(offline(accepted), { message: 'ABSOLUTE_PATH_REQUIRED' }, accepted);
  }
  for (const bad of NEAR_MISSES.filter((x) => x !== PRE_EXISTING_ALLOWLISTED)) {
    await assert.rejects(lifecycle(bad), { message: 'POLICY_NOT_ALLOWLISTED' });
    await assert.rejects(offline(bad), { message: 'POLICY_NOT_ALLOWLISTED' });
  }
  // The S2 allow-control policy is payload-only and must never be an accepted campaign policy anywhere.
  await assert.rejects(lifecycle(ALLOW_POLICY), { message: 'POLICY_NOT_ALLOWLISTED' });
  await assert.rejects(offline(ALLOW_POLICY), { message: 'POLICY_NOT_ALLOWLISTED' });
  // The S3 guarded allow-control policy (C0) is payload-only as well.
  await assert.rejects(lifecycle(GUARDED_POLICY), { message: 'POLICY_NOT_ALLOWLISTED' });
  await assert.rejects(offline(GUARDED_POLICY), { message: 'POLICY_NOT_ALLOWLISTED' });
});

test('guest result finalizer: new primary policy accepted, near-misses refused', () => {
  const dir = temp('k205c-perm-final-');
  const provenance = join(dir, 'auth.json');
  writeFileSync(provenance, JSON.stringify({ auth_mode: 'MOCK_ENDPOINT', credential_kind: 'SYNTHETIC_SENTINEL', endpoint_kind: 'LOOPBACK_MOCK', source: 'RUNNER_ENVIRONMENT', observed_at: new Date().toISOString() }));
  const draftFor = (policy_file) => ({ schema: '7allab-k205c-sandbox-run/0.1', run_id: 'perm-run', policy_file, evidence_kind: 'MOCK_ENDPOINT',
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false, review_verified: false, status: 'RUN_COMPLETED_UNATTESTED',
    claude_exit_code: 0, claude_timed_out: false, error: null });
  const attempt = (policy, n) => { const draft = join(dir, `draft-${n}.json`); writeFileSync(draft, JSON.stringify(draftFor(policy)));
    return finalizeGuestResult({ draftPath: draft, provenancePath: provenance, outputPath: join(dir, `result-${n}.json`) }); };
  assert.equal(attempt(PROBE_POLICY, 'ok').result.policy_file, PROBE_POLICY);
  let n = 0;
  for (const bad of NEAR_MISSES.filter((x) => typeof x === 'string' && !x.includes('\0') && x !== PRE_EXISTING_ALLOWLISTED)) assert.throws(() => attempt(bad, `bad${n++}`), /RESULT_ID_OR_POLICY_INVALID/);
});

// ---------- 5. guest script (static; it only runs inside Windows Sandbox) ----------
// The guest script only runs inside Windows Sandbox. These are STATIC structure checks on its text (ordering, names, fields),
// not a behavioral test: they cannot catch a runtime PowerShell error. Labeled accordingly.
const guestText = () => read('sandbox', 'w1b-permission-run.ps1');
const EVIDENCE_FIELDS = ['completed', 'existed_before', 'exists_after', 'installed_policy_sha256', 'debug_log_present', 'debug_log_sha256',
  'debug_managed_settings_seen', 'debug_allow_managed_hooks_only_seen', 'debug_permission_hook_lines', 'guard_log_present', 'guard_log_lines'];

test('guest permission script (static): exact policy gates and scenario table', () => {
  const text = guestText();
  assert.ok(text.includes(`$Policy -cne '${PROBE_POLICY}'`));
  assert.ok(text.includes(`@{Name='S1';Policy='${PROBE_POLICY}'},@{Name='S3';Policy='${GUARDED_POLICY}'},@{Name='S2';Policy='${ALLOW_POLICY}'}`), 'S1, then S3, then S2, exact policy names');
  assert.ok(text.indexOf('WDAGUtilityAccount') >= 0 && text.indexOf('WDAGUtilityAccount') < text.indexOf('Win32_ComputerSystem'));
  assert.ok(text.indexOf('Win32_ComputerSystem') < text.indexOf('foreach($s in $scenarios)'), 'sandbox refusals precede all work');
  assert.ok(text.includes('C:\\work\\mock-write-target.txt'));
  assert.ok(text.includes('--scenario') && text.includes("'Write'"));
  assert.ok(!text.includes('w1b-run.ps1'));
});

test('guest permission script (static): S3 runs before S2 because S2 creates the target and nothing is removed between scenarios', () => {
  const text = guestText();
  const s1 = text.indexOf("Name='S1'"), s3 = text.indexOf("Name='S3'"), s2 = text.indexOf("Name='S2'");
  assert.ok(s1 >= 0 && s1 < s3 && s3 < s2, 'scenario order is S1, S3, S2');
  assert.ok(text.includes('TARGET_EXISTS_BEFORE_$name'), 'the missing-target precondition stays in force for every scenario');
});

test('guest permission script (static): per-scenario ordering of precondition, env, launch, evidence capture', () => {
  const text = guestText();
  const loop = text.indexOf('foreach($s in $scenarios){');
  const at = (needle, from = loop) => { const i = text.indexOf(needle, from); assert.ok(i >= 0, `missing after loop start: ${needle}`); return i; };
  const setup = at('inside-sandbox-setup.ps1');
  const policyCopy = at('installed-policy-$name.sha256', setup);
  const measured = at('$existedBefore=Test-Path', policyCopy);
  const preconditionThrow = at('TARGET_EXISTS_BEFORE_$name', measured);
  const stale = at('STALE_EVIDENCE_BEFORE_$name', preconditionThrow);
  const hooklog = at('$env:HOOKLOG', stale);
  const mock = at('Start-Process', hooklog);
  const claudeStart = at('$claudeProcess.Start()', mock);
  const wait = at('WaitForExit(120000)', claudeStart);
  const save = at('Save-Evidence $name', wait);
  assert.ok(setup < policyCopy && policyCopy < measured && measured < preconditionThrow && preconditionThrow < stale && stale < hooklog);
  assert.ok(hooklog < mock && mock < claudeStart && claudeStart < wait && wait < save);
  assert.ok(text.includes("$env:HOOKLOG=\"$evidence\\guard-hooklog.log\""), 'guard decision log is set for the claude process (inherited by hooks)');
  assert.ok(!/existed_before\s*=\s*\$false/.test(text), 'existed_before is measured, not hard-coded');
  assert.ok(text.includes('$running'), 'error path knows whether a scenario was in flight');
});

test('guest permission script (static): evidence naming, summary fields, error-path capture, no destructive or network or bypass tokens', () => {
  const text = guestText();
  for (const name of ['claude-$name-output.jsonl', 'claude-$name-stderr.txt', 'claude-$name-debug.log', 'permission-marker-$name.log', 'hook-marker-$name.log',
    'mock-endpoint-$name.jsonl', 'guard-hooklog-$name.log', 'installed-policy-$name.sha256', 'target-$name.json']) assert.ok(text.includes(name), name);
  for (const field of EVIDENCE_FIELDS) assert.ok(text.includes(field), field);
  assert.ok(text.includes('function Save-Evidence'));
  assert.ok(/catch\{[^]*Save-Evidence \$current/.test(text), 'a scenario interrupted by an error still gets its evidence captured under its own name');
  assert.ok(!/dangerously|--permission-mode|--allowedTools|--settings|bypassPermissions|acceptEdits/i.test(text));
  assert.ok(!/Remove-Item|rd\s+\/s|rmdir\s+\/s|Clear-Content|\bdel\b|Set-ExecutionPolicy|Add-MpPreference/i.test(text));
  assert.ok(!/Invoke-WebRequest|Invoke-RestMethod|curl|wget|Start-BitsTransfer|netsh|New-NetFirewallRule/i.test(text));
});

test('acceptance criteria and guest script agree on the evidence the S1/S2 verdicts depend on', () => {
  const criteria = read('ACCEPTANCE-CRITERIA.md');
  const section = criteria.slice(criteria.indexOf('## O4-PR'), criteria.indexOf('## O5'));
  for (const term of ['DENY_SOURCE_NOT_ATTESTED', 'POLICY_NOT_ATTESTED', 'guard-hooklog-S1.log', 'PERMISSION_REQUEST_PILOT_DENY_',
    'installed_policy_sha256', 'debug_managed_settings_seen', 'debug_allow_managed_hooks_only_seen', 'guard_log_present']) {
    assert.ok(section.includes(term), `criteria missing: ${term}`);
  }
  // Every field the criteria cite must actually be produced by the guest script.
  for (const field of section.match(/\b(?:installed_policy_sha256|debug_[a-z_]+|guard_log_[a-z]+|completed|existed_before|exists_after)\b/g)) {
    assert.ok(guestText().includes(field), `guest script does not produce: ${field}`);
  }
});
