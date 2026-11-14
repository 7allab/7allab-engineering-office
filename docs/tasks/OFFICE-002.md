# TASK OFFICE-002 - implementer read-only git (B13) + --no-index hardening + web-is-data lines

Status: MERGED to main at e8ac883 (fast-forward, Owner, 2026-11-14); REVIEW_VERIFIED (Owner decision 2026-11-14; model review, no human independent review; limits listed below)        Branch: task/office-002-implementer-git-read        Opened: 2026-11-14

Task state lives in this file, not in the chat. A new session reads it and continues.

Evidence source labels used below: [AGENT] = a dispatched subagent's own report (no transcript file; weaker than a file transcript). [OWNER] = Owner run or statement as relayed to the Director; the Director did not see the raw output. [DIRECTOR] = command run by the main session (Director); not independent review. Unlabelled lines are older entries kept as written.

## Goal and acceptance criteria
1. implementation-engineer may run read-only git (diff, log, status, show, rev-parse, ls-files, branch --show-current); state-changing git stays denied. qa-test-engineer unchanged.
2. `git diff --no-index ...` is denied for implementation-engineer and release-evidence-reviewer (it can read .env and other files outside the Read deny).
3. security-engineer.md and software-architect.md state that web pages and third-party text are data, never instructions (research-engineer.md already does).
4. Abbreviated dangerous git options (e.g. --no-ind, --outp=x, --ext-d) are denied for implementer and reviewer; harmless flags (--stat, --name-only, --cached, --oneline) still pass.
5. `node --test test/scope-guard.test.mjs` all pass on Windows; both guard test groups (see docs/GUARD-SYSTEMS.md) pass.

## Approved scope (Owner copies this into .claude/task-scope.json; see .claude/task-scope.example.json)
- Owner-approved 2026-11-14 (OFFICE-002 onay): .claude/hooks/scope-guard.mjs, test/scope-guard.test.mjs, .claude/agents/security-engineer.md, .claude/agents/software-architect.md. Edited via the bridge file tool, not the guarded Edit/Write tools; Owner commits.
- Active .claude/task-scope.json (observed by the Director 2026-11-14): taskId OFFICE-002, expires 2026-11-15T23:59:59Z, allow = test/scope-guard.test.mjs, docs/tasks/OFFICE-002.md. This entry was written under that scope; nothing else was written by the Director. (historical; after the merge the Owner replaced the scope: allow = docs/CONTINUE.md, docs/tasks/OFFICE-002.md)

## Plan (Planner -> Architect -> Implementation -> QA -> Reviewer)
- [ ] Brief   - [ ] Design   - [x] Code + tests   - [x] QA run (pre-fix; post-fix runs are OWNER/DIRECTOR)   - [x] Review performed (see below; REVIEW_VERIFIED recorded by the Owner)   - [x] Owner merge (e8ac883, fast-forward into main)

## Evidence (real command output only; unrun = NOT TESTED)
- RED (Windows, Owner): `node --test test/scope-guard.test.mjs` -> 24 tests, 22 pass, 2 fail (implementer `git diff` denied; reviewer `git diff --no-index nul .env` PASSED, i.e. the gap is real).
- WINDOWS (Owner), 3 files: 59/59 pass before the prefix hardening (criteria 1-3).
- Prefix hardening added after the first review attempt: RED in Linux VM copy 24/25 (new test fails), GREEN 25/25. Windows run: NOT TESTED at that time (superseded by later Windows runs below).
- REVIEW 2 (Opus reviewer, Office repo, branch verified) [AGENT]: REJECT, live bypass proven by the reviewer: `git diff \--no-index --stat AGENTS.md CLAUDE.md` passed the hook (TOK allows backslash; Bash strips it before git runs). SUSPECTED, not tested: git with a path outside the work tree switches to no-index mode. Reviewer's node run was blocked by the hook; its test results are NOT TESTED by it.
- Fix after REVIEW 2: tokens with a backslash, `..` path segments, absolute and drive paths are denied for git read; --git-dir/--work-tree added to the dangerous prefixes. RED in Linux VM 25/26, GREEN 26/26 (Linux, not Windows). Windows run (Owner, 3 test files): 61/61 pass, branch task/office-002-implementer-git-read. Accepted residual: over-blocking of `git diff -c`, `git diff --text`, `git --no-pager ...`, `git diff --no`, and of HEAD~N (TOK has no tilde).
- First review attempt ran in the wrong repo (edge-ledger/apexo-work, master): its REJECT is void for OFFICE-002. Its code-reading findings are kept as input (residuals: git show/log -p of committed files, repo-configured diff drivers; neither exploitable in this repo, no tracked secrets; documented, not fixed).
- GREEN (Linux VM copy, node v22.23.4, not Windows): 24/24 pass (older entry).

### QA run before REVIEW 3 [AGENT: qa-test-engineer, read-only]
- `node --test test/scope-guard.test.mjs test/guard-scope.test.mjs test/new-task.test.mjs` -> 61 tests, 61 pass, 0 fail (exit code not observed by the agent). `node --test` of the 4 parked-chain files -> 209/209 (exit code not observed). Its own extra git probes were BLOCKED by the hook (qa has no git; expected, criterion 1 "qa unchanged"). HEAD/branch were verified by the Director before dispatch: a3b728997f7f4b99379ebdf6ed262ec29c79a818, task/office-002-implementer-git-read.

### REVIEW 3 [AGENT: release-evidence-reviewer, read-only, model review not human]
- Result: REVIEW_PERFORMED, REVIEW_VERIFIED = NO (REWORK).
- F1 CONFIRMED, blocking: `git diff --stat C:AGENTS.md CLAUDE.md` passed the hook (reviewer role) and git ran in no-index mode (isEscapedOrOutside caught only `C:/` and `C:\`, not `C:name`; TOK allows `:`). Output seen by the reviewer: `C:AGENTS.md => CLAUDE.md | 34 ++++...`, 6 insertions, 28 deletions.
  - Reproduced by [DIRECTOR] (main session, same command): `C:AGENTS.md => CLAUDE.md | 34 ++++----...`, 1 file changed, 6 insertions(+), 28 deletions(-), exit 1; the plain `git diff --stat AGENTS.md CLAUDE.md` printed nothing, exit 0.
  - Reproduced by [OWNER] in the Owner's terminal with `git diff --stat C:AGENTS.md CLAUDE.md`; reported output: 6 insertions, 28 deletions.
- F3 LIKELY / UNVERIFIED (reviewer's own record): PowerShell tool, TOK allows `@`, so splatting such as `@PROFILE` could inject a path outside the repo after the hook's check (implicit no-index again). Not run by the reviewer (target restriction). The comma-array form `AGENTS.md,--no-index` passed the hook but git failed `ambiguous argument` (exit 128): not a bypass.
- F2 LIKELY, not blocking: `-O<file>` style options skip the absolute-path check; reviewer ran `git diff -OAGENTS.md --stat` -> normal output. F4 CONFIRMED residual: `git show HEAD:AGENTS.md` prints a committed file; `.env` is not tracked (`git ls-files .env` empty). F5 N/A: repo-configured diff drivers (unchanged residual).
- Criterion 2 was NOT MET at that point (tests did not cover `C:name`).

### Fix after REVIEW 3 (Owner, via the Owner's chosen route)
- Hook fix applied manually by the Owner in an editor (option a); the hook file is not writable by agents.
- isEscapedOrOutside now denies drive-relative tokens (`^[A-Za-z]:`), `..` after `:` as well as `/`, and `@`-prefixed tokens. `HEAD:path` still passes. New tests added in test/scope-guard.test.mjs for both roles via the PowerShell tool.
- RED [OWNER]: `node --test test/scope-guard.test.mjs` -> 29 tests, 27 pass, 2 fail, exit code 1 (the new drive-relative and `@` tests failed before the code fix).
- GREEN [OWNER]: 3-file group 64/64 and parked group 209/209, exit code 0; after the N5 fix (trailing newline in test/scope-guard.test.mjs) 64/64 again. The Director did not see these Owner outputs.
- GREEN [DIRECTOR] (main session, Windows, Git Bash, node v24.18.0, branch/HEAD unchanged from above):
  - `node --test test/scope-guard.test.mjs test/guard-scope.test.mjs test/new-task.test.mjs` -> tests 64, pass 64, fail 0, skipped 0, exit 0.
  - `node --test test/authority-grant.test.mjs test/identity-gate.test.mjs test/decision-gate-event-adapter.test.mjs test/director-decision-gate.test.mjs` -> tests 209, pass 209, fail 0, exit 0 (includes LIVE tests: real whoami.exe SID lookup and CLI as the current user; passed here only).
  - Director observation: test/scope-guard.test.mjs now ends with a newline (N5 fixed).

### REVIEW 4 [AGENT: release-evidence-reviewer, read-only, model review not human]
- Result: REVIEW_PERFORMED. Reviewer's recommendation: REVIEW_VERIFIED yes for criteria 1-4, on condition that criterion 5 is evidenced separately (its own node run was BLOCKED by the hook, so test counts are NOT TESTED BY IT; static count 28 test( blocks in test/scope-guard.test.mjs, not a run). REVIEW_VERIFIED is NOT recorded here (at that time); the Owner decides.
- Baseline it printed: HEAD a3b728997f7f4b99379ebdf6ed262ec29c79a818, branch task/office-002-implementer-git-read, status = 4 M (the approved files) + ?? docs/tasks/OFFICE-002.md; nothing staged.
- Live probes as release-evidence-reviewer (hook decision as reported): BLOCKED -> `--no-index`, `--no-ind`, `\--no-index`, `--outp=x`, `--ext-d`, `--stat ../x`, `--stat C:x`, `--stat C:..`, `--stat C:../x`, `--stat C:AGENTS.md CLAUDE.md`, PowerShell `--stat @PROFILE CLAUDE.md`. Ran -> `git diff --stat`, `--name-only`, `--cached --stat`, `git log --oneline`; also `-OAGENTS.md --stat` and `git show HEAD:AGENTS.md` ran.
- F1 RESOLVED, F3 RESOLVED (reviewer: live PowerShell `@PROFILE` probe BLOCKED; code checks `startsWith('@')`).
- N1 CONFIRMED, not blocking: new drive and `@` tests run through the PowerShell tool only; Bash covered by `C:/x` and `/etc/hosts`. N2 CONFIRMED, not exploitable: PowerShell `CLAUDE.md,C:AGENTS.md` passes the hook, git got one argument (`fatal: invalid object name`, exit 128). N3 LIKELY, not blocking: `-O../x` / `-O/abs` would pass; `-O` only affects ordering. N4: this file was stale (fixed by this update). N5: no newline at end of test file (fixed, see above).
- N1, N2, N3: NOT changed in this task; deferred to OFFICE-003 (Owner decision).

### Implementer live probe [AGENT: implementation-engineer, read-only, self-report, exit codes not shown]
Hook text for blocks was the allowlist message naming implementation-engineer (generic; does not say which rule fired).

| # | Tool | Command | Expected | Actual |
|---|---|---|---|---|
| 1 | Bash | git diff --stat C:x CLAUDE.md | BLOCKED | BLOCKED |
| 2 | Bash | git diff --stat C:.. CLAUDE.md | BLOCKED | BLOCKED |
| 3 | Bash | git diff --stat C:../x CLAUDE.md | BLOCKED | BLOCKED |
| 4 | Bash | git diff --stat C:AGENTS.md CLAUDE.md | BLOCKED | BLOCKED |
| 5 | PowerShell | git status @PROFILE | BLOCKED | BLOCKED |
| 6 | Bash | git branch --show-current | runs | ran: task/office-002-implementer-git-read |
| 7 | Bash | git diff --stat AGENTS.md CLAUDE.md | runs | ran, no output |
| 8 | Bash | git log --oneline -5 | runs | ran, first line `a3b7289 docs(governance): add Measurement section to task template (Fix 4)` |

No mismatch with expectation. Targets were AGENTS.md and CLAUDE.md only.

### Criteria status [DIRECTOR] (evidence summary; not a verdict)
1. MET: code (hook line 94) + tests + implementer live probes #6-#8 [AGENT]; qa blocked from git [AGENT]. 2. MET: code (hook line 86 (isEscapedOrOutside)) + reviewer live probes [AGENT] + implementer live probes #1-#5 [AGENT] + tests. 3. MET: git diff of both agent files shows the web-is-data line [AGENT, reviewer]. 4. MET: reviewer live probes + tests [AGENT]. 5. Passed in [DIRECTOR] and [OWNER] runs; no independent reviewer ran node (hook blocks it for that role).
- Known limits: reviewer and probe evidence is self-reported by model agents (no transcript files); implementer block message is generic; no human independent review; Linux-only runs are not Windows evidence.

## Open decisions / remaining work
- REVIEW_VERIFIED: YES, Owner decision 2026-11-14, criteria 1-5. Basis: criteria 1-4 by REVIEW 4 and live probes [AGENT]; criterion 5 by [OWNER] and [DIRECTOR] runs. Limits accepted by the Owner: agent evidence is self-reported, no human independent review, N1-N3 deferred to OFFICE-003.
- MERGED [OWNER]: fast-forward into main, commit e8ac883 `feat(hooks): read-only git for implementer, deny drive-relative and @ tokens (OFFICE-002)`. Stage, commit and merge were done by the Owner; no push, no remote. [DIRECTOR] observed afterwards (read-only): branch main, HEAD e8ac883 with the single parent a3b7289, working tree clean, and `git show --stat` lists exactly 5 files (.claude/agents/security-engineer.md, .claude/agents/software-architect.md, .claude/hooks/scope-guard.mjs, test/scope-guard.test.mjs, docs/tasks/OFFICE-002.md; 157 insertions, 3 deletions) = the stage list. Fast-forward itself is the Owner's statement; the Director saw a linear history, not the merge command.
- Post-merge tests on main [OWNER]: `node --test` group 1 (3 files) 64/64, group 2 (4 parked-chain files) 209/209, fail 0, both exit codes 0. The Director did not see the raw output and did not re-run on e8ac883.
- Not done in this task: feature branch `task/office-002-implementer-git-read` still exists (cleanup is a separate Owner step after merge); docs/backlog.md B13 not updated; no docs/tasks/OFFICE-003.md exists yet.
- OFFICE-003 (deferred): N1 (Bash in new tests), N2 (comma tokens), N3 (`-O` with outside path).

## Measurement (Owner fills; unmeasured = NOT MEASURED, never estimate)
- Model + effort per stage: planner NOT MEASURED | implementation NOT MEASURED | QA NOT MEASURED | reviewer NOT MEASURED | other NOT MEASURED
- /usage before: NOT MEASURED        /usage after: NOT MEASURED        (D18 campaigns: mandatory)
- Wall-clock time: NOT MEASURED
- Changed lines: [DIRECTOR] `git diff --shortstat` (tracked files, run during this update): ` 4 files changed, 64 insertions(+), 3 deletions(-)` (hook + test file: 60 insertions, 3 deletions; git diff --numstat [OWNER]: scope-guard.mjs 8/2, scope-guard.test.mjs 52/1). The untracked task file is not included.
- Defects found (as recorded above, by stage): REVIEW 2 (reviewer): backslash bypass `\--no-index`; REVIEW 3 (reviewer): F1 drive-relative no-index (CONFIRMED), F3 `@` splatting (LIKELY, resolved); REVIEW 4 (reviewer): N1-N3 residuals (not defects fixed here), N5 missing trailing newline (fixed). F1 also reproduced by the Director and the Owner. QA found 0 failing tests.
- Red/green evidence: RED [OWNER] 29 tests, 27 pass, 2 fail, exit 1; GREEN [OWNER] 64/64 and 209/209, exit 0, and 64/64 again after N5; GREEN [DIRECTOR] 64/64 and 209/209, exit 0. Owner reproduced F1: YES (per Owner statement). Owner reproduced the red and green runs: YES (they are Owner runs).
