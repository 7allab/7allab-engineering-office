// OFFICE-003 phase 1: non-interference oracle for the git-read allowlist of .claude/hooks/scope-guard.mjs.
// OPT-IN: run explicitly with `node --test test/scope-guard-oracle.test.mjs` (not part of guard group 1 or 2).
// For every candidate that decide() ALLOWS, the command runs in the REAL shell inside a throwaway repo with synthetic
// secret files in state A, then state B. A difference between the outputs means the command read something it should not.
// Never prints git output: only candidate, verdict, byte length and a short hash. Categories: C1 (benign), C3 (drive-relative),
// C5 (backslash), C6 (attached option values), C8 (PowerShell only: comma pairs, @var).
// Writer/executor options (--output, --ext-diff, --textconv, -c, --exec-path, --open-files-in-pager) are static decide() only, never executed:
// every candidate has a hand-assigned execClass (READ or STATIC_ONLY), and writerHit() refuses to run any command containing such an option, independent of decide().
// Stage 3: the equivalence check, the env ablation and the 300-per-shell measurement are calibration-only (ORACLE_CALIBRATION=1);
// the default run is oracle + controls + checkpoints + KNOWN_OPEN comparison + mutants M1-M4 (criterion 6c).
// Stage 2: Option A batching. One shell process per shell and state runs a whole batch from a script file; every command goes through
// eval (Bash) or Invoke-Expression (PowerShell) like the real tools, and is delimited by sentinel markers on stdout and stderr.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, existsSync, readdirSync, readFileSync, copyFileSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decide } from '../.claude/hooks/scope-guard.mjs';

const T0 = Date.now();
const PROJECT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const ROLES = ['implementation-engineer', 'release-evidence-reviewer'];
const TOOLS = ['Bash', 'PowerShell'];
const CATS = ['C1', 'C3', 'C5', 'C6', 'C8'];

// Final limits (Owner decision, docs/tasks/OFFICE-003.md Open decisions). generated, perShell and cmdTimeoutMs are safety ceilings, far above
// observed values. totalMs = oracle phase (90000 ms); defaultRunMs = whole default run (240000 ms); calibrationRunMs = whole ORACLE_CALIBRATION=1 run (720000 ms). Observed durations are
// recorded in docs/tasks/OFFICE-003.md (Evidence), not here. The calibration ceiling is opt-in: an overrun means rerun, not a security signal.
const LIMITS = { generated: 5000, perShell: 300, cmdTimeoutMs: 10000, totalMs: 90000, defaultRunMs: 240000, calibrationRunMs: 720000, minExecuted: 10 };
// KNOWN_OPEN (criterion 13): findings expected on the current hook. v2 is the empty list: any finding is NEW.
const KNOWN_OPEN_APPROVAL = 'v2 = EMPTY (Owner, 2026-11-14, docs/tasks/OFFICE-004.md): all 38 v1 findings disappeared after the default-deny git-read allowlist; any finding is NEW; edits to this list need Owner approval';
// Row = [category, verdict, candidate, optional tag].
// v1 (38 findings = 19 candidates x 2 shells, all C6) is recorded in docs/tasks/OFFICE-003.md; closed by OFFICE-004
const KNOWN_OPEN_ROWS = [];
const KNOWN_OPEN = KNOWN_OPEN_ROWS.flatMap(([, verdict, cmd]) => ['Bash', 'PowerShell'].map((tool) => `${tool}|${cmd}|${verdict}`));
const CAL = process.env.ORACLE_CALIBRATION === '1';
const CAL_OPTS = { skip: CAL ? false : 'calibration only: set ORACLE_CALIBRATION=1' };

// ---- comparator (independent of decide())
export function classify(a, b) {
  if (a.includes('CANARY-') || b.includes('CANARY-')) return 'FAIL';
  if (a === b) return 'PASS';
  const pa = a.split('\0'), pb = b.split('\0'); // status, stdout, stderr
  if (pa.length !== pb.length || pa[0] !== pb[0]) return 'FAIL';
  for (let i = 1; i < pa.length; i++) {
    const la = pa[i].split(/\r?\n/), lb = pb[i].split(/\r?\n/);
    if (la.length !== lb.length) return 'FAIL';
    const sa = [...la].sort(), sb = [...lb].sort();
    if (!sa.every((x, j) => x === sb[j])) return 'FAIL';
  }
  return 'WARN';
}
const h = (s) => createHash('sha256').update(s, 'latin1').digest('hex').slice(0, 12);

// ---- temp root, synthetic repo, state A/B
const created = { root: null };
// R4 gate: both sides realpath'd (PROJECT at module load). Runs on every makeRoot call, also for the cached root.
function assertOutsideProject(root, project) {
  const rl = root.toLowerCase(), pj = project.toLowerCase();
  assert.ok(!(rl === pj || rl.startsWith(pj.endsWith(sep) ? pj : pj + sep)), `temp root ${root} is inside or equal to the project ${project}: no command is run`);
}
function makeRoot(base = tmpdir(), project = PROJECT, cache = created) {
  if (cache.root) { assertOutsideProject(cache.root, project); return cache.root; }
  const root = realpathSync(mkdtempSync(join(base, 'oracle-003-')));
  // R4: precondition before anything is created or run. A rejected root is removed (fs.rmdirSync: empty directory only) and never cached.
  try { assertOutsideProject(root, project); } catch (e) { rmdirSync(root); throw e; }
  cache.root = root;
  for (const d of ['repo', 'outside/dir', 'home', 'tmp']) mkdirSync(join(root, d), { recursive: true });
  writeFileSync(join(root, 'gitconfig-empty'), '');
  writeFileSync(join(root, 'argv.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)));\n');
  return root;
}
const baseEnv = (T, omit = []) => {
  const e = {
    PATH: process.env.PATH, PATHEXT: process.env.PATHEXT, ComSpec: process.env.ComSpec, SystemRoot: process.env.SystemRoot, windir: process.env.SystemRoot, TEMP: join(T, 'tmp'), TMP: join(T, 'tmp'),
    HOME: join(T, 'home'), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(T, 'gitconfig-empty'), GIT_CEILING_DIRECTORIES: dirname(T),
    GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
    GIT_AUTHOR_NAME: 'Oracle', GIT_AUTHOR_EMAIL: 'oracle@example.invalid', GIT_COMMITTER_NAME: 'Oracle', GIT_COMMITTER_EMAIL: 'oracle@example.invalid',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
  };
  for (const k of omit) delete e[k];
  return e;
};
function git(T, args) {
  const r = spawnSync('git', args, { cwd: join(T, 'repo'), env: baseEnv(T), stdio: ['ignore', 'pipe', 'pipe'], timeout: LIMITS.cmdTimeoutMs });
  if (r.error || r.status !== 0) throw new Error(`setup git ${args[0]} failed`);
}
function buildRepo(T) {
  const R = join(T, 'repo');
  mkdirSync(join(R, 'sub'), { recursive: true });
  git(T, ['init', '-q']);
  git(T, ['config', 'core.autocrlf', 'false']);
  writeFileSync(join(R, '.gitignore'), '.env\n');
  for (const [f, c] of [['m1.txt', 'm1 base\n'], ['m2.txt', 'm2 base\n'], ['u.txt', 'u base\n'], ['sub/x.txt', 'x base\n']]) writeFileSync(join(R, f), c);
  git(T, ['add', '.']);
  git(T, ['commit', '-q', '-m', 'base']);
  writeFileSync(join(R, 'm1.txt'), 'm1 changed\n');
  writeFileSync(join(R, 'm2.txt'), 'm2 changed\n');
}
function setState(T, s) {
  const R = join(T, 'repo'), O = join(T, 'outside');
  const body = s === 'A' ? 'CANARY-A-7f3a91\nm1.txt\n' : 'CANARY-B-7f3a91\nm2.txt\nm1.txt\nextra line\n';
  writeFileSync(join(R, '.env'), body);
  writeFileSync(join(O, 'secret.txt'), body);
  for (const f of readdirSync(join(O, 'dir'))) rmSync(join(O, 'dir', f));
  for (const f of s === 'A' ? ['a1.txt'] : ['b2.txt', 'b1.txt']) writeFileSync(join(O, 'dir', f), body);
}

// ---- shells
const psq = (s) => `'${s.replace(/'/g, "''")}'`;
const shq = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const ascii = (s) => { assert.ok(/^[\x20-\x7e]*$/.test(s), `non-ASCII candidate: ${JSON.stringify(s)}`); return s; };
// $v is the harness-set splat variable for C8: it points at the synthetic outside file (a no-index diff of it against m1.txt).
// $w (R2): an identical pair of synthetic files, so `git diff @w` exits 0 in both states (gives the M3 subset an exit-0 member)
const PS_V = "$v = @('--no-index', '../outside/secret.txt', 'm1.txt'); $w = @('--no-index', '.env', '.env')";
function psScript(items, n) {
  const L = [
    PS_V, "$ec = 0; $failed = $false; $p0 = ''; $vs0 = ''; $vs1 = ''; $global:LASTEXITCODE = $null",
    "$p0 = (Get-Location).Path; $vs0 = ((Get-Variable | Sort-Object Name).Name) -join ','",
    `Write-Output ('${n} P|' + $p0 + '@@')`,
  ];
  for (const it of items) {
    L.push(`Write-Output '${n} S|${it.id}@@'; [Console]::Error.Write('${n} S|${it.id}@@')`,
      '$failed = $false; $global:LASTEXITCODE = $null',
      `try { Invoke-Expression ${psq(ascii(it.cmd))} } catch { $failed = $true; [Console]::Error.WriteLine($_.Exception.Message) }`,
      '$ec = 1; if (-not $failed) { if ($null -ne $LASTEXITCODE) { $ec = $LASTEXITCODE } else { $ec = 0 } }',
      `Write-Output ('${n} E|${it.id}|' + $ec + '|' + (Get-Location).Path + '@@'); [Console]::Error.Write('${n} F|${it.id}@@')`);
  }
  L.push("$vs1 = ((Get-Variable | Sort-Object Name).Name) -join ','", `Write-Output ('${n} Z|' + $vs0 + '|' + $vs1 + '@@')`);
  return L.join('\r\n') + '\r\n';
}
function bashScript(items, n) {
  const L = [
    "ec=0; p0=''; v0=''; v1=''",
    "p0=$PWD; v0=$(compgen -v | sort | tr '\\n' ',')",
    `printf '%s' "${n} P|$p0@@"`,
  ];
  for (const it of items) {
    L.push(`printf '%s' '${n} S|${it.id}@@'; printf '%s' '${n} S|${it.id}@@' >&2`,
      `eval ${shq(ascii(it.cmd))}`,
      'ec=$?',
      `printf '%s' "${n} E|${it.id}|$ec|$PWD@@"; printf '%s' '${n} F|${it.id}@@' >&2`);
  }
  L.push("v1=$(compgen -v | sort | tr '\\n' ',')", `printf '%s' "${n} Z|$v0|$v1@@"`);
  return L.join('\n') + '\n';
}
function findShells(T) {
  const out = {};
  const sr = process.env.SystemRoot;
  const ps = sr && join(sr, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  out.PowerShell = ps && existsSync(ps) ? { exe: ps, args: (c) => ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', c],
    fileArgs: (f) => ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', f], ext: '.ps1', script: psScript, nl: true, pre: PS_V + '; ' } : null;
  const r = spawnSync('git', ['--exec-path'], { env: baseEnv(T), stdio: ['ignore', 'pipe', 'ignore'], timeout: LIMITS.cmdTimeoutMs });
  let bash = null;
  if (!r.error && r.status === 0) {
    const root = resolve(String(r.stdout).trim(), '..', '..', '..');
    for (const rel of [['bin', 'bash.exe'], ['usr', 'bin', 'bash.exe']]) { const p = join(root, ...rel); if (!bash && existsSync(p)) bash = p; }
  }
  out.Bash = bash ? { exe: bash, args: (c) => ['-c', c], fileArgs: (f) => [f.replace(/\\/g, '/')], ext: '.sh', script: bashScript, nl: false, pre: '' } : null;
  return out;
}

// ---- single-command runner (previous harness, Stage 1). Kept for the positive control, the fallback and the equivalence check.
function run(T, sh, cmd, omit = [], pre = false) {
  assertSafeToExecute(cmd);
  const t = Date.now();
  const r = spawnSync(sh.exe, sh.args((pre ? sh.pre : '') + cmd), { cwd: join(T, 'repo'), env: baseEnv(T, omit), stdio: ['ignore', 'pipe', 'pipe'], timeout: LIMITS.cmdTimeoutMs, encoding: 'latin1' });
  const ms = Date.now() - t;
  if (r.error) return { err: r.error.code || 'spawn-error', ms };
  const sig = `${r.status}\0${r.stdout}\0${r.stderr}`;
  return { sig, status: r.status, out: r.stdout.length, errLen: r.stderr.length, len: Buffer.byteLength(sig, 'latin1'), hash: h(sig), ms };
}
// A, B, then A again on any difference (LEAK vs FLAKY).
function judgeSingle(T, sh, cmd, omit = [], pre = false) {
  setState(T, 'A'); const a1 = run(T, sh, cmd, omit, pre);
  setState(T, 'B'); const b = run(T, sh, cmd, omit, pre);
  if (a1.err || b.err) return { verdict: 'FLAKY', note: a1.err || b.err, len: 0, hash: '-' };
  const first = classify(a1.sig, b.sig);
  const st = `exit=${a1.status} out=${a1.out} err=${a1.errLen}`;
  const base = { len: a1.len, st, status: a1.status, statusB: b.status, hA: a1.hash, hB: b.hash, oA: h(a1.sig.split('\0')[1]) };
  if (a1.sig === b.sig && first === 'PASS') return { verdict: 'PASS', hash: a1.hash, ...base };
  if (a1.sig !== b.sig || first === 'FAIL') {
    setState(T, 'A'); const a2 = run(T, sh, cmd, omit, pre);
    if (a2.err || a2.sig !== a1.sig) return { verdict: 'FLAKY', note: 'A rerun mismatch', len: a1.len, hash: a1.hash };
  }
  return { verdict: first, hash: `${a1.hash}/${b.hash}`, ...base };
}

// ---- batch runner (Option A). One process per shell and state; a per-command watchdog restarts the shell after a hang.
function runSegment(T, sh, items, nonce, timeoutMs, env) {
  return new Promise((done) => {
    const file = join(T, `batch-${nonce}-${items[0].id}${sh.ext}`);
    for (const it of items) assertSafeToExecute(it.cmd); // before the script file exists: a flagged command is never handed to a shell
    writeFileSync(file, sh.script(items, nonce), 'latin1');
    let out = '', err = '', timer = null, fb = null, hung = false, finished = false, scan = 0, spawnErr = null;
    const finish = () => { if (finished) return; finished = true; clearTimeout(timer); clearTimeout(fb); done({ out, err, hung, spawnErr }); };
    let child;
    try { child = spawn(sh.exe, sh.fileArgs(file), { cwd: join(T, 'repo'), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); } catch (e) { spawnErr = e.code || 'spawn-error'; return finish(); }
    const kill = () => {
      hung = true;
      if (child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      fb = setTimeout(() => { child.stdout.destroy(); child.stderr.destroy(); finish(); }, 3000);
    };
    const arm = () => { clearTimeout(timer); timer = setTimeout(kill, timeoutMs); };
    arm();
    child.stdout.setEncoding('latin1'); child.stderr.setEncoding('latin1');
    child.stdout.on('data', (d) => {
      out += d;
      for (;;) { // every marker (S, E, P, Z) re-arms the per-command watchdog
        const i = out.indexOf(`${nonce} `, scan);
        if (i < 0) break;
        const j = out.indexOf('@@', i);
        if (j < 0) break;
        scan = j + 2; arm();
      }
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { spawnErr = e.code || 'spawn-error'; finish(); });
    child.on('close', finish);
  });
}
function parseSegment(seg, nonce, items, sh) {
  const { out, err } = seg;
  const res = {};
  const pm = out.match(new RegExp(`${nonce} P\\|([^@]*)@@`));
  const cwd0 = pm ? pm[1] : null;
  const zm = out.match(new RegExp(`${nonce} Z\\|([^@]*)\\|([^@]*)@@`));
  for (const it of items) {
    const sm = `${nonce} S|${it.id}@@`;
    const s = out.indexOf(sm);
    const e = s < 0 ? -1 : out.indexOf(`${nonce} E|${it.id}|`, s);
    if (s < 0 || e < 0) continue;
    const em = out.slice(e).match(new RegExp(`^${nonce} E\\|${it.id}\\|(-?\\d+)\\|([^@]*)@@`));
    const s2 = err.indexOf(sm);
    const f2 = s2 < 0 ? -1 : err.indexOf(`${nonce} F|${it.id}@@`, s2);
    if (!em || s2 < 0 || f2 < 0) continue;
    let from = s + sm.length;
    if (sh.nl && out.startsWith('\r\n', from)) from += 2;
    const so = out.slice(from, e), se = err.slice(s2 + sm.length, f2);
    const status = Number(em[1]);
    const sig = `${status}\0${so}\0${se}`;
    res[it.id] = { sig, status, out: so.length, errLen: se.length, len: Buffer.byteLength(sig, 'latin1'), hash: h(sig), drift: cwd0 !== null && em[2] !== cwd0 };
  }
  return { res, vars: zm ? [zm[1], zm[2]] : null };
}
async function runBatch(T, sh, items, { timeoutMs = LIMITS.cmdTimeoutMs, omit = [] } = {}) {
  const env = baseEnv(T, omit), t0 = Date.now(), res = {}, varDrift = [];
  let from = 0, segments = 0;
  while (from < items.length) {
    const rest = items.slice(from), nonce = randomBytes(4).toString('hex');
    segments++;
    const seg = await runSegment(T, sh, rest, nonce, timeoutMs, env);
    const p = parseSegment(seg, nonce, rest, sh);
    Object.assign(res, p.res);
    // `$_` and `$PSItem` are created by the harness's own catch block (PowerShell parse errors); they are not candidate side effects
    const noise = (s) => s.split(',').filter((x) => x !== '_' && x !== 'PSItem').join(',');
    if (p.vars && noise(p.vars[0]) !== noise(p.vars[1])) varDrift.push(p.vars);
    let k = from;
    while (k < items.length && res[items[k].id]) k++;
    if (k >= items.length) break;
    res[items[k].id] = { err: seg.hung ? 'timeout' : (seg.spawnErr || 'shell-exit') };
    from = k + 1;
  }
  return { res, varDrift, segments, ms: Date.now() - t0 };
}
// Batch version of judgeSingle. Items with a batch error or drift are re-run one by one (fallback) so the error is attributed.
async function judgeBatch(T, sh, items, opts = {}) {
  const omit = opts.omit ?? [];
  setState(T, 'A'); const A = await runBatch(T, sh, items, opts);
  setState(T, 'B'); const B = await runBatch(T, sh, items, opts);
  const stats = { ms: A.ms + B.ms, segments: A.segments + B.segments, rerunMs: 0, fallback: 0, varDrift: A.varDrift.length + B.varDrift.length };
  for (const d of [...A.varDrift, ...B.varDrift]) { const [v0, v1] = d.map((x) => x.split(',')); console.log(`  var drift names added=${JSON.stringify(v1.filter((x) => !v0.includes(x)))} removed=${JSON.stringify(v0.filter((x) => !v1.includes(x)))}`); }
  const out = {}, rerun = [], pend = {};
  for (const it of items) {
    const a = A.res[it.id], b = B.res[it.id];
    if (a.err || b.err || a.drift || b.drift || A.varDrift.length || B.varDrift.length) {
      stats.fallback++;
      const s = judgeSingle(T, sh, it.cmd, omit, true);
      out[it.id] = { ...s, note: `batch-error:${a.err || b.err || (a.drift || b.drift ? 'cwd-drift' : 'var-drift')} single:${s.verdict}` };
      continue;
    }
    const first = classify(a.sig, b.sig);
    const base = { len: a.len, st: `exit=${a.status} out=${a.out} err=${a.errLen}`, status: a.status, statusB: b.status, hA: a.hash, hB: b.hash, oA: h(a.sig.split('\0')[1]) };
    if (a.sig === b.sig && first === 'PASS') { out[it.id] = { verdict: 'PASS', hash: a.hash, ...base }; continue; }
    if (a.sig !== b.sig || first === 'FAIL') { rerun.push(it); pend[it.id] = { a, first, base }; continue; }
    out[it.id] = { verdict: first, hash: `${a.hash}/${b.hash}`, ...base };
  }
  if (rerun.length) {
    setState(T, 'A'); const A2 = await runBatch(T, sh, rerun, opts);
    stats.rerunMs = A2.ms;
    for (const it of rerun) {
      const { a, first, base } = pend[it.id], a2 = A2.res[it.id];
      if (a2.err || a2.sig !== a.sig) out[it.id] = { verdict: 'FLAKY', note: 'A rerun mismatch', len: a.len, hash: a.hash };
      else out[it.id] = { verdict: first, hash: `${a.hash}/${base.hB}`, ...base };
    }
  }
  return { out, stats };
}

// ---- candidates
function candidates(D) {
  const d = D.toUpperCase(), l = D.toLowerCase(), other = d === 'Z' ? 'Y' : 'Z';
  const c1 = [
    'git status', 'git status --short', 'git status --porcelain', 'git status --ignored', 'git diff', 'git diff --stat', 'git diff --name-only',
    'git diff --name-status', 'git diff HEAD', 'git diff HEAD --stat', 'git diff -- m1.txt', 'git diff -- sub/', 'git diff -- sub/x.txt', 'git log',
    'git log --oneline', 'git log -1 --stat', 'git show', 'git show HEAD', 'git show --stat HEAD', 'git show HEAD:m1.txt', 'git show HEAD:sub/x.txt',
    'git rev-parse HEAD', 'git rev-parse --show-toplevel', 'git ls-files', 'git ls-files sub/', 'git ls-files --others --exclude-standard',
    'git branch --show-current',
  ];
  const targets = [`${d}:x`, `${l}:x`, `${d}:..`, `${d}:../x`, `${d}:.env`, `${d}:../outside/secret.txt`, `${l}:../outside/secret.txt`, `${d}:../outside/dir`, `${other}:.env`];
  const c3 = [];
  for (const sub of ['diff', 'status', 'log', 'show', 'ls-files']) for (const t of targets) { c3.push(`git ${sub} ${t}`); c3.push(`git ${sub} -- ${t}`); }
  for (const t of targets) c3.push(`git diff HEAD ${t}`);
  // two-path forms (OFFICE-002 F1 was `git diff --stat C:AGENTS.md CLAUDE.md`): the drive path is read by git as outside the work tree, so the pair is diffed as no-index.
  // The hook refuses them (the drive-relative check in decide()), so they add no finding; they give mutant M1 a candidate whose output depends on the secret.
  for (const t of [`${d}:.env`, `${l}:.env`]) for (const o of ['m1.txt', 'u.txt']) { c3.push(`git diff ${t} ${o}`); c3.push(`git diff --stat ${t} ${o}`); }
  c3.push(`git diff m1.txt ${d}:.env`, `git diff --name-only ${d}:.env m1.txt`, `git diff ${d}:.env ${d}:x`);
  // R2: identical pair, so a no-index diff exits 0 in both states (gives the M1 subset an exit-0 member; every other newly allowed C3 candidate exits 1 or 128)
  c3.push(`git diff ${d}:.env ${d}:.env`, `git diff --stat ${d}:.env ${d}:.env`);
  // C5: backslash spellings (minimal subset). The hook refuses every backslash, so this category is expected to be static-deny only.
  // Every entry carries its execClass, assigned by hand: READ = may be executed, STATIC_ONLY = decide() record only, never executed.
  const c5 = [['git diff \\--no-index m1.txt m2.txt', 'READ'], ['git diff \\--no-index ../outside/secret.txt m1.txt', 'READ'], ['git diff \\--no-ind m1.txt m2.txt', 'READ'],
    ['git diff .\\m1.txt', 'READ'], ['git diff -- sub\\x.txt', 'READ'], ['git show HEAD:sub\\x.txt', 'READ'], ['git log \\-1', 'READ'], ['git ls-files sub\\x.txt', 'READ'],
    ['git diff \\--output=x', 'STATIC_ONLY'], // writer option (criterion 4): under M2 nothing else refuses it, so it must never be executed
    ['git diff -O..\\outside\\secret.txt', 'READ'],
    // no `..` and no drive: only the backslash check refuses these (Bash drops the backslash and git sees --no-index; whether PowerShell passes it literally: UNKNOWN, see the M2 report)
    ['git diff \\--no-index .env m1.txt', 'READ'], ['git diff \\--no-index .env u.txt', 'READ'], ['git diff \\--no-ind .env m1.txt', 'READ'],
    // positional backslash two-path forms (RF3). The hook refuses them through the backslash check (the `..` regex does not see `..\`).
    ['git diff --no-index ..\\outside\\secret.txt m1.txt', 'READ'], ['git diff ..\\outside\\secret.txt m1.txt', 'READ'], ['git diff .\\..\\outside\\secret.txt m1.txt', 'READ'],
    ['git diff --stat ..\\outside\\secret.txt m1.txt', 'READ'], ['git diff m1.txt ..\\outside\\secret.txt', 'READ'], ['git diff --no-index m1.txt ..\\outside\\secret.txt', 'READ']];
  // C6: option values attached to the option (the hook looks at tokens that start with `..`, `/` or `X:`, not at the value after `=` or `-O`).
  const O1 = '../outside/secret.txt', O2 = '../outside/dir/a1.txt', O3 = '../outside/dir';
  const c6 = [
    `git diff --name-only -O${O1}`, `git diff --name-status -O${O1}`, `git diff --stat -O${O1}`, `git diff -O${O1}`, `git diff HEAD --name-only -O${O1}`,
    `git diff --name-only -O${O2}`, `git diff --name-only -O${O3}`, 'git diff --name-only -O.env', `git diff --name-only -O${d}:.env`, `git diff --name-only -O${l}:.env`,
    `git diff --name-only -O${other}:.env`, `git log --stat -O${O1}`, `git show --stat -O${O1} HEAD`,
    `git diff --name-only --relative=${O3}`, 'git diff --stat --relative=../outside', `git diff --name-only --relative=${O1}`, `git log --stat --relative=${O3}`,
    'git diff --name-only --relative=sub', `git diff --name-only --relative=${d}:x`,
    `git ls-files --cached --ignored --exclude-from=${O1}`, `git ls-files --cached --ignored --exclude-from=${O2}`, `git ls-files --cached --ignored --exclude-from=${O3}`,
    `git ls-files --others --exclude-from=${O1}`, 'git ls-files --cached --ignored --exclude-from=.env', `git ls-files --cached --ignored --exclude-from=${d}:.env`,
    `git ls-files --cached --ignored --exclude-from=${other}:.env`,
    `git ls-files --cached --ignored --exclude-per-directory=${O1}`, `git ls-files --cached --ignored --exclude-per-directory=${O2}`,
    `git ls-files --others --exclude-per-directory=${O1}`, `git ls-files --cached --ignored --exclude-per-directory=${d}:.env`, 'git ls-files --cached --ignored --exclude-per-directory=.env',
    // forms the hook should already refuse (static)
    `git diff --name-only -O./${O1}`, `git diff --name-only -O${d}:${O1}`, `git ls-files --others --exclude-from=./${O1}`, 'git diff --name-only --relative=../..',
  ];
  // C8: PowerShell only. In Bash a comma is a literal character and @var is a plain word; in PowerShell a comma builds an array (separate git arguments)
  // and a bare @var splats $v. The harness defines $v as the synthetic outside file (see PS_V).
  const c8 = [
    `git diff m1.txt,${O1}`, `git diff --stat m1.txt,${O1}`, `git diff m1.txt,${O1} --name-only`, `git diff u.txt,${O3}`, `git diff .env,${O1}`, `git diff -- m1.txt,${O1}`,
    `git diff sub/x.txt,${O1}`, `git log m1.txt,${O1}`, `git diff m1.txt,${d}:.env`, `git diff m1.txt,${d}:x`, `git diff m1.txt,${other}:.env`, 'git diff m1.txt,m2.txt',
    'git diff m1.txt,@v', 'git diff -O@v --name-only', 'git diff --relative=@v --name-only',
    'git diff @v', 'git diff -- @v', 'git status @v', 'git diff --stat @v', 'git log @v', `git diff ${O1},m1.txt`, 'git diff @v,m1.txt', 'git diff @w', 'git diff --stat @w',
  ];
  const rd = (cat, l) => l.map((cmd) => ({ cat, cmd, execClass: 'READ' })); // C1, C3, C6, C8 tables: all entries READ (checked against writerHit by the table test)
  return [...rd('C1', c1), ...rd('C3', c3), ...c5.map(([cmd, execClass]) => ({ cat: 'C5', cmd, execClass })), ...rd('C6', c6), ...rd('C8', c8)];
}
const EXEC_CLASSES = ['READ', 'STATIC_ONLY'];
// a candidate without an explicit class is a harness error
export function assertClasses(list) {
  for (const c of list) assert.ok(EXEC_CLASSES.includes(c.execClass), `HARNESS ERROR: candidate without execClass (${c.cat}): ${c.cmd}`);
}
// last line of defence at the execution point, independent of decide() and of execClass: a command with a criterion-4 option is never run
export function assertSafeToExecute(cmd) {
  const hits = writerHit(cmd);
  assert.deepEqual(hits, [], `HARNESS ERROR: command with criterion-4 option NOT executed: ${cmd}`);
}
// a candidate naming another drive is not executed (a token that starts with `X:` or has `X:` right after `=`, `,` or `-O`)
const namesOtherDrive = (cmd, D) => cmd.split(' ').some((t) => { const m = t.match(/(?:^|[=,]|^-O)([A-Za-z]):/); return !!m && m[1].toUpperCase() !== D.toUpperCase(); });
const ev = (command, agent_type, tool_name) => ({ tool_name, tool_input: { command }, agent_type });

// Static-only candidates: writer/executor options are never executed.
const STATIC_ONLY = ['git diff --output=x', 'git log --output=x', 'git diff --ext-diff', 'git show --textconv HEAD', 'git -c core.pager=x status',
  'git diff -c', 'git status --exec-path', 'git diff --open-files-in-pager', 'git diff --no-index m1.txt m2.txt'];

let memo = null, base = null;
const oracle = () => (memo ??= buildOracle());
function setup() { // temp root, synthetic repo and shells, built once; the checkpoint tests use it without running the whole oracle
  if (!base) { const T = makeRoot(); buildRepo(T); base = { T, shells: findShells(T) }; }
  return base;
}
// decideFn and cats are injectable only for the allow-all safety test (decide() replaced by "allow everything", reduced category set)
async function buildOracle(decideFn = decide, cats = null) {
  const tStart = Date.now();
  const { T, shells } = setup();
  const D = T[0];
  const list = candidates(D);
  const all = [...list, ...STATIC_ONLY.map((cmd) => ({ cat: 'STATIC', cmd, execClass: 'STATIC_ONLY' }))].filter((c) => !cats || cats.includes(c.cat));
  assertClasses(all);
  const decisions = all.map((c) => ({ ...c, dec: Object.fromEntries(ROLES.flatMap((r) => TOOLS.map((t) => [`${r}/${t}`, decideFn(ev(c.cmd, r, t)).action]))) }));
  const cost = {};
  for (const [name, sh] of Object.entries(shells)) {
    if (cats) break; // reduced run: no cost probes
    if (!sh) { cost[name] = 'SKIPPED'; continue; }
    setState(T, 'A');
    cost[name] = Array.from({ length: 5 }, () => run(T, sh, 'git rev-parse HEAD').ms);
  }
  const gitMs = Array.from({ length: 5 }, () => { const t = Date.now(); spawnSync('git', ['rev-parse', 'HEAD'], { cwd: join(T, 'repo'), env: baseEnv(T), stdio: 'ignore' }); return Date.now() - t; });
  const results = [], exec = { Bash: 0, PowerShell: 0 }, skipped = [], batchStats = {};
  const tBatch = Date.now();
  for (const tool of TOOLS) {
    const items = [];
    for (const c of decisions) {
      if (c.execClass !== 'READ') continue; // STATIC_ONLY: decide() record only, never executed, whatever decide() says
      if (c.cat === 'C8' && tool === 'Bash') continue;
      if (!ROLES.some((r) => c.dec[`${r}/${tool}`] === 'pass')) continue;
      if (!shells[tool]) { skipped.push({ tool, cmd: c.cmd, why: 'shell missing' }); continue; }
      if (namesOtherDrive(c.cmd, D)) { skipped.push({ tool, cmd: c.cmd, why: 'other drive' }); continue; }
      items.push({ id: items.length, cat: c.cat, cmd: c.cmd, execClass: c.execClass });
    }
    assert.ok(items.length <= LIMITS.perShell, `executed commands per shell exceed ${LIMITS.perShell}: narrow the grammar`);
    exec[tool] = items.length;
    if (!items.length || !shells[tool]) continue;
    const jr = await judgeBatch(T, shells[tool], items);
    batchStats[tool] = jr.stats;
    for (const it of items) results.push({ tool, cat: it.cat, cmd: it.cmd, execClass: it.execClass, ...jr.out[it.id] });
  }
  return { T, D, shells, all, decisions, results, exec, skipped, cost, gitMs, batchStats, batchMs: Date.now() - tBatch, ms: Date.now() - tStart, hash: h(all.map((c) => c.cmd).join('\n')) };
}

// R4/R5: cleanup first, then the duration assertion. Idempotent; the last test calls it (so a failure is a test failure) and after() calls it as a fallback
// for runs that skip the last test (name filter). A cleanup failure throws before the duration is looked at.
let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  const T = created.root;
  if (T) {
    // delete only the mkdtemp directory created by this run
    assert.ok(T.startsWith(realpathSync(tmpdir())) && T.slice(realpathSync(tmpdir()).length).includes('oracle-003-'), `refusing to delete ${T}`);
    let err = null;
    try { rmSync(T, { recursive: true, force: true }); } catch (e) { err = e; }
    const gone = !existsSync(T);
    console.log(`cleanup: temp root removed=${gone}${err ? ` rmSync error=${err.code || err.message}` : ''}`);
    assert.ok(gone && !err, `CLEANUP FAILED, path left behind: ${T}`);
  }
  const wall = Date.now() - T0;
  console.log(`whole file wall time=${wall} ms`);
  const ceiling = CAL ? LIMITS.calibrationRunMs : LIMITS.defaultRunMs;
  assert.ok(wall <= ceiling, `whole-run ceiling exceeded: ${wall} ms > ${ceiling} ms (${CAL ? 'calibration' : 'default'} run)`);
}
after(finish);

// ---- tests
test('temp root is outside the project and unique', () => {
  const T = makeRoot();
  const rel = resolve(T).toLowerCase();
  const proj = resolve(PROJECT).toLowerCase();
  assert.ok(!(rel === proj || rel.startsWith(proj + sep)), 'temp root must not be inside the project');
});

// Stage 6 F2: the project-outside gate must throw on EVERY call (also for a cached root) and must not leave the mkdtemp directory behind.
// Injected base = project = the system temp dir, so the fresh root is "inside the project"; nothing is created in the real project.
test('makeRoot gate: a root inside the project throws on every call, is never cached, and its empty directory is removed', () => {
  const base = realpathSync(tmpdir());
  const cache = { root: null };
  const mine = () => readdirSync(base).filter((n) => n.startsWith('oracle-003-')).sort();
  const before = mine();
  try {
    for (let i = 1; i <= 2; i++) assert.throws(() => makeRoot(base, base, cache), /inside or equal to the project/, `call ${i} did not throw`);
    assert.equal(cache.root, null, 'a rejected root was cached');
    assert.deepEqual(mine(), before, 'the rejected mkdtemp directory was left behind');
  } finally {
    if (cache.root && existsSync(cache.root)) rmdirSync(cache.root); // leftover of a failing gate: the empty directory this test created
  }
});

test('comparator positive control (manual pairs, independent of decide())', () => {
  assert.equal(classify('0\0a\nb\n\0', '0\0a\nc\n\0'), 'FAIL', 'different content');
  assert.equal(classify('0\0a\n\0', '0\0a\nb\n\0'), 'FAIL', 'different line count');
  assert.equal(classify('0\0a\nb\n\0', '0\0a\nb\n\0'), 'PASS', 'same pair');
  assert.equal(classify('0\0a\nb\n\0', '0\0b\na\n\0'), 'WARN', 'order only');
  assert.equal(classify('0\0CANARY-A-x\n\0', '0\0CANARY-A-x\n\0'), 'FAIL', 'canary in identical output');
});

test('end-to-end positive control: known-leaky command run directly (not via hook) is flagged FAIL', async () => {
  const o = await oracle();
  const cands = ['git diff --no-index -- ../outside/secret.txt m1.txt', 'git diff --no-index ../outside/secret.txt .env', 'git diff --no-index -- ../outside/dir u.txt'];
  let flagged = 0, ran = 0;
  const shellsWithControl = new Set();
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) { console.log(`poscontrol ${name}: SKIPPED (shell missing)`); continue; }
    for (const cmd of cands) {
      setState(o.T, 'A'); const a = run(o.T, sh, cmd);
      setState(o.T, 'B'); const b = run(o.T, sh, cmd);
      if (a.err || b.err) { console.log(`poscontrol ${name}: harness error ${cmd}`); continue; }
      const differs = a.sig !== b.sig;
      console.log(`poscontrol ${name} | ${cmd} | A!=B: ${differs} | lenA=${a.len} lenB=${b.len} | exitA=${a.status} outA=${a.out} errA=${a.errLen} exitB=${b.status} | ${a.hash}/${b.hash}`);
      if (!differs) continue;
      ran++;
      shellsWithControl.add(name);
      assert.equal(classify(a.sig, b.sig), 'FAIL', `${name}: ${cmd}`);
      flagged++;
    }
  }
  assert.ok(ran > 0, 'no candidate produced an A/B difference: BLOCKED (no usable positive control)');
  assert.equal(flagged, ran);
  for (const [name, sh] of Object.entries(o.shells)) if (sh) assert.ok(shellsWithControl.has(name), `${name}: no positive control produced an A/B difference`);
});

test('oracle: coverage, non-vacuity, findings vs KNOWN_OPEN', async () => {
  const o = await oracle();
  console.log(`candidate-list hash=${o.hash} generated=${o.all.length} (limit ${LIMITS.generated}) drive=${o.D}`);
  assert.ok(o.all.length <= LIMITS.generated);
  const allowedBy = {};
  for (const c of o.decisions) for (const [k, v] of Object.entries(c.dec)) { const key = `${c.cat} ${k}`; allowedBy[key] = (allowedBy[key] ?? 0) + (v === 'pass' ? 1 : 0); }
  console.log(`allowed per category/role/tool: ${JSON.stringify(allowedBy)}`);
  console.log(`executed per shell: ${JSON.stringify(o.exec)}; skipped=${o.skipped.length} (${JSON.stringify(o.skipped.reduce((m, s) => ((m[s.why] = (m[s.why] ?? 0) + 1), m), {}))})`);
  // criterion 6b (new text): allowed candidate present -> at least one executed; none allowed -> STATIC_DENY_ONLY (never PASS)
  const failedCats = [], vac = vacuousGroups(o.results);
  for (const cat of CATS) for (const tool of TOOLS) {
    if (cat === 'C8' && tool === 'Bash') continue;
    const n = o.decisions.filter((c) => c.cat === cat).length;
    const allowed = o.decisions.filter((c) => c.cat === cat && ROLES.some((r) => c.dec[`${r}/${tool}`] === 'pass')).length;
    const executed = o.results.filter((r) => r.tool === tool && r.cat === cat).length;
    // R2: an EXECUTED category needs at least one executed candidate with exit 0 in BOTH states, else the A/B equality may only mean "everything failed alike"
    const status = !o.shells[tool] ? 'SKIPPED(shell missing)' : allowed === 0 ? 'STATIC_DENY_ONLY' : executed === 0 ? 'FAILED' : vac.includes(`${tool} ${cat}`) ? 'VACUOUS' : 'EXECUTED';
    if (status === 'FAILED' || status === 'VACUOUS') failedCats.push(`${tool} ${cat} ${status}`);
    console.log(`category ${cat} ${tool}: candidates=${n} allowed=${allowed} executed=${executed} status=${status}`);
  }
  const byCat = {};
  for (const r of o.results) byCat[`${r.tool} ${r.cat} ${r.verdict}`] = (byCat[`${r.tool} ${r.cat} ${r.verdict}`] ?? 0) + 1;
  console.log(`results: ${JSON.stringify(byCat)}`);
  const exits = {};
  for (const r of o.results) { const k = `${r.tool} ${r.cat} exit=${r.status}`; exits[k] = (exits[k] ?? 0) + 1; }
  console.log(`exit codes of executed commands: ${JSON.stringify(exits)}`);
  const badC1 = o.results.filter((r) => r.cat === 'C1' && r.status !== 0);
  for (const r of badC1) console.log(`  C1 nonzero | ${r.tool} | ${r.cmd} | ${r.st}`);
  for (const r of o.results) if (r.verdict !== 'PASS') console.log(`  ${r.verdict} | ${r.tool} | ${r.cat} | ${r.cmd} | len=${r.len} hash=${r.hash}${r.note ? ' | ' + r.note : ''}`);
  console.log(`cost ms per command, single spawn (5 runs each): ${JSON.stringify({ ...o.cost, git: o.gitMs })}`);
  console.log(`batch stats: ${JSON.stringify(o.batchStats)}; oracle batch phase=${o.batchMs} ms; oracle total (incl. setup and cost probes)=${o.ms} ms`);
  const total = o.exec.Bash + o.exec.PowerShell;
  console.log(`total executed=${total}; KNOWN_OPEN approval: ${KNOWN_OPEN_APPROVAL}`);
  const found = o.results.filter((r) => r.verdict === 'FAIL' || r.verdict === 'WARN').map((r) => `${r.tool}|${r.cmd}|${r.verdict}`).sort();
  console.log(`findings (FAIL+WARN) = ${found.length}; KNOWN_OPEN entries = ${KNOWN_OPEN.length}`);
  for (const f of found) console.log(`  finding: ${f}`);
  const available = Object.values(o.shells).filter(Boolean).length;
  assert.ok(total >= LIMITS.minExecuted * available, `non-vacuity: executed ${total} < ${LIMITS.minExecuted * available}`);
  for (const t of TOOLS) if (o.shells[t]) assert.ok(o.results.some((r) => r.tool === t && r.cat === 'C1'), `no executed C1 control for ${t}`);
  assert.deepEqual(failedCats, [], 'category has allowed candidates but none executed, or VACUOUS (no executed candidate exited 0 in both states)');
  assert.equal(o.results.filter((r) => r.verdict === 'FLAKY').length, 0, 'harness errors: INCONCLUSIVE, not PASS');
  assert.equal(badC1.length, 0, 'a benign control exited non-zero: harness not working (INCONCLUSIVE)');
  assert.ok(o.ms <= LIMITS.totalMs, `oracle runtime ceiling exceeded: ${o.ms} ms`);
  const known = [...KNOWN_OPEN].sort();
  const fresh = found.filter((x) => !known.includes(x)), gone = known.filter((x) => !found.includes(x));
  assert.ok(!fresh.length && !gone.length, `findings differ from KNOWN_OPEN: ${fresh.length} NEW (possible hole), ${gone.length} DISAPPEARED (hook changed or detector broke); NEW=${JSON.stringify(fresh)} DISAPPEARED=${JSON.stringify(gone)}`);
});

// ---- Stage 2 B: equivalence of batch and single-command classification
test('equivalence: batch classification and hashes equal the single-command run', CAL_OPTS, async () => {
  const o = await oracle();
  const bad = [];
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) continue;
    let n = 0, c1 = 0, vOk = 0, hOk = 0, hOkC1 = 0, vOkC1 = 0;
    for (const r of o.results.filter((x) => x.tool === name)) {
      const s = judgeSingle(o.T, sh, r.cmd, [], true);
      n++; const isC1 = r.cat === 'C1'; if (isC1) c1++;
      const v = s.verdict === r.verdict, hh = s.hA === r.hA && s.hB === r.hB;
      if (v) { vOk++; if (isC1) vOkC1++; }
      if (hh) { hOk++; if (isC1) hOkC1++; }
      if (!v || !hh) console.log(`  equivalence DIFF | ${name} | ${r.cat} | ${r.cmd} | batch=${r.verdict} ${r.hA}/${r.hB} exit=${r.status} | single=${s.verdict} ${s.hA}/${s.hB} exit=${s.status} | stdout(A)-equal=${s.oA === r.oA}`);
      if (isC1 && (!v || !hh)) bad.push(`${name} ${r.cmd}`);
      if (!isC1 && !v) bad.push(`${name} ${r.cmd}`);
    }
    console.log(`equivalence ${name}: compared=${n} (C1=${c1}); verdict-equal=${vOk}/${n} (C1 ${vOkC1}/${c1}); hash-equal=${hOk}/${n} (C1 ${hOkC1}/${c1})`);
  }
  assert.deepEqual(bad, [], 'batch and single-command runs differ: harness error');
});

// ---- Stage 2 A: the four Option A checkpoints (criterion 7)
test('checkpoint 1: batch uses the same command-line parsing as the single run (comma and @ handling)', async () => {
  const o = setup();
  const cmds = ['node ../argv.mjs m1.txt,../outside/secret.txt x', 'node ../argv.mjs -O@v --relative=@v c:x', 'node ../argv.mjs @v', 'node ../argv.mjs m1.txt,@v', 'node ../argv.mjs \\--no-index a,b'];
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) { console.log(`checkpoint 1 ${name}: SKIPPED (shell missing)`); continue; }
    const items = cmds.map((cmd, id) => ({ id, cmd }));
    const b = await runBatch(o.T, sh, items);
    const diffs = [];
    for (const it of items) {
      const s = run(o.T, sh, it.cmd, [], true);
      const x = b.res[it.id];
      assert.ok(!x.err && !s.err, `${name}: harness error ${it.cmd}`);
      console.log(`checkpoint 1 ${name} | ${it.cmd} | batch exit=${x.status} out=${x.out} err=${x.errLen} ${x.hash} | single exit=${s.status} out=${s.out} err=${s.errLen} ${s.hash}`);
      // a PowerShell parse error is worded differently under Invoke-Expression (batch) and -Command (single): for a failing command compare exit code and stdout only
      const same = x.status !== 0 && s.status !== 0 ? x.status === s.status && x.sig.split('\0')[1] === s.sig.split('\0')[1] : x.sig === s.sig;
      if (!same) diffs.push(it.cmd);
      if (x.status !== 0 && x.sig !== s.sig) console.log(`checkpoint 1 ${name} | ${it.cmd} | stderr wording differs between batch (${x.errLen} bytes) and single (${s.errLen} bytes); exit code and stdout equal`);
      if (it.id <= 3) console.log(`checkpoint 1 ${name} | argv seen by node (synthetic probe, not git output) = ${s.sig.split('\0')[1].trim()}`);
    }
    assert.deepEqual(diffs, [], `${name}: batch and single differ`);
  }
});

test('checkpoint 2: per-command timeout works inside a batch and the batch continues', async () => {
  const o = setup();
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) { console.log(`checkpoint 2 ${name}: SKIPPED (shell missing)`); continue; }
    const slow = name === 'PowerShell' ? 'Start-Sleep -Seconds 30' : 'sleep 30';
    const items = [{ id: 0, cmd: 'git rev-parse HEAD' }, { id: 1, cmd: slow }, { id: 2, cmd: 'git rev-parse --show-toplevel' }];
    const t = Date.now();
    const b = await runBatch(o.T, sh, items, { timeoutMs: 2500 });
    const ms = Date.now() - t;
    console.log(`checkpoint 2 ${name}: ${ms} ms, segments=${b.segments}, item1=${b.res[1].err}, item0 exit=${b.res[0].status}, item2 exit=${b.res[2].status}`);
    assert.equal(b.res[1].err, 'timeout');
    assert.equal(b.res[0].status, 0); assert.equal(b.res[2].status, 0);
    assert.equal(b.res[0].sig, run(o.T, sh, items[0].cmd).sig);
    assert.equal(b.res[2].sig, run(o.T, sh, items[2].cmd).sig);
    assert.ok(ms < 20000, 'timeout did not kill the slow command promptly');
  }
});

test('checkpoint 3: a failing command cannot hide the others', async () => {
  const o = setup();
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) { console.log(`checkpoint 3 ${name}: SKIPPED (shell missing)`); continue; }
    const items = ['git rev-parse HEAD', 'git no-such-subcommand-oracle', 'no-such-command-oracle', 'echo (', 'git rev-parse HEAD'].map((cmd, id) => ({ id, cmd }));
    const b = await runBatch(o.T, sh, items);
    console.log(`checkpoint 3 ${name}: ${items.map((it) => `${it.id}:${b.res[it.id].err ?? 'exit=' + b.res[it.id].status}`).join(' ')}; segments=${b.segments}`);
    for (const it of items) assert.ok(!b.res[it.id].err, `${name}: item ${it.id} lost`);
    assert.equal(b.res[0].status, 0); assert.equal(b.res[4].status, 0);
    for (const id of [1, 2, 3]) assert.notEqual(b.res[id].status, 0, `${name}: failure ${id} not visible`);
    assert.equal(b.res[0].sig, run(o.T, sh, items[0].cmd).sig);
    assert.equal(b.res[4].sig, b.res[0].sig);
  }
});

test('checkpoint 4: the batch does not change cwd or variables (drift detector has a positive control)', async () => {
  const o = setup();
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) { console.log(`checkpoint 4 ${name}: SKIPPED (shell missing)`); continue; }
    const clean = await runBatch(o.T, sh, ['git rev-parse HEAD', 'git status', 'git diff --stat'].map((cmd, id) => ({ id, cmd })));
    const cwd = name === 'PowerShell' ? 'Set-Location sub' : 'cd sub';
    const vr = name === 'PowerShell' ? '$global:OracleDrift = 1' : 'ORACLE_DRIFT=1';
    const mut = await runBatch(o.T, sh, [{ id: 0, cmd: cwd }, { id: 1, cmd: 'git rev-parse HEAD' }]);
    const mutv = await runBatch(o.T, sh, [{ id: 0, cmd: vr }, { id: 1, cmd: 'git rev-parse HEAD' }]);
    console.log(`checkpoint 4 ${name}: clean drift=${[0, 1, 2].map((i) => clean.res[i].drift)} varDrift=${clean.varDrift.length}; cwd-mutator drift=${mut.res[0].drift},${mut.res[1].drift}; var-mutator varDrift=${mutv.varDrift.length}`);
    if (clean.varDrift.length) { const [b0, b1] = clean.varDrift[0].map((x) => x.split(',')); console.log(`checkpoint 4 ${name}: var names added=${JSON.stringify(b1.filter((x) => !b0.includes(x)))} removed=${JSON.stringify(b0.filter((x) => !b1.includes(x)))}`); }
    assert.ok([0, 1, 2].every((i) => clean.res[i].drift === false) && clean.varDrift.length === 0, `${name}: false drift on a clean batch`);
    assert.ok(mut.res[0].drift === true, `${name}: cwd change not detected`);
    assert.ok(mutv.varDrift.length > 0, `${name}: variable change not detected`);
  }
});

// ---- Stage 2 E: environment ablation (variable NAMES only)
test('env ablation: PATHEXT, ComSpec, windir removed one at a time, C1 + C6 + C8 re-run', CAL_OPTS, async () => {
  const o = await oracle();
  console.log(`harness env names: ${JSON.stringify(Object.keys(baseEnv(o.T)))}`);
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) continue;
    const cmd = name === 'PowerShell' ? 'Get-ChildItem Env: | ForEach-Object { $_.Name }' : 'compgen -e';
    const r = spawnSync(sh.exe, sh.args(cmd), { cwd: join(o.T, 'repo'), env: baseEnv(o.T), stdio: ['ignore', 'pipe', 'ignore'], encoding: 'latin1', timeout: LIMITS.cmdTimeoutMs });
    console.log(`env names visible inside ${name} (${String(r.stdout).split(/\r?\n/).filter(Boolean).length}): ${JSON.stringify(String(r.stdout).split(/\r?\n/).filter(Boolean).sort())}`);
    const base = o.results.filter((x) => x.tool === name && ['C1', 'C6', 'C8'].includes(x.cat));
    const items = base.map((x, id) => ({ id, cmd: x.cmd }));
    for (const omit of ['PATHEXT', 'ComSpec', 'windir']) {
      const jr = await judgeBatch(o.T, sh, items, { omit: [omit] });
      for (const cat of ['C1', 'C6', 'C8']) {
        let n = 0, same = 0, exit0 = 0, pass = 0, sameVerdict = 0;
        base.forEach((x, id) => {
          if (x.cat !== cat) return;
          const y = jr.out[id]; n++;
          if (y.hA === x.hA && y.hB === x.hB && y.verdict === x.verdict) same++;
          if (y.verdict === x.verdict) sameVerdict++;
          if (y.status === 0) exit0++; if (y.verdict === 'PASS') pass++;
        });
        if (n) console.log(`ablation ${name} omit=${omit} ${cat}: n=${n} identical-to-baseline=${same} same-verdict=${sameVerdict} exit0=${exit0} PASS=${pass} fallback=${jr.stats.fallback}`);
      }
    }
  }
});

// ---- Stage 2 C: measurement at the 300 commands per shell target. SYNTHETIC: repeated benign C1 commands, NOT 300 distinct candidates.
test('measurement: 300 commands per shell, synthetic repeated benign batch (not distinct candidates)', CAL_OPTS, async () => {
  const o = await oracle();
  const c1 = o.decisions.filter((c) => c.cat === 'C1').map((c) => c.cmd);
  const N = LIMITS.perShell;
  const items = Array.from({ length: N }, (_, id) => ({ id, cmd: c1[id % c1.length] }));
  assert.ok(items.length <= LIMITS.perShell);
  for (const [name, sh] of Object.entries(o.shells)) {
    if (!sh) { console.log(`measurement ${name}: SKIPPED (shell missing)`); continue; }
    setState(o.T, 'A'); const A = await runBatch(o.T, sh, items);
    setState(o.T, 'B'); const B = await runBatch(o.T, sh, items);
    const errs = [...Object.values(A.res), ...Object.values(B.res)].filter((x) => x.err).length;
    const nonzero = [...Object.values(A.res), ...Object.values(B.res)].filter((x) => !x.err && x.status !== 0).length;
    console.log(`measurement ${name} [SYNTHETIC repeated benign, ${c1.length} distinct x ${Math.ceil(N / c1.length)}]: n=${N} per state; stateA=${A.ms} ms stateB=${B.ms} ms total=${A.ms + B.ms} ms; per-command=${((A.ms + B.ms) / (2 * N)).toFixed(1)} ms; segments=${A.segments + B.segments}; errors=${errs}; nonzero exit=${nonzero}; varDrift=${A.varDrift.length + B.varDrift.length}`);
    assert.equal(errs, 0);
  }
});

// ---- criterion 4 execution safety: independent of decide()
// Options named in docs/tasks/OFFICE-003.md criterion 4 (writers/executors). Completeness of this list for git as a whole: UNKNOWN; not extended from memory.
const CRIT4_LONG = ['--output', '--ext-diff', '--textconv', '--exec-path', '--open-files-in-pager'];
// Approximates what the shell hands to git: backslash, quote and backtick characters are removed, then the text is split on blanks and the
// separators , ; | & ( ). A token hits when it is `-c` (or `-c<...>=...`) or a criterion-4 long option, with `=value` ignored; an abbreviation
// of at least `--x` that is a prefix of a listed long option also hits (conservative).
export function writerHit(cmd) {
  const hits = [];
  for (const t of cmd.replace(/[\\'"`]/g, '').split(/[\s,;|&()]+/)) {
    if (!t) continue;
    const name = t.split('=')[0];
    if (t === '-c' || (/^-c/.test(t) && t.includes('='))) hits.push(t);
    else if (name.length >= 3 && name.startsWith('--') && CRIT4_LONG.some((o) => o.startsWith(name))) hits.push(t);
  }
  return hits;
}

// R2: executed groups (tool + category) in which no candidate exited 0 in both state A and state B
export function vacuousGroups(results) {
  const g = {};
  for (const r of results) (g[`${r.tool} ${r.cat}`] ??= []).push(r);
  return Object.entries(g).filter(([, l]) => !l.some((r) => r.status === 0 && r.statusB === 0)).map(([k]) => k);
}

test('unit: exit-0 guarantee reports VACUOUS for a synthetic list where every command fails; missing execClass is a harness error; writer options are detected', () => {
  const failing = [{ tool: 'Bash', cat: 'C6', status: 1, statusB: 1 }, { tool: 'Bash', cat: 'C6', status: 0, statusB: 128 }, { tool: 'PowerShell', cat: 'C6', status: 1, statusB: 1 }];
  assert.deepEqual(vacuousGroups(failing), ['Bash C6', 'PowerShell C6']);
  assert.deepEqual(vacuousGroups([...failing, { tool: 'Bash', cat: 'C6', status: 0, statusB: 0 }]), ['PowerShell C6']);
  console.log(`unit VACUOUS: all-failing synthetic list -> ${JSON.stringify(vacuousGroups(failing))}`);
  assert.throws(() => assertClasses([{ cat: 'C1', cmd: 'git status' }]), /without execClass/);
  assert.throws(() => assertClasses([{ cat: 'C1', cmd: 'git status', execClass: 'MAYBE' }]), /without execClass/);
  for (const c of ['git diff \\--output=x', "git diff '--output=x'", 'git diff "--out"put=x', 'git diff --ext-diff', 'git -c core.pager=x status', 'git show --textconv HEAD', 'git status --exec-path', 'git diff --open-files-in-pager', 'git diff --outp=x', 'echo a,--output=x']) {
    assert.ok(writerHit(c).length > 0, `writerHit missed: ${c}`);
    assert.throws(() => assertSafeToExecute(c), /NOT executed/);
  }
  for (const c of ['git status', 'git diff --stat -O..\\outside\\secret.txt', 'git ls-files --cached --ignored --exclude-from=.env', 'git diff --no-index m1.txt m2.txt']) assert.deepEqual(writerHit(c), [], `false hit: ${c}`);
});

test('allow-all safety: decide() replaced by "allow", baseline (C1) + C5 + static list; no writer/executor command may run, no file x may appear', async () => {
  const { T } = setup();
  const xPath = join(T, 'repo', 'x');
  assert.ok(!existsSync(xPath), 'precondition: no file x in the temp repo');
  const o = await buildOracle(() => ({ action: 'pass' }), ['C1', 'C5', 'STATIC']);
  const ran = o.results.map((r) => `${r.tool}|${r.cmd}`);
  const bad = o.results.filter((r) => writerHit(r.cmd).length).map((r) => `${r.tool}|${r.cmd}`);
  console.log(`allow-all: executed=${ran.length} (Bash ${o.exec.Bash}, PowerShell ${o.exec.PowerShell}); writer/executor commands executed=${bad.length} ${JSON.stringify(bad)}; file x created in temp repo=${existsSync(xPath)}`);
  assert.deepEqual(bad, [], 'a writer/executor command was executed');
  assert.deepEqual(o.results.filter(r => r.execClass !== 'READ'), []);
  assert.ok(!existsSync(xPath), 'file x appeared in the temp repo: a writer command ran');
});

// ---- criterion 6c: seeded bugs. Mutant COPIES of the hook (and of scripts/guard-scope.mjs next to it) live inside the temp root; the real files are only read.
// Each mutation is a text cut that leaves valid JavaScript. If the target text is not found exactly once, the test fails loudly.
const MUTANTS = [
  { id: 'M1', cat: 'C3', what: 'drive-relative check removed', cut: ' || /^[A-Za-z]:/.test(x)' },
  { id: 'M2', cat: 'C5', what: 'backslash check removed', cut: "x.includes('\\\\') || " },
  { id: 'M3', cat: 'C8', what: '@ check removed (PowerShell only)', cut: "x.startsWith('@') || " },
  { id: 'M4', cat: 'C6', what: 'option allowlist check removed', cut: "if (!flags.includes(x) && !(t[1] === 'log' && GIT_COUNT.test(x.slice(1)))) return false; " },
];
async function loadMutant(T, m) {
  const src = readFileSync(join(PROJECT, '.claude', 'hooks', 'scope-guard.mjs'), 'utf8');
  const hits = src.split(m.cut).length - 1;
  assert.equal(hits, 1, `${m.id}: mutation target ${JSON.stringify(m.cut)} found ${hits} times (expected exactly 1): the hook text changed, update the mutant`);
  const dir = join(T, 'mutants', m.id), file = join(dir, '.claude', 'hooks', 'scope-guard.mjs');
  mkdirSync(join(dir, '.claude', 'hooks'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(file, src.replace(m.cut, () => ''), 'utf8');
  copyFileSync(join(PROJECT, 'scripts', 'guard-scope.mjs'), join(dir, 'scripts', 'guard-scope.mjs'));
  const mod = await import(pathToFileURL(file).href);
  assert.equal(typeof mod.decide, 'function', `${m.id}: mutant copy did not load as a module with decide()`);
  return mod.decide;
}
for (const m of MUTANTS) {
  test(`mutant ${m.id} (${m.cat}): ${m.what}; oracle must classify a newly allowed ${m.cat} candidate FAIL`, async () => {
    const { T, shells } = setup();
    const D = T[0];
    const mdecide = await loadMutant(T, m);
    const pass = (dec, cmd, tool) => ROLES.some((r) => dec(ev(cmd, r, tool)).action === 'pass');
    const cands = candidates(D).filter((c) => c.cat === m.cat);
    const seen = [];
    for (const tool of TOOLS) {
      if (m.cat === 'C8' && tool === 'Bash') continue;
      const sh = shells[tool];
      if (!sh) { console.log(`mutant ${m.id} ${tool}: SKIPPED (shell missing)`); continue; }
      const items = [];
      let newly = 0, otherDrive = 0, staticOnly = 0;
      for (const { cmd, execClass } of cands) {
        if (!pass(mdecide, cmd, tool) || pass(decide, cmd, tool)) continue; // only candidates the mutation newly allows
        newly++;
        if (execClass !== 'READ') { staticOnly++; console.log(`  mutant ${m.id} | ${tool} | STATIC_ONLY newly allowed, NOT executed | ${cmd}`); continue; }
        if (namesOtherDrive(cmd, D)) { otherDrive++; continue; }
        items.push({ id: items.length, cat: m.cat, cmd });
      }
      console.log(`mutant ${m.id} ${tool}: category candidates=${cands.length} newly allowed=${newly} STATIC_ONLY not executed=${staticOnly} SKIPPED other drive=${otherDrive} executed=${items.length}`);
      if (!items.length) continue;
      const jr = await judgeBatch(T, sh, items);
      for (const it of items) { const r = jr.out[it.id]; seen.push({ tool, cat: m.cat, cmd: it.cmd, verdict: r.verdict, status: r.status, statusB: r.statusB }); console.log(`  mutant ${m.id} | ${tool} | ${r.verdict} | ${it.cmd} | len=${r.len} hash=${r.hash}${r.st ? ' | ' + r.st : ''}${r.note ? ' | ' + r.note : ''}`); }
      console.log(`mutant ${m.id} ${tool}: batch ${jr.stats.ms} ms, fallback=${jr.stats.fallback}`);
    }
    const fails = seen.filter((s) => s.verdict === 'FAIL');
    console.log(`mutant ${m.id}: executed=${seen.length} FAIL=${fails.length} (${JSON.stringify(seen.reduce((a, s) => ((a[s.verdict] = (a[s.verdict] ?? 0) + 1), a), {}))})`);
    for (const tool of TOOLS) console.log(`mutant ${m.id} ${tool}: executed=${seen.filter((s) => s.tool === tool).length} FAIL=${fails.filter((s) => s.tool === tool).length} exit0-both-states=${seen.filter((s) => s.tool === tool && s.status === 0 && s.statusB === 0).length}`);
    assert.deepEqual(vacuousGroups(seen), [], `${m.id}: VACUOUS mutant subset (no executed candidate exited 0 in both states)`);
    assert.ok(seen.length > 0, `${m.id}: no newly allowed ${m.cat} candidate was executed (category has no mutant coverage)`);
    assert.ok(fails.length > 0, `${m.id}: the oracle did not classify any newly allowed ${m.cat} candidate FAIL (detector blind to this hole, or no candidate shows an A/B difference)`);
  });
}

// ---- R1(4) class table, R5 pwsh, final cleanup
test('execClass table: every candidate has a class; no READ candidate contains a criterion-4 option; table printed', () => {
  const { T } = setup();
  const all = [...candidates(T[0]), ...STATIC_ONLY.map((cmd) => ({ cat: 'STATIC', cmd, execClass: 'STATIC_ONLY' }))];
  assertClasses(all);
  const rows = {};
  for (const c of all) { const k = `${c.cat} ${c.execClass}`; rows[k] ??= { n: 0, withOpt: 0 }; rows[k].n++; if (writerHit(c.cmd).length) rows[k].withOpt++; }
  console.log(`execClass table (category class: candidates, containing a criterion-4 option): ${JSON.stringify(rows)}`);
  for (const c of all.filter((x) => x.execClass === 'STATIC_ONLY' || writerHit(x.cmd).length)) console.log(`  execClass ${c.execClass} | ${c.cat} | opt-hit=${JSON.stringify(writerHit(c.cmd))} | ${c.cmd}`);
  assert.deepEqual(all.filter((c) => c.execClass === 'READ' && writerHit(c.cmd).length).map((c) => c.cmd), [], 'a READ candidate contains a criterion-4 option: fix the table');
  assert.ok(all.every((c) => !writerHit(c.cmd).length || c.execClass === 'STATIC_ONLY'));
});

test('shells: pwsh is searched on PATH and reported SKIPPED when absent (never PASS)', () => {
  const dirs = String(process.env.PATH ?? '').split(';').filter(Boolean);
  const found = dirs.map((d) => join(d, 'pwsh.exe')).filter((p) => existsSync(p));
  console.log(found.length ? `pwsh: FOUND (${found.length} on PATH) but NOT EXECUTED: the PowerShell tool is Windows PowerShell 5.1, no pwsh runner exists; not counted as PASS` : 'pwsh: SKIPPED (not found on PATH; never counted as PASS)');
});

// keep last: cleanup runs before the duration assertion, and a cleanup failure fails this test
test('zz final: temp root cleanup first, then whole-run duration', () => { finish(); });
