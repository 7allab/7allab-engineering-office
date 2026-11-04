// Offline integrity + syntax check of THIS package only (K2-03-D). It runs nothing from the package, installs nothing,
// uses no network, and says nothing about enforcement: PASS here = "package files are well-formed and unchanged".
// Usage: node check-package.mjs [--write-manifest] [--self-test]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const MANIFEST = join(HERE, 'MANIFEST.sha256.json');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const rel = (p) => relative(HERE, p).split(sep).join('/');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const BS = String.fromCharCode(92);

// ---- pure validators (text in, problem list out) so --self-test can prove they reject bad input
export function checkWsb(x) {
  const p = [];
  for (const [t, v] of [['Networking', 'Disable'], ['ClipboardRedirection', 'Disable'], ['VGpu', 'Disable'], ['AudioInput', 'Disable'], ['VideoInput', 'Disable'], ['PrinterRedirection', 'Disable']]) {
    if (!new RegExp(`<${t}>${v}</${t}>`).test(x)) p.push(`${t} is not ${v}`);
  }
  const folders = x.match(/<MappedFolder>/g) ?? [];
  if (folders.length !== 1) p.push(`expected exactly 1 MappedFolder, got ${folders.length}`);
  if (!/<ReadOnly>true<\/ReadOnly>/.test(x) || /<ReadOnly>false<\/ReadOnly>/i.test(x)) p.push('mapped folder is not read-only');
  const hf = (x.match(/<HostFolder>(.*?)<\/HostFolder>/) ?? [])[1];
  if (hf !== '__HOST_PAYLOAD_DIR__') p.push('HostFolder must stay the placeholder in the repo draft');
  if (/Projeler|Users|\.claude|ProgramData/i.test(x.replace(/<!--[\s\S]*?-->/g, ''))) p.push('draft names a real host path');
  return p;
}
export function checkPolicy(name, text) {
  const p = [];
  let j; try { j = JSON.parse(text); } catch { return ['not JSON']; }
  // nested shape taken from the schema embedded in the installed claude.exe 2.1.312 (read-only string inspection, behaviour NOT run):
  // settings.hooks.<Event>[] = { matcher?: string, hooks: [ { type:'command', command, args?, timeout?(s), onFailure?('continue'|'block') } ] }
  const EVENTS = ['PreToolUse', 'PermissionRequest'], HOOK_KEYS = ['type', 'command', 'args', 'timeout', 'onFailure'];
  for (const k of Object.keys(j)) if (!['hooks', 'allowManagedHooksOnly'].includes(k)) p.push(`unexpected top-level key ${k}`);
  if (Object.hasOwn(j, 'allowManagedHooksOnly') && j.allowManagedHooksOnly !== true) p.push('allowManagedHooksOnly must be boolean true when present');
  if (!j.hooks || typeof j.hooks !== 'object' || Array.isArray(j.hooks)) return [...p, 'hooks must be an object keyed by event'];
  const hooks = [];
  for (const [ev, groups] of Object.entries(j.hooks)) {
    if (!EVENTS.includes(ev)) p.push(`unexpected event ${ev}`);
    if (!Array.isArray(groups) || groups.length === 0) { p.push(`${ev}: must be a non-empty array of matcher groups`); continue; }
    for (const g of groups) {
      if (g.matcher !== undefined && typeof g.matcher !== 'string') p.push(`${ev}: matcher must be a string`);
      if (!Array.isArray(g.hooks) || g.hooks.length === 0) { p.push(`${ev}: group.hooks must be a non-empty array (hooks nested inside the matcher group)`); continue; }
      for (const h of g.hooks) {
        hooks.push(h);
        for (const k of Object.keys(h)) if (!HOOK_KEYS.includes(k)) p.push(`${ev}: unexpected hook key ${k}`);
        if (h.type !== 'command') p.push(`${ev}: hook type must be command`);
        if (typeof h.command !== 'string' || !h.command.startsWith(`C:${BS}payload${BS}`) || h.command.includes('"')) p.push(`${ev}: command must be a bare C:\\payload path (exec form)`);
        if (!Array.isArray(h.args) || h.args.length === 0 || h.args.some((a) => typeof a !== 'string')) p.push(`${ev}: args must be a non-empty string array (a quoted-string command is not a program under PowerShell)`);
        else if (h.args.some((a) => /^[A-Za-z]:/.test(a) && !a.startsWith(`C:${BS}payload${BS}`))) p.push(`${ev}: arg path outside C:\\payload`);
        if (!Number.isInteger(h.timeout) || h.timeout < 1 || h.timeout > 30) p.push(`${ev}: timeout (seconds) missing/out of range`);
        if (h.onFailure !== undefined && !['continue', 'block'].includes(h.onFailure)) p.push(`${ev}: onFailure must be continue|block`);
      }
    }
  }
  if (hooks.length === 0) p.push('no hooks');
  if (name.startsWith('p1-') || name.startsWith('p2-')) {
    const pr = (j.hooks.PermissionRequest ?? []).flatMap((g) => g.hooks ?? []);
    if (!pr.some((h) => h.args?.includes('PermissionRequest'))) p.push('p1/p2 must register the guard for PermissionRequest');
  }
  const hasMo = Object.hasOwn(j, 'allowManagedHooksOnly');
  if (hasMo !== name.startsWith('p2-')) p.push('allowManagedHooksOnly must appear only in p2');
  const ofCount = hooks.filter((h) => h.onFailure === 'block').length;
  const wantOf = name.startsWith('p6-') ? 0 : name.startsWith('p1-') || name.startsWith('p2-') ? 2 : hooks.length;
  if (ofCount !== wantOf) p.push(`onFailure:block count ${ofCount}, expected ${wantOf}`);
  return p;
}
export function checkPs1(x) {
  const g = x.indexOf('WDAGUtilityAccount'), w = Math.min(...['Copy-Item', 'New-Item', 'Set-Content'].map((k) => (x.indexOf(k) < 0 ? Infinity : x.indexOf(k))));
  const m = x.indexOf('Win32_ComputerSystem');
  return g < 0 || g > w || m < 0 || m > w ? ['sandbox-only refusals (account + Hyper-V guest) must precede every write'] : [];
}
export function checkSecrets(text) {
  return [/sk-ant-/, /ANTHROPIC_(API_KEY|AUTH_TOKEN)\s*[=:]/, /Bearer\s+[A-Za-z0-9._-]{12,}/, /\.credentials/i, /oauth.?token/i, /C:[\\/]+Users[\\/]+crypt/i, /C:[\\/]+Projeler/i].filter((r) => r.test(text)).map((r) => `forbidden pattern ${r}`);
}
export function checkEvidenceTemplate(t, s) {
  const p = [];
  for (const k of s.run_required) if (!(k in t)) p.push(`run key ${k} missing`);
  if (t.auth_mode !== 'NONE') p.push('template auth_mode must start as NONE');
  if (!Array.isArray(t.observations) || t.observations.map((o) => o.id).join() !== 'O1,O2,O3,O4,O5,O6,O7') p.push('observations must be O1..O7');
  for (const o of t.observations ?? []) {
    for (const k of s.observation_required) if (!(k in o)) p.push(`${o.id}: ${k} missing`);
    if (o.status !== 'NOT_TESTED' || o.observed !== null || o.evidence_sha256 !== null) p.push(`${o.id}: template must be empty/NOT_TESTED`);
    if (!s.max_claim_enum.includes(o.max_claim) || !s.evidence_kind_enum.includes(o.evidence_kind)) p.push(`${o.id}: enum violation`);
  }
  const o1 = t.observations?.find((o) => o.id === 'O1');
  if (o1 && o1.max_claim !== 'LOADED') p.push('O1 may claim at most LOADED');
  return p;
}
export function checkFixtures(f) {
  const p = [], ids = new Set();
  for (const e of f.events ?? []) {
    if (ids.has(e.id)) p.push(`duplicate id ${e.id}`); ids.add(e.id);
    if ((e.raw === null) === (e.event === null)) p.push(`${e.id}: exactly one of raw/event`);
    if (!e.expect || !Number.isInteger(e.expect.exit)) p.push(`${e.id}: expect.exit missing`);
    if (e.event && !JSON.stringify(e.event).includes('{{PROJECT}}') && e.event.tool_name !== 'Read') p.push(`${e.id}: no {{PROJECT}} placeholder`);
  }
  for (const t of ['Write', 'Edit', 'Bash', 'PowerShell']) if (!(f.events ?? []).some((e) => e.event?.tool_name === t && e.expect.exit === 2)) p.push(`no blocked fixture for ${t}`);
  return p;
}

// ---- run
const results = [];
const rec = (name, problems) => results.push({ name, ok: problems.length === 0, problems });
const read = (p) => readFileSync(join(HERE, p), 'utf8');

function selfTest() {
  const wsb = read('sandbox/pilot.wsb.draft.xml');
  const cases = [
    ['wsb: network enabled', checkWsb(wsb.replace('<Networking>Disable', '<Networking>Enable'))],
    ['wsb: clipboard enabled', checkWsb(wsb.replace('<ClipboardRedirection>Disable', '<ClipboardRedirection>Enable'))],
    ['wsb: writable mapping', checkWsb(wsb.replace('<ReadOnly>true', '<ReadOnly>false'))],
    ['wsb: second mapping', checkWsb(wsb.replace('</MappedFolders>', '<MappedFolder><HostFolder>x</HostFolder><ReadOnly>true</ReadOnly></MappedFolder></MappedFolders>'))],
    ['wsb: real host path', checkWsb(wsb.replaceAll('__HOST_PAYLOAD_DIR__', 'C:' + BS + 'Users' + BS + 'x'))],
    ['policy: managed-only leaked into p1', checkPolicy('p1-baseline.test.json', JSON.stringify({ allowManagedHooksOnly: true, hooks: JSON.parse(read('policies/p1-baseline.test.json')).hooks }))],
    ['policy: control gained onFailure', checkPolicy('p6-control-error-without-onfailure.test.json', read('policies/p4-onfailure-error.test.json'))],
    ['policy: command outside payload', checkPolicy('p4-onfailure-error.test.json', read('policies/p4-onfailure-error.test.json').replaceAll('payload', 'elsewhere'))],
    ['policy: legacy quoted command, no args', checkPolicy('p4-onfailure-error.test.json', JSON.stringify({ hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: '"C:' + BS + 'payload' + BS + 'bin' + BS + 'node.exe" x', timeout: 5, onFailure: 'block' }] }] } }))],
    ['policy: hook not nested in matcher group', checkPolicy('p4-onfailure-error.test.json', JSON.stringify({ hooks: { PreToolUse: [{ type: 'command', command: 'C:' + BS + 'payload' + BS + 'x', args: ['a'], timeout: 5 }] } }))],
    ['policy: onFailure outside enum', checkPolicy('p4-onfailure-error.test.json', read('policies/p4-onfailure-error.test.json').replace('"block"', '"deny"'))],
    ['policy: p1 lost PermissionRequest', checkPolicy('p1-baseline.test.json', JSON.stringify({ hooks: { PreToolUse: JSON.parse(read('policies/p1-baseline.test.json')).hooks.PreToolUse } }))],
    ['ps1: refusal removed', checkPs1(read('sandbox/inside-sandbox-setup.ps1').replace(/if \(\$env:USERNAME[^\n]*\n/, ''))],
    ['secrets: api key', checkSecrets('ANTHROPIC_API_KEY=abc')],
    ['secrets: real user path', checkSecrets('C:' + BS + 'Users' + BS + 'crypt' + BS + '.claude')],
    ['evidence: pre-filled PASS', checkEvidenceTemplate(JSON.parse(read('evidence-template.json').replace('"status": "NOT_TESTED"', '"status": "PASS"')), JSON.parse(read('evidence-schema.json')))],
    ['evidence: O1 claims enforcement', checkEvidenceTemplate(JSON.parse(read('evidence-template.json').replace('"max_claim": "LOADED"', '"max_claim": "ENFORCEMENT_LIVE"')), JSON.parse(read('evidence-schema.json')))],
    ['fixtures: Bash fixture removed', checkFixtures({ events: JSON.parse(read('fixtures/events.json')).events.filter((e) => e.event?.tool_name !== 'Bash') })],
  ];
  for (const [n, probs] of cases) rec(`self-test rejects: ${n}`, probs.length > 0 ? [] : ['validator accepted bad input']);
}

const argv = process.argv.slice(2);
const files = walk(HERE).filter((p) => rel(p) !== 'MANIFEST.sha256.json').sort();

// integrity
const hashes = Object.fromEntries(files.map((p) => [rel(p), sha(readFileSync(p))]));
if (argv.includes('--write-manifest')) { writeFileSync(MANIFEST, JSON.stringify({ about: 'SHA-256 of every package file except this one. Integrity only; not a test result.', files: hashes }, null, 2) + '\n'); console.log('manifest written'); }
let man; try { man = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { man = null; }
if (!man) rec('manifest present', ['MANIFEST.sha256.json missing/unreadable']);
else {
  const bad = [];
  for (const [k, v] of Object.entries(hashes)) if (man.files[k] !== v) bad.push(`${k}: ${man.files[k] ? 'hash differs' : 'not in manifest'}`);
  for (const k of Object.keys(man.files)) if (!(k in hashes)) bad.push(`${k}: listed but missing`);
  rec(`package integrity (${files.length} files vs manifest)`, bad);
}

// syntax
const syn = [];
for (const p of files) {
  const r = rel(p);
  if (r.endsWith('.json')) { try { JSON.parse(readFileSync(p, 'utf8')); } catch (e) { syn.push(`${r}: ${e.message}`); } }
  else if (r.endsWith('.mjs')) { const c = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' }); if (c.status !== 0) syn.push(`${r}: ${c.stderr.split('\n')[0]}`); }
  else if (r.endsWith('.xml')) { const t = readFileSync(p, 'utf8'); const o = (t.match(/<([A-Za-z]+)>/g) ?? []).length, c = (t.match(/<\/[A-Za-z]+>/g) ?? []).length; if (o !== c) syn.push(`${r}: unbalanced tags ${o}/${c}`); }
  else if (r.endsWith('.ps1')) {
    const q = `$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${p}',[ref]$null,[ref]$e);if($e){$e|%{$_.Message};exit 1}`;
    const c = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', q], { encoding: 'utf8' });
    if (c.error) syn.push(`${r}: powershell unavailable (NOT CHECKED)`); else if (c.status !== 0) syn.push(`${r}: ${c.stdout.trim()}`);
  }
}
rec('syntax (json, mjs --check, xml tag balance, ps1 parse-only)', syn);

// content rules
rec('sandbox draft is closed-by-default', checkWsb(read('sandbox/pilot.wsb.draft.xml')));
for (const p of files.filter((f) => rel(f).startsWith('policies/'))) rec(`policy ${rel(p)}`, checkPolicy(rel(p).split('/')[1], readFileSync(p, 'utf8')));
rec('setup script refuses outside sandbox before any write', checkPs1(read('sandbox/inside-sandbox-setup.ps1')));
rec('evidence template matches schema', checkEvidenceTemplate(JSON.parse(read('evidence-template.json')), JSON.parse(read('evidence-schema.json'))));
rec('fixtures well-formed, blocked tools covered', checkFixtures(JSON.parse(read('fixtures/events.json'))));
rec('no credential / real-host-path patterns in package', files.filter((p) => !rel(p).endsWith('check-package.mjs')).flatMap((p) => checkSecrets(readFileSync(p, 'utf8')).map((m) => `${rel(p)}: ${m}`)));

// pinned existing sources (read-only hashing; they must be unchanged)
const pm = JSON.parse(read('payload-manifest.json'));
rec('pinned existing sources unchanged', pm.pinned_existing_sources.flatMap((s) => { const h = sha(readFileSync(join(ROOT, s.from))); return h === s.sha256 ? [] : [`${s.from}: ${h}`]; }));

selfTest();

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.problems.join('\n      ')}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} package checks passed (integrity+syntax only; NOT an enforcement result)`);
process.exitCode = failed ? 1 : 0;
