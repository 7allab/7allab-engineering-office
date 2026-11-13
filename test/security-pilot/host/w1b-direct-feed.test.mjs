import {strict as assert} from 'node:assert';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {test} from 'node:test';
import {evaluateDirectFeed,runCli} from '../sandbox/w1b-direct-feed.mjs';
const fixture=resolve('fixtures/events.json');
function use(fn){const root=mkdtempSync(join(tmpdir(),'k205c-w1b-feed-'));try{return fn({root,output:join(root,'feed.json')});}finally{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));rmSync(root,{recursive:true,force:true});}}
function good(event,input){const raw=input.toString();if(event==='PermissionRequest')return{status:0,stdout:JSON.stringify({hookSpecificOutput:{hookEventName:'PermissionRequest',decision:{behavior:'deny',message:'blocked'}}}),stderr:''};if(raw.includes('readme.txt'))return{status:0,stdout:'',stderr:''};return{status:2,stdout:'',stderr:'blocked'};}
test('exact E01-E10 results preserve bounded raw streams and remain unattested',()=>use(f=>{const r=evaluateDirectFeed({projectDir:'C:\\work',outputPath:f.output,fixturePath:fixture,execute:good});assert.equal(r.status,'DIRECT_FEED_MATCHED_UNATTESTED');assert.equal(r.results.length,10);assert.equal(r.results[0].stderr,'blocked');assert.equal(r.results[9].stdout.includes('permission_request_deny_json'),false);assert.equal(r.authorityImplemented,false);assert.equal(JSON.parse(readFileSync(f.output)).max_claim,'ENFORCEMENT_DIRECT_FEED');}));
test('raw stdout and stderr have independent 1 MiB limits',()=>use(f=>{assert.throws(()=>evaluateDirectFeed({projectDir:'C:\\work',outputPath:f.output,fixturePath:fixture,execute:()=>({status:0,stdout:'x'.repeat(1024*1024+1),stderr:''})}),/STDOUT_OVERFLOW/);}));
test('one mismatch fails closed without inflating other rows',()=>use(f=>{let n=0;const r=evaluateDirectFeed({projectDir:'C:\\work',outputPath:f.output,fixturePath:fixture,execute:(...a)=>++n===1?{status:0,stdout:'',stderr:''}:good(...a)});assert.equal(r.status,'DIRECT_FEED_FAILED_CLOSED');assert.equal(r.results.filter(x=>!x.matched).length,1);}));
test('duplicate or incomplete fixture set is refused',()=>use(f=>{const x=JSON.parse(readFileSync(fixture));x.events.pop();const p=join(f.root,'bad.json');writeFileSync(p,JSON.stringify(x));assert.throws(()=>evaluateDirectFeed({projectDir:'C:\\work',outputPath:f.output,fixturePath:p,execute:good}),/FIXTURE_SET_INVALID/);}));
test('existing output is never overwritten',()=>use(f=>{writeFileSync(f.output,'KEEP');assert.throws(()=>evaluateDirectFeed({projectDir:'C:\\work',outputPath:f.output,fixturePath:fixture,execute:good}),/OUTPUT_ALREADY_EXISTS/);assert.equal(readFileSync(f.output,'utf8'),'KEEP');}));
test('CLI is guest-only and accepts no command surface',()=>{assert.throws(()=>runCli(['--execute','node']),/USAGE_PROJECT_OUTPUT_ONLY/);assert.throws(()=>runCli(['--project','C:\\work','--output','C:\\x']),/GUEST_CONTEXT_REQUIRED/);});
