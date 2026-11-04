// Offline authority-grant matcher (prototype, K2-04-D2B-2A). NOT integrated into guard / adapter / identity-gate, NOT installed.
// Question answered: "does one grant record formally match this hook event?" Results are MATCH or DENY, nothing else.
// MATCH is NOT allow, NOT execute and NOT human approval: no ledger is OS-protected yet, issuer / authority_ref are unverified strings,
// and every result carries allow:false, authority:'NONE'. Read-only: the only I/O is readFileSync (ledger) + realpath/lstat (via guard-scope).
// Model-supplied claims (approved, authorized, grant, permission_mode ...) are never read as input; they are only listed in ignored_claims.
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { classifyPath } from './guard-scope.mjs';

export const AUTHORITY = Object.freeze({ implemented: false, source: 'NONE' });
export const LEDGER_SCHEMA = '7allab-authority-grants/1';
export const LIMITS = Object.freeze({ ledgerBytes: 262144, grants: 256, windowSeconds: 14400, contentBytes: 1048576, commandChars: 512 });
const EVENTS = ['PreToolUse', 'PermissionRequest'];
const TOOLS = ['Write', 'Edit', 'Bash'];
const SCOPE_KEYS = { Write: ['file_path', 'content_sha256'], Edit: ['file_path', 'old_string_sha256', 'new_string_sha256', 'replace_all'], Bash: ['command_sha256', 'cwd'] };
const GRANT_KEYS = ['grant_id', 'issuer', 'authority_ref', 'issued_at', 'expires_at', 'project_root', 'tool', 'scope'];
const CLAIM_KEYS = new Set(['origin', 'trust', 'trusted', 'authorized', 'authorized_human', 'authorization', 'authorization_ref', 'reviewer_kind', 'approved', 'approved_by', 'approval', 'human_approved', 'permission_mode', 'grant', 'grant_id', 'allow', 'allowed']);
const SAFE_COMMAND = /^[A-Za-z0-9 _.:\\/=,+@-]+$/; // no & | ; < > ^ % $ ` ( ) quotes, ! or newlines. Hygiene only: NOT a confinement of what the command does.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = 4096) => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const lc = (s) => s.toLowerCase();
const norm = (s) => s.replace(/\//g, '\\').replace(/\\+$/, '');
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const keysAre = (o, ks) => isObj(o) && Object.keys(o).sort().join() === [...ks].sort().join();
const HEX = /^[0-9a-f]{64}$/;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const tsOk = (s) => typeof s === 'string' && TS.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 19) + 'Z' === s;
const absDrive = (p) => str(p) && /^[a-zA-Z]:[\\/]/.test(p);

const result = (res, code, extra = {}) => ({ result: res, code, grant_id: null, allow: false, authority: 'NONE', human_approval: 'NOT_EVALUATED', integrity: 'LEDGER_SOURCE_NOT_VERIFIED', implemented: false, ignored_claims: [], ...extra, allow: false, authority: 'NONE' });

// ---- the one PreToolUse "ask" shape the future guard may emit and identity-gate may accept (canonical bytes, nothing else).
// Only guard.mjs's injected-grantCheck branch calls grantAskJson; no production entry point does (see docs/P4_TRUST_BOUNDARY.md).
export const GRANT_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const GRANT_ASK_RE = /^\{"hookSpecificOutput":\{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"GRANT:([A-Za-z0-9._-]{1,64})"\}\}$/;
export function grantAskJson(grantId) {
  if (typeof grantId !== 'string' || !GRANT_ID_RE.test(grantId)) throw new Error('invalid grant id');
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `GRANT:${grantId}` } });
}
export const isGrantAskJson = (text) => typeof text === 'string' && GRANT_ASK_RE.test(text);

// JSON.parse keeps the LAST of two equal keys silently. This scans text that JSON.parse has ALREADY accepted (so it is not a parser:
// no grammar to get wrong) and reports a key repeated inside one object. Keys are decoded with JSON.parse, so "tool" == "tool".
export function hasDuplicateKeys(text) {
  const st = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') { if (text[j] === '\\') j++; j++; }
      if (j >= text.length) throw new Error('unterminated string');
      const top = st[st.length - 1];
      if (top && top.obj && top.key) {
        const k = JSON.parse(text.slice(i, j + 1));
        if (top.seen.has(k)) return true;
        top.seen.add(k); top.key = false;
      }
      i = j;
    } else if (c === '{') st.push({ obj: true, key: true, seen: new Set() });
    else if (c === '[') st.push({ obj: false });
    else if (c === '}' || c === ']') st.pop();
    else if (c === ',' && st.length && st[st.length - 1].obj) st[st.length - 1].key = true;
  }
  return false;
}

// ---- ledger: strict JSON object { schema, grants: [ ... ] }; any malformed record invalidates the whole ledger (fail closed).
export function parseLedger(text) {
  const bad = (code) => ({ ok: false, code });
  if (typeof text !== 'string') return bad('LEDGER_NOT_TEXT');
  if (Buffer.byteLength(text, 'utf8') > LIMITS.ledgerBytes) return bad('LEDGER_TOO_LARGE');
  const body = text.replace(/^﻿/, '');
  let j;
  try { j = JSON.parse(body); } catch { return bad('LEDGER_NOT_JSON'); }
  try { if (hasDuplicateKeys(body)) return bad('LEDGER_DUPLICATE_KEY'); } catch { return bad('LEDGER_DUPLICATE_KEY_CHECK_FAILED'); }
  if (!keysAre(j, ['schema', 'grants']) || j.schema !== LEDGER_SCHEMA || !Array.isArray(j.grants)) return bad('LEDGER_SCHEMA_INVALID');
  if (j.grants.length > LIMITS.grants) return bad('LEDGER_TOO_MANY_GRANTS');
  const seen = new Set();
  for (const g of j.grants) {
    const code = checkGrant(g);
    if (code) return bad(code);
    const id = lc(g.grant_id);
    if (seen.has(id)) return bad('DUPLICATE_GRANT_ID');
    seen.add(id);
  }
  return { ok: true, grants: j.grants };
}

function checkGrant(g) {
  if (!keysAre(g, GRANT_KEYS)) return 'GRANT_KEYS_INVALID';
  if (typeof g.grant_id !== 'string' || !GRANT_ID_RE.test(g.grant_id)) return 'GRANT_ID_INVALID';
  if (!str(g.issuer, 128) || !str(g.authority_ref, 256) || /[\p{Cc}\p{Cf}]/u.test(g.issuer + g.authority_ref)) return 'GRANT_TEXT_FIELD_INVALID';
  if (!tsOk(g.issued_at) || !tsOk(g.expires_at)) return 'GRANT_TIMESTAMP_INVALID';
  const span = (Date.parse(g.expires_at) - Date.parse(g.issued_at)) / 1000;
  if (!(span > 0 && span <= LIMITS.windowSeconds)) return 'GRANT_WINDOW_INVALID';
  if (!absDrive(g.project_root)) return 'GRANT_ROOT_INVALID';
  if (!TOOLS.includes(g.tool)) return 'GRANT_TOOL_UNKNOWN';
  const s = g.scope;
  if (!keysAre(s, SCOPE_KEYS[g.tool])) return 'GRANT_SCOPE_KEYS_INVALID';
  for (const k of Object.keys(s)) {
    if (k === 'replace_all' ? typeof s[k] !== 'boolean' : k.endsWith('_sha256') ? !(typeof s[k] === 'string' && HEX.test(s[k])) : !absDrive(s[k])) return 'GRANT_SCOPE_VALUE_INVALID';
  }
  return null;
}

export function loadLedgerText(path, { read = readFileSync } = {}) {
  try {
    const b = read(path);
    if (!Buffer.isBuffer(b)) return { ok: false, code: 'LEDGER_UNREADABLE' };
    if (b.length > LIMITS.ledgerBytes) return { ok: false, code: 'LEDGER_TOO_LARGE' };
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(b) };
  } catch { return { ok: false, code: 'LEDGER_UNREADABLE' }; }
}

// ---- the project root must be a real directory whose given spelling IS its real path (no junction / symlink / 8.3 in any component).
function rootReal(root, f) {
  if (!absDrive(root) || /[\p{Cc}\p{Cf}]/u.test(root) || root !== root.normalize('NFKC') || root !== root.trim() || /^[\\/]{2}/.test(root) || root.slice(2).includes(':') || /[*?<>|"]|~\d/.test(root)) return null;
  const given = norm(root);
  if (given.length <= 3) return null; // never a bare drive
  try {
    const real = norm(f.realpath(given));
    return f.lstat(real).isDirectory() && lc(real) === lc(given) ? real : null;
  } catch { return null; }
}

function ignoredClaims(v, path = '', depth = 0, out = []) {
  if (!isObj(v) && !Array.isArray(v)) return out;
  if (depth > 6 || out.length >= 20) return out;
  for (const [k, x] of Object.entries(v)) {
    if (CLAIM_KEYS.has(k.toLowerCase())) out.push(`${path}${k}`);
    ignoredClaims(x, `${path}${k}.`, depth + 1, out);
  }
  return out;
}

function checkInput(tool, ti) {
  if (!isObj(ti)) return 'TOOL_INPUT_INVALID';
  const only = (allowed, required) => Object.keys(ti).every((k) => allowed.includes(k)) && required.every((k) => k in ti);
  if (tool === 'Write') return only(['file_path', 'content'], ['file_path', 'content']) && typeof ti.content === 'string' && Buffer.byteLength(ti.content, 'utf8') <= LIMITS.contentBytes ? null : 'TOOL_INPUT_KEYS_INVALID';
  if (tool === 'Edit') return only(['file_path', 'old_string', 'new_string', 'replace_all'], ['file_path', 'old_string', 'new_string']) && typeof ti.old_string === 'string' && typeof ti.new_string === 'string' && (ti.replace_all === undefined || typeof ti.replace_all === 'boolean') && Buffer.byteLength(ti.old_string + ti.new_string, 'utf8') <= LIMITS.contentBytes ? null : 'TOOL_INPUT_KEYS_INVALID';
  if (!only(['command', 'description', 'timeout', 'run_in_background'], ['command'])) return 'TOOL_INPUT_KEYS_INVALID'; // Bash
  if (typeof ti.command !== 'string' || ti.command.length > LIMITS.commandChars || !SAFE_COMMAND.test(ti.command) || ti.command !== ti.command.trim()) return 'BASH_COMMAND_NOT_SIMPLE';
  if (ti.run_in_background !== undefined && ti.run_in_background !== false) return 'BASH_BACKGROUND_NOT_ALLOWED';
  if (ti.description !== undefined && (typeof ti.description !== 'string' || ti.description.length > 1024)) return 'TOOL_INPUT_KEYS_INVALID';
  if (ti.timeout !== undefined && !(Number.isInteger(ti.timeout) && ti.timeout > 0 && ti.timeout <= 600000)) return 'TOOL_INPUT_KEYS_INVALID';
  return null;
}

function pathCode(c) { return c.scope === 'INSIDE_VERIFIED' ? (c.sensitive_name ? 'PATH_SENSITIVE_NAME' : null) : c.code.startsWith('PATH_') ? c.code : `PATH_${c.code}`; }

function checkCandidate(g, event, root, now, f) {
  const t0 = Date.parse(g.issued_at), t1 = Date.parse(g.expires_at);
  if (now < t0) return 'GRANT_NOT_YET_VALID';
  if (now >= t1) return 'GRANT_EXPIRED';
  const gr = rootReal(g.project_root, f);
  if (!gr) return 'GRANT_ROOT_UNVERIFIABLE';
  if (lc(gr) !== lc(root)) return 'PROJECT_MISMATCH';
  const ti = event.tool_input, s = g.scope;
  if (g.tool === 'Bash') {
    if (sha(ti.command) !== s.command_sha256) return 'COMMAND_HASH_MISMATCH';
    const [ce, cg] = [classifyPath(event.cwd, root, { fs: f }), classifyPath(s.cwd, root, { fs: f })];
    for (const c of [ce, cg]) { const k = pathCode(c) || (c.entry !== 'dir' ? 'PATH_CWD_NOT_A_DIRECTORY' : null); if (k) return k; }
    return lc(ce.real) === lc(cg.real) ? null : 'CWD_MISMATCH';
  }
  const [pe, pg] = [classifyPath(ti.file_path, root, { intent: 'write', fs: f }), classifyPath(s.file_path, root, { intent: 'write', fs: f })];
  for (const c of [pe, pg]) { const k = pathCode(c) || (c.exists && c.entry !== 'file' ? 'PATH_NOT_A_FILE' : null); if (k) return k; }
  if (lc(pe.real) !== lc(pg.real)) return 'PATH_MISMATCH';
  if (g.tool === 'Write') return sha(ti.content) === s.content_sha256 ? null : 'CONTENT_HASH_MISMATCH';
  if (!pe.exists) return 'EDIT_TARGET_MISSING';
  if (sha(ti.old_string) !== s.old_string_sha256 || sha(ti.new_string) !== s.new_string_sha256) return 'CONTENT_HASH_MISMATCH';
  return (ti.replace_all === true) === s.replace_all ? null : 'REPLACE_ALL_MISMATCH';
}

// event: the hook event as the host sends it. ledgerText: raw ledger. projectRoot: the host-supplied project root (CLAUDE_PROJECT_DIR in the
// future integration; this module never reads the environment). now: ms since epoch. fs: {realpath, lstat} for tests.
export function evaluate(event, ledgerText, { projectRoot, now = Date.now(), fs } = {}) {
  let claims = [];
  try {
    const f = fs ?? { realpath: realpathSync.native, lstat: lstatSync };
    if (isObj(event)) claims = ignoredClaims({ ...event, tool_input: isObj(event.tool_input) ? event.tool_input : undefined });
    const deny = (code) => result('DENY', code, { ignored_claims: claims });
    if (!isObj(event) || !EVENTS.includes(event.hook_event_name)) return deny('EVENT_NOT_SUPPORTED');
    if (!str(event.tool_name) || !TOOLS.includes(event.tool_name)) return deny('TOOL_NOT_GRANTABLE');
    if (!Number.isFinite(now)) return deny('CLOCK_INVALID');
    const led = parseLedger(ledgerText);
    if (!led.ok) return deny(led.code);
    const root = rootReal(projectRoot, f);
    if (!root) return deny('PROJECT_ROOT_UNVERIFIABLE');
    const bad = checkInput(event.tool_name, event.tool_input);
    if (bad) return deny(bad);
    if (event.tool_name === 'Bash' && !absDrive(event.cwd)) return deny('CWD_NOT_ABSOLUTE');
    const cands = led.grants.filter((g) => g.tool === event.tool_name);
    if (!cands.length) return deny('NO_GRANT_FOR_TOOL');
    const matched = [], codes = [];
    for (const g of cands) { const k = checkCandidate(g, event, root, now, f); if (k) codes.push(k); else matched.push(g.grant_id); }
    if (!matched.length) return deny(codes[codes.length - 1]);
    return result('MATCH', 'FORMAL_MATCH_ONLY', { grant_id: matched[0], matched_count: matched.length, ignored_claims: claims, ...(event.tool_name === 'Bash' ? { bash_confinement: 'NOT_PROVIDED' } : {}) });
  } catch {
    return result('DENY', 'AUTHORITY_CHECK_INTERNAL_ERROR', { ignored_claims: claims });
  }
}

export function evaluateFile(event, ledgerPath, opts = {}) {
  const l = loadLedgerText(ledgerPath, opts);
  return l.ok ? evaluate(event, l.text, opts) : result('DENY', l.code);
}
