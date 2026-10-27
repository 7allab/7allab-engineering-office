# 7ALLAB SOFTWARE
## AI Engineering Skill, Plugin, MCP & Tool Registry
 
**Document ID:** 7ALLAB-TOOL-REGISTRY-001  
**Version:** 1.1.1  
**Status:** Ratified Tool Governance Baseline (project owner decision D4, 2026-10-27)  
**Owner:** 7ALLAB SOFTWARE  
**Applies To:** Claude Projects, Claude Code, ChatGPT, Codex, KOVAN, APEXO, LIFEACTA, 7ALLAB Web and future projects.
 
---
 
## 1. PURPOSE
 
Maintain one controlled inventory of engineering skills, plugins, MCP servers, development tools, research frameworks, and AI infrastructure candidates.
 
The registry prevents:
 
- Duplicate capabilities.
- Conflicting instructions and hooks.
- Unverified tool installation claims.
- Unauthorized dependencies.
- Excessive agent and token consumption.
- Privilege escalation.
- Unapproved disclosure of private project information.
- Accidental replacement of established engineering standards.
 
An entry in this document represents evaluation or governance status, not installation, activation, successful execution, or security certification.
 
## 2. STATUS DEFINITIONS
 
**ESTABLISHED_STANDARD:** Adopted engineering principle or workflow; not necessarily an installed software package.
 
**PREVIOUSLY_OBSERVED:** Previously seen in project evidence; current installation and version require re-verification.
 
**CANDIDATE:** Identified for technical and security evaluation; not approved for automatic installation.
 
**APPROVED_PILOT:** Authorized for a specifically scoped, isolated evaluation.
 
**VERIFIED_INSTALLED:** Actual installation and version confirmed in the target environment.
 
**VERIFIED_OPERATIONAL:** Installation plus relevant behavior and security tests verified.
 
**DISABLED:** Must not be automatically activated.
 
**REJECTED:** Evaluated and excluded for a documented reason.
 
**UNKNOWN:** Current state has insufficient evidence.

Qualifiers such as HIGH PRIORITY, OPTIONAL, CATALOG and BY DEFAULT modify a defined status. They are not statuses and grant no authority.

The names in Section 13 are process stages, not statuses. A stage yields a status only when its evidence exists. DISCOVERED, SOURCE_REVIEWED and SECURITY_REVIEWED keep the status CANDIDATE (or UNKNOWN when evidence is insufficient). PILOT_AUTHORIZED is the stage at which the status APPROVED_PILOT is granted. VERIFIED_INSTALLED and VERIFIED_OPERATIONAL are both a stage and a status, with the same meaning. APPROVED_FOR_SCOPE is a scope-limited approval recorded in addition to VERIFIED_OPERATIONAL; it is not an installation status.
 
A tool must never be promoted to VERIFIED_INSTALLED or VERIFIED_OPERATIONAL based only on its documentation, popularity, GitHub stars, previous discussion, or appearance in this registry.
 
## 3. ESTABLISHED ENGINEERING STANDARDS
 
### 3.1 Code Architect: Zero-Hallucination
 
Category: Engineering correctness.
 
Status: ESTABLISHED_STANDARD.
 
Primary responsibility:
- Verify technical claims against real source code and official documentation.
- Avoid invented packages, APIs, versions and configuration.
- Separate confirmed facts from assumptions.
- Respect existing architecture and Git changes.
- Use evidence for implementation and completion claims.
 
Security: Foundational; does not replace sandbox enforcement.
 
Workflow ownership: Technical correctness and evidence standards.
 
### 3.2 UI/UX Pro Max
 
Source:
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
 
Category: UI/UX methodology.
 
Status: PREVIOUSLY_OBSERVED in APEXO project history; current installation must be rechecked.
 
Primary responsibility:
- Design-system coherence.
- Accessible user experiences.
- Interaction and responsive behavior.
- Typography, color and component quality.
- Platform-specific UI guidance.
 
Workflow ownership: UI/UX analysis.
 
Do not enable competing design instructions automatically.
 
### 3.3 REA — Reverse Engineer Anything
 
Source:
https://github.com/morluto/rea
 
Category: Competitor and product research.
 
Status: ESTABLISHED research approach; actual executable installation UNKNOWN.
 
Primary responsibility:
- Authorized competitor workflow observation.
- Evidence-based UI and interaction research.
- Behavioral documentation.
- Independent implementation using original code.
 
Do not copy protected source or circumvent access controls.
 
### 3.4 GitHub / Codex Engineering Rules
 
Category: Repository governance.
 
Status: ESTABLISHED_STANDARD.
 
Primary responsibility:
- Read AGENTS.md and relevant project documents.
- Verify branch, HEAD, Git status and repository identity.
- Preserve user modifications.
- Treat stage, commit and push as separate authorization gates; exact files are
  required for stage, and exact remote/branch are required for push.
- Avoid unauthorized Git operations, dependency installation and broad refactoring.
- Require real verification before declaring success.
 
Actual local hooks, skills, profiles and integrations: UNKNOWN until inspected.
 
## 4. PRIMARY ENGINEERING CANDIDATES
 
### 4.1 Superpowers
 
Source:
https://github.com/obra/superpowers
 
Category: Engineering workflow methodology.
 
Status: CANDIDATE — HIGH PRIORITY.
 
Primary capabilities:
- Systematic debugging.
- Test-driven development.
- Verification before completion.
- Focused code review.
- Plan execution and task decomposition.
- Optional subagent-oriented development.
 
Optional support role: debugging and TDD process, only when availability, compatibility and authorization are verified.
 
Conflicts:
- Automatic Git commit behavior.
- Uncontrolled worktree creation.
- Automatic dependency installation.
- Overlap with other planning frameworks.
- Excessive agent spawning.
 
Policy:
Use individual skills selectively. Never permit a skill instruction to override explicit Git, filesystem or user-approval boundaries.
 
### 4.2 GitHub Spec Kit
 
Source:
https://github.com/github/spec-kit
 
Category: Requirements and specification-driven development.
 
Status: CANDIDATE — HIGH PRIORITY.
 
Primary capabilities:
- Requirements.
- Specifications.
- Architecture planning.
- Acceptance criteria.
- Task decomposition.
 
Preferred role: Substantial new features and new-product planning.
 
Conflicts:
- Duplicate Superpowers planning.
- Unnecessary planning for trivial fixes.
- New documentation structures conflicting with existing roadmaps.
 
Policy:
Use as a planning specialist, not as a second competing implementation controller.
 
### 4.3 Context7
 
Source:
https://github.com/upstash/context7
 
Category: Documentation retrieval / MCP.
 
Status: CANDIDATE — HIGH PRIORITY.
 
Primary capabilities:
- Current library documentation.
- API usage examples.
- Version-aware technical reference discovery where supported.
 
Preferred role: Technical research.
 
Risks:
- Third-party data processing.
- Version mismatches.
- Incomplete or inaccurate retrieved content.
- MCP tool permissions.
 
Policy:
Use only for approved, sanitized documentation queries. Cross-check consequential claims against official references and installed package versions.
 
### 4.4 Anthropic Official Plugins
 
Source:
https://github.com/anthropics/claude-plugins-official
 
Category: First-party Claude ecosystem.
 
Status: CANDIDATE CATALOG.
 
Priority areas:
- Security Guidance.
- Claude Security.
- Claude Code Setup.
- Other role-relevant official tools.
 
Policy:
Inspect each plugin's files, executable hooks, MCP servers, permissions and data flows independently before activation.
 
Do not enable the full catalog.
 
### 4.5 OpenAI Official Plugins
 
Source:
https://github.com/openai/plugins
 
Category: First-party Codex ecosystem.
 
Status: CANDIDATE CATALOG.
 
Priority areas:
- Web application engineering.
- OpenAI API development.
- Relevant development and review workflows.
 
Policy:
Verify supported Codex surface, plugin version and actual IDE compatibility.
 
Claude Projects and Claude Code must not be assumed to execute Codex-specific plugins.
 
## 5. AI QUALITY AND EVALUATION
 
### Promptfoo
 
Source:
https://github.com/promptfoo/promptfoo
 
Category: AI quality evaluation and adversarial testing.
 
Status: CANDIDATE — HIGH PRIORITY FOR KOVAN AND AI FEATURES.
 
Primary responsibility:
- Prompt and model regression tests.
- Structured output verification.
- Prompt injection resilience.
- Safety behavior comparisons.
- Model and configuration evaluation.
 
Policy:
Start with synthetic, non-sensitive fixtures.
 
Never launch unreviewed attack plugins or send private test data to external providers without authorization.
 
AI quality test outcomes are separate from application security guarantees.
 
## 6. SECURITY ENGINEERING TOOLS
 
### Gitleaks
 
Source:
https://github.com/gitleaks/gitleaks
 
Purpose: Detect secrets in source and version-control history.
 
Status: CANDIDATE.
 
### OSV-Scanner
 
Source:
https://github.com/google/osv-scanner
 
Purpose: Detect known dependency vulnerabilities.
 
Status: CANDIDATE.
 
### Trivy
 
Source:
https://github.com/aquasecurity/trivy
 
Purpose: Dependency, configuration and container security scanning.
 
Status: CANDIDATE.
 
### Semgrep
 
Source:
https://github.com/semgrep/semgrep
 
Purpose: Targeted static code analysis.
 
Status: CANDIDATE.
 
### CodeQL
 
Source:
https://github.com/github/codeql
 
Purpose: Static and data-flow-oriented security analysis.
 
Status: CANDIDATE.
 
Constraint: Confirm supported languages, license and private-repository entitlements before adoption.
 
### RustSec / cargo-audit
 
Source:
https://github.com/RustSec/rustsec
 
Purpose: Rust dependency vulnerability detection.
 
Status: PREVIOUSLY_OBSERVED in APEXO development workflows; currently active configuration requires verification.
 
Policy for all security tools:
- Avoid duplicate scanning without measurable benefit.
- Record tool version and ruleset.
- Protect sensitive findings.
- Verify reported vulnerabilities rather than assuming all findings are exploitable.
- Use least privilege.
- Do not automatically modify dependencies or apply fixes.
 
## 7. UI, UX AND APPLICATION QUALITY TOOLS
 
### Playwright
 
Source:
https://github.com/microsoft/playwright
 
Purpose: Browser-based end-to-end and regression testing.
 
Status: CANDIDATE — HIGH PRIORITY.
 
### axe-core
 
Source:
https://github.com/dequelabs/axe-core
 
Purpose: Automated accessibility checks.
 
Status: CANDIDATE — HIGH PRIORITY.
 
### Lighthouse CI
 
Source:
https://github.com/GoogleChrome/lighthouse-ci
 
Purpose: Web performance and quality-budget checks.
 
Status: CANDIDATE.
 
### Storybook
 
Source:
https://github.com/storybookjs/storybook
 
Purpose: UI component isolation, documentation and testing.
 
Status: OPTIONAL CANDIDATE.
 
### StrykerJS
 
Source:
https://github.com/stryker-mutator/stryker-js
 
Purpose: Mutation testing for critical JavaScript and TypeScript logic.
 
Status: OPTIONAL CANDIDATE.
 
Policy:
Preserve the existing UI technology and testing architecture. Install only missing capabilities after a demonstrated need.
 
## 8. DEPENDENCY AND CI GOVERNANCE
 
### Renovate
 
Source:
https://github.com/renovatebot/renovate
 
Purpose: Controlled dependency update proposals.
 
Status: OPTIONAL CANDIDATE.
 
Policy:
Do not automatically merge or deploy dependency updates.
 
### actionlint
 
Source:
https://github.com/rhysd/actionlint
 
Purpose: GitHub Actions workflow linting.
 
Status: CANDIDATE.
 
Policy:
Use applicable CI checks without changing existing branch-protection or release authority.
 
## 9. ADVANCED OR OPTIONAL FRAMEWORKS
 
### BMad Method
 
Source:
https://github.com/bmad-code-org/bmad-method
 
Purpose: Structured product and multi-role development methodology.
 
Status: DISABLED BY DEFAULT.
 
Reason:
Potential overlap with Spec Kit and Superpowers.
 
Reconsider for a separate new-product pilot with a documented need.
 
### Caveman
 
Source:
https://github.com/JuliusBrussee/caveman
 
Purpose: Concise responses, context compression, optional model routing and token optimization.
 
Status: DISABLED BY DEFAULT.
 
Risks:
- Lossy content transformations.
- Sensitive local recovery stores.
- Third-party telemetry and optional cloud routing.
- Hook configuration.
- Possible distortion of test evidence or numerical values.
 
Policy:
Do not activate proxy, cloud routing, automatic context compression, or global hooks without isolated evaluation.
 
Preserve exact source, identifiers, security evidence and numerical results.
 
### OmniRoute
 
Source:
https://github.com/cheaper-inference/OmniRoute
 
Purpose: Multi-provider AI gateway and model routing.
 
Status: DISABLED BY DEFAULT.
 
Risks:
- Credential storage.
- Provider authentication.
- Proxy exposure.
- Cross-provider data transfer.
- Fallback and tool-compatibility differences.
- Compression overlap with Caveman.
 
Policy:
Consider only when a real multi-provider requirement exists.
 
Never use as a replacement for KOVAN's own authorization and security enforcement.
 
## 10. ADDITIONAL CATALOGUED RESOURCES
 
The following were previously discussed as potential resources, not verified installations:
 
- addyosmani/agent-skills — engineering guidance and reusable skills.
- apify/apify-mcp-server — authorized web research and automation.
- blader/humanizer — language refinement.
- nateherkai/scroll-craft — scroll-based UI design reference.
- heygen-com/hyperframes — programmatic video and motion content.
 
Each requires separate suitability, license, security and maintenance evaluation before adoption.
 
These are not required for the primary software engineering workflow.
 
## 11. SKILL CONFLICT MATRIX
 
Use the following ownership rules:
 
| Function | Primary owner | Optional support | Avoid |
|---|---|---|---|
| Requirements | 7ALLAB Product Planner | Spec Kit | Duplicate planning documents |
| Architecture | Software Architect | Official docs, Context7 | Unverified architectural claims |
| Implementation | Implementation Engineer | Superpowers | Competing auto-implementers |
| Debugging | Implementation Engineer | Superpowers systematic debugging (when verified), QA | Guess-based edits |
| Technical sources | Code Architect standard | Context7 | Invented APIs |
| UI/UX | UI/UX Pro Max | Playwright, axe | Competing design systems |
| Security | Security policy and dedicated reviewer | Gitleaks, OSV, Trivy, Semgrep | AI opinion treated as proof |
| AI quality | Project acceptance suite | Promptfoo | Benchmark scores without quality checks |
| Research | Research Engineer | REA and authorized sources | Unverified reproduction claims |
| Git/release | Project Git rules and human authorization | Release & Evidence Reviewer | Automatic unauthorized push |
| Model routing | Existing provider setup | OmniRoute pilot | Unreviewed gateway chaining |
| Compression | Default off for critical evidence | Caveman pilot | Double lossy compression |
 
A tool may support multiple tasks, but only one designated workflow owns a phase.
 
## 12. EXTERNAL TOOL SECURITY REVIEW
 
Before authorizing installation or activation, verify:
 
1. Official source repository and ownership.
2. Exact version, commit or release.
3. License and commercial-use conditions.
4. Maintainer activity and relevant unresolved issues.
5. Installation scripts and dependency tree.
6. Executable hooks, postinstall commands and background processes.
7. Filesystem access.
8. Network destinations.
9. Credentials and secrets access.
10. Data collection, telemetry and retention.
11. MCP permissions and tool-call boundaries.
12. Conflict with established skills and agent configuration.
13. Rollback and uninstall behavior.
14. Actual compatibility with Windows, Codex and Claude where applicable.
15. Relevant test evidence.
 
User approval is required for installation and material security or configuration changes.
 
## 13. ACTIVATION PROCESS
 
A candidate should move through these stages (mapped to statuses in Section 2):
 
DISCOVERED
→ SOURCE_REVIEWED
→ SECURITY_REVIEWED
→ PILOT_AUTHORIZED
→ VERIFIED_INSTALLED
→ VERIFIED_OPERATIONAL
→ APPROVED_FOR_SCOPE
 
Reject or disable the tool when:
 
- A material security condition cannot be satisfied.
- Installation changes unauthorized files.
- Permissions exceed the justified task scope.
- It duplicates an existing capability without meaningful value.
- Tests or critical compatibility checks fail.
- Privacy or licensing conditions are unacceptable.
- Rollback is unreliable.
 
Document each status transition with evidence.
 
## 14. PLATFORM COMPATIBILITY
 
### Claude Projects
 
Supports project-specific instructions, context and supported cloud workflows.
 
A context document does not automatically install a native Claude Code skill or hook.
 
### Claude Code
 
Supports skills, agents, settings, tool permissions, plugins and hooks according to its installed version and environment.
 
Every integration must be verified in the actual installation.

First-pilot scope: only project definitions under
`C:\Projeler\7allab-engineering-office\.claude\agents` and `...\.claude\skills`
(hooks, settings, MCP configuration and plugins are separate categories; see
Engineering Charter Section 12). User-global installation,
replacement of the observed account-synced Director and Agent Teams are
deferred. The main session is Director; eight specialist agents omit Agent.
 
### ChatGPT Projects
 
Supports its own project context and instructions.
 
Do not assume Claude plugins can run inside ChatGPT.
 
### OpenAI Codex
 
Supports native instruction and skill mechanisms, with plugin availability dependent on the product surface.
 
Do not assume Codex CLI and VS Code integrations behave identically.
 
### GitHub
 
Provides version control and collaborative review where properly connected.
 
A GitHub connection does not imply unrestricted write, merge or deployment authority.
 
## 15. PROJECT ADOPTION ORDER
 
**Stage A: Shared engineering policy and tool registry.**
 
**Stage B: Read-only environment inventory.**
 
**Stage C: Isolated development workflow pilot.**
 
**Stage D: Relevant security and quality tools.**
 
**Stage E: KOVAN, APEXO, LIFEACTA and 7ALLAB Web project-specific adoption.**
 
**Stage F: Measured optimization and optional advanced tools.**
 
Do not install all tools simultaneously.
 
Do not interrupt ongoing high-risk verification work.
 
## 16. CURRENT INITIAL STATUS
 
Ratification update (2026-10-27, decision D4): the Core Operating Instructions, Engineering Charter, Agent Roles & Handoff Protocol, this Tool Registry and the Assignment Matrix were ratified by the project owner as version 1.1.1. The first four entries below record their state at reconciliation and are superseded by this update. The remaining entries are unchanged: ratification installs, enables and authorizes nothing.

At reconciliation on 2026-10-27:
 
- Core Engineering Instructions: Recovered; reconciled candidate awaits ratification.
- Engineering Charter: Recovered; reconciled candidate awaits ratification.
- Agent Roles & Handoff Protocol: Recovered; reconciled candidate awaits ratification.
- Tool Registry: Recovered; reconciled candidate awaits ratification.
- Actual installed Claude plugins: UNKNOWN.
- Engineering Director skill package v1.2.3: observed in Claude account-sync cache; invocation NOT TESTED.
- Project-scoped Engineering Director skill package (not a subagent; the Director role itself is the main session): NOT INSTALLED pending eval gate.
- Actual installed MCP servers: UNKNOWN.
- Current local Codex configuration: UNKNOWN.
- Current GitHub repo permissions: UNKNOWN.
- Current KOVAN worktree state: NOT REVERIFIED.
- New third-party tools authorized by this document: NONE.
 
The next operational task is ratification of the reconciled governance set,
followed by the v1.2.3 synthetic eval gate before project-scoped installation.
 
---
 
**7ALLAB Tool Governance Principle**
 
*Use the smallest verified toolset that delivers the required engineering quality. No unauthorized activation. No duplicate ownership. No security regression. No unverified completion claim.*
