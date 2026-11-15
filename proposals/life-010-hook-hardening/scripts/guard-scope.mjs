// OFFLINE FILE-SCOPE CLASSIFIER (prototype, K2-03-B). It answers one question only: "can the file location named by this
// hook event be shown, by real-path resolution, to be inside the project root?". It is NOT a hook, NOT an authorization
// source and NEVER allows anything: every result carries allow:false, authority:'NONE', authorization:'NOT_EVALUATED'.
// It does not replace scripts/guard.mjs (unchanged); it does not read or write any state; it only uses fs.realpath / fs.lstat.
// Windows drive-letter paths only. Anything that cannot be decided exactly is UNVERIFIABLE, never "inside".
import { realpathSync, lstatSync } from 'node:fs';

export const SCOPES = Object.freeze(['INSIDE_VERIFIED', 'INSIDE_ROOT_ONLY', 'OUTSIDE_VERIFIED', 'UNVERIFIABLE']);
const RANK = { INSIDE_VERIFIED: 0, INSIDE_ROOT_ONLY: 1, OUTSIDE_VERIFIED: 2, UNVERIFIABLE: 3 }; // higher = less safe; the worst field wins

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim() !== '';
const lc = (s) => s.toLowerCase();
const norm = (s) => s.replace(/\//g, '\\').replace(/\\+$/, '');
const DEVICE = /^(con|prn|aux|nul|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
const SENSITIVE = /^(\.git|\.claude|\.ssh|\.aws|\.npmrc|\.netrc|\.env(\..*)?|id_(rsa|ed25519|ecdsa|dsa).*|.*\.(pem|key|pfx|p12))$/i;
const ENOENTLIKE = (e) => e && (e.code === 'ENOENT' || e.code === 'ENOTDIR');

// ---- one path -> one scope. intent 'write' tolerates a missing final path by resolving its nearest existing ancestor.
export function classifyPath(p, projectRoot, opts = {}) {
  const intent = opts.intent === 'write' ? 'write' : 'read';
  const f = opts.fs ?? { realpath: realpathSync.native, lstat: lstatSync };
  const U = (code, extra = {}) => ({ scope: 'UNVERIFIABLE', code, ...extra });
  try {
    if (!str(p) || p.length > 4096) return U('PATH_MISSING_OR_TOO_LONG');
    if (!str(projectRoot) || !/^[a-zA-Z]:[\\/]/.test(projectRoot)) return U('ROOT_NOT_ABSOLUTE');
    if (/[\p{Cc}\p{Cf}]/u.test(p) || p !== p.normalize('NFKC') || p !== p.trim()) return U('PATH_ODD_CHARS');
    if (/^[\\/]{2}/.test(p)) return U('UNC_OR_DEVICE_PATH');
    if (!/^[a-zA-Z]:[\\/]/.test(p)) return U('NOT_DRIVE_ABSOLUTE'); // relative, POSIX, drive-relative, rooted without a drive
    if (p.slice(2).includes(':')) return U('ALTERNATE_DATA_STREAM');
    if (/[*?<>|"]/.test(p)) return U('WILDCARD_OR_INVALID_CHAR');
    const segs = p.slice(3).split(/[\\/]+/).filter(Boolean);
    if (segs.some((s) => s === '.' || s === '..')) return U('DOT_SEGMENT');
    if (segs.some((s) => /[. ]$/.test(s))) return U('TRAILING_DOT_OR_SPACE');
    if (segs.some((s) => DEVICE.test(s))) return U('DEVICE_NAME');
    if (segs.some((s) => /~\d/.test(s))) return U('SHORT_NAME_8_3');

    const rootGiven = norm(projectRoot);
    let rootReal;
    try {
      rootReal = norm(f.realpath(rootGiven));
      if (!f.lstat(rootReal).isDirectory()) return U('ROOT_NOT_DIRECTORY');
    } catch { return U('ROOT_UNRESOLVABLE'); }

    const given = norm(p);
    const synIn = lc(given) === lc(rootGiven) || lc(given).startsWith(lc(rootGiven) + '\\');
    let real, exists = true, existingGiven = given;
    try {
      real = norm(f.realpath(given));
    } catch (e) {
      if (!ENOENTLIKE(e)) return U('PATH_CHECK_ERROR');
      if (intent !== 'write') return U('NOT_FOUND');
      let anc = given; const rest = [];
      for (;;) {
        const i = anc.lastIndexOf('\\');
        if (i < 3) return U('NO_EXISTING_ANCESTOR'); // never climb to a bare drive ("C:" means the drive's cwd)
        rest.unshift(anc.slice(i + 1)); anc = anc.slice(0, i);
        try {
          const ra = norm(f.realpath(anc));
          if (!f.lstat(ra).isDirectory()) return U('ANCESTOR_NOT_DIRECTORY');
          real = ra + '\\' + rest.join('\\'); exists = false; existingGiven = anc;
          break;
        } catch (e2) { if (!ENOENTLIKE(e2)) return U('PATH_CHECK_ERROR'); }
      }
    }

    const rr = lc(rootReal), lr = lc(real);
    const realIn = lr === rr || lr.startsWith(rr + '\\');
    if (!realIn) return { scope: 'OUTSIDE_VERIFIED', code: 'RESOLVES_OUTSIDE_PROJECT', via_link: synIn, real, exists };
    if (!synIn) return U('ALIASED_INTO_PROJECT', { real }); // reachable from outside the root by name: not provably "the project's own" file
    const expected = rootReal + given.slice(rootGiven.length);
    if (lc(real) !== lc(expected)) return U('ALIASED_INSIDE', { real }); // junction / symlink / 8.3 / mount alias inside the root
    let cur = rootReal;
    for (const s of existingGiven.slice(rootGiven.length).split('\\').filter(Boolean)) {
      cur += '\\' + s;
      if (f.lstat(cur).isSymbolicLink()) return U('REPARSE_POINT_COMPONENT');
    }
    let entry = null;
    if (exists) {
      const st = f.lstat(real);
      if (st.isFile()) { if (st.nlink > 1) return U('HARD_LINKED_FILE'); entry = 'file'; }
      else if (st.isDirectory()) entry = 'dir';
      else return U('NOT_REGULAR_FILE_OR_DIR');
    }
    const sensitive_name = given.slice(rootGiven.length).split('\\').filter(Boolean).some((s) => SENSITIVE.test(s));
    return { scope: 'INSIDE_VERIFIED', code: exists ? 'REAL_PATH_INSIDE' : 'NEW_PATH_IN_VERIFIED_DIR', real, exists, entry, sensitive_name };
  } catch {
    return U('PATH_CHECK_ERROR');
  }
}

// ---- one hook event -> one scope. cwd is reported as context but is NEVER the basis of a decision.
const FILE_FIELDS = ['file_path', 'notebook_path', 'path'];
const READERS = ['Read'];
const WRITERS = ['Write', 'Edit', 'NotebookEdit'];
const SEARCHERS = ['Glob', 'Grep'];
const SHELLS = ['Bash', 'PowerShell'];
const NOT_FILE_SCOPED = ['Agent', 'WebFetch', 'WebSearch', 'Skill', 'AskUserQuestion', 'ExitPlanMode', 'TodoWrite', 'Task'];

export function scopeOfEvent(event, { projectRoot, fs } = {}) {
  const out = (scope, code, extra = {}) => ({ scope, code, tool: null, allow: false, authority: 'NONE', authorization: 'NOT_EVALUATED', targets: [], context: {}, ...extra });
  try {
    if (!isObj(event) || !str(event.tool_name) || !isObj(event.tool_input)) return out('UNVERIFIABLE', 'MALFORMED_EVENT');
    const tool = event.tool_name, ti = event.tool_input;
    const cwdC = str(event.cwd) ? classifyPath(event.cwd, projectRoot, { fs }) : null;
    const context = { cwd: cwdC ? { scope: cwdC.scope, code: cwdC.code } : null, decided_by_cwd: false };
    const base = (scope, code, extra = {}) => out(scope, code, { tool, context, ...extra });
    const worst = (targets) => targets.reduce((a, t) => (RANK[t.scope] > RANK[a.scope] ? t : a), targets[0]);

    if (SHELLS.includes(tool)) {
      const cmd = typeof ti.command === 'string' ? ti.command : '';
      const lexical_paths = [...cmd.matchAll(/[A-Za-z]:[\\/][^\s"'<>|;&]*/g)].map((m) => m[0]).slice(0, 20);
      // a shell command can read or write anything its process can reach (pipes, variables, interpreters, encoded input): no path analysis bounds it
      return base('UNVERIFIABLE', 'SHELL_NOT_BOUNDABLE', { bounded: false, lexical_paths, lexical_paths_are_not_exhaustive: true });
    }
    if (READERS.includes(tool) || WRITERS.includes(tool)) {
      const intent = WRITERS.includes(tool) ? 'write' : 'read';
      const required = tool === 'NotebookEdit' ? 'notebook_path' : 'file_path';
      if (!str(ti[required])) return base('UNVERIFIABLE', 'REQUIRED_PATH_FIELD_MISSING');
      const targets = FILE_FIELDS.filter((k) => ti[k] !== undefined).map((k) => ({ field: k, ...classifyPath(ti[k], projectRoot, { intent, fs }) }));
      const w = worst(targets);
      return base(w.scope, w.code, { targets, intent });
    }
    if (SEARCHERS.includes(tool)) {
      const pat = tool === 'Glob' ? ti.pattern : ti.glob;
      const escapes = pat !== undefined && (typeof pat !== 'string' || /^([a-zA-Z]:|[\\/])/.test(pat.trim()) || pat.includes(':') || pat.split(/[\\/]/).some((s) => s.trim() === '..'));
      const rootPath = ti.path !== undefined ? ti.path : event.cwd; // with no path field the tool searches cwd: that IS its target, classified like any target
      if (ti.path === undefined) context.search_root_is_cwd = true;
      const c = { field: ti.path !== undefined ? 'path' : 'cwd', ...classifyPath(rootPath, projectRoot, { fs }) };
      if (escapes) return base('UNVERIFIABLE', 'PATTERN_ESCAPES', { targets: [c] });
      if (c.scope === 'INSIDE_VERIFIED' && c.entry === 'dir') return base('INSIDE_ROOT_ONLY', 'SEARCH_ROOT_INSIDE_CONTENTS_NOT_CHECKED', { targets: [c], contents_checked: false });
      return base(c.scope, c.code, { targets: [c] });
    }
    if (NOT_FILE_SCOPED.includes(tool) || tool.startsWith('mcp__')) return base('UNVERIFIABLE', 'NOT_FILE_SCOPED_TOOL');
    return base('UNVERIFIABLE', 'UNKNOWN_TOOL');
  } catch {
    return out('UNVERIFIABLE', 'SCOPE_CHECK_INTERNAL_ERROR');
  }
}

// ---- what a boundary failure turns into. There is no failure kind that is read as permission.
const FAILURE_KINDS = ['hook_error', 'timeout', 'invalid_output', 'missing_authority_record', 'unreadable_authority_record'];
export function failureDisposition(kind) {
  return { disposition: 'BLOCK', reason: FAILURE_KINDS.includes(kind) ? kind : 'UNKNOWN_FAILURE_KIND', allow: false, authority: 'NONE' };
}
