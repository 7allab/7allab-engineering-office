// W1a: binds the bounded inventory collector to the injected lifecycle runner.
// Stateful Sandbox operations remain caller-owned and require separate authorization.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, parse, resolve, sep } from 'node:path';
import { captureAndCorrelate } from './host-lifecycle.mjs';
import { collectReadOnlyInventory } from './wsb-read-only-adapter.mjs';

const FILES = ['binary-identity.json', 'inventory-observation.json',
  'wsb-list.stderr.bin', 'wsb-list.stdout.bin'];
const METHODS = ['start', 'connect', 'waitForExport', 'stop'];
const MAX_RAW = 1024 * 1024;
const MAX_JSON = 128 * 1024;
const fail = (code) => { throw new Error(code); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

function regular(path, maxBytes) {
  const full = resolve(path), root = parse(full).root;
  let cursor = root;
  for (const part of full.slice(root.length).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    const item = lstatSync(cursor);
    if (item.isSymbolicLink()) fail('INVENTORY_SYMLINK_REFUSED');
    if (cursor === full && (!item.isFile() || item.size > maxBytes)) fail('INVENTORY_FILE_INVALID');
  }
  return readFileSync(full);
}

function inventoryResult(outputDir) {
  const root = resolve(outputDir);
  if (!lstatSync(root).isDirectory() ||
      JSON.stringify(readdirSync(root).sort()) !== JSON.stringify(FILES)) fail('INVENTORY_FILE_SET_INVALID');
  const stdout = regular(join(root, 'wsb-list.stdout.bin'), MAX_RAW);
  const stderr = regular(join(root, 'wsb-list.stderr.bin'), MAX_RAW);
  let identity;
  try { identity = JSON.parse(regular(join(root, 'binary-identity.json'), MAX_JSON).toString('utf8')); }
  catch { identity = null; }
  let report;
  try { report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(
    regular(join(root, 'inventory-observation.json'), MAX_JSON))); }
  catch { fail('INVENTORY_REPORT_INVALID'); }
  if (!report || report.schema !== '7allab-k205c-current-user-inventory/0.1' ||
      report.command !== 'wsb list --raw' || report.inventory_scope !== 'CURRENT_USER_WSB_CLI' ||
      report.system_wide_empty !== 'NOT_ATTESTED' || report.sourceTrusted !== false ||
      report.authorityImplemented !== false || report.operationalAuthority !== false ||
      report.review_verified !== false || report.stdout_sha256 !== sha256(stdout) ||
      report.stderr_sha256 !== sha256(stderr) || !['READ_ONLY_OBSERVATION_UNATTESTED', 'INCONCLUSIVE'].includes(report.status) ||
      (report.exit_code !== null && !Number.isSafeInteger(report.exit_code)) ||
      ![true, false].includes(report.timed_out)) fail('INVENTORY_REPORT_CONTRACT_INVALID');
  if (report.status === 'READ_ONLY_OBSERVATION_UNATTESTED' &&
      (report.reason !== null || report.exit_code !== 0 || report.timed_out || stderr.length ||
       !Number.isSafeInteger(report.current_user_visible_count) || report.current_user_visible_count < 0))
    fail('INVENTORY_SUCCESS_CONTRADICTORY');
  if (report.status === 'INCONCLUSIVE' &&
      (typeof report.reason !== 'string' || !/^[A-Z][A-Z0-9_]{1,90}$/.test(report.reason)))
    fail('INVENTORY_FAILURE_REASON_INVALID');
  return { exit_code: report.exit_code, timed_out: report.timed_out,
    error_code: report.status === 'INCONCLUSIVE' ? report.reason : null,
    stdout, stderr, inventory_source: 'CURRENT_USER_WSB_CLI',
    execution: typeof identity?.alias_path === 'string' ? { executable: identity.alias_path,
      argv: ['list','--raw'], shell: false, source: 'CURRENT_USER_WSB_CLI' } : null };
}

export async function runCampaign({ runId, sandboxId, policy, exportRunDir, outputDir,
  authProvenancePath, statefulTransport, inventoryCollector = collectReadOnlyInventory,
  hostSourceSha256 = null }) {
  if (typeof inventoryCollector !== 'function' || !statefulTransport ||
      JSON.stringify(Object.keys(statefulTransport).sort()) !== JSON.stringify([...METHODS].sort()) ||
      METHODS.some((method) => typeof statefulTransport[method] !== 'function'))
    fail('CAMPAIGN_TRANSPORT_INVALID');
  const collect = (name) => async () => {
    const inventoryDir = join(outputDir, `${name}-inventory`);
    await inventoryCollector({ outputDir: inventoryDir });
    return inventoryResult(inventoryDir);
  };
  const transport = {
    preflight: collect('preflight'),
    ...Object.fromEntries(METHODS.map((method) => [method, (args) => statefulTransport[method](args)])),
    finalInventory: collect('final'),
  };
  return captureAndCorrelate({ runId, sandboxId, policy, exportRunDir, outputDir,
    authProvenancePath, transport, hostSourceSha256 });
}
