# TASK OFFICE-001 - new-task helper script

Status: DONE        Branch: task/office-001-new-task-helper        Opened: 2026-11-13

Task state lives in this file, not in the chat. A new session reads it and continues.

## Goal and acceptance criteria
Goal: `node scripts/new-task.mjs <ID> [--root <dir>]` copies `<root>/docs/tasks/_TEMPLATE.md` to `<root>/docs/tasks/<ID>.md`. ID must match /^[A-Z]+-\d{3}$/; never overwrite; error if template missing; cwd if no --root; exit 0 on success, 1 on error with short stderr message; Node built-ins only.

Acceptance criteria (product-planner, AGENT_DISPATCHED; model output, unverified):
1. Success: with template present, `node scripts/new-task.mjs OFFICE-002 --root <T>` exits 0; `<T>/docs/tasks/OFFICE-002.md` byte-identical to template.
2. No `--root`: cwd is used.
3. Invalid IDs (`office-001`, `OFFICE-1`, `OFFICE-0001`, `OFF1-001`, `OFFICE-001x`, empty): exit 1, short stderr, empty stdout, no file created.
4. Missing ID (none, or only `--root <T>`): exit 1, usage message on stderr, no file.
5. Existing target is not overwritten: exit 1, "already exists" stderr, content unchanged.
6. Missing template (or missing root / docs/tasks): exit 1, "template not found" stderr, no target file.
7. Arg edge cases: `--root` without value or followed by another flag, unknown arg (`--foo`), extra positional: exit 1, stderr message, no file.
8. Contract: only `node:` imports; success leaves stderr empty; errors are 1-2 lines, no stack trace.

## Approved scope (Owner copies this into .claude/task-scope.json; see .claude/task-scope.example.json)
- allow: scripts/new-task.mjs, test/new-task.test.mjs, docs/tasks/OFFICE-001.md        expires: 2026-11-13T16:40:52Z

## Plan (Planner -> Architect -> Implementation -> QA -> Reviewer)
- [x] Brief   - [ ] Design (skipped per Owner chain)   - [x] Code + tests   - [x] QA run   - [x] Review (model review, PASS-with-gaps)   - [ ] Owner merge

## Step notes
- Step 1 product-planner: DONE (criteria above). Open decisions resolved by Director as assumptions (not Owner-confirmed): (a) success prints created path to stdout; (b) relative --root resolved against cwd; only `--root <dir>` form supported, `--root=<dir>` is an unknown arg.
- Step 2 implementation-engineer: AGENT_DISPATCHED, reported (unverified by Director yet): scripts/new-task.mjs and test/new-task.test.mjs written; `node --test test/new-task.test.mjs` -> 15 pass / 0 fail (exit code not observed by the agent). Out-of-scope write attempt to docs/tasks/OTHER.md: BLOCKED by scope-guard hook ("outside the scope of task OFFICE-001"); file not created (agent claim, Director re-checks below). Design notes: any arg starting with "-" is a flag; --root value may not start with "-"; error messages 1-3 lines (criterion 8 says 1-2: possible deviation to check in QA).
- Step 3 qa-test-engineer: AGENT_DISPATCHED. Reported: `node --test test/new-task.test.mjs` -> exit 0, 15 pass / 0 fail (Node version not captured). Criteria 1-8 PASS via test + static reading. NOT TESTED: manual script runs (blocked by scope-guard allowlist: one plain test command only), "OFFICE-001\n" and path-separator IDs at runtime, error line count <=2 measured at runtime. Gaps named (nothing written): no test for newline/path-separator IDs, `--root ''`, `--root` value starting with "-", error line count, stderr-empty in cwd success case; node:-import check regex only matches single-quoted `from '...'`; EISDIR/write-error path untested; real-repo EEXIST NOT TESTED.
- Step 4 release-evidence-reviewer: AGENT_DISPATCHED, REVIEW_PERFORMED (model review, not human; REVIEW_VERIFIED NOT reached). Verdict: PASS-with-gaps. Read-only git evidence: only the 3 in-scope untracked files; `git diff --stat HEAD` empty; no commits on branch (HEAD == main 1aa5493); no secrets seen. Out-of-scope write attempt logged as deny in scope-guard.log. Reviewer could not run the tests (scope-guard allowlist) -> its test evidence was second-hand; Director re-ran, see Evidence.

## Evidence (real command output only; unrun = NOT TESTED)
- Director, main session, 2026-11-13: `node --version` -> v24.18.0. `node --test test/new-task.test.mjs` (cwd repo root) -> EXIT=0; tests 15, pass 15, fail 0, cancelled 0, skipped 0, duration ~5.2 s.
- NOT TESTED: manual script runs; "OFFICE-001\n" and path-separator IDs at runtime; `--root ''`; runtime error-line count (<=2); EISDIR/write-error path; EEXIST against the real repo.

## Open decisions / remaining work
- Assumptions (a) and (b) above await Owner confirmation.
- Low-severity test gaps (possible follow-up task): newline/path-separator IDs, `--root ''`, `-`-prefixed --root value, runtime error-line count, stderr text assertions, weak node:-import regex, write-error path.
- Minor: implementer reported error messages of 1-3 lines vs criterion 8 (<=2); reviewer's static reading says <=2; not measured.
- Stage/commit: not done; needs separate Owner approval. No push.
- Status stays IN PROGRESS until Owner accepts.
