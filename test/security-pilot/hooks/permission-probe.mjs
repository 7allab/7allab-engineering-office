// PermissionRequest probe for the S1/S2 live test (sandbox use only). Not an authorization source.
//   --mode observe             : write a marker, take NO decision (the production guard decides in S1).
//   --mode allow-fixture-write : allow ONLY the exact synthetic Write fixture (tool, path, content, cwd); deny everything else.
// Fail-closed: bad arguments -> exit 2 with no stdout. In allow mode every other problem (unparsable/oversize/unexpected input,
// an unexpected internal error, a marker write failure) yields an EXPLICIT deny JSON with exit 0, never an allow and never an
// ambiguous "no decision". In observe mode a marker write failure -> exit 2 with no stdout (the production guard still decides).
// Matching is EXACT string equality on printable ASCII after ASCII-only case folding: no path resolution, no Unicode folding
// (U+212A KELVIN SIGN would otherwise fold to "k"), so ADS, 8.3 names, UNC/extended prefixes, drive-relative and dot-segment
// forms cannot alias the target.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODES = Object.freeze(['observe', 'allow-fixture-write']);
const WORK = 'c:\\work';
const PATHS = Object.freeze(['mock-write-target.txt', 'c:\\work\\mock-write-target.txt']); // relative (mock) or absolute form
const CONTENT = 'synthetic-mock-content';
const MAX_STDIN = 64 * 1024;
const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

const none = (reason) => ({ decision: 'none', reason });
const deny = (reason) => ({ decision: 'deny', reason });
const asciiLower = (s) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

export function decide(mode, event) {
  try {
    if (typeof mode !== 'string' || !MODES.includes(mode)) return deny('MODE_INVALID');
    if (mode === 'observe') return none('OBSERVE_ONLY');
    if (!event || typeof event !== 'object' || Array.isArray(event)) return deny('EVENT_NOT_OBJECT');
    if (event.hook_event_name !== 'PermissionRequest') return deny('EVENT_NAME_UNEXPECTED');
    if (event.tool_name !== 'Write') return deny('TOOL_NOT_ALLOWED');
    const cwd = event.cwd;
    if (typeof cwd !== 'string' || !PRINTABLE_ASCII.test(cwd) || asciiLower(cwd) !== WORK) return deny('CWD_NOT_ALLOWED');
    const input = event.tool_input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return deny('TOOL_INPUT_INVALID');
    if (Object.keys(input).sort().join(',') !== 'content,file_path') return deny('TOOL_INPUT_KEYS_UNEXPECTED');
    if (typeof input.file_path !== 'string' || typeof input.content !== 'string') return deny('TOOL_INPUT_TYPES_INVALID');
    if (input.content !== CONTENT) return deny('CONTENT_NOT_ALLOWED');
    if (!PRINTABLE_ASCII.test(input.file_path) || !PATHS.includes(asciiLower(input.file_path))) return deny('PATH_NOT_ALLOWED');
    return { decision: 'allow', reason: 'EXACT_FIXTURE_WRITE' };
  } catch {
    return deny('DECIDE_INTERNAL_ERROR');
  }
}

const denyJson = (reason) => JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest',
  decision: { behavior: 'deny', message: `permission-probe denied: ${reason}` } } });

function parseArguments(args) {
  if (args.length === 4 && args[0] === '--mode' && MODES.includes(args[1]) && args[2] === '--event' && args[3] === 'PermissionRequest') {
    return { mode: args[1] };
  }
  return null;
}

export function runCli(args = process.argv.slice(2)) {
  const parsed = parseArguments(args);
  if (!parsed) { process.stderr.write('FAIL_CLOSED=USAGE\n'); process.exitCode = 2; return; }
  let raw = Buffer.alloc(0);
  try { raw = readFileSync(0); } catch { /* no stdin: treated as empty input */ }
  let event = null, parseOk = false;
  const oversize = raw.length > MAX_STDIN;
  if (!oversize) {
    try { event = JSON.parse(raw.toString('utf8')); parseOk = true; } catch { event = null; }
  }
  const outcome = oversize ? (parsed.mode === 'observe' ? none('STDIN_TOO_LARGE') : deny('STDIN_TOO_LARGE'))
    : (!parseOk && parsed.mode !== 'observe' ? deny('STDIN_NOT_JSON') : decide(parsed.mode, event));
  const object = event && typeof event === 'object' && !Array.isArray(event) ? event : {};
  const input = object.tool_input && typeof object.tool_input === 'object' && !Array.isArray(object.tool_input) ? object.tool_input : {};
  const record = {
    ts: Date.now(), hook: 'permission-probe', mode: parsed.mode, pid: process.pid,
    hook_event_name: typeof object.hook_event_name === 'string' ? object.hook_event_name : null,
    tool_name: typeof object.tool_name === 'string' ? object.tool_name : null,
    cwd: typeof object.cwd === 'string' ? object.cwd.slice(0, 260) : null,
    file_path: typeof input.file_path === 'string' ? input.file_path.slice(0, 260) : null,
    stdin_bytes: raw.length, stdin_sha256: createHash('sha256').update(raw).digest('hex'),
    parse_ok: parseOk, decision: outcome.decision, reason: outcome.reason,
  };
  try {
    const dir = process.env.PILOT_EVIDENCE_DIR ?? 'C:\\evidence';
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'permission-marker.log'), JSON.stringify(record) + '\n');
  } catch {
    process.stderr.write('FAIL_CLOSED=MARKER_WRITE_FAILED\n');
    if (parsed.mode === 'allow-fixture-write') { process.stdout.write(denyJson('MARKER_WRITE_FAILED')); process.exitCode = 0; }
    else process.exitCode = 2;
    return;
  }
  if (outcome.decision === 'allow') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }));
  } else if (outcome.decision === 'deny') {
    process.stdout.write(denyJson(outcome.reason));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
