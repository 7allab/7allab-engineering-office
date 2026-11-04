// ADIM 55 TEMP-only fail-closed hook wrapper (prototype, NOT installed anywhere real).
// argv: <adapter.mjs> [--child-timeout-ms N]. Spawns the unmodified adapter CLI, parses its output strictly,
// and only ever emits: exit 2 + stderr (PreToolUse block), exit 0 + EMPTY stdout (explicitly verified safe Read),
// or a fixed PermissionRequest deny JSON. It never emits allow / updatedInput. TOCTOU is NOT prevented.
// (D2B-2B: decide() has an injection-only grantCheck branch that can emit one canonical PreToolUse "ask"; the CLI never enables it.)
import { readSync, writeSync, realpathSync, lstatSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { grantAskJson, GRANT_ID_RE } from './authority-grant.mjs';

export const MAX_STDIN = 1048576;
const EVENTS = ['PreToolUse', 'PermissionRequest'];
const GRANTABLE = ['Write', 'Edit'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim() !== '';

export function readLimited(max = MAX_STDIN) {
  const chunks = [];
  let total = 0;
  const buf = Buffer.alloc(65536);
  for (;;) {
    let n;
    try { n = readSync(0, buf, 0, buf.length, null); } catch (e) { if (e.code === 'EOF') break; throw e; }
    if (n === 0) break;
    total += n;
    if (total > max) return null;
    chunks.push(Buffer.from(buf.subarray(0, n)));
  }
  return Buffer.concat(chunks);
}

// ---- real Windows path verification for Read (never trusts the string alone; TOCTOU not prevented)
const DEVICE = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
const lc = (s) => s.toLowerCase();
export function checkReadPath(p, projectDir) {
  const no = (code) => ({ ok: false, code });
  try {
    if (!str(p) || !str(projectDir)) return no('PATH_MISSING');
    if (/[\p{Cc}\p{Cf}]/u.test(p) || p !== p.normalize('NFKC') || p !== p.trim()) return no('PATH_ODD_CHARS');
    if (!/^[a-zA-Z]:[\\/]/.test(p)) return no('NOT_DRIVE_ABSOLUTE'); // UNC, \\?\, \\.\, relative, POSIX
    if (p.slice(2).includes(':')) return no('ALTERNATE_DATA_STREAM');
    if (/[*?<>|"]/.test(p)) return no('WILDCARD_OR_INVALID_CHAR');
    const segs = p.slice(3).split(/[\\/]+/).filter(Boolean);
    if (segs.some((s) => s === '..' || s === '.')) return no('DOT_SEGMENT');
    if (segs.some((s) => /[. ]$/.test(s))) return no('TRAILING_DOT_OR_SPACE');
    if (segs.some((s) => DEVICE.test(s))) return no('DEVICE_NAME');
    if (segs.some((s) => /~\d/.test(s))) return no('SHORT_NAME_8_3');
    if (segs.some((s) => /^(\.git|\.claude|\.ssh|\.aws|\.npmrc|\.netrc|\.env(\..*)?|id_(rsa|ed25519|ecdsa|dsa).*|.*\.(pem|key|pfx|p12))$/i.test(s))) return no('SENSITIVE_NAME');
    const rootReal = realpathSync.native(projectDir);
    const rootGiven = projectDir.replace(/[\\/]+$/, '');
    const given = p.replace(/\//g, '\\');
    const g = lc(given);
    const rg = lc(rootGiven.replace(/\//g, '\\'));
    if (!(g === rg || g.startsWith(rg + '\\'))) return no('OUTSIDE_PROJECT_SYNTACTIC');
    const real = realpathSync.native(given); // throws ENOENT when missing -> NOT_FOUND
    const expected = rootReal + given.slice(rootGiven.length);
    if (lc(real) !== lc(expected.replace(/\\+$/, ''))) return no(lc(real).startsWith(lc(rootReal) + '\\') ? 'ALIASED_INSIDE' : 'RESOLVES_OUTSIDE_PROJECT'); // junction / symlink / 8.3 / mount alias
    // every component below the root must itself be a plain entry, not a link / reparse point
    let cur = rootReal;
    for (const s of given.slice(rootGiven.length).split('\\').filter(Boolean)) {
      cur = cur + '\\' + s;
      if (lstatSync(cur).isSymbolicLink()) return no('REPARSE_POINT_COMPONENT');
    }
    const st = lstatSync(real);
    if (!st.isFile()) return no('NOT_A_REGULAR_FILE');
    if (st.nlink > 1) return no('HARD_LINKED_FILE');
    return { ok: true, code: 'REAL_PATH_INSIDE', real };
  } catch (e) {
    return no(e && e.code === 'ENOENT' ? 'NOT_FOUND' : 'PATH_CHECK_ERROR');
  }
}

// ---- strict parsing of the adapter CLI contract (read from scripts/decision-gate-event-adapter.mjs: toHookResponse + main)
const keysOnly = (o, ks) => isObj(o) && Object.keys(o).sort().join() === [...ks].sort().join();
export function classifyAdapter(eventName, r) {
  if (!r || r.error || r.signal || typeof r.status !== 'number') return 'INVALID';
  const out = r.stdout ?? '';
  const err = r.stderr ?? '';
  if (eventName === 'PreToolUse') {
    if (r.status === 2) return out === '' && err !== '' ? 'DENY' : 'INVALID';
    if (r.status !== 0 || err !== '') return 'INVALID';
    if (out === '') return 'NO_OPINION';
    let j;
    try { j = JSON.parse(out); } catch { return 'INVALID'; }
    const h = j && j.hookSpecificOutput;
    if (keysOnly(j, ['hookSpecificOutput']) && keysOnly(h, ['hookEventName', 'permissionDecision', 'permissionDecisionReason']) && h.hookEventName === 'PreToolUse' && h.permissionDecision === 'ask' && str(h.permissionDecisionReason)) return 'ASK';
    return 'INVALID'; // includes any "allow" / "defer" / extra fields / plain text
  }
  if (r.status !== 0 || err !== '') return 'INVALID';
  if (out === '') return 'NO_OPINION';
  let j;
  try { j = JSON.parse(out); } catch { return 'INVALID'; }
  const h = j && j.hookSpecificOutput;
  if (keysOnly(j, ['hookSpecificOutput']) && keysOnly(h, ['hookEventName', 'decision']) && h.hookEventName === 'PermissionRequest' && keysOnly(h.decision, ['behavior', 'message']) && h.decision.behavior === 'deny' && str(h.decision.message)) return 'DENY';
  return 'INVALID';
}

const sha = (b) => createHash('sha256').update(b).digest('hex');
const safe = (s) => String(s).replace(/[^\x20-\x7E]/g, '?').slice(0, 200);

// decide(): pure-ish; returns what the process must emit. Never throws.
const ENV_KEEP = ['SystemRoot', 'windir', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'COMSPEC'];
// grantCheck (K2-04-D2B-2B) is an INJECTION POINT ONLY: main() never passes it, so no production entry point can reach the branch below.
// With it, an adapter DENY for Write/Edit on PreToolUse may be turned into a canonical "ask" (never allow) when grantCheck(ev) says MATCH.
export function decide(raw, { adapterPath, expectEvent = null, childTimeoutMs = 5000, projectDir = process.env.CLAUDE_PROJECT_DIR, spawn = spawnSync, grantCheck = null } = {}) {
  const log = { bytes: raw ? raw.length : null, sha256: raw ? sha(raw) : null, event: null, tool: null };
  let eventName = EVENTS.includes(expectEvent) ? expectEvent : null; // pinned by the hook config: unparsable input must still use the right protocol
  const block = (code) => {
    log.reason = code;
    if (eventName === 'PermissionRequest') {
      return { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: `BLOCKED(wrapper): ${code}` } } }), stderr: '', log };
    }
    return { exitCode: 2, stdout: '', stderr: `BLOCKED(wrapper): ${code}`, log };
  };
  try {
    if (raw === null || raw === undefined) return block('STDIN_TOO_LARGE_OR_UNREADABLE');
    let ev;
    try { ev = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { return block('STDIN_NOT_JSON'); }
    if (!isObj(ev)) return block('EVENT_NOT_OBJECT');
    if (!EVENTS.includes(ev.hook_event_name)) return block('UNEXPECTED_EVENT');
    if (expectEvent !== null && ev.hook_event_name !== eventName) return block('EVENT_MISMATCH_WITH_HOOK_CONFIG');
    eventName = ev.hook_event_name;
    log.event = eventName;
    if (!str(ev.session_id) || !str(ev.cwd) || !str(ev.tool_name) || !isObj(ev.tool_input) || (eventName === 'PreToolUse' && !str(ev.tool_use_id))) return block('EVENT_SCHEMA_INVALID');
    log.tool = safe(ev.tool_name);
    if (!str(adapterPath) || !/^[a-zA-Z]:\\/.test(adapterPath)) return block('ADAPTER_PATH_NOT_ABSOLUTE');
    const r = spawn(process.execPath, [adapterPath], { input: raw, encoding: 'utf8', timeout: childTimeoutMs, maxBuffer: MAX_STDIN, windowsHide: true, env: { ...Object.fromEntries(ENV_KEEP.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])), CLAUDE_PROJECT_DIR: projectDir ?? '' } });
    const cls = classifyAdapter(eventName, r);
    log.adapter = cls;
    log.adapter_status = r && (r.error ? `error:${safe(r.error.code || r.error.message)}` : r.signal ? `signal:${r.signal}` : r.status);
    if (eventName === 'PermissionRequest') return block(`PERMISSION_REQUEST_PILOT_DENY_${cls}`); // pilot: never auto-grant a permission dialog
    if (cls === 'DENY' && GRANTABLE.includes(ev.tool_name) && typeof grantCheck === 'function') { // Bash / PowerShell / Agent / MCP never get here
      let g = null;
      try { g = grantCheck(ev); } catch { g = null; }
      log.grant = g && g.result === 'MATCH' ? 'MATCH' : 'DENY';
      if (g && g.result === 'MATCH' && g.allow === false && g.authority === 'NONE' && typeof g.grant_id === 'string' && GRANT_ID_RE.test(g.grant_id)) return { exitCode: 0, stdout: grantAskJson(g.grant_id), stderr: '', log };
    }
    if (cls !== 'NO_OPINION') return block(`ADAPTER_${cls}`); // DENY, ASK (never auto-allowed here) and INVALID all block
    if (ev.tool_name !== 'Read') return block('NO_OPINION_NOT_VERIFIED_READ_ONLY_TOOL'); // Glob/Grep/others: scope cannot be verified here
    const pc = checkReadPath(ev.tool_input.file_path, projectDir);
    log.path = pc.code;
    if (!pc.ok) return block(`READ_PATH_${pc.code}`);
    log.reason = 'VERIFIED_READ_ONLY_NO_OPINION';
    return { exitCode: 0, stdout: '', stderr: '', log };
  } catch (e) {
    return block('WRAPPER_INTERNAL_ERROR');
  }
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (name) => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : undefined; };
  const expectEvent = opt('--event') ?? null;
  const t = opt('--child-timeout-ms');
  let out;
  try {
    out = decide(readLimited(), { adapterPath: argv[0], expectEvent, childTimeoutMs: t === undefined ? 5000 : Number(t) });
  } catch {
    out = decide(null, { adapterPath: argv[0], expectEvent }); // unreadable stdin: same protocol rules as any other block
  }
  try { if (process.env.HOOKLOG) appendFileSync(process.env.HOOKLOG, JSON.stringify({ ts: Date.now(), ...out.log, exit: out.exitCode, stdout_bytes: out.stdout.length }) + '\n'); } catch { /* logging never changes the decision */ }
  try { if (out.stderr) writeSync(2, out.stderr); if (out.stdout) writeSync(1, out.stdout); } catch { /* a failed write must not turn a block into a pass: exit code still set below */ }
  process.exitCode = out.exitCode;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
