// LIFE-010: tests for the STAGED hook copy (docs/tasks/LIFE-010-proposed/dot-claude/hooks/scope-guard.mjs) and the
// manifest script. They never import or run the live .claude/hooks/scope-guard.mjs. Temporary files go to os.tmpdir().
// Run: node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs   (SCOPE_GUARD_NO_LOG=1 is also set below)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync, unlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { computeManifest, compareManifest, listFiles, hashEntry } from './office-manifest.mjs';

// F1: the hook runs main() whenever it is loaded. Static imports are hoisted above any statement, so the switch is set
// first and the hook is loaded with a dynamic import after it.
process.env.SCOPE_GUARD_NO_LOG = '1';
process.env.SCOPE_GUARD_NO_MAIN = '1';
const { decide, validateScope, PROTECTED, MCP_ALLOW, formatLogLine, logDecision, finish } = await import('./dot-claude/hooks/scope-guard.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'dot-claude', 'hooks', 'scope-guard.mjs');
// Child processes must run the real hook: never pass the test-only switch on.
const childEnv = (extra = {}) => { const e = { ...process.env, SCOPE_GUARD_NO_LOG: '1', ...extra }; if (!('SCOPE_GUARD_NO_MAIN' in extra)) delete e.SCOPE_GUARD_NO_MAIN; return e; };
const MANIFEST_CLI = join(HERE, 'office-manifest.mjs');
const tmps = [];
const tmp = () => { const d = realpathSync.native(mkdtempSync(join(tmpdir(), 'life010-'))); tmps.push(d); return d; };
after(() => { for (const d of tmps) rmSync(d, { recursive: true, force: true }); });

const sh = (command, agent, tool = 'Bash') => decide({ tool_name: tool, tool_input: { command }, ...(agent ? { agent_type: agent } : {}) });
const ROLES_WITH_SHELL = ['qa-test-engineer', 'implementation-engineer', 'release-evidence-reviewer'];

// ---------- subagents: negative (G6, G6b, G6c, G7, escapes)
const SUBAGENT_DENY = [
  'npm test --script-shell=x',
  'npm test -- --x',
  'npm run test -- x',
  'node --test --test-reporter=./x.mjs',
  'node --test --test-reporter=./x.mjs tests/a.test.mjs',
  'node --test --test-reporter-destination=out.txt tests/a.test.mjs',
  'node --test --import=./x.mjs tests/a.test.mjs',
  'node --test app/x.mjs',
  'node --test tests/x.mjs',
  'node --test tests/../app/x.test.mjs',
  'node --test tests\\a.test.mjs',
  'node --test tests/con.test.mjs',
  'node --test /tests/a.test.mjs',
  'node --test',
  'npm run build',
  'npm run build:x',
  'npm run test:x',
  'npm run lint',
  'npm run check -- --x',
  'npm ci',
  'npm install',
  'git diff --no-index C:\\x NUL',
  'git diff --no-index a b',
  'git -C . diff',
  'git diff ',
  ' git diff',
  'git diff  --stat',
  'git diff --output=x',
  'git diff --ext-diff',
  'git diff --textconv',
  'git log -p',
  'git diff -- ../x',
  'git diff -- C:/x',
  'git diff -- nul',
  'git ls-files --eol=x',
  'git diff --check; rm x',
  'npm test && echo x',
  'git status\ngit push',
  'git config core.fsmonitor x',
  'git -c core.fsmonitor=x status',
];
for (const role of ROLES_WITH_SHELL) {
  for (const c of SUBAGENT_DENY) {
    test(`${role} DENY ${JSON.stringify(c)}`, () => assert.equal(sh(c, role).action, 'deny'));
  }
}

// ---------- subagents: positive git reads (all three roles, E2 + base)
const GIT_OK = ['git diff', 'git status', 'git status --short', 'git ls-files --eol', 'git diff --check', 'git diff --stat', 'git diff --cached --name-only', 'git log --oneline -n 5', 'git branch --show-current', 'git diff -- app/x.js'];
for (const role of ROLES_WITH_SHELL) {
  for (const c of GIT_OK) {
    test(`${role} PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c, role).action, 'pass'));
    test(`${role} PASS (PowerShell) ${JSON.stringify(c)}`, () => assert.equal(sh(c, role, 'PowerShell').action, 'pass'));
  }
}

// ---------- subagents: test commands (qa + implementation yes, reviewer no: E2)
const TEST_OK = ['npm test', 'npm run test', 'npm run check', 'node --test tests/a.test.mjs', 'node --test tests/sub/a.b.test.mjs tests/c.test.mjs'];
for (const c of TEST_OK) {
  test(`qa-test-engineer PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c, 'qa-test-engineer').action, 'pass'));
  test(`implementation-engineer PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c, 'implementation-engineer').action, 'pass'));
  test(`release-evidence-reviewer DENY (E2: no test runs) ${JSON.stringify(c)}`, () => assert.equal(sh(c, 'release-evidence-reviewer').action, 'deny'));
}

test('roles without shell permission are denied', () => {
  for (const r of ['security-engineer', 'product-planner', 'ui-ux-engineer', 'research-engineer', 'software-architect', 'unknown']) assert.equal(sh('git status', r).action, 'deny');
});
test('non-string agent_type is denied, not treated as the Director', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'ls' }, agent_type: 5 }).action, 'deny');
});

// ---------- Director (main session): DANGEROUS deny, ASK, pass (E3, E5)
const DIRECTOR_ASK = [
  'cat >> AGENTS.md', 'echo x > CLAUDE.md', 'Set-Content agents.md x', 'Add-Content -Path .\\Agents.Md -Value x',
  'cp x .claude/task-scope.json', 'cat .claude/settings.json', 'echo x >> .gitignore',
  'echo * text=auto > .gitattributes', 'node docs/x/scope-guard.mjs', 'cp a scripts/guard-scope.mjs', 'vim task-scope.json',
  'python3 -', 'python -c "open(1)"', 'py -', 'node -e "1"', 'node -p 1', 'powershell -enc AAAA', 'pwsh -NoProfile -EncodedCommand AAAA', 'iex $x',
  'npm ci', 'npm install', 'npm i x', 'npx something', 'npm run build', 'npm.cmd ci',
  'git config core.fsmonitor x', 'git -c core.fsmonitor=x status', 'git add .', 'git commit -m x', 'git branch -a',
  'cat AGENTS.\\\nmd',
];
for (const c of DIRECTOR_ASK) test(`Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
test('Director ASK also through PowerShell', () => assert.equal(sh('Set-Content AGENTS.md x', undefined, 'PowerShell').action, 'ask'));

const DIRECTOR_DENY = [
  'git push', 'git push origin main', 'git \\\npush origin main', 'git \\\r\npush', 'git `\npush origin main', 'git -C . \\\n  push',
  'git reset --hard', 'git clean -fd', 'git rebase main', 'git remote add x y', 'git checkout -- .', 'git branch -D x',
  'rm -rf x', 'Remove-Item x -Recurse', 'rd /s x', 'cat AGENTS.md; git push',
];
for (const c of DIRECTOR_DENY) test(`Director DENY ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'deny'));

const DIRECTOR_PASS = ['git status', 'git diff', 'git log --oneline -n 3', 'ls docs', 'npm test', 'npm run check', 'node --test tests/a.test.mjs', 'node scripts/check.mjs', 'cat docs/tasks/LIFE-010.md'];
for (const c of DIRECTOR_PASS) test(`Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));

// ---------- MCP (E4, G3)
test('MCP_ALLOW starts empty and is frozen', () => { assert.deepEqual([...MCP_ALLOW], []); assert.ok(Object.isFrozen(MCP_ALLOW)); });
for (const t of ['mcp__plugin_desktop-commander_desktop-commander__write_file', 'mcp__plugin_desktop-commander_desktop-commander__start_process', 'mcp__claude_ai_Claude_Docs__read', 'MCP__x__y']) {
  test(`MCP DENY ${t} (Director and subagent)`, () => {
    assert.equal(decide({ tool_name: t, tool_input: { path: 'C:\\x', content: 'y' } }).action, 'deny');
    assert.equal(decide({ tool_name: t, tool_input: {}, agent_type: 'qa-test-engineer' }).action, 'deny');
  });
}
test('non-MCP tools outside the guard keep "no opinion"', () => {
  for (const t of ['Read', 'Agent', 'Glob']) assert.equal(decide({ tool_name: t, tool_input: {} }).action, 'pass');
});
test('malformed events are denied', () => {
  for (const e of [null, {}, { tool_name: 'Bash' }, { tool_name: '', tool_input: {} }, { tool_name: 'Bash', tool_input: [] }]) assert.equal(decide(e).action, 'deny');
});

// ---------- validateScope (E1, G5)
const NOW = Date.parse('2026-11-15T00:00:00Z');
const scope = (allow) => ({ taskId: 'T', expires: '2026-11-22T23:59:59Z', allow });
for (const entry of ['AGENTS.md', 'agents.md', 'Agents.MD', 'CLAUDE.md', '.claude/x', '.claude', '.claude/', '.CLAUDE\\task-scope.json', 'scripts/guard-scope.mjs', 'scripts\\Guard-Scope.mjs', '.git/config', '.git', 'docs/.git/x', 'app/.claude/x', '.gitignore', '.gitattributes', 'governance/', 'governance', 'imports/x', 'inventory/x', 'AGENTS.md.', 'AGENTS.md ']) {
  test(`validateScope rejects ${JSON.stringify(entry)}`, () => {
    const v = validateScope(scope(['docs/tasks/T.md', entry]), NOW);
    assert.equal(v.ok, false);
  });
}
for (const allow of [['docs/tasks/LIFE-010.md', 'docs/tasks/LIFE-010-proposed/'], ['app/', 'tests/x.test.mjs'], ['scripts/'], ['scripts/build.mjs']]) {
  test(`validateScope accepts ${JSON.stringify(allow)}`, () => assert.equal(validateScope(scope(allow), NOW).ok, true));
}
test('validateScope keeps base rules (expiry, dot segments, wildcards)', () => {
  assert.equal(validateScope(scope(['app/']), Date.parse('2027-01-01')).ok, false);
  assert.equal(validateScope(scope(['app/../x']), NOW).ok, false);
  assert.equal(validateScope(scope(['app/*']), NOW).ok, false);
  assert.equal(validateScope(scope(['C:/x']), NOW).ok, false);
});
test('PROTECTED contains scripts/guard-scope.mjs (G4)', () => assert.ok(PROTECTED.includes('scripts/guard-scope.mjs')));

// ---------- file gate against a real temporary project root
test('Write decisions: PROTECTED before scope, scope rejection fails closed', () => {
  const root = tmp();
  mkdirSync(join(root, 'app')); mkdirSync(join(root, 'scripts'));
  const w = (rel, allow) => decide({ tool_name: 'Write', tool_input: { file_path: join(root, ...rel.split('/')), content: 'x' } }, { root, now: NOW, readScope: () => scope(allow) });
  assert.equal(w('app/x.js', ['app/']).action, 'pass');
  const g = w('scripts/guard-scope.mjs', ['scripts/']);
  assert.equal(g.action, 'deny'); assert.match(g.reason, /Owner-only/);
  assert.equal(w('scripts/build.mjs', ['scripts/']).action, 'pass');
  assert.equal(w('AGENTS.md', ['AGENTS.md']).action, 'deny');
  const r = w('app/x.js', ['app/', 'AGENTS.md']);
  assert.equal(r.action, 'deny'); assert.match(r.reason, /task scope rejected: Owner-only path/);
  assert.equal(w('app/x.js', ['tests/']).action, 'deny');
});

// ---------- log (G10)
test('log line carries the full command up to 300 characters, plus its length when cut', () => {
  const long = 'echo ' + 'a'.repeat(1000);
  const o = JSON.parse(formatLogLine({ tool_name: 'Bash', tool_input: { command: long } }, { action: 'pass', reason: '' }));
  assert.equal(o.cmd.length, 300); assert.equal(o.cmdLen, 1005); assert.equal(o.cmd, long.slice(0, 300));
  const s = JSON.parse(formatLogLine({ tool_name: 'Bash', tool_input: { command: 'git status --short' } }, { action: 'pass', reason: '' }));
  assert.equal(s.cmd, 'git status --short'); assert.equal(s.cmdLen, undefined);
  const p = JSON.parse(formatLogLine({ tool_name: 'Write', tool_input: { file_path: 'C:\\p\\x.js', content: 'secret' } }, { action: 'deny', reason: 'r' }));
  assert.equal(p.path, 'C:\\p\\x.js'); assert.equal(JSON.stringify(p).includes('secret'), false);
  const nl = formatLogLine({ tool_name: 'Bash', tool_input: { command: 'a\nb' } }, { action: 'pass', reason: '' });
  assert.equal(nl.includes('\n'), false);
});
test('log rotates at maxBytes and keeps one previous file', () => {
  const dir = tmp(); const file = join(dir, 'scope-guard.log');
  const saved = process.env.SCOPE_GUARD_NO_LOG; delete process.env.SCOPE_GUARD_NO_LOG;
  try {
    writeFileSync(file, 'x'.repeat(2000));
    logDecision({ tool_name: 'Bash', tool_input: { command: 'ls' } }, { action: 'pass', reason: '' }, { file, maxBytes: 1000 });
    assert.ok(existsSync(file + '.1'));
    assert.equal(readFileSync(file + '.1', 'utf8').length, 2000);
    assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 1);
    logDecision({ tool_name: 'Bash', tool_input: { command: 'ls' } }, { action: 'pass', reason: '' }, { file, maxBytes: 1000 });
    assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 2);
  } finally { if (saved !== undefined) process.env.SCOPE_GUARD_NO_LOG = saved; }
});
test('SCOPE_GUARD_NO_LOG=1 writes nothing', () => {
  const dir = tmp(); const file = join(dir, 'scope-guard.log');
  process.env.SCOPE_GUARD_NO_LOG = '1';
  logDecision({ tool_name: 'Bash', tool_input: { command: 'ls' } }, { action: 'pass', reason: '' }, { file });
  assert.equal(existsSync(file), false);
});

// ---------- the staged hook as a process (stdin -> exit code / stdout), no log
const runHook = (event, root = HERE, raw, hook = HOOK, extraEnv = {}) => spawnSync(process.execPath, [hook, root], { input: raw ?? JSON.stringify(event), encoding: 'utf8', env: childEnv(extraEnv) });
test('hook process: MCP write -> exit 2 with BLOCKED on stderr', () => {
  const r = runHook({ tool_name: 'mcp__plugin_desktop-commander_desktop-commander__write_file', tool_input: { path: 'C:\\x', content: 'y' } });
  assert.equal(r.status, 2); assert.match(r.stderr, /BLOCKED: .*MCP tools are off by default/);
});
test('hook process: Director "cat >> AGENTS.md" -> exit 0 with permissionDecision ask', () => {
  const r = runHook({ tool_name: 'Bash', tool_input: { command: 'cat >> AGENTS.md' } });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});
test('hook process: allowed command -> exit 0, empty stdout; BOM-prefixed input accepted', () => {
  const ev = { tool_name: 'Bash', tool_input: { command: 'git status' }, agent_type: 'qa-test-engineer' };
  const r = runHook(ev);
  assert.equal(r.status, 0); assert.equal(r.stdout, '');
  const b = runHook(null, HERE, '\uFEFF' + JSON.stringify(ev));
  assert.equal(b.status, 0);
});
test('hook process: garbage stdin -> exit 2', () => assert.equal(runHook(null, HERE, 'not json').status, 2));

// ================= LIFE-010 round 2: security findings F1-F9 =================
const MCP_WRITE = { tool_name: 'mcp__plugin_desktop-commander_desktop-commander__write_file', tool_input: { path: 'C:\\x', content: 'y' } };

// ---------- F1: a path variant must not disable the hook (fail-closed)
test('F1 hook started through a directory junction still decides (exit 2, not a silent exit 0)', () => {
  const link = join(tmp(), 'via-junction');
  symlinkSync(HERE, link, 'junction');
  const r = runHook(MCP_WRITE, HERE, undefined, join(link, 'dot-claude', 'hooks', 'scope-guard.mjs'));
  assert.equal(r.status, 2, `junction run: exit=${r.status} stderr=${JSON.stringify(r.stderr)}`);
  assert.match(r.stderr, /BLOCKED: .*MCP tools are off by default/);
});
test('F1 hook started with forward slashes and a different letter case still decides', () => {
  // Folder names change case; the extension stays ".mjs" (Node rejects ".MJS" as an unknown extension and exits 1 before loading).
  const variant = HOOK.replace(/\\/g, '/').replace('/dot-claude/hooks/', '/DOT-CLAUDE/Hooks/');
  const r = runHook(MCP_WRITE, HERE, undefined, variant);
  assert.equal(r.status, 2, `variant run: exit=${r.status}`);
});
test('F1 SCOPE_GUARD_NO_MAIN=1 is the only off switch, and the Director is asked before naming it', () => {
  assert.equal(runHook(MCP_WRITE, HERE, undefined, HOOK, { SCOPE_GUARD_NO_MAIN: '1' }).status, 0);
  assert.equal(runHook(MCP_WRITE, HERE, undefined, HOOK, { SCOPE_GUARD_NO_MAIN: '0' }).status, 2);
  for (const c of ['setx SCOPE_GUARD_NO_MAIN 1', '$env:SCOPE_GUARD_NO_MAIN=1', 'export SCOPE_GUARD_NO_LOG=1']) assert.equal(sh(c).action, 'ask', c);
});
test('F1 the hook source has no isMain path comparison', () => {
  const src = readFileSync(HOOK, 'utf8');
  assert.equal(/\bisMain\b|process\.argv\[1\]/.test(src), false);
  assert.match(src, /if \(process\.env\.SCOPE_GUARD_NO_MAIN !== '1'\) main\(\)/);
});

// ---------- F2: any .git/ or .git\ path asks for the Director; .github does not
// Hook names chosen so no git verb rule also matches (pre-commit would match "commit"): each test isolates the name rule.
for (const c of ['echo x > .git/hooks/applypatch-msg', 'Set-Content .git\\hooks\\pre-applypatch x', 'cat .git/info/exclude', 'echo x >> .git\\info\\attributes', 'type .git\\HEAD', 'cd .git', 'ls repo/.git/hooks']) {
  test(`F2 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['cat .github/workflows/x.yml', 'ls .github', 'Get-Content .github\\CODEOWNERS', 'ls .gitkeep-dir']) {
  test(`F2 Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}

// ---------- F3: agent/memory instruction files at any depth
test('F3 Write: AGENTS.md / CLAUDE.md / CLAUDE.local.md / .mcp.json denied at any depth even when the scope covers the folder', () => {
  const root = tmp();
  mkdirSync(join(root, 'docs', 'sub'), { recursive: true });
  const w = (rel, allow) => decide({ tool_name: 'Write', tool_input: { file_path: join(root, ...rel.split('/')), content: 'x' } }, { root, now: NOW, readScope: () => scope(allow) });
  for (const rel of ['docs/CLAUDE.md', 'docs/sub/agents.md', 'docs/Claude.Local.md', 'docs/sub/.mcp.json']) {
    const d = w(rel, ['docs/']);
    assert.equal(d.action, 'deny', rel); assert.match(d.reason, /Owner-only/, rel);
  }
  for (const rel of ['CLAUDE.local.md', '.mcp.json']) assert.equal(w(rel, ['docs/']).action, 'deny', rel);
  assert.equal(w('docs/notes.md', ['docs/']).action, 'pass');
  assert.equal(w('docs/claude-notes.md', ['docs/']).action, 'pass');
});
for (const entry of ['docs/CLAUDE.md', 'docs/sub/AGENTS.md', 'CLAUDE.local.md', 'docs/claude.local.md', '.mcp.json', 'x/.MCP.json']) {
  test(`F3 validateScope rejects ${JSON.stringify(entry)}`, () => assert.equal(validateScope(scope([entry]), NOW).ok, false));
}
test('F3 PROTECTED has claude.local.md and .mcp.json', () => { assert.ok(PROTECTED.includes('claude.local.md')); assert.ok(PROTECTED.includes('.mcp.json')); });
for (const c of ['echo x > CLAUDE.local.md', 'cat .mcp.json', 'notepad docs\\CLAUDE.md']) {
  test(`F3 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}

// ---------- F4: restore / reset / pull / fetch / clone / revert
// Base rules already DENY (fail-safe over-match, unchanged): `git restore --staged x` (restore\s+--) and `git pull --rebase=...` (rebase).
for (const c of ['git restore app/x.js', 'git reset', 'git reset HEAD~1', 'git reset --soft HEAD~1', 'git reset --mixed', 'git pull', 'git pull origin main', 'git fetch', 'git fetch --all', 'git clone https://example.invalid/r', 'git revert HEAD']) {
  test(`F4 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
test('F4 git reset --hard and git restore . stay DENY', () => { assert.equal(sh('git reset --hard HEAD~1').action, 'deny'); assert.equal(sh('git restore .').action, 'deny'); });

// ---------- F5: config by option or environment
// Round 3: chosen so only the F5 rule matches (no "git" word before "config", no GIT_*= assignment, which N4 also asks).
for (const c of ['"$GITEXE" --config-env=core.pager=X log', '& $g --config-env core.fsmonitor=V status', 'echo $GIT_CONFIG_GLOBAL', 'printenv GIT_CONFIG_PARAMETERS', 'Get-Item Env:GIT_EXTERNAL_DIFF', 'echo %GIT_EXTERNAL_DIFF%']) {
  test(`F5 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}

// ---------- F6: package managers
// Round 3: "npm -g install x" style cases removed here: both the -g rule and the install-verb rule ask on them, so no
// single mutation turned them red (no evidence of their own). The -g rule is pinned by "npm ls -g"/"npm --global outdated".
for (const c of ['npm --prefix app install', 'npm --loglevel silent ci', 'npm init vite', 'npm create vite@latest', 'npm.ps1 ci', 'npm run verify', 'npm run-script verify', 'npm --silent run build', 'pnpm add x', 'pnpm install', 'pnpm i', 'yarn add x', 'yarn install', 'bun add x', 'bun install', 'bun.exe i']) {
  test(`F6 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
// Only the -g/--global rule catches these: no install-like verb, so the package-verb rule (N2) does not match.
for (const c of ['npm ls -g', 'npm --global outdated']) {
  test(`F6 Director ASK (global rule only) ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['npm test', 'npm run test', 'npm run check', 'npm --version', 'npm ls', 'yarn --version', 'pnpm test']) {
  test(`F6 Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}
for (const c of ['npm run verify', 'npm -g install x', 'pnpm install']) {
  test(`F6 subagents DENY ${JSON.stringify(c)}`, () => { for (const r of ROLES_WITH_SHELL) assert.equal(sh(c, r).action, 'deny', r); });
}

// ---------- F7: the log comment states that agents can READ the log
test('F7 log comment: Owner-only for writes only; Read can read the full command text', () => {
  const src = readFileSync(HOOK, 'utf8');
  assert.match(src, /"Owner-only" holds for WRITES only/);
  assert.match(src, /the Read tool and any shell can READ it, full command text included/);
  assert.equal(/the log stays under \.claude\/ \(git-excluded, Owner-only\)/.test(src), false);
});

// ---------- F8: decision text is written before the process exits
test('F8 finish() exits only from the write callback, with the decision code', () => {
  const saved = process.exitCode;
  try {
    let cb = null, written = null; const exits = [];
    const stream = { write: (t, done) => { written = t; cb = done; return false; } };
    finish(2, stream, 'BLOCKED: x\n', (c) => exits.push(c));
    assert.equal(written, 'BLOCKED: x\n');
    assert.deepEqual(exits, []);            // nothing exits while the write is pending
    assert.equal(process.exitCode, 2);      // but the code is already set
    cb();
    assert.deepEqual(exits, [2]);
    const e2 = []; finish(0, undefined, undefined, (c) => e2.push(c));
    assert.deepEqual(e2, [0]);
  } finally { process.exitCode = saved; }
});
// Process-level check. Node documents pipes as synchronous on Windows, so this may also pass with an immediate exit;
// the unit test above is the one that pins the write-then-exit order.
test('F8 hook process: ask JSON for a 200 kB command and a 100 kB deny reason arrive complete', () => {
  const long = 'cat AGENTS.md ' + 'x'.repeat(200000);
  const a = runHook({ tool_name: 'Bash', tool_input: { command: long } });
  assert.equal(a.status, 0);
  assert.equal(JSON.parse(a.stdout).hookSpecificOutput.permissionDecision, 'ask');
  const toolName = 'mcp__' + 'y'.repeat(100000);
  const d = runHook({ tool_name: toolName, tool_input: {} });
  assert.equal(d.status, 2);
  assert.ok(d.stderr.trim().endsWith('the Owner allows exact names in MCP_ALLOW'));
  assert.ok(d.stderr.includes(toolName));
});

// ---------- F9: trailing slashes do not slip past the Owner-only check
for (const entry of ['AGENTS.md/', 'agents.md//', 'scripts/guard-scope.mjs/', 'scripts\\guard-scope.mjs\\', '.gitignore/', '.gitattributes/', 'claude.local.md/']) {
  test(`F9 validateScope rejects ${JSON.stringify(entry)}`, () => {
    const v = validateScope(scope([entry]), NOW);
    assert.equal(v.ok, false); assert.match(v.reason, /Owner-only path/);
  });
}
test('F9 normal folder entries with a trailing slash are still accepted', () => {
  for (const e of ['scripts/', 'docs/tasks/', 'app/']) assert.equal(validateScope(scope([e]), NOW).ok, true, e);
});

// ================= LIFE-010 round 3: N1-N5 and the git branch --show-current exemption =================
// Each ASK case is chosen so that only the rule under test matches it (checked by mutation-check.mjs "never killed").
// ---------- N1: GitHub CLI
for (const c of ['gh pr merge 12 --squash', 'gh release create v1', 'gh api -X POST repos/o/r/issues', 'gh.exe pr create --fill', 'cd app && gh repo sync']) {
  test(`N1 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['echo high', 'ls ghost', 'cat ghsa.txt', 'Get-ChildItem .\\gh-pages']) {
  test(`N1 Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}
test('N1 subagents cannot run gh', () => { for (const r of ROLES_WITH_SHELL) assert.equal(sh('gh pr list', r).action, 'deny', r); });

// ---------- N2: package-manager verb at any position
for (const c of ['npm --prefix app install', 'npm --loglevel silent ci', 'npm --prefix . uninstall x', 'npm clean-install', 'npm ic', 'npm version patch', 'npm pkg set dependencies.x=1', 'npm unlink x', 'pnpm dlx cowsay', 'pnpm --dir app add x', 'pnpm up', 'pnpm remove x', 'yarn dlx cowsay', 'yarn --cwd app add x', 'bun --cwd app install', 'npm.cmd --prefix app rm x']) {
  test(`N2 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['npm test', 'npm run check', 'npm run test', 'npm --prefix app test', 'pnpm test', 'bun test', 'yarn --version', 'npm ls', 'npm outdated', 'echo install']) {
  test(`N2 Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}
// R3-1 (security round 3): verbs touching punctuation, and npm's hyphenated install aliases, asked in round 2 and must ask now.
// The quoted-verb cases pin the start delimiter (verb right after a quote); the others pin the end delimiter.
for (const c of ['npm ci&&npm test', 'npm ci;npm test', '(npm ci)', 'npm install|tee log', 'pnpm i;x', 'cmd /c "npm ci"', 'npm install-test', 'npm install-clean', 'npm "install"', "npm --prefix app 'ci'"]) {
  test(`N2 Director ASK (R3-1) ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
// R3-1b (security follow-up): verb after "\" / "^" / "{" / ",", and before "," / "}".
for (const c of ['npm \\ci', 'cmd /c npm ^ci', '&{npm ci}', 'Invoke-Command {npm ci}', 'npm ci,x', 'npm x-y,install']) {
  test(`N2 Director ASK (R3-1b) ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
// Reviewer round 3: pin each alias and each start delimiter on its own. The argument is a plain package name ("lodash")
// that is not itself a verb, and the delimiter case has no space right before the verb.
for (const c of ['npm unlink lodash', 'npm remove lodash', 'npm rm lodash', 'npm r lodash', 'npm up lodash', 'npm test,ci', 'npm run check {ci}', 'npm test \\ci', 'npm test ^ci']) {
  test(`N2 Director ASK (alias/delimiter only) ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['npm run test-ci', 'npm test;echo done', 'npm run check&&echo ok', 'npm test tests/install-flow.test.mjs']) {
  test(`N2 Director PASS (R3-1) ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}
test('N2 npx/bunx always ask (they download and run packages)', () => { for (const c of ['npx something', 'bunx something']) assert.equal(sh(c).action, 'ask', c); });

// ---------- N3: more state-changing git verbs
for (const c of ['git update-ref -d HEAD', 'git gc --prune=now', 'git submodule update --init', 'git notes edit', 'git init', 'git replace a b', 'git reflog expire --expire=now --all']) {
  test(`N3 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}

// ---------- N4: GIT_* and EDITOR assignments
for (const c of ['GIT_PAGER=x git log', '$env:GIT_SSH_COMMAND="x"; git status', 'set GIT_DIR=x', 'export GIT_WORK_TREE=/x', 'EDITOR=vim git log', '$env:EDITOR="notepad"']) {
  test(`N4 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['echo $GIT_DIR', 'echo $EDITOR', 'git log --oneline -n 3']) {
  test(`N4 Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}

// ---------- N5: .git followed by anything but a word character or "-"
for (const c of ['ls .git*', 'gci .git,src', 'type .git>x', 'ls -d .git?', 'cd .git;ls']) {
  test(`N5 Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
for (const c of ['ls .github', 'cat .gitmodules', 'ls .gitkeep', 'cat .git-blame-ignore-revs']) {
  test(`N5 Director PASS ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'pass'));
}

// ---------- .git/config: covered by TWO rules by construction (the .git name rule and the git "config" verb rule).
// No single mutation can turn this red, so it is not counted as discriminating ASK evidence; it guards the path only.
test('Double-covered: commands naming .git/config ask (name rule + git config verb)', () => {
  for (const c of ['notepad .git\\config', 'type .git/config', 'cp x ./.git/config']) assert.equal(sh(c).action, 'ask', c);
});

// ---------- Ext: exact `git branch --show-current` does not ask; every other branch command still does
test('Ext Director PASS exactly "git branch --show-current"', () => assert.equal(sh('git branch --show-current').action, 'pass'));
for (const c of ['git branch', 'git branch -a', 'git branch --show-current ', ' git branch --show-current', 'git branch --show-current --verbose', 'git branch --show-current && git branch x']) {
  test(`Ext Director ASK ${JSON.stringify(c)}`, () => assert.equal(sh(c).action, 'ask'));
}
test('Ext the exemption never overrides DANGEROUS', () => assert.equal(sh('git branch --show-current; git push').action, 'deny'));

// ---------- settings.json (E4, G3). Static check of the proposal only: how Claude Code itself evaluates a matcher is NOT TESTED here.
test('settings.json routes the original tools and mcp__* to the same staged hook command', () => {
  const s = JSON.parse(readFileSync(join(HERE, 'dot-claude', 'settings.json'), 'utf8'));
  const entries = s.hooks.PreToolUse;
  assert.equal(entries.length, 2);
  assert.equal(entries[0].matcher, 'Write|Edit|NotebookEdit|Bash|PowerShell'); // unchanged from the live file
  assert.equal(entries[1].matcher, '^mcp__.*$');
  const re = new RegExp(entries[1].matcher);
  for (const t of ['mcp__plugin_desktop-commander_desktop-commander__write_file', 'mcp__claude_ai_Claude_Docs__read']) assert.ok(re.test(t), t);
  for (const t of ['Write', 'Bash', 'TodoWrite', 'xmcp__a']) assert.equal(re.test(t), false, t);
  for (const e of entries) {
    assert.equal(e.hooks.length, 1);
    assert.deepEqual(e.hooks[0], entries[0].hooks[0]);
    assert.equal(e.hooks[0].args[0], '${CLAUDE_PROJECT_DIR}/.claude/hooks/scope-guard.mjs');
  }
  assert.deepEqual(s.permissions, { deny: ['Read(./.env)', 'Read(./.env.*)'] });
});

// ---------- manifest (E6)
function fakeOffice() {
  const root = tmp();
  for (const d of ['.claude/hooks', '.claude/agents', 'scripts', '.git']) mkdirSync(join(root, ...d.split('/')), { recursive: true });
  for (const f of ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/hooks/scope-guard.mjs', 'scripts/guard-scope.mjs', '.git/config', '.claude/agents/b.md', '.claude/agents/a.md']) writeFileSync(join(root, ...f.split('/')), `content of ${f}\n`);
  writeFileSync(join(root, '.claude', 'agents', 'notes.txt'), 'not an agent');
  return root;
}
test('manifest lists the E6 files and sorted agent definitions only', () => {
  const root = fakeOffice();
  assert.deepEqual(listFiles(root), ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/hooks/scope-guard.mjs', 'scripts/guard-scope.mjs', '.git/config', '.claude/agents/a.md', '.claude/agents/b.md']);
});
test('manifest hash is SHA-256 of the raw bytes', () => {
  const root = tmp(); writeFileSync(join(root, 'AGENTS.md'), 'abc');
  assert.equal(hashEntry(root, 'AGENTS.md'), 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hashEntry(root, 'CLAUDE.md'), 'MISSING');
});
test('manifest compare: identical, changed, missing, added', () => {
  const root = fakeOffice();
  const m = computeManifest(root);
  assert.equal(Object.keys(m.files).length, 8);
  assert.ok(Object.values(m.files).every((v) => /^sha256:[0-9a-f]{64}$/.test(v)));
  assert.deepEqual(compareManifest(m, computeManifest(root)), []);
  writeFileSync(join(root, 'AGENTS.md'), 'changed\n');
  unlinkSync(join(root, 'CLAUDE.md'));
  writeFileSync(join(root, '.claude', 'agents', 'c.md'), 'new agent');
  const d = compareManifest(m, computeManifest(root));
  assert.deepEqual(d.map((x) => x.path), ['.claude/agents/c.md', 'AGENTS.md', 'CLAUDE.md']);
  assert.equal(d.find((x) => x.path === 'CLAUDE.md').actual, 'MISSING');
  assert.equal(d.find((x) => x.path === '.claude/agents/c.md').expected, 'ABSENT');
});
test('manifest CLI: generate 0, verify 0, verify after change 1, bad usage 2', () => {
  const root = fakeOffice(); const out = join(tmp(), 'office-manifest.json');
  const run = (...a) => spawnSync(process.execPath, [MANIFEST_CLI, ...a], { encoding: 'utf8' });
  const g = run('generate', out, '--root', root);
  assert.equal(g.status, 0, g.stderr); assert.match(g.stdout, /WROTE .*\(8 entries\)/); assert.equal(g.stderr, '');
  const v = run('verify', out, '--root', root);
  assert.equal(v.status, 0); assert.match(v.stdout, /OK 8 entries identical/);
  writeFileSync(join(root, '.claude', 'settings.json'), '{}');
  const v2 = run('verify', out, '--root', root);
  assert.equal(v2.status, 1); assert.match(v2.stdout, /CHANGED \.claude\/settings\.json/);
  assert.equal(run('verify').status, 2);
  assert.equal(run('frobnicate', out).status, 2);
  assert.equal(run('verify', join(root, 'nope.json'), '--root', root).status, 2);
  const inside = run('generate', join(root, 'm.json'), '--root', root);
  assert.equal(inside.status, 0); assert.match(inside.stderr, /WARNING: manifest is inside the work tree/);
});
