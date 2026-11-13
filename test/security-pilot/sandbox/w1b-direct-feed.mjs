#!/usr/bin/env node
// W1b guest-only E01-E10 evaluator. Direct feed is never live enforcement evidence.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = 'C:\\payload\\fixtures\\events.json';
const GUARD = 'C:\\payload\\scripts\\guard.mjs';
const ADAPTER = 'C:\\payload\\scripts\\decision-gate-event-adapter.mjs';
const IDS = ['E01_write_unauth','E02_edit_unauth','E03_bash_unauth','E04_powershell_unauth','E05_read_inside','E06_read_outside','E07_glob_unverified','E08_not_json','E09_schema_missing_fields','E10_permission_request_write'];
const MAX_STREAM=1024*1024;
const fail=(code)=>{throw new Error(code);};
const sha=(value)=>createHash('sha256').update(value).digest('hex').toUpperCase();
function bounded(path,max=1024*1024){const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.size>max)fail('INPUT_FILE_INVALID');return readFileSync(path);}
function stream(value,label){const text=String(value??'');if(Buffer.byteLength(text)>MAX_STREAM)fail(`${label}_OVERFLOW`);return text;}
function denyJson(value){try{const j=JSON.parse(value),h=j?.hookSpecificOutput;return h?.hookEventName==='PermissionRequest'&&h?.decision?.behavior==='deny'&&typeof h.decision.message==='string';}catch{return false;}}

export function evaluateDirectFeed({projectDir,outputPath,fixturePath=FIXTURES,execute=(event,input)=>spawnSync(process.execPath,[GUARD,ADAPTER,'--event',event],{input,encoding:'utf8',timeout:15000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,CLAUDE_PROJECT_DIR:projectDir}})}){
  if(typeof projectDir!=='string'||!isAbsolute(projectDir)||typeof outputPath!=='string'||!isAbsolute(outputPath))fail('ABSOLUTE_PATH_REQUIRED');
  if(existsSync(outputPath))fail('OUTPUT_ALREADY_EXISTS');
  let data;try{data=JSON.parse(bounded(fixturePath).toString('utf8'));}catch{fail('FIXTURE_INVALID');}
  if(!Array.isArray(data?.events)||data.events.length!==10)fail('FIXTURE_SET_INVALID');
  const seen=new Set(),results=[];
  for(const item of data.events){
    if(!IDS.includes(item?.id)||seen.has(item.id)||!item.expect)fail('FIXTURE_SET_INVALID');seen.add(item.id);
    const text=item.raw??JSON.stringify(item.event).replaceAll('{{PROJECT}}',projectDir.replaceAll('\\','\\\\'));
    const input=Buffer.from(text),event=item.run_with==='--event PermissionRequest'?'PermissionRequest':'PreToolUse';
    let run;try{run=execute(event,input);}catch(error){run={status:null,stdout:'',stderr:String(error?.message||'EXECUTE_ERROR'),error};}
    const stdout=stream(run?.stdout,'STDOUT'),stderr=stream(run?.stderr,'STDERR');
    const matched=run?.status===item.expect.exit&&
      (item.expect.stdout_empty!==true||stdout==='')&&
      (item.expect.stdout_is!=='permission_request_deny_json'||denyJson(stdout));
    results.push({id:item.id,event,input_sha256:sha(input),exit_code:Number.isSafeInteger(run?.status)?run.status:null,
      stdout,stderr,stdout_sha256:sha(stdout),stderr_sha256:sha(stderr),matched});
  }
  if(seen.size!==10)fail('FIXTURE_SET_INVALID');
  const report={schema:'7allab-k205c-w1b-direct-feed/0.1',status:results.every(x=>x.matched)?'DIRECT_FEED_MATCHED_UNATTESTED':'DIRECT_FEED_FAILED_CLOSED',
    evidence_kind:'DIRECT_FEED',max_claim:'ENFORCEMENT_DIRECT_FEED',results,sourceTrusted:false,authorityImplemented:false,operationalAuthority:false,review_verified:false};
  writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});return report;
}
export function runCli(args=process.argv.slice(2)){
  if(args.length!==4||args[0]!=='--project'||args[2]!=='--output')fail('USAGE_PROJECT_OUTPUT_ONLY');
  if(process.env.USERNAME!=='WDAGUtilityAccount')fail('GUEST_CONTEXT_REQUIRED');
  const report=evaluateDirectFeed({projectDir:args[1],outputPath:args[3]});process.stdout.write(`DIRECT_FEED=${report.status}\n`);return report.status.endsWith('UNATTESTED')?0:1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{process.exitCode=runCli();}catch(e){process.stderr.write(`FAIL_CLOSED=${e.message}\n`);process.exitCode=1;}}
