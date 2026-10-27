# 7ALLAB Engineering Office — KOVAN Project Safety Adapter

**Document ID:** 7ALLAB-ADAPTER-KOVAN-001
**Adapter version:** 0.2-draft
**Status:** Draft — Ratification Pending
**Date:** 2026-10-27
**Governance baseline:** the 1.1.1 governance set (ratified by the project owner, decision D4; this adapter itself stays Draft — Ratification Pending)

This adapter is a written safety contract. It is not an installed or enforced control, it is not approved policy,
it grants no authority, it does not select a product to work on, and it does not set
any development priority or pilot order. Product development order is decided by the
project owner.

Evidence labels used below: **[GOV]** stated in the cited governance document (a ratified document; [GOV] means the rule is stated there, never that tooling implements or enforces it);
**[DERIVED]** proposed here by applying a cited governance rule, not yet in KOVAN's
own policy; **[UNVERIFIED]** not established; requires the KOVAN repository.

## 1. Product identity and evidence sources

- Identity: KOVAN, a 7ALLAB product named in the Engineering Charter scope. [GOV: Charter header, Section 11]
- Evidence used: Engineering Charter Section 11 (KOVAN); Core Operating Instructions, Project-Specific Requirements (KOVAN); Agent Roles & Handoff Protocol Section 14; Assignment Matrix Section 5; Tool Registry (Promptfoo, OmniRoute, current status list).
- The KOVAN repository was not opened for this adapter. Repository path, branch, HEAD and worktree state: **[UNVERIFIED]** (Tool Registry lists "Current KOVAN worktree state: NOT REVERIFIED").

## 2. Protected architecture and safety boundaries

| Boundary | Source |
|---|---|
| Default-deny authorization is preserved | [GOV] Core, KOVAN |
| Skill/provider contracts are preserved | [GOV] Charter 11, Core |
| Manifest restrictions/constraints are preserved | [GOV] Charter 11, Core |
| SHA-256 evidence, reproducibility and audit evidence are preserved | [GOV] Charter 11, Core |
| Source integrity and protected worktree state | [GOV] Charter 11, Core |
| Established MANUAL verification gates remain in force | [GOV] Charter 11, Core |
| Do not interrupt or modify a partially completed verification workflow merely to install engineering tools | [GOV] Charter 11 |
| A model gateway (OmniRoute) never replaces KOVAN's own authorization and security enforcement | [GOV] Tool Registry, OmniRoute |

If a KOVAN-specific rule is stricter than any Engineering Office rule, the stricter rule applies. [GOV: Core, "additional constraints"; Charter Section 8]

## 3. Engineering Office specialists

- Priority: Security Engineer, QA & Test Engineer, Release & Evidence Reviewer for authorization, manifest and evidence-sensitive work. [GOV: Protocol 14]
- First: Engineering, Security and QA. [GOV: Matrix 5]
- Other specialists are used only as the task requires. Roles remain logical unless an agent was actually dispatched (Protocol 6.1).

## 4. Sensitive data and external tools

- Credentials, license secrets, financial records and customer information are CONFIDENTIAL; private keys and production secrets are RESTRICTED. Raw credentials, private keys and production secrets never enter prompts, logs, tool arguments, AI tools or external MCP servers. [GOV: Charter 8]
- Unclassified KOVAN data is closed to external transfer until classified. [GOV: Charter 8]
- AI-quality testing (Promptfoo) starts with synthetic, non-sensitive fixtures; private test data is not sent to external providers without authorization. [GOV: Tool Registry 5]
- Every KOVAN delegation records the five data-transfer fields (Protocol 5); an omitted field means no external transfer.
- KOVAN source code is INTERNAL at minimum. Whether any KOVAN content is CONFIDENTIAL or RESTRICTED: **[UNVERIFIED]**.

## 5. Separate permission gates

| Gate | Rule |
|---|---|
| Read / inspect | Read-only discovery is the default. [GOV: Core] |
| Write | Only explicitly authorized files. [GOV: Core] Do not interrupt or modify a partially completed verification workflow merely to install engineering tools. [GOV: Charter 11] **[DERIVED]** No write of any kind during a partially completed verification workflow without a recorded owner decision. |
| Run tests / commands | Separate from write; no command that changes state without authorization. |
| Stage | Separate, exact repository and file list. [GOV: Charter 9] |
| Commit | Separate; does not supply stage permission. [GOV: Charter 9] |
| Push | Separate; repository, remote and branch. [GOV: Charter 9] |
| Merge / rebase / tag | Each separate. [GOV: Charter 9] |
| Install / hook / MCP / plugin | Separate explicit authorization. [GOV: Core, Registry 12] |
| External data transfer | Separate; fail-closed. [GOV: Protocol 5] |
| Deploy / publish | Separate human authorization. [GOV: Charter 9, Protocol Type G] |

Commands that touch the Git index are assessed by their actual effect (Charter 9).

## 6. Stricter handling proposed for KOVAN

- **[DERIVED]** Treat authorization, manifest, skill/provider-contract and audit-evidence work as HIGH risk (Charter 4 lists authorization and security contracts as HIGH examples). A HIGH-risk KOVAN task is not reported VERIFIED or COMPLETED without REVIEW_VERIFIED from a reviewer other than the implementer (Protocol 6.1).
- **[DERIVED]** Any change to a MANUAL gate or to default-deny behavior needs an explicit owner decision recorded before implementation.
- These two rules and the [DERIVED] part of the Write gate in Section 5 are proposals; they become KOVAN policy only after owner ratification.

## 7. Prohibited or out of scope

- Weakening default-deny, a skill/provider contract, a manifest restriction or a MANUAL gate. [GOV]
- Installing engineering tools into an in-progress verification workflow. [GOV]
- Replacing KOVAN's own authorization with an external gateway or tool. [GOV]
- Exposing or transferring CONFIDENTIAL/RESTRICTED content without scoped authorization. [GOV]
- Any Git stage, commit, push, merge, rebase, tag, deploy or install without its own authorization. [GOV]

## 8. UNVERIFIED — confirm in the KOVAN repository

- Repository path, branch, HEAD, dirty-tree inventory and any KOVAN-own rules file.
- The actual list and definition of MANUAL gates, the manifest format and the authorization contract.
- Whether a verification workflow is currently partially completed.
- Test, build and security-scan commands and their current results.
- Secret-handling practices and which KOVAN data is CONFIDENTIAL or RESTRICTED.
- Whether KOVAN already has human-approval or independent-review rules stricter than those above.

## 9. Change control

This adapter changes only through a reviewed, owner-approved revision. It does not
override the governance documents, and it records no operational success.

**Revision record**

- 0.2-draft, 2026-10-27, P2-ADAPTER-ALIGN: the Write gate no longer labels a stricter rule as [GOV]; the governance sentence and the proposed stricter rule are separated; header wording corrected after independent review. Status unchanged: Draft — Ratification Pending.
- Change ID P2-RATIFY-01, 2026-10-27: the governance baseline reference now names the ratified 1.1.1 set (decision D4) and the [GOV] label note was updated. The project owner accepted this adapter only as a controlled safety reference (decision D5). Its status stays Draft — Ratification Pending and its version label is unchanged. [GOV] rules remain subject to the ratified governance documents, which prevail; [DERIVED] rules are advisory proposals and not binding product policy; [UNVERIFIED] items are not verified. No rule was changed.
