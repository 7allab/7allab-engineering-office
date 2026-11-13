#!/usr/bin/env node
// Builds a hash-only review index without modifying the preserved run evidence.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const fail=(code)=>{throw new Error(code);};
function checkedRoot(path){
  if(typeof path!=='string'||!isAbsolute(path))fail('RUN_ROOT_ABSOLUTE_REQUIRED');
  const full=resolve(path),root=parse(full).root;let cursor=root;
  for(const part of full.slice(root.length).split(sep).filter(Boolean)){cursor=resolve(cursor,part);if(!existsSync(cursor))fail('RUN_ROOT_NOT_FOUND');const st=lstatSync(cursor);if(st.isSymbolicLink())fail('RUN_ROOT_SYMLINK_REFUSED');}
  if(!lstatSync(full).isDirectory())fail('RUN_ROOT_DIRECTORY_REQUIRED');return full;
}
function files(root){
  const output=[];const walk=(dir)=>{for(const name of readdirSync(dir)){if(dir===root&&name==='review')continue;const path=join(dir,name),st=lstatSync(path);if(st.isSymbolicLink())fail('EVIDENCE_SYMLINK_REFUSED');if(st.isDirectory())walk(path);else if(st.isFile())output.push(path);else fail('EVIDENCE_ENTRY_INVALID');}};walk(root);if(!output.length||output.length>200)fail('EVIDENCE_FILE_COUNT_INVALID');return output.sort();
}
function hashFile(path){return new Promise((done,reject)=>{const hash=createHash('sha256'),stream=createReadStream(path);stream.on('data',(chunk)=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>done(hash.digest('hex').toUpperCase()));});}
export async function indexRun({runRoot}){
  const root=checkedRoot(runRoot),review=join(root,'review');if(existsSync(review))fail('REVIEW_OUTPUT_ALREADY_EXISTS');
  let plan,correlation;try{plan=JSON.parse(readFileSync(join(root,'plan.json'),'utf8'));correlation=JSON.parse(readFileSync(join(root,'report','offline-report','offline-correlation.json'),'utf8'));}catch{fail('RUN_SUMMARY_INVALID');}
  if(plan?.schema!=='7allab-k205c-w1b-live-plan/0.1'||correlation?.run_id!==plan.run_id||!['FAIL_CLOSED','INCONCLUSIVE','OFFLINE_CONSISTENT_UNATTESTED'].includes(correlation?.status))fail('RUN_SUMMARY_CONTRACT_INVALID');
  const entries=[];for(const path of files(root)){const st=lstatSync(path);entries.push({relative_path:relative(root,path).replaceAll('\\','/'),bytes:st.size,sha256:await hashFile(path)});}
  const report={schema:'7allab-k205c-w1b-evidence-index/0.1',run_id:plan.run_id,sandbox_id:plan.sandbox_id,policy_file:plan.policy,status:correlation.status,reasons:correlation.reasons,file_count:entries.length,files:entries,sourceTrusted:false,authorityImplemented:false,operationalAuthority:false,review_verified:false};
  mkdirSync(review);writeFileSync(join(review,'EVIDENCE-INDEX.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});return report;
}
export async function runCli(args=process.argv.slice(2)){if(args.length!==2||args[0]!=='--run-root')fail('USAGE_RUN_ROOT_ONLY');const report=await indexRun({runRoot:args[1]});process.stdout.write(`EVIDENCE_INDEX=${report.status} FILES=${report.file_count}\n`);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){runCli().catch((error)=>{process.stderr.write(`FAIL_CLOSED=${error.message}\n`);process.exitCode=1;});}
