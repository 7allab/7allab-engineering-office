// Offline, synthetic tests for scripts/identity-gate.mjs (K2-04-D2B-1). Identity is injected through decide({resolve, spawn});
// the production code has no SID override. Not live Claude Code evidence. The only "live" parts are the real guard.mjs/adapter child
// processes and, when this machine's own token is crypt, the real whoami.exe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve as pathResolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRYPT_SID, CC_AGENT_SID, WHOAMI, decide, resolveSid, guardResultOk } from '../scripts/identity-gate.mjs';

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = join(ROOT, 'scripts', 'identity-gate.mjs');
const GUARD = join(ROOT, 'scripts', 'guard.mjs');
const ADAPTER = join(ROOT, 'scripts', 'decision-gate-event-adapter.mjs');
const OTHER_SID = 'S-1-5-21-2587344737-3047673138-827517886-1010';
const sidOk = (sid) => () => ({ ok: true, sid });
const B = (s) => Buffer.from(s, 'utf8');
const ev = (name, tool, input) => B(JSON.stringify({ hook_event_name: name, session_id: 's1', cwd: ROOT, tool_name: tool, tool_input: input, ...(name === 'PreToolUse' ? { tool_use_id: 't1' } : {}) }));
const PRE = { event: 'PreToolUse', guardPath: GUARD, guardArgs: [ADAPTER, '--event', 'PreToolUse'] };
const PERM = { event: 'PermissionRequest', guardPath: GUARD, guardArgs: [ADAPTER, '--event', 'PermissionRequest'] };
const denyJson = (m) => JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: m } } });
const spawnReturning = (r) => { const calls = []; const f = (...a) => { calls.push(a); return typeof r === 'function' ? r(...a) : r; }; f.calls = calls; return f; };
const res = (status, out = '', err = '') => ({ status, signal: null, stdout: B(out), stderr: B(err) });
const assertPreBlock = (o, code) => { assert.equal(o.exitCode, 2); assert.equal(o.stdout, ''); assert.equal(o.stderr, `BLOCKED(identity-gate): ${code}`); };
const assertPermBlock = (o, code) => { assert.equal(o.exitCode, 0); assert.equal(o.stderr, ''); assert.equal(o.stdout, denyJson(`BLOCKED(identity-gate): ${code}`)); };
const noAllow = (o) => { const t = String(o.stdout) + String(o.stderr); assert.ok(!/"allow"|permissionDecision|updatedInput|"ask"/.test(t), t); };

// ---------- identity table
test('crypt SID: exit 0, no stdout, no stderr, guard never spawned (both events, any stdin)', () => {
  for (const base of [PRE, PERM]) {
    const sp = spawnReturning(() => { throw new Error('guard must not run'); });
    for (const raw of [ev(base.event, 'Write', { file_path: 'C:\\x', content: 'y' }), B('not json'), Buffer.alloc(0), null]) {
      const o = decide(raw, { ...base, resolve: sidOk(CRYPT_SID), spawn: sp });
      assert.deepEqual([o.exitCode, o.stdout, o.stderr], [0, '', '']);
    }
    assert.equal(sp.calls.length, 0);
  }
  assert.deepEqual(decide(B('{}'), { guardPath: GUARD, resolve: sidOk(CRYPT_SID) }).exitCode, 0); // unpinned event does not break the exemption
});

test('cc-agent SID: delegated to guard with node, absolute guard path, unchanged args, shell:false', () => {
  const raw = ev('PreToolUse', 'Read', { file_path: 'C:\\x' });
  const sp = spawnReturning(res(2, '', 'BLOCKED(wrapper): ADAPTER_ASK'));
  const o = decide(raw, { ...PRE, resolve: sidOk(CC_AGENT_SID), spawn: sp });
  assert.equal(sp.calls.length, 1);
  const [cmd, args, opt] = sp.calls[0];
  assert.equal(cmd, process.execPath);
  assert.deepEqual(args, [GUARD, ADAPTER, '--event', 'PreToolUse']);
  assert.equal(opt.shell, false);
  assert.ok(Buffer.isBuffer(opt.input) && opt.input.equals(raw));
  assert.ok(opt.timeout <= 6500 && opt.maxBuffer <= 1048576);
  assert.deepEqual([o.exitCode, o.stdout.toString(), o.stderr.toString()], [2, '', 'BLOCKED(wrapper): ADAPTER_ASK']);
});

test('unknown SIDs are denied and never reach the guard (Read included)', () => {
  for (const sid of [OTHER_SID, 'S-1-5-18', 'S-1-5-21-2587344737-3047673138-827517886-10010', 'S-1-5-21-2587344737-3047673138-827517886-100', 's-1-5-21-2587344737-3047673138-827517886-1009']) {
    for (const [base, check] of [[PRE, assertPreBlock], [PERM, assertPermBlock]]) {
      const sp = spawnReturning(() => { throw new Error('guard must not run'); });
      const o = decide(ev(base.event, 'Read', { file_path: join(ROOT, 'scripts', 'guard.mjs') }), { ...base, resolve: sidOk(sid), spawn: sp });
      check(o, 'SID_NOT_AUTHORIZED'); assert.equal(sp.calls.length, 0); noAllow(o);
    }
  }
});

test('identity failures deny, per event contract (also for a would-be crypt)', () => {
  const failures = [() => ({ ok: false, code: 'WHOAMI_FAILED' }), () => ({ ok: false }), () => undefined, () => null, () => { throw new Error('boom'); }, () => ({ sid: CRYPT_SID }), () => ({ ok: 'yes', sid: CRYPT_SID })];
  for (const f of failures) {
    const p = decide(B('{}'), { ...PRE, resolve: f }); assert.equal(p.exitCode, 2); assert.match(p.stderr, /^BLOCKED\(identity-gate\): [A-Z_]+$/); assert.equal(p.stdout, '');
    const q = decide(B('{}'), { ...PERM, resolve: f }); assert.equal(q.exitCode, 0); assert.equal(q.stderr, ''); assert.equal(JSON.parse(q.stdout).hookSpecificOutput.decision.behavior, 'deny');
  }
});

// ---------- whoami parsing / execution
const whoamiRun = (r) => resolveSid(spawnReturning(r));
const csv = (sid, name = 'thinkbig\\cc-agent') => `"${name}","${sid}"\r\n`;
test('whoami: exact call shape (absolute path, fixed args, shell:false, small timeout/buffer, minimal env)', () => {
  const sp = spawnReturning({ status: 0, signal: null, stdout: csv(CC_AGENT_SID), stderr: '' });
  assert.deepEqual(resolveSid(sp), { ok: true, sid: CC_AGENT_SID });
  const [cmd, args, opt] = sp.calls[0];
  assert.equal(cmd, 'C:\\Windows\\System32\\whoami.exe'); assert.equal(cmd, WHOAMI);
  assert.deepEqual(args, ['/user', '/fo', 'csv', '/nh']);
  assert.equal(opt.shell, false); assert.ok(opt.timeout > 0 && opt.timeout <= 3000); assert.ok(opt.maxBuffer <= 4096);
  assert.deepEqual(Object.keys(opt.env), ['SystemRoot']);
  assert.deepEqual(whoamiRun({ status: 0, signal: null, stdout: csv(CRYPT_SID, 'thinkbig\\crypt').replace('\r\n', '\n'), stderr: '' }), { ok: true, sid: CRYPT_SID });
});

test('whoami: empty / corrupt / multi-line / look-alike output is rejected', () => {
  const bad = ['', '\r\n', 'garbage', csv(CC_AGENT_SID) + csv(CRYPT_SID, 'x\\y'), csv(CC_AGENT_SID) + '\r\n', ' ' + csv(CC_AGENT_SID), csv(CC_AGENT_SID) + 'x',
    `"a","${CC_AGENT_SID}"; calc\r\n`, `"a","${CC_AGENT_SID.toLowerCase()}"\r\n`, `"a","${CRYPT_SID}\r\n`,`"a","S-1-5-21-1-2-3"\r\n`, `"a","${CC_AGENT_SID}","extra"\r\n`,
    `${CC_AGENT_SID}\r\n`, `"a\r\nb","${CC_AGENT_SID}"\r\n`, `"a","${CC_AGENT_SID}"\r\n"b","${CRYPT_SID}"`, `"a","S-1-5-18"\r\n`];
  for (const s of bad) assert.equal(whoamiRun({ status: 0, signal: null, stdout: s, stderr: '' }).ok, false, JSON.stringify(s));
  assert.equal(whoamiRun({ status: 0, signal: null, stdout: Buffer.from(csv(CC_AGENT_SID)), stderr: '' }).ok, false); // not a string
});

test('whoami: command error, non-zero exit, stderr, signal, timeout, buffer overflow, spawn failure -> not ok', () => {
  const ok = csv(CC_AGENT_SID);
  const cases = [
    { status: 1, signal: null, stdout: ok, stderr: '' }, { status: 0, signal: null, stdout: ok, stderr: 'warn' },
    { status: null, signal: 'SIGTERM', stdout: '', stderr: '', error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }) },
    { status: null, signal: null, stdout: '', stderr: '', error: Object.assign(new Error('n'), { code: 'ENOENT' }) },
    { status: 0, signal: null, stdout: ok, stderr: '', error: Object.assign(new Error('b'), { code: 'ENOBUFS' }) },
    { status: 0, signal: 'SIGKILL', stdout: ok, stderr: '' }, { status: null, signal: null, stdout: ok, stderr: '' }, null, undefined,
  ];
  for (const r of cases) assert.equal(whoamiRun(r).ok, false);
  assert.throws(() => resolveSid(() => { throw new Error('x'); })); // decide() turns this into GATE_INTERNAL_ERROR
  assertPreBlock(decide(B('{}'), { ...PRE, resolve: () => resolveSid(() => { throw new Error('x'); }) }), 'GATE_INTERNAL_ERROR');
  assertPermBlock(decide(B('{}'), { ...PERM, resolve: () => resolveSid(() => { throw new Error('x'); }) }), 'GATE_INTERNAL_ERROR');
});

// ---------- guard outcomes
test('PreToolUse: only guard pass (0,"","") and guard block (2,"",BLOCKED(wrapper)) are accepted; everything else is DENY', () => {
  const evt = ev('PreToolUse', 'Read', { file_path: 'C:\\x' });
  const run = (r) => decide(evt, { ...PRE, resolve: sidOk(CC_AGENT_SID), spawn: spawnReturning(r) });
  assert.deepEqual([run(res(0)).exitCode, run(res(0)).stdout.length, run(res(0)).stderr.length], [0, 0, 0]);
  assert.equal(run(res(2, '', 'BLOCKED(wrapper): READ_PATH_NOT_FOUND')).exitCode, 2);
  const allow = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } });
  const bad = [res(1), res(3), res(0, '', 'noise'), res(0, allow), res(0, '{}'), res(2), res(2, '', 'free text'), res(2, allow, 'BLOCKED(wrapper): X'), res(2, '', 'BLOCKED(wrapper): x y'), res(137),
    { status: null, signal: 'SIGKILL', stdout: B(''), stderr: B('') }, { status: null, signal: null, stdout: B(''), stderr: B(''), error: Object.assign(new Error('e'), { code: 'ENOENT' }) },
    { status: 0, signal: null, stdout: Buffer.from([0xff, 0xfe]), stderr: B('') }, { status: 0, signal: null, stdout: '', stderr: '' }, null, undefined, 'x'];
  for (const r of bad) { const o = run(r); assertPreBlock(o, 'GUARD_UNEXPECTED_RESULT'); noAllow(o); }
});

test('PermissionRequest: only guard deny JSON is accepted; empty/allow/exit 2/other -> fixed deny JSON from the gate', () => {
  const evt = ev('PermissionRequest', 'Write', { file_path: 'C:\\x', content: '' });
  const run = (r) => decide(evt, { ...PERM, resolve: sidOk(CC_AGENT_SID), spawn: spawnReturning(r) });
  const good = denyJson('BLOCKED(wrapper): PERMISSION_REQUEST_PILOT_DENY_DENY');
  const g = run(res(0, good)); assert.deepEqual([g.exitCode, g.stdout.toString(), g.stderr.length], [0, good, 0]);
  const allow = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } });
  const allowUpd = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedInput: { command: 'x' } } } });
  const extra = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'BLOCKED(wrapper): X', updatedInput: {} } } });
  const wrongEvent = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', decision: { behavior: 'deny', message: 'BLOCKED(wrapper): X' } } });
  const bad = [res(0), res(2, '', 'BLOCKED(wrapper): X'), res(0, allow), res(0, allowUpd), res(0, extra), res(0, wrongEvent), res(0, good, 'noise'), res(1, good), res(0, good + '\n'), res(0, 'not json'), res(0, denyJson('free text')), res(0, JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: 'BLOCKED(wrapper): X' } }, extra: 1 })), null];
  for (const r of bad) { const o = run(r); assertPermBlock(o, 'GUARD_UNEXPECTED_RESULT'); noAllow(o); }
});

test('guard cannot start: spawn error, ENOENT, timeout, non-absolute path, throw -> DENY per event', () => {
  const evt = ev('PreToolUse', 'Read', { file_path: 'C:\\x' });
  const errs = [{ error: Object.assign(new Error('e'), { code: 'ENOENT' }), status: null, signal: null, stdout: B(''), stderr: B('') }, { error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }), status: null, signal: 'SIGTERM', stdout: B(''), stderr: B('') }];
  for (const e of errs) { assertPreBlock(decide(evt, { ...PRE, resolve: sidOk(CC_AGENT_SID), spawn: spawnReturning(e) }), 'GUARD_UNEXPECTED_RESULT'); assertPermBlock(decide(evt, { ...PERM, resolve: sidOk(CC_AGENT_SID), spawn: spawnReturning(e) }), 'GUARD_UNEXPECTED_RESULT'); }
  const th = () => { throw new Error('spawn exploded'); };
  assertPreBlock(decide(evt, { ...PRE, resolve: sidOk(CC_AGENT_SID), spawn: th }), 'GATE_INTERNAL_ERROR');
  assertPermBlock(decide(evt, { ...PERM, resolve: sidOk(CC_AGENT_SID), spawn: th }), 'GATE_INTERNAL_ERROR');
  for (const gp of ['guard.mjs', '.\\guard.mjs', '\\\\srv\\share\\guard.mjs', undefined, 7]) assertPreBlock(decide(evt, { ...PRE, guardPath: gp, resolve: sidOk(CC_AGENT_SID), spawn: th }), 'GUARD_PATH_NOT_ABSOLUTE');
  // really missing guard file: node exits 1 with a module error -> DENY
  assertPreBlock(decide(evt, { event: 'PreToolUse', guardPath: 'C:\\no-such-dir\\guard.mjs', guardArgs: [ADAPTER, '--event', 'PreToolUse'], resolve: sidOk(CC_AGENT_SID) }), 'GUARD_UNEXPECTED_RESULT');
});

test('cc-agent: unpinned / invalid --event and unreadable or oversized stdin are DENY (exit-2 form)', () => {
  const sp = spawnReturning(() => { throw new Error('guard must not run'); });
  for (const e of [undefined, 'SubagentStart', 'pretooluse', '']) assertPreBlock(decide(B('{}'), { event: e, guardPath: GUARD, resolve: sidOk(CC_AGENT_SID), spawn: sp }), 'EVENT_NOT_PINNED');
  assertPreBlock(decide(null, { ...PRE, resolve: sidOk(CC_AGENT_SID), spawn: sp }), 'STDIN_TOO_LARGE_OR_UNREADABLE');
  assertPermBlock(decide(null, { ...PERM, resolve: sidOk(CC_AGENT_SID), spawn: sp }), 'STDIN_TOO_LARGE_OR_UNREADABLE');
  assert.equal(sp.calls.length, 0);
});

// ---------- stdin integrity, env, injection (real child processes for the guard stand-in)
test('stdin bytes reach the guard unchanged (BOM, CRLF, NUL, invalid UTF-8, 600 KiB)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idgate-'));
  try {
    const fake = join(dir, 'fake-guard.mjs');
    writeFileSync(fake, `import {readFileSync} from 'node:fs'; const h=process.argv[2]; const d=readFileSync(0); const x=await import('node:crypto');
if (x.createHash('sha256').update(d).digest('hex')===h) process.exit(0); process.stderr.write('BLOCKED(wrapper): STDIN_MISMATCH'); process.exit(2);`);
    for (const raw of [Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]), B('{"a":"x"}\r\n\r\n'), Buffer.from([0, 1, 2, 0xff, 0xfe, 0x80]), Buffer.alloc(600 * 1024, 0x61), B('{"hook_event_name":"PreToolUse"}  ')]) {
      const h = createHash('sha256').update(raw).digest('hex');
      const o = decide(raw, { event: 'PreToolUse', guardPath: fake, guardArgs: [h, '--event', 'PreToolUse'], resolve: sidOk(CC_AGENT_SID) });
      assert.deepEqual([o.exitCode, o.stdout.length, o.stderr.length], [0, 0, 0], `len ${raw.length}`);
    }
    const o = decide(B('x'), { event: 'PreToolUse', guardPath: fake, guardArgs: ['0'.repeat(64)], resolve: sidOk(CC_AGENT_SID) });
    assert.equal(o.exitCode, 2); assert.equal(o.stderr.toString(), 'BLOCKED(wrapper): STDIN_MISMATCH'); // control: mismatch is detected
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('environment cannot change identity or leak into the guard (USERNAME/USERPROFILE/SID vars, NODE_OPTIONS, HOOKLOG)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'idgate-'));
  const saved = Object.fromEntries(['USERNAME', 'USERPROFILE', 'USERDOMAIN', 'IDGATE_SID', 'CRYPT_SID', 'NODE_OPTIONS', 'HOOKLOG'].map((k) => [k, process.env[k]]));
  try {
    const fake = join(dir, 'fake-guard.mjs');
    // Measured: node on Windows re-adds USERNAME/USERPROFILE/USERDOMAIN/HOME*/LOGONSERVER to a child even with an explicit minimal env
    // (with the PARENT's values), so those cannot be filtered here. Neither the gate nor guard.mjs/adapter reads them (source test below);
    // identity is whoami only. What the gate does control is checked here: code-injection / log-path / identity-hint variables.
    writeFileSync(fake, `const bad=['NODE_OPTIONS','HOOKLOG','IDGATE_SID','CRYPT_SID'].filter(k=>process.env[k]!==undefined);
if(!bad.length) process.exit(0); process.stderr.write('BLOCKED(wrapper): ENV_LEAK'); process.exit(2);`);
    Object.assign(process.env, { USERNAME: 'spoof-crypt', USERPROFILE: 'C:\\Users\\spoof-crypt', USERDOMAIN: 'spoof', IDGATE_SID: CRYPT_SID, CRYPT_SID, NODE_OPTIONS: '--no-warnings', HOOKLOG: join(dir, 'log.txt') });
    // a fake whoami that says cc-agent wins over every env claim of being crypt
    const r = resolveSid(spawnReturning({ status: 0, signal: null, stdout: csv(CC_AGENT_SID), stderr: '' }));
    assert.equal(r.sid, CC_AGENT_SID);
    const o = decide(B('{}'), { event: 'PreToolUse', guardPath: fake, guardArgs: ['--event', 'PreToolUse'], resolve: () => r });
    assert.deepEqual([o.exitCode, o.stdout.length, o.stderr.length], [0, 0, 0]); // guard ran (cc-agent), without leaked vars
    // and an env claim of being cc-agent does not remove the crypt exemption or add privileges to others
    process.env.USERNAME = 'cc-agent';
    assertPreBlock(decide(B('{}'), { ...PRE, resolve: sidOk(OTHER_SID) }), 'SID_NOT_AUTHORIZED');
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('source: node builtins only, whoami by absolute path, no identity from env/argv, no allow/ask output', () => {
  const src = readFileSync(GATE, 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports.filter((i) => !i.startsWith('node:')), ['./authority-grant.mjs']); // D2B-2B: only the canonical ask matcher
  assert.ok(!/USERNAME|USERPROFILE|USERDOMAIN|userInfo|LOGNAME|process\.env\.\w*SID/i.test(src.replace(/\/\/.*$/gm, '')));
  assert.ok(!/behavior:\s*['"]allow|permissionDecision|updatedInput|(?<![.\w])exec\(|execSync|shell:\s*true/.test(src.replace(/\/\/.*$/gm, '')));
  assert.equal([...src.matchAll(/spawn\(/g)].length >= 2, true);
  assert.ok(src.includes("'C:\\\\Windows\\\\System32\\\\whoami.exe'"));
  // the delegated guard/adapter do not read the user-name variables either (they only know CLAUDE_PROJECT_DIR and HOOKLOG)
  for (const f of [GUARD, ADAPTER]) assert.ok(!/USERNAME|USERPROFILE|USERDOMAIN|userInfo/i.test(readFileSync(f, 'utf8')), f);
});

// ---------- guard.mjs + adapter unchanged, real child processes, identity injected as cc-agent
test('real guard via gate (cc-agent): byte-identical to running guard directly, for both events', () => {
  const saved = process.env.CLAUDE_PROJECT_DIR; process.env.CLAUDE_PROJECT_DIR = ROOT;
  try {
    const direct = (base, raw) => spawnSync(process.execPath, [GUARD, ...base.guardArgs], { input: raw, env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT }, encoding: 'buffer' });
    const readInside = join(ROOT, 'scripts', 'guard.mjs');
    const cases = [
      [PRE, ev('PreToolUse', 'Write', { file_path: join(ROOT, 'x.txt'), content: 'a' })], [PRE, ev('PreToolUse', 'Bash', { command: 'git push' })], [PRE, ev('PreToolUse', 'Read', { file_path: readInside })],
      [PRE, ev('PreToolUse', 'Read', { file_path: 'C:\\Windows\\win.ini' })], [PRE, B('not json')], [PRE, Buffer.alloc(0)], [PRE, ev('PermissionRequest', 'Read', { file_path: readInside })],
      [PERM, ev('PermissionRequest', 'Write', { file_path: join(ROOT, 'x.txt'), content: 'a' })], [PERM, ev('PermissionRequest', 'Read', { file_path: readInside })], [PERM, B('not json')],
    ];
    for (const [base, raw] of cases) {
      const d = direct(base, raw);
      const g = decide(raw, { ...base, resolve: sidOk(CC_AGENT_SID) });
      assert.equal(g.exitCode, d.status, base.event); assert.ok(Buffer.from(g.stdout).equals(d.stdout)); assert.ok(Buffer.from(g.stderr).equals(d.stderr));
      noAllow(g.stdout instanceof Buffer ? { stdout: g.stdout.toString(), stderr: g.stderr.toString() } : g);
    }
    // concrete expectations of the unchanged guard through the gate
    assert.equal(decide(cases[0][1], { ...PRE, resolve: sidOk(CC_AGENT_SID) }).exitCode, 2);
    assert.equal(decide(cases[2][1], { ...PRE, resolve: sidOk(CC_AGENT_SID) }).exitCode, 0); // verified Read inside the project: guard's own "no opinion"
    assert.equal(decide(cases[3][1], { ...PRE, resolve: sidOk(CC_AGENT_SID) }).exitCode, 2);
    assert.equal(JSON.parse(decide(cases[7][1], { ...PERM, resolve: sidOk(CC_AGENT_SID) }).stdout).hookSpecificOutput.decision.behavior, 'deny');
  } finally { if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = saved; }
});

test('guardResultOk is strict about types (strings instead of Buffers are not guard results)', () => {
  assert.equal(guardResultOk('PreToolUse', { status: 0, signal: null, stdout: '', stderr: '' }), false);
  assert.equal(guardResultOk('PreToolUse', res(0)), true);
  assert.equal(guardResultOk('SubagentStart', res(0)), false);
});

// ---------- D2B-2B: the future grant "ask" is accepted ONLY with the explicit flag, which no production entry point sets
const ASK = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'GRANT:g-1' } });
test('D2B-2B contract: canonical PreToolUse ask is rejected by default and accepted only with acceptGrantAsk:true', () => {
  const r = res(0, ASK);
  assert.equal(guardResultOk('PreToolUse', r), false); assert.equal(guardResultOk('PreToolUse', r, {}), false);
  for (const v of [undefined, null, 0, 1, 'true', {}, []]) assert.equal(guardResultOk('PreToolUse', r, { acceptGrantAsk: v }), false, String(v));
  assert.equal(guardResultOk('PreToolUse', r, { acceptGrantAsk: true }), true);
  const evt = ev('PreToolUse', 'Write', { file_path: 'C:\\x', content: '' });
  const viaGate = (flag) => decide(evt, { ...PRE, resolve: sidOk(CC_AGENT_SID), spawn: spawnReturning(r), ...(flag ? { acceptGrantAsk: true } : {}) });
  assertPreBlock(viaGate(false), 'GUARD_UNEXPECTED_RESULT');
  const ok = viaGate(true); assert.deepEqual([ok.exitCode, ok.stdout.toString(), ok.stderr.length], [0, ASK, 0]);
});

test('D2B-2B contract: with the flag, only the exact canonical ask passes; allow / defer / deny / near-misses / stderr / PermissionRequest still fail', () => {
  const j = (o) => JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'GRANT:g-1', ...o } });
  const bad = [res(0, j({ permissionDecision: 'allow' })), res(0, j({ permissionDecision: 'defer' })), res(0, j({ permissionDecision: 'deny' })), res(0, j({ updatedInput: { command: 'x' } })), res(0, j({ updatedPermissions: [] })),
    res(0, j({ hookEventName: 'PermissionRequest' })), res(0, j({ permissionDecisionReason: 'g-1' })), res(0, j({ permissionDecisionReason: 'GRANT:' })), res(0, j({ permissionDecisionReason: 'GRANT:a b' })), res(0, j({ permissionDecisionReason: 'GRANT:g-1\nx' })),
    res(0, j({ permissionDecisionReason: 'GRANT:' + 'x'.repeat(65) })), res(0, ASK + '\n'), res(0, ' ' + ASK), res(0, ASK, 'noise'), res(2, ASK, 'BLOCKED(wrapper): X'), res(1, ASK), res(0, JSON.stringify({ hookSpecificOutput: JSON.parse(ASK).hookSpecificOutput, extra: 1 })),
    res(0, '{"hookSpecificOutput":{"permissionDecision":"ask","hookEventName":"PreToolUse","permissionDecisionReason":"GRANT:g-1"}}')]; // key order is part of the canonical form
  for (const r of bad) assert.equal(guardResultOk('PreToolUse', r, { acceptGrantAsk: true }), false, r.stdout.toString().slice(0, 90));
  // PermissionRequest: neither the ask JSON nor a silent exit 0 is ever a valid guard result, flag or not
  for (const r of [res(0, ASK), res(0, ''), res(0, JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }))]) assert.equal(guardResultOk('PermissionRequest', r, { acceptGrantAsk: true }), false);
});

test('D2B-2B: main() of the gate does not enable acceptGrantAsk', () => {
  const src = readFileSync(GATE, 'utf8'); const main = src.slice(src.indexOf('function main()')).replace(/\/\/.*$/gm, '');
  assert.ok(main.includes('decide(raw,') && !/acceptGrantAsk|grant|ask/i.test(main));
});

// ---------- real CLI + real whoami (only meaningful on the crypt token; skipped otherwise)
const live = resolveSid();
const cli = (args, input) => spawnSync(process.execPath, [GATE, ...args], { input, encoding: 'buffer', env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } });
test('LIVE real whoami.exe parses to a SID of the expected shape', { skip: !live.ok && 'whoami unavailable' }, () => {
  assert.ok(live.ok); assert.match(live.sid, /^S-1-5-21-\d+-\d+-\d+-\d+$/);
});
test('LIVE CLI as crypt: exit 0 with empty stdout/stderr for both events, including oversized stdin', { skip: live.sid !== CRYPT_SID && 'this process is not the crypt token' }, () => {
  for (const [e, tool] of [['PreToolUse', 'Write'], ['PermissionRequest', 'Bash']]) {
    const r = cli([GUARD, ADAPTER, '--event', e], ev(e, tool, { command: 'git push', file_path: 'C:\\x', content: 'y' }));
    assert.deepEqual([r.status, r.stdout.length, r.stderr.length], [0, 0, 0], e);
  }
  const big = cli([GUARD, ADAPTER, '--event', 'PreToolUse'], Buffer.alloc(1048576 + 10, 0x20));
  assert.deepEqual([big.status, big.stdout.length, big.stderr.length], [0, 0, 0]);
});
