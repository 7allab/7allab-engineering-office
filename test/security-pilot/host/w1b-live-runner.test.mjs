import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { executeLivePlan, runCli, validatePayload } from './w1b-live-runner.mjs';
import { readFileSync } from 'node:fs';

const plan = { schema:'7allab-k205c-w1b-live-plan/0.1', run_id:'w1b-fixture',
  sandbox_id:'00000000-0000-4000-8000-000000000001', policy:'p2-managed-hooks-only.test.json',
  payload_root:'C:\\payload-source', export_root:'C:\\fresh-export', output_dir:'C:\\fresh-report' };

test('exact plan derives future export and guest provenance paths', async () => {
  let transportArgs, campaignArgs;
  const transport = Object.freeze({start(){},connect(){},waitForExport(){},stop(){}});
  const result = await executeLivePlan(plan, {
    payloadValidator: () => {},
    transportFactory: (value) => { transportArgs=value; return transport; },
    campaignRunner: async (value) => { campaignArgs=value; return {status:'INCONCLUSIVE',authorityImplemented:false}; },
  });
  assert.equal(transportArgs.policy,'p2-managed-hooks-only.test.json');
  assert.equal(campaignArgs.exportRunDir,'C:\\fresh-export\\w1b-fixture');
  assert.equal(campaignArgs.authProvenancePath,'C:\\fresh-export\\w1b-fixture\\guest-auth.json');
  assert.equal(campaignArgs.statefulTransport,transport);
  assert.deepEqual(Object.keys(campaignArgs.hostSourceSha256).sort(),[
    'host/campaign-driver.mjs','host/w1b-live-runner.mjs',
    'host/wsb-read-only-adapter.mjs','host/wsb-stateful-transport.mjs']);
  assert.ok(Object.values(campaignArgs.hostSourceSha256).every(x=>/^[A-F0-9]{64}$/.test(x)));
  assert.equal(result.authorityImplemented,false);
});

test('unknown fields and non-p2 policy fail before factories run', async () => {
  let called=false; const deps={payloadValidator:()=>{called=true;},transportFactory:()=>{called=true;},campaignRunner:()=>{called=true;}};
  await assert.rejects(executeLivePlan({...plan,command:'powershell'},deps),/PLAN_FIELDS_INVALID/);
  await assert.rejects(executeLivePlan({...plan,policy:'p1-baseline.test.json'},deps),/PLAN_CONTRACT_INVALID/);
  assert.equal(called,false);
});

test('all host paths must be absolute', async () => {
  await assert.rejects(executeLivePlan({...plan,output_dir:'relative'},{payloadValidator:()=>{}}),/PLAN_ABSOLUTE_PATH_REQUIRED/);
});

test('CLI exposes only one bounded plan-file argument', async () => {
  await assert.rejects(runCli(['--payload','C:\\x']),/USAGE_PLAN_ONLY/);
  await assert.rejects(runCli(['--plan','C:\\x','--command','calc']),/USAGE_PLAN_ONLY/);
});

test('payload file set and every staged byte are hash bound', () => {
  const base=mkdtempSync(join(tmpdir(),'w1b-payload-')), payload=join(base,'payload'), source=join(base,'source.txt');
  try {
    mkdirSync(join(payload,'bin'),{recursive:true}); writeFileSync(source,'source');
    writeFileSync(join(payload,'source.txt'),'source'); writeFileSync(join(payload,'bin','node.exe'),'N');
    const digest=createHash('sha256').update('N').digest('hex').toUpperCase();
    const options={sources:{'source.txt':source},runtimes:{'bin/node.exe':{bytes:1,sha256:digest}}};
    assert.equal(validatePayload(payload,options).file_count,2);
    writeFileSync(join(payload,'source.txt'),'changed'); assert.throws(()=>validatePayload(payload,options),/PAYLOAD_SOURCE_HASH_MISMATCH/);
    writeFileSync(join(payload,'source.txt'),'source'); writeFileSync(join(payload,'extra.txt'),'x');
    assert.throws(()=>validatePayload(payload,options),/PAYLOAD_FILE_SET_INVALID/);
  } finally { rmSync(base,{recursive:true,force:true}); }
});

test('default payload binds the p2 probe and its import dependency', () => {
  const source=readFileSync(new URL('./w1b-live-runner.mjs',import.meta.url),'utf8');
  assert.match(source,/'hooks\/_marker\.mjs': join\(PACKAGE,'hooks','_marker\.mjs'\)/);
  assert.match(source,/'hooks\/probe-marker\.mjs': join\(PACKAGE,'hooks','probe-marker\.mjs'\)/);
});
