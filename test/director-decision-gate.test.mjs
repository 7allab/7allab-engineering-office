// Unit tests for scripts/validate-director-decision.mjs.
// All inputs are synthetic fixtures. They measure the validator's code, not any model, and a pass is not an authorization.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDecision, TASK_STATES } from '../scripts/validate-director-decision.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'validate-director-decision.mjs');
const T = 'trusted_fixture';
const PROHIBITED = ['raw_credentials', 'private_keys', 'production_secrets'];
const REPO = 'sentetik-depo';

const clone = (x) => structuredClone(x);
const codes = (r) => r.findings.map((f) => f.code);
const has = (r, code) => codes(r).includes(code);

// Synthetic policy used only so the tests can exercise the floor comparison; it ratifies nothing.
const policy = { origin: T, ratified_by: 'synthetic-test-fixture', source_ref: 'test://not-a-ratification', floors: { stage: 'LOW', commit: 'MEDIUM', push: 'MEDIUM', source_change: 'MEDIUM', dependency_install: 'MEDIUM' } };

function base() {
  return {
    decision: {
      task_state: 'READY',
      risk: 'LOW',
      data_classification: 'UNCLASSIFIED',
      external_destinations: [],
      permitted_transfers: [],
      prohibited_transfers: [...PROHIBITED],
      operations: [
        { op: 'stage', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, files: ['docs/NOTES.md'] } },
        { op: 'commit', status: 'NOT_AUTHORIZED', scope: { repo: REPO } },
        { op: 'push', status: 'NOT_AUTHORIZED', scope: { repo: REPO } },
      ],
      coordination: { role_selected: [], agent_dispatched: [], review_performed: [], review_verified: [] },
    },
    context: {
      trust: { kind: 'synthetic_fixture' },
      implementer_id: 'impl-1',
      operation_kinds: ['stage'],
      risk_policy: clone(policy), // fresh copy per fixture: tests mutate it
      ledger: [{ origin: T, op: 'stage', state: 'granted', scope: { repo: REPO, files: ['docs/NOTES.md'] }, source_ref: 'fixture://user-message-1' }],
      prohibitions: [],
      blockers: [],
      acceptance_criteria: [],
      acceptance_evidence: [],
      classification_evidence: null,
      data_subjects: [{ origin: T, subject: 'docs/NOTLAR.md' }],
      transfer_authorizations: [],
      dispatch_records: [],
      review_records: [],
      user_cancellation: null,
    },
  };
}

test('N4 positive (synthetic): stage-only grant, commit/push not authorized -> accepted, never operational', () => {
  const r = validateDecision(base());
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.operational, false);
  assert.equal(r.trust_boundary, 'SYNTHETIC_FIXTURE_ONLY');
  assert.equal(r.real_event_binding, 'NOT_IMPLEMENTED');
  assert.deepEqual(r.derived.authorization.map((a) => a.derived), ['AUTHORIZED_SCOPED', 'NOT_AUTHORIZED', 'NOT_AUTHORIZED']);
});

test('N4: commit/push derived from stage permission are rejected', () => {
  for (const [idx, status] of [[1, 'AUTHORIZED_PENDING_SCOPE'], [1, 'AUTHORIZED_SCOPED'], [2, 'AUTHORIZED_PENDING_SCOPE'], [2, 'AUTHORIZED_SCOPED']]) {
    const i = base();
    i.decision.operations[idx].status = status;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED');
    assert.ok(has(r, 'AUTH_MISMATCH'), `${idx}/${status}`);
  }
});

test('N4: stage beyond the granted file list is not authorized', () => {
  const i = base();
  i.decision.operations[0].scope.files = ['docs/NOTES.md', 'src/other.txt'];
  const r = validateDecision(i);
  assert.ok(has(r, 'AUTH_MISMATCH'));
});

test('N4: COMPLETED without trusted acceptance evidence is rejected; VERIFIED too', () => {
  for (const state of ['COMPLETED', 'VERIFIED']) {
    const i = base();
    i.decision.task_state = state;
    assert.ok(has(validateDecision(i), 'UNEVIDENCED_COMPLETION'), state);
  }
});

test('COMPLETED with passed trusted evidence for every criterion is accepted (LOW risk, synthetic)', () => {
  const i = base();
  i.decision.task_state = 'COMPLETED';
  i.context.acceptance_criteria = ['c1'];
  i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://test-run-1' }];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  i.context.acceptance_evidence[0].result = 'failed';
  assert.ok(has(validateDecision(i), 'UNEVIDENCED_COMPLETION'));
});

test('N4: unevidenced PUBLIC and INTERNAL are rejected', () => {
  for (const cls of ['PUBLIC', 'INTERNAL']) {
    const i = base();
    i.decision.data_classification = cls;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED');
    assert.ok(has(r, 'UNEVIDENCED_CLASS'), cls);
  }
});

test('PUBLIC with matching trusted evidence is accepted; mismatching evidence is a downgrade/escalation finding', () => {
  const i = base();
  i.context.classification_evidence = { origin: T, class: 'PUBLIC', source_ref: 'fixture://owner-declaration', subjects: ['docs/NOTLAR.md'] };
  i.decision.data_classification = 'PUBLIC';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  i.decision.data_classification = 'CONFIDENTIAL';
  const up = validateDecision(i);
  assert.equal(up.verdict, 'NOT_VERIFIED');
  assert.ok(has(up, 'CLASS_ESCALATION_UNVERIFIED'));
  i.context.classification_evidence.class = 'CONFIDENTIAL';
  i.decision.data_classification = 'PUBLIC';
  assert.ok(has(validateDecision(i), 'CLASS_DOWNGRADE'));
});

test('N12: verified CONFIDENTIAL with transfers NONE is accepted and does not force HIGH risk', () => {
  const i = base();
  i.context.classification_evidence = { origin: T, class: 'CONFIDENTIAL', source_ref: 'fixture://owner-declaration', subjects: ['docs/NOTLAR.md'] };
  i.decision.data_classification = 'CONFIDENTIAL';
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.derived.risk_floor, 'LOW');
  assert.equal(r.derived.effective_classification, 'CONFIDENTIAL');
});

test('N12: downgrading a verified class to UNCLASSIFIED is rejected', () => {
  const i = base();
  i.context.classification_evidence = { origin: T, class: 'CONFIDENTIAL', source_ref: 'fixture://owner-declaration', subjects: ['docs/NOTLAR.md'] };
  assert.ok(has(validateDecision(i), 'CLASS_DOWNGRADE'));
});

test('N12: a class alone never authorizes a transfer; UNCLASSIFIED never transfers', () => {
  const transfer = { data: 'docs/NOTLAR.md', class: 'CONFIDENTIAL', destination: 'analiz.example.invalid', scope: 'read-only analysis' };
  const i = base();
  i.context.classification_evidence = { origin: T, class: 'CONFIDENTIAL', source_ref: 'fixture://owner-declaration', subjects: ['docs/NOTLAR.md'] };
  i.decision.data_classification = 'CONFIDENTIAL';
  i.decision.external_destinations = [transfer.destination];
  i.decision.permitted_transfers = [transfer];
  assert.ok(has(validateDecision(i), 'TRANSFER_NOT_AUTHORIZED'));
  i.context.transfer_authorizations = [{ origin: T, ...transfer }];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  const u = base();
  u.decision.external_destinations = [transfer.destination];
  u.decision.permitted_transfers = [transfer];
  u.context.transfer_authorizations = [{ origin: T, ...transfer }];
  assert.ok(has(validateDecision(u), 'TRANSFER_FROM_UNCLASSIFIED'));
});

test('restrictive class without evidence is not verified (and not accepted)', () => {
  const i = base();
  i.decision.data_classification = 'CONFIDENTIAL';
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'RESTRICTIVE_CLASS_UNVERIFIED'));
});

test('prohibited transfers must list the canonical secrets (never empty or N/A)', () => {
  for (const bad of [[], ['N/A'], ['raw_credentials']]) {
    const i = base();
    i.decision.prohibited_transfers = bad;
    assert.ok(has(validateDecision(i), 'PROHIBITED_TRANSFERS_INCOMPLETE'));
  }
});

function n3() {
  const i = base();
  i.decision.risk = 'MEDIUM';
  i.decision.operations = [
    { op: 'source_change', status: 'AUTHORIZED_PENDING_SCOPE', scope: {} },
    { op: 'stage', status: 'NOT_AUTHORIZED', scope: {} },
    { op: 'commit', status: 'AUTHORIZED_PENDING_SCOPE', scope: {} },
    { op: 'push', status: 'AUTHORIZED_PENDING_SCOPE', scope: {} },
    { op: 'dependency_install', status: 'AUTHORIZED_PENDING_SCOPE', scope: {} },
  ];
  i.context.operation_kinds = ['source_change', 'commit', 'push', 'dependency_install'];
  i.context.ledger = [
    { origin: T, op: 'source_change', state: 'granted', required_scope: ['repo', 'files'], scope: {}, source_ref: 'fixture://n3' },
    { origin: T, op: 'commit', state: 'granted', scope: {}, source_ref: 'fixture://n3' },
    { origin: T, op: 'push', state: 'granted', scope: {}, source_ref: 'fixture://n3' },
    { origin: T, op: 'dependency_install', state: 'granted', required_scope: ['packages'], scope: {}, source_ref: 'fixture://n3' },
  ];
  return i;
}

test('N3: independent Git authorizations and MEDIUM operation risk -> accepted; stage stays NOT_AUTHORIZED', () => {
  const r = validateDecision(n3());
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.deepEqual(r.derived.authorization.map((a) => a.derived), ['AUTHORIZED_PENDING_SCOPE', 'NOT_AUTHORIZED', 'AUTHORIZED_PENDING_SCOPE', 'AUTHORIZED_PENDING_SCOPE', 'AUTHORIZED_PENDING_SCOPE']);
  assert.ok(has(r, 'COMMIT_NOT_EXECUTABLE_WITHOUT_STAGE'));
});

test('N3: risk below the verified floor is rejected; without any policy the floor is unverifiable (not guessed)', () => {
  const low = n3();
  low.decision.risk = 'LOW';
  assert.ok(has(validateDecision(low), 'RISK_BELOW_FLOOR'));
  const none = n3();
  delete none.context.risk_policy;
  const r = validateDecision(none);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'RISK_FLOOR_UNVERIFIABLE'));
});

test('N3: missing scope alone is not a reason for BLOCKED; a genuine blocker is', () => {
  const i = n3();
  i.decision.task_state = 'BLOCKED';
  i.context.blockers = [{ origin: T, kind: 'missing_repo' }, { origin: T, kind: 'missing_branch' }];
  assert.ok(has(validateDecision(i), 'CATEGORICAL_BLOCK_FOR_MISSING_SCOPE'));
  i.context.blockers = [];
  assert.ok(has(validateDecision(i), 'UNSUPPORTED_BLOCKED'));
  i.context.blockers = [{ origin: T, kind: 'prohibition' }];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('state vocabulary: only one exact Protocol state; compound, custom and array values rejected', () => {
  assert.deepEqual(TASK_STATES, ['PROPOSED', 'READY', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'VERIFIED', 'FAILED', 'COMPLETED', 'CANCELLED']);
  for (const bad of ['READY / BLOCKED', 'PENDING_SCOPE', 'ready', ['READY'], ['READY', 'BLOCKED'], '', null]) {
    const i = base();
    i.decision.task_state = bad;
    assert.ok(has(validateDecision(i), 'INVALID_TASK_STATE'), JSON.stringify(bad));
  }
});

test('IN_PROGRESS and CANCELLED need trusted backing', () => {
  const i = base();
  i.decision.task_state = 'IN_PROGRESS';
  i.decision.operations = [{ op: 'stage', status: 'NOT_AUTHORIZED', scope: { repo: REPO } }];
  i.context.ledger = [];
  assert.ok(has(validateDecision(i), 'IN_PROGRESS_WITHOUT_SCOPED_OPERATION'));
  const c = base();
  c.decision.task_state = 'CANCELLED';
  assert.ok(has(validateDecision(c), 'CANCELLED_WITHOUT_USER_CANCELLATION'));
  c.context.user_cancellation = { origin: T, ref: 'fixture://user-cancel-1' };
  assert.equal(validateDecision(c).verdict, 'ACCEPTED_SYNTHETIC');
});

function highReview() {
  const i = base();
  i.decision.risk = 'HIGH';
  i.decision.task_state = 'REVIEW';
  i.decision.operations = [];
  i.context.operation_kinds = ['authorization'];
  i.context.ledger = [];
  // delegation requires a completed DATA CLASSIFICATION (ADIM 52 / D-3): verified INTERNAL evidence bound to the task data
  i.context.classification_evidence = { origin: T, class: 'INTERNAL', source_ref: 'fixture://owner', subjects: ['docs/NOTLAR.md'] };
  i.decision.data_classification = 'INTERNAL';
  return i;
}

test('N5: model-claimed REVIEW_VERIFIED / AGENT_DISPATCHED / REVIEW_PERFORMED without trusted records are rejected', () => {
  const i = highReview();
  i.decision.coordination = { role_selected: ['Security Engineer'], agent_dispatched: ['sec-1'], review_performed: ['sec-1'], review_verified: ['sec-1'] };
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  for (const c of ['UNEVIDENCED_AGENT_DISPATCHED', 'UNEVIDENCED_REVIEW_PERFORMED', 'UNEVIDENCED_REVIEW_VERIFIED']) assert.ok(has(r, c), c);
});

test('N5: a role selection alone is valid and implies neither dispatch nor review', () => {
  const i = highReview();
  i.decision.coordination.role_selected = ['Security Engineer', 'QA & Test Engineer'];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  i.decision.coordination.role_selected = ['Engineering Director'];
  assert.ok(has(validateDecision(i), 'INVALID_ROLE'));
});

test('fabricated primary evidence: model-origin records, empty evidence, self-review, missing identity are all rejected', () => {
  const mk = (patch) => {
    const i = highReview();
    i.decision.coordination.review_verified = ['sec-1'];
    i.context.dispatch_records = [{ origin: T, agent: 'sec-1', record_ref: 'fixture://dispatch-1' }];
    i.context.review_records = [{ origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: true, ...patch }];
    return i;
  };
  assert.equal(validateDecision(mk({})).verdict, 'ACCEPTED_SYNTHETIC');
  assert.ok(has(validateDecision(mk({ origin: 'model_asserted' })), 'UNTRUSTED_ORIGIN'));
  assert.ok(has(validateDecision(mk({ primary_evidence_ref: '' })), 'INVALID_CONTEXT_FIELD'), 'empty evidence ref: schema error (ADIM 52)');
  assert.ok(has(validateDecision(mk({ criteria_met: false })), 'UNEVIDENCED_REVIEW_VERIFIED'));
  // self-review: the implementer has a dispatch record and complete evidence, so only the independence rule can reject it
  const self = mk({ reviewer_id: 'impl-1' });
  self.decision.coordination.review_verified = ['impl-1'];
  self.context.dispatch_records.push({ origin: T, agent: 'impl-1', record_ref: 'fixture://dispatch-2' });
  assert.ok(has(validateDecision(self), 'UNEVIDENCED_REVIEW_VERIFIED'));
  const unidentified = mk({});
  delete unidentified.context.implementer_id;
  assert.ok(has(validateDecision(unidentified), 'UNEVIDENCED_REVIEW_VERIFIED'), 'independence cannot be shown without an implementer identity');
  const noDispatch = mk({});
  noDispatch.context.dispatch_records = [];
  assert.ok(has(validateDecision(noDispatch), 'UNEVIDENCED_REVIEW_VERIFIED'));
  const human = mk({ reviewer_kind: 'authorized_human', authorization_ref: 'fixture://owner-auth' });
  human.context.dispatch_records = [];
  assert.equal(validateDecision(human).verdict, 'ACCEPTED_SYNTHETIC');
});

test('HIGH risk COMPLETED needs a verified independent review record, not just the model claim', () => {
  const i = highReview();
  i.decision.task_state = 'COMPLETED';
  i.context.acceptance_criteria = ['c1'];
  i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
  assert.ok(has(validateDecision(i), 'HIGH_WITHOUT_INDEPENDENT_REVIEW'));
  i.context.dispatch_records = [{ origin: T, agent: 'sec-1', record_ref: 'fixture://dispatch-1' }];
  i.context.review_records = [{ origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: true }];
  assert.ok(has(validateDecision(i), 'HIGH_WITHOUT_INDEPENDENT_REVIEW'), 'a valid record that the decision does not claim is not enough');
  i.decision.coordination.review_verified = ['sec-1'];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('risk floor from a ratified HIGH kind (Charter §4) cannot be undercut; class alone is not a kind', () => {
  const i = base();
  i.context.operation_kinds = ['financial_calculation', 'stage'];
  assert.ok(has(validateDecision(i), 'RISK_BELOW_FLOOR'));
  i.decision.risk = 'HIGH';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('P1: no grant for source change -> model-written AUTHORIZED_* is rejected, NOT_AUTHORIZED is accepted', () => {
  const i = base();
  i.decision.risk = 'HIGH';
  i.context.operation_kinds = ['authorization'];
  i.context.ledger = [];
  i.decision.operations = [{ op: 'source_change', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: 'kovan' } }];
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'));
  i.decision.operations[0].status = 'NOT_AUTHORIZED';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('N8: never-granted is NOT_AUTHORIZED; DENIED_OR_REVOKED needs a trusted prohibition or revocation', () => {
  const i = base();
  i.decision.risk = 'HIGH';
  i.context.operation_kinds = ['credentials'];
  i.context.ledger = [];
  i.decision.operations = [{ op: 'env_read', status: 'DENIED_OR_REVOKED', scope: {} }];
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'));
  i.decision.operations[0].status = 'NOT_AUTHORIZED';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  i.decision.operations[0].status = 'DENIED_OR_REVOKED';
  i.context.prohibitions = [{ origin: T, op: 'env_read', reason: 'synthetic policy prohibition' }];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  const rev = base();
  rev.decision.operations = [{ op: 'stage', status: 'DENIED_OR_REVOKED', scope: { repo: REPO, files: ['docs/NOTES.md'] } }];
  rev.context.ledger = [{ origin: T, op: 'stage', state: 'revoked', scope: { repo: REPO } }]; // revocation only, no grant
  assert.equal(validateDecision(rev).verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(validateDecision(rev).derived.authorization[0].derived, 'DENIED_OR_REVOKED');
});

test('N9: a grant for one repository yields no authority in another', () => {
  const i = base();
  i.context.operation_kinds = ['source_change'];
  i.decision.risk = 'MEDIUM';
  i.context.ledger = [{ origin: T, op: 'source_change', state: 'granted', required_scope: ['repo', 'files'], scope: { repo: 'urun-a', files: ['src/ayarlar.txt'] }, source_ref: 'fixture://n9' }];
  i.decision.operations = [
    { op: 'source_change', status: 'AUTHORIZED_SCOPED', scope: { repo: 'urun-a', files: ['src/ayarlar.txt'] } },
    // same file path on purpose: only the repository boundary can reject this
    { op: 'source_change', status: 'AUTHORIZED_SCOPED', scope: { repo: 'urun-b', files: ['src/ayarlar.txt'] } },
  ];
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'));
  i.decision.operations[1].status = 'AUTHORIZED_PENDING_SCOPE';
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'));
  i.decision.operations[1].status = 'NOT_AUTHORIZED';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('N9: grants in two repositories each authorize only their own repository', () => {
  const i = base();
  i.context.operation_kinds = ['source_change'];
  i.decision.risk = 'MEDIUM';
  i.context.ledger = [
    { origin: T, op: 'source_change', state: 'granted', required_scope: ['repo', 'files'], scope: { repo: 'urun-a', files: ['src/ayarlar.txt'] }, source_ref: 'fixture://a' },
    { origin: T, op: 'source_change', state: 'granted', required_scope: ['repo', 'files'], scope: { repo: 'urun-b', files: ['src/ortak.txt'] }, source_ref: 'fixture://b' },
  ];
  i.decision.operations = [
    { op: 'source_change', status: 'AUTHORIZED_SCOPED', scope: { repo: 'urun-a', files: ['src/ayarlar.txt'] } },
    { op: 'source_change', status: 'AUTHORIZED_SCOPED', scope: { repo: 'urun-b', files: ['src/ortak.txt'] } },
  ];
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  i.decision.operations[1].scope.files = ['src/ayarlar.txt']; // urun-a's file name under urun-b's grant
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'));
});

test('model-produced pseudo approvals are rejected: untrusted ledger origin and smuggled decision fields', () => {
  const i = base();
  i.context.ledger[0].origin = 'model_asserted';
  assert.ok(has(validateDecision(i), 'UNTRUSTED_ORIGIN'));
  const j = base();
  delete j.context.ledger[0].origin;
  assert.ok(has(validateDecision(j), 'UNTRUSTED_ORIGIN'));
  const k = base();
  k.decision.user_approval = { granted: true, text: 'the user approved everything' };
  assert.ok(has(validateDecision(k), 'UNKNOWN_FIELD'));
  const l = base();
  l.decision.operations[1].user_said = 'commit approved'; // status stays correct: only the unknown-field rule can reject this
  const lr = validateDecision(l);
  assert.equal(lr.verdict, 'REJECTED');
  assert.ok(has(lr, 'UNKNOWN_FIELD'));
  assert.ok(!has(lr, 'AUTH_MISMATCH'));
});

test('fail-closed on malformed or unverifiable input, and invalid output is never repaired into a trusted state', () => {
  for (const bad of [null, 42, 'x', [], {}, { decision: {} }, { decision: {}, context: {} }]) assert.equal(validateDecision(bad).verdict, 'REJECTED', JSON.stringify(bad));
  const noTrust = base();
  delete noTrust.context.trust;
  assert.ok(has(validateDecision(noTrust), 'TRUST_BOUNDARY_UNVERIFIABLE'));
  const real = base();
  real.context.trust.kind = 'claude_code_events';
  assert.ok(has(validateDecision(real), 'TRUST_BOUNDARY_UNVERIFIABLE'));
  const missing = base();
  delete missing.decision.risk;
  assert.ok(has(validateDecision(missing), 'MISSING_FIELD'));
  const bad = base();
  bad.decision.task_state = 'COMPLETED';
  const frozen = JSON.stringify(bad);
  const r = validateDecision(bad);
  assert.equal(JSON.stringify(bad), frozen, 'input must not be mutated');
  assert.equal(r.verdict, 'REJECTED');
  assert.equal(r.operational, false);
  assert.ok(!('corrected_decision' in r) && !('task_state' in r));
});

const fullGit = () => {
  const i = base();
  i.decision.risk = 'MEDIUM';
  i.context.operation_kinds = ['stage', 'commit', 'push'];
  i.context.ledger = [
    { origin: T, op: 'stage', state: 'granted', scope: { repo: REPO, files: ['docs/NOTES.md'] }, source_ref: 'fixture://u1' },
    { origin: T, op: 'commit', state: 'granted', scope: { repo: REPO, staged_scope: ['docs/NOTES.md'], intent: 'fix typo' }, source_ref: 'fixture://u2' },
    { origin: T, op: 'push', state: 'granted', scope: { repo: REPO, remote: 'origin', branch: 'feature/x' }, source_ref: 'fixture://u3' },
  ];
  i.decision.operations = [
    { op: 'stage', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, files: ['docs/NOTES.md'] } },
    { op: 'commit', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, staged_scope: ['docs/NOTES.md'], intent: 'fix typo' } },
    { op: 'push', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, remote: 'origin', branch: 'feature/x' } },
  ];
  return i;
};

// ---- Added after the independent read-only review (gaps it found) ----

test('fully scoped stage/commit/push (Charter §9 fields) are accepted; every scope field is compared, not only files', () => {
  assert.equal(validateDecision(fullGit()).verdict, 'ACCEPTED_SYNTHETIC');
  for (const [idx, field, value] of [[2, 'remote', 'evil'], [2, 'branch', 'main'], [1, 'intent', 'something else'], [1, 'staged_scope', ['other.txt']]]) {
    const i = fullGit();
    i.decision.operations[idx].scope[field] = value;
    assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'), `${field}=${JSON.stringify(value)}`);
  }
});

test('a scoped claim must declare its scope; wildcard, empty or non-array file lists do not pass', () => {
  for (const files of ['**/*', '*', [], undefined, ['docs/NOTES.md', '']]) {
    const i = base();
    if (files === undefined) delete i.decision.operations[0].scope.files;
    else i.decision.operations[0].scope.files = files;
    assert.equal(validateDecision(i).verdict, 'REJECTED', JSON.stringify(files));
  }
});

test('an authorized operation must also be declared in operation_kinds so its floor is checked', () => {
  const i = fullGit();
  i.context.operation_kinds = ['stage'];
  assert.ok(has(validateDecision(i), 'OP_KIND_NOT_DECLARED'));
});

test('a scoped commit without a scoped stage grant is not verified', () => {
  const i = fullGit();
  i.context.ledger = i.context.ledger.filter((e) => e.op !== 'stage');
  i.decision.operations[0].status = 'NOT_AUTHORIZED';
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'COMMIT_STAGED_SCOPE_UNVERIFIABLE'));
});

test('malformed trusted-context lists fail closed instead of being ignored (prohibitions, blockers, ledger, policy)', () => {
  const p = base();
  p.context.prohibitions = { origin: T, op: 'commit' };
  assert.ok(has(validateDecision(p), 'INVALID_CONTEXT_FIELD'));
  const p2 = fullGit();
  p2.context.prohibitions = [{ origin: T }];
  assert.ok(has(validateDecision(p2), 'INVALID_CONTEXT_FIELD'));
  const b = base();
  b.context.blockers = [null];
  assert.equal(validateDecision(b).verdict, 'REJECTED');
  const b2 = base();
  b2.context.blockers = [{ kind: 'prohibition' }];
  assert.ok(has(validateDecision(b2), 'UNTRUSTED_ORIGIN'));
  const l = base();
  l.context.ledger = 'granted';
  assert.ok(has(validateDecision(l), 'INVALID_CONTEXT_FIELD'));
  const pol = base();
  pol.context.risk_policy = { ratified_by: 'x', source_ref: 'y', floors: { stage: 'LOW' } };
  assert.ok(has(validateDecision(pol), 'UNTRUSTED_ORIGIN'));
});

test('a revocation without a repository applies to that operation in every repository', () => {
  const i = base();
  i.context.ledger = [{ origin: T, op: 'stage', state: 'revoked', scope: {} }]; // revocation only: the grant is gone
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'), 'claiming SCOPED against a repo-less revocation is rejected');
  i.decision.operations[0].status = 'DENIED_OR_REVOKED';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('implementer independence ignores case and whitespace', () => {
  const i = highReview();
  i.decision.coordination.review_verified = ['IMPL-1 '];
  i.context.dispatch_records = [{ origin: T, agent: 'IMPL-1 ', record_ref: 'fixture://d' }];
  i.context.review_records = [{ origin: T, reviewer_id: 'IMPL-1 ', primary_evidence_ref: 'fixture://e', criteria_met: true }];
  assert.ok(has(validateDecision(i), 'UNEVIDENCED_REVIEW_VERIFIED'));
});

test('destinations are an upper bound only: listing never authorizes; transfers must sit inside it; secrets never transfer', () => {
  const t = { data: 'docs/NOTLAR.md', class: 'CONFIDENTIAL', destination: 'analiz.example.invalid', scope: 'read-only' };
  const mk = () => {
    const i = base();
    i.context.classification_evidence = { origin: T, class: 'CONFIDENTIAL', source_ref: 'fixture://o', subjects: ['docs/NOTLAR.md'] };
    i.decision.data_classification = 'CONFIDENTIAL';
    i.decision.external_destinations = ['analiz.example.invalid'];
    return i;
  };
  assert.equal(validateDecision(mk()).verdict, 'ACCEPTED_SYNTHETIC', 'listing alone is not a transfer');
  const outside = mk();
  outside.decision.external_destinations = [];
  outside.decision.permitted_transfers = [t];
  outside.context.transfer_authorizations = [{ origin: T, ...t }];
  assert.ok(has(validateDecision(outside), 'TRANSFER_DESTINATION_NOT_IN_UPPER_BOUND'));
  const secret = mk();
  secret.decision.permitted_transfers = [{ ...t, data: 'raw_credentials' }];
  secret.context.transfer_authorizations = [{ origin: T, ...t, data: 'raw_credentials' }];
  assert.ok(has(validateDecision(secret), 'PROHIBITED_DATA_IN_TRANSFER'));
  const mism = mk();
  mism.decision.permitted_transfers = [{ ...t, class: 'INTERNAL' }];
  mism.context.transfer_authorizations = [{ origin: T, ...t, class: 'INTERNAL' }];
  assert.ok(has(validateDecision(mism), 'TRANSFER_CLASS_MISMATCH'));
  const bad = mk();
  bad.decision.external_destinations = [42];
  assert.ok(has(validateDecision(bad), 'INVALID_FIELD'));
});

test('specific error codes: risk, class, policy, evidence, operation and coordination shapes', () => {
  const expect = (mutate, code) => {
    const i = base();
    mutate(i);
    assert.ok(has(validateDecision(i), code), code);
  };
  expect((i) => { i.decision.risk = 'LOW / MEDIUM'; }, 'INVALID_RISK');
  expect((i) => { i.decision.risk = ['LOW']; }, 'INVALID_RISK');
  expect((i) => { i.decision.data_classification = 'SECRET'; }, 'INVALID_CLASS');
  expect((i) => { i.context.risk_policy.source_ref = ''; }, 'RISK_POLICY_INVALID');
  expect((i) => { i.context.classification_evidence = { origin: T, class: 'UNCLASSIFIED', source_ref: 'x' }; }, 'CLASSIFICATION_EVIDENCE_INVALID');
  expect((i) => { i.decision.operations = [{ op: 'stage', status: 'MAYBE', scope: {} }]; }, 'INVALID_OPERATION');
  expect((i) => { i.decision.operations.push({ op: 'stage', status: 'NOT_AUTHORIZED', scope: { repo: REPO, files: ['docs/NOTES.md'] } }); }, 'CONTRADICTORY_OPERATION');
  expect((i) => { i.decision.coordination.extra = []; }, 'INVALID_COORDINATION');
  expect((i) => { i.decision.coordination.role_selected = 'Security Engineer'; }, 'INVALID_COORDINATION');
  expect((i) => { i.decision.external_destinations = 'none'; }, 'INVALID_FIELD');
  assert.equal(validateDecision(null).findings[0].code, 'MALFORMED_INPUT');
});

test('a grant whose required scope is neither ratified nor stated by the ledger is unverifiable, not guessed', () => {
  const i = base();
  i.context.operation_kinds = ['stage', 'deploy'];
  i.context.risk_policy.floors.deploy = 'HIGH';
  i.decision.risk = 'HIGH';
  i.context.ledger.push({ origin: T, op: 'deploy', state: 'granted', scope: { repo: REPO }, source_ref: 'fixture://d' });
  i.decision.operations.push({ op: 'deploy', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO } });
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'AUTH_UNVERIFIABLE'));
});

test('IN_PROGRESS is accepted only with a scoped operation backed by trusted records', () => {
  const i = base();
  i.decision.task_state = 'IN_PROGRESS';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('prototype-key operation names and internal errors fail closed without throwing', () => {
  const i = base();
  i.context.ledger.push({ origin: T, op: 'constructor', state: 'granted', scope: { repo: REPO } });
  i.decision.operations.push({ op: 'constructor', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO } });
  assert.doesNotThrow(() => validateDecision(i));
  assert.notEqual(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  const hostile = base();
  Object.defineProperty(hostile.decision, 'operations', { get() { throw new Error('boom'); }, enumerable: true });
  const r = validateDecision(hostile);
  assert.equal(r.verdict, 'REJECTED');
  assert.equal(r.findings[0].code, 'VALIDATOR_INTERNAL_ERROR');
});

// =====================================================================================================
// ADIM 49 regression block: the six late security fixes. Every test states its expected verdict/code.
// "Ratified Authorization Matrix" does not exist as a file; the sources used are Charter §9 and Protocol §6.1.
// =====================================================================================================

const findings = (r) => r.findings.filter((f) => f.severity !== 'note').map((f) => f.code).sort();
const permutations = (arr) => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p])));

// B1 -------------------------------------------------------------------------------------------------
test('B1 negative: a decision repo that is missing-typed (null, number, empty, blank, array, object, boolean) is rejected', () => {
  for (const repo of [null, 42, '', '   ', [], {}, true, [REPO]]) {
    const i = base();
    i.decision.operations[0].scope.repo = repo;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(repo));
    assert.ok(has(r, 'INVALID_OPERATION'), JSON.stringify(repo));
  }
});

test('B1 negative: ledger and prohibition records with a null or wrong-typed repo are rejected, never ignored', () => {
  for (const repo of [null, 42, '', '  ', [], {}]) {
    const l = base();
    l.context.ledger[0].scope.repo = repo;
    assert.equal(validateDecision(l).verdict, 'REJECTED', `ledger ${JSON.stringify(repo)}`);
    assert.ok(has(validateDecision(l), 'INVALID_CONTEXT_FIELD'));
    const p = fullGit();
    p.context.prohibitions = [{ origin: T, op: 'push', repo }];
    assert.equal(validateDecision(p).verdict, 'REJECTED', `prohibition ${JSON.stringify(repo)}`);
    assert.ok(has(validateDecision(p), 'INVALID_CONTEXT_FIELD'));
  }
});

test('B1: a decision that omits repo cannot use a repo-specific grant (expected NOT_AUTHORIZED, SCOPED claim rejected)', () => {
  const i = base();
  delete i.decision.operations[0].scope.repo;
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'AUTH_MISMATCH'));
  assert.equal(r.derived.authorization[0].derived, 'NOT_AUTHORIZED');
  i.decision.operations[0].status = 'NOT_AUTHORIZED';
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('B1: grants match the repository exactly (no case/slash normalization widening authority)', () => {
  const i = base();
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC'); // positive: exact match
  i.decision.operations[0].scope.repo = 'SENTETIK-DEPO';
  const r = validateDecision(i);
  assert.ok(has(r, 'AUTH_MISMATCH'));
  assert.equal(r.derived.authorization[0].derived, 'NOT_AUTHORIZED');
});

test('B1: revocations and prohibitions DO match the normalized repository (case, slash style, trailing slash) -> DENIED_OR_REVOKED', () => {
  const i = base();
  i.decision.operations = [{ op: 'stage', status: 'DENIED_OR_REVOKED', scope: { repo: 'c:/projeler/x', files: ['a.txt'] } }];
  i.context.ledger = [{ origin: T, op: 'stage', state: 'revoked', scope: { repo: 'C:\\Projeler\\X\\' } }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.derived.authorization[0].derived, 'DENIED_OR_REVOKED');
  const p = base();
  p.decision.operations = [{ op: 'stage', status: 'DENIED_OR_REVOKED', scope: { repo: 'Sentetik-Depo', files: ['docs/NOTES.md'] } }];
  p.context.ledger = [];
  p.context.prohibitions = [{ origin: T, op: 'stage', repo: 'sentetik-depo/' }];
  assert.equal(validateDecision(p).derived.authorization[0].derived, 'DENIED_OR_REVOKED');
  // a revocation for a DIFFERENT repo must not deny this one
  const o = base();
  o.context.ledger.push({ origin: T, op: 'stage', state: 'revoked', scope: { repo: 'baska-depo' } });
  assert.equal(validateDecision(o).verdict, 'ACCEPTED_SYNTHETIC');
});

// B2 -------------------------------------------------------------------------------------------------
const depGrant = (extra = {}) => ({ origin: T, op: 'dependency_install', state: 'granted', required_scope: ['repo', 'packages'], scope: { repo: REPO, packages: ['left-pad@1.0.0'] }, source_ref: 'fixture://dep', ...extra });
const depCtx = (ledger, scope, status = 'AUTHORIZED_SCOPED') => {
  const i = base();
  i.decision.risk = 'MEDIUM';
  i.context.operation_kinds = ['dependency_install'];
  i.context.ledger = ledger;
  i.decision.operations = [{ op: 'dependency_install', status, scope: { repo: REPO, ...scope } }];
  return i;
};

test('B2 negative: an empty or malformed required_scope is rejected and never read as unlimited authority', () => {
  for (const rs of [[], [''], [1], 'repo', ['repo', ''], null, {}, ['repo', null]]) {
    const i = depCtx([depGrant({ required_scope: rs })], { packages: ['left-pad@1.0.0'] });
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(rs));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(rs));
  }
});

test('B2: a non-Git grant that states no required_scope is NOT_VERIFIED (unratified), whatever the model claims', () => {
  for (const status of ['AUTHORIZED_SCOPED', 'AUTHORIZED_PENDING_SCOPE', 'NOT_AUTHORIZED']) {
    const g = depGrant();
    delete g.required_scope;
    const r = validateDecision(depCtx([g], { packages: ['left-pad@1.0.0'] }, status));
    assert.equal(r.verdict, 'NOT_VERIFIED', status);
    assert.ok(has(r, 'AUTH_UNVERIFIABLE'), status);
  }
});

test('B2 positive: a stated, complete required_scope grants AUTHORIZED_SCOPED; an incomplete grant stays PENDING', () => {
  const ok = validateDecision(depCtx([depGrant()], { packages: ['left-pad@1.0.0'] }));
  assert.equal(ok.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(ok.derived.authorization[0].derived, 'AUTHORIZED_SCOPED');
  const g = depGrant();
  delete g.scope.packages;
  const pending = validateDecision(depCtx([g], {}, 'AUTHORIZED_PENDING_SCOPE'));
  assert.equal(pending.derived.authorization[0].derived, 'AUTHORIZED_PENDING_SCOPE');
  assert.ok(has(validateDecision(depCtx([g], { packages: ['left-pad@1.0.0'] })), 'AUTH_MISMATCH'), 'SCOPED claim on an incomplete grant');
});

test('B2: a ledger entry cannot weaken the Charter §9 Git scope with its own required_scope', () => {
  const i = base();
  i.context.ledger = [{ origin: T, op: 'stage', state: 'granted', required_scope: ['repo'], scope: { repo: REPO }, source_ref: 'fixture://weak' }];
  const r = validateDecision(i); // decision claims SCOPED with files; stage still needs repo + files in the grant
  assert.ok(has(r, 'AUTH_MISMATCH'));
  assert.equal(r.derived.authorization[0].derived, 'AUTHORIZED_PENDING_SCOPE');
});

// B3 -------------------------------------------------------------------------------------------------
test('B3 negative: unknown, differently-cased, padded, empty or missing ledger states are rejected, never ignored', () => {
  for (const state of ['REVOKED', 'Granted', 'denied', 'suspended', 'granted ', '', null, 7, undefined]) {
    const i = base();
    if (state === undefined) delete i.context.ledger[0].state;
    else i.context.ledger[0].state = state;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', String(state));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), String(state));
  }
});

test('B3 positive: the two valid states behave as documented (granted -> SCOPED, revoked -> DENIED_OR_REVOKED)', () => {
  assert.equal(validateDecision(base()).derived.authorization[0].derived, 'AUTHORIZED_SCOPED');
  const i = base();
  i.context.ledger[0].state = 'revoked';
  i.decision.operations[0].status = 'DENIED_OR_REVOKED';
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.derived.authorization[0].derived, 'DENIED_OR_REVOKED');
});

// B4 -------------------------------------------------------------------------------------------------
test('B4 positive: scoped commit backed by a scoped stage in the same repository covering the staged scope', () => {
  assert.equal(validateDecision(fullGit()).verdict, 'ACCEPTED_SYNTHETIC');
  const s = fullGit(); // staged_scope given as a single string instead of an array
  s.context.ledger[1].scope.staged_scope = 'docs/NOTES.md';
  s.decision.operations[1].scope.staged_scope = 'docs/NOTES.md';
  assert.equal(validateDecision(s).verdict, 'ACCEPTED_SYNTHETIC');
});

test('B4 negative: stage evidence from another repository does not back a commit (expected NOT_VERIFIED COMMIT_STAGED_SCOPE_UNVERIFIABLE)', () => {
  const i = fullGit();
  i.context.ledger[0].scope.repo = 'baska-depo';
  i.decision.operations[0].scope.repo = 'baska-depo';
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'COMMIT_STAGED_SCOPE_UNVERIFIABLE'));
});

test('B4 negative: a staged scope the stage grant does not cover is not backed', () => {
  const i = fullGit();
  i.context.ledger[1].scope.staged_scope = ['docs/NOTES.md', 'docs/OTHER.md'];
  i.decision.operations[1].scope.staged_scope = ['docs/NOTES.md', 'docs/OTHER.md'];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'COMMIT_STAGED_SCOPE_UNVERIFIABLE'));
});

test('B4 negative: no stage operation, or a stage that is only PENDING_SCOPE, cannot back a scoped commit', () => {
  const none = fullGit();
  none.decision.operations.splice(0, 1);
  none.context.ledger.splice(0, 1);
  assert.equal(validateDecision(none).verdict, 'NOT_VERIFIED');
  const pending = fullGit();
  delete pending.context.ledger[0].scope.files;
  pending.decision.operations[0] = { op: 'stage', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: REPO } };
  const r = validateDecision(pending);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'COMMIT_STAGED_SCOPE_UNVERIFIABLE'));
});

test('B4 negative: model-fabricated stage evidence is not trusted (no ledger entry, or untrusted origin)', () => {
  const fab = fullGit();
  fab.context.ledger.splice(0, 1); // the model still claims stage SCOPED
  const r = validateDecision(fab);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'AUTH_MISMATCH'));
  const untrusted = fullGit();
  untrusted.context.ledger[0].origin = 'model_asserted';
  const u = validateDecision(untrusted);
  assert.equal(u.verdict, 'REJECTED');
  assert.ok(has(u, 'UNTRUSTED_ORIGIN'));
});

// B5 -------------------------------------------------------------------------------------------------
const transferCase = () => {
  const t = { data: 'docs/NOTLAR.md', class: 'CONFIDENTIAL', destination: 'analiz.example.invalid', scope: 'read-only' };
  const i = base();
  i.context.classification_evidence = { origin: T, class: 'CONFIDENTIAL', source_ref: 'fixture://owner', subjects: ['docs/NOTLAR.md'] };
  i.decision.data_classification = 'CONFIDENTIAL';
  i.decision.external_destinations = [t.destination];
  i.decision.permitted_transfers = [{ ...t }];
  i.context.transfer_authorizations = [{ origin: T, ...t }];
  return { i, t };
};

test('B5 positive: a complete transfer matched by a complete trusted authorization is accepted', () => {
  assert.equal(validateDecision(transferCase().i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('B5 negative: a transfer missing, blank or mistyped in any field is rejected (TRANSFER_INVALID)', () => {
  for (const field of ['data', 'class', 'destination', 'scope']) {
    for (const bad of [undefined, '', '  ', null, 1, ['x']]) {
      const { i } = transferCase();
      if (bad === undefined) delete i.decision.permitted_transfers[0][field];
      else i.decision.permitted_transfers[0][field] = bad;
      const r = validateDecision(i);
      assert.equal(r.verdict, 'REJECTED', `${field}=${JSON.stringify(bad)}`);
      assert.ok(has(r, 'TRANSFER_INVALID') || has(r, 'PROHIBITED_DATA_IN_TRANSFER'), `${field}=${JSON.stringify(bad)}`);
    }
  }
});

test('B5 negative: undefined === undefined cannot match: both transfer and authorization lacking a field is still rejected', () => {
  for (const field of ['data', 'class', 'destination', 'scope']) {
    const { i } = transferCase();
    delete i.decision.permitted_transfers[0][field];
    delete i.context.transfer_authorizations[0][field];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', field);
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD') && has(r, 'TRANSFER_INVALID'), field);
  }
});

test('B5 negative: an authorization differing in any single field does not authorize (TRANSFER_NOT_AUTHORIZED)', () => {
  for (const [field, value] of [['data', 'docs/BASKA.md'], ['destination', 'baska.example.invalid'], ['scope', 'write']]) {
    const { i } = transferCase();
    i.context.transfer_authorizations[0][field] = value;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', field);
    assert.ok(has(r, 'TRANSFER_NOT_AUTHORIZED'), field);
  }
});

// B6 -------------------------------------------------------------------------------------------------
const grantsFor = (pkgs) => pkgs.map((p, n) => depGrant({ source_ref: `fixture://g${n}`, scope: p === null ? { repo: REPO } : { repo: REPO, packages: p } }));

test('B6: with several grants the outcome and reasons are identical for every ledger order (all permutations)', () => {
  const cases = [
    // [grants, decision packages, expected derived status]
    [[['left-pad@1.0.0'], null, ['other@2.0.0']], ['left-pad@1.0.0'], 'AUTHORIZED_SCOPED'],
    // an incomplete grant means "explicit permission exists, boundaries incomplete" (Protocol §6.1) -> PENDING when no single grant covers
    [[['left-pad@1.0.0'], null, ['other@2.0.0']], ['left-pad@1.0.0', 'other@2.0.0'], 'AUTHORIZED_PENDING_SCOPE'], // complete grants are not merged
    [[null, ['other@2.0.0']], ['left-pad@1.0.0'], 'AUTHORIZED_PENDING_SCOPE'],
    [[['left-pad@1.0.0'], ['other@2.0.0']], ['left-pad@1.0.0', 'other@2.0.0'], 'NOT_AUTHORIZED'], // complete grants only: union is outside every single grant
    [[['left-pad@1.0.0'], ['other@2.0.0']], ['evil@9.9.9'], 'NOT_AUTHORIZED'],
    [[null, null], undefined, 'AUTHORIZED_PENDING_SCOPE'],
  ];
  for (const [grantSpecs, pkgs, expected] of cases) {
    const ledger = grantsFor(grantSpecs);
    const reports = permutations(ledger).map((l) => validateDecision(depCtx(l, pkgs ? { packages: pkgs } : {}, expected)));
    for (const r of reports) {
      assert.equal(r.derived.authorization[0].derived, expected, JSON.stringify([grantSpecs, pkgs]));
      assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
    }
    const sig = (r) => JSON.stringify([r.verdict, r.derived.authorization.map((a) => [a.derived, a.reason]), findings(r)]);
    assert.equal(new Set(reports.map(sig)).size, 1, `order-dependent report for ${JSON.stringify([grantSpecs, pkgs])}`);
    // a wrong claim is rejected in every order too
    const wrong = expected === 'AUTHORIZED_SCOPED' ? 'NOT_AUTHORIZED' : 'AUTHORIZED_SCOPED';
    for (const l of permutations(ledger)) assert.ok(has(validateDecision(depCtx(l, pkgs ? { packages: pkgs } : {}, wrong)), 'AUTH_MISMATCH'));
  }
});

test('B6: a grant together with an applicable revocation or prohibition is NOT_VERIFIED (no precedence or ordering is ratified), in any order and for any claim', () => {
  const revoke = (repo) => ({ origin: T, op: 'stage', state: 'revoked', scope: repo === undefined ? {} : { repo } });
  const grant = base().context.ledger[0];
  for (const rev of [revoke(REPO), revoke(undefined), revoke('SENTETIK-DEPO/')]) {
    for (const order of permutations([grant, rev])) {
      for (const status of ['AUTHORIZED_SCOPED', 'DENIED_OR_REVOKED', 'NOT_AUTHORIZED']) {
        const i = base();
        i.context.ledger = order;
        i.decision.operations[0].status = status;
        const r = validateDecision(i);
        assert.equal(r.verdict, 'NOT_VERIFIED', `${JSON.stringify(rev)} ${status}`);
        assert.ok(has(r, 'AUTH_UNVERIFIABLE'));
      }
    }
  }
  const pr = base();
  pr.context.prohibitions = [{ origin: T, op: 'stage' }];
  const r = validateDecision(pr);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'AUTH_UNVERIFIABLE'));
});

test('B1/B6: a repo-less decision is conservatively denied by a repo-specific revocation, and conflicts with a repo-less grant', () => {
  const grant = { origin: T, op: 'dependency_install', state: 'granted', required_scope: ['packages'], scope: { packages: ['left-pad@1.0.0'] }, source_ref: 'fixture://g' };
  const revoke = { origin: T, op: 'dependency_install', state: 'revoked', scope: { repo: REPO } };
  const mk = (ledger, status) => {
    const i = base();
    i.decision.risk = 'MEDIUM';
    i.context.operation_kinds = ['dependency_install'];
    i.context.ledger = ledger;
    i.decision.operations = [{ op: 'dependency_install', status, scope: { packages: ['left-pad@1.0.0'] } }]; // no repo declared
    return i;
  };
  assert.equal(validateDecision(mk([grant], 'AUTHORIZED_PENDING_SCOPE')).verdict, 'ACCEPTED_SYNTHETIC', 'control (ADIM 50): repo-less grant + repo-less decision is only PENDING_SCOPE');
  assert.ok(has(validateDecision(mk([grant], 'AUTHORIZED_SCOPED')), 'AUTH_MISMATCH'), 'and never SCOPED');
  const only = validateDecision(mk([revoke], 'DENIED_OR_REVOKED'));
  assert.equal(only.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(only.derived.authorization[0].derived, 'DENIED_OR_REVOKED');
  const both = validateDecision(mk([grant, revoke], 'AUTHORIZED_SCOPED'));
  assert.equal(both.verdict, 'NOT_VERIFIED');
  assert.ok(has(both, 'AUTH_UNVERIFIABLE'));
});

test('B1: a repo-less decision cannot ride on a repo-specific grant even when the grant does not list repo as required', () => {
  const g = { origin: T, op: 'dependency_install', state: 'granted', required_scope: ['packages'], scope: { repo: REPO, packages: ['left-pad@1.0.0'] }, source_ref: 'fixture://g' };
  const i = base();
  i.decision.risk = 'MEDIUM';
  i.context.operation_kinds = ['dependency_install'];
  i.context.ledger = [g];
  i.decision.operations = [{ op: 'dependency_install', status: 'AUTHORIZED_SCOPED', scope: { packages: ['left-pad@1.0.0'] } }]; // repo omitted
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'AUTH_MISMATCH'));
  assert.equal(r.derived.authorization[0].derived, 'NOT_AUTHORIZED');
  i.decision.operations[0].scope.repo = REPO; // control: same grant, repo declared
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

test('B6: grants with the same status but different reasons give an order-independent report (reasons included)', () => {
  const g1 = depGrant({ required_scope: ['repo', 'packages'], scope: { repo: REPO }, source_ref: 'fixture://g1' }); // lacks packages
  const g2 = depGrant({ required_scope: ['repo', 'registry'], scope: { repo: REPO }, source_ref: 'fixture://g2' }); // lacks registry
  const reports = permutations([g1, g2]).map((l) => validateDecision(depCtx(l, {}, 'AUTHORIZED_PENDING_SCOPE')));
  assert.ok(reports.every((r) => r.derived.authorization[0].derived === 'AUTHORIZED_PENDING_SCOPE'));
  assert.equal(new Set(reports.map((r) => JSON.stringify(r.derived.authorization.map((a) => a.reason)))).size, 1, 'reason text must not depend on ledger order');
});

test('B6: a revocation for another repository does not conflict with this repository\'s grant', () => {
  const i = base();
  i.context.ledger.push({ origin: T, op: 'stage', state: 'revoked', scope: { repo: 'baska-depo' } });
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

// =====================================================================================================
// Third independent review (read-only) findings that were fixed: Y1, Y2, Y3, O1, O2, O3, O5 (+ coverage gaps)
// =====================================================================================================

test('Y1: a malformed classification_evidence (array, string, number) is rejected, never ignored -> no silent downgrade', () => {
  for (const bad of [[{ origin: T, class: 'RESTRICTED', source_ref: 'x' }], 'RESTRICTED', 7, true]) {
    const i = base();
    i.context.classification_evidence = bad;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(bad));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(bad));
  }
  const ok = base();
  ok.context.classification_evidence = null; // explicit "no evidence" stays valid
  assert.equal(validateDecision(ok).verdict, 'ACCEPTED_SYNTHETIC');
});

test('Y2: operation names are exact lowercase tokens, so "Stage" / "stage " cannot dodge a revocation or prohibition', () => {
  for (const op of ['stage ', 'Stage', ' stage', '', 'sta ge', 'stage-1', 42]) {
    const rev = base();
    rev.context.ledger.push({ origin: T, op, state: 'revoked', scope: { repo: REPO } });
    const r = validateDecision(rev);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(op));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(op));
    const pro = base();
    pro.context.prohibitions = [{ origin: T, op }];
    assert.equal(validateDecision(pro).verdict, 'REJECTED', `prohibition ${JSON.stringify(op)}`);
    const dec = base();
    dec.decision.operations[1].op = op;
    assert.ok(has(validateDecision(dec), 'INVALID_OPERATION'), `decision ${JSON.stringify(op)}`);
  }
});

test('Y3: a trusted user cancellation or genuine blocker contradicts COMPLETED / VERIFIED / IN_PROGRESS', () => {
  const done = () => {
    const i = base();
    i.decision.task_state = 'COMPLETED';
    i.context.acceptance_criteria = ['c1'];
    i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
    return i;
  };
  assert.equal(validateDecision(done()).verdict, 'ACCEPTED_SYNTHETIC', 'control');
  for (const state of ['COMPLETED', 'VERIFIED', 'IN_PROGRESS', 'READY']) {
    const i = done();
    i.decision.task_state = state;
    i.context.user_cancellation = { origin: T, ref: 'fixture://cancel' };
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', `cancellation vs ${state}`);
    assert.ok(has(r, 'STATE_CONFLICTS_WITH_CANCELLATION'), state);
  }
  for (const state of ['COMPLETED', 'VERIFIED', 'IN_PROGRESS']) {
    const i = done();
    i.decision.task_state = state;
    i.context.blockers = [{ origin: T, kind: 'security_obstacle' }];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', `blocker vs ${state}`);
    assert.ok(has(r, 'STATE_CONFLICTS_WITH_BLOCKER'), state);
  }
  const m = done();
  m.context.blockers = [{ origin: T, kind: 'missing_repo' }]; // missing scope is not a genuine blocker
  assert.equal(validateDecision(m).verdict, 'ACCEPTED_SYNTHETIC');
});

test('O5: a cancellation record needs a trusted origin and a non-empty ref', () => {
  for (const bad of [{ origin: T }, { origin: T, ref: '' }, { origin: 'model_asserted', ref: 'x' }, 'cancelled', { ref: 'x' }]) {
    const i = base();
    i.context.user_cancellation = bad;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(bad));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(bad));
  }
});

test('O1: globs, ".", absolute paths and ".." traversal are never concrete file scope (decision and ledger)', () => {
  for (const file of ['**/*', '*.md', 'docs/?.md', 'docs/[a].md', '.', '..', '../x', 'a/../../x', '/etc/hosts', 'C:\\Windows\\x', '\\\\server\\share']) {
    const dec = base();
    dec.decision.operations[0].scope.files = [file];
    dec.context.ledger[0].scope.files = ['docs/NOTES.md'];
    assert.ok(has(validateDecision(dec), 'INVALID_OPERATION'), `decision ${file}`);
    const led = base();
    led.context.ledger[0].scope.files = [file];
    led.decision.operations[0].scope.files = [file];
    const r = validateDecision(led);
    assert.equal(r.verdict, 'REJECTED', `ledger ${file}`);
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), `ledger ${file}`);
  }
  const ok = base();
  ok.context.ledger[0].scope.files = ['docs/NOTES.md', 'src/a.txt'];
  ok.decision.operations[0].scope.files = ['docs/NOTES.md', 'src/a.txt'];
  assert.equal(validateDecision(ok).verdict, 'ACCEPTED_SYNTHETIC', 'control: concrete relative paths');
  const st = fullGit();
  st.decision.operations[1].scope.staged_scope = ['**/*'];
  assert.ok(has(validateDecision(st), 'INVALID_OPERATION'), 'staged_scope globs');
});

test('O2: an incomplete (PENDING_SCOPE) grant still fixes the boundaries it names; a contradicting decision is NOT_AUTHORIZED', () => {
  const g = base();
  g.context.ledger = [{ origin: T, op: 'stage', state: 'granted', scope: { repo: REPO }, source_ref: 'fixture://p' }]; // files missing
  g.decision.operations[0] = { op: 'stage', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: REPO } };
  assert.equal(validateDecision(g).verdict, 'ACCEPTED_SYNTHETIC', 'control');
  g.decision.operations[0].scope.files = ['docs/NOTES.md']; // grant names no files: nothing contradicted
  assert.equal(validateDecision(g).verdict, 'ACCEPTED_SYNTHETIC');
  const other = base();
  other.context.ledger = [{ origin: T, op: 'stage', state: 'granted', scope: { repo: REPO }, source_ref: 'fixture://p' }];
  other.decision.operations[0] = { op: 'stage', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: 'baska-depo' } };
  assert.ok(has(validateDecision(other), 'AUTH_MISMATCH'), 'a PENDING claim for a repository with no grant is rejected');
  const push = fullGit();
  push.context.ledger[2].scope = { repo: REPO, remote: 'origin' }; // branch missing
  push.decision.operations[2] = { op: 'push', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: REPO, remote: 'evil' } };
  const r = validateDecision(push);
  assert.ok(has(r, 'AUTH_MISMATCH'));
  assert.equal(r.derived.authorization[2].derived, 'NOT_AUTHORIZED');
  const intent = fullGit();
  intent.context.ledger[1].scope = { repo: REPO, intent: 'a' }; // staged_scope missing
  intent.decision.operations[1] = { op: 'commit', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: REPO, intent: 'b' } };
  assert.equal(validateDecision(intent).derived.authorization[1].derived, 'NOT_AUTHORIZED');
});

test('O3: raw-secret transfer labels are matched after case / space / hyphen canonicalization', () => {
  for (const data of ['private_keys ', 'Raw_Credentials', 'raw-credentials', ' PRODUCTION SECRETS ', 'production-secrets']) {
    const { i } = transferCase();
    i.decision.permitted_transfers[0].data = data;
    i.context.transfer_authorizations[0].data = data;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', data);
    assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER'), data);
  }
});

test('prototype keys: operation_kinds and ops named like Object.prototype members never reach inherited properties', () => {
  const i = base();
  i.context.operation_kinds = ['stage', 'constructor'];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'RISK_FLOOR_UNVERIFIABLE'));
  i.context.operation_kinds = ['stage', 'toString', '__proto__']; // not lowercase tokens: rejected outright (ADIM 50)
  assert.ok(has(validateDecision(i), 'INVALID_CONTEXT_FIELD'));
  const g = base();
  g.context.ledger.push({ origin: T, op: 'constructor', state: 'granted', scope: { repo: REPO }, source_ref: 'fixture://c' });
  g.decision.operations.push({ op: 'constructor', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO } });
  const gr = validateDecision(g);
  assert.equal(gr.verdict, 'NOT_VERIFIED', 'unstated required_scope, not a TypeError');
  assert.ok(has(gr, 'AUTH_UNVERIFIABLE'));
  assert.ok(!has(gr, 'VALIDATOR_INTERNAL_ERROR'));
});

test('coverage: untrusted origins on dispatch / acceptance / transfer records and non-array decision fields are rejected', () => {
  const d = highReview();
  d.context.dispatch_records = [{ origin: 'model_asserted', agent: 'sec-1', record_ref: 'x' }];
  assert.ok(has(validateDecision(d), 'UNTRUSTED_ORIGIN'));
  const a = base();
  a.decision.task_state = 'COMPLETED';
  a.context.acceptance_criteria = ['c1'];
  a.context.acceptance_evidence = [{ origin: 'model_asserted', criterion_id: 'c1', result: 'passed', ref: 'x' }];
  const ar = validateDecision(a);
  assert.equal(ar.verdict, 'REJECTED');
  assert.ok(has(ar, 'UNTRUSTED_ORIGIN') && has(ar, 'UNEVIDENCED_COMPLETION'));
  const { i } = transferCase();
  i.context.transfer_authorizations[0].origin = 'model_asserted';
  assert.ok(has(validateDecision(i), 'UNTRUSTED_ORIGIN'));
  for (const field of ['permitted_transfers', 'operations']) {
    const x = base();
    x.decision[field] = 'none';
    assert.ok(has(validateDecision(x), 'INVALID_FIELD'), field);
  }
});

test('coverage: HIGH-risk VERIFIED (not only COMPLETED) also needs a claimed, verified independent review', () => {
  const i = highReview();
  i.decision.task_state = 'VERIFIED';
  i.context.acceptance_criteria = ['c1'];
  i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
  assert.ok(has(validateDecision(i), 'HIGH_WITHOUT_INDEPENDENT_REVIEW'));
});

test('CLI: NOT_VERIFIED exits 3, stdin ("-") works, and a missing file exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'director-gate-'));
  try {
    const nv = base();
    nv.decision.data_classification = 'CONFIDENTIAL'; // no evidence -> NOT_VERIFIED
    const f = join(dir, 'nv.json');
    writeFileSync(f, JSON.stringify(nv));
    const a = spawnSync(process.execPath, [SCRIPT, f], { encoding: 'utf8' });
    assert.equal(a.status, 3);
    assert.equal(JSON.parse(a.stdout).verdict, 'NOT_VERIFIED');
    const b = spawnSync(process.execPath, [SCRIPT, '-'], { encoding: 'utf8', input: JSON.stringify(base()) });
    assert.equal(b.status, 0);
    assert.equal(JSON.parse(b.stdout).verdict, 'ACCEPTED_SYNTHETIC');
    const c = spawnSync(process.execPath, [SCRIPT, join(dir, 'absent.json')], { encoding: 'utf8' });
    assert.equal(c.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// =====================================================================================================
// ADIM 50: O4 (evidence <-> data binding), O6 (repository always required), O7 (unlabeled context inputs).
// Written BEFORE the code changes; the "before" results are recorded in the ADIM 50 report.
// The subject/provenance checks below are fixture-level string matches, NOT real provenance verification.
// =====================================================================================================

const DS = 'docs/NOTLAR.md';
const withClass = (i, cls, { subjects = [DS], dataSubjects = [DS] } = {}) => {
  i.context.classification_evidence = { origin: T, class: cls, source_ref: 'fixture://owner', subjects };
  i.context.data_subjects = dataSubjects.map((s) => ({ origin: T, subject: s }));
  i.decision.data_classification = cls;
  return i;
};

// ---- O4 ----
test('O4 negative: PUBLIC evidence about another object (README) cannot support a PUBLIC classification of the task data -> REJECTED', () => {
  const i = withClass(base(), 'PUBLIC', { subjects: ['README.md'], dataSubjects: ['secrets/prod.env'] });
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'UNEVIDENCED_CLASS'));
  assert.ok(has(r, 'EVIDENCE_SUBJECT_UNBOUND'));
  assert.equal(r.derived.effective_classification, 'UNCLASSIFIED');
});

test('O4 negative: partial coverage, missing data_subjects and evidence without subjects all fail closed', () => {
  const partial = withClass(base(), 'PUBLIC', { subjects: [DS], dataSubjects: [DS, 'secrets/prod.env'] });
  assert.equal(validateDecision(partial).verdict, 'REJECTED');
  assert.ok(has(validateDecision(partial), 'EVIDENCE_SUBJECT_UNBOUND'));
  const none = withClass(base(), 'PUBLIC');
  delete none.context.data_subjects; // nothing says which data the task touches
  assert.equal(validateDecision(none).verdict, 'REJECTED');
  assert.ok(has(validateDecision(none), 'EVIDENCE_SUBJECT_UNBOUND'));
  const empty = withClass(base(), 'PUBLIC', { dataSubjects: [] });
  assert.equal(validateDecision(empty).verdict, 'REJECTED');
  const nosub = withClass(base(), 'PUBLIC');
  delete nosub.context.classification_evidence.subjects;
  assert.ok(has(validateDecision(nosub), 'CLASSIFICATION_EVIDENCE_INVALID'));
  for (const bad of [[], [''], ['  '], [1], 'docs/NOTLAR.md']) {
    const x = withClass(base(), 'PUBLIC');
    x.context.classification_evidence.subjects = bad;
    assert.ok(has(validateDecision(x), 'CLASSIFICATION_EVIDENCE_INVALID'), JSON.stringify(bad));
  }
});

test('O4 negative: a restrictive class whose evidence is not bound to the task data is NOT_VERIFIED, not accepted', () => {
  const i = withClass(base(), 'CONFIDENTIAL', { subjects: ['baska/dosya.md'] });
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'EVIDENCE_SUBJECT_UNBOUND'));
});

test('O4 negative: a transfer of data the evidence does not cover is rejected even with a matching authorization', () => {
  const t = { data: 'secrets/prod.env', class: 'PUBLIC', destination: 'analiz.example.invalid', scope: 'read-only' };
  const i = withClass(base(), 'PUBLIC', { subjects: ['README.md', 'secrets/prod.env'], dataSubjects: ['README.md'] });
  i.context.classification_evidence.subjects = ['README.md']; // evidence is about README only
  i.decision.external_destinations = [t.destination];
  i.decision.permitted_transfers = [t];
  i.context.transfer_authorizations = [{ origin: T, ...t }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'TRANSFER_DATA_NOT_COVERED_BY_EVIDENCE'));
});

test('O4 negative: the model cannot attach its own subject / hash / source label to the decision', () => {
  for (const k of ['data_subject', 'subject', 'subjects', 'evidence_hash', 'source_ref']) {
    const i = withClass(base(), 'PUBLIC');
    i.decision[k] = DS;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', k);
    assert.ok(has(r, 'UNKNOWN_FIELD'), k);
  }
  const u = withClass(base(), 'PUBLIC');
  delete u.context.data_subjects[0].origin;
  assert.ok(has(validateDecision(u), 'UNTRUSTED_ORIGIN'), 'unlabeled data_subjects record is not evidence');
});

test('O4 negative: a malformed data_subjects record next to a valid one is rejected, never skipped (a skipped record would hide data from the binding)', () => {
  for (const bad of ['', '  ', null, 7, ['x']]) {
    const i = withClass(base(), 'PUBLIC');
    i.context.data_subjects.push({ origin: T, subject: bad });
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(bad));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(bad));
  }
  const notArray = withClass(base(), 'PUBLIC');
  notArray.context.data_subjects = DS;
  assert.ok(has(validateDecision(notArray), 'INVALID_CONTEXT_FIELD'));
});

test('O4 positive: evidence covering every task data subject is accepted -- and reported as fixture-level binding only', () => {
  const i = withClass(base(), 'PUBLIC');
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.operational, false);
  assert.equal(r.derived.effective_classification, 'PUBLIC');
  assert.equal(r.derived.classification_binding, 'FIXTURE_STRING_MATCH_ONLY');
  assert.ok(has(r, 'CLASSIFICATION_PROVENANCE_NOT_IMPLEMENTED'));
  const two = withClass(base(), 'CONFIDENTIAL', { subjects: [DS, 'docs/B.md'], dataSubjects: [DS, 'docs/B.md'] });
  assert.equal(validateDecision(two).verdict, 'ACCEPTED_SYNTHETIC');
});

// ---- O6 ----
test('O6: a repo-less grant plus a repo-less decision is NOT authority: SCOPED claim rejected, PENDING accepted (permission exists, repository missing)', () => {
  const grant = { origin: T, op: 'dependency_install', state: 'granted', required_scope: ['packages'], scope: { packages: ['left-pad@1.0.0'] }, source_ref: 'fixture://g' };
  const mk = (status) => {
    const i = base();
    i.decision.risk = 'MEDIUM';
    i.context.operation_kinds = ['dependency_install'];
    i.context.ledger = [grant];
    i.decision.operations = [{ op: 'dependency_install', status, scope: { packages: ['left-pad@1.0.0'] } }];
    return i;
  };
  const scoped = validateDecision(mk('AUTHORIZED_SCOPED'));
  assert.equal(scoped.verdict, 'REJECTED');
  assert.ok(has(scoped, 'AUTH_MISMATCH'));
  assert.equal(scoped.derived.authorization[0].derived, 'AUTHORIZED_PENDING_SCOPE');
  assert.equal(validateDecision(mk('AUTHORIZED_PENDING_SCOPE')).verdict, 'ACCEPTED_SYNTHETIC');
});

test('O6: required_scope that omits "repo" still cannot yield SCOPED without a declared repository; the model cannot pick a default repository', () => {
  const grant = { origin: T, op: 'dependency_install', state: 'granted', required_scope: ['packages'], scope: { repo: REPO, packages: ['left-pad@1.0.0'] }, source_ref: 'fixture://g' };
  const i = base();
  i.decision.risk = 'MEDIUM';
  i.context.operation_kinds = ['dependency_install'];
  i.context.ledger = [grant]; // exactly one repository is granted: the validator must still not infer it
  i.decision.operations = [{ op: 'dependency_install', status: 'AUTHORIZED_SCOPED', scope: { packages: ['left-pad@1.0.0'] } }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.equal(r.derived.authorization[0].derived, 'NOT_AUTHORIZED');
  i.decision.operations[0].scope.repo = REPO; // control: declared repository
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
  i.decision.operations[0].scope.repo = 'baska-depo';
  assert.ok(has(validateDecision(i), 'AUTH_MISMATCH'), 'another repository does not inherit the grant');
});

test('O6: Git operations without a repository can only be PENDING_SCOPE / NOT_AUTHORIZED, never SCOPED', () => {
  for (const op of ['stage', 'commit', 'push']) {
    const i = base();
    i.context.operation_kinds = [op];
    i.context.risk_policy.floors[op] = 'MEDIUM';
    i.decision.risk = 'MEDIUM';
    i.context.ledger = [{ origin: T, op, state: 'granted', scope: {}, source_ref: 'fixture://g' }];
    i.decision.operations = [{ op, status: 'AUTHORIZED_SCOPED', scope: {} }];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', op);
    assert.equal(r.derived.authorization[0].derived, 'AUTHORIZED_PENDING_SCOPE', op);
  }
});

// ---- O7 ----
test('O7: operation_kinds written by the model grants no authority: a listed kind without a trusted grant stays NOT_AUTHORIZED', () => {
  const i = base();
  i.context.operation_kinds = ['stage', 'source_change', 'push'];
  i.context.risk_policy.floors.source_change = 'MEDIUM';
  i.context.risk_policy.floors.push = 'MEDIUM';
  i.decision.risk = 'MEDIUM';
  i.decision.operations = [
    { op: 'source_change', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, files: ['a.txt'] } },
    { op: 'push', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, remote: 'origin', branch: 'main' } },
  ];
  i.context.ledger = [];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.deepEqual(r.derived.authorization.map((a) => a.derived), ['NOT_AUTHORIZED', 'NOT_AUTHORIZED']);
});

test('O7: operation_kinds must be unique lowercase tokens (no prototype names, no duplicates, no objects posing as labeled records)', () => {
  for (const kinds of [['stage', 'stage'], ['Stage'], ['__proto__'], [''], [{ origin: T, kind: 'stage' }], 'stage']) {
    const i = base();
    i.context.operation_kinds = kinds;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(kinds));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(kinds));
  }
});

test('O7: the policy floor lookup ignores inherited properties (kind named "constructor" or "toString")', () => {
  for (const kind of ['constructor', 'tostring', 'valueof']) {
    const i = base();
    i.context.operation_kinds = ['stage', kind];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'NOT_VERIFIED', kind);
    assert.ok(has(r, 'RISK_FLOOR_UNVERIFIABLE'), kind);
  }
});

test('O7: a model-stated implementer_id gives no independence by itself; a trusted dispatch record that says otherwise wins', () => {
  const mk = () => {
    const i = highReview();
    i.decision.task_state = 'VERIFIED';
    i.context.acceptance_criteria = ['c1'];
    i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
    i.decision.coordination.review_verified = ['impl-9'];
    i.context.implementer_id = 'impl-1'; // the (untrusted) claim
    i.context.dispatch_records = [{ origin: T, agent: 'impl-9', role: 'implementer', record_ref: 'fixture://d9' }];
    i.context.review_records = [{ origin: T, reviewer_id: 'impl-9', primary_evidence_ref: 'fixture://e', criteria_met: true }];
    return i;
  };
  const r = validateDecision(mk());
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'UNEVIDENCED_REVIEW_VERIFIED'));
  assert.ok(has(r, 'IMPLEMENTER_CONTRADICTED'));
  const ok = mk();
  ok.context.implementer_id = 'impl-9'; // consistent claim, but then the reviewer is the implementer
  assert.ok(has(validateDecision(ok), 'UNEVIDENCED_REVIEW_VERIFIED'));
  for (const bad of [42, '', '  ', null, ['impl-1']]) {
    const x = base();
    x.context.implementer_id = bad;
    assert.ok(has(validateDecision(x), 'INVALID_CONTEXT_FIELD'), JSON.stringify(bad));
  }
});

test('O7: model-written acceptance_criteria cannot hide trusted evidence for criteria it left out', () => {
  const i = base();
  i.decision.task_state = 'COMPLETED';
  i.context.acceptance_criteria = ['c1']; // the model-authored list omits c2
  i.context.acceptance_evidence = [
    { origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://r1' },
    { origin: T, criterion_id: 'c2', result: 'failed', ref: 'fixture://r2' },
  ];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED');
  assert.ok(has(r, 'EVIDENCE_FOR_UNDECLARED_CRITERION'));
  for (const bad of [['c1', 'c1'], [''], [1], 'c1']) {
    const x = base();
    x.context.acceptance_criteria = bad;
    assert.ok(has(validateDecision(x), 'INVALID_CONTEXT_FIELD'), JSON.stringify(bad));
  }
  const ok = base();
  ok.decision.task_state = 'COMPLETED';
  ok.context.acceptance_criteria = ['c1', 'c2'];
  ok.context.acceptance_evidence = i.context.acceptance_evidence.map((e) => ({ ...e, result: 'passed' }));
  assert.equal(validateDecision(ok).verdict, 'ACCEPTED_SYNTHETIC');
});

test('O7: the unlabeled context inputs are always reported as unverified; no label is fabricated to hide the open trust boundary', () => {
  const r = validateDecision(base());
  assert.deepEqual(r.derived.unverified_inputs, ['operation_kinds', 'implementer_id', 'acceptance_criteria']);
  assert.ok(has(r, 'UNLABELED_CONTEXT_INPUTS'));
  assert.equal(r.operational, false);
  assert.equal(r.trust_boundary, 'SYNTHETIC_FIXTURE_ONLY');
  const x = base();
  x.context.operation_kinds = [{ origin: T, kind: 'stage' }]; // adding a label does not make the field trusted
  assert.equal(validateDecision(x).verdict, 'REJECTED');
});

// ---- fixes for the fourth review's findings that were side effects of the O4/O7 work ----
test('Y-A: a non-passed acceptance record for a criterion cannot be outvoted by another passed record (no ordering is ratified)', () => {
  const mk = (records) => {
    const i = base();
    i.decision.task_state = 'COMPLETED';
    i.context.acceptance_criteria = ['c1'];
    i.context.acceptance_evidence = records;
    return i;
  };
  const failed = { origin: T, criterion_id: 'c1', result: 'failed', ref: 'fixture://a' };
  const passed = { origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://b' };
  assert.equal(validateDecision(mk([passed])).verdict, 'ACCEPTED_SYNTHETIC', 'control');
  for (const order of permutations([failed, passed])) {
    const r = validateDecision(mk(order));
    assert.equal(r.verdict, 'REJECTED');
    assert.ok(has(r, 'CONFLICTING_ACCEPTANCE_EVIDENCE'));
  }
  assert.ok(has(validateDecision(mk([failed])), 'CONFLICTING_ACCEPTANCE_EVIDENCE'));
});

test('O-9 (acceptance evidence): malformed or unknown-result evidence records are rejected, never silently dropped', () => {
  for (const rec of [{ origin: T, criterion_id: 'c1', result: 'skipped', ref: 'x' }, { origin: T, criterion_id: 7, result: 'failed', ref: 'x' }, { origin: T, result: 'failed', ref: 'x' }, { origin: T, criterion_id: 'c1', result: 'passed', ref: 0 }, { origin: T, criterion_id: 'c1', result: 'passed', ref: false }, { origin: T, criterion_id: 'c1', result: 'passed' }]) {
    const i = base();
    i.decision.task_state = 'COMPLETED';
    i.context.acceptance_criteria = ['c1'];
    i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'ok' }, rec];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(rec));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(rec));
  }
});

test('O-1: the Protocol role name "Implementation Engineer" identifies the implementer in dispatch records exactly like the token', () => {
  for (const role of ['implementer', 'Implementation Engineer']) {
    const i = highReview();
    i.decision.task_state = 'VERIFIED';
    i.context.acceptance_criteria = ['c1'];
    i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
    i.decision.coordination.review_verified = ['impl-9'];
    i.context.implementer_id = 'impl-1';
    i.context.dispatch_records = [{ origin: T, agent: 'impl-9', role, record_ref: 'fixture://d9' }];
    i.context.review_records = [{ origin: T, reviewer_id: 'impl-9', primary_evidence_ref: 'fixture://e', criteria_met: true }];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', role);
    assert.ok(has(r, 'UNEVIDENCED_REVIEW_VERIFIED') && has(r, 'IMPLEMENTER_CONTRADICTED'), role);
  }
  const reviewer = highReview(); // control: a dispatched security reviewer is not an implementer
  reviewer.decision.task_state = 'VERIFIED';
  reviewer.context.acceptance_criteria = ['c1'];
  reviewer.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
  reviewer.decision.coordination.review_verified = ['sec-1'];
  reviewer.context.dispatch_records = [{ origin: T, agent: 'impl-1', role: 'Implementation Engineer', record_ref: 'fixture://d1' }, { origin: T, agent: 'sec-1', role: 'Security Engineer', record_ref: 'fixture://d2' }];
  reviewer.context.review_records = [{ origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://e', criteria_met: true }];
  assert.equal(validateDecision(reviewer).verdict, 'ACCEPTED_SYNTHETIC');
});

test('O-4: evidence that is broader than the task cannot launder a transfer of data the task does not touch', () => {
  const t = { data: 'secrets/prod.env', class: 'PUBLIC', destination: 'analiz.example.invalid', scope: 'read-only' };
  const i = withClass(base(), 'PUBLIC', { subjects: ['README.md', 'secrets/prod.env'], dataSubjects: ['README.md'] });
  i.decision.external_destinations = [t.destination];
  i.decision.permitted_transfers = [t];
  i.context.transfer_authorizations = [{ origin: T, ...t }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'TRANSFER_DATA_NOT_IN_TASK_DATA'));
  assert.ok(!has(r, 'TRANSFER_DATA_NOT_COVERED_BY_EVIDENCE'), 'only the task-data rule can reject this case');
  i.context.data_subjects.push({ origin: T, subject: 'secrets/prod.env' }); // control: the task really touches it and the evidence names it
  assert.equal(validateDecision(i).verdict, 'ACCEPTED_SYNTHETIC');
});

// =====================================================================================================
// ADIM 51: Y-B -- the decision's own prohibited_transfers must take precedence over permitted_transfers (Protocol §5).
// Schema fact: prohibited_transfers is a list of DATA identifiers only (Protocol §5: "Data that must not leave the session");
// it has no destination / scope / type, so only `data` is compared. No other matching policy is ratified or invented.
// =====================================================================================================
const PROH3 = ['raw_credentials', 'private_keys', 'production_secrets'];
const ybCase = (prohibitedExtra = [], transfers = [{ data: DS }]) => {
  const { i, t } = transferCase();
  i.decision.prohibited_transfers = [...PROH3, ...prohibitedExtra];
  i.decision.permitted_transfers = transfers.map((x) => ({ ...t, ...x }));
  i.context.transfer_authorizations = transfers.map((x) => ({ origin: T, ...t, ...x }));
  return i;
};

test('Y-B scenario C: a transfer that does not overlap any prohibited entry is accepted (synthetic only), even with extra prohibited entries', () => {
  const r = validateDecision(ybCase(['secrets/prod.env', 'docsx']));
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.operational, false);
});

test('Y-B scenario A: the same data both permitted and prohibited is rejected (also under case / slash / whitespace variants)', () => {
  for (const [prohibited, data] of [[DS, DS], [DS.toUpperCase(), DS], [' docs\\NOTLAR.md ', DS], ['docs/NOTLAR.md/', DS], [DS, 'DOCS/notlar.md ']]) {
    const i = ybCase([prohibited], [{ data }]);
    i.context.classification_evidence.subjects = [data];
    i.context.data_subjects = [{ origin: T, subject: data }];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', `${prohibited} vs ${data}`);
    assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER'), `${prohibited} vs ${data}`);
  }
});

test('Y-B scenario B: containment or glob overlap with a prohibited entry cannot be decided with ratified rules -> NOT_VERIFIED, never accepted', () => {
  const mk = (prohibited, data) => {
    const i = ybCase([prohibited], [{ data }]);
    i.context.classification_evidence.subjects = [data];
    i.context.data_subjects = [{ origin: T, subject: data }];
    return validateDecision(i);
  };
  for (const [prohibited, data] of [['docs', DS], ['docs/', DS], ['docs/NOTLAR.md/ek', DS], ['docs/*.md', DS], ['**/*', DS], ['private_keys', 'private_keys/id_rsa.txt'], ['raw_credentials', 'raw_credentials/api.txt']]) {
    const r = mk(prohibited, data);
    assert.equal(r.verdict, 'NOT_VERIFIED', `${prohibited} vs ${data}`);
    assert.ok(has(r, 'PROHIBITED_SCOPE_AMBIGUOUS'), `${prohibited} vs ${data}`);
  }
});

// ---- independent review of the Y-B fix itself (Y-B-1 / -2 / -3 / -5): composed normalization and bypass variants ----
const ybData = (prohibited, data) => {
  const i = ybCase([prohibited], [{ data }]);
  i.context.classification_evidence.subjects = [data];
  i.context.data_subjects = [{ origin: T, subject: data }];
  return validateDecision(i);
};

test('Y-B-1: case, slash, hyphen/underscore/space folding COMPOSE (a canonical label with a trailing slash or hyphens cannot slip through)', () => {
  for (const data of ['raw-credentials/', 'RAW-CREDENTIALS//', ' Raw Credentials ', 'raw_ credentials', 'production--secrets', 'Private-Keys\\']) {
    const r = ybData(DS, data);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(data));
    assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER'), JSON.stringify(data));
  }
  for (const data of ['Private-Keys/id_rsa.pem', 'raw-credentials/api.txt', 'PRODUCTION SECRETS/prod.env']) {
    const r = ybData(DS, data);
    assert.equal(r.verdict, 'NOT_VERIFIED', JSON.stringify(data));
    assert.ok(has(r, 'PROHIBITED_SCOPE_AMBIGUOUS'), JSON.stringify(data));
  }
});

test('Y-B-2: "./", "//", ".." and root-like prohibited entries are handled path-wise, never silently skipped', () => {
  for (const [prohibited, data] of [['secrets/prod.env', './secrets/prod.env'], ['./secrets/prod.env', 'secrets/prod.env'], ['secrets//prod.env', 'secrets/prod.env'], ['secrets/prod.env', 'secrets/./prod.env']]) {
    const r = ybData(prohibited, data);
    assert.equal(r.verdict, 'REJECTED', `${prohibited} vs ${data}`);
    assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER'), `${prohibited} vs ${data}`);
  }
  for (const [prohibited, data] of [['secrets/prod.env', 'x/../secrets/prod.env'], ['x/../secrets/prod.env', 'secrets/prod.env'], ['.', DS], ['/', DS], ['./', DS], ['..', DS]]) {
    const r = ybData(prohibited, data);
    assert.equal(r.verdict, 'NOT_VERIFIED', `${prohibited} vs ${data}`);
    assert.ok(has(r, 'PROHIBITED_SCOPE_AMBIGUOUS'), `${prohibited} vs ${data}`);
  }
});

test('Y-B-2: a root-like transfer ("." / "/") against a root-like prohibited entry is undecidable -> NOT_VERIFIED, not "no overlap"', () => {
  for (const [prohibited, data] of [['.', '.'], ['/', '/'], ['./', '.'], ['.', '/']]) {
    const r = ybData(prohibited, data);
    assert.equal(r.verdict, 'NOT_VERIFIED', `${prohibited} vs ${data}`);
    assert.ok(has(r, 'PROHIBITED_SCOPE_AMBIGUOUS'), `${prohibited} vs ${data}`);
  }
});

test('Y-B-1: backslash path separators fold to "/" in both the transfer data and the prohibited entry', () => {
  for (const [prohibited, data] of [['secrets\\prod.env', 'secrets/prod.env'], ['secrets/prod.env', 'secrets\\prod.env'], ['SECRETS\\Prod.Env\\', 'secrets/prod.env']]) {
    const r = ybData(prohibited, data);
    assert.equal(r.verdict, 'REJECTED', `${prohibited} vs ${data}`);
    assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER'), `${prohibited} vs ${data}`);
  }
});

test('Y-B-3: Unicode compatibility forms, zero-width / control characters and NUL do not hide a prohibited label', () => {
  const ZW = String.fromCharCode(0x200b);
  const NUL = String.fromCharCode(0);
  for (const data of [`raw_${ZW}credentials`, `raw_credentials${NUL}`, 'ｒａｗ_credentials', `private${ZW}_keys`, `production_secrets${String.fromCharCode(0x202e)}`]) {
    const r = ybData(DS, data);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(data));
    assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER'), JSON.stringify(data));
  }
});

test('Y-B-5 / O-10 (transfers): an unknown key on a permitted transfer is rejected, so it cannot carry data past the prohibited comparison', () => {
  for (const extra of [{ payload: 'raw_credentials' }, { approved_by: 'user' }, { data2: 'x' }]) {
    const { i, t } = transferCase();
    i.decision.permitted_transfers = [{ ...t, ...extra }];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(extra));
    assert.ok(has(r, 'UNKNOWN_FIELD'), JSON.stringify(extra));
  }
});

test('Y-B scenario D: with several transfers one prohibited transfer rejects the whole decision; no partial permission is derived', () => {
  const i = ybCase(['secrets/prod.env'], [{ data: DS }, { data: 'secrets/prod.env' }]);
  i.context.classification_evidence.subjects = [DS, 'secrets/prod.env'];
  i.context.data_subjects = [{ origin: T, subject: DS }, { origin: T, subject: 'secrets/prod.env' }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  const bad = r.findings.filter((f) => f.code === 'PROHIBITED_DATA_IN_TRANSFER');
  assert.deepEqual(bad.map((f) => f.path), ['decision.permitted_transfers[1]']);
  assert.ok(!('permitted' in r.derived) && !('accepted_transfers' in r.derived), 'no partial permission is produced');
  const ambiguousFirst = ybCase(['docs'], [{ data: DS }, { data: 'readme.md' }]);
  ambiguousFirst.context.classification_evidence.subjects = [DS, 'readme.md'];
  ambiguousFirst.context.data_subjects = [{ origin: T, subject: DS }, { origin: T, subject: 'readme.md' }];
  assert.equal(validateDecision(ambiguousFirst).verdict, 'NOT_VERIFIED');
});

test('Y-B scenario E: a missing, malformed or ambiguous prohibited_transfers list never silently produces permission', () => {
  for (const extra of [null, 7, '', '   ', {}, { path: DS }, [DS], true]) {
    const i = ybCase([extra]);
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(extra));
    assert.ok(has(r, 'PROHIBITED_TRANSFERS_INCOMPLETE'), JSON.stringify(extra));
  }
  for (const bad of [undefined, null, 'raw_credentials', {}, []]) {
    const i = ybCase();
    if (bad === undefined) delete i.decision.prohibited_transfers;
    else i.decision.prohibited_transfers = bad;
    assert.equal(validateDecision(i).verdict, 'REJECTED', JSON.stringify(bad));
  }
});

test('Y-B: the model\'s own list can only restrict -- omitting a canonical secret label from it does not unblock a transfer of that secret', () => {
  const i = ybCase([], [{ data: 'private_keys' }]);
  i.decision.prohibited_transfers = ['raw_credentials', 'production_secrets']; // model "forgot" private_keys
  i.context.classification_evidence.subjects = ['private_keys'];
  i.context.data_subjects = [{ origin: T, subject: 'private_keys' }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'PROHIBITED_DATA_IN_TRANSFER') && has(r, 'PROHIBITED_TRANSFERS_INCOMPLETE'));
});

test('Y-B scenario F (NOT IMPLEMENTED -- characterization only): the schema has no trusted transfer-prohibition record, so a trusted context prohibition cannot block a permitted transfer', () => {
  // context.prohibitions only carries OPERATION prohibitions (op + repo). There is no trusted-source field for prohibited DATA transfers.
  // This test records today's behaviour as a documented gap; it is NOT a statement that the behaviour is desired.
  const i = ybCase();
  i.context.prohibitions = [{ origin: T, op: 'external_transfer' }];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC', 'GAP: the trusted prohibition has no effect on permitted_transfers');
  assert.equal(r.operational, false);
});

// =====================================================================================================
// ADIM 52: O-3 (conflicting reviewer records), O-2 (independent reviewer), D-3 (classification before dispatch), O-10 (operation scope).
// Review records, dispatch records and reviewer ids are SYNTHETIC FIXTURES; nothing here authenticates a real reviewer.
// =====================================================================================================
const verifiedClass = (i, cls = 'INTERNAL') => withClass(i, cls); // verified + bound class, so delegation is allowed
const reviewCase = ({ reviewerId = 'sec-1', claim = 'review_verified', records, dispatch } = {}) => {
  const i = verifiedClass(highReview());
  i.decision.coordination[claim] = [reviewerId];
  i.context.implementer_id = 'impl-1';
  i.context.dispatch_records = dispatch ?? [{ origin: T, agent: reviewerId, role: 'Security Engineer', record_ref: 'fixture://d-sec' }];
  i.context.review_records = records ?? [{ origin: T, reviewer_id: reviewerId, primary_evidence_ref: 'fixture://diff-1', criteria_met: true }];
  return i;
};

// ---- O-3 ----
test('O-3: conflicting records for the same reviewer (true and false) never yield a verified review, in either order', () => {
  const yes = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: true };
  const no = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: false };
  const reports = permutations([yes, no]).map((records) => validateDecision(reviewCase({ records })));
  for (const r of reports) {
    assert.equal(r.verdict, 'REJECTED');
    assert.ok(has(r, 'UNEVIDENCED_REVIEW_VERIFIED'));
    assert.ok(has(r, 'REVIEW_RECORDS_CONFLICT'));
  }
  const sig = (r) => JSON.stringify([r.verdict, findings(r)]);
  assert.equal(new Set(reports.map(sig)).size, 1, 'order must not change the outcome');
});

test('O-3: a false record on a different artifact of the same reviewer, a blank-spelled duplicate id, and a lone false record all block REVIEW_VERIFIED', () => {
  const yes = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: true };
  for (const other of [{ origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-2', criteria_met: false }, { origin: T, reviewer_id: ' SEC-1 ', primary_evidence_ref: 'fixture://diff-1', criteria_met: false }]) {
    for (const records of permutations([yes, other])) {
      const r = validateDecision(reviewCase({ records }));
      assert.equal(r.verdict, 'REJECTED', JSON.stringify(other));
      assert.ok(has(r, 'UNEVIDENCED_REVIEW_VERIFIED'));
    }
  }
  const lone = validateDecision(reviewCase({ records: [{ ...yes, criteria_met: false }] }));
  assert.equal(lone.verdict, 'REJECTED');
  assert.ok(has(lone, 'UNEVIDENCED_REVIEW_VERIFIED') && !has(lone, 'REVIEW_RECORDS_CONFLICT'), 'a single negative review is not a conflict, just not verified');
});

test('O-3: with several reviewers only the reviewer with conflicting records is affected; the conflict still prevents a clean accept', () => {
  const sec = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://d1', criteria_met: true };
  const qa = [{ origin: T, reviewer_id: 'qa-1', primary_evidence_ref: 'fixture://d2', criteria_met: true }, { origin: T, reviewer_id: 'qa-1', primary_evidence_ref: 'fixture://d2', criteria_met: false }];
  const i = reviewCase({ records: [sec, ...qa], dispatch: [{ origin: T, agent: 'sec-1', role: 'Security Engineer', record_ref: 'fixture://ds' }, { origin: T, agent: 'qa-1', role: 'QA & Test Engineer', record_ref: 'fixture://dq' }] });
  const r = validateDecision(i);
  assert.equal(r.verdict, 'NOT_VERIFIED', 'sec-1 is fine; the unrelated qa-1 conflict makes the context unverifiable');
  assert.ok(has(r, 'REVIEW_RECORDS_CONFLICT') && !has(r, 'UNEVIDENCED_REVIEW_VERIFIED'));
  i.decision.coordination.review_verified = ['qa-1'];
  assert.ok(has(validateDecision(i), 'UNEVIDENCED_REVIEW_VERIFIED'));
});

test('O-3: missing or malformed reviewer / dispatch records are rejected, never skipped', () => {
  const base1 = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: true };
  for (const patch of [{ reviewer_id: undefined }, { reviewer_id: '' }, { reviewer_id: 7 }, { primary_evidence_ref: '' }, { primary_evidence_ref: 0 }, { primary_evidence_ref: false }, { criteria_met: 'true' }, { criteria_met: undefined }, { criteria_met: 1 }]) {
    const rec = { ...base1, ...patch };
    const r = validateDecision(reviewCase({ records: [base1, rec] }));
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(patch));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(patch));
  }
  for (const patch of [{ agent: '' }, { agent: 3 }, { record_ref: '' }, { record_ref: 0 }, { role: 7 }]) {
    const r = validateDecision(reviewCase({ dispatch: [{ origin: T, agent: 'sec-1', role: 'Security Engineer', record_ref: 'x', ...patch }] }));
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(patch));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(patch));
  }
});

test('O-3 positive: one consistent, independent, dispatched review is accepted (synthetic only)', () => {
  const r = validateDecision(reviewCase());
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.operational, false);
});

// ---- O-2 ----
test('O-2: self-review cannot stand in for an independent reviewer (REVIEW_PERFORMED and REVIEW_VERIFIED), however the identity is spelled', () => {
  for (const claim of ['review_performed', 'review_verified']) {
    for (const reviewerId of ['impl-1', ' IMPL-1 ']) {
      const r = validateDecision(reviewCase({ reviewerId, claim, dispatch: [{ origin: T, agent: reviewerId, role: 'Security Engineer', record_ref: 'x' }] }));
      assert.equal(r.verdict, 'REJECTED', `${claim} ${reviewerId}`);
      assert.ok(has(r, claim === 'review_performed' ? 'UNEVIDENCED_REVIEW_PERFORMED' : 'UNEVIDENCED_REVIEW_VERIFIED'), `${claim} ${reviewerId}`);
    }
  }
  const human = reviewCase({ claim: 'review_performed', dispatch: [] });
  human.context.review_records = [{ origin: T, reviewer_id: 'impl-1', reviewer_kind: 'authorized_human', authorization_ref: 'fixture://auth', primary_evidence_ref: 'e', criteria_met: true }];
  human.decision.coordination.review_performed = ['impl-1'];
  assert.ok(has(validateDecision(human), 'UNEVIDENCED_REVIEW_PERFORMED'), 'an "authorized human" who is the implementer is still not independent');
});

test('O-2: a reviewer who is the implementer according to a TRUSTED dispatch role cannot be performed/verified reviewer, even if implementer_id names someone else', () => {
  for (const claim of ['review_performed', 'review_verified']) {
    const i = reviewCase({ reviewerId: 'impl-9', claim, dispatch: [{ origin: T, agent: 'impl-9', role: 'Implementation Engineer', record_ref: 'x' }] });
    i.context.implementer_id = 'impl-1';
    assert.equal(validateDecision(i).verdict, 'REJECTED', claim);
  }
});

test('O-2: REVIEW_PERFORMED is not REVIEW_VERIFIED: a negative review is performed but not verified; neither needs the other', () => {
  const neg = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'fixture://diff-1', criteria_met: false };
  const performed = validateDecision(reviewCase({ claim: 'review_performed', records: [neg] }));
  assert.equal(performed.verdict, 'ACCEPTED_SYNTHETIC', 'performed does not require the criteria to be met');
  const verified = validateDecision(reviewCase({ claim: 'review_verified', records: [neg] }));
  assert.equal(verified.verdict, 'REJECTED');
  const both = reviewCase({ claim: 'review_performed', records: [neg] });
  both.decision.coordination.review_verified = ['sec-1'];
  assert.ok(has(validateDecision(both), 'UNEVIDENCED_REVIEW_VERIFIED'));
});

test('O-2: REVIEW_PERFORMED needs independence evidence (a trusted dispatch record or an authorized human), not a bare record', () => {
  const bare = reviewCase({ claim: 'review_performed', dispatch: [] });
  assert.ok(has(validateDecision(bare), 'UNEVIDENCED_REVIEW_PERFORMED'));
  const human = reviewCase({ claim: 'review_performed', dispatch: [] });
  human.context.review_records = [{ origin: T, reviewer_id: 'sec-1', reviewer_kind: 'authorized_human', authorization_ref: 'fixture://auth', primary_evidence_ref: 'e', criteria_met: true }];
  assert.equal(validateDecision(human).verdict, 'ACCEPTED_SYNTHETIC');
  const missingImpl = reviewCase({ claim: 'review_performed' });
  delete missingImpl.context.implementer_id;
  assert.ok(has(validateDecision(missingImpl), 'UNEVIDENCED_REVIEW_PERFORMED'), 'independence cannot be shown without an implementer identity');
});

test('O-2: fake REVIEW_PERFORMED / REVIEW_VERIFIED without any record, and HIGH completion without a verified independent review, stay rejected', () => {
  const i = verifiedClass(highReview());
  i.decision.coordination.review_performed = ['sec-1'];
  i.decision.coordination.review_verified = ['sec-1'];
  const r = validateDecision(i);
  assert.ok(has(r, 'UNEVIDENCED_REVIEW_PERFORMED') && has(r, 'UNEVIDENCED_REVIEW_VERIFIED'));
  const done = reviewCase({ records: [{ origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'e', criteria_met: false }] });
  done.decision.task_state = 'COMPLETED';
  done.context.acceptance_criteria = ['c1'];
  done.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
  assert.ok(has(validateDecision(done), 'HIGH_WITHOUT_INDEPENDENT_REVIEW'));
});

test('O-2/O-3: HIGH completion is order-independent when the claimed reviewer has conflicting records', () => {
  const yes = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'e', criteria_met: true };
  const no = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'e', criteria_met: false };
  for (const records of permutations([yes, no])) {
    const i = reviewCase({ records });
    i.decision.task_state = 'COMPLETED';
    i.context.acceptance_criteria = ['c1'];
    i.context.acceptance_evidence = [{ origin: T, criterion_id: 'c1', result: 'passed', ref: 'fixture://run' }];
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED');
    assert.ok(has(r, 'HIGH_WITHOUT_INDEPENDENT_REVIEW'));
  }
});

// ---- ADIM 52 bağımsız inceleme M1/M2 ----
test('M1: implementer dispatch role is matched after normalization (case, spaces, zero-width); implementer cannot self-review under a spelled-differently role', () => {
  for (const role of ['Implementation Engineer ', 'implementation engineer', 'Implementer', 'implement​er']) {
    for (const claim of ['review_performed', 'review_verified']) {
      const i = reviewCase({ reviewerId: 'impl-9', claim, dispatch: [{ origin: T, agent: 'impl-9', role, record_ref: 'x' }] });
      i.context.implementer_id = 'impl-1';
      assert.equal(validateDecision(i).verdict, 'REJECTED', `${claim} ${JSON.stringify(role)}`);
    }
  }
});

test('M2: reviewer / agent identity is compared after NFKC and zero-width removal (same as Y-B)', () => {
  for (const spelled of ['impl-1​', 'ｉmpl-1', 'IMPL-1­']) {
    for (const claim of ['review_performed', 'review_verified']) {
      const r = validateDecision(reviewCase({ reviewerId: spelled, claim, dispatch: [{ origin: T, agent: spelled, role: 'Security Engineer', record_ref: 'x' }] }));
      assert.equal(r.verdict, 'REJECTED', `${claim} ${JSON.stringify(spelled)}`);
    }
  }
  const yes = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'e', criteria_met: true };
  const hidden = { origin: T, reviewer_id: 'sec-1​', primary_evidence_ref: 'e', criteria_met: false };
  for (const records of permutations([yes, hidden])) {
    const r = validateDecision(reviewCase({ records }));
    assert.equal(r.verdict, 'REJECTED');
    assert.ok(has(r, 'UNEVIDENCED_REVIEW_VERIFIED') && has(r, 'REVIEW_RECORDS_CONFLICT'));
  }
});

test('L3: malformed reviewer_kind / authorization_ref are rejected; authorized_human without authorization_ref is not independence evidence', () => {
  const base = { origin: T, reviewer_id: 'sec-1', primary_evidence_ref: 'e', criteria_met: true };
  for (const extra of [{ reviewer_kind: 5 }, { reviewer_kind: '' }, { authorization_ref: 7 }, { authorization_ref: ' ' }]) {
    const r = validateDecision(reviewCase({ claim: 'review_performed', dispatch: [], records: [{ ...base, ...extra }] }));
    assert.ok(has(r, 'INVALID_CONTEXT_FIELD'), JSON.stringify(extra));
  }
  const r = validateDecision(reviewCase({ claim: 'review_performed', dispatch: [], records: [{ ...base, reviewer_kind: 'authorized_human' }] }));
  assert.ok(has(r, 'UNEVIDENCED_REVIEW_PERFORMED'));
});

// ---- D-3 ----
const dispatchCase =(cls) => {
  const i = reviewCase({ claim: 'agent_dispatched' });
  i.decision.coordination.review_verified = [];
  if (cls) withClass(i, cls);
  else { i.context.classification_evidence = null; i.decision.data_classification = 'UNCLASSIFIED'; }
  return i;
};

test('D-3 A: UNCLASSIFIED + PROPOSED + no dispatch is a legitimate conditional planning decision (accepted, synthetic)', () => {
  const i = base();
  i.decision.task_state = 'PROPOSED';
  i.decision.operations = [];
  i.context.ledger = [];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.derived.effective_classification, 'UNCLASSIFIED');
});

test('D-3 B: UNCLASSIFIED + READY + ROLE_SELECTED derives no dispatch authority and is not rejected for the roles alone', () => {
  const i = base();
  i.decision.coordination.role_selected = ['Security Engineer', 'Software Architect'];
  const r = validateDecision(i);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.ok(!has(r, 'DISPATCH_BEFORE_CLASSIFICATION'));
  i.decision.coordination.agent_dispatched = ['sec-1']; // ROLE_SELECTED does not imply AGENT_DISPATCHED: the claim needs a record
  const claimed = validateDecision(i);
  assert.ok(has(claimed, 'UNEVIDENCED_AGENT_DISPATCHED'));
  assert.ok(has(claimed, 'DISPATCH_BEFORE_CLASSIFICATION'), 'the dispatch claim itself, without any record, is also premature while UNCLASSIFIED');
});

test('D-3 C: UNCLASSIFIED + a (fixture-trusted) dispatch record is rejected: classification must precede delegation (Protocol §5, §6.3)', () => {
  const r = validateDecision(dispatchCase(null));
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'DISPATCH_BEFORE_CLASSIFICATION'));
  const recordOnly = dispatchCase(null);
  recordOnly.decision.coordination.agent_dispatched = []; // the record alone shows a dispatch happened
  assert.ok(has(validateDecision(recordOnly), 'DISPATCH_BEFORE_CLASSIFICATION'));
});

test('D-3 D: a verified, bound class + a valid synthetic dispatch is accepted (synthetic only)', () => {
  for (const cls of ['INTERNAL', 'CONFIDENTIAL']) {
    const r = validateDecision(dispatchCase(cls));
    assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC', cls);
    assert.equal(r.operational, false);
  }
});

test('D-3 E: corrupt or contradictory classification evidence cannot unlock dispatch (fail-closed)', () => {
  const unbound = dispatchCase('INTERNAL');
  unbound.context.data_subjects = [{ origin: T, subject: 'baska/dosya.md' }];
  const u = validateDecision(unbound);
  assert.ok(has(u, 'EVIDENCE_SUBJECT_UNBOUND') && has(u, 'DISPATCH_BEFORE_CLASSIFICATION'));
  assert.notEqual(u.verdict, 'ACCEPTED_SYNTHETIC');
  const bad = dispatchCase('INTERNAL');
  bad.context.classification_evidence = 'INTERNAL';
  assert.equal(validateDecision(bad).verdict, 'REJECTED');
  const down = dispatchCase('CONFIDENTIAL');
  down.decision.data_classification = 'PUBLIC'; // contradicts the verified class
  assert.ok(has(validateDecision(down), 'CLASS_DOWNGRADE'));
  const noEvidenceClaim = dispatchCase(null);
  noEvidenceClaim.decision.data_classification = 'RESTRICTED';
  const n = validateDecision(noEvidenceClaim);
  assert.notEqual(n.verdict, 'ACCEPTED_SYNTHETIC');
  assert.ok(has(n, 'DISPATCH_BEFORE_CLASSIFICATION'));
});

test('D-3 F: a model-written class with a model-written dispatch claim yields no acceptance and never operational authority', () => {
  const i = dispatchCase(null);
  i.decision.data_classification = 'INTERNAL'; // the model "classifies" without trusted evidence
  const r = validateDecision(i);
  assert.equal(r.verdict, 'REJECTED');
  assert.ok(has(r, 'UNEVIDENCED_CLASS') && has(r, 'DISPATCH_BEFORE_CLASSIFICATION'));
  assert.equal(r.operational, false);
});

// ---- O-10 ----
test('O-10: an operation scope that is empty, mistyped or malformed never yields authority', () => {
  for (const scope of [null, [], 'repo', 7, undefined]) {
    const i = base();
    if (scope === undefined) delete i.decision.operations[0].scope;
    else i.decision.operations[0].scope = scope;
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(scope));
    assert.ok(has(r, 'INVALID_OPERATION'), JSON.stringify(scope));
  }
  const empty = base();
  empty.decision.operations[0].scope = {};
  const r = validateDecision(empty);
  assert.equal(r.verdict, 'REJECTED');
  assert.equal(r.derived.authorization[0].derived, 'NOT_AUTHORIZED', 'an empty scope claiming SCOPED is rejected');
  empty.decision.operations[0].status = 'NOT_AUTHORIZED';
  assert.equal(validateDecision(empty).verdict, 'ACCEPTED_SYNTHETIC', 'claiming no authority with an empty scope is fine');
});

test('O-10: extra scope keys cannot extend a SCOPED claim, and only echo harmlessly on non-authority claims', () => {
  for (const extra of [{ user_approved: true }, { all_files: true }, { files_extra: ['x'] }, { remote: 'origin' }]) {
    const i = base();
    Object.assign(i.decision.operations[0].scope, extra);
    const r = validateDecision(i);
    assert.equal(r.verdict, 'REJECTED', JSON.stringify(extra));
    assert.ok(has(r, 'AUTH_MISMATCH'), JSON.stringify(extra));
    assert.equal(r.derived.authorization[0].derived, 'NOT_AUTHORIZED');
  }
  const pend = fullGit();
  delete pend.context.ledger[2].scope.branch; // push grant lacks branch
  pend.decision.operations[2] = { op: 'push', status: 'AUTHORIZED_PENDING_SCOPE', scope: { repo: REPO, remote: 'origin', user_approved: true } };
  const r = validateDecision(pend);
  assert.equal(r.verdict, 'ACCEPTED_SYNTHETIC');
  assert.equal(r.derived.authorization[2].derived, 'AUTHORIZED_PENDING_SCOPE', 'PENDING grants no execution authority; the extra key changes nothing');
});

test('O-10: other repository, files outside the grant and contradictory scope records are NOT_AUTHORIZED / rejected; an exact match is accepted', () => {
  assert.equal(validateDecision(base()).verdict, 'ACCEPTED_SYNTHETIC', 'exact match');
  const otherRepo = base();
  otherRepo.decision.operations[0].scope.repo = 'baska-depo';
  assert.ok(has(validateDecision(otherRepo), 'AUTH_MISMATCH'));
  const outside = base();
  outside.decision.operations[0].scope.files = ['docs/NOTES.md', 'secrets/prod.env'];
  const o = validateDecision(outside);
  assert.ok(has(o, 'AUTH_MISMATCH'));
  assert.equal(o.derived.authorization[0].derived, 'NOT_AUTHORIZED');
  const subset = base();
  subset.context.ledger[0].scope.files = ['docs/NOTES.md', 'docs/B.md'];
  assert.equal(validateDecision(subset).verdict, 'ACCEPTED_SYNTHETIC', 'a subset of the granted files is covered');
  const contradictory = base();
  contradictory.decision.operations.push({ op: 'stage', status: 'NOT_AUTHORIZED', scope: { repo: REPO, files: ['docs/NOTES.md'] } });
  assert.ok(has(validateDecision(contradictory), 'CONTRADICTORY_OPERATION'));
  const sameStatus = base(); // same op+repo, same status, different scope: not contradictory, each judged on its own scope
  sameStatus.decision.operations.push({ op: 'stage', status: 'AUTHORIZED_SCOPED', scope: { repo: REPO, files: ['docs/NOTES.md'] } });
  assert.equal(validateDecision(sameStatus).verdict, 'ACCEPTED_SYNTHETIC');
});

test('CLI: exit codes and report on valid fixture, rejected fixture and invalid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'director-gate-'));
  try {
    const ok = join(dir, 'ok.json');
    const rej = join(dir, 'rej.json');
    const broken = join(dir, 'broken.json');
    writeFileSync(ok, JSON.stringify(base()));
    const bad = base();
    bad.decision.task_state = 'COMPLETED';
    writeFileSync(rej, JSON.stringify(bad));
    writeFileSync(broken, '{ not json');
    const run = (f) => spawnSync(process.execPath, [SCRIPT, f], { encoding: 'utf8' });
    const a = run(ok);
    assert.equal(a.status, 0);
    assert.equal(JSON.parse(a.stdout).verdict, 'ACCEPTED_SYNTHETIC');
    assert.equal(JSON.parse(a.stdout).operational, false);
    const b = run(rej);
    assert.equal(b.status, 2);
    assert.ok(JSON.parse(b.stdout).findings.some((f) => f.code === 'UNEVIDENCED_COMPLETION'));
    const c = run(broken);
    assert.equal(c.status, 2);
    assert.equal(JSON.parse(c.stdout).findings[0].code, 'INVALID_JSON');
    assert.equal(run(join(dir, 'missing.json')).status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
