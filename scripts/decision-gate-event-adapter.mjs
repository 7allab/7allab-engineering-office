#!/usr/bin/env node
// Trusted Boundary Adapter (prototype). Reads Claude Code hook events, never grants anything.
// Three inputs stay apart: MODEL_DECISION (untrusted), HOST_EVENT (shape-checked, source not authenticated),
// TRUSTED_AUTHORITY (model-external ledger / human approval: NOT IMPLEMENTED -> every execution request fails closed).
// It performs no Git, file, network or dispatch action. See docs/P4_TRUST_BOUNDARY.md.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { win32, posix } from 'node:path';
import { TASK_STATES, RISKS, CLASSES, AUTH_STATES } from './validate-director-decision.mjs';

export const AUTHORITY = Object.freeze({ implemented: false, source: 'NONE' });
const EVENTS = ['PreToolUse', 'PermissionRequest', 'SubagentStart', 'SubagentStop'];
const READ_ONLY = ['Read', 'Glob', 'Grep']; // path-checked; no opinion inside the project, ask outside
const NEUTRAL = ['AskUserQuestion', 'ExitPlanMode']; // no execution; normal flow
const SHELL = ['Bash', 'PowerShell'];
const WRITERS = ['Write', 'Edit', 'NotebookEdit'];
const MODEL_KEYS = ['task_state', 'risk', 'data_classification', 'external_destinations', 'permitted_transfers', 'prohibited_transfers', 'operations', 'coordination'];
const LABEL_KEYS = ['origin', 'trust', 'trusted', 'authorized_human', 'authorization_ref', 'reviewer_kind', 'approved', 'approved_by', 'permission_mode'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => typeof v === 'string' && v.trim() !== '';
const fold = (x) => String(x).normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();

// ---- HOST_EVENT shape (fields per code.claude.com/docs/en/hooks; unknown extra fields are ignored, never trusted)
export function checkHostEvent(e) {
  const bad = [];
  if (!isObj(e)) return ['event is not an object'];
  if (!EVENTS.includes(e.hook_event_name)) return [`unsupported hook_event_name ${JSON.stringify(e.hook_event_name)}`];
  for (const k of ['session_id', 'cwd']) if (!str(e[k])) bad.push(`${k} must be a non-empty string`);
  if (str(e.cwd) && !isAbs(e.cwd)) bad.push('cwd must be an absolute path');
  const n = e.hook_event_name;
  if (n === 'PreToolUse' || n === 'PermissionRequest') {
    if (!str(e.tool_name)) bad.push('tool_name must be a non-empty string');
    if (!isObj(e.tool_input)) bad.push('tool_input must be an object');
    if (n === 'PreToolUse' && !str(e.tool_use_id)) bad.push('tool_use_id must be a non-empty string');
  } else {
    for (const k of ['agent_id', 'agent_type']) if (!str(e[k])) bad.push(`${k} must be a non-empty string`);
    if (n === 'SubagentStop') for (const k of ['last_assistant_message', 'agent_transcript_path']) if (e[k] !== undefined && typeof e[k] !== 'string') bad.push(`${k} must be a string`);
  }
  return bad;
}

// ---- paths (Windows and POSIX). Anything that cannot be decided exactly is "unverifiable", never inside.
const isAbs = (p) => /^[a-zA-Z]:[\\/]/.test(p) || (p.startsWith('/') && !p.startsWith('//'));
export function pathRelation(p, root) {
  if (!str(p) || !str(root) || !isAbs(root)) return 'unverifiable';
  const t = p;
  // control / format / compatibility characters and edge spaces are never silently cleaned into an "inside" path
  if (/[\p{Cc}\p{Cf}]/u.test(t) || t.normalize('NFKC') !== t || t !== t.trim()) return 'unverifiable';
  if (!isAbs(t) || /^(\\\\|\/\/)/.test(t) || /~\d/.test(t)) return 'unverifiable'; // UNC, \\?\, 8.3 short names
  const w = /^[a-zA-Z]/.test(t);
  if (w !== /^[a-zA-Z]/.test(fold(root))) return 'unverifiable';
  const m = w ? win32 : posix;
  if (w && t.slice(2).includes(':')) return 'unverifiable'; // NTFS alternate data stream
  const norm = (x) => m.normalize(fold(x)).replace(/[\\/]+$/, '');
  const a = norm(t);
  if (a.split(/[\\/]/).some((s) => /[. ]$/.test(s) && s !== '.' && s !== '..')) return 'unverifiable'; // trailing dot/space aliasing
  const r = norm(root);
  const [aa, rr] = w ? [a.toLowerCase(), r.toLowerCase()] : [a, r];
  return aa === rr || aa.startsWith(rr + m.sep) ? 'inside' : 'outside';
}

// ---- command classification: labels only. The verdict for any shell command is DENY regardless of the labels.
export function classifyCommand(cmd) {
  const s = String(cmd).toLowerCase();
  const c = [];
  if (/(^|[\s;&|(`$"'])git(\.exe)?["']?(\s|$)/.test(s)) c.push('GIT_OPERATION_NOT_AUTHORIZED');
  if (/\b(curl|wget|invoke-webrequest|iwr|invoke-restmethod|irm|scp|sftp|ssh|ftp|rsync|nc|ncat|certutil|bitsadmin)\b|https?:\/\/|\bgit\s+(push|remote)\b|\b(npm|gh)\s+(publish|release)\b/.test(s)) c.push('EXTERNAL_TRANSFER_NOT_AUTHORIZED');
  if (/\b(npm|pnpm|yarn|pip3?|pipx|uv|cargo|choco|winget|scoop|apt(-get)?|brew)\s+(install|add|i|get|update|upgrade)\b/.test(s)) c.push('PACKAGE_INSTALL_NOT_AUTHORIZED');
  if (/\b(rm|del|erase|rmdir|rd|remove-item|format|mkfs)\b|\bgit\s+(reset|clean|checkout|rebase)\b/.test(s)) c.push('DESTRUCTIVE_OPERATION_NOT_AUTHORIZED');
  return c;
}

// ---- MODEL_DECISION: structural reading only. Nothing here can make a request allowed.
export function assessModelDecision(md, observed = []) {
  const issues = [];
  const add = (code, message) => issues.push({ code, message });
  if (!isObj(md)) return { accepted_as_authority: false, issues: [{ code: 'MODEL_DECISION_MALFORMED', message: 'not an object' }] };
  for (const k of Object.keys(md)) if (!MODEL_KEYS.includes(k)) add('MODEL_DECISION_UNKNOWN_FIELD', k);
  for (const k of MODEL_KEYS) if (!(k in md)) add('MODEL_DECISION_MISSING_FIELD', k);
  if (md.task_state !== undefined && !TASK_STATES.includes(md.task_state)) add('MODEL_DECISION_INVALID_ENUM', 'task_state');
  if (md.risk !== undefined && !RISKS.includes(md.risk)) add('MODEL_DECISION_INVALID_ENUM', 'risk');
  if (md.data_classification !== undefined && !CLASSES.includes(md.data_classification)) add('MODEL_DECISION_INVALID_ENUM', 'data_classification');
  const ops = Array.isArray(md.operations) ? md.operations : [];
  if (md.operations !== undefined && !Array.isArray(md.operations)) add('MODEL_DECISION_MALFORMED', 'operations must be an array');
  ops.forEach((o, i) => {
    if (!isObj(o) || !str(o.op) || !AUTH_STATES.includes(o.status) || !isObj(o.scope)) add('MODEL_DECISION_MALFORMED', `operations[${i}]`);
    else if (o.status === 'AUTHORIZED_SCOPED' || o.status === 'AUTHORIZED_PENDING_SCOPE') add('MODEL_AUTHORITY_CLAIM_IGNORED', `operations[${i}] claims ${o.status}; only a model-external ledger could confirm it (not implemented)`);
  });
  // labels the model could write itself are never evidence, wherever they appear
  const walk = (v, p, depth) => {
    if (depth > 8 || !v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (LABEL_KEYS.includes(k)) add('MODEL_LABEL_IGNORED', `${p}.${k}`);
      walk(x, `${p}.${k}`, depth + 1);
    }
  };
  walk(md, 'decision', 0);
  if (md.coordination !== undefined && !(isObj(md.coordination) && ['role_selected', 'agent_dispatched', 'review_performed', 'review_verified'].every((k) => Array.isArray(md.coordination[k])))) add('MODEL_DECISION_MALFORMED', 'coordination must be an object of four arrays');
  const co = isObj(md.coordination) ? md.coordination : {};
  const started = new Set((Array.isArray(observed) ? observed : []).filter((o) => isObj(o) && o.hook_event_name === 'SubagentStart' && checkHostEvent(o).length === 0).map((o) => fold(o.agent_type).toLowerCase()));
  for (const a of Array.isArray(co.agent_dispatched) ? co.agent_dispatched : []) if (!started.has(fold(a).toLowerCase())) add('DISPATCH_UNOBSERVED', `no SubagentStart host event for ${JSON.stringify(a)}`);
  for (const k of ['review_performed', 'review_verified']) if (Array.isArray(co[k]) && co[k].length > 0) add('REVIEW_UNBACKED', `${k} needs a model-external reviewer identity; SubagentStop only shows that an agent stopped`);
  return { accepted_as_authority: false, issues };
}

// ---- decision
export function evaluateHostEvent(event, { modelDecision, observed, projectRoot } = {}) {
  const out = { event: null, disposition: 'DENY', reasons: [], categories: [], model_decision: null, authority: AUTHORITY, operational: false };
  const why = (code, message) => out.reasons.push({ code, message });
  try {
    const bad = checkHostEvent(event);
    if (bad.length) {
      out.event = isObj(event) && EVENTS.includes(event.hook_event_name) ? event.hook_event_name : null;
      why('MALFORMED_EVENT', bad.join('; '));
      return out;
    }
    out.event = event.hook_event_name;
    if (modelDecision !== undefined) out.model_decision = assessModelDecision(modelDecision, observed);
    const root = projectRoot ?? null;
    if (out.event === 'SubagentStart' || out.event === 'SubagentStop') {
      out.disposition = 'OBSERVE'; // cannot block; observation is not authority, not review
      why('OBSERVATION_ONLY', `${out.event} proves that an agent ${out.event === 'SubagentStart' ? 'started' : 'stopped'}; it is not ROLE_SELECTED authority and not REVIEW_VERIFIED`);
      return out;
    }
    const tool = event.tool_name;
    const ti = event.tool_input;
    const target = ti.file_path ?? ti.notebook_path ?? ti.path ?? event.cwd;
    const where = pathRelation(target, root);
    if (READ_ONLY.includes(tool) || NEUTRAL.includes(tool)) {
      if (READ_ONLY.includes(tool)) {
        // every path-like field the tool may use must be inside (a spare field must not hide the real one); Glob/Grep also resolve against cwd
        const given = ['file_path', 'notebook_path', 'path'].filter((k) => ti[k] !== undefined).map((k) => ti[k]);
        const rels = [...given, ...(tool === 'Read' && given.length ? [] : [event.cwd])].map((p) => pathRelation(p, root));
        // a search pattern / glob that is absolute or climbs out escapes the path field
        const escapes = [tool === 'Glob' ? ti.pattern : undefined, tool === 'Grep' ? ti.glob : undefined].some((g) => g !== undefined && (typeof g !== 'string' || /^([a-zA-Z]:|[\\/])/.test(g.trim()) || g.split(/[\\/]/).some((s) => s.trim() === '..')));
        const rel = rels.includes('outside') ? 'outside' : rels.every((x) => x === 'inside') && !escapes ? 'inside' : 'unverifiable';
        if (rel !== 'inside') {
          out.disposition = 'ASK';
          why(rel === 'outside' ? 'PATH_OUTSIDE_PROJECT' : 'PATH_UNVERIFIABLE', 'read target (path fields, cwd, pattern) is not provably inside the project root');
          return out;
        }
      }
      out.disposition = 'NO_OPINION'; // not an allow: the normal permission flow decides
      return out;
    }
    why('NO_TRUSTED_AUTHORITY', 'no model-external authority source exists; execution requests fail closed');
    if (SHELL.includes(tool)) {
      if (!str(ti.command)) why('MALFORMED_EVENT', 'shell tool_input.command missing');
      else out.categories.push(...classifyCommand(ti.command));
      if (where !== 'inside') why(where === 'outside' ? 'PATH_OUTSIDE_PROJECT' : 'PATH_UNVERIFIABLE', 'cwd is not provably inside the project root');
    } else if (WRITERS.includes(tool)) {
      out.categories.push('WRITE_NOT_AUTHORIZED');
      if (where !== 'inside') why(where === 'outside' ? 'PATH_OUTSIDE_PROJECT' : 'PATH_UNVERIFIABLE', 'write target is not provably inside the project root');
    } else if (tool === 'Agent') out.categories.push('AGENT_DISPATCH_NOT_AUTHORIZED');
    else if (tool.startsWith('mcp__') || tool === 'WebFetch' || tool === 'WebSearch') out.categories.push('EXTERNAL_TRANSFER_NOT_AUTHORIZED');
    else why('UNKNOWN_TOOL', `tool ${JSON.stringify(tool)} is not classified`);
    return out;
  } catch (err) {
    out.disposition = 'DENY';
    out.reasons.push({ code: 'ADAPTER_INTERNAL_ERROR', message: String(err && err.message) });
    return out;
  }
}

// ---- documented hook responses. Never emits "allow", never emits updatedInput.
export function toHookResponse(r) {
  const text = r.reasons.map((x) => `${x.code}: ${x.message}`).concat(r.categories).join(' | ');
  if (r.event === 'PermissionRequest' && r.disposition === 'DENY') {
    return { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: text } } }), stderr: '' };
  }
  if (r.disposition === 'DENY') return { exitCode: 2, stdout: '', stderr: text }; // exit 2 blocks PreToolUse; unknown events fail closed too
  if (r.disposition === 'ASK' && r.event === 'PreToolUse') {
    return { exitCode: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: text } }), stderr: '' };
  }
  return { exitCode: 0, stdout: '', stderr: '' };
}

function main() {
  let result;
  try {
    result = evaluateHostEvent(JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '')), { projectRoot: process.env.CLAUDE_PROJECT_DIR });
  } catch (err) {
    result = { event: null, disposition: 'DENY', reasons: [{ code: 'MALFORMED_EVENT', message: String(err && err.message) }], categories: [] };
  }
  const o = toHookResponse(result);
  if (o.stdout) process.stdout.write(o.stdout);
  if (o.stderr) process.stderr.write(o.stderr);
  return o.exitCode;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
