// K2-05-C R1 — offline host evidence normalizer. No Sandbox/Hyper-V/process execution.
// This consumes independently captured runner outputs; it cannot attest those observations.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase();
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const phases = new Set(['PREFLIGHT', 'SANDBOX_START', 'CONNECT', 'WAIT_FOR_EXPORT', 'SANDBOX_STOP', 'FINAL_INVENTORY', 'EXPORT_VERIFY', 'HOST_ERROR']);
const authModes = new Set(['NONE', 'MOCK_ENDPOINT', 'REAL']);
const authKinds = new Set(['NONE', 'SYNTHETIC_SENTINEL', 'REAL_CREDENTIAL']);
const endpointKinds = new Set(['NONE', 'LOOPBACK_MOCK', 'REAL_SERVICE']);
const hostSources = ['host/w1b-live-runner.mjs','host/campaign-driver.mjs',
  'host/wsb-stateful-transport.mjs','host/wsb-read-only-adapter.mjs'];

function fail(code) { throw new Error(code); }
function nonempty(value, label) { if (typeof value !== 'string' || value.trim() === '') fail(label); return value; }
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))) fail('INVALID_UTC_TIMESTAMP');
  return value;
}
function checkedPath(path, {kind='file', mayBeAbsent=false}={}) {
  nonempty(path, 'PATH_REQUIRED');
  if (!isAbsolute(path)) fail('ABSOLUTE_PATH_REQUIRED');
  const full=resolve(path), root=parse(full).root;
  let current=full;
  while (true) {
    if (existsSync(current)) {
      const st=lstatSync(current);
      if (st.isSymbolicLink()) fail('SYMLINK_PATH_REFUSED');
      if (current===full && kind==='file' && !st.isFile()) fail('NOT_REGULAR_FILE');
      if (current===full && kind==='dir' && !st.isDirectory()) fail('NOT_DIRECTORY');
    } else if (!mayBeAbsent || current!==full) {
      fail('PATH_NOT_FOUND');
    }
    if (current===root) break;
    const next=dirname(current);
    if (next===current) fail('PATH_ANCESTRY_ERROR');
    current=next;
  }
  return full;
}
function checkedRead(path,maxBytes=1024*1024) {
  const full=checkedPath(path);
  const st=lstatSync(full);
  if (st.size>maxBytes) fail('SOURCE_SIZE_LIMIT');
  return readFileSync(full);
}
function checkedJson(bytes, reason) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { fail(reason); }
}
// `wsb list --raw` describes the invoking user's visible sessions, NOT all host sessions.
// The source is explicit metadata from the caller; it is NOT independently attested here.
export function parseFinalInventory(raw, expectedSandboxId, inventorySource) {
  if (inventorySource !== 'CURRENT_USER_WSB_CLI') fail('INVENTORY_SOURCE_UNVERIFIED');
  if (!idPattern.test(nonempty(expectedSandboxId,'SANDBOX_ID_REQUIRED'))) fail('INVALID_SANDBOX_ID');
  const data=typeof raw==='string' ? checkedJson(Buffer.from(raw), 'INVENTORY_JSON_INVALID') : raw;
  if (!data || !Object.prototype.hasOwnProperty.call(data,'WindowsSandboxEnvironments') ||
    !Array.isArray(data.WindowsSandboxEnvironments)) fail('INVENTORY_SCHEMA_INVALID');
  const seen=new Set();
  const ids=data.WindowsSandboxEnvironments.map((item)=>{
    if (!item || typeof item.Id !== 'string' || !idPattern.test(item.Id) || seen.has(item.Id)) fail('INVENTORY_ID_INVALID');
    seen.add(item.Id);
    return item.Id;
  });
  return {
    inventory_scope: 'CURRENT_USER_WSB_CLI',
    current_user_visible_count: ids.length,
    owned_sandbox_absent_in_current_user_view: !seen.has(expectedSandboxId),
    current_user_sessions_empty: ids.length === 0,
    system_wide_empty: 'NOT_ATTESTED',
  };
}
export function parseAuthProvenance(raw) {
  const value=typeof raw==='string' ? checkedJson(Buffer.from(raw), 'AUTH_JSON_INVALID') : raw;
  if (!value || !authModes.has(value.auth_mode) || !authKinds.has(value.credential_kind) ||
    !endpointKinds.has(value.endpoint_kind) || value.source!=='RUNNER_ENVIRONMENT') fail('AUTH_CONTRACT_INVALID');
  timestamp(value.observed_at);
  if (value.auth_mode==='MOCK_ENDPOINT' &&
    (value.credential_kind!=='SYNTHETIC_SENTINEL' || value.endpoint_kind!=='LOOPBACK_MOCK')) fail('MOCK_AUTH_MISMATCH');
  if (value.auth_mode==='NONE' && (value.credential_kind!=='NONE'||value.endpoint_kind!=='NONE')) fail('NONE_AUTH_MISMATCH');
  // REAL is explicitly unsupported until a separately authorized, non-synthetic test contract exists.
  if (value.auth_mode==='REAL') fail('REAL_AUTH_NOT_AUTHORIZED');
  const allowedAuthFields=new Set(['auth_mode','credential_kind','endpoint_kind','source','observed_at']);
  if (Object.keys(value).some(key=>!allowedAuthFields.has(key))) fail('AUTH_UNKNOWN_FIELD_REFUSED');
  return {auth_mode:value.auth_mode, credential_kind:value.credential_kind,
    endpoint_kind:value.endpoint_kind, source:value.source, observed_at:value.observed_at};
}
export function normalizeEvent(event, index, acquire) {
  if (!event || !phases.has(event.phase)) fail('EVENT_PHASE_INVALID');
  timestamp(event.observed_at);
  if (typeof event.timed_out!=='boolean') fail('EVENT_TIMEOUT_NOT_RECORDED');
  const ec=event.exit_code;
  if (ec!==null && (!Number.isSafeInteger(ec) || ec < -2147483648 || ec > 2147483647)) fail('EVENT_EXIT_INVALID');
  if (ec===null && event.timed_out===false && typeof event.error_code!=='string') fail('EVENT_FAILURE_REASON_MISSING');
  if (event.error_code!=null && (typeof event.error_code!=='string' || !/^[A-Z0-9_:-]{1,100}$/.test(event.error_code))) fail('EVENT_ERROR_CODE_INVALID');
  const output={stage:event.phase,observed_at:event.observed_at,exit_code:ec,
    timed_out:event.timed_out,error_code:event.error_code??null,
    outcome:(!event.timed_out && ec===0)?'COMMAND_EXIT_ZERO':'NOT_SUCCESS',
    stdout:acquire(event.stdout_path,index,'stdout'),stderr:acquire(event.stderr_path,index,'stderr')};
  if (event.execution != null) {
    const x=event.execution;
    if (!x || JSON.stringify(Object.keys(x).sort())!==JSON.stringify(['argv','executable','shell','source']) ||
      (x.executable!==null&&(typeof x.executable!=='string'||x.executable.length>32768)) ||
      !Array.isArray(x.argv)||x.argv.length>16||x.argv.some(a=>typeof a!=='string'||a.length>32768)||
      x.shell!==false||!['CURRENT_USER_WSB_CLI','INTERNAL_WAIT','WSB_CLI'].includes(x.source)) fail('EXECUTION_EVIDENCE_INVALID');
    output.execution=x;
  }
  if (event.phase==='FINAL_INVENTORY') {
    // Never infer the source from the response shape or a successful exit code.
    output.inventory_source = typeof event.inventory_source === 'string' &&
      event.inventory_source.length <= 64 ? event.inventory_source : null;
    if (ec===0 && !event.timed_out && output.stdout) {
      // Parse the exact captured bytes, not a second read of a possibly-changing source.
      try { output.inventory=parseFinalInventory(output.stdout.snapshot.toString('utf8'),event.sandbox_id,output.inventory_source); }
      catch (error) { output.inventory={status:'INCONCLUSIVE',reason:error.message}; }
    } else output.inventory={status:'INCONCLUSIVE',reason:'INVENTORY_COMMAND_NOT_SUCCESSFUL'};
  }
  return output;
}
export function buildReport(input, acquire) {
  if (!input || input.schema!=='7allab-k205c-host-observability-input/0.1') fail('INPUT_SCHEMA_INVALID');
  if (!idPattern.test(nonempty(input.run_id,'RUN_ID_REQUIRED'))) fail('RUN_ID_INVALID');
  if (!idPattern.test(nonempty(input.sandbox_id,'SANDBOX_ID_REQUIRED'))) fail('SANDBOX_ID_INVALID');
  timestamp(input.collected_at);
  if (!Array.isArray(input.events) || input.events.length===0 || input.events.length>40) fail('EVENT_COUNT_INVALID');
  const events=input.events.map((item,i)=>normalizeEvent(item,i,acquire));
  let sourceHashes=null;
  if (input.host_source_sha256 != null) {
    const x=input.host_source_sha256;
    if (!x||JSON.stringify(Object.keys(x).sort())!==JSON.stringify([...hostSources].sort())||
      Object.values(x).some(v=>typeof v!=='string'||!/^[A-F0-9]{64}$/.test(v))) fail('HOST_SOURCE_EVIDENCE_INVALID');
    sourceHashes=x;
  }
  const final=events.filter(x=>x.stage==='FINAL_INVENTORY');
  if (final.length>1) fail('MULTIPLE_FINAL_INVENTORIES');
  const finalInventory=final.length===1?final[0].inventory:{status:'NOT_RECORDED'};
  if (final.length===1 && input.events.find(x=>x.phase==='FINAL_INVENTORY')?.sandbox_id!==input.sandbox_id) fail('INVENTORY_SANDBOX_ID_MISMATCH');
  let auth={status:'NOT_RECORDED',auth_mode:null,auth_provenance:null};
  if (input.auth_provenance_path != null) {
    const saved=acquire(input.auth_provenance_path,'auth','provenance');
    if (saved.bytes>128*1024) fail('AUTH_PROVENANCE_SIZE_LIMIT');
    const data=parseAuthProvenance(saved.snapshot.toString('utf8'));
    auth={status:'RECORDED_UNATTESTED',auth_mode:data.auth_mode,
      auth_provenance:{credential_kind:data.credential_kind,endpoint_kind:data.endpoint_kind,
        source:data.source,observed_at:data.observed_at,evidence_sha256:saved.sha256,evidence_path:saved.path}};
  }
  return {schema:'7allab-k205c-host-observability/0.1',status:'EVIDENCE_COLLECTED_UNATTESTED',
    run_id:input.run_id,sandbox_id:input.sandbox_id,collected_at:input.collected_at,
    events,final_inventory:finalInventory,auth,
    ...(sourceHashes?{host_source_sha256:sourceHashes}:{}),
    sourceTrusted:false,authorityImplemented:false,
    operationalAuthority:false,review_verified:false};
}
export function recordEvidence(inputPath, outputDir) {
  const inputBytes=checkedRead(inputPath,128*1024);
  const input=checkedJson(inputBytes,'INPUT_JSON_INVALID');
  const out=checkedPath(outputDir,{kind:'dir',mayBeAbsent:true});
  if (existsSync(out)) fail('OUTPUT_ALREADY_EXISTS');
  mkdirSync(out,{recursive:false});
  const copied=new Set();
  const acquire=(path,index,kind)=>{
    if (path==null) return null;
    const bytes=checkedRead(path);
    const name=`${String(index).padStart(2,'0')}-${kind}.log`;
    if (copied.has(name)) fail('OUTPUT_NAME_COLLISION');
    copied.add(name);
    writeFileSync(join(out,name),bytes,{flag:'wx',mode:0o600});
    const meta={path:name,bytes:bytes.length,sha256:sha256(bytes)};
    Object.defineProperty(meta,'snapshot',{value:bytes,enumerable:false});
    return meta;
  };
  const report=buildReport(input,acquire);
  const src=join(out,'INPUT.sha256');
  writeFileSync(src,sha256(inputBytes)+'\n',{flag:'wx',mode:0o600});
  writeFileSync(join(out,'host-runner-evidence.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  return report;
}
export function runCli(args=process.argv.slice(2)) {
  if (args.length!==4 || args[0]!=='--input' || args[2]!=='--output') fail('USAGE_INPUT_OUTPUT_ONLY');
  const report=recordEvidence(args[1],args[3]);
  process.stdout.write(`EVIDENCE_COLLECTED_UNATTESTED ${report.run_id}\n`);
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { runCli(); } catch (error) { process.stderr.write(`FAIL_CLOSED=${error.message}\n`); process.exitCode=1; }
}
