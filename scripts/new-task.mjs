// Copies docs/tasks/_TEMPLATE.md to docs/tasks/<ID>.md under <root> (default: cwd). Never overwrites an existing task file.
import { copyFileSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';

const USAGE = 'Usage: node scripts/new-task.mjs <ID> [--root <dir>]   (ID like OFFICE-001)';
const fail = (msg) => { process.stderr.write(`${msg}\n`); process.exit(1); };

const args = process.argv.slice(2);
const positional = [];
let root = process.cwd();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--root') {
    const v = args[++i];
    if (v === undefined || v === '' || v.startsWith('-')) fail(`--root requires a directory value.\n${USAGE}`);
    root = resolve(v);
  } else if (a.startsWith('-')) {
    fail(`Unknown argument: ${a}\n${USAGE}`);
  } else {
    positional.push(a);
  }
}
if (positional.length === 0) fail(USAGE);
if (positional.length > 1) fail(`Too many positional arguments.\n${USAGE}`);

const id = positional[0];
if (!/^[A-Z]+-\d{3}$/.test(id)) fail(`Invalid task ID: ${JSON.stringify(id)} (expected like OFFICE-001).`);

const dir = join(root, 'docs', 'tasks');
const src = join(dir, '_TEMPLATE.md');
const dest = join(dir, `${id}.md`);
try {
  copyFileSync(src, dest, constants.COPYFILE_EXCL);
} catch (e) {
  if (e.code === 'EEXIST') fail(`Task file already exists, not overwritten: ${dest}`);
  if (e.code === 'ENOENT') fail(`Template or directory not found: ${src}`);
  fail(`Could not create task file: ${e.code ?? e.message}`);
}
process.stdout.write(`${dest}\n`);
