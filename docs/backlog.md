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
