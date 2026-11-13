# Koruma sistemleri: hangisi canli, hangisi park edilmis

Tarih: 2026-11-14. Karar: Owner "A onay" (yerinde etiketle, tasima yok). Kayit: Claude Sonnet 5.5 + Owner.
Durum etiketleri: K2 NOT VERIFIED, AUTHORITY.implemented=false, K3/K4 BLOCKED (bkz. D17). Bu belge hicbir kabul degistirmez.

## 1. CANLI (Claude Code hook'u olarak calisiyor)
- `.claude/settings.json` -> PreToolUse (Write|Edit|NotebookEdit|Bash|PowerShell) -> `.claude/hooks/scope-guard.mjs`
- `scope-guard.mjs`, `scripts/guard-scope.mjs` dosyasindan `classifyPath` fonksiyonunu ice aktarir. Yani `guard-scope.mjs` CANLI bagimliliktir.
- Testler: `test/scope-guard.test.mjs`, `test/guard-scope.test.mjs`, `test/new-task.test.mjs`
- Windows'ta 2026-11-14 kosusu (Owner): 56 test, 56 gecti, 0 kaldi.

## 2. PARK EDILMIS (settings.json'a BAGLI DEGIL)
- `scripts/guard.mjs`, `scripts/authority-grant.mjs`, `scripts/identity-gate.mjs`, `scripts/decision-gate-event-adapter.mjs`, `scripts/validate-director-decision.mjs`
- Testler: `test/authority-grant.test.mjs`, `test/identity-gate.test.mjs`, `test/decision-gate-event-adapter.test.mjs`, `test/director-decision-gate.test.mjs`; ayrica `test/guard.test.mjs.prototype` ve `test/guard.v2.test.mjs.prototype` (kosulmaz)
- Bu zincir birbirine, K2/P4/ADIM_54_55/O4-NC belgelerine ve testlere referans verir; hicbir uretim giris noktasi onu cagirmaz (authority-grant.mjs kendi yorumunda da boyle der).
- Windows'ta 2026-11-14 kosusu (Owner): 209 test, 209 gecti, 0 kaldi. Bu, zincirin kendi testlerinin gectigini gosterir; zincirin calisma zamaninda etkin oldugunu GOSTERMEZ.

## 3. Kurallar
- Park edilmis dosyalari TASIMA ve SILME: K2/P4 kanit belgeleri ve SHA-256 manifestleri bu yollara dayanir. Tasima icin ayri Owner karari gerekir.
- `scripts/guard-scope.mjs` degisirse canli hook etkilenir: degisiklikten sonra BOTH test gruplari (bolum 1 ve 2) calistirilir.
- Park edilmis zincir baglanacaksa bu ayri bir karar ve ayri bir kabul gerektirir (K2 hatti).

## 4. Bilinen bosluklar (canli hook)
- Hook MCP araclarini, Read/Grep'i ve WebFetch/WebSearch'u gormez (backlog B9).
- PermissionRequest denetimi yoktur.
