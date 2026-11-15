// LIFE-010 evidence tool (not deployed): shows that scope-guard.test.mjs detects regressions. For each mutation it copies
// the staged hook (with one textual change), the unchanged classifier, the manifest script and the test file into a fresh
// os.tmpdir() folder, runs the tests there and prints pass/fail counts. A mutation that leaves "fail 0" is a test gap.
// Usage: node docs/tasks/LIFE-010-proposed/mutation-check.mjs
import { mkdirSync, mkdtempSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const P = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(P, 'dot-claude', 'hooks', 'scope-guard.mjs'), 'utf8');
const M = [
  ['M1 no line-continuation join', 'const texts = [cmd, joinContinuations(cmd)];', 'const texts = [cmd];'],
  ['M2 names rule = .claude only (old ASK)', /^const PROTECTED_NAMES = .*$/m, 'const PROTECTED_NAMES = /\\.claude/i;'],
  ['M3 npm test/run as in base', "if (t[0] === 'npm') return NPM_EXACT.includes(t.join(' '));", "if (t[0] === 'npm' && t[1] === 'test') return true; if (t[0] === 'npm' && t[1] === 'run') return /^(test|lint|check|build)[\\w:-]*$/.test(t[2] ?? '');"],
  ['M4 no MCP deny (base)', /^    if \(tool\.toLowerCase\(\)\.startsWith\('mcp__'\)\).*$/m, ''],
  ['M5 no validateScope E1 check', /^    if \(hits\(PROTECTED, l0\) \|\|.*$/m, ''],
  ['M6 reviewer may run tests', "'release-evidence-reviewer': isGitRead,", "'release-evidence-reviewer': (t) => isTestCmd(t) || isGitRead(t),"],
  ['M7 node --test any path', 'return t.length > 2 && t.slice(2).every(isTestFile);', 'return true;'],
  ['M8 guard-scope not PROTECTED', ", 'scripts/guard-scope.mjs'];", '];'],
  ['M9 log only first 2 words (base)', "clip(o, 'cmd', ti.command);", "if (typeof ti.command === 'string') o.cmd = ti.command.split(' ').slice(0, 2).join(' ');"],
  ['M10 no log rotation', "try { if (statSync(file).size >= max) renameSync(file, `${file}.1`); } catch { /* missing file or rotation race: just append */ }", ''],
  ['M11 no --check (git diff)', "'--no-color', '--check']", "'--no-color']"],
  ['M11b no --eol (git ls-files)', "'--exclude-standard', '--eol']", "'--exclude-standard']"],
  // ---- round 2 (security findings F1-F9)
  ['M12 F1 main-module path check restored (round 1)', "if (process.env.SCOPE_GUARD_NO_MAIN !== '1') main()", "const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase();\nif (process.env.SCOPE_GUARD_NO_MAIN !== '1' && isMain) main()"],
  ['M13 F2 .git names = .git/config only (round 1)', String.raw`\.git(?![\w-])`, String.raw`\.git[\\\/]+config`],
  ['M14 F3 no any-depth name check in fileDecision', /^  if \(rel\.split\('\/'\)\.some\(\(seg\) => OWNER_BASENAME\.test\(seg\)\)\).*$/m, ''],
  ['M15 F3 no any-depth name check in validateScope', ' || OWNER_BASENAME.test(seg))) return bad', ')) return bad'],
  ['M15b F3 PROTECTED_NAMES without claude.local.md/.mcp.json', String.raw`claude\.md|claude\.local\.md|\.mcp\.json|`, String.raw`claude\.md|`],
  ['M16 F4 no restore/reset/pull/fetch/clone/revert ask', '|config|restore|reset|pull|fetch|clone|revert|', '|config|'],
  ['M17 F5 no --config-env/GIT_CONFIG*/GIT_EXTERNAL_DIFF ask', String.raw`|--config-env|\bGIT_CONFIG|\bGIT_EXTERNAL_DIFF\b/i`, '/i'],
  ['M18a F6 npm run verify not asked', 'run(-script)?\\s+(build|verify)\\b', 'run(-script)?\\s+(build)\\b'],
  ['M18b F6 no global npm ask', /^  \[\/\\bnpm\(\\\.cmd\|\\\.ps1\|\\\.exe\)\?\\b\[\^\\n\]\*\\s\(-g\|--global\).*$/m, ''],
  ['M18c F6/N2 package managers = npm only (no pnpm/yarn/bun/bunx/npx)', String.raw`(npm|pnpm|yarn|bun|bunx|npx)(\.cmd`, String.raw`(npm)(\.cmd`],
  ['M18d F6 no npm init/create', '|publish|init|create|', '|publish|'],
  ['M19 F8 exit without waiting for the write', 'stream.write(text, () => exit(code));', 'stream.write(text); exit(code);'],
  ['M20 F9 trailing slash not normalized', "const l0 = l.replace(/\\/+$/, '');", 'const l0 = l;'],
  // Target the regex itself: the first plain 'scope[-_]guard' in the file is inside a comment.
  ['M21 F1 SCOPE_GUARD_* not asked', 'task-scope|scope[-_]guard|guard-scope', 'task-scope|scope-guard|guard-scope'],
  // ---- round 3 (N1-N5, branch exemption)
  ['M23 N1 no gh rule', String.raw`  [/\bgh(\.exe)?\s/i, 'GitHub CLI (gh)'],`, ''],
  ['M24 N2 no package-verb rule', "  [pkgInstall, 'package manager install/ci/exec/dlx/init/create/version/pkg'],", ''],
  ['M24b N2 verb only right after the manager (round-2 shape)', 'const pkgInstall = (x) => PKG_MGR.test(x) && PKG_VERB.test(x);', String.raw`const pkgInstall = (x) => /\b(npm|pnpm|yarn|bun)(\.cmd|\.ps1|\.exe)?(\s+-\S+)*\s+(ci|install|i|add|uninstall|remove|rm|up|unlink|dlx|version|pkg|clean-install|ic)\b/i.test(x);`],
  ['M24c N2 no clean-install/ic/cit', 'ci|clean-install|ic|cit|install-ci-test|install', 'ci|install'],
  ['M24d N2 no version/pkg', '|init|create|version|pkg)', '|init|create)'],
  ['M24e N2 no dlx', '|exec|x|dlx|', '|exec|x|'],
  ['M24f N2 no "up" alias', '|update|up|upgrade|', '|update|upgrade|'],
  ['M24g N2 no "unlink"', '|un|unlink|remove|', '|un|remove|'],
  ['M24h N2 no "remove"', '|unlink|remove|rm|', '|unlink|rm|'],
  ['M24i N2 no "rm"', '|remove|rm|r|', '|remove|r|'],
  ['M24j N2 no "r"', '|rm|r|link|', '|rm|link|'],
  ['M25 N3 no update-ref/gc/submodule/notes/init/replace/reflog', '|revert|update-ref|gc|submodule|notes|init|replace|reflog)', '|revert)'],
  ['M26 N4 no GIT_*/EDITOR assignment rule', String.raw`  [/\bGIT_[A-Z0-9_]+\s*=|\$env:GIT_[A-Z0-9_]+|\bEDITOR\s*=|\$env:EDITOR\b/i, 'GIT_* or EDITOR assignment (git runs these as commands)'],`, ''],
  ['M27 N5 .git pattern of round 2', String.raw`\.git(?![\w-])`, String.raw`\.git(?=[\\\/\s"';|&)]|$)`],
  ['M28 Ext no branch exemption', '  if (ASK_EXEMPT.includes(cmd)) return pass();', ''],
  ['M29 Ext exemption not exact (trimmed)', 'if (ASK_EXEMPT.includes(cmd))', 'if (ASK_EXEMPT.includes(cmd.trim()))'],
  ['M31 R3-1 verb delimiters back to whitespace only', String.raw`(^|[\s;&|("'` + '`' + String.raw`\\^{,])(ci|`, String.raw`(^|\s)(ci|`],
  ['M31b R3-1 verb end back to whitespace only', String.raw`(?=[\s;&|)<>"'` + '`' + String.raw`,}-]|$)/i;`, String.raw`(?=\s|$)/i;`],
  ['M31c R3-1b no "\\" before the verb', String.raw`("'` + '`' + String.raw`\\^{,])(ci|`, String.raw`("'` + '`' + String.raw`^{,])(ci|`],
  ['M31e R3-1b no "^" before the verb', String.raw`("'` + '`' + String.raw`\\^{,])(ci|`, String.raw`("'` + '`' + String.raw`\\{,])(ci|`],
  ['M31f R3-1b no "{" before the verb', String.raw`("'` + '`' + String.raw`\\^{,])(ci|`, String.raw`("'` + '`' + String.raw`\\^,])(ci|`],
  ['M31g R3-1b no "," before the verb', String.raw`("'` + '`' + String.raw`\\^{,])(ci|`, String.raw`("'` + '`' + String.raw`\\^{])(ci|`],
  ['M31d R3-1b no , } after the verb', String.raw`"'` + '`' + String.raw`,}-]|$)/i;`, String.raw`"'` + '`' + String.raw`-]|$)/i;`],
  ['M30 N2 npx/bunx rule removed', "  [/\\b(npx|bunx)\\b/i, 'npx/bunx'],", ''],
  ['M22 F7 old log comment', '// F7: the log can hold secrets typed on a command line. "Owner-only" holds for WRITES only: the log lives under .claude/', '// Command text can contain secrets typed on the command line; the log stays under .claude/ (git-excluded, Owner-only).'],
];
// Round 2 fix: the copy must contain EVERY file the tests read (settings.json was missing, so one settings test failed under
// every mutation and made every mutation look "detected"). M0 runs the unmutated hook in the same copy and must show fail 0;
// if it does not, the fixture is broken and the run is reported INVALID. Failing test names are printed per mutation.
function runCopy(hookText) {
  const S = mkdtempSync(join(tmpdir(), 'life010-mut-'));
  try {
    mkdirSync(join(S, 'dot-claude', 'hooks'), { recursive: true }); mkdirSync(join(S, 'scripts'));
    copyFileSync(join(P, 'scripts', 'guard-scope.mjs'), join(S, 'scripts', 'guard-scope.mjs'));
    copyFileSync(join(P, 'dot-claude', 'settings.json'), join(S, 'dot-claude', 'settings.json'));
    for (const f of ['office-manifest.mjs', 'scope-guard.test.mjs']) copyFileSync(join(P, f), join(S, f));
    writeFileSync(join(S, 'dot-claude', 'hooks', 'scope-guard.mjs'), hookText);
    const env = { ...process.env, SCOPE_GUARD_NO_LOG: '1' }; delete env.SCOPE_GUARD_NO_MAIN;
    const r = spawnSync(process.execPath, ['--test', join(S, 'scope-guard.test.mjs')], { encoding: 'utf8', env });
    const n = (k) => (r.stdout.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')) ?? [])[1] ?? '?';
    const end = r.stdout.indexOf('✖ failing tests:');
    const names = end < 0 ? [] : [...new Set(r.stdout.slice(end).split('\n').filter((l) => l.startsWith('✖ ') && !l.startsWith('✖ failing tests')).map((l) => l.slice(2).replace(/ \([0-9.]+ms\)$/, '')))];
    const allNames = r.stdout.split('\n').filter((l) => /^[✔✖] /.test(l)).map((l) => l.slice(2).replace(/ \([0-9.]+ms\)$/, ''));
    return { pass: n('pass'), fail: n('fail'), status: r.status, names, allNames };
  } finally { rmSync(S, { recursive: true, force: true }); }
}
// Round 3: generated mutations, one per Director ASK rule (delete its line) and one per PROTECTED_NAMES alternative
// (drop it). They feed the "never killed" report below: an ASK test that no mutation turns red only repeats another test.
{
  const lines = src.split(/\r?\n/);
  const a = lines.findIndex((l) => l.startsWith('const ASK = ['));
  for (let i = a + 1; i < lines.length && !lines[i].startsWith('];'); i++) {
    if (lines[i].startsWith('  [')) M.push([`MA rule removed: ${(lines[i].match(/'([^']*)'\],?\s*$/) ?? [, lines[i].slice(2, 40)])[1]}`, lines[i], '']);
  }
  const pn = src.match(/^const PROTECTED_NAMES = \/(.*)\/i;/m)[1];
  const alts = pn.split('|');
  for (let k = 0; k < alts.length; k++) {
    M.push([`MN name removed: ${alts[k]}`, `const PROTECTED_NAMES = /${pn}/i;`, `const PROTECTED_NAMES = /${alts.filter((_, j) => j !== k).join('|')}/i;`]);
  }
}
const killed = new Set();
const base = runCopy(src);
console.log(`M0 unmutated baseline => pass ${base.pass} fail ${base.fail} (exit ${base.status})`);
if (base.fail !== '0') { console.log('INVALID: the baseline copy fails; mutation results would be meaningless'); for (const x of base.names) console.log(`   - ${x}`); process.exit(2); }
let gaps = 0;
for (const [name, from, to] of M) {
  const mut = src.replace(from, to);
  if (mut === src) { console.log(`${name} => MUTATION NOT APPLIED`); gaps++; continue; }
  const r = runCopy(mut);
  if (r.fail === '0') gaps++;
  console.log(`${name} => pass ${r.pass} fail ${r.fail} (exit ${r.status})`);
  for (const x of r.names) { console.log(`   - ${x}`); killed.add(x); }
}
console.log(gaps ? `GAPS ${gaps}` : `ALL ${M.length} MUTATIONS DETECTED`);
// Every Director ASK test must be turned red by at least one mutation; otherwise it has no evidence value of its own.
const allNames = [...new Set(base.allNames)];
const askTests = allNames.filter((n) => / ASK /.test(n) && /Director/.test(n));
const never = askTests.filter((n) => !killed.has(n));
console.log(`ASK tests: ${askTests.length}, never killed by any mutation: ${never.length}`);
for (const x of never) console.log(`   ~ ${x}`);
if (never.length) gaps++;
process.exitCode = gaps ? 1 : 0;
