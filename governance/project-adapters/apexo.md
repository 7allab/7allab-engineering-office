# 7ALLAB Engineering Office — APEXO Project Safety Adapter

**Document ID:** 7ALLAB-ADAPTER-APEXO-001
**Adapter version:** 0.3-draft
**Status:** Draft — Ratification Pending
**Date:** 2026-10-27
**Governance baseline:** the 1.1.1 governance set (ratified by the project owner, decision D4; this adapter itself stays Draft — Ratification Pending)

This adapter is a written safety contract. It is not an installed or enforced control, it is not approved policy,
it grants no authority, it does not select a product to work on, and it does not set
any development priority or pilot order. Product development order is decided by the
project owner.

Evidence labels used below: **[GOV]** stated in the cited governance document (a ratified document; [GOV] means the rule is stated there, never that tooling implements or enforces it);
**[DERIVED]** proposed here by applying a cited governance rule, not yet in APEXO's
own policy; **[UNVERIFIED]** not established; requires the APEXO repository.

## 1. Product identity and evidence sources

- Identity: APEXO, a read-only trading terminal that does not execute orders. [GOV: Protocol 14, Matrix 5, Charter 11]
- Evidence used: Engineering Charter Section 11 (APEXO); Core Operating Instructions, Project-Specific Requirements (APEXO); Agent Roles & Handoff Protocol Section 14; Assignment Matrix Section 5; Tool Registry (UI/UX Pro Max and RustSec/cargo-audit are PREVIOUSLY_OBSERVED in APEXO history).
- The APEXO repository was not opened for this adapter. Repository path, branch, HEAD, worktree state, supported exchanges and current toolchain: **[UNVERIFIED]**.

## 2. Protected architecture and safety boundaries

| Boundary | Source |
|---|---|
| The read-only trading model is intentional and preserved | [GOV] Charter 11, Core |
| Order execution is prohibited within the current APEXO scope; no task or agent permission authorizes it. The governance text states no exception or environment qualification | [GOV] Charter 11, Core |
| This adapter reads the prohibition without environment qualification: a real exchange, testnet, paper, mock or similar environment grants no authority to submit, route or execute orders, and nothing in this adapter adds or implies any order-execution authority | [DERIVED] reading of the unqualified Charter 11 prohibition; the governance text does not name these environments |
| Evaluating any execution capability needs a separate explicit product and architecture decision plus a full security review | [GOV] Charter 11 |
| Rust-side credential handling is preserved unchanged | [GOV] Charter 8 and 11, Core |
| Exact financial calculations, accurate P&L and financial precision | [GOV] Charter 11, Core |
| Exchange integration boundaries and connector correctness | [GOV] Charter 11, Core |
| Trade history integrity and journal accuracy | [GOV] Charter 11, Core |
| Read-only portfolio, trade-history, journal and replay features are not order-execution capabilities, and neither authorizes the other. Whether each such feature exists in APEXO: [UNVERIFIED] | [DERIVED] reading of Charter 11 |

## 3. Engineering Office specialists

- Software Architect, Implementation Engineer, Security Engineer and QA & Test Engineer coordinate financial precision, connectors, credential handling and Rust security requirements. [GOV: Protocol 14]
- Engineering, Security and QA first; Design/Figma only for authorized UI work. [GOV: Matrix 5]
- Credential handling and exchange connectors require Security Engineer review. [GOV: Matrix 5]

## 4. Sensitive data and external tools

- Raw credentials (including exchange API keys), private keys and production secrets never enter prompts, logs, tool arguments, AI model context, AI tools or external MCP servers. The Rust-side credential handling is the legitimate service-authentication path and is not AI-tool secret sharing. [GOV: Charter 8]
- Financial records are CONFIDENTIAL. [GOV: Charter 8] **[DERIVED]** Trade history and journal data are financial records and are treated as CONFIDENTIAL until the owner classifies them otherwise.
- Sensitive data is minimized, redacted or replaced with synthetic fixtures whenever practical. [GOV: Charter 8] **[DERIVED]** For APEXO, synthetic fixtures are the default; real account data is used only where unavoidable.
- CONFIDENTIAL or RESTRICTED APEXO content (for example financial records and account data) must not be transferred to any external service without explicit authorization that names the data class and the destination; a general task authorization is not such an authorization. [GOV: Charter 8]
- Unclassified APEXO data is closed to external transfer. [GOV: Charter 8]
- Every APEXO delegation records the five data-transfer fields (Protocol 5); an omitted field means no external transfer.
- RustSec/cargo-audit are PREVIOUSLY_OBSERVED, not verified installed; their current configuration requires verification. [GOV: Tool Registry 6]

## 5. Separate permission gates

| Gate | Rule |
|---|---|
| Read / inspect | Read-only discovery is the default. [GOV: Core] |
| Write | Only explicitly authorized files. |
| Run tests / commands | Separate from write; no command that contacts a live exchange or uses real credentials without a specific, scoped decision; such a decision never authorizes order submission and never lets raw credentials into prompts, logs, tool arguments, AI tools or external MCP servers (Charter 8, 11). **[DERIVED]** |
| Stage | Separate, exact repository and file list. [GOV: Charter 9] |
| Commit | Separate; does not supply stage permission. [GOV: Charter 9] |
| Push | Separate; repository, remote and branch. [GOV: Charter 9] |
| Merge / rebase / tag | Each separate. [GOV: Charter 9] |
| Install / hook / MCP / plugin | Separate explicit authorization. [GOV: Core, Registry 12] |
| External data transfer | Separate; fail-closed. [GOV: Protocol 5] |
| Release / deploy | Separate human authorization. [GOV: Charter 9, Protocol Type G] |

Commands that touch the Git index are assessed by their actual effect (Charter 9).

## 6. Handling proposed for APEXO

- **[DERIVED]** Work on credentials, exchange connectors, financial calculations or persistence is HIGH risk (Charter 4 lists credentials and financial calculations). A HIGH-risk APEXO task is not reported VERIFIED or COMPLETED without REVIEW_VERIFIED from a reviewer other than the implementer (Protocol 6.1).
- **[DERIVED]** Financial-precision changes require tests with exact expected values; a passing mock is not proof of live exchange behavior (Charter 10).
- These are proposals; they become APEXO policy only after owner ratification.

## 7. Prohibited or out of scope

- Introducing, enabling or submitting order execution. [GOV: Charter 11, Core]
- **[DERIVED]** The same applies in every environment (real exchange, testnet, paper, mock or similar), and testing of order execution in any environment is outside this adapter's scope. Evaluating such a capability can only follow the separate product and architecture decision and full security review that Charter 11 requires.
- Weakening the read-only model. [GOV: Charter 11, Core ("Preserve" the read-only trading model)]
- Moving credential handling out of the Rust side, or placing raw credentials in prompts, logs, agent tool arguments, AI tools or external MCP servers. [GOV: Charter 8, 11]
- Placing raw credentials, exchange API keys, private keys or production secrets in prompts, logs, tool arguments, AI tools or external MCP servers. [GOV: Charter 8]
- Transferring CONFIDENTIAL account or financial data to an external service without explicit authorization that names the data class and the destination. [GOV: Charter 8]
- Any Git stage, commit, push, merge, rebase, tag, release or install without its own authorization. [GOV]

## 8. UNVERIFIED — confirm in the APEXO repository

- Repository path, branch, HEAD, dirty-tree inventory and any APEXO-own rules file.
- The exchange list and what permission scope the exchange keys actually have (read-only at the exchange).
- How the Rust-side credential storage works and where keys live.
- How financial precision, P&L and the journal are implemented and tested.
- Which security scanners are configured and their current results.
- Whether any code path could place or modify an order.

## 9. Change control

This adapter changes only through a reviewed, owner-approved revision. It does not
override the governance documents, and it records no operational success.

**Revision record**

- 0.2-draft, 2026-10-27, P2-ADAPTER-ALIGN: order-execution wording made unqualified across sections; data-transfer and credential rules aligned to Charter 8; label and header wording corrected after independent review. Status unchanged: Draft — Ratification Pending.
- 0.3-draft, 2026-10-27, P2-ADAPTER-FIX (after the final adapter acceptance review): the unconditional read-only / no-order-execution limit is kept as [GOV]; the environment wording (testnet, paper, mock) and the testing scope are separated and marked [DERIVED], so no principle appears under two statuses; the read-only model line cites its governance source. No order-execution authority is added. This revision has not been independently re-reviewed. Status unchanged: Draft — Ratification Pending.
- Change ID P2-RATIFY-01, 2026-10-27: the governance baseline reference now names the ratified 1.1.1 set (decision D4) and the [GOV] label note was updated. The project owner accepted this adapter only as a controlled safety reference (decision D5). Its status stays Draft — Ratification Pending and its version label is unchanged. [GOV] rules remain subject to the ratified governance documents, which prevail; [DERIVED] rules are advisory proposals and not binding product policy; [UNVERIFIED] items are not verified. No rule was changed.
