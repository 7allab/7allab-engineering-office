import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { classifyGuestAuth, recordGuestAuthProvenance, runCli } from '../sandbox/guest-auth-provenance.mjs';

const NOW = '2026-11-10T20:00:00.000Z';
const sentinel = 'mock-fixture-sentinel-not-a-real-key-0000';
const oauthKey = ['CLAUDE_CODE', 'OAUTH', 'TOKEN'].join('_');
async function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'k205c-r2d-auth-'));
  try { return await run({ root, output: join(root, 'auth-provenance.json') }); }
  finally { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true, force: true }); }
}

test('exact loopback mock and one synthetic sentinel produce hash-bound provenance', () => fixture(f => {
  const env = { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8765', ['ANTHROPIC_AUTH_TOKEN']: sentinel };
  const result = recordGuestAuthProvenance({ mode: 'MOCK_ENDPOINT', output: f.output, env, now: () => NOW });
  assert.equal(result.record.auth_mode, 'MOCK_ENDPOINT');
  assert.match(result.evidence_sha256, /^[A-F0-9]{64}$/);
  assert.deepEqual(JSON.parse(readFileSync(f.output)), result.record);
  assert.doesNotMatch(readFileSync(f.output, 'utf8'), new RegExp(sentinel));
}));
test('real or unexpected credential is rejected without recording its value', () => fixture(f => {
  const env = { ANTHROPIC_BASE_URL: 'http://127.0.0.1:8765', ['ANTHROPIC_AUTH_TOKEN']: 'real-value-not-for-logs' };
  assert.throws(() => recordGuestAuthProvenance({ mode: 'MOCK_ENDPOINT', output: f.output, env }),
    /SYNTHETIC_SENTINEL_INVALID/);
  assert.equal(existsSync(f.output), false);
}));
test('mock requires exact loopback endpoint', () => {
  assert.throws(() => classifyGuestAuth('MOCK_ENDPOINT', {
    ANTHROPIC_BASE_URL: 'http://localhost:8765', ['ANTHROPIC_AUTH_TOKEN']: sentinel,
  }), /MOCK_ENDPOINT_INVALID/);
});
test('multiple credential paths are refused even when one is the sentinel', () => {
  assert.throws(() => classifyGuestAuth('MOCK_ENDPOINT', {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:8765', ['ANTHROPIC_AUTH_TOKEN']: sentinel,
    [oauthKey]: 'another-source',
  }), /OTHER_AUTH_SOURCE_PRESENT/);
});
test('provider credentials and flags cannot be mislabeled as mock', () => {
  assert.throws(() => classifyGuestAuth('MOCK_ENDPOINT', {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:8765', ['ANTHROPIC_API_KEY']: sentinel,
    CLAUDE_CODE_USE_BEDROCK: '1', AWS_ACCESS_KEY_ID: 'not-recorded',
  }), /OTHER_AUTH_SOURCE_PRESENT/);
});
test('NONE is only an unattested observation of an empty known auth environment', () => {
  assert.deepEqual(classifyGuestAuth('NONE', {}), {
    auth_mode: 'NONE', credential_kind: 'NONE', endpoint_kind: 'NONE', source: 'RUNNER_ENVIRONMENT',
  });
  assert.throws(() => classifyGuestAuth('NONE', { [oauthKey]: 'not-recorded' }),
    /AUTH_SOURCE_PRESENT_FOR_NONE/);
});
test('REAL and unknown modes are always refused', () => {
  for (const mode of ['REAL', 'AUTO', '']) assert.throws(() => classifyGuestAuth(mode, {}), /AUTH_MODE_REFUSED/);
});
test('existing output is never overwritten', () => fixture(f => {
  writeFileSync(f.output, 'keep');
  assert.throws(() => recordGuestAuthProvenance({ mode: 'NONE', output: f.output, env: {} }), /OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(f.output, 'utf8'), 'keep');
}));
test('symlinked output ancestry is refused where supported', t => fixture(f => {
  const target = join(f.root, 'target'), link = join(f.root, 'link'); mkdirSync(target);
  try { symlinkSync(target, link, 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('no symlink privilege'); throw error; }
  assert.throws(() => recordGuestAuthProvenance({ mode: 'NONE', output: join(link, 'auth.json'), env: {} }),
    /SYMLINK_PATH_REFUSED/);
}));
test('CLI refuses extra flags and cannot select REAL auth', () => {
  assert.throws(() => runCli(['--mode', 'NONE', '--output', 'x', '--token', 'secret']), /USAGE_MODE_OUTPUT_ONLY/);
  assert.throws(() => runCli(['--mode', 'REAL', '--output', 'x']), /ABSOLUTE_OUTPUT_REQUIRED|AUTH_MODE_REFUSED/);
});
