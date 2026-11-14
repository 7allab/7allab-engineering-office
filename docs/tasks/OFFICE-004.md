# TASK OFFICE-004 - default-deny allowlist for git-read in the scope guard hook

Status: STAGE 4 DONE, awaiting Owner note/docs commits and merge        Branch: task/office-004-git-read-allowlist        Opened: 2026-11-14

Task state lives in this file, not in the chat. A new session reads it and continues.

Risk: HIGH. Reason: change of an authorization hook (Charter 4); the hook file itself is Owner-only (PROTECTED `.claude/`).
Baseline: main 9a1dc8e (OFFICE-003 merged; docs stage included).
Evidence labels: [AGENT] = subagent self-report; [OWNER] = Owner run/statement; [DIRECTOR] = main-session command, not independent review.
Source plan: software-architect design report for OFFICE-004 ([AGENT], model design, not human review), APPROVED by the Owner on 2026-11-14 with the decisions D1-D6 below. All claims in that report keep their [VERIFIED]/[PROPOSED]/[UNKNOWN] labels; the design is NOT TESTED on Windows except where a run is recorded in Evidence.

## Goal and acceptance criteria
Goal: replace the deny-list logic of `isGitRead` in `.claude/hooks/scope-guard.mjs` with a DEFAULT-DENY ALLOWLIST (only explicitly allowed subcommand + option + argument shapes pass; everything else is denied) for the roles implementation-engineer and release-evidence-reviewer, Bash and PowerShell. The oracle (OFFICE-003) reports 38 KNOWN_OPEN findings on the current hook; after this task ALL 38 are gone and there are 0 new findings.

- K1. The existing 32 tests in test/scope-guard.test.mjs pass unchanged. Group 1 (3 files) and group 2 (4 files) are green (OFFICE-003 run2 reference: 276 tests outside the oracle in one run; the expected total after this task is 276 + the number of new tests, NOT MEASURED yet).
- K2. New tests are appended to test/scope-guard.test.mjs (no existing line is deleted or changed). Two roles x two tools:
  - (a) PASS: the 27 C1 commands of the oracle plus the plain commands used by the existing tests (listed in the Stage 1 agent task).
  - (b) DENY: the 19 KNOWN_OPEN candidates, text copied exactly from KNOWN_OPEN_ROWS.
  - (c) DENY: separate-form option values: `git diff --name-only -O .env`, `git ls-files --cached --ignored --exclude-from .env`, `git ls-files -X .env`, `git ls-files -X../outside/secret.txt`.
  - (d) DENY: other value options: `--relative=sub`, `--skip-to=m1.txt`, `--rotate-to=m1.txt`, `--exclude=x`, `-L1,2:m1.txt`, `--stdin`, `--stat=80`, `rev-parse --resolve-git-dir .git`, `rev-parse --git-path x`, `rev-parse --prefix x`.
  - (e) DENY (C7): `--sta`, `-sb`, `--end-of-options`.
  - (f) DENY: number forms: `git log -n x`, `git log -n`, `git log -0`, `git diff -5`.
  - (g) DENY (C9 and PowerShell): `git diff m1.txt,m2.txt`, `git diff HEAD:C:/x`, `git show :m1.txt`, `git log :/x`.
  - (h) DENY: device names: `git diff nul .env`, `git diff --stat NUL.txt m1.txt`.
  - (i) DENY: `git diff -- -x`, `git __proto__`, `git constructor`, plus already-denied forms kept as regression: `git diff --no-index .env m1.txt`, `git diff @v`, `git diff C:.env m1.txt`.
  - (j) DENY (conscious narrowing, Owner decision D6; the CURRENT hook allows these today): `git diff --numstat`, `git diff --shortstat`, `git diff --staged`, `git log --graph`, `git rev-parse --short HEAD`, `git rev-parse --abbrev-ref HEAD`, `git log --format=oneline`.
- K3. Oracle default run on the new hook: findings 0 NEW and 38 DISAPPEARED (Stage 2); after KNOWN_OPEN becomes the empty list (Stage 3): findings 0 = KNOWN_OPEN 0, test green. Any other failing test in the Stage 2 run voids the approval of D2.
- K4. Mutants M1, M2, M3 still produce FAIL; a new mutant M4 (C6, option allowlist check removed) is added and produces FAIL.
- K5. Calibration run (ORACLE_CALIBRATION=1) once on the final revision, green.
- K6. `git status --porcelain` identical before and after the oracle run; the temp root is removed.

## Approved scope (Owner creates .claude/task-scope.json)
- Stage 0-1 scope (as set by the Owner): allow test/scope-guard.test.mjs, docs/tasks/OFFICE-004.md; expires 2026-11-18T23:59:59Z.
- Stage 3 will additionally need test/scope-guard-oracle.test.mjs (Owner sets a new scope then).
- Files that change in this task: `.claude/hooks/scope-guard.mjs` (OWNER ONLY, region of lines 81-93; lines 84-86 stay character-for-character so the mutants M1-M3 still find their target exactly once), test/scope-guard.test.mjs (appends only), test/scope-guard-oracle.test.mjs (KNOWN_OPEN_ROWS, KNOWN_OPEN_APPROVAL, the comments around them, MUTANTS gets M4; nothing else), docs/tasks/OFFICE-004.md.
- READ-ONLY: scripts/guard-scope.mjs, .claude/settings.json, docs/GUARD-SYSTEMS.md (section 5 "38 kayit" becomes stale; updated in a separate docs step), docs/tasks/OFFICE-002.md, docs/tasks/OFFICE-003.md, all other test files.
- Commit proposal (stage and commit are Owner gates): hook + the two test files in ONE code commit, the note in a separate commit, so a revert is atomic.

## Plan (Planner -> Architect -> Implementation -> QA -> Reviewer)
- [x] Design (software-architect [AGENT]; approved by the Owner with D1-D6)
- [ ] Stage 1: tests appended to test/scope-guard.test.mjs, RED-first (hook unchanged); expected: existing 32 pass, (a) passes, (b)-(j) fail for every command the current hook allows
- [ ] Stage 2 (Owner): hook patch applied with a verified application script; then scope-guard tests GREEN, groups 1 and 2 GREEN, oracle default run: the only failing test is "oracle: coverage, non-vacuity, findings vs KNOWN_OPEN" with "0 NEW ... 38 DISAPPEARED"; M1-M3 pass
- [ ] Stage 3 (implementer, new Owner scope): KNOWN_OPEN_ROWS = [], KNOWN_OPEN_APPROVAL v2, M4; oracle default run GREEN
- [ ] Stage 4: QA by the Director, calibration run once, groups 1 and 2, git status; reviewer reads the code; Owner final run in the Owner's own shell with raw output pasted; docs step (GUARD-SYSTEMS.md section 5, CONTINUE.md); Owner commit

## Rollback plan
- Before merge: the Owner restores the previous hook version from the branch; the oracle and test files go back together (v1 KNOWN_OPEN, MUTANTS without M4). Required: with the old hook M4 has no target text and an empty KNOWN_OPEN gives 38 NEW.
- After merge: one `git revert` of the code commit by the Owner; hook, tests and oracle return atomically. Agents do not revert, checkout or reset.
- If the hook fails to load (syntax error): onFailure is block, so no tool runs inside Claude Code; the Owner restores the last good hook from a separate terminal. Prevention: before saving, the Owner runs `node --check` and `node --test test/scope-guard.test.mjs` on a copy.
- After a rollback: scope-guard tests (32), groups 1 and 2, oracle 38 = 38.

## Evidence (real command output only; unrun = NOT TESTED)
- Design report (software-architect) [AGENT]: full text was shown to the Owner in the Director chat; its labels apply. Everything in the design is NOT TESTED on Windows.
- [OWNER, Claude chat] verification of the design code, NOT an independent agent review and NOT a Windows run: the proposed code was run with the real tokensOf, isEscapedOrOutside and the OLD isGitRead code from the hook on a Linux VM copy with Node v22 (the repo was not written to). Results: KNOWN_OPEN 19 candidates: old 19 allowed / new 0; C1 27/27 pass; unit PASS list 21/21 pass; K2 DENY 34/34 denied; on 400000 random commands the new allowed set is a subset of the old one, violations 0 (old allowed 191004, new allowed 70760).

- [OWNER] Stage 2 evidence (Owner's own PowerShell; raw files in the Owner TEMP: owner-o004-s2-unit.txt, owner-o004-s2-all.txt, owner-o004-s2-oracle.txt; the Director did not see them):
  - (1) Hook application script: C:\Users\crypt\office004-apply.mjs, 11003 bytes, SHA-256 F0F141E49D0AA95552CBF2C0592DAACC902ADF9706FC12CC7523186ABB083F5B. Dry run and --apply: anchors OK; mutant cuts M1-M4 found exactly once; smoke allow 47x4, deny 59x4, neighbours 6, misses 0, SMOKE OK. Hook sha256 before A95952706D70590A308C4DF65CA8605B61424161A93D6488E0DAEF04942075CA, after F21C539915B414D2E63C06A8C215658174E376D3075CFC1755A8529825306236; node --check exit 0; backup in the Owner TEMP as scope-guard.mjs.office004-backup.
  - (2) Unit: exit 0, 42/42. The 7 test files outside the oracle in one run: exit 0, 286/286 (276 + 10).
  - (3) Oracle: exit 1, 106 s, 20 tests, 16 pass, 1 fail, 3 skipped; "findings (FAIL+WARN) = 0; KNOWN_OPEN entries = 38"; the only failing test is "oracle: coverage, non-vacuity, findings vs KNOWN_OPEN" with the message "0 NEW (possible hole), 38 DISAPPEARED"; M1 executed=92 FAIL=18, M2 executed=28 FAIL=6 (Bash 2, PowerShell 4), M3 executed=7 FAIL=2 (Bash 0, PowerShell 7); the M1-M3 tests passed; "cleanup: temp root removed=true". The executed counts of the mutants changed against earlier stages (M1 88->92, M2 30->28, M3 6->7) while the FAIL counts stayed the same; the cause was not measured (UNKNOWN). test/scope-guard.test.mjs SHA-256 99DF696146C483864BDC630DB38C6E4CFFAFACC4422D605C859AF8EBA5C8033B.
  - (4) [OWNER, Claude chat] independent count of Stage 1: the real hook's decide() over 2 roles x 2 tools x groups (b)-(j) gives 216 misses and 54 distinct commands allowed today (b 19, c 4, d 10, e 3, f 4, g 4, h 2, i 1, j 7), identical to the agent report; the 225 the Director counted with grep was a counting artifact. Linux VM, Node v22, repo not written.
  - (5) Owner decision: D2 CONDITION MET: raw output "0 NEW, 38 DISAPPEARED", no other test failed; KNOWN_OPEN v2 = empty list APPROVED; Stage 3 opened. .claude/task-scope.json now allows only test/scope-guard-oracle.test.mjs and docs/tasks/OFFICE-004.md.
  - [DIRECTOR] check (not independent): sha256sum of .claude/hooks/scope-guard.mjs = F21C5399... and of test/scope-guard.test.mjs = 99DF6961..., both equal to the values above; node --check on the hook exit 0; git status --porcelain: " M .claude/hooks/scope-guard.mjs", " M test/scope-guard.test.mjs", "?? docs/tasks/OFFICE-004.md".

- [OWNER, Claude chat] Stage 3 review (not an independent agent review): the oracle diff was read from the repo and contains only E1-E4; the hook (F21C5399...06236) and the unit test (99DF6961...033B) did not change; calibration run exit 0, 286 s, 21/21 pass, 0 skipped; M4 executed=66 FAIL=18 (Bash 9, PowerShell 9); default run 114 s, findings 0 = KNOWN_OPEN 0; the stale-comment fix Y1/Y2 touches comments only.
- Stage 3 comment fix Y1/Y2 ([AGENT] edit, [DIRECTOR] verified, not independent): test/scope-guard-oracle.test.mjs line 10 "mutants M1-M3" -> "mutants M1-M4", line 318 "so they do not change KNOWN_OPEN;" -> "so they add no finding;"; comments only. node --check exit 0; default run exit 0, 117 s, 21 tests, 18 pass, 0 fail, 3 skipped, findings 0 = KNOWN_OPEN 0, M1 FAIL=18, M2 FAIL=6, M3 FAIL=2, M4 FAIL=18, temp root removed; diff against the pre-edit copy = exactly the Y1/Y2 lines plus the earlier E1-E4 hunks; "M1-M3" no longer occurs; bytes > 127: 0. New oracle SHA-256 33CD795CFCCE6A4E1E9F31ED7DBD9BD1BECA8190DBC0BB61E89352902DF04D8A (hook F21C5399...06236 and unit test 99DF6961...033B unchanged). Line endings: the file has 0 CR bytes (LF only; checked by byte count, the earlier "CRLF 822" figure from a grep was a command artifact and is withdrawn); git reports i/lf w/lf; nothing was converted.
- [OWNER] Stage 4 final run (Owner PowerShell, 2026-11-15; raw files in the Owner TEMP: owner-o004-s4-unit.txt, owner-o004-s4-all.txt, owner-o004-s4-oracle.txt; the Director did not see them): hashes: hook F21C539915B414D2E63C06A8C215658174E376D3075CFC1755A8529825306236, test/scope-guard.test.mjs 99DF696146C483864BDC630DB38C6E4CFFAFACC4422D605C859AF8EBA5C8033B, oracle 33CD795CFCCE6A4E1E9F31ED7DBD9BD1BECA8190DBC0BB61E89352902DF04D8A. Unit exit 0, 2 s, tests 42, pass 42, fail 0. The 7 test files outside the oracle in one run: exit 0, 27 s, tests 286, pass 286, fail 0. Oracle: exit 0, 123 s, tests 21, pass 18, fail 0, skipped 3; "findings (FAIL+WARN) = 0; KNOWN_OPEN entries = 0"; M1 executed=92 FAIL=18, M2 executed=28 FAIL=6, M3 executed=7 FAIL=2, M4 executed=66 FAIL=18 (WARN 24, PASS 24; Bash 33/9, PowerShell 33/9); cleanup removed=true. git diff --numstat: hook 25/6, oracle 8/28, unit 70/0 (Windows, autocrlf). [OWNER] commit 6ba62ae "feat(scope-guard): default-deny git-read allowlist, KNOWN_OPEN v2 empty (OFFICE-004)": 3 files, 103 insertions, 34 deletions; this note was NOT part of the commit. Calibration: [DIRECTOR] run exit 0, 286 s, 21/21 pass, 0 skipped (Stage 3). Note: the Owner's first summary filter ("# tests ...") did not match Node's "i tests" output format; it was a filter error; the numbers were read afterwards from the same files.
- [DIRECTOR] check (not independent): HEAD is 6ba62ae on task/office-004-git-read-allowlist; `git show --stat` of 6ba62ae lists 3 files, 103 insertions, 34 deletions, equal to the Owner figures; the working-tree hashes of the hook, the unit test and the oracle start with F21C5399, 99DF6961 and 33CD795C (equal to the values above); git status --porcelain before the docs step: only "?? docs/tasks/OFFICE-004.md".

## Owner decisions (2026-11-14)
- D1: the Owner applies the hook patch (the hook is PROTECTED), in Stage 2, with a verified application script.
- D2: KNOWN_OPEN v2 = empty list. Conditional: in Stage 2 the raw output must show "0 NEW, 38 DISAPPEARED"; if any other test fails, there is no approval.
- D3: mutant M4 approved (supersedes the earlier "M1-M3 only" decision for this task).
- D4: the C8 comma gap is an accepted limitation (no mutant coverage); the unit test K2g protects it.
- D5: false-deny measurement: the BLOCKED-commands sections of later agent reports (the hook log keeps only the first two words, so it cannot show which option was denied).
- D6: the allowlist is conservative. `--numstat`, `--staged`, `rev-parse --short` are NOT added; K2j records them as conscious narrowing.

## Open decisions / remaining work
- Stage 1 starts now (implementation-engineer). Everything after Stage 1 waits for the Owner.
- Follow-up outside this task: log the class of a deny (option / argument / subcommand) without token text.

- Stage 1 results [AGENT] (implementation-engineer, 2026-11-14, NOT independent review; hook unchanged): 10 tests (a)-(j) appended to test/scope-guard.test.mjs, 2 roles x 2 tools each. `node --test test/scope-guard.test.mjs`: 42 tests, 33 pass (existing 32 + (a)), 9 fail (b)-(j) = RED as expected. Wrongly allowed by the current hook (of 4 role/tool combos each): (b) 19/19 cmds, (c) 4/4, (d) 10/10, (e) 3/3, (f) 4/4, (g) 4/4, (h) 2/2, (i) 1/6 (only `git diff -- -x`; `git __proto__`, `git constructor`, `--no-index`, `@v`, `C:.env` are already denied), (j) 7/7. Windows behavior of the commands: NOT TESTED.
- Stage 3 results [AGENT] (implementation-engineer, 2026-11-14, NOT independent review): test/scope-guard-oracle.test.mjs only: KNOWN_OPEN_ROWS = [], KNOWN_OPEN_APPROVAL v2 text, comments at old lines 33-37 updated, mutant M4 (C6) added after M3. `node --test test/scope-guard-oracle.test.mjs`: 21 tests, 18 pass, 0 fail, 3 skipped (calibration), duration_ms 116240; "findings (FAIL+WARN) = 0; KNOWN_OPEN entries = 0"; M1 executed=92 FAIL=18, M2 executed=28 FAIL=6, M3 executed=7 FAIL=2, M4 executed=66 FAIL=18 (Bash 9, PowerShell 9); "cleanup: temp root removed=true". Process exit code was not displayed by the tool. Calibration run: NOT TESTED. Hook, test/scope-guard.test.mjs unchanged by this step.

## UNKNOWN list (from the design report; none of these is resolved)
- U1. Does `-O <file>` (separate argument) work in git-diff; the doc shows only the attached form. Both are denied.
- U2. On Windows, whether git treats `nul` and other device names as outside the work tree and switches to implicit no-index. Denied; not measured.
- U3. How PowerShell 5.1 passes `--`, `-5`, a mid-token `@` and comma arrays to git (argv). The design does not depend on it.
- U4. How git for Windows matches paths with a trailing dot (`m1.txt.`).
- U5. Implicit no-index through a symlink or junction inside the work tree.
- U6. Whether git-show applies textconv to blobs by default: the git-show doc does not say.
- U7. The separate meanings of C2 and C4: OFFICE-003.md describes them together.
- U8. Windows runs completed: new tests 42/42, mutant M4 FAIL 18, subset claim measured on a Linux VM over 400000 random commands with 0 violations (not measured separately on Windows).
- U9. Option differences between the git-scm.com "latest" docs and 2.55.0.windows.5. The allowlist denies new options anyway.
- U10. The real false-deny rate: the hook log does not record options, so it cannot be measured before the change.

## Measurement (Owner fills; unmeasured = NOT MEASURED, never estimate)
- Model + effort per stage: planner <m/e> | implementation <m/e> | QA <m/e> | reviewer <m/e> | other <m/e>
- /usage before: <value, time>
- /usage after: <value, time>
- Wall-clock time: <start - end>
- Changed lines: <paste `git diff --shortstat` output>
- Defects found: <count + stage that found it (QA / reviewer / Owner / CI) + one line each>
- Red/green evidence: <test name, red output ref, green output ref, Owner reproduced YES/NO>
