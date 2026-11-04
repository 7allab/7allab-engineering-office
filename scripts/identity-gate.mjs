// Identity gate (prototype, K2-04-D2B-1, NOT installed). Machine-wide managed hooks must not block the developer account:
// crypt -> exit 0 and NO stdout (no decision, normal permission flow); cc-agent -> delegated unchanged to scripts/guard.mjs;
// every other SID, and every identity/guard failure -> DENY. It never emits allow / ask / updatedInput.
// argv: <guard.mjs absolute> <adapter.mjs> --event PreToolUse|PermissionRequest [--child-timeout-ms N]  (all after argv[0] go to guard verbatim)
// Identity comes only from C:\Windows\System32\whoami.exe (process token). No env / argv / stdin / project setting can select a SID.
import { readSync, writeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { isGrantAskJson } from './authority-grant.mjs';

export const CRYPT_SID = 'S-1-5-21-2587344737-3047673138-827517886-1001';
export const CC_AGENT_SID = 'S-1-5-21-2587344737-3047673138-827517886-1009';
export const WHOAMI = 'C:\\Windows\\System32\\whoami.exe';
export const MAX_STDIN = 1048576;
const WHOAMI_TIMEOUT_MS = 2000; // whoami + guard (<= 6.5 s) must stay under the 10 s hook timeout
const GUARD_TIMEOUT_MS = 6500;
const EVENTS = ['PreToolUse', 'PermissionRequest'];
const SID_LINE = /^"[^"\r\n]+","(S-1-5-21-\d{1,10}-\d{1,10}-\d{1,10}-\d{1,10})"\r?\n?$/; // exactly one CSV row: "DOMAIN\name","SID"
const GUARD_MSG = /^BLOCKED\(wrapper\): [A-Z0-9_]+$/; // the only text guard.mjs ever puts on stderr / in a deny message
const ENV_KEEP = ['SystemRoot', 'windir', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'COMSPEC', 'CLAUDE_PROJECT_DIR']; // no NODE_OPTIONS, no HOOKLOG
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const keysOnly = (o, ks) => isObj(o) && Object.keys(o).sort().join() === [...ks].sort().join();

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

export function resolveSid(spawn = spawnSync) {
  const r = spawn(WHOAMI, ['/user', '/fo', 'csv', '/nh'], { shell: false, encoding: 'utf8', timeout: WHOAMI_TIMEOUT_MS, maxBuffer: 4096, windowsHide: true, env: { SystemRoot: 'C:\\Windows' } });
  if (!r || r.error || r.signal || r.status !== 0 || typeof r.stdout !== 'string' || (r.stderr ?? '') !== '') return { ok: false, code: 'WHOAMI_FAILED' };
  const m = SID_LINE.exec(r.stdout);
  return m ? { ok: true, sid: m[1] } : { ok: false, code: 'WHOAMI_OUTPUT_INVALID' };
}

// guard.mjs emits exactly: PreToolUse -> (0, '', '') | (2, '', BLOCKED(wrapper): CODE); PermissionRequest -> (0, deny JSON, '').
// Anything else (including an allow/ask JSON or a crash) is not a guard result and is turned into a DENY here.
// acceptGrantAsk (K2-04-D2B-2B, default false, never set by main()): additionally accept guard's one canonical PreToolUse grant "ask"
// (0, authority-grant.isGrantAskJson, ''). Nothing else changes; allow, other ask shapes and any PermissionRequest output stay rejected.
export function guardResultOk(event, r, { acceptGrantAsk = false } = {}) {
  if (!r || r.error || r.signal || typeof r.status !== 'number' || !Buffer.isBuffer(r.stdout) || !Buffer.isBuffer(r.stderr)) return false;
  let out, err;
  try { const d = new TextDecoder('utf-8', { fatal: true }); out = d.decode(r.stdout); err = d.decode(r.stderr); } catch { return false; }
  if (event === 'PreToolUse') {
    if (acceptGrantAsk === true && r.status === 0 && err === '' && isGrantAskJson(out)) return true;
    return out === '' && ((r.status === 0 && err === '') || (r.status === 2 && GUARD_MSG.test(err)));
  }
  if (r.status !== 0 || err !== '') return false;
  try {
    const j = JSON.parse(out);
    const h = j?.hookSpecificOutput;
    return out === JSON.stringify(j) && keysOnly(j, ['hookSpecificOutput']) && keysOnly(h, ['hookEventName', 'decision']) && h.hookEventName === 'PermissionRequest' && keysOnly(h.decision, ['behavior', 'message']) && h.decision.behavior === 'deny' && GUARD_MSG.test(h.decision.message);
  } catch { return false; }
}

export function decide(raw, { event, guardPath, guardArgs = [], resolve = resolveSid, spawn = spawnSync, acceptGrantAsk = false } = {}) {
  const block = (code) => event === 'PermissionRequest'
    ? { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: `BLOCKED(identity-gate): ${code}` } } }), stderr: '', reason: code }
    : { exitCode: 2, stdout: '', stderr: `BLOCKED(identity-gate): ${code}`, reason: code }; // unpinned event also gets the exit-2 form, like guard.mjs
  try {
    const id = resolve();
    if (!id || id.ok !== true) return block(id && id.code ? id.code : 'IDENTITY_UNRESOLVED');
    if (id.sid === CRYPT_SID) return { exitCode: 0, stdout: '', stderr: '', reason: 'CRYPT_EXEMPT_NO_DECISION' };
    if (id.sid !== CC_AGENT_SID) return block('SID_NOT_AUTHORIZED');
    if (!EVENTS.includes(event)) return block('EVENT_NOT_PINNED');
    if (!Buffer.isBuffer(raw)) return block('STDIN_TOO_LARGE_OR_UNREADABLE');
    if (typeof guardPath !== 'string' || !/^[a-zA-Z]:\\/.test(guardPath)) return block('GUARD_PATH_NOT_ABSOLUTE');
    const env = Object.fromEntries(ENV_KEEP.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
    const r = spawn(process.execPath, [guardPath, ...guardArgs], { input: raw, encoding: 'buffer', shell: false, timeout: GUARD_TIMEOUT_MS, maxBuffer: MAX_STDIN, windowsHide: true, env });
    if (!guardResultOk(event, r, { acceptGrantAsk })) return block('GUARD_UNEXPECTED_RESULT');
    return { exitCode: r.status, stdout: r.stdout, stderr: r.stderr, reason: 'DELEGATED_TO_GUARD' };
  } catch {
    return block('GATE_INTERNAL_ERROR');
  }
}

function main() {
  const [guardPath, ...guardArgs] = process.argv.slice(2);
  const k = guardArgs.indexOf('--event');
  let raw = null;
  try { raw = readLimited(); } catch { /* raw stays null: cc-agent is denied, crypt is still exempt */ }
  const out = decide(raw, { event: k >= 0 ? guardArgs[k + 1] : undefined, guardPath, guardArgs });
  try { if (out.stderr.length) writeSync(2, out.stderr); if (out.stdout.length) writeSync(1, out.stdout); } catch { /* exit code below still stands */ }
  process.exitCode = out.exitCode;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
