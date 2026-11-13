import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test} from 'node:test';
import {parseFinalInventory,parseAuthProvenance,recordEvidence,runCli} from './runner-evidence.mjs';
const NOW='2026-11-10T14:00:00.000Z';
const ID='fixture-r1';
function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'k205c-evidence-fixture-'));
  const stdout=join(dir,'wsb-final-stdout.txt');
  const stderr=join(dir,'wsb-final-stderr.txt');
  const auth=join(dir,'auth-provenance.json');
  const input=join(dir,'runner-input.json');
  writeFileSync(stdout,JSON.stringify({WindowsSandboxEnvironments:[]}));
  writeFileSync(stderr,'');
  writeFileSync(auth,JSON.stringify({auth_mode:'MOCK_ENDPOINT',credential_kind:'SYNTHETIC_SENTINEL',
    endpoint_kind:'LOOPBACK_MOCK',source:'RUNNER_ENVIRONMENT',observed_at:NOW}));
  const data={schema:'7allab-k205c-host-observability-input/0.1',run_id:ID,
    sandbox_id:'00000000-0000-0000-0000-000000000001',collected_at:NOW,
    events:[{phase:'SANDBOX_START',observed_at:NOW,timed_out:false,exit_code:0,
      stdout_path:null,stderr_path:null},
      {phase:'FINAL_INVENTORY',observed_at:NOW,timed_out:false,exit_code:0,
        sandbox_id:'00000000-0000-0000-0000-000000000001',inventory_source:'CURRENT_USER_WSB_CLI',
        stdout_path:stdout,stderr_path:stderr}],
    auth_provenance_path:auth};
  writeFileSync(input,JSON.stringify(data));
  return {dir,input,stdout,stderr,auth,data,out:join(dir,'new-report')};
}
async function useFixture(fn) {
  const f=fixture();
  try {await fn(f);} finally {
    const root=resolve(tmpdir())+sep;
    assert.ok(resolve(f.dir).startsWith(root) && f.dir.split(sep).pop().startsWith('k205c-evidence-fixture-'));
    rmSync(f.dir,{recursive:true,force:true});
  }
}
function update(f) {writeFileSync(f.input,JSON.stringify(f.data));}
test('raw WSB list is current-user scoped; cannot prove host-global absence',()=>{
  const id='00000000-0000-0000-0000-000000000001';
  const empty = parseFinalInventory('{"WindowsSandboxEnvironments":[]}',id,'CURRENT_USER_WSB_CLI');
  assert.deepEqual(empty,{
    inventory_scope:'CURRENT_USER_WSB_CLI',current_user_visible_count:0,
    owned_sandbox_absent_in_current_user_view:true,current_user_sessions_empty:true,
    system_wide_empty:'NOT_ATTESTED'});
  assert.equal(Object.hasOwn(empty,'all_sandboxes_absent'),false);
  const other='{ "WindowsSandboxEnvironments":[{"Id":"00000000-0000-0000-0000-000000000002"}] }';
  const visible = parseFinalInventory(other,id,'CURRENT_USER_WSB_CLI');
  assert.equal(visible.current_user_visible_count,1);
  assert.equal(visible.owned_sandbox_absent_in_current_user_view,true);
  assert.equal(visible.current_user_sessions_empty,false);
  assert.equal(visible.system_wide_empty,'NOT_ATTESTED');
});
test('malformed/ambiguous/duplicate sandbox list fails closed',()=>{
  const id='00000000-0000-0000-0000-000000000001';
  for(const raw of ['garbage','{}','{"WindowsSandboxEnvironments":null}',
    '{"WindowsSandboxEnvironments":[{}]}',
    '{"WindowsSandboxEnvironments":[{"Id":"x"},{"Id":"x"}]}']) {
      assert.throws(()=>parseFinalInventory(raw,id,'CURRENT_USER_WSB_CLI'));
    }
});
test('auth is separately declared, never inferred from evidence_kind; REAL refused',()=>{
  const a={auth_mode:'MOCK_ENDPOINT',credential_kind:'SYNTHETIC_SENTINEL',endpoint_kind:'LOOPBACK_MOCK',source:'RUNNER_ENVIRONMENT',observed_at:NOW};
  assert.equal(parseAuthProvenance(a).auth_mode,'MOCK_ENDPOINT');
  for(const wrong of [
    {...a,auth_mode:'REAL',credential_kind:'REAL_CREDENTIAL',endpoint_kind:'REAL_SERVICE'},
    {...a,credential_kind:'NONE'},
    {...a,source:'TEMPLATE_DEFAULT'},
    {...a,api_key:'secret'}]) assert.throws(()=>parseAuthProvenance(wrong));
});
test('report success records unattested status and raw SHA-bound inventory and auth',async()=>useFixture((f)=>{
  const v=recordEvidence(f.input,f.out);
  assert.equal(v.status,'EVIDENCE_COLLECTED_UNATTESTED');
  assert.equal(v.final_inventory.current_user_sessions_empty,true);
  assert.equal(v.final_inventory.system_wide_empty,'NOT_ATTESTED');
  assert.equal(v.events[1].inventory_source,'CURRENT_USER_WSB_CLI');
  assert.equal(v.events[1].stdout.sha256,
    createHash('sha256').update(readFileSync(f.stdout)).digest('hex').toUpperCase());
  assert.equal(v.auth.status,'RECORDED_UNATTESTED');
  assert.equal(v.auth.auth_mode,'MOCK_ENDPOINT');
  assert.equal(v.authorityImplemented,false);
  assert.equal(v.review_verified,false);
  assert.ok(existsSync(join(f.out,v.events[1].stdout.path)));
  assert.ok(existsSync(join(f.out,'INPUT.sha256')));
  assert.equal(JSON.parse(readFileSync(join(f.out,'host-runner-evidence.json'),'utf8')).run_id,ID);
}));
test('existing output directory is never reused/overwritten',async()=>useFixture((f)=>{
  mkdirSync(f.out);
  writeFileSync(join(f.out,'keep.txt'),'user file');
  assert.throws(()=>recordEvidence(f.input,f.out),/OUTPUT_ALREADY_EXISTS/);
  assert.equal(readFileSync(join(f.out,'keep.txt'),'utf8'),'user file');
}));
test('missing final inventory is NOT_RECORDED',async()=>useFixture((f)=>{
  f.data.events.pop(); update(f);
  assert.equal(recordEvidence(f.input,f.out).final_inventory.status,'NOT_RECORDED');
}));
test('nonzero final inventory command is INCONCLUSIVE (never global empty)',async()=>useFixture((f)=>{
  f.data.events[1].exit_code=1; update(f);
  assert.equal(recordEvidence(f.input,f.out).final_inventory.status,'INCONCLUSIVE');
}));
test('invalid inventory JSON is INCONCLUSIVE with preserved raw bytes',async()=>useFixture((f)=>{
  writeFileSync(f.stdout,'not-json');
  const v=recordEvidence(f.input,f.out);
  assert.equal(v.final_inventory.status,'INCONCLUSIVE');
  assert.equal(readFileSync(join(f.out,v.events[1].stdout.path),'utf8'),'not-json');
}));
test('nonzero stage preserves error/exit code and raw logs',async()=>useFixture((f)=>{
  f.data.events[0].exit_code=null;
  f.data.events[0].error_code='SANDBOX_START_FAILED';
  f.data.events[0].stdout_path=f.stdout;update(f);
  const v=recordEvidence(f.input,f.out);
  assert.equal(v.events[0].outcome,'NOT_SUCCESS');
  assert.equal(v.events[0].error_code,'SANDBOX_START_FAILED');
  assert.equal(v.events[0].stdout.bytes,readFileSync(f.stdout).length);
}));
test('timeout cannot masquerade as successful zero exit',async()=>useFixture((f)=>{
  f.data.events[0].timed_out=true;update(f);
  assert.equal(recordEvidence(f.input,f.out).events[0].outcome,'NOT_SUCCESS');
}));
test('final inventory must identify same owned Sandbox',async()=>useFixture((f)=>{
  f.data.events[1].sandbox_id='00000000-0000-0000-0000-000000000002'; update(f);
  assert.throws(()=>recordEvidence(f.input,f.out),/INVENTORY_SANDBOX_ID_MISMATCH/);
}));
test('duplicate final inventory records rejected',async()=>useFixture((f)=>{
  f.data.events.push({...f.data.events[1]});update(f);
  assert.throws(()=>recordEvidence(f.input,f.out),/MULTIPLE_FINAL_INVENTORIES/);
}));
test('missing auth evidence remains NOT_RECORDED, not MOCK_ENDPOINT',async()=>useFixture((f)=>{
  delete f.data.auth_provenance_path;update(f);
  const v=recordEvidence(f.input,f.out);
  assert.equal(v.auth.status,'NOT_RECORDED');
  assert.equal(v.auth.auth_mode,null);
}));
test('auth file mismatch refuses valid-looking evidence record',async()=>useFixture((f)=>{
  writeFileSync(f.auth,JSON.stringify({auth_mode:'MOCK_ENDPOINT',credential_kind:'NONE',endpoint_kind:'LOOPBACK_MOCK',source:'RUNNER_ENVIRONMENT',observed_at:NOW}));
  assert.throws(()=>recordEvidence(f.input,f.out),/MOCK_AUTH_MISMATCH/);
}));
test('symbolic link input is rejected',async()=>useFixture((f)=>{
  const link=join(f.dir,'link.json');
  try {symlinkSync(f.input,link);} catch {return;}
  assert.throws(()=>recordEvidence(link,f.out),/SYMLINK_PATH_REFUSED/);
}));
test('CLI refuses extra flags; no command execution code path',()=>{
  assert.throws(()=>runCli(['--execute','wsb']),/USAGE_INPUT_OUTPUT_ONLY/);
});

test('inventory parser refuses absent, unknown, or falsely global source declarations',()=>{
  const id='00000000-0000-0000-0000-000000000001';
  const raw='{"WindowsSandboxEnvironments":[]}';
  for(const source of [undefined,null,'','GLOBAL_WSB_CLI','SYSTEM_WIDE','CURRENT_USER_WSB_CLI ']) {
    assert.throws(()=>parseFinalInventory(raw,id,source),/INVENTORY_SOURCE_UNVERIFIED/);
  }
});

test('final list with undeclared source is INCONCLUSIVE and preserves SHA-bound raw stdout',async()=>useFixture((f)=>{
  delete f.data.events[1].inventory_source;update(f);
  const v=recordEvidence(f.input,f.out);
  assert.equal(v.final_inventory.status,'INCONCLUSIVE');
  assert.equal(v.final_inventory.reason,'INVENTORY_SOURCE_UNVERIFIED');
  assert.equal(v.events[1].inventory_source,null);
  const saved=readFileSync(join(f.out,v.events[1].stdout.path));
  assert.deepEqual(saved,readFileSync(f.stdout));
  assert.equal(v.events[1].stdout.sha256,createHash('sha256').update(saved).digest('hex').toUpperCase());
  assert.equal(v.authorityImplemented,false);
}));

test('final inventory with forged global source stays INCONCLUSIVE',async()=>useFixture((f)=>{
  f.data.events[1].inventory_source='SYSTEM_WIDE';update(f);
  const v=recordEvidence(f.input,f.out);
  assert.equal(v.final_inventory.status,'INCONCLUSIVE');
  assert.equal(v.events[1].inventory_source,'SYSTEM_WIDE');
  assert.equal(v.events[1].outcome,'COMMAND_EXIT_ZERO');
}));
