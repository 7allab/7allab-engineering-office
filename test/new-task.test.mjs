// Offline tests for scripts/new-task.mjs. Temp fixtures only (os.tmpdir, removed afterwards); never writes to the real docs/tasks.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'new-task.mjs');
const made = [];
const TEMPLATE = Buffer.from([0x23, 0x20, 0x54, 0x0d, 0x0a, 0xc3, 0xa7, 0x00, 0xff, 0x0a]); // CRLF, UTF-8, NUL, raw 0xff
const fixture = (withTemplate = true) => {
  const root = mkdtempSync(join(tmpdir(), 'newtask-'));
  made.push(root);
  mkdirSync(join(root, 'docs', 'tasks'), { recursive: true });
  if (withTemplate) writeFileSync(join(root, 'docs', 'tasks', '_TEMPLATE.md'), TEMPLATE);
  return root;
};
const run = (args, cwd) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: cwd ?? tmpdir(), encoding: 'utf8' });
const tasks = (root) => readdirSync(join(root, 'docs', 'tasks')).sort();
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });

test('copies template byte-for-byte with --root; prints path; stderr empty', () => {
  const root = fixture();
  const r = run(['OFFICE-001', '--root', root]);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '');
  assert.equal(r.stdout.trim(), join(root, 'docs', 'tasks', 'OFFICE-001.md'));
  assert.ok(readFileSync(join(root, 'docs', 'tasks', 'OFFICE-001.md')).equals(TEMPLATE));
});

test('without --root uses cwd', () => {
  const root = fixture();
  const r = run(['ABC-123'], root);
  assert.equal(r.status, 0);
  assert.ok(readFileSync(join(root, 'docs', 'tasks', 'ABC-123.md')).equals(TEMPLATE));
});

test('relative --root resolves against cwd', () => {
  const root = fixture();
  const r = run(['ABC-124', '--root', '.'], root);
  assert.equal(r.status, 0);
  assert.ok(existsSync(join(root, 'docs', 'tasks', 'ABC-124.md')));
});

for (const id of ['office-001', 'OFFICE-1', 'OFFICE-0001', 'OFF1-001', 'OFFICE-001x', '']) {
  test(`invalid ID ${JSON.stringify(id)} -> exit 1, no stdout, no file`, () => {
    const root = fixture();
    const r = run([id, '--root', root]);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.notEqual(r.stderr, '');
    assert.deepEqual(tasks(root), ['_TEMPLATE.md']);
  });
}

test('missing ID -> exit 1 usage', () => {
  const root = fixture();
  for (const args of [[], ['--root', root]]) {
    const r = run(args);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /Usage/);
  }
  assert.deepEqual(tasks(root), ['_TEMPLATE.md']);
});

test('existing target is not overwritten', () => {
  const root = fixture();
  const dest = join(root, 'docs', 'tasks', 'OFFICE-001.md');
  writeFileSync(dest, 'keep me');
  const r = run(['OFFICE-001', '--root', root]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.equal(readFileSync(dest, 'utf8'), 'keep me');
});

test('missing template -> exit 1, no target', () => {
  const root = fixture(false);
  const r = run(['OFFICE-001', '--root', root]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.deepEqual(tasks(root), []);
});

test('nonexistent root -> exit 1, nothing created', () => {
  const root = fixture();
  const missing = join(root, 'nope');
  const r = run(['OFFICE-001', '--root', missing]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.equal(existsSync(missing), false);
});

test('bad arguments -> exit 1, no file', () => {
  const root = fixture();
  const cases = [
    ['OFFICE-001', '--root'],
    ['OFFICE-001', '--root', '--other'],
    ['OFFICE-001', '--foo'],
    ['OFFICE-001', `--root=${root}`],
    ['OFFICE-001', 'OFFICE-002', '--root', root],
  ];
  for (const args of cases) {
    const r = run(args, root);
    assert.equal(r.status, 1, JSON.stringify(args));
    assert.equal(r.stdout, '', JSON.stringify(args));
    assert.notEqual(r.stderr, '', JSON.stringify(args));
    assert.ok(!r.stderr.includes('    at '), 'no stack trace');
  }
  assert.deepEqual(tasks(root), ['_TEMPLATE.md']);
});

test('script imports only node: modules', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  const specs = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  for (const s of specs) assert.ok(s.startsWith('node:'), s);
  assert.doesNotMatch(src, /\brequire\(|import\(/);
});
