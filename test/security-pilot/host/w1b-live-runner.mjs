#!/usr/bin/env node
// Source-only W1b entry point. Invoking the CLI performs live WSB operations and requires W1B-LIVE-EXECUTION approval.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, parse, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCampaign } from './campaign-driver.mjs';
import { createWsbStatefulTransport } from './wsb-stateful-transport.mjs';

const SCHEMA = '7allab-k205c-w1b-live-plan/0.1';
const POLICY = 'p2-managed-hooks-only.test.json';
const PERMISSION_POLICY = 'p2-permission-request-probe.test.json';
const LIVE_POLICIES = Object.freeze([POLICY, PERMISSION_POLICY]); // exact names only; no prefix/regex acceptance
const KEYS = ['export_root','output_dir','payload_root','policy','run_id','sandbox_id','schema'];
const fail = (code) => { throw new Error(code); };
const PACKAGE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO = resolve(PACKAGE, '..', '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const HOST_SOURCE_FILES = Object.freeze({
  'host/w1b-live-runner.mjs': fileURLToPath(import.meta.url),
  'host/campaign-driver.mjs': join(PACKAGE,'host','campaign-driver.mjs'),
  'host/wsb-stateful-transport.mjs': join(PACKAGE,'host','wsb-stateful-transport.mjs'),
  'host/wsb-read-only-adapter.mjs': join(PACKAGE,'host','wsb-read-only-adapter.mjs'),
});
const hostSourceSha256 = () => Object.fromEntries(Object.entries(HOST_SOURCE_FILES)
  .map(([name,path]) => [name,sha(readFileSync(path))]));
const SOURCES = Object.freeze({
  'policies/p2-managed-hooks-only.test.json': join(PACKAGE,'policies','p2-managed-hooks-only.test.json'),
  'fixtures/events.json': join(PACKAGE,'fixtures','events.json'),
  'sandbox/inside-sandbox-setup.ps1': join(PACKAGE,'sandbox','inside-sandbox-setup.ps1'),
  'sandbox/guest-auth-provenance.mjs': join(PACKAGE,'sandbox','guest-auth-provenance.mjs'),
  'sandbox/guest-result-finalize.mjs': join(PACKAGE,'sandbox','guest-result-finalize.mjs'),
  'sandbox/w1b-direct-feed.mjs': join(PACKAGE,'sandbox','w1b-direct-feed.mjs'),
  'sandbox/w1b-run.ps1': join(PACKAGE,'sandbox','w1b-run.ps1'),
  'sandbox/export-manifest.ps1': join(PACKAGE,'sandbox','export-manifest.ps1'),
  'mocks/mock-endpoint.mjs': join(PACKAGE,'mocks','mock-endpoint.mjs'),
  'hooks/_marker.mjs': join(PACKAGE,'hooks','_marker.mjs'),
  'hooks/probe-marker.mjs': join(PACKAGE,'hooks','probe-marker.mjs'),
  'scripts/guard.mjs': join(REPO,'scripts','guard.mjs'),
  'scripts/authority-grant.mjs': join(REPO,'scripts','authority-grant.mjs'),
  'scripts/guard-scope.mjs': join(REPO,'scripts','guard-scope.mjs'),
  'scripts/decision-gate-event-adapter.mjs': join(REPO,'scripts','decision-gate-event-adapter.mjs'),
  'scripts/validate-director-decision.mjs': join(REPO,'scripts','validate-director-decision.mjs'),
  'policy-to-install.txt': Buffer.from(`${POLICY}\r\n`),
});
// PermissionRequest S1/S2/S3 profile: the plan names the S1 policy; the S2 and S3 (O4-NC guarded arm) policies ship in the same exact payload set.
const PERMISSION_SOURCES = Object.freeze({
  'policies/p2-permission-request-probe.test.json': join(PACKAGE,'policies','p2-permission-request-probe.test.json'),
  'policies/p2-permission-request-allow-control.test.json': join(PACKAGE,'policies','p2-permission-request-allow-control.test.json'),
  'policies/p2-pretooluse-guard-allow-control.test.json': join(PACKAGE,'policies','p2-pretooluse-guard-allow-control.test.json'),
  'sandbox/inside-sandbox-setup.ps1': join(PACKAGE,'sandbox','inside-sandbox-setup.ps1'),
  'sandbox/guest-auth-provenance.mjs': join(PACKAGE,'sandbox','guest-auth-provenance.mjs'),
  'sandbox/guest-result-finalize.mjs': join(PACKAGE,'sandbox','guest-result-finalize.mjs'),
  'sandbox/w1b-permission-run.ps1': join(PACKAGE,'sandbox','w1b-permission-run.ps1'),
  'sandbox/export-manifest.ps1': join(PACKAGE,'sandbox','export-manifest.ps1'),
  'mocks/mock-endpoint.mjs': join(PACKAGE,'mocks','mock-endpoint.mjs'),
  'hooks/_marker.mjs': join(PACKAGE,'hooks','_marker.mjs'),
  'hooks/probe-marker.mjs': join(PACKAGE,'hooks','probe-marker.mjs'),
  'hooks/permission-probe.mjs': join(PACKAGE,'hooks','permission-probe.mjs'),
  'scripts/guard.mjs': join(REPO,'scripts','guard.mjs'),
  'scripts/authority-grant.mjs': join(REPO,'scripts','authority-grant.mjs'),
  'scripts/guard-scope.mjs': join(REPO,'scripts','guard-scope.mjs'),
  'scripts/decision-gate-event-adapter.mjs': join(REPO,'scripts','decision-gate-event-adapter.mjs'),
  'scripts/validate-director-decision.mjs': join(REPO,'scripts','validate-director-decision.mjs'),
  'policy-to-install.txt': Buffer.from(`${PERMISSION_POLICY}\r\n`),
});
export function payloadSourcesFor(policy) {
  if (policy === POLICY) return SOURCES;
  if (policy === PERMISSION_POLICY) return PERMISSION_SOURCES;
  return fail('PLAN_CONTRACT_INVALID');
}
const RUNTIMES = Object.freeze({
  'bin/node.exe': { bytes:92534088, sha256:'9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE' },
  'bin/claude.exe': { bytes:344807072, sha256:'2E055732C9D03D22700D9046251A8370B673607BFCC9E4D16A1B0E8FB1345CBD' },
});

export function validatePayload(payloadRoot, { sources = SOURCES, runtimes = RUNTIMES } = {}) {
  if (typeof payloadRoot !== 'string' || !isAbsolute(payloadRoot)) fail('PAYLOAD_ABSOLUTE_PATH_REQUIRED');
  const root = resolve(payloadRoot), found = [];
  const walk = (dir) => {
    const item = lstatSync(dir); if (item.isSymbolicLink()) fail('PAYLOAD_SYMLINK_REFUSED');
    for (const name of readdirSync(dir)) {
      const path = join(dir,name), st = lstatSync(path);
      if (st.isSymbolicLink()) fail('PAYLOAD_SYMLINK_REFUSED');
      if (st.isDirectory()) walk(path); else if (st.isFile()) found.push(path.slice(root.length+1).replaceAll('\\','/'));
      else fail('PAYLOAD_ENTRY_INVALID');
    }
  };
  walk(root);
  const expected = [...Object.keys(sources),...Object.keys(runtimes)].sort();
  if (JSON.stringify(found.sort()) !== JSON.stringify(expected)) fail('PAYLOAD_FILE_SET_INVALID');
  for (const [relative, source] of Object.entries(sources)) {
    const expectedBytes = Buffer.isBuffer(source) ? source : readFileSync(source);
    if (sha(readFileSync(join(root,...relative.split('/')))) !== sha(expectedBytes)) fail('PAYLOAD_SOURCE_HASH_MISMATCH');
  }
  for (const [relative, pin] of Object.entries(runtimes)) {
    const path = join(root,...relative.split('/')), st = lstatSync(path);
    if (st.size !== pin.bytes || sha(readFileSync(path)) !== pin.sha256) fail('PAYLOAD_RUNTIME_HASH_MISMATCH');
  }
  return Object.freeze({ file_count: expected.length, source_count: Object.keys(sources).length,
    runtime_count: Object.keys(runtimes).length, sourceTrusted:false, authorityImplemented:false });
}

function readPlan(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) fail('PLAN_ABSOLUTE_PATH_REQUIRED');
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) fail('PLAN_PATH_NOT_FOUND');
    const item = lstatSync(cursor);
    if (item.isSymbolicLink()) fail('PLAN_SYMLINK_REFUSED');
    if (cursor === full && (!item.isFile() || item.size > 64 * 1024)) fail('PLAN_FILE_INVALID');
  }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(full))); }
  catch { fail('PLAN_JSON_INVALID'); }
}

export async function executeLivePlan(plan, {
  payloadValidator = validatePayload, transportFactory = createWsbStatefulTransport,
  campaignRunner = runCampaign,
} = {}) {
  if (!plan || Array.isArray(plan) || JSON.stringify(Object.keys(plan).sort()) !== JSON.stringify(KEYS))
    fail('PLAN_FIELDS_INVALID');
  if (plan.schema !== SCHEMA || !LIVE_POLICIES.includes(plan.policy)) fail('PLAN_CONTRACT_INVALID');
  for (const key of ['payload_root','export_root','output_dir'])
    if (typeof plan[key] !== 'string' || !isAbsolute(plan[key])) fail('PLAN_ABSOLUTE_PATH_REQUIRED');
  payloadValidator(plan.payload_root, { sources: payloadSourcesFor(plan.policy) });
  const transport = transportFactory({ payloadRoot: plan.payload_root, exportRoot: plan.export_root,
    runId: plan.run_id, sandboxId: plan.sandbox_id, policy: plan.policy });
  const exportRunDir = join(resolve(plan.export_root), plan.run_id);
  return campaignRunner({ runId: plan.run_id, sandboxId: plan.sandbox_id, policy: plan.policy,
    exportRunDir, outputDir: resolve(plan.output_dir),
    authProvenancePath: join(exportRunDir, 'guest-auth.json'), statefulTransport: transport,
    hostSourceSha256: hostSourceSha256() });
}

export async function runCli(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--plan') fail('USAGE_PLAN_ONLY');
  const result = await executeLivePlan(readPlan(args[1]));
  process.stdout.write(`W1B_CAMPAIGN=${result.status}\n`);
  return result.status === 'OFFLINE_CONSISTENT_UNATTESTED' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().then((code) => { process.exitCode = code; }, (error) => {
    const code = /^[A-Z][A-Z0-9_]{1,90}$/.test(error?.message) ? error.message : 'W1B_RUNNER_ERROR';
    process.stderr.write(`FAIL_CLOSED=${code}\n`); process.exitCode = 1;
  });
}
