// Pilot probe helper (sandbox use only): appends one JSON line to the sandbox-local evidence dir. Not an authorization source.
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export function mark(hook) {
  const dir = process.env.PILOT_EVIDENCE_DIR ?? 'C:\\evidence';
  let raw = Buffer.alloc(0);
  try { raw = readFileSync(0); } catch { /* no stdin */ }
  let tool = null;
  try { tool = JSON.parse(raw.toString('utf8')).tool_name ?? null; } catch { /* not JSON */ }
  mkdirSync(dir, { recursive: true });
  appendFileSync(`${dir}\\hook-marker.log`, JSON.stringify({ ts: Date.now(), hook, pid: process.pid, tool, stdin_sha256: createHash('sha256').update(raw).digest('hex') }) + '\n');
}
