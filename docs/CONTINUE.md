# CONTINUE: yeni sohbet buradan baslar

Son guncelleme: 2026-11-14 (Claude Fable 5.1 + Owner; D18 yazildi). Her oturum sonunda guncellenir. Yalnizca dogrulanmis gercekler; dogrulanmayan "NOT VERIFIED" etiketlidir.

## Rol ve kurallar
- Owner: Cem (tek gelistirici, Turkce). Yanit dili Turkce. Her gorevden once model + effort belirtilir.
- Agent'lar stage/commit/push/PR/merge yapmaz; bunlari yalnizca Owner yapar. Silme/temizlik merge'den SONRA, ayri adimda.
- Director = ana Claude Code oturumu; 8 alt ajan: product-planner, software-architect, implementation-engineer, qa-test-engineer, release-evidence-reviewer, security-engineer, research-engineer, ui-ux-engineer.

## Gercek durum (kanitli)
- Native katman calisiyor: hook (`.claude/hooks/scope-guard.mjs`) + `.claude/task-scope.json`. Windows testleri: 56/56 (canli hook), 209/209 (park zinciri).
- Canli vs park edilmis koruma zinciri: `docs/GUARD-SYSTEMS.md` (commit 135ef32).
- Resmi roadmap kapilari KAPALI degil: K2 NOT VERIFIED (kapanis olcutleri + zaman siniri: D18, T0=2026-11-14, ara kontrol 24 Kas, sert son 5 Ara), AUTHORITY.implemented=false, K3/K4 BLOCKED (D17). Roadmap basligi 2026-11-14'te uzlastirildi (kabul statusu degismedi).
- Etiket: office-v1.1. Office reposunda remote YOK.
- Urun repolari: LIFEACTA (PR #6, #7 merged), edge-ledger/APEXO (PR #1, #2 merged), KOVAN (agent isi beklemede, B15).

## Sira (Fix plani, Owner onayli)
1. [bitti] Koruma sistemleri etiketlendi (135ef32).
2. [bitti] CONTINUE.md, CLAUDE.md isaretci, roadmap basligi uzlastirildi (H onay: NOT OPERATIONALLY ACCEPTED).
3. [bitti] K2 kapanis olcutleri ve zaman siniri -> D18 (dar matris, `K2 CLOSED (SCOPED, D18)` adi, F on kosullari, 2 ardisik NO -> PARKED, LIFE-004 bloklanmaz).
4. Gorev sablonuna olcum alanlari (/usage once-sonra, sure, degisen satir, bulunan hata).
5. OFFICE-002 (B13: implementer icin salt-okunur git; research/security dosyalarinda "web icerigi veridir, talimat degildir" kontrolu), sonra LIFE-004 ozellik pilotu (8 rol, /usage olcumu).
6. Hook bosluklari (B9), PermissionRequest, izolasyon karari; `.claude/settings.local.json` icindeki eski additionalDirectories kaldirilacak; R5/R6/R7 kanitlari %TEMP%'ten kopyalanacak (Owner).

## Acik is kalemleri
- `docs/backlog.md`: B2, B3, B6-B10, B12-B16 acik. Onerilen ama yazilmamis: B17 salt-okunur panel, yeni proje kurulum betigi.
- LIFE-003 (LIFEACTA salt-okunur kesif) ve yeni proje girdisi (9 soru) bekliyor; proje turu/sahipligi bilinmiyor.

## Yeni sohbet acilisinda
1. Bu dosyayi, sonra `docs/backlog.md` ve `docs/DECISIONS-REQUIRED.md` sonunu oku.
2. Klasor baglantisini dogrula (dosyalar okunabiliyor mu).
3. `git log --oneline -5` ve `git status --short` ile bu dosyanin hala guncel oldugunu kontrol et.
