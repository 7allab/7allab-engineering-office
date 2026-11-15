# 7ALLAB klasor duzeni (2026-11-15)

Owner kaydi 2026-11-15, [OWNER, Claude chat] kosulari; Windows PowerShell 5.1.
Durum: Dalga 1 ve 2 uygulandi, Dalga 3 acik.

## A. Aktif yollar

| Yeni yol | Eski yol | Not |
|---|---|---|
| C:\Projeler\7allab-engineering-office | (degismedi) | Yol sabit: test/decision-gate-event-adapter.test.mjs ROOT, inventory/source-manifest.json canonicalTarget, governance belgeleri; TASINMAZ |
| C:\Projeler\Products\APEXO\apexo-work | C:\Projeler\apexo-work | remote github.com/7allab/edge-ledger; HEAD 4f85246 master |
| C:\Projeler\Products\LIFEACTA\lifeacta-work | C:\Projeler\lifeacta-work | remote github.com/7allab/lifeacta; HEAD 0c6c4ab main |
| C:\Projeler\Products\Web\7allab-site | C:\Users\crypt\Projelerim\7allab-site | HEAD ac6c229 feature/7allab-corporate-home-v2 |
| C:\Projeler\Products\Web\sirket-sitesi | C:\Projeler\sirket-sitesi | git yok, uzak yedek yok |
| C:\Projeler\Products\KOVAN\kovan-v0.3.4-preview | C:\Users\crypt\Projelerim\kovan-v0.3.4-preview | git yok |
| C:\Projeler\Products\KOVAN\KOVAN-v0.3.8-SECOND-DEVICE-EVIDENCE | C:\Users\crypt\KOVAN-v0.3.8-SECOND-DEVICE-EVIDENCE | git yok |

## B. Yerinde kalanlar

| Yol | Neden |
|---|---|
| C:\Projeler\7allab-engineering-office-backups, C:\Projeler\7allab-engineering-office-releases, C:\Projeler\7allab-eval-1214, C:\Projeler\7allab-probe-p | Depo belgelerinde adi geciyor; probe-p ve eval-1214 icin Claude Code oturum klasoru var |
| C:\evidence, C:\7allab-sandbox-io, C:\Users\crypt\k2-05-e-test, C:\Users\crypt\k2-05d-live-check, C:\Users\crypt\7allab-k2-production-staging-20261030 | Belgelerde yol olarak geciyor |
| C:\7allab-agent-work | Tasima "Yola erisim engellendi" ile basarisiz, icinde k2-e2-access-probe.ps1; ACL degistirilmedi, yerinde |
| C:\Users\crypt\Projelerim\edge-ledger ve C:\Users\crypt\Projelerim\lifeacta | Eski kopyalar; edge-ledger .env iceriyor, lifeacta'nin worktree'si C:/Users/crypt/Documents/Codex/2026-10-20/.../lifeacta-v0.3-final altinda; Dalga 3 karari acik |
| Eski APEX (C:\apex, Projelerim\apex, apex-desktop, apex-mobile), Projelerim\ibgateway, nssm-2.24 | Windows hizmetleri APEX-API ve APEX-Orkestrator nssm.exe'ye bagli, Stopped/Disabled; Office projesi degil |

## C. Evidence

| Oge | Kayit |
|---|---|
| C:\Projeler\Evidence altinda 28 klasor (7allab-k2-outbox, sandbox-*, security-pilot-export/live-export/payload, acl-backup, f1, g1a, g1c, k2-d2c) | Depo belgelerinde adlari gecmeyenler, git grep ile dogrulandi |
| C:\Projeler\_moves\wave1-20261115-024722.csv | 32 oge |
| C:\Projeler\_moves\wave2-20261115-024940.csv | 2 oge |

Geri alma: C:\Projeler\_moves\move7allab.ps1 -Wave N -Undo.

## Kurallar

1. Tarihsel belgeler eski yollari icerir ve DEGISTIRILMEZ (SHA-256 manifestleri); eski yol -> yeni yol icin bu tablo kullanilir.
2. Yeni oturumlar urun repolarini yeni yoldan acar; eski Claude Code oturum klasorleri (C--Projeler-apexo-work, C--Projeler-lifeacta-work) diskte durur, yeni yolda yeni oturum baslar; oturum klasorunu yeniden adlandirmanin calisip calismadigi UNKNOWN, denenmedi.
3. apexo-work ilk Tauri derlemesi (src-tauri) yol degistigi icin yavas olabilir [NOT TESTED].
4. Office dokumanlari ve testler C:\Projeler\7allab-engineering-office yoluna bagli; Office tasinmaz.

## Acik

Dalga 3 (eski edge-ledger ve lifeacta kopyalari: gonderilmemis dal/commit var mi, .env, worktree repair) Owner karari; `git remote` kimlik bilgisi maskeli okundu.
