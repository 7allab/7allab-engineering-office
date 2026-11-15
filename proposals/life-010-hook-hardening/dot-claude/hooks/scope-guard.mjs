// 7ALLAB Engineering Office - Phase 1 PreToolUse hook (single guard). LIFE-010 proposal, built on the Office base.
//
// GUVENLIK SINIRI DEGILDIR. Bu hook bir KAZA ONLEYICI KORKULUKTUR: dikkatsiz ya da yanlis yonlendirilmis bir ajanin
// yanlislikla yonetisim dosyalarini degistirmesini, push etmesini veya kapsam disina yazmasini zorlastirir. Kotu niyetli
// bir ajana, surece veya kullaniciya karsi bir sinir DEGILDIR: komut metni uzerindeki sozcuksel kontroller kacis karakteri,
// degisken, yorumlayici, kodlanmis girdi veya dolayli yol ile asilabilir. Gercek kontrol: Owner'in elle incelemesi, calisma
// agaci disinda tutulan SHA-256 manifest karsilastirmasi (office-manifest.mjs) ve isletim sistemi izinleri.
// THIS IS AN ACCIDENT-PREVENTION GUARDRAIL, NOT A SECURITY BOUNDARY AGAINST AN ADVERSARY.
//
// It is: (1) a hard file-scope gate for Write/Edit/NotebookEdit driven by an Owner-written task scope,
//        (2) a per-role shell allowlist for subagents, (3) accident prevention for the main (Director) session's shell,
//        (4) default deny for MCP tools (mcp__*) that the matcher routes here.
// Shell text cannot be bounded by lexical checks (see scripts/guard-scope.mjs, SHELL_NOT_BOUNDABLE).
// Every failure path blocks (exit 2). Silence means "no opinion".
// F1: loading this file ALWAYS runs the guard. There is no "am I the main module" path comparison: a junction, subst drive
// or 8.3 path made that comparison false and the hook then exited 0 without deciding (fail-open). Only
// SCOPE_GUARD_NO_MAIN=1, which the tests set before importing, skips main(); the Director shell asks for any command
// that names SCOPE_GUARD_* (the same holds for SCOPE_GUARD_NO_LOG).
import { readFileSync, appendFileSync, statSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyPath } from '../../scripts/guard-scope.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim() !== '';
const deny = (reason) => ({ action: 'deny', reason });
const ask = (reason) => ({ action: 'ask', reason });
const pass = () => ({ action: 'pass', reason: '' });
const BOM = new RegExp('^' + String.fromCharCode(0xfeff)); // a leading UTF-8 byte order mark

const WRITERS = ['Write', 'Edit', 'NotebookEdit'];
const SHELLS = ['Bash', 'PowerShell'];
// Owner-only, lower-case, project-relative with forward slashes. A trailing "/" means "everything below".
// scripts/guard-scope.mjs is the classifier this hook trusts; it is git-excluded, so nothing else records its changes (G4).
export const PROTECTED = ['.claude/', '.git/', 'governance/', 'imports/', 'inventory/', 'agents.md', 'claude.md', 'claude.local.md', '.mcp.json', '.gitattributes', '.gitignore', 'scripts/guard-scope.mjs'];
// F3: agent and memory instruction files are Owner-only at ANY depth (Claude Code also loads nested CLAUDE.md files;
// .mcp.json defines MCP servers that start outside this hook). Matched against every path segment.
const OWNER_BASENAME = /^(agents\.md|claude\.md|claude\.local\.md|\.mcp\.json)$/i;
// MCP tools are denied unless their exact tool name is listed here (E4). Starts empty; only the Owner edits it.
export const MCP_ALLOW = Object.freeze([]);
const OWNER_SEG = /^(\.git|\.claude)$/i;

const hits = (list, rel) => list.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

export function validateScope(s, now = Date.now()) {
  const bad = (reason) => ({ ok: false, reason });
  if (!isObj(s)) return bad('task-scope.json is not an object');
  if (!str(s.taskId)) return bad('taskId missing');
  if (!Array.isArray(s.allow) || s.allow.length === 0 || s.allow.length > 50) return bad('allow must be a list of 1-50 entries');
  const allow = [];
  for (const a of s.allow) {
    if (!str(a) || a.length > 260 || /[:*?<>|"\0]/.test(a) || /^[\\/]/.test(a)) return bad(`invalid allow entry: ${JSON.stringify(a)}`);
    const n = a.replace(/\\/g, '/');
    const segs = n.split('/');
    if (segs.some((seg) => seg === '..' || seg === '.')) return bad(`dot segment in allow entry: ${a}`);
    if (segs.some((seg) => /[. ]$/.test(seg))) return bad(`trailing dot or space in allow entry: ${a}`);
    const l = n.toLowerCase();
    // E1/G5: governance and guard files are changed by the Owner by hand only. Such an entry is a mistake, never a grant,
    // so the whole scope is rejected (fail closed) instead of the entry being silently ignored by the PROTECTED check.
    // F9: compare without trailing slashes, so "AGENTS.md/" or "scripts/guard-scope.mjs/" is rejected like the bare name.
    const l0 = l.replace(/\/+$/, '');
    if (hits(PROTECTED, l0) || hits(PROTECTED, l0 + '/') || segs.some((seg) => OWNER_SEG.test(seg) || OWNER_BASENAME.test(seg))) return bad(`Owner-only path in allow entry: ${a}`);
    allow.push(l);
  }
  if (s.expires !== undefined) {
    const t = Date.parse(s.expires);
    if (!Number.isFinite(t)) return bad('expires is not a valid date');
    if (t <= now) return bad('task scope expired');
  }
  return { ok: true, taskId: s.taskId, allow };
}

const relOf = (p, root) => {
  const n = (x) => x.replace(/\//g, '\\').replace(/\\+$/, '');
  return n(p).slice(n(root).length).replace(/^\\+/, '').replace(/\\/g, '/').toLowerCase();
};

function fileDecision(event, ctx) {
  const tool = event.tool_name, ti = event.tool_input;
  const field = tool === 'NotebookEdit' ? 'notebook_path' : 'file_path';
  if (!str(ti[field])) return deny(`${tool}: ${field} missing`);
  const c = classifyPath(ti[field], ctx.root, { intent: 'write', fs: ctx.fs });
  if (c.scope !== 'INSIDE_VERIFIED') return deny(`${tool}: target not provably inside the project (${c.scope}/${c.code})`);
  if (c.sensitive_name) return deny(`${tool}: sensitive path segment (.git/.claude/.env/keys) is Owner-only`);
  const rel = relOf(ti[field], ctx.root);
  if (rel === '') return deny(`${tool}: target is the project root`);
  if (hits(PROTECTED, rel)) return deny(`${tool}: ${rel} is Owner-only (governance/config)`);
  if (rel.split('/').some((seg) => OWNER_BASENAME.test(seg))) return deny(`${tool}: ${rel}: AGENTS.md, CLAUDE.md, CLAUDE.local.md and .mcp.json are Owner-only at any depth`);
  let scope;
  try { scope = ctx.readScope(); } catch { return deny('no readable .claude/task-scope.json: no active task, no writes'); }
  const v = validateScope(scope, ctx.now ?? Date.now());
  if (!v.ok) return deny(`task scope rejected: ${v.reason}`);
  if (!hits(v.allow, rel)) return deny(`${tool}: ${rel} is outside the scope of task ${v.taskId}`);
  return pass();
}

// ---- shell. Subagents: one plain command from a per-role allowlist, nothing else.
const TOK = /^[A-Za-z0-9_@:.\/\\=,+-]+$/;
function tokensOf(cmd) {
  if (!str(cmd) || cmd.length > 500 || cmd !== cmd.trim()) return null;
  const t = cmd.split(' ');
  return t.every((x) => TOK.test(x)) ? t : null; // an empty token (double space) fails TOK; so do quotes, ; & | < > $ ` ( ) and newlines
}
const GIT_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
// G6: node --test runs only named test files below tests/, with no option at all (no --test-reporter=<module>,
// --test-reporter-destination=<file>, --import, ...). Forward slashes only; no dot segments; no device names.
const TEST_FILE = /^tests\/([A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.test\.mjs$/;
const isTestFile = (x) => TEST_FILE.test(x) && !x.split('/').some((s) => GIT_DEVICE.test(s));
// G6b/G6c: npm only as these exact commands. No trailing arguments (--script-shell=..., -- ...), no build/lint/test:* scripts.
const NPM_EXACT = ['npm test', 'npm run test', 'npm run check'];
const isTestCmd = (t) => {
  if (!t) return false;
  if (t[0] === 'node' && t[1] === '--test') return t.length > 2 && t.slice(2).every(isTestFile);
  if (t[0] === 'npm') return NPM_EXACT.includes(t.join(' '));
  return false;
};
// git read: default-deny. Only the subcommands, exact option tokens and argument shapes below pass.
// git accepts unique prefixes of long options and separate option values (gitcli): options match exactly, none takes a value except log -n <N>.
const GIT_READ_FLAGS = new Map([
  ['status', ['--short', '--porcelain', '--ignored']],
  ['diff', ['--stat', '--name-only', '--name-status', '--cached', '--no-color', '--check']],
  ['log', ['--oneline', '--stat']],
  ['show', ['--stat']],
  ['rev-parse', ['--show-toplevel']],
  ['ls-files', ['--others', '--exclude-standard', '--eol']],
]);
const GIT_COUNT = /^[1-9][0-9]{0,3}$/;
// Bash strips a backslash before running the command, so `\--no-index` becomes `--no-index`: refuse any backslash.
// git switches to no-index mode (reads arbitrary files) when a path argument is outside the work tree: refuse `..` segments, absolute and drive paths.
const isEscapedOrOutside = (x) => x.includes('\\') || /(^|[\/:])\.\.(\/|$)/.test(x) || x.startsWith('@') || (!x.startsWith('-') && (x.startsWith('/') || /^[A-Za-z]:/.test(x)));
const isGitArg = (x) => /^[A-Za-z0-9_.\/:@\\-]+$/.test(x) && !x.startsWith('-') && !x.startsWith(':') && x.split(':').length <= 2
  && !x.split(/[\/:]/).some((s) => GIT_DEVICE.test(s)) && !isEscapedOrOutside(x);
const isGitRead = (t) => {
  if (!t || t[0] !== 'git') return false;
  if (t[1] === 'branch') return t.length === 3 && t[2] === '--show-current';
  const flags = GIT_READ_FLAGS.get(t[1]);
  if (!flags) return false;
  let paths = false;
  for (let i = 2; i < t.length; i++) {
    const x = t[i];
    if (!paths && x === '--') { paths = true; continue; }
    if (!paths && t[1] === 'log' && x === '-n' && GIT_COUNT.test(t[i + 1] ?? '')) { i++; continue; }
    if (!paths && x.startsWith('-')) { if (!flags.includes(x) && !(t[1] === 'log' && GIT_COUNT.test(x.slice(1)))) return false; continue; }
    if (!isGitArg(x)) return false;
  }
  return true;
};
// E2: release-evidence-reviewer does not run tests; it takes qa-test-engineer's output as evidence.
const SHELL_RULES = {
  'qa-test-engineer': (t) => isTestCmd(t) || isGitRead(t),
  'implementation-engineer': (t) => isTestCmd(t) || isGitRead(t),
  'release-evidence-reviewer': isGitRead,
};

// ---- shell. Main (Director) session: accident prevention only; the human stays in the loop. Not an allowlist (E3).
const DANGEROUS = [
  /\bgit\b[^\n]*\bpush\b/i,
  /\bgit\b[^\n]*\b(reset\s+--hard|clean|filter-branch|rebase)\b/i,
  /\bgit\b[^\n]*\bremote\s+(add|set-url|remove)\b/i,
  /\bgit\b[^\n]*\b(checkout|restore)\s+(--|\.)/i,
  /\bgit\b[^\n]*\bbranch\s+-D\b/,
  /\brm\s+-[a-z]*(rf|fr)\b/i,
  /\bRemove-Item\b[^\n]*-Recurse/i,
  /\b(del|erase|rd|rmdir)\b\s+\/s/i,
];
// E3/E5: an Owner-only name anywhere in the command text (case-insensitive) asks, whether the command reads or writes it.
// F2/N5: any path into .git: ".git" not followed by a word character or "-" (".git/", ".git\", ".git*", ".git,", ".git>",
// ".git" at the end, ...). ".github", ".gitmodules", ".gitkeep" do not match; .gitattributes/.gitignore have their own entries.
// F3: CLAUDE.local.md and .mcp.json. F1: SCOPE_GUARD_* switches ("scope[-_]guard").
const PROTECTED_NAMES = /agents\.md|claude\.md|claude\.local\.md|\.mcp\.json|\.claude|task-scope|scope[-_]guard|guard-scope|\.git(?![\w-])|\.gitattributes|\.gitignore/i;
// N2: a package manager anywhere in the command AND an install-like verb anywhere in it (as a separate word), so options
// with values ("npm --prefix app install") cannot hide the verb. "npm test" / "npm run check" have no such verb.
const PKG_MGR = /\b(npm|pnpm|yarn|bun|bunx|npx)(\.cmd|\.ps1|\.exe)?\b/i;
// R3-1: the verb may touch shell punctuation or quotes (`npm ci&&x`, `(npm ci)`, `npm install|tee`) and may be followed by
// "-" (npm's `install-test`, `install-clean` aliases), as the round-2 `\b` allowed. It must still START a word ("test-ci" no).
// Also before the verb: "\" (bash drops it: `npm \ci`), "^" (cmd drops it: `npm ^ci`), "{" and "," (PowerShell `&{npm ci}`,
// `npm x,ci`); after it: "," and "}". Known accepted over-asks: `echo up-to-date`, `x-report.txt` next to an npm command.
const PKG_VERB = /(^|[\s;&|("'`\\^{,])(ci|clean-install|ic|cit|install-ci-test|install|isntall|i|in|it|add|update|up|upgrade|uninstall|un|unlink|remove|rm|r|link|ln|exec|x|dlx|rebuild|dedupe|prune|publish|init|create|version|pkg)(?=[\s;&|)<>"'`,}-]|$)/i;
const pkgInstall = (x) => PKG_MGR.test(x) && PKG_VERB.test(x);
// Ext (Owner, tur 3): this exact command is a read and does not ask; every other `git branch ...` still asks.
const ASK_EXEMPT = ['git branch --show-current'];
const ASK = [
  // F4/N3: restore, reset (any form; reset --hard is denied above), pull, fetch, clone, revert; update-ref, gc, submodule,
  // notes, init, replace, reflog.
  [/\bgit\b[^\n]*\b(add|commit|stash|merge|tag|branch|switch|checkout|cherry-pick|apply|am|mv|rm|worktree|config|restore|reset|pull|fetch|clone|revert|update-ref|gc|submodule|notes|init|replace|reflog)\b/i, 'state-changing or network git command'],
  // F5: one-shot config by option or environment can run textconv/fsmonitor/pager/external-diff commands.
  [/\bgit\b[^\n]*\s-c\s|--config-env|\bGIT_CONFIG|\bGIT_EXTERNAL_DIFF\b/i, 'git config override (-c, --config-env, GIT_CONFIG*, GIT_EXTERNAL_DIFF)'],
  // N4: assigning any GIT_<name> (GIT_PAGER, GIT_SSH_COMMAND, GIT_DIR, ...) or EDITOR, in sh/cmd or PowerShell form.
  [/\bGIT_[A-Z0-9_]+\s*=|\$env:GIT_[A-Z0-9_]+|\bEDITOR\s*=|\$env:EDITOR\b/i, 'GIT_* or EDITOR assignment (git runs these as commands)'],
  // N1: GitHub CLI: PR merge/create, release, repo and api calls act on the remote, which is Owner-only.
  [/\bgh(\.exe)?\s/i, 'GitHub CLI (gh)'],
  [PROTECTED_NAMES, 'command text names an Owner-only governance or guard file (AGENTS.md, CLAUDE.md, CLAUDE.local.md, .mcp.json, .claude, scope files, .git/, .gitattributes, .gitignore)'],
  // Inline or stdin interpreter code carries file names past the name check above.
  [/(^|[\s;&|(\\\/])(python[0-9.]*|py|node|deno|bun|ruby|perl|php)(\.exe)?\s+(-|-c|-e|-p|-r|--eval|--print)(?=\s|$)/i, 'inline or stdin interpreter code'],
  [/\b(pwsh|powershell)(\.exe)?\b[^\n]*\s-(e|ec|en[a-z]*)(?=\s|$)/i, 'PowerShell encoded command'],
  [/\b(Invoke-Expression|iex)\b/i, 'Invoke-Expression'],
  // AGENTS.md: npm ci and npm run build only with Owner approval; installs change node_modules and run package scripts.
  // F6/N2: package managers. npx/bunx always (they download and run packages); install-like verbs at any position;
  // global npm; npm run build/verify (verify includes build).
  [/\b(npx|bunx)\b/i, 'npx/bunx'],
  [pkgInstall, 'package manager install/ci/exec/dlx/init/create/version/pkg'],
  [/\bnpm(\.cmd|\.ps1|\.exe)?\b[^\n]*\s(-g|--global)(?=[\s=]|$)/i, 'global npm (-g/--global)'],
  [/\bnpm(\.cmd|\.ps1|\.exe)?\b(\s+-\S+)*\s+run(-script)?\s+(build|verify)\b/i, 'npm run build/verify (verify includes build)'],
];
// Bash `\`+newline, PowerShell backtick+newline and cmd `^`+newline continue a line: `git \<newline>push` is `git push`.
const joinContinuations = (c) => c.replace(/[\\`^][ \t]*\r?\n/g, '');

function shellDecision(event) {
  const cmd = event.tool_input.command;
  if (!str(cmd)) return deny('shell command missing');
  const agent = event.agent_type;
  if (agent !== undefined && agent !== null && !str(agent)) return deny('malformed agent_type');
  if (str(agent)) {
    const rule = SHELL_RULES[agent];
    if (!rule) return deny(`agent "${agent}" has no shell permission`);
    return rule(tokensOf(cmd)) ? pass() : deny(`command not on the allowlist for ${agent}: one plain test/read command only (no ; & | < > $ backtick ( ) quotes or redirects)`);
  }
  const texts = [cmd, joinContinuations(cmd)];
  const any = (r) => texts.some((x) => (typeof r === 'function' ? r(x) : r.test(x)));
  if (DANGEROUS.some(any)) return deny('push, reset --hard, clean, rebase, remote edits and recursive delete are Owner-only (D2)');
  if (ASK_EXEMPT.includes(cmd)) return pass();
  for (const [r, why] of ASK) if (any(r)) return ask(`${why}: Owner approval required (D2)`);
  return pass();
}

export function decide(event, ctx = {}) {
  try {
    if (!isObj(event) || !str(event.tool_name) || !isObj(event.tool_input)) return deny('malformed hook event');
    const tool = event.tool_name;
    if (tool.toLowerCase().startsWith('mcp__')) return MCP_ALLOW.includes(tool) ? pass() : deny(`${tool}: MCP tools are off by default (E4); the Owner allows exact names in MCP_ALLOW`);
    if (WRITERS.includes(tool)) return fileDecision(event, ctx);
    if (SHELLS.includes(tool)) return shellDecision(event);
    return pass();
  } catch {
    return deny('guard internal error');
  }
}

// One JSON line per decision, so "did the hook run and what did it return" is a record, not a guess.
// G10: logs the command text and the file path, each cut to 300 characters (with the full length when cut).
// The log is rotated once it reaches LOG_MAX_BYTES (one previous file kept as .1): total size stays below about 2 x LOG_MAX_BYTES.
// F7: the log can hold secrets typed on a command line. "Owner-only" holds for WRITES only: the log lives under .claude/
// (git-excluded; Write/Edit denied by this hook), but the Read tool and any shell can READ it, full command text included.
// Logging can never change a decision.
export const LOG_MAX_BYTES = 1024 * 1024;
const LOG_TEXT_MAX = 300;
const clip = (o, key, v) => {
  if (typeof v !== 'string') return;
  o[key] = v.length > LOG_TEXT_MAX ? v.slice(0, LOG_TEXT_MAX) : v;
  if (v.length > LOG_TEXT_MAX) o[`${key}Len`] = v.length;
};
export function formatLogLine(event, d, now = new Date()) {
  const ti = isObj(event?.tool_input) ? event.tool_input : {};
  const o = { t: now.toISOString(), tool: typeof event?.tool_name === 'string' ? event.tool_name.slice(0, 120) : null, agent: typeof event?.agent_type === 'string' ? event.agent_type.slice(0, 60) : null, action: d.action };
  clip(o, 'cmd', ti.command);
  clip(o, 'path', ti.file_path ?? ti.notebook_path);
  o.reason = String(d.reason).slice(0, 160);
  return JSON.stringify(o);
}
export function logDecision(event, d, opts = {}) {
  if (process.env.SCOPE_GUARD_NO_LOG === '1') return;
  try {
    const file = opts.file ?? resolve(dirname(fileURLToPath(import.meta.url)), 'scope-guard.log');
    const max = opts.maxBytes ?? LOG_MAX_BYTES;
    try { if (statSync(file).size >= max) renameSync(file, `${file}.1`); } catch { /* missing file or rotation race: just append */ }
    appendFileSync(file, formatLogLine(event, d) + '\n');
  } catch { /* ignore */ }
}

// F8: write the decision text, then exit only from the write callback, so a piped stdout/stderr is drained before the
// process ends. process.exitCode is set first: if the callback never runs, the event loop still ends with this code.
export function finish(code, stream, text, exit = (c) => process.exit(c)) {
  process.exitCode = code;
  if (!stream || !text) return exit(code);
  stream.write(text, () => exit(code));
}

const defaultReadScope = (root) => JSON.parse(readFileSync(resolve(root, '.claude', 'task-scope.json'), 'utf8').replace(BOM, ''));

async function main() {
  const root = process.argv[2] || process.env.CLAUDE_PROJECT_DIR;
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw.replace(BOM, '')); } catch { event = null; } // Windows PowerShell 5.1 pipes may prepend a UTF-8 BOM
  const d = decide(event, { root, readScope: () => defaultReadScope(root) });
  logDecision(event, d);
  if (d.action === 'deny') return finish(2, process.stderr, `[scope-guard] BLOCKED: ${d.reason}\n`);
  if (d.action === 'ask') {
    return finish(0, process.stdout, JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[scope-guard] ${d.reason}` } }));
  }
  return finish(0);
}

// F1: no main-module path comparison (see header). Tests set SCOPE_GUARD_NO_MAIN=1 before importing this module.
if (process.env.SCOPE_GUARD_NO_MAIN !== '1') main().catch(() => finish(2, process.stderr, '[scope-guard] BLOCKED: internal error\n'));
