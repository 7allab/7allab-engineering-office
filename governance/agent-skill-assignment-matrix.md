# 7ALLAB SOFTWARE — Agent & Skill Assignment Matrix
 
**Document ID:** 7ALLAB-AGENT-SKILL-001  
**Version:** 1.1.1  
**Status:** Ratified Operational Mapping (project owner decision D4, 2026-10-27)  
**Scope:** Claude AI Engineering Office
**Execution Model:** Engineering Director in the main Claude Code session plus eight project-scoped specialist agents.
 
## 1. Purpose
 
Coordinate installed Engineering, Product Management, Design and Figma skills without duplicated workflow ownership, unauthorized execution or unnecessary context usage.
 
This matrix supplements the Engineering Charter and Agent Collaboration Protocol.
 
A listed skill is not an independent agent. A visible skill menu entry does not prove that its tools, MCP dependencies or external accounts are operational.
 
## 2. Primary Responsibilities
 
| Specialist | Primary Skills | Supporting Skills |
|---|---|---|
| Engineering Director (main session, coordinator; not a specialist agent) | roadmap-update, standup | stakeholder-update |
| Product Planner | write-spec, sprint-planning | product-brainstorming, synthesize-research |
| Software Architect | architecture, system-design | documentation, tech-debt |
| Implementation Engineer | debug | code-review, selective Superpowers when verified |
| Security Engineer | Project security policy | Authorized security review and scanners |
| QA & Test Engineer | testing-strategy, code-review | accessibility-review, applicable test tools |
| UI/UX Engineer | design-system, design-critique | design-handoff, ux-copy, Figma |
| Research Engineer | synthesize-research, research-synthesis | competitive-brief, user-research |
| Release & Evidence Reviewer | deploy-checklist, code-review | Actual Git, test and security evidence |
 
The Engineering Director is the main-session coordinator, not a department
agent. The other eight rows are specialist-agent candidates. Roles remain
logical responsibilities unless separate agents have actually been launched
and verified. Listed skills retain the registry status actually established for
them; this matrix does not mark them installed or operational.
 
## 3. Figma Specialization
 
Use Figma only when actual design context or an approved design-writing task makes it relevant.
 
**Design-to-code**
- figma-design-to-code
- figma-code-connect
- figma-code-workflows
 
**Design and specification**
- figma-spec
- figma-generate-diagram
 
**Design creation and libraries**
- figma-create-new-file
- figma-generate-design
- figma-generate-library
 
**Programmatic Figma operations**
- figma-use
- figma-use-figjam
- figma-generative-plugins
 
**Motion and specialized output**
- figma-implement-motion
- figma-use-motion
- figma-shaders
- figma-swiftui
- figma-use-slides
 
Figma write operations require separate authorization. Do not modify shared design libraries or create files without approval.
 
Prefer read-only design inspection before proposing implementation. Preserve existing components, design tokens, and the target application's established technology.
 
## 4. Conflict Prevention
 
- Product Management owns product requirements.
- Engineering owns technical design and implementation workflow.
- Design owns UI/UX assessment.
- Figma owns Figma-specific file and design-tool workflows.
- QA owns independent verification.
- Security review remains independent from implementation approval.
- The Engineering Director coordinates but does not override permissions.
 
Do not run Product Management brainstorming and Superpowers brainstorming as competing mandatory processes.
 
Do not regenerate product specifications when an approved current specification already exists.
 
Do not invoke Figma for ordinary source-code work that does not involve Figma.
 
Do not allow code-review skill output to replace actual test execution.
 
Do not automatically load all skills for every task.
 
## 5. Project Routing
 
**KOVAN:** Engineering, Security and QA first. Preserve permission contracts and exact evidence.
 
**APEXO:** Engineering, Security and QA first. Use Design/Figma only for authorized UI work. APEXO is a read-only trading terminal that does not execute orders: preserve read-only trading and financial precision, and do not introduce order execution (Engineering Charter Section 11). Credential handling and exchange connectors require Security Engineer review.
 
**LIFEACTA:** Product Management, Engineering, Security, QA and Design. Prioritize date correctness, privacy and real-device validation.
 
**7ALLAB Web:** Design, Engineering and QA. Use Figma only when a relevant design file or approved design task exists.
 
## 6. Activation Rules
 
Before invoking a skill or connected tool:
 
1. Verify the current task requires it.
2. Confirm the skill is actually available.
3. Identify external services or MCP prerequisites.
4. Check data sensitivity and permissions.
5. Use the smallest relevant workflow.
6. Report actual results and limitations.
 
Never install, connect, activate, or modify tools because they appear in this document.

For Git operations, `stage`, `commit` and `push` are separate permission gates.
For the first pilot, installation is limited to this repo's `.claude/skills/`
and `.claude/agents/` (hooks, settings, MCP configuration and plugins are
separate categories; Engineering Charter Section 12); the Director stays in the
main session and specialist
agents do not receive the Agent tool. Global scope and Agent Teams are deferred.
 
## 7. Current Verification Status
 
Engineering: 10 skill names observed in Claude UI.
 
Product Management: 8 skill names observed.
 
Design: 7 skill names observed.
 
Figma: 16 skill names observed.
 
Total: 41 observed skill names.
 
Individual skill execution: NOT TESTED.
 
Figma account/MCP write permission: NOT VERIFIED.
 
Superpowers, Spec Kit, Context7 and other external development tools: NOT VERIFIED INSTALLED in this Claude Project.
 
## 8. Next Validation
 
Perform a strictly read-only pilot of one existing Engineering or Product Management skill.
 
Verify expected instructions, actual tool behavior, evidence quality and permission compliance before broader adoption.
 
## 9. Competency Ownership (D6-1)

Added by Change ID K1-03-C-COMPETENCY-OWNERS (2026-10-29) on the basis of D6 (RATIFIED 2026-10-29, `docs/DECISIONS-REQUIRED.md`) and the project owner's decision of 2026-10-29. D6-1 binds four additional competencies to existing specialists. Each competency is a procedure used by its named primary owner. It is not an agent, not a role, not a continuously running service, and it does not extend the "Owns" lists of Agent Roles & Handoff Protocol Section 3.

| Competency | Primary owner (one) | Independent review / verification |
|---|---|---|
| Release Engineering | Implementation Engineer | Release & Evidence Reviewer (independent review) |
| Operations & Reliability | Software Architect | QA & Test Engineer verifies; Release & Evidence Reviewer when rollback or delivery readiness is involved |
| Product Marketing & Support | Product Planner | Research Engineer verifies sources; Release & Evidence Reviewer verifies claims about delivered behavior |
| Product Analytics | Product Planner | Security Engineer for data security; QA & Test Engineer for event verification |

Rules:

- Each competency has exactly one primary owner. The owner does not review or verify its own output for that task; the reviewers above are independent of the owner.
- The Engineering Director count stays one and the specialist count stays eight. ROLE_SELECTED does not imply AGENT_DISPATCHED. A simulated role is recorded as simulated and is not independent execution.
- Any tool set proposed for a role is a design proposal, not a runtime permission.
- Planning, code changes, test execution, installation, Git operations, network access and external data transfer remain separate authorization categories. The default external data transfer is `NONE`. This section grants none of them.
- The Agent Roles & Handoff Protocol independent-review rule for HIGH-risk tasks (Section 6.1) is unchanged. No additional mandatory reviewer, second architect or human-review rule is added.
- Publishing, deployment and external publication remain separate human authorizations.
- Claude Desktop may propose roadmap changes. The local Director records them only when authorized.
- This section does not install, enable or verify any skill, agent or hook.

## 10. Revision Record

- Change ID K1-03-C-COMPETENCY-OWNERS, 2026-10-29, applied to the Assignment Matrix only. The version label remains 1.1.1 (one consistent version across the five governance documents, as in earlier Change IDs); this Change ID identifies the content difference. Status remains Ratified.
- Decision source: D6-1 (RATIFIED 2026-10-29, `docs/DECISIONS-REQUIRED.md`) and the project owner's decision of 2026-10-29 to record the competency ownership in this Matrix (K1-03-B option A). The decision covers only the four competency ownership mappings in Section 9.
- Reason: D6-1 binds four competencies to existing specialists and leaves the ownership mapping to the Matrix.
- Changes: new Sections 9 and 10 only; Sections 1 to 8 are unchanged.
- Affected roles: Implementation Engineer, Software Architect and Product Planner (primary owners); Release & Evidence Reviewer, QA & Test Engineer, Research Engineer and Security Engineer (reviewers).
- Compatibility: no permission, gate, state model, role definition or independent-review rule is changed; the specialist set remains eight; no agent is created.
**Operating principle:** One responsible specialist, one primary workflow, minimal permissions, independently verified output.
