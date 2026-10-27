# 7ALLAB Engineering Office — LIFEACTA Project Safety Adapter

**Document ID:** 7ALLAB-ADAPTER-LIFEACTA-001
**Adapter version:** 0.3-draft
**Status:** Draft — Ratification Pending
**Date:** 2026-10-27
**Governance baseline:** the 1.1.1 governance set (ratified by the project owner, decision D4; this adapter itself stays Draft — Ratification Pending)

This adapter is a written safety contract. It is not an installed or enforced control, it is not approved policy,
it grants no authority, it does not select a product to work on, and it does not set
any development priority or pilot order. Product development order is decided by the
project owner.

Evidence labels used below: **[GOV]** stated in the cited governance document (a ratified document; [GOV] means the rule is stated there, never that tooling implements or enforces it);
**[DERIVED]** proposed here by applying a cited governance rule, not yet in LIFEACTA's
own policy; **[UNVERIFIED]** not established; requires the LIFEACTA repository.

## 1. Product identity and evidence sources

- Identity: LIFEACTA, a 7ALLAB product that handles personal documents and records, with date extraction, warranty/deadline interpretation and reminders. [GOV: Charter 11, Core]
- Evidence used: Engineering Charter Section 11 (LIFEACTA); Core Operating Instructions, Project-Specific Requirements (LIFEACTA); Agent Roles & Handoff Protocol Section 14 (mentions PWA and Android); Assignment Matrix Section 5.
- The LIFEACTA repository was not opened for this adapter. Repository path, branch, HEAD, worktree state, architecture and platforms: **[UNVERIFIED]**.

## 2. Protected architecture and safety boundaries

| Boundary | Source |
|---|---|
| Personal documents and records are protected | [GOV] Charter 11, Core |
| Trustworthy (reliable) date extraction is a stated priority | [GOV] Charter 11 ("trustworthy"), Core ("reliable") |
| Warranty and deadline interpretation is a stated priority | [GOV] Charter 11, Core |
| User correction is a stated priority | [GOV] Charter 11 only; Core does not state it |
| Offline behavior is preserved | [GOV] Charter 11, Core |
| Reminders must be actionable and reliable | [GOV] Charter 11, Core |
| Relevant mobile-device behavior is verified instead of relying only on simulated output | [GOV] Charter 11 |
| Real Android device verification is a stated priority | [GOV] Core |

The rows above restate Charter 11 and Core protection priorities ("Protect", "Prioritize", "Verify"). They are quality principles, not separate governance prohibitions; any stricter prohibition derived from them is marked [DERIVED] in Section 6.

## 3. Engineering Office specialists

- Product Planner, QA & Test Engineer and Security Engineer prioritize accurate records, reminders, privacy, PWA and Android behavior. [GOV: Protocol 14]
- Product Management, Engineering, Security, QA and Design; prioritize date correctness, privacy and real-device validation. [GOV: Matrix 5]

## 4. Sensitive data and external tools

- Customer information and sensitive personal documents are CONFIDENTIAL. [GOV: Charter 8] **[DERIVED]** Real user documents, extracted dates tied to a person and reminder contents are treated as CONFIDENTIAL until the owner classifies them otherwise.
- CONFIDENTIAL and RESTRICTED content, including sensitive personal documents, must not be transferred to any external service without explicit authorization that names the data class and the destination; a general task authorization is not such an authorization. [GOV: Charter 8]
- Sensitive data is minimized, redacted or replaced with synthetic fixtures whenever practical. [GOV: Charter 8]
- **[DERIVED]** For LIFEACTA, real user documents are kept out of prompts, logs, tool arguments, AI tools and external MCP servers by default, and tests use synthetic fixtures; any exception needs the explicit, scoped authorization described above.
- Raw credentials, private keys and production secrets must not be placed in prompts, logs or tool arguments, or sent to AI tools or external MCP servers, whatever their class label; redacted or synthetic substitutes are used instead. [GOV: Charter 8]
- An authorized application component's own necessary service authentication is not AI-tool secret sharing. It never permits raw secrets to enter an AI model context, prompt, agent tool argument, log or external MCP server. [GOV: Charter 8]
- Unclassified LIFEACTA data is closed to external transfer. [GOV: Charter 8]
- Every LIFEACTA delegation records the five data-transfer fields (Protocol 5); an omitted field means no external transfer.
- Any third-party service that would receive document content (for example OCR or extraction) is an external destination and needs a separate, scoped authorization. **[DERIVED]**

## 5. Separate permission gates

| Gate | Rule |
|---|---|
| Read / inspect | Read-only discovery is the default. [GOV: Core] |
| Write | Only explicitly authorized files. |
| Run tests / commands | Separate from write; real user data is not used. **[DERIVED]** |
| Real-device verification | Charter 11 states the priority to verify relevant mobile-device behavior instead of relying only on simulated output. [GOV: Charter 11] **[DERIVED]** Real-device verification is kept as a separate evidence step, and a simulator result is not treated as real-device evidence. |
| Stage | Separate, exact repository and file list. [GOV: Charter 9] |
| Commit | Separate; does not supply stage permission. [GOV: Charter 9] |
| Push | Separate; repository, remote and branch. [GOV: Charter 9] |
| Merge / rebase / tag | Each separate. [GOV: Charter 9] |
| Install / hook / MCP / plugin | Separate explicit authorization. [GOV: Core, Registry 12] |
| External data transfer | Separate; fail-closed. [GOV: Protocol 5] |
| Release / store publishing / deploy | Separate human authorization. [GOV: Charter 9, Protocol Type G] |

Commands that touch the Git index are assessed by their actual effect (Charter 9).

## 6. Handling proposed for LIFEACTA

- Work involving personal data is HIGH risk. Charter 4 lists personal data as a HIGH-risk example without any condition. [GOV: Charter 4]
- **[DERIVED]** Loss of a record, a wrong date or a misstated reminder are illustrations of how LIFEACTA work can fail. They are examples added by this adapter, not preconditions for HIGH and not Charter 4 text.
- A HIGH-risk LIFEACTA task is not reported VERIFIED or COMPLETED without REVIEW_VERIFIED from a reviewer other than the implementer. [GOV: Protocol 6.1]
- **[DERIVED]** For LIFEACTA, personal-data storage, handling, export, logging, extraction, OCR and sharing are treated as personal-data work, and date/deadline logic and reminder delivery that operate on a user's record are treated as HIGH risk. No lower risk level is assumed for them.
- **[DERIVED]** Mobile behavior is not reported as verified from simulated output alone. Charter 11 states only the priority to verify mobile-device behavior instead of relying only on simulated output; this stricter reporting rule is a proposal, not a governance prohibition.
- **[DERIVED]** Applying the Section 2 priorities (date extraction, deadline interpretation, user correction): date and deadline logic is tested with boundary cases (time zone, locale and ambiguous formats are candidates to confirm), a wrong extraction must remain user-correctable, and silent changes to date, warranty or deadline interpretation that the user cannot correct are to be avoided. Charter 11 states these as priorities, not prohibitions; this application is a proposal.
- The [DERIVED] items are proposals; they become LIFEACTA policy only after owner ratification.

## 7. Prohibited or out of scope

- Transferring real personal documents or records to any external service, AI tool or external MCP server without explicit authorization that names the data class and the destination. [GOV: Charter 8]
- Placing raw credentials, private keys or production secrets in prompts, logs, agent tool arguments, AI tools or external MCP servers. The service-authentication note in Section 4 does not permit this. [GOV: Charter 8]
- Any Git stage, commit, push, merge, rebase, tag, release or install without its own authorization. [GOV]

## 8. UNVERIFIED — confirm in the LIFEACTA repository

- Repository path, branch, HEAD, dirty-tree inventory and any LIFEACTA-own rules file.
- Platforms and architecture (the Protocol mentions PWA and Android; actual structure is unknown).
- Where documents are stored, whether any sync or cloud service is used, and retention rules.
- Whether any OCR or extraction service is external.
- Supported locales and time-zone behavior; offline implementation.
- Real-device test setup and current results.

## 9. Change control

This adapter changes only through a reviewed, owner-approved revision. It does not
override the governance documents, and it records no operational success.

**Revision record**

- 0.2-draft, 2026-10-27, P2-ADAPTER-ALIGN: data-transfer wording aligned to Charter 8 (absolute bar only for raw secrets; authorization naming data class and destination for other sensitive data); the user-correction priority is recorded in Section 2 as [GOV: Charter 11] and its application proposal in Section 6 as [DERIVED]; header wording corrected after independent review. Status unchanged: Draft — Ratification Pending.
- 0.3-draft, 2026-10-27, P2-ADAPTER-FIX (after the final adapter acceptance review): personal-data work set to an unconditional HIGH floor per Charter 4; raw-secret bar restated with the full Charter 8 scope and the service-authentication note; Section 2 sources corrected (user correction is Charter 11 only; real Android device verification is Core); the user-correction priority [GOV] and its application proposal [DERIVED] are separated. This revision has not been independently re-reviewed. Status unchanged: Draft — Ratification Pending.
- 0.3-draft (same version label, candidate), 2026-10-27, Change ID P2-LIFEACTA-R9 (after the final regression review, criterion R9 FAIL): the rule "mobile behavior is not declared verified from simulated output only" moved from Section 7 (Prohibited, labelled [GOV]) to Section 6 as [DERIVED]; the real-device gate in Section 5 separates the Charter 11 priority [GOV] from the stricter evidence rule [DERIVED]; the loss-of-record / wrong-date / misstated-reminder examples are separated from the Charter 4 text and labelled [DERIVED]. The unconditional HIGH floor for personal data stays [GOV: Charter 4]. No security, raw-secret, data-transfer or user-correction rule was changed. The version label was not incremented; the file hash identifies this revision. This revision has not been independently re-reviewed. Status unchanged: Draft — Ratification Pending.
- Change ID P2-RATIFY-01, 2026-10-27: the governance baseline reference now names the ratified 1.1.1 set (decision D4) and the [GOV] label note was updated. The project owner accepted this adapter only as a controlled safety reference (decision D5). Its status stays Draft — Ratification Pending and its version label is unchanged. [GOV] rules remain subject to the ratified governance documents, which prevail; [DERIVED] rules are advisory proposals and not binding product policy; [UNVERIFIED] items are not verified. No rule was changed.
