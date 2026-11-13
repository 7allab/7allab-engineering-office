// K2-05-C R2-A injected-transport tests. No OS commands, WSB, shell or network.
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { captureAndCorrelate, syntheticStep } from './host-lifecycle.mjs';

const RUN = 'k205c-r2a-fixture';
const SANDBOX = '00000000-0000-0000-0000-000000000001';
const POLICY = 'p2-managed-hooks-only.test.json';
const sha = (data) => createHash('sha256').update(data).digest('hex').toUpperCase();
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'k205c-r2a-test-'));
  const runDir = join(base, 'export', RUN);
  mkdirSync(runDir, { recursive: true });
  const result = { schema: '7allab-k205c-sandbox-run/0.1', run_id: RUN,
    policy_file: POLICY, status: 'RUN_COMPLETED_UNATTESTED',
    evidence_kind: 'MOCK_ENDPOINT', claude_exit_code: 0, claude_timed_out: false,
    sourceTrusted: false, authorityImplemented: false, operationalAuthority: false };
  const authPath = join(base, 'guest-auth-provenance.json');
  const authBytes = Buffer.from(JSON.stringify({ auth_mode: 'MOCK_ENDPOINT', credential_kind: 'SYNTHETIC_SENTINEL',
    endpoint_kind: 'LOOPBACK_MOCK', source: 'RUNNER_ENVIRONMENT', observed_at: '2026-11-10T00:00:00.000Z' }));
  writeFileSync(authPath, authBytes);
  result.auth_mode = 'MOCK_ENDPOINT';
  result.auth_provenance = { credential_kind: 'SYNTHETIC_SENTINEL', endpoint_kind: 'LOOPBACK_MOCK',
    source: 'RUNNER_ENVIRONMENT', evidence_sha256: sha(authBytes), notes: 'synthetic loopback fixture' };
  const steps = [];
  const empty = JSON.stringify({ WindowsSandboxEnvironments: [] });
  const defaults = {
    preflight: () => syntheticStep({ stdout: empty, inventory_source: 'CURRENT_USER_WSB_CLI' }),
    start: () => syntheticStep({ stdout: JSON.stringify({Id:SANDBOX}) }),
    connect: () => syntheticStep(),
    waitForExport: () => syntheticStep(),
    stop: () => syntheticStep(),
    finalInventory: () => syntheticStep({stdout:empty, inventory_source: 'CURRENT_USER_WSB_CLI'}),
  };
  const transport = Object.fromEntries(Object.entries(defaults).map(([name, fn]) => [name, async (...args) => { steps.push(name); return fn(...args); }]));
  const f = { base, runDir, authPath, result, transport, steps, outputDir: join(base, 'fresh-output') };
  saveGuest(f);
  return f;
}
function saveGuest(f) {
  const content = Buffer.from(JSON.stringify(f.result) + '\n');
  writeFileSync(join(f.runDir, 'result.json'), content);
  const files = [{ relative_path: 'result.json', bytes: content.length, sha256: sha(content) }];
  const guestAuth = join(f.runDir, 'guest-auth.json');
  if (existsSync(guestAuth)) {
    const auth = readFileSync(guestAuth);
    files.push({ relative_path: 'guest-auth.json', bytes: auth.length, sha256: sha(auth) });
  }
  writeFileSync(join(f.runDir, 'MANIFEST.sha256.json'), JSON.stringify({
    run_id: RUN, files }));
  writeFileSync(join(f.runDir, 'EXPORT.COMPLETE.json'), JSON.stringify({run_id:RUN,file_count:files.length}));
}
async function withFixture(fn) {
  const f = fixture();
  try { return await fn(f); }
  finally {
    assert.ok(resolve(f.base).startsWith(resolve(tmpdir()) + sep));
    assert.ok(f.base.split(sep).pop().startsWith('k205c-r2a-test-'));
    rmSync(f.base, { recursive: true, force: true });
  }
}
function override(f, name, fn) {
  f.transport[name] = async (...args) => { f.steps.push(name); return fn(...args); };
}
const run = (f, extra={}) => captureAndCorrelate({ runId:RUN, sandboxId:SANDBOX,
  policy:POLICY, exportRunDir:f.runDir, outputDir:f.outputDir,
  authProvenancePath:f.authPath, transport:f.transport, ...extra });
function input(f) { return JSON.parse(readFileSync(join(f.outputDir,'runner-input.json'),'utf8')); }
function report(f) { return JSON.parse(readFileSync(join(f.outputDir,'offline-report','offline-correlation.json'),'utf8')); }

test('six captured lifecycle stages correlate with verified synthetic guest, never acceptance', async () => withFixture(async f => {
  const output = await run(f);
  assert.equal(output.status,'OFFLINE_CONSISTENT_UNATTESTED');
  assert.deepEqual(f.steps,['preflight','start','connect','waitForExport','stop','finalInventory']);
  assert.equal(input(f).events.length,6);
  assert.equal(report(f).export.host_manifest_verified,true);
  assert.equal(report(f).host.final_inventory.current_user_sessions_empty,true);
  assert.equal(report(f).host.final_inventory.system_wide_empty,'NOT_ATTESTED');
  assert.equal(input(f).events[0].inventory_source,'CURRENT_USER_WSB_CLI');
  assert.equal(report(f).host.auth.auth_mode,'MOCK_ENDPOINT');
  assert.equal(output.authorityImplemented,false);
  assert.equal(output.review_verified,false);
  assert.equal(existsSync(join(f.runDir, 'offline-correlation.json')),false);
}));

test('host source hashes and exact execution evidence survive correlation', async () => withFixture(async f => {
  const execution={executable:'C:\\fixed\\wsb.exe',argv:['list','--raw'],shell:false,source:'CURRENT_USER_WSB_CLI'};
  for(const name of ['preflight','start','connect','waitForExport','stop','finalInventory']) {
    const prior=f.transport[name]; f.transport[name]=async(...args)=>({...await prior(...args),execution:
      name==='waitForExport'?{executable:null,argv:[],shell:false,source:'INTERNAL_WAIT'}:execution});
  }
  const hashes=Object.fromEntries(['host/w1b-live-runner.mjs','host/campaign-driver.mjs',
    'host/wsb-stateful-transport.mjs','host/wsb-read-only-adapter.mjs'].map(x=>[x,'A'.repeat(64)]));
  await run(f,{hostSourceSha256:hashes});
  const captured=input(f), normalized=JSON.parse(readFileSync(join(f.outputDir,'offline-report','host-evidence','host-runner-evidence.json')));
  assert.deepEqual(captured.host_source_sha256,hashes);
  assert.deepEqual(captured.events[0].execution.argv,['list','--raw']);
  assert.deepEqual(normalized.host_source_sha256,hashes);
  assert.equal(normalized.events[3].execution.source,'INTERNAL_WAIT');
}));

test('preflight with another sandbox blocks start and preserves raw inventory', async () => withFixture(async f => {
  override(f,'preflight',()=>syntheticStep({stdout: JSON.stringify({WindowsSandboxEnvironments:[{Id:'OTHER'}]}), inventory_source:'CURRENT_USER_WSB_CLI'}));
  const v=await run(f);
  assert.equal(v.status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','finalInventory']);
  assert.equal(input(f).events[0].error_code,'PREFLIGHT_NOT_PROVEN_EMPTY');
  assert.match(readFileSync(input(f).events[0].stdout_path,'utf8'),/OTHER/);
}));

test('malformed initial inventory prevents starting any sandbox', async () => withFixture(async f => {
  override(f,'preflight',()=>syntheticStep({stdout:'not-json'}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','finalInventory']);
}));

test('nonzero preflight prevents any start or stop', async () => withFixture(async f => {
  override(f,'preflight',()=>syntheticStep({exit_code:7,error_code:'PREFLIGHT_FAILED',stderr:'raw fail'}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','finalInventory']);
  assert.equal(readFileSync(input(f).events[0].stderr_path,'utf8'),'raw fail');
}));

test('failed start still attempts stop and collects final inventory', async () => withFixture(async f => {
  override(f,'start',()=>syntheticStep({exit_code:13,error_code:'START_FAILED',stderr:'start stderr'}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','stop','finalInventory']);
  assert.equal(readFileSync(input(f).events[1].stderr_path,'utf8'),'start stderr');
}));

test('start with wrong sandbox ID refuses connect and still cleans up', async () => withFixture(async f => {
  override(f,'start',()=>syntheticStep({stdout:JSON.stringify({Id:'WRONG-ID'})}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','stop','finalInventory']);
  assert.equal(input(f).events[1].error_code,'SANDBOX_START_ID_UNVERIFIED');
}));

test('connect failure does not skip stop or final independent inventory', async () => withFixture(async f => {
  override(f,'connect',()=>syntheticStep({exit_code:5,error_code:'CONNECT_FAILED'}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','connect','stop','finalInventory']);
}));

test('connect timeout with zero exit remains fail closed and cleanup runs', async () => withFixture(async f => {
  override(f,'connect',()=>syntheticStep({timed_out:true,exit_code:0}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','connect','stop','finalInventory']);
  assert.equal(input(f).events[2].timed_out,true);
}));

test('wait failure still records stop and final inventory', async () => withFixture(async f => {
  override(f,'waitForExport',()=>syntheticStep({exit_code:124,timed_out:true,stderr:'wait timed out'}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','connect','waitForExport','stop','finalInventory']);
}));

test('future export directory may be published during the bounded wait phase', async () => withFixture(async f => {
  const auth = readFileSync(f.authPath);
  rmSync(f.runDir, { recursive: true, force: true });
  f.authPath = join(f.runDir, 'guest-auth.json');
  override(f,'waitForExport',()=> {
    mkdirSync(f.runDir, { recursive: true });
    writeFileSync(f.authPath, auth); saveGuest(f); return syntheticStep();
  });
  assert.equal((await run(f)).status,'OFFLINE_CONSISTENT_UNATTESTED');
  assert.deepEqual(f.steps,['preflight','start','connect','waitForExport','stop','finalInventory']);
}));

test('only the exact future exported guest provenance path is accepted', async () => withFixture(async f => {
  rmSync(f.authPath);
  await assert.rejects(run(f), /FUTURE_AUTH_PATH_INVALID/);
  assert.equal(f.steps.length, 0);
}));

test('missing future export fails closed after cleanup while preserving host evidence', async () => withFixture(async f => {
  rmSync(f.runDir, { recursive: true, force: true });
  override(f,'waitForExport',()=>syntheticStep({exit_code:124,timed_out:true,error_code:'EXPORT_TIMEOUT'}));
  const result = await run(f);
  assert.equal(result.status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','connect','waitForExport','stop','finalInventory']);
  assert.ok(result.reasons.includes('EXPORT_OR_GUEST_EXPORT_DIRECTORY_NOT_FOUND'));
  assert.equal(existsSync(join(f.outputDir,'runner-input.json')),true);
  assert.equal(existsSync(join(f.outputDir,'offline-report','offline-correlation.json')),true);
}));

test('thrown adapter errors are preserved as closed failures, not silent successes', async () => withFixture(async f => {
  override(f,'waitForExport',()=> { const e = new Error('ADAPTER_INTERRUPTED'); e.code='EPIPE'; throw e; });
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.equal(input(f).events[3].error_code,'EPIPE');
  assert.deepEqual(f.steps,['preflight','start','connect','waitForExport','stop','finalInventory']);
}));

test('failed stop and final inventory failures remain separate records', async () => withFixture(async f => {
  override(f,'stop',()=>syntheticStep({exit_code:1,error_code:'STOP_FAILED',stderr:'stop error'}));
  override(f,'finalInventory',()=>syntheticStep({exit_code:2,error_code:'FINAL_LIST_FAILED',stderr:'list error'}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.equal(input(f).events.at(-2).error_code,'STOP_FAILED');
  assert.equal(input(f).events.at(-1).error_code,'FINAL_LIST_FAILED');
}));

test('other sandbox in final list is INCONCLUSIVE, not globally empty', async () => withFixture(async f => {
  override(f,'finalInventory',()=>syntheticStep({stdout: JSON.stringify({WindowsSandboxEnvironments:[{Id:'other'}]}), inventory_source:'CURRENT_USER_WSB_CLI'}));
  const v=await run(f);
  assert.equal(v.status,'INCONCLUSIVE');
  assert.ok(v.reasons.includes('CURRENT_USER_WSB_INVENTORY_NOT_EMPTY'));
}));

test('missing auth provenance remains INCONCLUSIVE despite mock guest', async () => withFixture(async f => {
  const v=await run(f,{authProvenancePath:null});
  assert.equal(v.status,'INCONCLUSIVE');
  assert.equal(report(f).host.auth.auth_mode,null);
}));

test('guest result tampering fails without modifying export contents', async () => withFixture(async f => {
  writeFileSync(join(f.runDir,'result.json'),'{}');
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.equal(readFileSync(join(f.runDir,'result.json'),'utf8'),'{}');
}));

test('unverified guest success status cannot be claimed as consistent', async () => withFixture(async f => {
  f.result.claude_exit_code=37; saveGuest(f);
  assert.equal((await run(f)).status,'FAIL_CLOSED');
}));

test('existing output directory is never reused or clobbered', async () => withFixture(async f => {
  mkdirSync(f.outputDir); writeFileSync(join(f.outputDir,'keep.txt'),'KEEP');
  await assert.rejects(run(f),/OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(join(f.outputDir,'keep.txt'),'utf8'),'KEEP');
  assert.equal(f.steps.length,0);
}));

test('output inside export is forbidden before transport invoked', async () => withFixture(async f => {
  const forbidden=join(f.runDir,'report');
  await assert.rejects(run(f,{outputDir:forbidden}),/OUTPUT_EXPORT_OVERLAP/);
  assert.equal(existsSync(forbidden),false);
  assert.equal(f.steps.length,0);
}));

test('output ancestor of export is forbidden before transport invoked', async () => withFixture(async f => {
  await assert.rejects(run(f,{outputDir:join(f.base,'export')}),/OUTPUT_ALREADY_EXISTS|OUTPUT_EXPORT_OVERLAP/);
  assert.equal(f.steps.length,0);
}));

test('symlink in path is refused where supported', async t => withFixture(async f => {
  const symlink=join(f.base,'symlink-guest');
  try {symlinkSync(f.runDir,symlink,'dir');}
  catch(e) {if(['EPERM','EACCES','ENOTSUP'].includes(e.code)) return t.skip('symlink privilege unavailable'); throw e;}
  await assert.rejects(run(f,{exportRunDir:symlink}),/SYMLINK_PATH_REFUSED/);
  assert.equal(f.steps.length,0);
}));

test('invalid policy and malformed run IDs fail before output created', async () => withFixture(async f => {
  await assert.rejects(run(f,{policy:'not-a-real-policy.json'}),/POLICY_NOT_ALLOWLISTED/);
  await assert.rejects(run(f,{runId:'../evil'}),/INVALID_RUN_ID/);
  assert.equal(existsSync(f.outputDir),false);
}));

test('transport missing connect method fails closed, attempts cleanup', async () => withFixture(async f => {
  delete f.transport.connect;
  const v=await run(f);
  assert.equal(v.status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','start','stop','finalInventory']);
  assert.equal(input(f).events[2].error_code,'TRANSPORT_METHOD_MISSING');
}));

test('adapter falsely reports exit zero without timeout field: fail closed', async () => withFixture(async f => {
  override(f,'waitForExport',()=>({exit_code:0}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.equal(input(f).events[3].error_code,'ADAPTER_TIMEOUT_NOT_RECORDED');
}));

test('unexpectedly large adapter output fails closed and preserves cleanup path', async () => withFixture(async f => {
  override(f,'connect',()=>syntheticStep({stdout:'z'.repeat(1024*1024+1)}));
  assert.equal((await run(f)).status,'FAIL_CLOSED');
  assert.equal(input(f).events[2].error_code,'ADAPTER_LOG_TOO_LARGE');
  assert.deepEqual(f.steps,['preflight','start','connect','stop','finalInventory']);
}));

test('no real process execution is hidden in this module (source-level boundary)', async () => {
  const path = join(import.meta.dirname || new URL('.', import.meta.url).pathname,'host-lifecycle.mjs');
  const source=readFileSync(path,'utf8');
  const executable = source.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(executable,/\b(?:spawn|execFile|execSync|spawnSync)\s*\(/);
  assert.doesNotMatch(executable,/\b(?:powershell\.exe|wsb\.exe|Hyper-V)\b/i);
});

test('unknown preflight inventory source fails closed before start',async()=>withFixture(async f=>{
  override(f,'preflight',()=>syntheticStep({stdout:JSON.stringify({WindowsSandboxEnvironments:[]})}));
  const v=await run(f);
  assert.equal(v.status,'FAIL_CLOSED');
  assert.deepEqual(f.steps,['preflight','finalInventory']);
  assert.equal(input(f).events[0].error_code,'PREFLIGHT_NOT_PROVEN_EMPTY');
  assert.equal(v.authorityImplemented,false);
}));

test('missing final source cannot be inferred from empty stdout; records remain unattested',async()=>withFixture(async f=>{
  override(f,'finalInventory',()=>syntheticStep({stdout:JSON.stringify({WindowsSandboxEnvironments:[]})}));
  const v=await run(f);
  assert.equal(v.status,'INCONCLUSIVE');
  assert.ok(v.reasons.includes('FINAL_INVENTORY_INCONCLUSIVE'));
  assert.equal(report(f).host.final_inventory.reason,'INVENTORY_SOURCE_UNVERIFIED');
  assert.equal(input(f).events.at(-1).inventory_source,null);
  assert.equal(v.authorityImplemented,false);
}));

test('declaring global source in final transport does not yield system-wide proof',async()=>withFixture(async f=>{
  override(f,'finalInventory',()=>syntheticStep({
    stdout:JSON.stringify({WindowsSandboxEnvironments:[]}),inventory_source:'SYSTEM_WIDE'
  }));
  const v=await run(f);
  assert.equal(v.status,'INCONCLUSIVE');
  assert.equal(report(f).host.final_inventory.status,'INCONCLUSIVE');
  assert.equal(v.review_verified,false);
}));
