// Office manifest (LIFE-010, E6): SHA-256 of the Owner-only governance and guard files, generated and compared by the Owner.
// KAZA ONLEYICI KONTROLDUR, DUSMANA KARSI SINIR DEGILDIR. Ajanin yazabildigi bir yerde tutulan manifest, dosyalarla
// birlikte yeniden uretilebilir: manifest dosyasini calisma agaci DISINDA tutun (or. Office deposu veya %USERPROFILE%).
// The script only reads the listed files (lstat, never follows a link) and writes only the manifest path it is given.
//
// Usage: node office-manifest.mjs generate <manifest.json> [--root <dir>]
//        node office-manifest.mjs verify   <manifest.json> [--root <dir>]
// --root defaults to the current directory.
// Exit:  0 = manifest written / all entries identical, 1 = differences found, 2 = usage or I/O error.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync, readdirSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORMAT = 'office-manifest/1';
const BOM = new RegExp('^' + String.fromCharCode(0xfeff)); // a leading UTF-8 byte order mark
export const FIXED_FILES = Object.freeze([
  'AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/hooks/scope-guard.mjs', 'scripts/guard-scope.mjs', '.git/config',
]);
export const AGENTS_DIR = '.claude/agents';

// Fixed list + every *.md directly in .claude/agents (sorted), so a new or removed agent definition shows up as a difference.
export function listFiles(root) {
  let agents = [];
  try {
    agents = readdirSync(join(root, AGENTS_DIR), { withFileTypes: true })
      .filter((d) => d.name.toLowerCase().endsWith('.md'))
      .map((d) => `${AGENTS_DIR}/${d.name}`);
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
  }
  return [...FIXED_FILES, ...agents.sort()];
}

// One file -> one value. Not a regular file is recorded as such and never hashed through a link.
export function hashEntry(root, rel) {
  const p = join(root, ...rel.split('/'));
  let st;
  try { st = lstatSync(p); } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return 'MISSING';
    throw e;
  }
  if (st.isSymbolicLink()) return 'SYMLINK';
  if (!st.isFile()) return 'NOT_A_FILE';
  const h = 'sha256:' + createHash('sha256').update(readFileSync(p)).digest('hex');
  return st.nlink > 1 ? `${h} HARDLINK` : h;
}

export function computeManifest(root, now = new Date()) {
  const files = {};
  for (const rel of listFiles(root)) files[rel] = hashEntry(root, rel);
  return { format: FORMAT, generated: now.toISOString(), files };
}

// Differences between two manifests: [{ path, expected, actual }], sorted by path. Empty array = identical.
export function compareManifest(expected, actual) {
  if (expected?.format !== FORMAT || typeof expected.files !== 'object' || expected.files === null) throw new Error('not an office manifest');
  const e = expected.files, a = actual.files;
  const paths = [...new Set([...Object.keys(e), ...Object.keys(a)])].sort();
  return paths.filter((p) => e[p] !== a[p]).map((p) => ({ path: p, expected: e[p] ?? 'ABSENT', actual: a[p] ?? 'ABSENT' }));
}

const kindOf = (d) => (d.expected === 'ABSENT' ? 'ADDED' : d.actual === 'ABSENT' || d.actual === 'MISSING' ? 'MISSING' : 'CHANGED');

export function cli(argv, out = process.stdout, err = process.stderr) {
  const [cmd, manifestPath, ...rest] = argv;
  let root = process.cwd();
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--root' && rest[i + 1]) { root = rest[++i]; continue; }
    err.write(`unknown argument: ${rest[i]}\n`); return 2;
  }
  if (!['generate', 'verify'].includes(cmd) || !manifestPath) {
    err.write('usage: node office-manifest.mjs generate|verify <manifest.json> [--root <dir>]\n'); return 2;
  }
  root = resolve(root);
  const mp = resolve(manifestPath);
  try {
    if (cmd === 'generate') {
      if (mp.toLowerCase().startsWith(root.toLowerCase() + sep)) err.write('WARNING: manifest is inside the work tree; keep it outside so an agent cannot rewrite it\n');
      const m = computeManifest(root);
      writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
      out.write(`WROTE ${mp} (${Object.keys(m.files).length} entries)\n`);
      return 0;
    }
    const expected = JSON.parse(readFileSync(mp, 'utf8').replace(BOM, ''));
    const diffs = compareManifest(expected, computeManifest(root));
    for (const d of diffs) out.write(`${kindOf(d)} ${d.path} expected=${d.expected} actual=${d.actual}\n`);
    out.write(diffs.length ? `DIFFERENT ${diffs.length} entr${diffs.length === 1 ? 'y' : 'ies'}\n` : `OK ${Object.keys(expected.files).length} entries identical\n`);
    return diffs.length ? 1 : 0;
  } catch (e) {
    err.write(`ERROR: ${e.message}\n`); return 2;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]).toLowerCase() === resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (isMain) process.exitCode = cli(process.argv.slice(2));
