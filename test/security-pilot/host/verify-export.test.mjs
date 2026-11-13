// All fixtures use a fresh OS temp directory. No Sandbox/Hyper-V or repo writes.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { verifyExport, runCli } from './verify-export.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex').toUpperCase();
const runId = 'k205c-r1-fixture';
function fixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'k205c-r1-test-'));
  const run = join(tmp, 'export', runId);
  mkdirSync(run, { recursive: true });
  const data = '{"mock":true}\n';
  writeFileSync(join(run, 'result.json'), data);
  const manifest = { run_id: runId, files: [{ relative_path: 'result.json', sha256: sha(data), bytes: Buffer.byteLength(data) }] };
  writeFileSync(join(run, 'MANIFEST.sha256.json'), JSON.stringify(manifest));
  writeFileSync(join(run, 'EXPORT.COMPLETE.json'), JSON.stringify({ run_id: runId, file_count: 1 }));
  return { tmp, run, manifest };
}
async function usingFixture(fn) {
  const { tmp, run, manifest } = fixture();
  try { return await fn({ tmp, run, manifest }); }
  finally {
    const root = resolve(tmpdir()) + sep;
    assert.ok(resolve(tmp).startsWith(root) && tmp.split(sep).pop().startsWith('k205c-r1-test-'));
    rmSync(tmp, { recursive: true, force: true });
  }
}

test('valid export: only genuinely checked contents yield true', async () => {
  await usingFixture(async ({ tmp, run }) => {
    const verified = await verifyExport(run, runId);
    assert.equal(verified.host_manifest_verified, true);
    assert.equal(verified.verified_file_count, 1);
    const report = join(tmp, 'report-fresh');
    assert.equal(await runCli(['--run-dir', run, '--run-id', runId, '--report-dir', report]), 0);
    const saved = JSON.parse(readFileSync(join(report, 'host-manifest-verification.json'), 'utf8'));
    assert.equal(saved.host_manifest_verified, true);
    assert.equal(saved.failure_code, null);
  });
});

test('wrong content hash fails closed and reports false', async () => {
  await usingFixture(async ({ tmp, run }) => {
    writeFileSync(join(run, 'result.json'), '{"mock":null}\n');
    const report = join(tmp, 'report-fail');
    assert.equal(await runCli(['--run-dir', run, '--run-id', runId, '--report-dir', report]), 1);
    const saved = JSON.parse(readFileSync(join(report, 'host-manifest-verification.json'), 'utf8'));
    assert.equal(saved.host_manifest_verified, false);
    assert.equal(saved.failure_code, 'ENTRY_SHA256_MISMATCH');
  });
});

test('missing marker, stale marker, extra file and mismatch fail', async (t) => {
  for (const variant of ['missing-marker', 'stale-marker', 'extra', 'wrong-run']) {
    await t.test(variant, () => usingFixture(async ({ run }) => {
      if (variant === 'missing-marker') rmSync(join(run, 'EXPORT.COMPLETE.json'));
      if (variant === 'stale-marker') writeFileSync(join(run, 'EXPORT.COMPLETE.json'), JSON.stringify({ run_id: runId, file_count: 2 }));
      if (variant === 'extra') writeFileSync(join(run, 'unexpected.txt'), 'not in manifest');
      if (variant === 'wrong-run') writeFileSync(join(run, 'MANIFEST.sha256.json'), JSON.stringify({ run_id: 'other-run', files: [{ relative_path: 'result.json', sha256: sha('{"mock":true}\n'), bytes: 14 }] }));
      await assert.rejects(verifyExport(run, runId));
    }));
  }
});

test('traversal, duplicate case names, and reserved paths fail', async (t) => {
  for (const variant of ['traversal', 'collision', 'reserved', 'disallowed']) {
    await t.test(variant, () => usingFixture(async ({ run, manifest }) => {
      if (variant === 'traversal') manifest.files[0].relative_path = '..\\result.json';
      if (variant === 'collision') manifest.files.push({ ...manifest.files[0], relative_path: 'RESULT.JSON' });
      if (variant === 'reserved') manifest.files[0].relative_path = 'EXPORT.COMPLETE.json';
      if (variant === 'disallowed') manifest.files[0].relative_path = 'script.exe';
      writeFileSync(join(run, 'MANIFEST.sha256.json'), JSON.stringify(manifest));
      await assert.rejects(verifyExport(run, runId));
    }));
  }
});

test('symlink export entry is refused when the platform supports it', async (t) => {
  await usingFixture(async ({ run }) => {
    try { symlinkSync(join(run, 'result.json'), join(run, 'unlisted-link.txt')); }
    catch (e) {
      if (['EPERM', 'EACCES', 'ENOTSUP'].includes(e.code)) return t.skip('symlink privileges unavailable');
      throw e;
    }
    await assert.rejects(verifyExport(run, runId), /SYMLINK_IN_EXPORT/);
  });
});

test('report must be fresh and separate from export', async () => {
  await usingFixture(async ({ tmp, run }) => {
    await assert.rejects(runCli(['--run-dir', run, '--run-id', runId, '--report-dir', run]), /REPORT_EXPORT_OVERLAP/);
    const existing = join(tmp, 'existing-report');
    mkdirSync(existing);
    await assert.rejects(runCli(['--run-dir', run, '--run-id', runId, '--report-dir', existing]), /REPORT_DIRECTORY_ALREADY_EXISTS/);
  });
});
