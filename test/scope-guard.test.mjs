// Tests for .claude/hooks/scope-guard.mjs. Windows paths are simulated with an in-memory fs (classifyPath accepts an injected fs),
// so these run anywhere. They do NOT prove behavior inside a live Claude Code session; that is a separate check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, validateScope } from '../.claude/hooks/scope-guard.mjs';

const ROOT = 'C:\\P\\office';
const key = (p) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
function makeFs(dirs, files) {
  const D = new Map(dirs.map((d) => [key(d), d])), F = new Map(files.map((f) => [key(f), f]));
  const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  return {
    realpath: (p) => { const k = key(p); if (D.has(k)) return D.get(k); if (F.has(k)) return F.get(k); throw enoent(); },
    lstat: (p) => { const k = key(p), d = D.has(k), f = F.has(k); if (!d && !f) throw enoent();
      return { isDirectory: () => d, isFile: () => f, isSymbolicLink: () => false, nlink: 1 }; },
  };
}
const fs = makeFs(
  ['C:\\P', ROOT, `${ROOT}\\src`, `${ROOT}\\docs`, `${ROOT}\\governance`, `${ROOT}\\.claude`, 'C:\\Windows'],
  [`${ROOT}\\src\\a.js`, `${ROOT}\\docs\\x.md`, `${ROOT}\\AGENTS.md`, `${ROOT}\\.claude\\settings.json`],
);
const SCOPE = { taskId: 'T-1', allow: ['src/'], expires: '2099-01-01T00:00:00Z' };
const ctx = (scope = SCOPE) => ({ root: ROOT, fs, readScope: () => { if (scope === null) throw new Error('ENOENT'); return scope; } });
const w = (file_path, tool = 'Write', extra = {}) => ({ tool_name: tool, tool_input: { file_path }, ...extra });
const sh = (command, agent, tool = 'Bash') => ({ tool_name: tool, tool_input: { command }, ...(agent ? { agent_type: agent } : {}) });
const act = (e, c = ctx()) => decide(e, c).action;

test('file scope: write inside the approved scope passes', () => {
  assert.equal(act(w(`${ROOT}\\src\\a.js`)), 'pass');
  assert.equal(act(w(`${ROOT}\\src\\a.js`, 'Edit')), 'pass');
});
test('file scope: new file in a new folder under an existing allowed dir passes', () => {
  assert.equal(act(w(`${ROOT}\\src\\new\\b.js`)), 'pass');
});
test('file scope: forward-slash and mixed case spelling still resolves inside', () => {
  assert.equal(act(w('c:/p/OFFICE/SRC/a.js')), 'pass');
});
test('file scope: outside the approved scope is denied', () => {
  assert.equal(act(w(`${ROOT}\\docs\\x.md`)), 'deny');
});
test('file scope: no task-scope file means no writes', () => {
  assert.equal(act(w(`${ROOT}\\src\\a.js`), ctx(null)), 'deny');
});
test('file scope: expired scope is denied', () => {
  assert.equal(act(w(`${ROOT}\\src\\a.js`), ctx({ ...SCOPE, expires: '2020-01-01T00:00:00Z' })), 'deny');
});
test('file scope: dot segments, outside project, UNC, relative paths are denied', () => {
  for (const p of [`${ROOT}\\src\\..\\docs\\x.md`, 'C:\\Windows\\x.txt', '\\\\server\\share\\x', 'src\\a.js', `${ROOT}\\src\\a.js:stream`])
    assert.equal(act(w(p)), 'deny', p);
});
test('file scope: owner-only paths are denied even when the scope would cover them', () => {
  const wide = { taskId: 'T-2', allow: ['governance/', '.claude/', 'agents.md', 'src/'] };
  for (const p of [`${ROOT}\\AGENTS.md`, `${ROOT}\\governance\\new.md`, `${ROOT}\\.claude\\settings.json`, `${ROOT}\\.claude\\task-scope.json`])
    assert.equal(act(w(p), ctx(wide)), 'deny', p);
});
test('file scope: missing path field and malformed events are denied', () => {
  assert.equal(act({ tool_name: 'Write', tool_input: {} }), 'deny');
  assert.equal(act(null), 'deny');
  assert.equal(act({ tool_name: 'Write' }), 'deny');
});
test('scope validation: bad entries are rejected', () => {
  for (const allow of [[], ['../x'], ['/abs'], ['C:\\x'], ['src/*'], [''], ['./src/']])
    assert.equal(validateScope({ taskId: 'x', allow }).ok, false, JSON.stringify(allow));
  assert.equal(validateScope({ allow: ['src/'] }).ok, false);
  assert.equal(validateScope({ taskId: 'x', allow: ['src/'], expires: 'nope' }).ok, false);
});

test('shell: subagent without a shell rule is denied', () => {
  assert.equal(act(sh('node --test test/a.test.mjs', 'product-planner')), 'deny');
  assert.equal(act(sh('node --test test/a.test.mjs', 'unknown-agent')), 'deny');
});
test('shell: qa and implementation may run plain test commands only', () => {
  for (const a of ['qa-test-engineer', 'implementation-engineer']) {
    for (const ok of ['node --test test/a.test.mjs', 'npm test', 'npm run test:unit', 'npm run lint'])
      assert.equal(act(sh(ok, a)), 'pass', `${a}: ${ok}`);
    for (const bad of ['node --test x; rm -rf /', 'node --test x && git push', 'npm test | tee out', 'node --test x > out.txt',
      'node -e "process.exit()"', 'node --test --import ./evil.mjs', 'npm run deploy', 'git status', 'node --test  x', '$(whoami)', 'node --test `id`'])
      assert.equal(act(sh(bad, a)), 'deny', `${a}: ${bad}`);
  }
});
test('shell: PowerShell tool follows the same allowlist', () => {
  assert.equal(act(sh('node --test test/a.test.mjs', 'qa-test-engineer', 'PowerShell')), 'pass');
  assert.equal(act(sh('Remove-Item -Recurse src', 'qa-test-engineer', 'PowerShell')), 'deny');
});
test('shell: reviewer may run read-only git only', () => {
  for (const ok of ['git diff', 'git diff --stat', 'git log -5', 'git status', 'git show HEAD', 'git rev-parse HEAD', 'git branch --show-current'])
    assert.equal(act(sh(ok, 'release-evidence-reviewer')), 'pass', ok);
  for (const bad of ['git commit -m x', 'git push', 'git add .', 'git diff --output=out.txt', 'git diff --ext-diff', 'git -c core.pager=x diff', 'git branch -D x', 'git diff; git push'])
    assert.equal(act(sh(bad, 'release-evidence-reviewer')), 'deny', bad);
});
test('shell: main session blocks destructive and remote commands', () => {
  for (const bad of ['git push origin main', 'git push --force', 'git reset --hard HEAD~1', 'git clean -fd', 'git rebase main', 'git remote add x y',
    'git checkout -- .', 'git branch -D old', 'rm -rf build', 'Remove-Item C:\\x -Recurse -Force'])
    assert.equal(act(sh(bad)), 'deny', bad);
});
test('shell: main session asks for state-changing git and .claude access', () => {
  for (const q of ['git add src/a.js', 'git commit -m "x"', 'git switch -c feat', 'git tag v1', 'echo x > .claude\\task-scope.json', 'git worktree add ../w'])
    assert.equal(act(sh(q)), 'ask', q);
});
test('shell: main session passes ordinary read commands', () => {
  for (const ok of ['git status', 'git diff --stat', 'git log -3', 'node --test test/a.test.mjs', 'ls -la'])
    assert.equal(act(sh(ok)), 'pass', ok);
});
test('other tools are not this hook\'s business', () => {
  assert.equal(act({ tool_name: 'Read', tool_input: { file_path: 'x' } }), 'pass');
});

// ---- process level: stdin handling (BOM from Windows PowerShell 5.1 pipes, garbage input)
import { spawnSync } from 'node:child_process';
const HOOK = new URL('../.claude/hooks/scope-guard.mjs', import.meta.url);
const run = (input) => spawnSync(process.execPath, [HOOK.pathname.replace(/^\/([A-Za-z]:)/, '$1'), ROOT], { input, encoding: 'utf8' });
const GIT_STATUS = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git status' } });
const GIT_PUSH = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push' } });
test('process: plain JSON on stdin is decided', () => {
  assert.equal(run(GIT_STATUS).status, 0);
  assert.equal(run(GIT_PUSH).status, 2);
});
test('process: a UTF-8 BOM before the JSON is tolerated (and the decision is still correct)', () => {
  assert.equal(run('﻿' + GIT_STATUS).status, 0);
  assert.equal(run('﻿' + GIT_PUSH).status, 2);
});
test('process: empty or garbage stdin blocks', () => {
  assert.equal(run('').status, 2);
  assert.equal(run('not json').status, 2);
});
