# TASK <id> - <short title>

Status: PLANNED | IN PROGRESS | BLOCKED | DONE        Branch: <feature-branch>        Opened: <date>

Task state lives in this file, not in the chat. A new session reads it and continues.

## Goal and acceptance criteria
1. <checkable by a command or visible behavior>

## Approved scope (Owner copies this into .claude/task-scope.json; see .claude/task-scope.example.json)
- allow: <files or folders>        expires: <ISO date>

## Plan (Planner -> Architect -> Implementation -> QA -> Reviewer)
- [ ] Brief   - [ ] Design   - [ ] Code + tests   - [ ] QA run   - [ ] Review   - [ ] Owner merge

## Evidence (real command output only; unrun = NOT TESTED)

## Open decisions / remaining work

## Measurement (Owner fills; unmeasured = NOT MEASURED, never estimate)
- Model + effort per stage: planner <m/e> | implementation <m/e> | QA <m/e> | reviewer <m/e> | other <m/e>
- /usage before: <value, time>        /usage after: <value, time>        (D18 campaigns: mandatory)
- Wall-clock time: <start - end>
- Changed lines: <paste `git diff --shortstat` output>
- Defects found: <count + stage that found it (QA / reviewer / Owner / CI) + one line each>
- Red/green evidence: <test name, red output ref, green output ref, Owner reproduced YES/NO>
