#!/usr/bin/env node
// Director decision validator (MVP, synthetic fixtures only).
// Reviews a *proposed* decision against a *trusted context*; it executes nothing.
// A pass here grants no operational authority (see docs/P4_DECISION_GATE_MVP.md).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// --- Ratified vocabulary (governance/agent-roles-handoff-protocol.md §6, §6.1, §3; engineering-charter.md §4, §8, §9)
export const TASK_STATES = ['PROPOSED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'VERIFIED', 'FAILED', 'COMPLETED', 'CANCELLED'];
export const AUTH_STATES = ['AUTHORIZED_SCOPED', 'AUTHORIZED_PENDING_SCOPE', 'NOT_AUTHORIZED', 'DENIED_OR_REVOKED'];
export const ROLES = ['Product Planner', 'Software Architect', 'Implementation Engineer', 'Security Engineer', 'QA & Test Engineer', 'UI/UX Engineer', 'Research Engineer', 'Release & Evidence Reviewer'];
export const RISKS = ['LOW', 'MEDIUM', 'HIGH'];
const RISK_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3 };
// Charter §8 classes; UNCLASSIFIED is the "unclassified data" sentinel (Charter §8 / Protocol §5), not a fifth class.
export const CLASSES = ['UNCLASSIFIED', 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
const CLASS_RANK = { UNCLASSIFIED: 0, PUBLIC: 1, INTERNAL: 2, CONFIDENTIAL: 3, RESTRICTED: 4 };
// Charter §4 HIGH examples: the only risk floors this module knows from ratified text.
export const RATIFIED_HIGH_KINDS = ['authorization', 'credentials', 'personal_data', 'financial_calculation', 'persistence_migration', 'security_contract', 'destructive_operation'];
// Charter §9 required scope per Git operation. Other operations carry their required boundaries in the trusted ledger entry.
export const GIT_REQUIRED_SCOPE = { stage: ['repo', 'files'], commit: ['repo', 'staged_scope', 'intent'], push: ['repo', 'remote', 'branch'] };
export const PROHIBITED_CANONICAL = ['raw_credentials', 'private_keys', 'production_secrets']; // Charter §8 / Protocol §5
const MISSING_SCOPE_BLOCKERS = ['missing_repo', 'missing_file', 'missing_branch', 'missing_remote', 'missing_package'];
const GENUINE_BLOCKERS = ['prohibition', 'security_obstacle', 'revoked_authorization', 'external_decision'];
const TRUSTED = 'trusted_fixture';
const DECISION_KEYS = ['task_state', 'risk', 'data_classification', 'external_destinations', 'permitted_transfers', 'prohibited_transfers', 'operations', 'coordination'];
const COORD_KEYS = ['role_selected', 'agent_dispatched', 'review_performed', 'review_verified'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const strOk = (v) => typeof v === 'string' && v.trim() !== '';
const validRequired = (a) => Array.isArray(a) && a.length > 0 && a.every(strOk);
// operation names are exact lowercase tokens: "Stage" or "stage " must not silently miss a revocation written as "stage"
// dispatch roles: the code-level token and the Protocol role name both identify the implementer
const isImplementerRole = (r) => typeof r === 'string' && ['implementer', 'implementation engineer'].includes(fold(r));
const opOk = (v) => typeof v === 'string' && /^[a-z][a-z0-9_]*$/.test(v);
// a path entry must name something concrete: no globs, no repo-wide "." or absolute paths, no parent traversal
const pathOk = (p) => strOk(p) && !/[*?[\]]/.test(p) && !/^([a-zA-Z]:)?[\\/]/.test(p.trim()) && !p.split(/[\\/]/).some((seg) => seg.trim() === '..') && !/^\.+$/.test(p.trim());
const pathListOk = (a) => Array.isArray(a) && a.length > 0 && a.every(pathOk);
// Y-B: a transfer's data vs one prohibited entry, compared on ONE composed normal form (Unicode NFKC, control / zero-width characters
// removed, trim, lower case, backslash -> '/', empty and '.' segments dropped, runs of space / '_' / '-' collapsed per segment).
// 'equal' is a contradiction (reject). Containment, patterns, '..' and root-like entries cannot be decided with ratified rules:
// 'ambiguous' -> not permitted (fail-closed, Protocol §5). This only widens denial; it never grants anything.
const fold = (x) => String(x).normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().toLowerCase().replace(/\\/g, '/');
const segsOf = (x) => fold(x).split('/').map((s) => s.trim()).filter((s) => s !== '' && s !== '.').map((s) => s.replace(/[\s_-]+/g, '_'));
const prohibitedOverlap = (data, prohibited) => {
  const d = segsOf(data);
  const p = segsOf(prohibited);
  if (d.length > 0 && d.length === p.length && d.every((s, i) => s === p[i])) return 'equal';
  const isPrefix = (x, y) => x.length < y.length && x.every((s, i) => s === y[i]);
  const pattern = /[*?[\]]/.test(fold(data)) || /[*?[\]]/.test(fold(prohibited));
  if (d.length === 0 || p.length === 0 || d.includes('..') || p.includes('..') || pattern || isPrefix(p, d) || isPrefix(d, p)) return 'ambiguous';
  return null;
};
// repository identity: case-, slash- and trailing-slash-insensitive so a revocation written differently still matches
const nr = (x) => (typeof x === 'string' ? x.trim().toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '') : x);
const nonEmpty = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null);

// Any internal error is a rejection, never a throw and never a pass (fail-closed).
export function validateDecision(input) {
  try {
    return validateInner(input);
  } catch (err) {
    return {
      verdict: 'REJECTED', operational: false, trust_boundary: 'SYNTHETIC_FIXTURE_ONLY', real_event_binding: 'NOT_IMPLEMENTED',
      findings: [{ severity: 'reject', code: 'VALIDATOR_INTERNAL_ERROR', path: '', message: String(err && err.message) }], derived: {},
    };
  }
}

function validateInner(input) {
  const findings = [];
  const add = (severity, code, path, message) => findings.push({ severity, code, path, message });
  const derived = { authorization: [], effective_classification: 'UNCLASSIFIED', risk_floor: null };
  const finish = () => {
    const verdict = findings.some((f) => f.severity === 'reject') ? 'REJECTED' : findings.some((f) => f.severity === 'unverifiable') ? 'NOT_VERIFIED' : 'ACCEPTED_SYNTHETIC';
    return {
      verdict,
      operational: false,
      trust_boundary: 'SYNTHETIC_FIXTURE_ONLY',
      real_event_binding: 'NOT_IMPLEMENTED',
      findings,
      derived,
    };
  };

  // D6: structure, fail-closed
  if (!isObj(input) || !isObj(input.decision) || !isObj(input.context)) {
    add('reject', 'MALFORMED_INPUT', '', 'input must be an object with object fields "decision" and "context"');
    return finish();
  }
  const { decision: d, context: c } = input;
  if (!isObj(c.trust) || c.trust.kind !== 'synthetic_fixture') {
    add('reject', 'TRUST_BOUNDARY_UNVERIFIABLE', 'context.trust', 'context must declare trust.kind "synthetic_fixture"; real execution context is not a supported trust source');
    return finish();
  }
  for (const k of Object.keys(d)) if (!DECISION_KEYS.includes(k)) add('reject', 'UNKNOWN_FIELD', `decision.${k}`, 'unknown decision field (model-supplied assertions are not accepted as authority)');
  for (const k of DECISION_KEYS) if (!(k in d)) add('reject', 'MISSING_FIELD', `decision.${k}`, 'required field missing');
  if (findings.some((f) => f.severity === 'reject')) return finish();

  const ledger = Array.isArray(c.ledger) ? c.ledger : [];
  // every context list must be an array of records carrying the trusted origin label; anything else fails closed
  for (const name of ['ledger', 'prohibitions', 'blockers', 'acceptance_evidence', 'transfer_authorizations', 'dispatch_records', 'review_records', 'data_subjects']) {
    if (c[name] === undefined) continue;
    if (!Array.isArray(c[name])) { add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}`, 'must be an array'); continue; }
    c[name].forEach((e, i) => {
      if (!isObj(e) || e.origin !== TRUSTED) add('reject', 'UNTRUSTED_ORIGIN', `context.${name}[${i}]`, `entry origin must be "${TRUSTED}" (model-asserted or unlabeled records are not evidence)`);
      else if (name === 'prohibitions' && (!opOk(e.op) || (e.repo !== undefined && !strOk(e.repo)))) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'prohibition needs an op and, if present, a non-empty string repo');
      else if (name === 'review_records' && (!strOk(e.reviewer_id) || !strOk(e.primary_evidence_ref) || typeof e.criteria_met !== 'boolean' || (e.reviewer_kind !== undefined && !strOk(e.reviewer_kind)) || (e.authorization_ref !== undefined && !strOk(e.authorization_ref)))) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'review record needs non-empty string reviewer_id and primary_evidence_ref and a boolean criteria_met (reviewer_kind / authorization_ref, if present, non-empty strings)');
      else if (name === 'dispatch_records' && (!strOk(e.agent) || !strOk(e.record_ref) || (e.role !== undefined && !strOk(e.role)))) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'dispatch record needs non-empty string agent and record_ref (role, if present, a non-empty string)');
      else if (name === 'acceptance_evidence' && (!strOk(e.criterion_id) || !['passed', 'failed'].includes(e.result) || !strOk(e.ref))) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'acceptance evidence needs a non-empty criterion_id, result passed|failed and a non-empty ref');
      else if (name === 'data_subjects' && !strOk(e.subject)) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'data subject needs a non-empty string subject');
      else if (name === 'blockers' && typeof e.kind !== 'string') add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'blocker needs a kind');
      else if (name === 'ledger' && (!opOk(e.op) || !['granted', 'revoked'].includes(e.state) || !isObj(e.scope) || (e.scope.repo !== undefined && !strOk(e.scope.repo)) || ['files', 'staged_scope'].some((k) => e.scope[k] !== undefined && !(pathListOk(e.scope[k]) || (k === 'staged_scope' && pathOk(e.scope[k])))) || (e.required_scope !== undefined && !validRequired(e.required_scope)))) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'ledger entry needs op, state granted|revoked, a scope object, a string repo if present, and a non-empty string-array required_scope if present');
      else if (name === 'transfer_authorizations' && !['data', 'class', 'destination', 'scope'].every((k) => strOk(e[k]))) add('reject', 'INVALID_CONTEXT_FIELD', `context.${name}[${i}]`, 'transfer authorization needs non-empty string data, class, destination and scope');
    });
  }
  const uniqueStrings = (a) => Array.isArray(a) && a.every(strOk) && new Set(a).size === a.length;
  if (c.acceptance_criteria !== undefined && !uniqueStrings(c.acceptance_criteria)) add('reject', 'INVALID_CONTEXT_FIELD', 'context.acceptance_criteria', 'must be an array of unique non-empty strings');
  if (c.operation_kinds !== undefined && !(Array.isArray(c.operation_kinds) && c.operation_kinds.every(opOk) && new Set(c.operation_kinds).size === c.operation_kinds.length)) add('reject', 'INVALID_CONTEXT_FIELD', 'context.operation_kinds', 'must be an array of unique lowercase tokens (a record with an origin label does not make this field trusted)');
  if (c.implementer_id !== undefined && !strOk(c.implementer_id)) add('reject', 'INVALID_CONTEXT_FIELD', 'context.implementer_id', 'must be a non-empty string');
  if (c.risk_policy !== undefined && (!isObj(c.risk_policy) || c.risk_policy.origin !== TRUSTED)) add('reject', 'UNTRUSTED_ORIGIN', 'context.risk_policy', `risk_policy must be an object with origin "${TRUSTED}"`);
  const trusted = (arr) => (Array.isArray(arr) ? arr : []).filter((e) => isObj(e) && e.origin === TRUSTED);

  // --- D4 (risk) ---
  if (typeof d.risk !== 'string' || !RISKS.includes(d.risk)) add('reject', 'INVALID_RISK', 'decision.risk', `risk must be exactly one of ${RISKS.join(', ')}`);
  const kinds = Array.isArray(c.operation_kinds) ? c.operation_kinds.filter((x) => typeof x === 'string') : [];
  let floor = 0;
  const policy = isObj(c.risk_policy) ? c.risk_policy : null;
  if (policy && (!nonEmpty(policy.ratified_by) || !nonEmpty(policy.source_ref) || !isObj(policy.floors))) {
    add('reject', 'RISK_POLICY_INVALID', 'context.risk_policy', 'risk_policy needs ratified_by, source_ref and floors');
  } else {
    if (kinds.length === 0) add('unverifiable', 'RISK_FLOOR_UNVERIFIABLE', 'context.operation_kinds', 'no trusted operation kinds supplied; risk floor cannot be determined');
    for (const kind of kinds) {
      if (RATIFIED_HIGH_KINDS.includes(kind)) floor = Math.max(floor, 3);
      else if (policy && Object.hasOwn(policy.floors, kind) && RISKS.includes(policy.floors[kind])) floor = Math.max(floor, RISK_RANK[policy.floors[kind]]);
      else add('unverifiable', 'RISK_FLOOR_UNVERIFIABLE', 'context.operation_kinds', `no ratified floor for operation kind "${kind}"; refusing to guess one`);
    }
  }
  derived.risk_floor = floor ? RISKS[floor - 1] : null;
  if (RISKS.includes(d.risk) && floor && RISK_RANK[d.risk] < floor) add('reject', 'RISK_BELOW_FLOOR', 'decision.risk', `declared ${d.risk} is below the floor ${derived.risk_floor} for the verified operation kinds`);
  // note: data classification never raises or lowers risk here (D2/D4).

  // --- D2 (classification and transfers) ---
  if (c.classification_evidence !== undefined && c.classification_evidence !== null && !isObj(c.classification_evidence)) add('reject', 'INVALID_CONTEXT_FIELD', 'context.classification_evidence', 'must be an object or null (a malformed record must not silently disappear)');
  if (c.user_cancellation !== undefined && c.user_cancellation !== null && !(isObj(c.user_cancellation) && c.user_cancellation.origin === TRUSTED && strOk(c.user_cancellation.ref))) add('reject', 'INVALID_CONTEXT_FIELD', 'context.user_cancellation', `must be null or an object with origin "${TRUSTED}" and a non-empty string ref`);
  const ev = isObj(c.classification_evidence) ? c.classification_evidence : null;
  const subjectsOk = !!ev && uniqueStrings(ev.subjects) && ev.subjects.length > 0;
  const evValid = !!ev && ev.origin === TRUSTED && nonEmpty(ev.source_ref) && CLASSES.includes(ev.class) && ev.class !== 'UNCLASSIFIED' && subjectsOk;
  if (ev && !evValid) add('reject', 'CLASSIFICATION_EVIDENCE_INVALID', 'context.classification_evidence', 'evidence needs origin trusted_fixture, a real class, a source_ref and a non-empty unique-string subjects list naming the data it covers');
  // Binding (fixture-level string match only, NOT provenance): evidence counts only if it names every trusted data subject of the task.
  const dataSubjects = trusted(c.data_subjects).filter((x) => strOk(x.subject)).map((x) => x.subject);
  const bound = evValid && dataSubjects.length > 0 && dataSubjects.every((x) => ev.subjects.includes(x));
  if (evValid && !bound) add('unverifiable', 'EVIDENCE_SUBJECT_UNBOUND', 'context.classification_evidence', 'classification evidence is not bound to every data subject of the task (or the task data subjects are unknown); it is not used');
  if (bound) add('note', 'CLASSIFICATION_PROVENANCE_NOT_IMPLEMENTED', 'context.classification_evidence', 'the evidence-to-data link is a string match inside a synthetic fixture; no real data provenance is verified');
  derived.classification_binding = bound ? 'FIXTURE_STRING_MATCH_ONLY' : 'UNBOUND';
  const evClass = bound ? ev.class : null;
  derived.effective_classification = evClass || 'UNCLASSIFIED';
  if (typeof d.data_classification !== 'string' || !CLASSES.includes(d.data_classification)) {
    add('reject', 'INVALID_CLASS', 'decision.data_classification', `must be one of ${CLASSES.join(', ')}`);
  } else if (evClass) {
    if (CLASS_RANK[d.data_classification] < CLASS_RANK[evClass]) add('reject', 'CLASS_DOWNGRADE', 'decision.data_classification', `verified class is ${evClass}; ${d.data_classification} is a downgrade`);
    else if (CLASS_RANK[d.data_classification] > CLASS_RANK[evClass]) add('unverifiable', 'CLASS_ESCALATION_UNVERIFIED', 'decision.data_classification', 'class is stricter than the verified evidence');
  } else if (d.data_classification === 'PUBLIC' || d.data_classification === 'INTERNAL') {
    add('reject', 'UNEVIDENCED_CLASS', 'decision.data_classification', `${d.data_classification} requires verified evidence; without it the class is UNCLASSIFIED`);
  } else if (d.data_classification !== 'UNCLASSIFIED') {
    add('unverifiable', 'RESTRICTIVE_CLASS_UNVERIFIED', 'decision.data_classification', `${d.data_classification} has no verified evidence; treated as UNCLASSIFIED for transfers`);
  }
  // external_destinations is an upper bound only (Protocol §5): listing a destination never authorizes a transfer.
  const destinationsOk = Array.isArray(d.external_destinations) && d.external_destinations.every((x) => typeof x === 'string' && x.trim() !== '');
  if (!destinationsOk) add('reject', 'INVALID_FIELD', 'decision.external_destinations', 'must be an array of non-empty strings (empty means NONE)');
  // The validator's own constants plus the decision's own list: the model can only ADD restrictions, never remove the canonical ones.
  const prohibitedEntries = [...PROHIBITED_CANONICAL, ...(Array.isArray(d.prohibited_transfers) ? d.prohibited_transfers.filter(strOk) : [])];
  if (!Array.isArray(d.permitted_transfers)) {
    add('reject', 'INVALID_FIELD', 'decision.permitted_transfers', 'must be an array (empty means NONE)');
  } else {
    const auths = trusted(c.transfer_authorizations);
    d.permitted_transfers.forEach((t, i) => {
      const p = `decision.permitted_transfers[${i}]`;
      if (isObj(t)) {
        const extraKey = Object.keys(t).find((k) => !['data', 'class', 'destination', 'scope'].includes(k));
        if (extraKey !== undefined) return add('reject', 'UNKNOWN_FIELD', `${p}.${extraKey}`, 'unknown transfer field (an extra key must not carry data past the prohibited-transfers comparison)');
      }
      if (isObj(t) && typeof t.data === 'string') {
        const overlaps = prohibitedEntries.map((e) => prohibitedOverlap(t.data, e));
        if (overlaps.includes('equal')) return add('reject', 'PROHIBITED_DATA_IN_TRANSFER', p, 'this data is prohibited from leaving the session (PROHIBITED DATA TRANSFERS take precedence over every other field, Protocol §5)');
        if (overlaps.includes('ambiguous')) add('unverifiable', 'PROHIBITED_SCOPE_AMBIGUOUS', p, 'the transfer data overlaps a prohibited entry by containment or pattern; no ratified matching rule exists, so the transfer is treated as not permitted (fail-closed)');
      }
      if (destinationsOk && isObj(t) && !d.external_destinations.includes(t.destination)) add('reject', 'TRANSFER_DESTINATION_NOT_IN_UPPER_BOUND', p, 'destination must appear in external_destinations (the upper bound)');
      if (derived.effective_classification === 'UNCLASSIFIED') return add('reject', 'TRANSFER_FROM_UNCLASSIFIED', p, 'unclassified data is closed to external transfer');
      if (!isObj(t) || !['data', 'class', 'destination', 'scope'].every((k) => strOk(t[k]))) return add('reject', 'TRANSFER_INVALID', p, 'a transfer needs non-empty string data, class, destination and scope');
      const ok = auths.some((a) => a.data === t.data && a.class === t.class && a.destination === t.destination && a.scope === t.scope);
      if (!ok) add('reject', 'TRANSFER_NOT_AUTHORIZED', p, 'no trusted authorization matches data, class, destination and scope (class alone is not authorization)');
      else if (t.class !== derived.effective_classification) add('reject', 'TRANSFER_CLASS_MISMATCH', p, 'transfer class differs from the verified classification');
      else if (!ev.subjects.includes(t.data)) add('reject', 'TRANSFER_DATA_NOT_COVERED_BY_EVIDENCE', p, 'the classification evidence does not cover this transfer data');
      else if (!dataSubjects.includes(t.data)) add('reject', 'TRANSFER_DATA_NOT_IN_TASK_DATA', p, 'the transfer data is not one of the task data subjects (evidence may be broader than the task)');
    });
  }
  const pt = d.prohibited_transfers;
  if (!Array.isArray(pt) || !pt.every(strOk) || !PROHIBITED_CANONICAL.every((x) => pt.includes(x))) add('reject', 'PROHIBITED_TRANSFERS_INCOMPLETE', 'decision.prohibited_transfers', `must be an array of non-empty strings (no junk entries) containing ${PROHIBITED_CANONICAL.join(', ')}`);

  // --- D3 (operation authorizations) ---
  if (!Array.isArray(d.operations)) {
    add('reject', 'INVALID_FIELD', 'decision.operations', 'must be an array');
  } else {
    const seen = new Map();
    d.operations.forEach((o, i) => {
      const p = `decision.operations[${i}]`;
      if (!isObj(o) || !opOk(o.op) || !AUTH_STATES.includes(o.status) || !isObj(o.scope)) return add('reject', 'INVALID_OPERATION', p, `needs a lowercase op token, scope object and status in ${AUTH_STATES.join(', ')}`);
      const extra = Object.keys(o).filter((k) => !['op', 'status', 'scope'].includes(k));
      if (extra.length) return add('reject', 'UNKNOWN_FIELD', `${p}.${extra[0]}`, 'unknown operation field');
      for (const k of ['files', 'packages']) {
        if (k in o.scope && !(Array.isArray(o.scope[k]) && o.scope[k].every((x) => typeof x === 'string' && x.trim() !== ''))) return add('reject', 'INVALID_OPERATION', `${p}.scope.${k}`, 'must be an array of non-empty strings');
      }
      for (const k of ['files', 'staged_scope']) {
        if (k in o.scope && !(pathListOk(o.scope[k]) || (k === 'staged_scope' && pathOk(o.scope[k])))) return add('reject', 'INVALID_OPERATION', `${p}.scope.${k}`, 'must name concrete relative paths (no globs, ".", absolute paths or ".." traversal)');
      }
      if (o.scope.repo !== undefined && !strOk(o.scope.repo)) return add('reject', 'INVALID_OPERATION', `${p}.scope.repo`, 'repo must be a non-empty string when present');
      const key = `${o.op}|${nr(o.scope.repo) ?? ''}`;
      if (seen.has(key) && seen.get(key) !== o.status) add('reject', 'CONTRADICTORY_OPERATION', p, `conflicting statuses for ${key}`);
      seen.set(key, o.status);
      const r = deriveAuthorization(o, ledger, trusted(c.prohibitions));
      derived.authorization.push({ op: o.op, repo: o.scope.repo ?? null, scope: o.scope, claimed: o.status, derived: r.status, reason: r.reason });
      if (r.status === null) add('unverifiable', 'AUTH_UNVERIFIABLE', p, r.reason);
      else if (r.status !== o.status) add('reject', 'AUTH_MISMATCH', p, `model claims ${o.status}; trusted records give ${r.status} (${r.reason})`);
      else if (r.status.startsWith('AUTHORIZED') && !kinds.includes(o.op)) add('reject', 'OP_KIND_NOT_DECLARED', p, `an authorized "${o.op}" must also appear in context.operation_kinds so its risk floor is checked`);
    });
    // a commit's staged scope must be covered by a scoped stage authorization in the same repository (Charter §9)
    for (const cm of derived.authorization.filter((x) => x.op === 'commit')) {
      const stageFor = derived.authorization.filter((x) => x.op === 'stage' && x.derived === 'AUTHORIZED_SCOPED' && x.repo === cm.repo);
      const staged = [].concat(cm.scope.staged_scope ?? []);
      const backed = stageFor.some((s) => staged.length > 0 && staged.every((f) => (s.scope.files ?? []).includes(f)));
      if (cm.derived === 'AUTHORIZED_SCOPED' && !backed) add('unverifiable', 'COMMIT_STAGED_SCOPE_UNVERIFIABLE', 'decision.operations', 'a scoped commit names a staged scope that no scoped stage authorization in the same repository covers (Charter §9)');
      else if (cm.derived === 'AUTHORIZED_PENDING_SCOPE' && stageFor.length === 0) add('note', 'COMMIT_NOT_EXECUTABLE_WITHOUT_STAGE', 'decision.operations', 'commit cannot run without a separate scoped stage authorization (Charter §9)');
    }
  }

  // --- D5 (coordination evidence) ---
  const co = d.coordination;
  if (!isObj(co) || !COORD_KEYS.every((k) => Array.isArray(co[k])) || Object.keys(co).some((k) => !COORD_KEYS.includes(k))) {
    add('reject', 'INVALID_COORDINATION', 'decision.coordination', `needs exactly array fields ${COORD_KEYS.join(', ')}`);
  } else {
    co.role_selected.forEach((r, i) => {
      if (!ROLES.includes(r)) add('reject', 'INVALID_ROLE', `decision.coordination.role_selected[${i}]`, 'must be one of the eight Protocol roles (the Director is the main session, not a role)');
    });
    const dispatch = trusted(c.dispatch_records);
    const reviews = trusted(c.review_records);
    // D-3 (Protocol §5, §6.3): DATA CLASSIFICATION must be completed before delegation. Planning with UNCLASSIFIED and ROLE_SELECTED is fine;
    // any dispatch claim or trusted dispatch record needs a verified, bound class.
    if ((co.agent_dispatched.length > 0 || dispatch.length > 0) && derived.effective_classification === 'UNCLASSIFIED') {
      add('reject', 'DISPATCH_BEFORE_CLASSIFICATION', 'decision.coordination.agent_dispatched', 'a dispatch needs a completed (verified, bound) DATA CLASSIFICATION first; UNCLASSIFIED data permits planning only');
    }
    co.agent_dispatched.forEach((a, i) => {
      if (!dispatch.some((r) => r.agent === a && nonEmpty(r.record_ref))) add('reject', 'UNEVIDENCED_AGENT_DISPATCHED', `decision.coordination.agent_dispatched[${i}]`, 'no trusted execution record');
    });
    // O-2: REVIEW_PERFORMED needs an independent reviewer too (Protocol §6.1); it does not need the criteria to be met.
    co.review_performed.forEach((a, i) => {
      if (!reviews.some((r) => sameId(r.reviewer_id, a) && independentReviewer(r, c, dispatch))) add('reject', 'UNEVIDENCED_REVIEW_PERFORMED', `decision.coordination.review_performed[${i}]`, 'needs a trusted record from an independent reviewer (not the implementer) backed by a dispatch record or an authorized human');
    });
    // O-3: REVIEW_VERIFIED needs EVERY record of that reviewer to be independent and criteria_met === true: no record order can change the outcome.
    co.review_verified.forEach((a, i) => {
      if (!reviewerVerified(a, reviews, c, dispatch)) add('reject', 'UNEVIDENCED_REVIEW_VERIFIED', `decision.coordination.review_verified[${i}]`, 'needs trusted records for this reviewer, ALL independent with criteria met, with primary evidence and a dispatch record or authorized human; any contradicting record blocks it');
    });
    const outcomes = new Map();
    for (const r of reviews) {
      const k = normId(r.reviewer_id);
      outcomes.set(k, new Set([...(outcomes.get(k) ?? []), r.criteria_met]));
    }
    for (const [k, set] of outcomes) {
      if (set.has(true) && set.has(false)) add('unverifiable', 'REVIEW_RECORDS_CONFLICT', 'context.review_records', `reviewer "${k}" has both criteria_met true and false records; the ratified text defines no ordering, so no verified review can be derived`);
    }
  }

  // --- D1 (task state) ---
  const s = d.task_state;
  if (typeof s !== 'string' || !TASK_STATES.includes(s)) {
    add('reject', 'INVALID_TASK_STATE', 'decision.task_state', `exactly one of ${TASK_STATES.join(', ')} (no compound or custom values)`);
  } else {
    const blockers = (Array.isArray(c.blockers) ? c.blockers : []).filter(isObj);
    // trusted cancellation / genuine-blocker records constrain EVERY state, not only CANCELLED / BLOCKED
    if (isObj(c.user_cancellation) && c.user_cancellation.origin === TRUSTED && s !== 'CANCELLED') add('reject', 'STATE_CONFLICTS_WITH_CANCELLATION', 'decision.task_state', 'a trusted user cancellation exists; the only consistent state is CANCELLED');
    if (['COMPLETED', 'VERIFIED', 'IN_PROGRESS'].includes(s) && blockers.some((b) => b.origin === TRUSTED && GENUINE_BLOCKERS.includes(b.kind))) add('reject', 'STATE_CONFLICTS_WITH_BLOCKER', 'decision.task_state', `${s} contradicts a trusted genuine blocker`);
    if (s === 'VERIFIED' || s === 'COMPLETED') {
      const crit = Array.isArray(c.acceptance_criteria) ? c.acceptance_criteria : [];
      const evid = trusted(c.acceptance_evidence);
      if (evid.some((e) => strOk(e.criterion_id) && !crit.includes(e.criterion_id))) add('unverifiable', 'EVIDENCE_FOR_UNDECLARED_CRITERION', 'context.acceptance_criteria', 'trusted evidence exists for a criterion the declared criteria list omits');
      const conflicting = crit.filter((id) => evid.some((e) => e.criterion_id === id && e.result !== 'passed'));
      if (conflicting.length) add('reject', 'CONFLICTING_ACCEPTANCE_EVIDENCE', 'context.acceptance_evidence', `trusted evidence records a non-passed result for: ${conflicting.join(', ')} (a later or additional passed record does not override it; no ordering is ratified)`);
      const missing = crit.filter((id) => !evid.some((e) => e.criterion_id === id && e.result === 'passed' && nonEmpty(e.ref)));
      if (crit.length === 0 || missing.length) add('reject', 'UNEVIDENCED_COMPLETION', 'decision.task_state', `${s} needs every defined acceptance criterion passed with trusted evidence${crit.length === 0 ? ' (none defined)' : ` (missing: ${missing.join(', ')})`}`);
      const claimedReviewers = isObj(d.coordination) && Array.isArray(d.coordination.review_verified) ? d.coordination.review_verified : [];
      if (Math.max(RISK_RANK[d.risk] || 0, floor) === 3 && !claimedReviewers.some((id) => reviewerVerified(id, trusted(c.review_records), c, trusted(c.dispatch_records)))) add('reject', 'HIGH_WITHOUT_INDEPENDENT_REVIEW', 'decision.task_state', `HIGH risk ${s} needs a verified independent review record`);
    } else if (s === 'IN_PROGRESS' && !derived.authorization.some((x) => x.derived === 'AUTHORIZED_SCOPED')) {
      add('reject', 'IN_PROGRESS_WITHOUT_SCOPED_OPERATION', 'decision.task_state', 'IN_PROGRESS needs an operation that trusted records show as AUTHORIZED_SCOPED (Protocol §6)');
    } else if (s === 'BLOCKED') {
      if (!blockers.some((b) => GENUINE_BLOCKERS.includes(b.kind))) add('reject', blockers.length && blockers.every((b) => MISSING_SCOPE_BLOCKERS.includes(b.kind)) ? 'CATEGORICAL_BLOCK_FOR_MISSING_SCOPE' : 'UNSUPPORTED_BLOCKED', 'decision.task_state', 'BLOCKED needs a genuine prohibition, security obstacle, revoked authorization or external decision; missing scope alone is not enough');
    } else if (s === 'CANCELLED' && !(isObj(c.user_cancellation) && c.user_cancellation.origin === TRUSTED)) {
      add('reject', 'CANCELLED_WITHOUT_USER_CANCELLATION', 'decision.task_state', 'CANCELLED needs a trusted user cancellation record');
    }
  }

  derived.unverified_inputs = ['operation_kinds', 'implementer_id', 'acceptance_criteria'];
  add('note', 'UNLABELED_CONTEXT_INPUTS', 'context', 'operation_kinds, implementer_id and acceptance_criteria carry no origin label and are not verified inputs; no trusted source for them exists yet');
  const implementers = trusted(c.dispatch_records).filter((x) => isImplementerRole(x.role));
  if (strOk(c.implementer_id) && implementers.some((x) => String(x.agent).trim().toLowerCase() !== c.implementer_id.trim().toLowerCase())) add('unverifiable', 'IMPLEMENTER_CONTRADICTED', 'context.implementer_id', 'a trusted dispatch record names a different implementer than context.implementer_id');
  add('note', 'REAL_EVENT_BINDING_NOT_IMPLEMENTED', '', 'review/dispatch/authorization records are synthetic fixtures; binding to real Claude Code events is not implemented');
  return finish();
}

const normId = (x) => fold(x);
const sameId = (a, b) => normId(a) === normId(b);
// independence (Protocol §6.1): a reviewer other than the implementer, backed by a dispatch record or an authorized human.
// Every identity here is a synthetic-fixture string; nothing authenticates a real reviewer.
function independentReviewer(r, c, dispatch) {
  if (!isObj(r) || !strOk(r.reviewer_id) || !strOk(r.primary_evidence_ref)) return false;
  if (!strOk(c.implementer_id) || sameId(r.reviewer_id, c.implementer_id)) return false;
  if (dispatch.some((x) => isImplementerRole(x.role) && sameId(x.agent, r.reviewer_id))) return false;
  const viaAgent = dispatch.some((x) => sameId(x.agent, r.reviewer_id) && strOk(x.record_ref));
  const viaHuman = r.reviewer_kind === 'authorized_human' && strOk(r.authorization_ref);
  return viaAgent || viaHuman;
}

function validReview(r, c, dispatch) {
  return independentReviewer(r, c, dispatch) && r.criteria_met === true;
}

// REVIEW_VERIFIED for a reviewer id: at least one record, and ALL of that reviewer's records valid (order cannot matter).
function reviewerVerified(id, reviews, c, dispatch) {
  const own = reviews.filter((r) => sameId(r.reviewer_id, id));
  return own.length > 0 && own.every((r) => validReview(r, c, dispatch));
}

function deriveAuthorization(o, ledger, prohibitions) {
  const repo = o.scope.repo;
  // Grants match the repository EXACTLY (normalizing would widen authority). Revocations and prohibitions match the
  // normalized repository, or apply everywhere when they (or the decision) carry no repository: that only narrows authority.
  const grantRepoSame = (e) => isObj(e.scope) && e.scope.repo === repo;
  const denyApplies = (r) => r === undefined || repo === undefined || nr(r) === nr(repo);
  const prohibited = prohibitions.some((p) => p.op === o.op && denyApplies(p.repo));
  const entries = ledger.filter((e) => isObj(e) && e.origin === TRUSTED && e.op === o.op);
  const revoked = entries.some((e) => e.state === 'revoked' && denyApplies(e.scope.repo));
  const grants = entries.filter((e) => e.state === 'granted' && grantRepoSame(e));
  if (prohibited || revoked) {
    // Ratified text defines no precedence or ordering between a grant and a later/earlier withdrawal: refuse to pick one.
    if (entries.some((e) => e.state === 'granted' && denyApplies(e.scope.repo))) return { status: null, reason: 'a grant and a revocation/prohibition both apply; the ratified text defines no precedence or ordering' };
    return { status: 'DENIED_OR_REVOKED', reason: prohibited ? 'trusted prohibition record' : 'trusted revocation record' };
  }
  if (grants.length === 0) return { status: 'NOT_AUTHORIZED', reason: 'no trusted grant for this operation and repository' };
  // Order-independent: a decision is authorized only if some single grant fully covers it (grants are not merged);
  // otherwise the strongest remaining outcome, with ties broken by sorted reason text.
  const results = grants.map((g) => evalGrant(o, g)).sort((a, b) => String(a.reason).localeCompare(String(b.reason)));
  return ['AUTHORIZED_SCOPED', null, 'AUTHORIZED_PENDING_SCOPE'].map((s) => results.find((r) => r.status === s)).find(Boolean) || results[0];
}

function evalGrant(o, g) {
  const stated = Object.hasOwn(GIT_REQUIRED_SCOPE, o.op) ? GIT_REQUIRED_SCOPE[o.op] : validRequired(g.required_scope) ? g.required_scope : null;
  const required = stated && [...new Set(['repo', ...stated])];
  if (!required) return { status: null, reason: `required scope for "${o.op}" is not ratified and the ledger entry does not state a non-empty required_scope` };
  const has = (obj, k) => Object.hasOwn(obj, k) && nonEmpty(obj[k]);
  const covered = (k) => (k === 'repo' ? o.scope.repo === g.scope.repo : Array.isArray(o.scope[k]) ? Array.isArray(g.scope[k]) && o.scope[k].every((x) => g.scope[k].includes(x)) : o.scope[k] === g.scope[k]);
  // even an incomplete grant fixes the boundaries it does name: a decision that contradicts them is outside the grant
  const contradicted = Object.keys(o.scope).filter((k) => has(o.scope, k) && has(g.scope, k) && !covered(k));
  if (contradicted.length) return { status: 'NOT_AUTHORIZED', reason: `outside the granted scope: ${contradicted.sort().join(', ')}` };
  if (!required.every((k) => has(g.scope, k))) return { status: 'AUTHORIZED_PENDING_SCOPE', reason: `grant lacks: ${required.filter((k) => !has(g.scope, k)).join(', ')}` };
  // grant is complete: the decision must declare every required boundary and stay inside it (all fields, not only files)
  const undeclared = required.filter((k) => !has(o.scope, k));
  if (undeclared.length) return { status: 'NOT_AUTHORIZED', reason: `decision does not declare the scope it acts on: ${undeclared.join(', ')}` };
  const outside = [...new Set([...required, ...Object.keys(o.scope)])].filter((k) => has(o.scope, k) && !covered(k));
  if (outside.length) return { status: 'NOT_AUTHORIZED', reason: `outside the granted scope: ${outside.join(', ')}` };
  return { status: 'AUTHORIZED_SCOPED', reason: 'trusted grant covers all required scope' };
}

// --- CLI ---
const EXIT = { ACCEPTED_SYNTHETIC: 0, REJECTED: 2, NOT_VERIFIED: 3 };
function main(argv) {
  const file = argv[2];
  let raw;
  try {
    raw = file && file !== '-' ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  } catch (err) {
    console.error(`cannot read input: ${err.message}`);
    return 1;
  }
  let report;
  try {
    report = validateDecision(JSON.parse(raw));
  } catch (err) {
    report = { verdict: 'REJECTED', operational: false, trust_boundary: 'SYNTHETIC_FIXTURE_ONLY', real_event_binding: 'NOT_IMPLEMENTED', findings: [{ severity: 'reject', code: 'INVALID_JSON', path: '', message: err.message }], derived: {} };
  }
  console.log(JSON.stringify(report, null, 2));
  return EXIT[report.verdict];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv);
