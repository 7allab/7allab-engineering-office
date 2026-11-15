// LIFE-010 F1 evidence tool (not deployed). Runs a hook file twice with the same denied event (an mcp__ write):
// once by its real path and once through a directory junction that points at the same folder. Prints exit code and output.
// A guard that exits 0 with no output through the junction is silently disabled (fail-open).
// Usage: node docs/tasks/LIFE-010-proposed/f1-evidence.mjs <hook-file>   (default: PREV-round1-scope-guard.mjs.txt)
// The hook text is copied into a fresh os.tmpdir() folder (with the unchanged classifier) and removed afterwards.
import { mkdirSync, mkdtempSync, copyFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const P = dirname(fileURLToPath(import.meta.url));
const hookSrc = process.argv[2] ? realpathSync(process.argv[2]) : join(P, 'PREV-round1-scope-guard.mjs.txt');
const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'life010-f1-')));
try {
  const real = join(base, 'real');
  mkdirSync(join(real, 'dot-claude', 'hooks'), { recursive: true }); mkdirSync(join(real, 'scripts'));
  copyFileSync(join(P, 'scripts', 'guard-scope.mjs'), join(real, 'scripts', 'guard-scope.mjs'));
  copyFileSync(hookSrc, join(real, 'dot-claude', 'hooks', 'scope-guard.mjs'));
  const link = join(base, 'via-junction');
  symlinkSync(real, link, 'junction');
  const event = JSON.stringify({ tool_name: 'mcp__plugin_desktop-commander_desktop-commander__write_file', tool_input: { path: 'C:\\x', content: 'y' } });
  const env = { ...process.env, SCOPE_GUARD_NO_LOG: '1' }; delete env.SCOPE_GUARD_NO_MAIN;
  console.log(`hook: ${hookSrc}`);
  for (const [label, dir] of [['real path', real], ['junction ', link]]) {
    const r = spawnSync(process.execPath, [join(dir, 'dot-claude', 'hooks', 'scope-guard.mjs'), base], { input: event, encoding: 'utf8', env });
    console.log(`${label}: exit=${r.status} stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr.trim())}`);
  }
} finally { rmSync(base, { recursive: true, force: true }); }
