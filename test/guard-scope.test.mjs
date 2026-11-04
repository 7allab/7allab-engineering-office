// Offline tests for scripts/guard-scope.mjs (K2-03-B prototype). Harmless temp fixtures only (os.tmpdir, removed afterwards);
// no model, no network, no repo writes, no hook/settings, no Git. Skipped checks are reported as NOT VERIFIED, never as passes.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, linkSync, rmSync, rmdirSync, unlinkSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { classifyPath, scopeOfEvent, failureDisposition, SCOPES } from '../scripts/guard-scope.mjs';
import { checkReadPath } from '../scripts/guard.mjs';

const WIN = process.platform === 'win32';
const NOT_WIN = !WIN && 'NOT VERIFIED: the classifier targets Windows drive paths';
const T = realpathSync.native(tmpdir());
const U = mkdtempSync(join(T, 'gscope-'));
const ROOT = join(U, 'proj');
const OUT = join(U, 'outside');
const EVIL = join(U, 'proj-evil'); // sibling whose name starts with the root's name
const links = [];
const mk = (p) => mkdirSync(p, { recursive: true });
mk(join(ROOT, 'in')); mk(join(ROOT, 'real')); mk(OUT); mk(EVIL);
writeFileSync(join(ROOT, 'in', 'a.txt'), 'inside');
writeFileSync(join(ROOT, 'real', 'b.txt'), 'inside-b');
writeFileSync(join(ROOT, '.env'), 'SYNTHETIC=1');
writeFileSync(join(OUT, 's.txt'), 'outside');
writeFileSync(join(EVIL, 'e.txt'), 'evil');
const tryMake = (fn, link) => { try { fn(); links.push(link); return true; } catch { return false; } };
const junctionOut = tryMake(() => symlinkSync(OUT, join(ROOT, 'jout'), 'junction'), join(ROOT, 'jout')); // inside -> outside
const junctionIn = tryMake(() => symlinkSync(join(ROOT, 'real'), join(ROOT, 'jin'), 'junction'), join(ROOT, 'jin')); // inside -> inside
const junctionInto = tryMake(() => symlinkSync(ROOT, join(OUT, 'jinto'), 'junction'), join(OUT, 'jinto')); // outside -> project
let fileLinkOk = true; try { symlinkSync(join(OUT, 's.txt'), join(ROOT, 'flink.txt'), 'file'); links.push(join(ROOT, 'flink.txt')); } catch { fileLinkOk = false; }
let hardOk = true; try { linkSync(join(OUT, 's.txt'), join(ROOT, 'hl.txt')); links.push(join(ROOT, 'hl.txt')); } catch { hardOk = false; }
const needJ = (ok) => NOT_WIN || (!ok && 'NOT VERIFIED: link creation not permitted in this environment');

after(() => {
  // remove link entries first so nothing is ever followed, then the fixture tree (only if it really is our temp dir)
  for (const l of links) { try { rmdirSync(l); } catch { try { unlinkSync(l); } catch { /* already gone */ } } }
  if (U.startsWith(T + sep) && /gscope-/.test(U)) rmSync(U, { recursive: true, force: true });
});

const ev = (tool, ti, extra = {}) => ({ session_id: 's', cwd: ROOT, hook_event_name: 'PreToolUse', tool_use_id: 't', tool_name: tool, tool_input: ti, ...extra });
const A = join(ROOT, 'in', 'a.txt');
const invariant = (r) => { assert.equal(r.allow, false); assert.equal(r.authority, 'NONE'); assert.ok(SCOPES.includes(r.scope), `scope ${r.scope}`); };

test('inside file: real-path verified, regular file', { skip: NOT_WIN }, () => {
  const r = classifyPath(A, ROOT);
  assert.equal(r.scope, 'INSIDE_VERIFIED'); assert.equal(r.code, 'REAL_PATH_INSIDE'); assert.equal(r.entry, 'file'); assert.equal(r.exists, true);
});

test('outside file and the sibling that merely shares the root name prefix are OUTSIDE, never inside', { skip: NOT_WIN }, () => {
  assert.equal(classifyPath(join(OUT, 's.txt'), ROOT).scope, 'OUTSIDE_VERIFIED');
  const evil = classifyPath(join(EVIL, 'e.txt'), ROOT);
  assert.equal(evil.scope, 'OUTSIDE_VERIFIED'); assert.equal(evil.code, 'RESOLVES_OUTSIDE_PROJECT');
});

test('paths that cannot be decided exactly are UNVERIFIABLE with a specific reason (never inside)', { skip: NOT_WIN }, () => {
  const cases = [
    ['..\\x', 'NOT_DRIVE_ABSOLUTE'], ['in\\a.txt', 'NOT_DRIVE_ABSOLUTE'], ['/etc/passwd', 'NOT_DRIVE_ABSOLUTE'], ['\\rooted', 'NOT_DRIVE_ABSOLUTE'], ['C:rel.txt', 'NOT_DRIVE_ABSOLUTE'],
    ['\\\\host\\share\\x', 'UNC_OR_DEVICE_PATH'], ['\\\\?\\' + A, 'UNC_OR_DEVICE_PATH'], ['\\\\.\\C:\\x', 'UNC_OR_DEVICE_PATH'],
    [A + ':stream', 'ALTERNATE_DATA_STREAM'], [join(ROOT, 'in', '*.txt'), 'WILDCARD_OR_INVALID_CHAR'],
    [ROOT + '\\in\\..\\in\\a.txt', 'DOT_SEGMENT'], [join(ROOT, 'in') + '\\.\\a.txt', 'DOT_SEGMENT'], // plain strings: path.join would normalize the ".." away
    [A + '.', 'TRAILING_DOT_OR_SPACE'], [join(ROOT, 'nul'), 'DEVICE_NAME'], [join(ROOT, 'PROGRA~1', 'x'), 'SHORT_NAME_8_3'],
    [' ' + A, 'PATH_ODD_CHARS'], [A + '\u202e', 'PATH_ODD_CHARS'], ['', 'PATH_MISSING_OR_TOO_LONG'], ['C:\\' + 'a'.repeat(5000), 'PATH_MISSING_OR_TOO_LONG'],
  ];
  for (const [p, code] of cases) { const r = classifyPath(p, ROOT); assert.equal(r.scope, 'UNVERIFIABLE', JSON.stringify(p)); assert.equal(r.code, code, JSON.stringify(p)); }
  assert.equal(classifyPath(A, 'relative\\root').code, 'ROOT_NOT_ABSOLUTE');
  assert.equal(classifyPath(A, join(U, 'no-such-root')).code, 'ROOT_UNRESOLVABLE');
  assert.equal(classifyPath(A, A).code, 'ROOT_NOT_DIRECTORY');
});

test('missing targets: a read of a missing file is UNVERIFIABLE; a write needs a verified existing ancestor', { skip: NOT_WIN }, () => {
  assert.equal(classifyPath(join(ROOT, 'in', 'missing.txt'), ROOT).code, 'NOT_FOUND');
  const w = classifyPath(join(ROOT, 'in', 'new.txt'), ROOT, { intent: 'write' });
  assert.equal(w.scope, 'INSIDE_VERIFIED'); assert.equal(w.code, 'NEW_PATH_IN_VERIFIED_DIR'); assert.equal(w.exists, false);
  const deep = classifyPath(join(ROOT, 'in', 'x', 'y', 'z.txt'), ROOT, { intent: 'write' });
  assert.equal(deep.scope, 'INSIDE_VERIFIED'); assert.equal(deep.exists, false);
  assert.equal(classifyPath(join(OUT, 'new', 'z.txt'), ROOT, { intent: 'write' }).scope, 'OUTSIDE_VERIFIED');
  assert.equal(classifyPath(join(A, 'child.txt'), ROOT, { intent: 'write' }).code, 'ANCESTOR_NOT_DIRECTORY'); // a file cannot be a parent
  assert.equal(classifyPath('Z:\\no\\such\\drive\\x.txt', ROOT, { intent: 'write' }).scope, 'UNVERIFIABLE');
});

test('junction inside -> outside resolves OUTSIDE (the string says inside, the real path says outside)', { skip: needJ(junctionOut) }, () => {
  const r = classifyPath(join(ROOT, 'jout', 's.txt'), ROOT);
  assert.equal(r.scope, 'OUTSIDE_VERIFIED'); assert.equal(r.code, 'RESOLVES_OUTSIDE_PROJECT'); assert.equal(r.via_link, true);
  assert.equal(classifyPath(join(ROOT, 'jout', 'new.txt'), ROOT, { intent: 'write' }).scope, 'OUTSIDE_VERIFIED'); // writes through the link too
});

test('junction inside -> inside is an alias, not verified; a junction from outside into the project is not verified either', { skip: needJ(junctionIn && junctionInto) }, () => {
  assert.equal(classifyPath(join(ROOT, 'jin', 'b.txt'), ROOT).code, 'ALIASED_INSIDE');
  assert.equal(classifyPath(join(OUT, 'jinto', 'in', 'a.txt'), ROOT).code, 'ALIASED_INTO_PROJECT');
});

test('file symlink to outside and hard link are never INSIDE_VERIFIED', { skip: NOT_WIN || (!(fileLinkOk || hardOk) && 'NOT VERIFIED: neither file symlink nor hard link could be created here') }, () => {
  if (fileLinkOk) { const r = classifyPath(join(ROOT, 'flink.txt'), ROOT); assert.notEqual(r.scope, 'INSIDE_VERIFIED'); }
  if (hardOk) { const r = classifyPath(join(ROOT, 'hl.txt'), ROOT); assert.equal(r.scope, 'UNVERIFIABLE'); assert.equal(r.code, 'HARD_LINKED_FILE'); }
});

test('sensitive names are located inside but flagged (the location verdict is not a safety verdict)', { skip: NOT_WIN }, () => {
  const r = classifyPath(join(ROOT, '.env'), ROOT);
  assert.equal(r.scope, 'INSIDE_VERIFIED'); assert.equal(r.sensitive_name, true);
  assert.equal(classifyPath(A, ROOT).sensitive_name, false);
});

test('event Read: the decision follows the file, never cwd; cwd is context only', { skip: NOT_WIN }, () => {
  const cwdOut = scopeOfEvent(ev('Read', { file_path: A }, { cwd: OUT }), { projectRoot: ROOT });
  invariant(cwdOut);
  assert.equal(cwdOut.scope, 'INSIDE_VERIFIED'); // file is provably inside even though cwd is not
  assert.notEqual(cwdOut.context.cwd.scope, 'INSIDE_VERIFIED'); assert.equal(cwdOut.context.decided_by_cwd, false);
  const fileOut = scopeOfEvent(ev('Read', { file_path: join(OUT, 's.txt') }), { projectRoot: ROOT }); // cwd inside, file outside
  invariant(fileOut); assert.equal(fileOut.scope, 'OUTSIDE_VERIFIED');
  const noCwd = scopeOfEvent({ ...ev('Read', { file_path: A }), cwd: undefined }, { projectRoot: ROOT });
  assert.equal(noCwd.scope, 'INSIDE_VERIFIED'); assert.equal(noCwd.context.cwd, null);
  const rel = scopeOfEvent(ev('Read', { file_path: 'in\\a.txt' }), { projectRoot: ROOT }); // relative path is not resolved against cwd
  assert.equal(rel.scope, 'UNVERIFIABLE'); assert.equal(rel.code, 'NOT_DRIVE_ABSOLUTE');
});

test('event Read with several path fields: the least safe field decides', { skip: NOT_WIN }, () => {
  const r = scopeOfEvent(ev('Read', { file_path: A, path: join(OUT, 's.txt') }), { projectRoot: ROOT });
  invariant(r); assert.notEqual(r.scope, 'INSIDE_VERIFIED'); assert.equal(r.targets.length, 2);
  assert.equal(scopeOfEvent(ev('Read', { path: A }), { projectRoot: ROOT }).code, 'REQUIRED_PATH_FIELD_MISSING');
});

test('event Write / Edit / NotebookEdit: location can be verified, authorization never is', { skip: NOT_WIN }, () => {
  for (const [tool, field] of [['Write', 'file_path'], ['Edit', 'file_path'], ['NotebookEdit', 'notebook_path']]) {
    const inside = scopeOfEvent(ev(tool, { [field]: join(ROOT, 'in', 'new.txt') }), { projectRoot: ROOT });
    invariant(inside); assert.equal(inside.scope, 'INSIDE_VERIFIED'); assert.equal(inside.authorization, 'NOT_EVALUATED');
    const outside = scopeOfEvent(ev(tool, { [field]: join(OUT, 'new.txt') }), { projectRoot: ROOT });
    invariant(outside); assert.equal(outside.scope, 'OUTSIDE_VERIFIED');
  }
  assert.equal(scopeOfEvent(ev('NotebookEdit', { file_path: A }), { projectRoot: ROOT }).code, 'REQUIRED_PATH_FIELD_MISSING');
});

test('event Glob / Grep: a verified search ROOT is not a verified result set; escaping patterns are refused', { skip: NOT_WIN }, () => {
  const g = scopeOfEvent(ev('Glob', { pattern: '*.txt', path: join(ROOT, 'in') }), { projectRoot: ROOT });
  invariant(g); assert.equal(g.scope, 'INSIDE_ROOT_ONLY'); assert.equal(g.contents_checked, false);
  const viaCwd = scopeOfEvent(ev('Grep', { pattern: 'x' }), { projectRoot: ROOT });
  assert.equal(viaCwd.scope, 'INSIDE_ROOT_ONLY'); assert.equal(viaCwd.context.search_root_is_cwd, true);
  for (const pattern of ['C:\\Windows\\*', '\\\\x\\y\\*', '..\\*', 'a\\..\\..\\*', '/etc/*', 'a:b']) assert.equal(scopeOfEvent(ev('Glob', { pattern, path: join(ROOT, 'in') }), { projectRoot: ROOT }).code, 'PATTERN_ESCAPES', pattern);
  assert.equal(scopeOfEvent(ev('Grep', { pattern: 'x', glob: '..\\*', path: join(ROOT, 'in') }), { projectRoot: ROOT }).code, 'PATTERN_ESCAPES');
  assert.equal(scopeOfEvent(ev('Glob', { pattern: 5, path: join(ROOT, 'in') }), { projectRoot: ROOT }).code, 'PATTERN_ESCAPES');
  assert.equal(scopeOfEvent(ev('Glob', { pattern: '*', path: OUT }), { projectRoot: ROOT }).scope, 'OUTSIDE_VERIFIED');
});

test('LIMIT (documented, not fixed): a verified search root says nothing about links inside it', { skip: needJ(junctionOut) }, () => {
  const g = scopeOfEvent(ev('Glob', { pattern: '**/*.txt', path: ROOT }), { projectRoot: ROOT });
  assert.equal(g.scope, 'INSIDE_ROOT_ONLY'); // a junction to outside sits inside ROOT; the root verdict cannot see it
  assert.equal(g.contents_checked, false);
});

test('Bash / PowerShell: file scope is NEVER verifiable from the command text', { skip: NOT_WIN }, () => {
  const cmds = [
    'echo hi', `type "${A}"`, `cat ${A.replace(/\\/g, '/')}`, 'type ..\\..\\secret.txt', 'cat $HOME/.ssh/id_rsa', 'type %USERPROFILE%\\x', 'Get-Content $env:TEMP\\x',
    `powershell -c "gc (Join-Path ${ROOT} in\\a.txt)"`, `node -e "require('fs').readFileSync(process.argv[1])" ${A}`, 'git -C C:\\other status',
    'cmd /c "ty^pe C:\\secret"', 'powershell -enc VwByAGkAdABlAC0ASABvAHMAdAA=', `copy ${A} ${join(OUT, 'x')}`,
  ];
  for (const tool of ['Bash', 'PowerShell']) for (const command of cmds) {
    const r = scopeOfEvent(ev(tool, { command }), { projectRoot: ROOT });
    invariant(r); assert.equal(r.scope, 'UNVERIFIABLE', command); assert.equal(r.code, 'SHELL_NOT_BOUNDABLE'); assert.equal(r.bounded, false);
  }
  const lex = scopeOfEvent(ev('Bash', { command: `type "${A}"` }), { projectRoot: ROOT });
  assert.ok(lex.lexical_paths.some((p) => p.toLowerCase().includes('a.txt'))); assert.equal(lex.lexical_paths_are_not_exhaustive, true);
  assert.equal(scopeOfEvent(ev('Bash', {}), { projectRoot: ROOT }).code, 'SHELL_NOT_BOUNDABLE'); // even a missing command is not "safe"
});

test('unknown tools, non-file tools and malformed events are UNVERIFIABLE and never throw', { skip: NOT_WIN }, () => {
  for (const tool of ['WebFetch', 'WebSearch', 'Agent', 'mcp__x__y', 'Skill']) assert.equal(scopeOfEvent(ev(tool, { url: 'x' }), { projectRoot: ROOT }).code, 'NOT_FILE_SCOPED_TOOL');
  assert.equal(scopeOfEvent(ev('Brand-New-Tool', { file_path: A }), { projectRoot: ROOT }).code, 'UNKNOWN_TOOL');
  for (const bad of [null, undefined, 5, 'x', [], {}, { tool_name: 'Read' }, { tool_name: 5, tool_input: {} }, { tool_name: 'Read', tool_input: [] }, { tool_name: '', tool_input: {} }]) {
    const r = scopeOfEvent(bad, { projectRoot: ROOT }); invariant(r); assert.equal(r.scope, 'UNVERIFIABLE');
  }
  const noRoot = scopeOfEvent(ev('Read', { file_path: A }), {}); invariant(noRoot); assert.equal(noRoot.scope, 'UNVERIFIABLE');
  const throwing = scopeOfEvent(ev('Read', { file_path: A }), { projectRoot: ROOT, fs: { realpath() { throw new Error('boom'); }, lstat() { throw new Error('boom'); } } });
  invariant(throwing); assert.equal(throwing.scope, 'UNVERIFIABLE');
});

test('boundary failures (hook error, timeout, invalid output, missing/unreadable authority record) all BLOCK', () => {
  for (const kind of ['hook_error', 'timeout', 'invalid_output', 'missing_authority_record', 'unreadable_authority_record', 'something-new', undefined, null, 5, {}]) {
    const r = failureDisposition(kind); assert.equal(r.disposition, 'BLOCK'); assert.equal(r.allow, false); assert.equal(r.authority, 'NONE');
  }
  assert.equal(failureDisposition('not-a-kind').reason, 'UNKNOWN_FAILURE_KIND');
});

test('differential vs scripts/guard.mjs checkReadPath: this module is never more permissive for an existing file', { skip: NOT_WIN }, () => {
  const paths = [A, join(ROOT, 'real', 'b.txt'), join(ROOT, '.env'), join(OUT, 's.txt'), join(EVIL, 'e.txt'), join(ROOT, 'in'), join(ROOT, 'in', 'missing.txt'), ROOT + '\\in\\..\\in\\a.txt', A + ':s', '\\\\h\\s\\x', 'in\\a.txt',
    ...(junctionOut ? [join(ROOT, 'jout', 's.txt')] : []), ...(junctionIn ? [join(ROOT, 'jin', 'b.txt')] : []), ...(junctionInto ? [join(OUT, 'jinto', 'in', 'a.txt')] : []),
    ...(fileLinkOk ? [join(ROOT, 'flink.txt')] : []), ...(hardOk ? [join(ROOT, 'hl.txt')] : [])];
  let compared = 0;
  for (const p of paths) {
    const g = checkReadPath(p, ROOT); const m = classifyPath(p, ROOT); compared++;
    if (g.ok) { assert.equal(m.scope, 'INSIDE_VERIFIED', `guard accepts ${p} but scope says ${m.scope}/${m.code}`); assert.equal(m.entry, 'file'); }
    if (m.scope === 'INSIDE_VERIFIED' && m.entry === 'file' && !g.ok) assert.ok(m.sensitive_name, `scope says inside-verified but guard refuses ${p} (${g.code}) without a sensitive-name flag`);
  }
  assert.ok(compared >= 9);
});

test('invariant under deterministic fuzz: never throws, never allows, always a known scope', { skip: NOT_WIN }, () => {
  let s = 0x9e3779b9; const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const frag = ['..', '.', 'C:\\', '\\\\?\\', 'NUL', 'a:b', '\u202e', '~1', '*', ' ', 'in', 'a.txt', '\\', '/', '', ROOT, OUT, EVIL, A, 'x'.repeat(300), '\u0000', '％', 'ＣＯＮ'];
  const tools = ['Read', 'Write', 'Edit', 'NotebookEdit', 'Glob', 'Grep', 'Bash', 'PowerShell', 'WebFetch', 'mcp__a__b', 'Agent', 'Zzz', 5, null];
  const val = () => (rnd() < 0.1 ? pick([null, 5, true, [], {}, undefined]) : Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pick(frag)).join(rnd() < 0.5 ? '\\' : ''));
  for (let i = 0; i < 3000; i++) {
    const e = { tool_name: pick(tools), cwd: val(), tool_input: { file_path: val(), notebook_path: val(), path: val(), pattern: val(), glob: val(), command: val() } };
    for (const k of ['file_path', 'notebook_path', 'path', 'pattern', 'glob', 'command']) if (rnd() < 0.4) delete e.tool_input[k];
    const r = scopeOfEvent(e, { projectRoot: ROOT }); invariant(r);
    if (r.scope === 'INSIDE_VERIFIED') for (const t of r.targets) assert.equal(t.scope, 'INSIDE_VERIFIED');
  }
});

test('static independence: no process, network, write or decision-emitting capability in the module source', () => {
  const src = readFileSync(new URL('../scripts/guard-scope.mjs', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['node:fs']);
  const code = src.replace(/^\s*\/\/.*$/gm, '');
  for (const bad of ['child_process', 'node:net', 'node:http', 'node:https', 'node:dgram', 'worker_threads', 'fetch(', 'process.exit', 'spawn', 'exec(', 'writeFile', 'appendFile', 'mkdirSync', 'rmSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'symlinkSync', 'linkSync', 'chmod', 'copyFile', 'truncate', 'permissionDecision', 'updatedInput', 'behavior', 'hookSpecificOutput'])
    assert.ok(!code.includes(bad), `forbidden token in module: ${bad}`);
  const allows = code.match(/\ballow\b/gi) ?? []; const allowFalse = code.match(/\ballow:\s*false\b/g) ?? [];
  assert.equal(allows.length, allowFalse.length, 'the word "allow" may only appear as allow: false');
  assert.ok(allowFalse.length >= 2);
});

test('the module did not touch the repository: fixtures live only in os.tmpdir', () => {
  assert.ok(U.startsWith(T + sep));
  assert.ok(existsSync(A));
});
