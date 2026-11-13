# Office backlog (pilot LIFE-001 sonrasi, 2026-11-13)
Kural: buradaki maddeler bir sonraki urun PR'indan once yapilmaz, yalnizca Owner onceliklendirir.

- B1 [YAPILDI] Ajan kurallarina "git -C / cd / mutlak yol kullanma" satiri eklendi.
- B2 localeCompare yerine kod noktasi karsilastirmasi: lifeacta app/records.js ve app/reminders.js (yerel ayara duyarli siralama).
- B3 Reviewer modeli (Opus) dusuk riskli gorevlerde Sonnet'e inebilir mi? Karar icin gercek /usage rakamlari lazim; her kosuda once/sonra yuzdesini kaydet.
- B4 LIFEACTA adaylari: C1 (app/ocr.js Number(null) -> 0) sirada; C3, C4, C5 ertelendi/elendi (docs/tasks/LIFE-000.md, yerel).
- B5 APEXO: git yok, lisans/anahtar klasorleri var. Ajan calismasindan once git'e alma ve gizli dosya sinirlari netlesmeli. KOVAN henuz incelenmedi.
- B6 C:\Projeler altindaki ~24 eski pilot cikti/sandbox klasorunu arsivle veya sil (Owner karari).
- B7 lifeacta uzak deposunda 4 eski dal var (chore/v0.3-release-readiness, docs/v0.3-release-record, feature/v0.2.2-records-ux, fix/v0.3-ocr-cancellation); Owner temizler.
- B8 Eski klasor kopyalari (Projelerim\lifeacta, Codex lifeacta-v0.3-final, Desktop lifeacta_fix vb.) tek gercek kaynak = lifeacta-work; eskileri arsivle.
- B9: Product sessions must have no write-capable MCP, or the scope-guard hook must be extended to MCP tools (the hook does not see MCP tools). desktop-commander confirmed disabled on 2026-11-13 (/mcp menu showed Enable).
- B10: extractOcrCandidates in lifeacta app/ocr.js still coerces [] to 0 and true to 1 (outside LIFE-002 scope).
- LIFE-002 done: lifeacta PR #7 merged (0c6c4ab). Chain worked, scope-guard denied the out-of-scope write, git -C denial count stayed 3 (cwd rule effective).
- B5 correction (2026-11-13): the real APEXO source is edge-ledger (C:\Users\crypt\Projelerim\edge-ledger, remote github.com/7allab/edge-ledger, branch master) and it IS under git. The git-less folders (Desktop\CEXO\APEXO, Desktop\APEX) hold notes only. Agent work runs in the fresh clone C:\Projeler\apexo-work (local-only Office install, rules in its docs/tasks/_OFFICE-RULES.md). apex (live MEXC trading, cryptogemo/ApexSmartTrading) stays out of agent scope. KOVAN still not inspected.
- B11 (Owner): OneDrive Desktop\APEX holds files named like ClaudeAPI*.txt, MEXC.txt and an e-Devlet backup-code image. Check them for API keys or backup codes, move out of OneDrive, rotate if needed. Also confirm the token-like test value at edge-ledger src-tauri/src/whale_tracker.rs:90 is fake.
- B12: edge-ledger npm shows 38 vulnerabilities (2 critical). package.json and lockfiles are agent no-touch; handle as a separate Owner-approved task, never npm audit fix --force.
- B13: implementation-engineer cannot run git diff (allowlist); add a line to its agent file to use Read instead and leave diffs to the reviewer. Allow npx tsc -b for qa/implementation in the hook only if a task needs type checks.
- APEXO-000 done: read-only discovery, 5 candidates (apexo-work docs/tasks/APEXO-000.md). #1 done as APEXO-001. #2 zero volume in coinResearch/scamCheck is next. #4 CSV formula escaping needs a security review.
- APEXO-001 done: edge-ledger PR #1 merged (b37b476). Chain passed, out-of-scope write denied for the subagent, git -C count 0.
- B5 update (2026-11-13): KOVAN inspected read-only. GitHub 7allab/KOVAN: main=ac3ad2b (v0.3.7) plus 5 unmerged branches (v0.3.8-offline-evaluator 8567d32, kvn-ai-001a-provider-contract 6d4f2d3, release-tool-freeze/v0.3.8 e9c7ab4, chore/release-tool-product 7dacd24, chore/owner-managed-k0-policy 3ba006c); nothing merged since v0.3.7. Developed with Codex/ChatGPT under Documents\Codex. Name-only secret scans clean; one PRIVATE KEY marker string in test/plan-only-release.test.mjs to be confirmed as a test string. Tests: npm test = node --test. Security-core project with its own 25-rule AGENTS.md.
- B14: KOVAN offline-evaluator clone holds 5 untracked in-flight files (OFFICIAL_RELEASE_CONTRACT.md, 3 official-release scripts, 1 test), not on GitHub; Owner/Codex should commit them. Stale git worktrees under AppData\Local\Temp (kovan-step70*, kovan-ai001a*) and old v0.3.4 copies on Desktop/OneDrive/Projelerim are clutter.
- B15: KOVAN agent work on hold until the Owner picks the integration branch and the in-flight Codex work is committed. Later role for Office: read-only independent security review (security-engineer, Opus), not implementation.
- B11 closed 2026-11-13: Owner checked the OneDrive APEX files, no keys or backup codes found.
- APEXO-002 done 2026-11-13: edge-ledger PR #2 merged (4f85246). finiteOrNull in src/ai/coinResearch.ts keeps a genuine 0 for priceChangePercent24h, volume24h, quoteVolume24h so the very-low-volume flag in scamCheck.ts can fire; lastPrice/highPrice24h/lowPrice24h intentionally unchanged. 7 new tests (2 red before fix, independently reproduced by Owner). Full suite 342 files / 3425 tests, tsc 0, lint 0 errors / 9 warnings (baseline). Remaining APEXO-000 candidates: #3 ttlCache.clear in-flight (theoretical), #4 CSV -1e-8 escaping (needs security review), #5 optimizer grid-size check (weakest).
- B10 update: finiteOrNull in edge-ledger also maps ' ', true and [] to 0 or 1 (same pattern as extractOcrCandidates). No practical risk (Binance sends numeric strings), not fixed.
- B16: edge-ledger test run prints a Dexie 'IndexedDB API missing' log line in the Node test env; tests still pass. Not checked whether it is also in the baseline run.
- KOVAN check closed 2026-11-13: test/plan-only-release.test.mjs:64 PRIVATE KEY marker is a synthetic test string ('synthetic-only').
