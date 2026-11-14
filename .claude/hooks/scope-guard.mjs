// 7ALLAB Engineering Office - Phase 1 PreToolUse hook (single guard).
// It is: (1) a hard file-scope gate for Write/Edit/NotebookEdit driven by an Owner-written task scope,
//        (2) a per-role shell allowlist for subagents, (3) accident prevention for the main (Director) session's shell.
// It is NOT a security boundary against a hostile shell: shell text cannot be bounded by lexical checks
// (see scripts/guard-scope.mjs, SHELL_NOT_BOUNDABLE). Every failure path blocks (exit 2). Silence means "no opinion".
import { readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyPath } from '../../scripts/guard-scope.mjs';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim() !== '';
const deny = (reason) => ({ action: 'deny', reason });
const ask = (reason) => ({ action: 'ask', reason });
const pass = () => ({ action: 'pass', reason: '' });

const WRITERS = ['Write', 'Edit', 'NotebookEdit'];
const SHELLS = ['Bash', 'PowerShell'];
// Owner-only, lower-case, project-relative with forward slashes. A trailing "/" means "everything below".
export const PROTECTED = ['.claude/', '.git/', 'governance/', 'imports/', 'inventory/', 'agents.md', 'claude.md', '.gitattributes', '.gitignore'];

export function validateScope(s, now = Date.now()) {
  const bad = (reason) => ({ ok: false, reason });
  if (!isObj(s)) return bad('task-scope.json is not an object');
  if (!str(s.taskId)) return bad('taskId missing');
  if (!Array.isArray(s.allow) || s.allow.length === 0 || s.allow.length > 50) return bad('allow must be a list of 1-50 entries');
  const allow = [];
  for (const a of s.allow) {
    if (!str(a) || a.length > 260 || /[:*?<>|"\0]/.test(a) || /^[\\/]/.test(a)) return bad(`invalid allow entry: ${JSON.stringify(a)}`);
    const n = a.replace(/\\/g, '/');
    if (n.split('/').some((seg) => seg === '..' || seg === '.')) return bad(`dot segment in allow entry: ${a}`);
    allow.push(n.toLowerCase());
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
const hits = (list, rel) => list.some((e) => (e.endsWith('/') ? rel.startsWith(e) : rel === e));

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
  let scope;
  try { scope = ctx.readScope(); } catch { return deny('no readable .claude/task-scope.json: no active task, no writes'); }
  const v = validateScope(scope, ctx.now ?? Date.now());
  if (!v.ok) return deny(`task scope rejected: ${v.reason}`);
  if (!hits(v.allow, rel)) return deny(`${tool}: ${rel} is outside the scope of task ${v.taskId}`);
  return pass();
}

// ---- shell. Subagents: one plain command from a per-role allowlist, nothing else.
const TOK = /^[A-Za-z0-9_@:.\/\\=,+-]+$/;
const BAD_NODE_FLAGS = /^(-e|-p|-r|--eval|--print|--require|--import|--loader|--experimental-loader)(=|$)/;
function tokensOf(cmd) {
  if (!str(cmd) || cmd.length > 500 || cmd !== cmd.trim()) return null;
  const t = cmd.split(' ');
  return t.every((x) => TOK.test(x)) ? t : null; // an empty token (double space) fails TOK; so do quotes, ; & | < > $ ` ( )
}
const isTestCmd = (t) => {
  if (!t) return false;
  if (t[0] === 'node' && t[1] === '--test') return !t.slice(2).some((x) => BAD_NODE_FLAGS.test(x));
  if (t[0] === 'npm' && t[1] === 'test') return true;
  if (t[0] === 'npm' && t[1] === 'run') return /^(test|lint|check|build)[\w:-]*$/.test(t[2] ?? '');
  return false;
};
// git read: default-deny. Only the subcommands, exact option tokens and argument shapes below pass.
// git accepts unique prefixes of long options and separate option values (gitcli): options match exactly, none takes a value except log -n <N>.
const GIT_READ_FLAGS = new Map([
  ['status', ['--short', '--porcelain', '--ignored']],
  ['diff', ['--stat', '--name-only', '--name-status', '--cached', '--no-color']],
  ['log', ['--oneline', '--stat']],
  ['show', ['--stat']],
  ['rev-parse', ['--show-toplevel']],
  ['ls-files', ['--others', '--exclude-standard']],
]);
const GIT_COUNT = /^[1-9][0-9]{0,3}$/;
const GIT_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
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
const SHELL_RULES = { 'qa-test-engineer': isTestCmd, 'implementation-engineer': (t) => isTestCmd(t) || isGitRead(t), 'release-evidence-reviewer': isGitRead };

// ---- shell. Main (Director) session: accident prevention only; the human stays in the loop.
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
const ASK = [
  /\bgit\b[^\n]*\b(add|commit|stash|merge|tag|branch|switch|checkout|cherry-pick|apply|am|mv|rm|worktree)\b/i,
  /\.claude/i,
];

function shellDecision(event) {
  const cmd = event.tool_input.command;
  if (!str(cmd)) return deny('shell command missing');
  const agent = event.agent_type;
  if (str(agent)) {
    const rule = SHELL_RULES[agent];
    if (!rule) return deny(`agent "${agent}" has no shell permission`);
    return rule(tokensOf(cmd)) ? pass() : deny(`command not on the allowlist for ${agent}: one plain test/read command only (no ; & | < > $ backtick ( ) quotes or redirects)`);
  }
  if (DANGEROUS.some((r) => r.test(cmd))) return deny('push, reset --hard, clean, rebase, remote edits and recursive delete are Owner-only (D2)');
  if (ASK.some((r) => r.test(cmd))) return ask('state-changing git command or .claude access: Owner approval required (D2)');
  return pass();
}

export function decide(event, ctx = {}) {
  try {
    if (!isObj(event) || !str(event.tool_name) || !isObj(event.tool_input)) return deny('malformed hook event');
    if (WRITERS.includes(event.tool_name)) return fileDecision(event, ctx);
    if (SHELLS.includes(event.tool_name)) return shellDecision(event);
    return pass();
  } catch {
    return deny('guard internal error');
  }
}

// One JSON line per decision, so "did the hook run and what did it return" is a record, not a guess.
// Never logs command text beyond its first two words. Logging can never change a decision.
function logDecision(event, d) {
  if (process.env.SCOPE_GUARD_NO_LOG === '1') return;
  try {
    const cmd = event?.tool_input?.command;
    const line = JSON.stringify({
      t: new Date().toISOString(), tool: event?.tool_name ?? null, agent: event?.agent_type ?? null, action: d.action,
      head: typeof cmd === 'string' ? cmd.split(' ').slice(0, 2).join(' ') : undefined, reason: String(d.reason).slice(0, 160),
    });
    appendFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'scope-guard.log'), line + '\n');
  } catch { /* ignore */ }
}

const defaultReadScope = (root) => JSON.parse(readFileSync(resolve(root, '.claude', 'task-scope.json'), 'utf8').replace(/^﻿/, ''));

async function main() {
  const root = process.argv[2] || process.env.CLAUDE_PROJECT_DIR;
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { event = null; } // Windows PowerShell 5.1 pipes may prepend a UTF-8 BOM
  const d = decide(event, { root, readScope: () => defaultReadScope(root) });
  logDecision(event, d);
  if (d.action === 'deny') { process.stderr.write(`[scope-guard] BLOCKED: ${d.reason}\n`); process.exit(2); }
  if (d.action === 'ask') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[scope-guard] ${d.reason}` } }));
  }
  process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (isMain) main().catch(() => { process.stderr.write('[scope-guard] BLOCKED: internal error\n'); process.exit(2); });
