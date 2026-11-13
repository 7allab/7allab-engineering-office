import {strict as assert} from 'node:assert';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {indexRun,runCli} from './w1b-evidence-index.mjs';
function fixture(){const root=mkdtempSync(join(tmpdir(),'w1b-index-'));mkdirSync(join(root,'report','offline-report'),{recursive:true});writeFileSync(join(root,'plan.json'),JSON.stringify({schema:'7allab-k205c-w1b-live-plan/0.1',run_id:'fixture',sandbox_id:'00000000-0000-4000-8000-000000000001',policy:'p2-managed-hooks-only.test.json'}));writeFileSync(join(root,'report','offline-report','offline-correlation.json'),JSON.stringify({run_id:'fixture',status:'FAIL_CLOSED',reasons:['FIXTURE']}));return root;}
test('index hashes preserved evidence and never claims authority',async()=>{const root=fixture();try{const r=await indexRun({runRoot:root});assert.equal(r.status,'FAIL_CLOSED');assert.equal(r.file_count,2);assert.equal(r.authorityImplemented,false);assert.equal(JSON.parse(readFileSync(join(root,'review','EVIDENCE-INDEX.json'))).files.length,2);}finally{rmSync(root,{recursive:true,force:true});}});
test('existing review output and extra CLI surface are refused',async()=>{const root=fixture();try{await indexRun({runRoot:root});await assert.rejects(indexRun({runRoot:root}),/REVIEW_OUTPUT_ALREADY_EXISTS/);await assert.rejects(runCli(['--run-root',root,'--accept']),/USAGE_RUN_ROOT_ONLY/);}finally{rmSync(root,{recursive:true,force:true});}});
