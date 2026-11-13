import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { collectReadOnlyInventory, validateBinaryIdentity } from './wsb-read-only-adapter.mjs';

// Independently verified 2026-11-12 (Get-AppxPackage, AppxManifest, MSIX signature + block map): 0.8.114.0 replaces 0.8.107.0.
const HASH = '4F9FE30377550174CDDA53FBA78D76F83692E0B10334D6C42E1AF3771A6BA07C';
const PACKAGE = 'MicrosoftWindows.WindowsSandbox_0.8.114.0_x64__cw5n1h2txyewy';
const VERSION = '0.8.114.0';
// The previous identity must never be accepted as the current one.
const OLD_HASH = '247E092B5C5BD37820F225A7DD3DDF10AE37A67E2751A19C24B802C84769C441';
const OLD_PACKAGE = 'MicrosoftWindows.WindowsSandbox_0.8.107.0_x64__cw5n1h2txyewy';
const OLD_VERSION = '0.8.107.0';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'k205c-r2c2-'));
  const local = join(root, 'local'), alias = join(local, 'Microsoft', 'WindowsApps', 'wsb.exe');
  const executable = join(root, 'package', 'wsb.exe');
  mkdirSync(dirname(alias), { recursive: true }); mkdirSync(dirname(executable), { recursive: true });
  // The pinned digest cannot be synthesized; validator tests inject only the file-hash result.
  writeFileSync(executable, 'synthetic');
  const identity = { packageFullName: PACKAGE,
    version: VERSION, status: 'Ok', signatureKind: 'Store', executablePath: executable,
    aliasPath: alias, aliasIsReparse: true, aliasReparseTag: '0x8000001b', resolvedCommands: [alias] };
  return { root, local, alias, executable, identity, output: join(root, 'evidence') };
}
function fakeChild({ stdout = '{"WindowsSandboxEnvironments":[]}', stderr = '', code = 0, error = null, waitForKill = false } = {}) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
  child.kill = () => { child.killed = true; queueMicrotask(() => child.emit('close', null, 'SIGTERM')); return true; };
  child.start = () => { if (!waitForKill) queueMicrotask(() => {
    if (error) return child.emit('error', error);
    child.stdout.end(stdout); child.stderr.end(stderr); child.emit('close', code, null);
  }); };
  return child;
}
const immediateTimers = { setTimeout(fn) { queueMicrotask(fn); return fn; }, clearTimeout() {} };
async function withFixture(run) {
  const f = fixture();
  try { return await run(f); }
  finally { assert.ok(resolve(f.root).startsWith(resolve(tmpdir()) + sep)); rmSync(f.root, { recursive: true, force: true }); }
}
async function collect(f, child = fakeChild(), extra = {}) {
  // Identity validation is kept real in production; the synthetic process tests isolate the post-validation adapter.
  const digest = createHash('sha256').update(readFileSync(f.executable)).digest('hex').toUpperCase();
  assert.notEqual(digest, HASH);
  const identity = { package_full_name: f.identity.packageFullName, package_version: f.identity.version,
    alias_path: f.alias, alias_reparse_tag: 'APPEXECLINK', executable_path: f.executable,
    executable_sha256: HASH, sourceTrusted: false, authorityImplemented: false,
    operationalAuthority: false, review_verified: false };
  return collectReadOnlyInventory({ outputDir: f.output, identityProvider: async () => f.identity,
    binaryValidator: () => identity,
    spawnImpl: (file, args, options) => { assert.equal(file, f.alias); assert.deepEqual(args, ['list', '--raw']);
      assert.equal(options.shell, false); child.start(); return child; }, env: { LOCALAPPDATA: f.local },
    ...extra });
}

test('invalid package identity fails closed before spawning', () => withFixture(async f => {
  f.identity.packageFullName = 'Other.Package_0.8.114.0_x64__cw5n1h2txyewy';
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }), /PACKAGE_IDENTITY_CHANGED/);
}));
test('changed package version fails closed before spawning', () => withFixture(async f => {
  f.identity.version = '0.8.113.0';
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }), /PACKAGE_IDENTITY_CHANGED/);
}));
test('the previous 0.8.107.0 identity is rejected, whole or mixed with the new one', () => withFixture(async f => {
  const attempt = async (pkg, ver) => { f.identity.packageFullName = pkg; f.identity.version = ver;
    await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => HASH), { message: 'PACKAGE_IDENTITY_CHANGED' }, `${pkg} / ${ver}`); };
  await attempt(OLD_PACKAGE, OLD_VERSION);
  await attempt(OLD_PACKAGE, VERSION);
  await attempt(PACKAGE, OLD_VERSION);
}));
test('near-miss package names and versions are refused (no range or prefix acceptance)', () => withFixture(async f => {
  const names = [`${PACKAGE} `, ` ${PACKAGE}`, PACKAGE.toLowerCase(), PACKAGE.replace('0.8.114.0', '0.8.114.1'), PACKAGE.replace('0.8.114.0', '0.8.114'),
    PACKAGE.replace('0.8.114.0', '0.8.115.0'), PACKAGE.replace('0.8.114.0', '0.9.0.0'), PACKAGE.replace('x64', 'x86'), PACKAGE.replace('cw5n1h2txyewy', 'cw5n1h2txyewz'),
    PACKAGE.replace('MicrosoftWindows.WindowsSandbox', 'MicrosoftWindows.WindowsSandboxX'), 'MicrosoftWindows.WindowsSandbox', '', null, undefined, [PACKAGE], { toString: () => PACKAGE }];
  for (const name of names) { f.identity.packageFullName = name; f.identity.version = VERSION;
    await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => HASH), { message: 'PACKAGE_IDENTITY_CHANGED' }, String(name)); }
  f.identity.packageFullName = PACKAGE;
  const versions = [`${VERSION} `, '0.8.114', '0.8.114.1', '0.8.113.9', '0.8.115.0', '0.8', '0', '', null, undefined, [VERSION], 114, { toString: () => VERSION }];
  for (const version of versions) { f.identity.version = version;
    await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => HASH), { message: 'PACKAGE_IDENTITY_CHANGED' }, String(version)); }
}));
test('package status and signature kind must be exactly Ok and Store', () => withFixture(async f => {
  for (const [key, value] of [['status', 'Modified'], ['status', 'ok'], ['status', undefined], ['signatureKind', 'System'], ['signatureKind', 'Developer'], ['signatureKind', 'store'], ['signatureKind', undefined]]) {
    const identity = { ...f.identity, [key]: value };
    await assert.rejects(() => validateBinaryIdentity(identity, { LOCALAPPDATA: f.local }, async () => HASH), { message: 'PACKAGE_IDENTITY_CHANGED' }, `${key}=${value}`);
  }
}));
test('the previous executable digest is not accepted for the new package identity', () => withFixture(async f => {
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => OLD_HASH), { message: 'TARGET_BINARY_HASH_CHANGED' });
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => HASH.slice(0, 63) + '0'), { message: 'TARGET_BINARY_HASH_CHANGED' });
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => ''), { message: 'TARGET_BINARY_HASH_CHANGED' });
}));
test('unexpected alias or command resolution fails closed (alias path, extra or foreign resolved commands)', () => withFixture(async f => {
  const other = join(f.root, 'elsewhere', 'wsb.exe');
  const cases = [
    { aliasPath: other }, { resolvedCommands: [] }, { resolvedCommands: [f.alias, other] }, { resolvedCommands: [other] },
    { resolvedCommands: [f.alias, f.alias] }, { aliasIsReparse: false }, { aliasReparseTag: '' },
  ];
  for (const patch of cases) await assert.rejects(() => validateBinaryIdentity({ ...f.identity, ...patch }, { LOCALAPPDATA: f.local }, async () => HASH),
    { message: 'ALIAS_IDENTITY_CHANGED' }, JSON.stringify(patch));
}));
test('an executable path that is missing or not a plain file fails closed', () => withFixture(async f => {
  await assert.rejects(() => validateBinaryIdentity({ ...f.identity, executablePath: join(f.root, 'missing', 'wsb.exe') }, { LOCALAPPDATA: f.local }, async () => HASH), { message: 'PATH_NOT_FOUND' });
  await assert.rejects(() => validateBinaryIdentity({ ...f.identity, executablePath: 'wsb.exe' }, { LOCALAPPDATA: f.local }, async () => HASH), { message: 'ABSOLUTE_PATH_REQUIRED' });
}));
test('non-file target binary fails closed', () => withFixture(async f => {
  f.identity.executablePath = dirname(f.executable);
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }), /TARGET_BINARY_TYPE_INVALID/);
}));
test('changed executable hash fails closed', () => withFixture(async f => {
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => '0'.repeat(64)),
    /TARGET_BINARY_HASH_CHANGED/);
}));
test('valid pinned package metadata is accepted without granting trust', () => withFixture(async f => {
  const got = await validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }, async () => HASH);
  assert.equal(got.executable_sha256, HASH); assert.equal(got.sourceTrusted, false);
}));
test('wrong alias reparse tag fails closed', () => withFixture(async f => {
  f.identity.aliasReparseTag = '0xA000000C';
  await assert.rejects(() => validateBinaryIdentity(f.identity, { LOCALAPPDATA: f.local }), /ALIAS_IDENTITY_CHANGED/);
}));

// The remaining tests inject a validated identity so no host WSB/package query is performed.
test('source exposes no command choice and pins the production digest', () => {
  const raw = readFileSync(new URL('./wsb-read-only-adapter.mjs', import.meta.url), 'utf8');
  assert.match(raw, new RegExp(HASH)); assert.match(raw, /\['list', '--raw'\]/); assert.match(raw, /shell: false/);
  // Exactly one pinned identity: the previous one is gone, and the pins are exact constants (no range/prefix logic).
  assert.ok(raw.includes(`const EXPECTED_PACKAGE = '${PACKAGE}';`));
  assert.ok(raw.includes(`const EXPECTED_VERSION = '${VERSION}';`));
  assert.ok(raw.includes(`const EXPECTED_HASH = '${HASH}';`));
  for (const old of [OLD_HASH, OLD_PACKAGE, OLD_VERSION]) assert.ok(!raw.includes(old), `previous pin still present: ${old}`);
  assert.equal((raw.match(/EXPECTED_PACKAGE|EXPECTED_VERSION|EXPECTED_HASH/g) ?? []).length, 3 + 6,
    'three definitions plus the six existing exact uses (comparisons and the returned identity record); a new use would be a review item');
  assert.ok(!/startsWith\(|semver|localeCompare|match\([^)]*EXPECTED|includes\([^)]*EXPECTED|\.test\([^)]*EXPECTED/.test(raw.slice(raw.indexOf('export async function validateBinaryIdentity'), raw.indexOf('const INSPECT_SCRIPT'))));
  assert.match(raw, /\$ProgressPreference='SilentlyContinue'/);
  assert.doesNotMatch(raw, /\['(?:start|stop|connect|exec|share)'/);
});

test('valid synthetic list is preserved raw and remains unattested', () => withFixture(async f => {
  const report = await collect(f);
  assert.equal(report.status, 'READ_ONLY_OBSERVATION_UNATTESTED');
  assert.equal(report.current_user_visible_count, 0);
  assert.equal(report.inventory_scope, 'CURRENT_USER_WSB_CLI');
  assert.equal(report.system_wide_empty, 'NOT_ATTESTED');
  for (const field of ['sourceTrusted', 'authorityImplemented', 'operationalAuthority', 'review_verified'])
    assert.equal(report[field], false);
  assert.deepEqual(JSON.parse(readFileSync(join(f.output, 'inventory-observation.json'))), report);
  assert.equal(readFileSync(join(f.output, 'wsb-list.stdout.bin'), 'utf8'), '{"WindowsSandboxEnvironments":[]}');
}));
test('spawn error is separately recorded with empty raw evidence', () => withFixture(async f => {
  const report = await collect(f, fakeChild({ error: Object.assign(new Error('missing'), { code: 'ENOENT' }) }));
  assert.equal(report.reason, 'SPAWN_ERROR'); assert.equal(report.exit_code, null);
  assert.equal(readFileSync(join(f.output, 'wsb-list.stdout.bin')).length, 0);
}));
test('nonzero exit is distinct and keeps stderr', () => withFixture(async f => {
  const report = await collect(f, fakeChild({ code: 7, stderr: 'failed' }));
  assert.equal(report.reason, 'CLI_NONZERO_EXIT'); assert.equal(report.exit_code, 7);
  assert.equal(readFileSync(join(f.output, 'wsb-list.stderr.bin'), 'utf8'), 'failed');
}));
test('timeout kills the child and records timeout separately', () => withFixture(async f => {
  const child = fakeChild({ waitForKill: true });
  const timers = { setTimeout(fn, ms) { if (ms === 15000) queueMicrotask(fn); return fn; }, clearTimeout() {} };
  const report = await collect(f, child, { timers });
  assert.equal(child.killed, true); assert.equal(report.reason, 'CLI_TIMEOUT'); assert.equal(report.timed_out, true);
}));
for (const stream of ['stdout', 'stderr']) test(`${stream} has its own 1 MiB hard limit`, () => withFixture(async f => {
  const child = fakeChild({ [stream]: Buffer.alloc(1024 * 1024 + 1, 0x61) });
  const report = await collect(f, child);
  assert.equal(report.reason, `${stream.toUpperCase()}_OVERFLOW`);
  assert.equal(readFileSync(join(f.output, `wsb-list.${stream}.bin`)).length, 1024 * 1024);
}));
test('invalid JSON is INCONCLUSIVE and raw bytes remain hash-bound', () => withFixture(async f => {
  const report = await collect(f, fakeChild({ stdout: '{broken' }));
  assert.equal(report.reason, 'INVENTORY_JSON_INVALID');
  assert.equal(report.stdout_sha256, createHash('sha256').update('{broken').digest('hex').toUpperCase());
}));
test('invalid inventory shape is INCONCLUSIVE', () => withFixture(async f => {
  const report = await collect(f, fakeChild({ stdout: '{}' }));
  assert.equal(report.reason, 'INVENTORY_SCHEMA_INVALID');
}));
test('duplicate IDs are INCONCLUSIVE', () => withFixture(async f => {
  const stdout = JSON.stringify({ WindowsSandboxEnvironments: [{ Id: 'same' }, { Id: 'same' }] });
  const report = await collect(f, fakeChild({ stdout }));
  assert.equal(report.reason, 'INVENTORY_ID_INVALID');
}));
test('stderr with zero exit cannot become a positive observation', () => withFixture(async f => {
  const report = await collect(f, fakeChild({ stderr: 'warning' }));
  assert.equal(report.reason, 'STDERR_NOT_EMPTY');
}));
test('existing output and user data are never overwritten', () => withFixture(async f => {
  mkdirSync(f.output); writeFileSync(join(f.output, 'user.txt'), 'keep');
  await assert.rejects(() => collect(f), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(join(f.output, 'user.txt'), 'utf8'), 'keep');
}));
test('successful atomic publish leaves no staging directory to clean', () => withFixture(async f => {
  await collect(f);
  assert.deepEqual(readdirSync(f.root).filter(name => name.includes('.tmp-')), []);
  assert.equal(existsSync(f.output), true);
}));
