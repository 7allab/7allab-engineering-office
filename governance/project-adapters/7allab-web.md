# 7ALLAB Engineering Office — 7ALLAB Web Project Safety Adapter

**Document ID:** 7ALLAB-ADAPTER-WEB-001
**Adapter version:** 0.3-draft
**Status:** Draft — Ratification Pending
**Date:** 2026-10-27
**Governance baseline:** the 1.1.1 governance set (ratified by the project owner, decision D4; this adapter itself stays Draft — Ratification Pending)

This adapter is a written safety contract. It is not an installed or enforced control, it is not approved policy,
it grants no authority, it does not select a product to work on, and it does not set
any development priority or pilot order. Product development order is decided by the
project owner.

Evidence labels used below: **[GOV]** stated in the cited governance document (a ratified document; [GOV] means the rule is stated there, never that tooling implements or enforces it);
**[DERIVED]** proposed here by applying a cited governance rule, not yet in 7ALLAB
Web's own policy; **[UNVERIFIED]** not established; requires the 7ALLAB Web repository.

## 1. Product identity and evidence sources

- Identity: 7ALLAB Web, the 7ALLAB corporate web presence with product presentation. [GOV: Charter 11, Core]
- Evidence used: Engineering Charter Section 11 (7ALLAB WEB); Core Operating Instructions, Project-Specific Requirements (7ALLAB WEB); Agent Roles & Handoff Protocol Section 14; Assignment Matrix Sections 3 and 5; Tool Registry Section 7 (Playwright, axe-core, Lighthouse CI are CANDIDATE; whether any of them is installed is not verified).
- The 7ALLAB Web repository was not opened for this adapter. Repository path, branch, HEAD, worktree state, framework and hosting: **[UNVERIFIED]**.

## 2. Protected architecture and safety boundaries

| Boundary | Source |
|---|---|
| Corporate identity and product branding are preserved (corporate-first branding, premium product presentation) | [GOV] Charter 11, Core |
| Visual consistency | [GOV] Core |
| Accessibility | [GOV] Charter 11, Core |
| Responsive design and performance | [GOV] Charter 11, Core |
| TR/EN coherence and quality | [GOV] Charter 11, Core |
| Actual browser verification is required for interactive and visual changes | [GOV] Charter 11 |

## 3. Engineering Office specialists

- UI/UX Engineer and QA & Test Engineer coordinate visual identity, accessibility, performance and browser validation. [GOV: Protocol 14]
- Design, Engineering and QA; use Figma only when a relevant design file or approved design task exists. [GOV: Matrix 5]
- Figma write operations, creating files and changing shared design libraries need separate authorization. [GOV: Matrix 3]

## 4. Sensitive data and external tools

- PUBLIC covers official documentation, public dependencies and public repository information; non-public plans, implementation details, private source code and business decisions are INTERNAL. [GOV: Charter 8]
- **[DERIVED]** Site content is treated as PUBLIC only when it is actually published and its classification is verified. Drafts, unpublished content, source and internal information are not assumed PUBLIC. Content whose classification is unknown is unclassified and is not transferred externally (Charter 8).
- Raw credentials, private keys and production secrets (for example deploy or hosting tokens) must not be placed in prompts, logs or tool arguments, or sent to AI tools or external MCP servers, whatever their class label; redacted or synthetic substitutes are used instead. [GOV: Charter 8]
- An authorized application component's own necessary service authentication is not AI-tool secret sharing. It never permits raw secrets to enter an AI model context, prompt, agent tool argument, log or external MCP server. [GOV: Charter 8]
- Customer information, if any is handled by the site, is CONFIDENTIAL. [GOV: Charter 8] Whether the site handles any: **[UNVERIFIED]**.
- Unclassified 7ALLAB Web data is closed to external transfer. [GOV: Charter 8]
- Every 7ALLAB Web delegation records the five data-transfer fields (Protocol 5); an omitted field means no external transfer.
- Preserve the existing UI technology and testing architecture; add test tools only for a demonstrated need. [GOV: Registry 7]

## 5. Separate permission gates

| Gate | Rule |
|---|---|
| Read / inspect | Read-only discovery is the default. [GOV: Core] |
| Write | Only explicitly authorized files. |
| Run tests / browser checks | Separate from write; browser verification evidence is attached to visual claims. [GOV: Charter 11] |
| Stage | Separate, exact repository and file list. [GOV: Charter 9] |
| Commit | Separate; does not supply stage permission. [GOV: Charter 9] |
| Push | Separate; repository, remote and branch. [GOV: Charter 9] |
| Merge / rebase / tag | Each separate. [GOV: Charter 9] |
| Install / hook / MCP / plugin | Separate explicit authorization. [GOV: Core, Registry 12] |
| External data transfer | Separate; fail-closed. [GOV: Protocol 5] |
| **Publish / deploy** | **Separate human authorization, independent of write, stage, commit and push. A completed or verified change is not published.** [GOV: Charter 9, Protocol Type G, Protocol 6] |

Commands that touch the Git index are assessed by their actual effect (Charter 9).

**Push and automatic deployment.** A push, merge or tag can trigger CI/CD publishing. Whether it does in 7ALLAB Web is **[UNVERIFIED]**. Push authorization never implies deploy authorization (Charter 9, Protocol Type G). **[DERIVED]** Where such a link may exist, a push is performed only with explicit push authorization and the separate human publish/deploy authorization; if the two cannot be technically separated, no push is performed until every required explicit authorization exists. This adapter does not open the 7ALLAB Web repository and attempts no deployment.

## 6. Handling proposed for 7ALLAB Web

- A visual or interactive change is not reported complete from source review alone; it carries actual browser verification. [GOV: Charter 11]
- Work involving personal data is HIGH risk, with independent technical review among its minimum controls. [GOV: Charter 4; Protocol 6.1]
- **[DERIVED]** Analytics, forms, authentication and any other component that collects or processes personal data are treated as personal-data work and therefore HIGH risk. Whether a given component processes personal data is **[UNVERIFIED]** until it is inspected; no lower risk level is assumed.
- The [DERIVED] item is a proposal; it becomes 7ALLAB Web policy only after owner ratification.

## 7. Prohibited or out of scope

- Publishing or deploying without separate human authorization. [GOV]
- Placing raw credentials, private keys or production secrets (for example deploy or hosting tokens) in prompts, logs, agent tool arguments, AI tools or external MCP servers. The service-authentication note in Section 4 does not permit this. [GOV: Charter 8]
- Declaring a visual or interactive change complete without actual browser verification. [GOV]
- Altering corporate identity or branding without an explicit request. [GOV: preserve corporate identity]
- Using Figma write operations or modifying shared design libraries without approval. [GOV: Matrix 3]
- Any Git stage, commit, push, merge, rebase, tag or install without its own authorization. [GOV]

## 8. UNVERIFIED — confirm in the 7ALLAB Web repository

- Repository path, branch, HEAD, dirty-tree inventory and any 7ALLAB Web-own rules file.
- Framework, build system, hosting and the actual publish/deploy path and who can run it.
- Whether a push, merge or tag triggers automatic build or publishing (CI/CD).
- The TR/EN mechanism and where the brand guidelines live.
- Whether the site collects any personal data, runs analytics or has forms.
- Which browser, accessibility and performance checks exist and their current results.

## 9. Change control

This adapter changes only through a reviewed, owner-approved revision. It does not
override the governance documents, and it records no operational success.

**Revision record**

- 0.2-draft, 2026-10-27, P2-ADAPTER-ALIGN: PUBLIC classification aligned to Charter 8; push/automatic-deployment contract added; personal-data components set to the HIGH-risk floor; "not installed" corrected to "not verified installed"; header wording corrected after independent review. Status unchanged: Draft — Ratification Pending.
- 0.3-draft, 2026-10-27, P2-ADAPTER-FIX (after the final adapter acceptance review): raw-secret bar restated with the full Charter 8 scope and the service-authentication note, and added to Section 7. This revision has not been independently re-reviewed. Status unchanged: Draft — Ratification Pending.
- Change ID P2-RATIFY-01, 2026-10-27: the governance baseline reference now names the ratified 1.1.1 set (decision D4) and the [GOV] label note was updated. The project owner accepted this adapter only as a controlled safety reference (decision D5). Its status stays Draft — Ratification Pending and its version label is unchanged. [GOV] rules remain subject to the ratified governance documents, which prevail; [DERIVED] rules are advisory proposals and not binding product policy; [UNVERIFIED] items are not verified. No rule was changed.
