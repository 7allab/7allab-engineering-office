// W1b source-only tests with fake child processes. No WSB or host process is launched.
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { buildSandboxConfig, createWsbStatefulTransport } from './wsb-stateful-transport.mjs';

const RUN='k205c-w1b-fixture', POLICY='p2-managed-hooks-only.test.json';
const ID='00000000-0000-4000-8000-000000000001';
class Child extends EventEmitter {
  constructor({ stdout='', stderr='', code=0, background=false, error=false }={}) {
    super(); this.stdout=new PassThrough(); this.stderr=new PassThrough(); this.killed=false; this.closed=false;
    queueMicrotask(() => {
      if (error) { this.emit('error', new Error('spawn')); return this.kill(); }
      this.emit('spawn');
      if (stdout) this.stdout.write(stdout); if (stderr) this.stderr.write(stderr);
      if (!background) this.close(code);
    });
  }
  close(code=null) { if (this.closed) return; this.closed=true; this.stdout.end(); this.stderr.end(); this.emit('close',code,null); }
  kill() { this.killed=true; queueMicrotask(()=>this.close(null)); return true; }
}
function fixture() {
  const base=mkdtempSync(join(tmpdir(),'k205c-w1b-source-'));
  const payload=join(base,'payload'), output=join(base,'export'); mkdirSync(payload); mkdirSync(output);
  for (const name of ['bin/node.exe','bin/claude.exe',`policies/${POLICY}`,'sandbox/w1b-run.ps1',
    'sandbox/guest-auth-provenance.mjs','sandbox/guest-result-finalize.mjs','sandbox/export-manifest.ps1']) {
    const path=join(payload,...name.split('/')); mkdirSync(resolve(path,'..'),{recursive:true}); writeFileSync(path,'fixture');
  }
  const calls=[], queue=[], children=[];
  const spawnImpl=(file,args,options)=>{ const child=new Child(queue.shift()); children.push(child); calls.push({file,args,options}); return child; };
  const identityProvider=async()=>({});
  const binaryValidator=async()=>({alias_path:'C:\\fixed\\wsb.exe'});
  const make=(extra={})=>createWsbStatefulTransport({payloadRoot:payload,exportRoot:output,
    runId:RUN,sandboxId:ID,policy:POLICY,identityProvider,binaryValidator,spawnImpl,...extra});
  return {base,payload,output,calls,queue,children,make};
}
async function use(fn){const f=fixture();try{return await fn(f);}finally{assert.ok(resolve(f.base).startsWith(resolve(tmpdir())+sep));rmSync(f.base,{recursive:true,force:true});}}
const args={runId:RUN,sandboxId:ID,policy:POLICY};

test('config is closed by default with exactly two bounded mappings',()=>use(f=>{
  const value=buildSandboxConfig({payloadRoot:f.payload,exportRoot:f.output,runId:RUN,policy:POLICY});
  assert.match(value,/<Networking>Disable<\/Networking>/); assert.match(value,/<ProtectedClient>Enable<\/ProtectedClient>/);
  assert.equal((value.match(/<MappedFolder>/g)||[]).length,2); assert.match(value,/<ReadOnly>true<\/ReadOnly>/);
  assert.match(value,/w1b-run\.ps1/); assert.doesNotMatch(value,/Enable<\/Networking>|<ClipboardRedirection>Enable/);
}));

test('start and stop use only fixed arguments and shell false',()=>use(async f=>{
  f.queue.push({stdout:JSON.stringify({Id:ID})},{code:0}); const t=f.make();
  const started=await t.start(args), stopped=await t.stop(args);
  assert.equal(started.exit_code,0); assert.equal(stopped.exit_code,0);
  assert.deepEqual(started.execution.argv.slice(0,3),['start','--id',ID]);
  assert.deepEqual(stopped.execution,{executable:'C:\\fixed\\wsb.exe',argv:['stop','--id',ID],shell:false,source:'WSB_CLI'});
  assert.deepEqual(f.calls[0].args.slice(0,3),['start','--id',ID]); assert.equal(f.calls[0].args[3],'--config');
  assert.equal(f.calls[0].args.at(-1),'--raw'); assert.deepEqual(f.calls[1].args,['stop','--id',ID]);
  assert.equal(f.calls[0].options.shell,false); assert.equal(f.calls[1].options.shell,false);
}));

test('binary validation failure prevents every spawn',()=>use(async f=>{
  const t=f.make({binaryValidator:async()=>{throw new Error('TARGET_BINARY_HASH_CHANGED');}});
  await assert.rejects(t.start(args),/TARGET_BINARY_HASH_CHANGED/); assert.equal(f.calls.length,0);
}));

test('nonzero, spawn error and stderr are distinct closed failures',()=>use(async f=>{
  f.queue.push({code:9}); let t=f.make(); assert.equal((await t.start(args)).error_code,'START_NONZERO_EXIT');
  f=fixture(); try { f.queue.push({error:true}); t=f.make(); assert.equal((await t.start(args)).error_code,'START_SPAWN_ERROR'); }
  finally { rmSync(f.base,{recursive:true,force:true}); }
  f=fixture(); try { f.queue.push({stderr:'warning'}); t=f.make(); assert.equal((await t.start(args)).error_code,'START_STDERR_NOT_EMPTY'); }
  finally { rmSync(f.base,{recursive:true,force:true}); }
}));

test('stdout overflow is bounded and kills the child',()=>use(async f=>{
  f.queue.push({stdout:Buffer.alloc(1024*1024+1,65)}); const result=await f.make().start(args);
  assert.equal(result.error_code,'START_STDOUT_OVERFLOW'); assert.equal(result.stdout.length,1024*1024);
}));

test('stderr overflow and command timeout remain separately classified',()=>use(async f=>{
  f.queue.push({stderr:Buffer.alloc(1024*1024+1,65)}); let t=f.make();
  let result=await t.start(args); assert.equal(result.error_code,'START_STDERR_OVERFLOW'); assert.equal(result.stderr.length,1024*1024);
  f=fixture(); try {
    let timer=0; const timers={setTimeout:(fn)=>{timer++; if(timer===1) queueMicrotask(fn); return timer;},clearTimeout:()=>{}};
    f.queue.push({background:true}); t=f.make({timers}); result=await t.start(args);
    assert.equal(result.error_code,'START_TIMEOUT'); assert.equal(result.timed_out,true);
  } finally { rmSync(f.base,{recursive:true,force:true}); }
}));

test('background connect, exact completion and stop preserve owned ID',()=>use(async f=>{
  f.queue.push({stdout:JSON.stringify({Id:ID})},{background:true},{code:0}); const t=f.make();
  assert.equal((await t.start(args)).error_code,null); assert.equal((await t.connect(args)).error_code,null);
  const run=join(f.output,RUN); mkdirSync(run); writeFileSync(join(run,'EXPORT.COMPLETE.json'),JSON.stringify({run_id:RUN,file_count:1}));
  assert.equal((await t.waitForExport(args)).error_code,null); assert.equal((await t.stop(args)).error_code,null);
  assert.deepEqual(f.calls[1].args,['connect','--id',ID]); assert.deepEqual(f.calls[2].args,['stop','--id',ID]);
  assert.equal(f.children[1].killed,true); assert.equal(f.children[1].closed,true);
}));

test('connect early exit fails closed',()=>use(async f=>{
  f.queue.push({stdout:JSON.stringify({Id:ID})},{code:0}); const t=f.make(); await t.start(args);
  assert.equal((await t.connect(args)).error_code,'CONNECT_EARLY_EXIT');
}));

test('wrong start ID blocks connect but still permits owned-ID stop',()=>use(async f=>{
  f.queue.push({stdout:JSON.stringify({Id:'00000000-0000-4000-8000-000000000099'})},{code:0});
  const t=f.make(); assert.equal((await t.start(args)).error_code,null);
  await assert.rejects(t.connect(args),/CONNECT_STATE_INVALID/);
  assert.equal((await t.stop(args)).error_code,null); assert.deepEqual(f.calls[1].args,['stop','--id',ID]);
}));

test('invalid completion is distinct and cleanup remains available',()=>use(async f=>{
  f.queue.push({stdout:JSON.stringify({Id:ID})},{background:true},{code:0}); const t=f.make();
  await t.start(args); await t.connect(args); const run=join(f.output,RUN); mkdirSync(run);
  writeFileSync(join(run,'EXPORT.COMPLETE.json'),JSON.stringify({run_id:'wrong',file_count:1}));
  assert.equal((await t.waitForExport(args)).error_code,'EXPORT_COMPLETION_INVALID');
  assert.equal((await t.stop(args)).error_code,null);
}));

test('oversized completion is refused before JSON processing',()=>use(async f=>{
  f.queue.push({stdout:JSON.stringify({Id:ID})},{background:true},{code:0}); const t=f.make();
  await t.start(args); await t.connect(args); const run=join(f.output,RUN); mkdirSync(run);
  writeFileSync(join(run,'EXPORT.COMPLETE.json'),Buffer.alloc(128*1024+1,32));
  assert.equal((await t.waitForExport(args)).error_code,'EXPORT_COMPLETION_INVALID');
  assert.equal((await t.stop(args)).error_code,null);
}));

test('wait timeout is separate and does not stop implicitly',()=>use(async f=>{
  let tick=0; f.queue.push({stdout:JSON.stringify({Id:ID})},{background:true});
  const t=f.make({clock:()=>tick++ ? 240001 : 0,sleep:async()=>{}}); await t.start(args); await t.connect(args);
  const result=await t.waitForExport(args); assert.equal(result.error_code,'EXPORT_TIMEOUT'); assert.equal(result.timed_out,true);
  assert.equal(f.calls.length,2);
}));

test('call mismatch, path overlap and nonempty export are refused',()=>use(async f=>{
  const t=f.make(); await assert.rejects(t.start({...args,policy:'p1-baseline.test.json'}),/CAMPAIGN_CALL_MISMATCH/);
  writeFileSync(join(f.output,'existing'),'x'); assert.throws(()=>buildSandboxConfig({payloadRoot:f.payload,exportRoot:f.output,runId:RUN,policy:POLICY}),/EXPORT_ROOT_NOT_EMPTY/);
  assert.throws(()=>buildSandboxConfig({payloadRoot:f.payload,exportRoot:f.payload,runId:RUN,policy:POLICY}),/MAPPING_PATH_OVERLAP/);
}));

test('transport exposes exactly four methods and no CLI surface',()=>use(f=>{
  const t=f.make(); assert.deepEqual(Object.keys(t).sort(),['connect','start','stop','waitForExport']);
}));
