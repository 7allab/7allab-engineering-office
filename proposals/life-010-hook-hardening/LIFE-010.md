# TASK LIFE-010 - Ofis katmani (hook) sertlestirme onerisi

Status: PROPOSAL READY - TUR 2 (Owner karari bekliyor; guncel durum "Tur 2" bolumunde)        Branch: main (git disi dosyalar)        Opened: 2026-11-15

## Goal and acceptance criteria
1. Office tabani (BASE-office-scope-guard.mjs.txt) uzerine G1-G10 bosluklarini Owner kararlarina (E1-E7) gore kapatan bir hook onerisi; TABANA gore diff.
2. Tum ciktilar docs/tasks/LIFE-010-proposed/ altinda tam dosya; .claude/, AGENTS.md, CLAUDE.md, scripts/ DEGISMEZ.
3. Testler staged kopyaya karsi calisir; gercek .claude/hook'a degil.
4. Commit/push yok; `git status --short` bos kalir.

## Approved scope
- allow: docs/tasks/LIFE-010.md, docs/tasks/LIFE-010-proposed/        expires: 2026-11-22T23:59:59Z (`.claude/task-scope.json`, Director Read ile dogruladi)

## Plan
- [x] Kesif (Director, salt okunur)   - [x] Tasarim (Owner kararlari E1-E7)   - [x] Yazma (Director run)   - [x] Security (post-code)   - [ ] UI (N/A)   - [x] QA run   - [x] Review   - [ ] Owner
- Tur 2: [x] Yazma F1-F9 (Director run)   - [ ] Security kod oncesi (NOT RUN, sapma)   - [x] Security kod sonrasi (delta)   - [x] QA run (391, sonra 393)   - [x] Review   - [ ] Owner
- Tur 2 son hash'ler (reviewer sonrasi degisenler): scope-guard.test.mjs 74d8880fe4fef3bd (427 satir), mutation-check.mjs d7169c51f7ef315e (76), AGENTS.patch.md e70ece22418010f7 (38). Hook degismedi: 67e744afbef2b048.

## Dosyalar (docs/tasks/LIFE-010-proposed/) - TUR 1 durumu; guncel hash'ler "Tur 2" bolumunde
| Dosya | Hedef | SHA-256 (ilk 16) | Not |
|---|---|---|---|
| dot-claude/hooks/scope-guard.mjs | .claude/hooks/scope-guard.mjs | 5491466d8e38e96c | CRLF, ASCII; teklif |
| dot-claude/settings.json | .claude/settings.json | 692dfdca7c0a1b04 | 2. PreToolUse girdisi `^mcp__.*$` |
| scripts/guard-scope.mjs | scripts/guard-scope.mjs | a4ea9ff7f554a30c | DEGISMIYOR; yalniz import cozumu icin kopya. Kanit: Director `sha256sum scripts/guard-scope.mjs docs/tasks/LIFE-010-proposed/scripts/guard-scope.mjs` -> iki dosya da a4ea9ff7f554a30c21cfa4838d922cfb44c377a8e6916becb1b9b113732b9053 (kopya aninda, 2026-11-15) |
| office-manifest.mjs | Office deposu (calisma agaci disi) | ee64407d2694258d | E6 manifest uret/karsilastir |
| scope-guard.test.mjs | (dagitilmaz) | 830c9d54cd5c7707 | 304 test |
| mutation-check.mjs | (dagitilmaz) | ab146be7256edaa1 | test yeterlilik kaniti |
| DIFF-vs-BASE.patch | (belge) | 91082a8ac77a4561 | CR'siz unified diff, +96 -35 |
| AGENTS.patch.md | (Owner elle ekler) | 6392b2d50f4b695e | |
| BASE-office-scope-guard.mjs.txt | (salt okunur referans) | f21c539915b414d2 | Owner'in verdigi, degistirilmedi |

Klasor adi `dot-claude/`: `.claude` segmentli bir yola Write hook tarafindan (sensitive_name) reddedilir; hook'un `../../scripts/guard-scope.mjs` importu bu duzenle cozulur.

## Bosluk dogrulamasi (kod okunarak)
- G1 DOGRU: PROTECTED yalniz Write/Edit/NotebookEdit'te; Director shell'de DANGEROUS+ASK disi pass. Log yalniz ilk iki kelime (canli log: 153 satir, `head` alani).
- G2 DOGRU (tek kontrol `/\.claude/i` -> ask). G2b DOGRU (.git/config icin shell kurali yok).
- G3 DOGRU: matcher MCP'yi icermiyor; decide() bilinmeyen araca pass.
- G4 DOGRU; ek bulgu: scripts/guard-scope.mjs git'te izlenmiyor (`.git/info/exclude:9`), degisikligini hicbir sey kaydetmiyor.
- G5 DOGRU.
- G6/G6b/G6c DOGRU (taban ve canli ayni isTestCmd).
- G7: Office tabaninda KAPALI (dogru). Canli hook'ta ACIK: canli isGitRead `--no-index`'i reddetmiyor.
- G8, G9, G10 DOGRU.
- Ek bulgu (G11): Director'da satir devamli `git \<newline>push` canli/taban DANGEROUS'u gecer (`[^\n]*` satir sonunda durur). Teklifte kapatildi; mutasyon M1 bunu gosteriyor.
- Ek bulgu: canli hook'ta qa-test-engineer git komutu calistiramiyor (bu oturumda gozlendi: `git status --short` -> BLOCKED). E2 bunu duzeltir.

## Degisiklik ozeti (TABANA gore; tam metin DIFF-vs-BASE.patch)
- Baslik: "kaza onleyici korkuluk, dusmana karsi sinir degil" (TR + EN).
- G4: PROTECTED += `scripts/guard-scope.mjs`.
- E1/G5: validateScope, PROTECTED'a dusen veya `.git`/`.claude` segmentli girdide tum scope'u reddeder; ayrica sonda nokta/bosluklu segment reddedilir.
- E2: qa = test || git read (YENI: tabanda qa yalniz test). implementation-engineer ve reviewer (yalniz git read) tabandakiyle ayni. GIT_READ_FLAGS += `diff --check`, `ls-files --eol`.
- E7 = cikti seti (scope-guard.mjs, guard-scope.mjs degismiyorsa kopya, settings.json, scope-guard.test.mjs, office-manifest.mjs, AGENTS.patch.md; log tam metin + boyut siniri; G4; matcher NOT TESTED). Karsiligi yukaridaki Dosyalar tablosu.
- G6: `node --test` yalniz `tests/**/<ad>.test.mjs`, secenek yok, en az bir dosya. G6b/G6c: npm yalniz `npm test`, `npm run test`, `npm run check` (tam metin).
- E3/E5: Director'da korunan ad (agents.md, claude.md, .claude, task-scope, scope-guard, guard-scope, .git/config, .gitattributes, .gitignore) -> ask. `git config` ve `git -c` -> ask.
- Director eklemeleri (Owner listesi disi, gorev testlerinden turetildi; Owner onayi gerekir): satir ici yorumlayici kodu (python -, node -e, iex, -EncodedCommand) -> ask; npm ci/install/exec/build, npx -> ask; satir devami birlestirme; string olmayan agent_type -> deny.
- E4: `mcp__*` -> deny (MCP_ALLOW bos ve donmus); settings.json'a ayri `^mcp__.*$` girdisi.
- G10: log komutun ilk 300 karakterini ve dosya yolunu yazar (kesilirse uzunluk alani da); 1 MiB'de .1'e doner.
- BOM: `/^﻿/` yerine `String.fromCharCode(0xfeff)` ile kurulan BOM sabiti (davranis ayni; gorunmez karakter yok).

## Evidence
- Director run 1: `SCOPE_GUARD_NO_LOG=1 node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 303, pass 303, fail 0 (BOM/CRLF duzeltmesinden ONCE).
- Director run 2: ayni komut -> tests 303, pass 302, fail 1. Neden: Director'un perl ile yaptigi BOM duzeltmesi `/^﻿/` yerine `/^FEFF/` yazdi; BOM test'i yakaladi. Duzeltildi (BOM sabiti).
- Director run 3 (settings testi eklendikten, CRLF ve BOM duzeltmesinden SONRA): tests 304, suites 0, pass 304, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 3740.7203, exit 0.
- qa-test-engineer (2. deneme): `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 304, pass 304, fail 0, cancelled 0, duration_ms 3709.9149. Cikis kodu qa tarafindan GOZLENMEDI (ozetten cikarim).
- Mutasyon kontrolu (Director, `node docs/tasks/LIFE-010-proposed/mutation-check.mjs`, son kosu): 11/11 mutasyon yakalandi (node runner'in bildirdigi fail sayilari: M1 6, M2 13, M3 17, M4 6, M5 22, M6 6, M7 23, M8 5, M9 2, M10 2, M11 7); exit 0. M11 yalniz `diff --check`'i kaldirir (`ls-files --eol` icin ayri mutasyon yok). Reviewer bazi sayilarin etkilenen test sayisindan 1 fazla oldugunu not etti; nedeni dogrulanmadi (UNKNOWN).
- DIFF-vs-BASE.patch: `diff -u --strip-trailing-cr`, CR bayti 0 (node ile sayildi), +96 -35. Tek gorunmez karakter tabanin kendi `-` satirindaki BOM literalidir (taban satir 170).
- Node v24.18.0 (Director, `node --version`).
- `git status --short` -> bos (0 satir), branch main (Director, yazimlardan sonra).
- Resmi belge (web-fetch, code.claude.com/docs/en/hooks; model ozeti, alintilar ajandan):
  - Yalniz harf/rakam/`_`/`-`/bosluk/`,`/`|` iceren matcher tam ad listesidir; baska karakter varsa ANKRAJSIZ JS regex'tir. `mcp__.*` belgelenmis ornek.
  - PreToolUse exit 2 cagriyi engeller.
  - auto mode: "a PreToolUse hook's `ask` normally sends the tool call to the permission prompt, and the classifier doesn't decide it."
  - `args` ve `onFailure` belgelenmis alanlar.

## Security bulgulari (security-engineer, model incelemesi, NOT TESTED; ayrinti sohbet raporunda)
Karar: ACCEPT WITH CHANGES. Taban'a gore regresyon yok; tek istisna F7 (Owner'in kabul ettigi G10 gizlilik takasi).
- F1 MEDIUM (tabandan miras): `isMain` karsilastirmasi argv[1] ile gercek yolu karsilastiriyor. Junction/subst/8.3 yolunda main() calismaz; hook exit 0 ile sessizce gecer (fail-open). Bu iddia NOT TESTED.
- F2 MEDIUM: Director shell `.git/hooks/*`, `.git/info/*` yazabilir, ask yok (ad kurali yalniz `.git/config`).
- F3 MEDIUM: ic ice `docs/CLAUDE.md`, kokte `CLAUDE.local.md` ve `.mcp.json` korunmuyor.
- F4 LOW: `git restore <yol>`, `git reset HEAD~n`, `git pull/fetch/clone` vb. Director'da pass.
- F5 LOW: `git --config-env`, GIT_CONFIG_* ortam degiskenleri `-c` ask'ini atlar.
- F6 LOW: `npm -g install`, `npm init/create`, pnpm/yarn ask disi.
- F7 LOW: log yorumundaki "Owner-only" yalniz yazma icin dogru; Read araci log'u okuyabilir.
- F8 LOW (supheli): `stdout.write` sonrasi hemen `process.exit(0)`. Flush olmazsa ask kaybolabilir. Bu makinede surec testi ask JSON'unu aldi (yalniz bu makinede gozlendi).
- F9 INFO: validateScope `AGENTS.md/` (sonda egik cizgi) girdisini kabul ediyor. Yazma izni vermez, ama E1 metniyle uyumsuz.
- F10 INFO: `"command": "node"` ciplak adla calisiyor.
- F11 INFO: ListMcpResourcesTool/ReadMcpResourceTool ve MCP sunucu baslatma E4 kapsami disinda.
Director karari: bulgular bu teklife UYGULANMADI. Owner'in istedigi sira (inceleme -> kayit -> rapor) korundu. Uygulanirsa yeni qa + security turu gerekir. Owner onerisi: F1, F2, F3, F9 sonraki turda.

## Roles used
Agent reports are model output, not human review.
| Role | What it did | Result |
|---|---|---|
| Director | Kesif; tum dosyalarin yazimi (Director run: gorev Director'a verildi, implementation-engineer kullanilmadi); 3 test kosusu; mutasyon kontrolu; diff; hook belgesi Agent(web-fetch) arac ajaniyla okundu | PASS (yalniz kendi kosulari; onay degildir; ham cikti kaydedilmedi, %TEMP% gecici dosyalarinda kaldi) |
| qa-test-engineer | 1. deneme: Director'un cd hatasi nedeniyle yol bulunamadi; git komutlari canli hook tarafindan engellendi | BLOCKED |
| qa-test-engineer | 2. deneme: `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` | PASS (304/304; exit kodu gozlenmedi) |
| security-engineer | Nihai hook kodu metin olarak verildi; staged dosyalar Read ile okundu (git disi) | PARTIAL: ACCEPT WITH CHANGES (F1-F3 MEDIUM acik) |
| security-engineer (kod oncesi) | Cagrilmadi; tasarim Owner kararlari E1-E7 ve onceki salt okunur analiz (G1-G10) ile verildi | NOT RUN (AGENTS.md "once ve sonra" kuralindan sapma; risk: tasarim bulgulari F1-F3 kod sonrasi cikti) |
| release-evidence-reviewer | 9 dosya + LIFE-010.md Read ile (git disi, Read ile incelendi); `git status --short` bos, branch main | PASS: ACCEPT WITH NOTES (teklif olarak). Notlar bu kayitta duzeltildi (asagi) |
| research-engineer | Harici bilgi (hook belgesi) icin cagrilmadi; web-fetch arac ajaniyla okundu | NOT RUN (gerekce: belge okumasi; matcher canli denemeye kadar NOT TESTED) |
| implementation-engineer | Director run | NOT RUN |
| product-planner, software-architect, ui-ux-engineer | Owner kararlari tasarimi verdi; UI yok | NOT RUN |

## UNKNOWN / NOT TESTED
- Canli Claude Code'da `^mcp__.*$` matcher'inin MCP araclarini hook'a yonlendirip yonlendirmedigi: NOT TESTED (yalniz belge + statik regex testi).
- Iki PreToolUse girdisinin ayni komutla birlikte davranisi (cift calisma yok, cunku bir arac yalniz birine uyar): NOT TESTED.
- bypassPermissions modunda hook `ask`'in davranisi: UNKNOWN (belgede yok).
- auto mode'da hook `ask`: belgeye gore istem gosterilir ("normally"); bu oturumda canli olarak dogrulanmadi.
- F1 (junction/subst ile fail-open): NOT TESTED.
- F8 (stdout flush): yalniz bu makinede, staged surec testinde gozlendi; genel durum UNKNOWN.
- Hook'un `agent_type` alanini ana oturumda bos string olarak gonderip gondermedigi: UNKNOWN (gonderirse Director shell tumden reddedilir, fail-closed).
- Global/sistem gitconfig (fsmonitor/textconv/diff.external): incelenmiyor; manifest yalniz .git/config'i kapsar.
- `npm test`/`npm run check` bu gorevde calistirilmadi (app/ ve tests/ degismedi): NOT TESTED.
- office-manifest.mjs gercek lifeacta-work veya Office deposu uzerinde calistirilmadi (yalniz gecici sahte kokte): NOT TESTED.

## Owner apply steps (ozet; ayrinti sohbet raporunda)
1. Office deposunda yeni dal; dosyalari kopyala; Office'te testleri calistir.
2. YEDEK: lifeacta-work'te `.claude/settings.json`, `.claude/hooks/scope-guard.mjs`, `scripts/guard-scope.mjs` dosyalarini calisma agaci disina KOPYALA (bunlar git disi; git geri getiremez, manifest yalniz hash tutar).
3. `office-manifest.mjs generate` ile ONCEKI durumun manifestini calisma agaci disina al.
4. %TEMP% altinda lifeacta-work kopyasinda canli deneme (matcher, ask, MCP deny).
5. lifeacta-work'e kopyala; yeni manifest uret.
6. Geri alma: 2. adimdaki yedekleri geri kopyala; 3. adimdaki manifestle `verify` -> OK.

## Review sonrasi duzeltmeler (yalniz bu belge; reviewer yeniden cagrilmadi, gerekce: belge duzeltmesi)
- E2 satiri: reviewer "yalniz git read" tabanda zaten vardi; yeni olan qa'nin git read almasi.
- E7 tanimi eklendi; guard-scope bayt-ayniligi icin komut eklendi; M11 adi duzeltildi.
- Director sonucu PASS olarak (izinli deger) yazildi; reviewer satiri dolduruldu; kod oncesi security NOT RUN olarak kaydedildi.
- Geri alma planina dosya yedegi adimi eklendi.
- Acik Owner karari (reviewer notu): onerilen hook'ta qa yalniz tests/ altini calistirabilir; Director'un docs/tasks/... testleri "scope-guard" adi nedeniyle ask ister. Gelecek hook onerilerinde bu gorevdeki kanit zinciri (qa staged testi calistirir) kullanilamaz.
- Acik: F9 (`AGENTS.md/` kabul) AGENTS.patch.md'deki "tum scope'u reddeder" ifadesiyle celisir; F9 duzeltilene kadar ifade sonda egik cizgisiz girdiler icin dogrudur.

## Tur 2 (2026-11-15) - security bulgulari F1-F9 (Owner emri)
Ayni scope; yazim yalniz docs/tasks/LIFE-010-proposed/ ve bu dosya. Owner-only dosyalara yazilmadi.

### Uygulananlar
| Bulgu | Degisiklik | Kanit |
|---|---|---|
| F1 | isMain yol karsilastirmasi kaldirildi. main() her yuklemede calisir; yalniz `SCOPE_GUARD_NO_MAIN === '1'` ise atlanir (testler import'tan once set eder; dinamik import). Ek: PROTECTED_NAMES `scope[-_]guard` icerir, SCOPE_GUARD_* geciren Director komutu ask. | Eski davranis OLCULDU (`node docs/tasks/LIFE-010-proposed/f1-evidence.mjs`, Director): tur-1 hook: gercek yol exit 2 / BLOCKED; junction uzerinden exit 0, stdout ve stderr bos (fail-open). Yeni hook (`node docs/tasks/LIFE-010-proposed/f1-evidence.mjs docs/tasks/LIFE-010-proposed/dot-claude/hooks/scope-guard.mjs`): iki yol da exit 2 / BLOCKED. |
| F2 | `.git/config` kalibi yerine `\.git(?=[\\/\s"';|&)]|$)`: her .git/ veya .git\ yolu ask; .github eslesmez (test edildi). | testler F2 (12) |
| F3 | OWNER_BASENAME (agents.md, claude.md, claude.local.md, .mcp.json) her segmentte: fileDecision deny, validateScope ret; PROTECTED += claude.local.md, .mcp.json; PROTECTED_NAMES += ayni adlar. | testler F3 (11) |
| F4 | Director git ASK += restore, reset, pull, fetch, clone, revert. | testler F4 (12) |
| F5 | ASK: `--config-env`, `GIT_CONFIG*`, `GIT_EXTERNAL_DIFF`. | testler F5 (8) |
| F6 | npm: secenek fiilden once (`npm -g install`), init/create, -g/--global, run build/verify; pnpm/yarn/bun add/install. | testler F6 (29) - bakiniz N2: kismen |
| F7 | Log yorumu: "Owner-only" yalniz YAZMA icin; Read araci log'u ve tam komut metnini okuyabilir. | test F7 (1, kaynak metni) |
| F8 | `finish()`: process.exitCode once set edilir, cikis yazma callback'inde. | birim test (sira), surec testi (200 kB ask, 100 kB deny). Surec testi ayirt edici DEGIL: M19 altinda yalniz birim test kaliyor (olculdu, duzeltilmis mutasyon kosusu). Nedeni olarak "Windows'ta pipe senkron" hatirlanan bilgidir, NOT VERIFIED. |
| F9 | validateScope sondaki `/` kaldirilarak karsilastirir (`AGENTS.md/`, `scripts/guard-scope.mjs/` ret). | testler F9 (8) |

Tur 2'de duzeltilen Director hatalari (test yazarken): `git pull --rebase=false` ve `git restore --staged` taban DANGEROUS tarafindan zaten DENY (asiri eslesme, guvenli yonde; degistirilmedi, testte not). `.MJS` buyuk harf uzantili yol Node'da ERR_UNKNOWN_FILE_EXTENSION ile exit 1 veriyor (hook yuklenmeden); test klasor adinda harf degisikligine cevrildi.

### Evidence (tur 2)
- Director: `SCOPE_GUARD_NO_LOG=1 node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 391, suites 0, pass 391, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 5211.5035, exit 0 (CRLF donusumunden sonra, son kosu).
- qa-test-engineer: `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 391, pass 391, fail 0, duration_ms 5113.919; exit kodu GOZLENMEDI. "✔ F" satirlari qa'nin elle sayimi: F1 4, F2 12, F3 11, F4 12, F5 8, F6 29, F7 1, F8 2, F9 8 (toplam 87, yaklasik).
- Mutasyon - ILK KOSU GECERSIZ: ilk "27/27 yakalandi" sonucu (ve tur 1'deki "11/11") GECERSIZDI. mutation-check.mjs gecici kopyaya dot-claude/settings.json'u kopyalamiyordu; settings testi HER mutasyonda basarisiz oldu ve her mutasyon "yakalandi" gorundu (reviewer'in "+1 anomalisi"nin nedeni). Duzeltme: settings.json kopyalanir; M0 (mutasyonsuz taban) fail 0 olmali, yoksa kosu INVALID sayilir; her mutasyon icin basarisiz test adlari yazilir. Duzeltilmis ilk kosu: GAPS 2. M18b (-g kurali kendi testi yok; reviewer ongordu) ve M21 (mutasyon regex yerine yorumu degistiriyordu, Director hatasi). Duzeltme: 2 ayirt edici -g testi eklendi; M21 hedefi regex'e cevrildi.
- Mutasyon (gecerli, son kosu; Director, `node docs/tasks/LIFE-010-proposed/mutation-check.mjs`): M0 taban pass 393 fail 0; 27/27 yakalandi, exit 0. Fail sayilari: M1 5, M2 22, M3 16, M4 9, M5 34, M6 5, M7 22, M8 6, M9 1, M10 1, M11 6, M11b 6, M12 2, M13 5, M14 1, M15 4, M15b 2, M16 11, M17 6, M18a 2, M18b 2, M18c 8, M18d 2, M19 1 (yalniz F8 birim testi), M20 4, M21 1, M22 1.
- Ortusme (olculdu, kabul edildi): F5'in iki `--config-env` testi ve F2'nin iki `.git/hooks/pre-commit` testi baska kurallarca da yakalaniyor (git `config` / `commit` sozcukleri); M13 ve M17 listelerinde yer almiyorlar. Diger F2/F5 testleri ayirt edici. F1 buyuk/kucuk harf/egik cizgi varyant testi tur-1 kodunda da gecer (ayirt edici degil); ayirt edici olan junction testi.
- Test sayisi 393 (2 yeni -g testi). Director: `SCOPE_GUARD_NO_LOG=1 node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 393, pass 393, fail 0, exit 0.
- DIFF-vs-BASE.patch yeniden uretildi: CR bayti 0, +131 -40. DELTA-round2.patch (tur 1 -> tur 2): CR bayti 0, +42 -13. (Duzeltme: ilk kayittaki +129/+41, yalniz `+` iceren bos eklenmis satirlari saymayan bir regex'ten geliyordu; reviewer yakaladi, Director `grep -c '^+'` ile yeniden saydi.)
- Claude Code surumu: `claude --version` -> 2.1.325 (Director). `onFailure` icin ">= v2.1.295" kosulu: tur 1 web-fetch raporundaki "Command hook fields" alintisi ("Requires Claude Code v2.1.295 or later") ve tur 2 security raporu; ham sayfa bu kayitta saklanmadi.
- `git status --short` -> 0 satir (Director, tur 2 sonu).

### Dosyalar (tur 2, SHA-256 ilk 16, satir)
| Dosya | SHA | Satir |
|---|---|---|
| dot-claude/hooks/scope-guard.mjs | 67e744afbef2b048 | 279 (CRLF) |
| dot-claude/settings.json | 692dfdca7c0a1b04 | 34 (degismedi) |
| scripts/guard-scope.mjs | a4ea9ff7f554a30c | 145 (degismedi) |
| office-manifest.mjs | ee64407d2694258d | 96 (degismedi) |
| scope-guard.test.mjs | 137e49a94a79dfc1 | 422 |
| mutation-check.mjs | e581ea1d09693b6b | 60 |
| f1-evidence.mjs (YENI) | feed4c8ec5c6d6bc | 29 |
| PREV-round1-scope-guard.mjs.txt (YENI, tur-1 hook kopyasi) | 5491466d8e38e96c | 250 |
| DELTA-round2.patch (YENI) | 83e65a8dddb57ba4 | 120 |
| DIFF-vs-BASE.patch | d6f899082a8e9363 | 288 |
| AGENTS.patch.md | 26154091a293064f | 38 |
| BASE-office-scope-guard.mjs.txt | f21c539915b414d2 | 188 (degismedi) |

### Security tur 2 (yalniz delta; security-engineer, model incelemesi)
Karar: ACCEPT WITH CHANGES. Tur 1'e gore regresyon yok. F1, F3, F4, F5, F7, F8, F9 DONE; F2 ve F6 PARTIAL. Director, asagidaki bypass iddialarini staged hook uzerinde CALISTIRARAK dogruladi (`decide()`, SCOPE_GUARD_NO_MAIN=1 ile import):
- N1 MEDIUM: `gh pr merge 12 --squash`, `gh release create v1` -> pass (DOGRULANDI). Uzak merge/release Owner isi; kural yok.
- N2 LOW (F6 kismi): `npm --prefix app install`, `npm --prefix . ci`, `npm --loglevel silent ci`, `npm clean-install`, `npm version patch`, `npm pkg set ...`, `bunx x`, `pnpm dlx x`, `yarn` -> pass (DOGRULANDI). `npm --prefix x ci` testi yalniz `x` fiil listesinde oldugu icin ask (DOGRULANDI: test kanit degeri tasimiyor).
- N3 LOW: `git update-ref -d HEAD`, `git gc --prune=now` -> pass (DOGRULANDI); submodule/notes/init vb. ayni sinif.
- N4 LOW: `GIT_PAGER=x git log` -> pass (DOGRULANDI); GIT_SSH_COMMAND, EDITOR vb. ayni sinif.
- N5 LOW (F2 kismi): `gci .git,src`, `ls .git*` -> pass (DOGRULANDI). `type .git.\config`: bash kacisi komutu `.git.config` yapti; NOT VERIFIED.
- N6 INFO: SCOPE_GUARD_NO_MAIN=1 iken hook sessiz exit 0, log yok; onFailure bunu yakalamaz.
- INFO: scripts/guard-scope.mjs git disi; yeni bir checkout'ta eksikse hook ERR_MODULE_NOT_FOUND ile exit 1 verir. Bu durumda engelleme yalniz `onFailure: "block"` ile olur. Canli deneme NOT TESTED.
Bu bulgular tur 2'ye UYGULANMADI (Owner emri F1-F9 ile sinirli). Onerilen tur 3: N1, N2 (ve bos testin `npm --prefix app install` ile degistirilmesi), N5; istege bagli N3, N4, N6.

### Roles used (tur 2)
| Role | What it did | Result |
|---|---|---|
| Director | F1-F9 yazimi (Director run), testler, mutasyon, F1 olcumu, diff'ler, bypass dogrulamasi | PASS (yalniz kendi kosulari; onay degildir) |
| qa-test-engineer | `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` | PASS (391/391; exit kodu gozlenmedi) |
| security-engineer (kod sonrasi, delta) | DELTA metni + Read | PARTIAL: ACCEPT WITH CHANGES (N1 MEDIUM acik) |
| security-engineer (kod oncesi) | Cagrilmadi | NOT RUN - SAPMA: AGENTS.md "once ve sonra" ister. Gerekce: tur 2 tasarimi Owner'in F1-F9 emirleriydi. Risk: N1/N2 tasarimda yakalanabilirdi. |
| release-evidence-reviewer | Guncel dosya seti Read ile (git disi); `git status --short` bos, branch main | PASS: ACCEPT WITH NOTES (teklif olarak). Notlar asagida "Reviewer tur 2" bolumunde |
| qa-test-engineer (yeniden) | Test dosyasina 2 test eklendikten sonra ayni komut | sonucu asagida "Reviewer tur 2 sonrasi" |
| research-engineer | Cagrilmadi | NOT RUN |

### Reviewer tur 2 (release-evidence-reviewer, model incelemesi)
ACCEPT WITH NOTES (teklif olarak). F1-F9 uygulanmis ve testli; scope PASS; DELTA 6 hunk kontrolu PASS; git status bos. Notlar ve durumu:
- Diff satir sayilari yanlis (+129/+41) -> DUZELTILDI (+131 -40, +42 -13).
- M18b icin ayirt edici test yok -> DOGRULANDI ve DUZELTILDI (2 test). Sayim anomalisi -> nedeni bulundu (settings.json kopyalanmiyordu), arac duzeltildi, ilk mutasyon sonuclari gecersiz ilan edildi.
- M13/M17 ortusmesi -> DOGRULANDI, kabul edildi (yukarida).
- AGENTS.patch.md "secenek fiilden once gelse de" abartili -> DUZELTILDI (degerli secenek uyarisi).
- Node pipe senkron ifadesi -> NOT VERIFIED olarak isaretlendi. f1-evidence yeni-hook komutu -> eklendi. onFailure surum kaynagi -> eklendi. Measurement satiri -> guncellendi.
- Reviewer bu duzeltmelerden SONRA yeniden cagrilmadi (gerekce: duzeltmeler reviewer'in kendi notlari; test dosyasi degisikligi qa tarafindan yeniden calistirildi). Owner isterse bagimsiz yeniden inceleme acik.

### Reviewer tur 2 sonrasi
- qa-test-engineer (yeniden): `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 393, suites 0, pass 393, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 5606.3477; iki yeni -g testi ✔; exit kodu GOZLENMEDI. Sonuc: PASS.

### UNKNOWN / NOT TESTED (tur 2 eki)
- F10 (`"command": "node"` ciplak ad; proje kokunde node.exe olasiligi): UNKNOWN, uygulanmadi.
- F11 (ListMcpResourcesTool / ReadMcpResourceTool ve MCP sunucu baslatma E4 disinda): UNKNOWN, uygulanmadi.
- onFailure "block": hook yuklenemediginde (exit 1) canli engelleme NOT TESTED. Surum kosulu karsilaniyor (2.1.325 >= 2.1.295, belgeye gore).
- EPIPE durumunda cikis kodu: NOT TESTED.
- `NODE_TEST_CONTEXT` ile NO_MAIN'i daraltma (N6): NOT TESTED.
- gh'nin bu makinede kurulu ve oturum acik olup olmadigi: NOT TESTED.
- Windows'ta process.stdout pipe'inin senkron oldugu (F8 surec testinin ayirt edici olmamasi): NOT VERIFIED (Node belgesi hatirlanan bilgi, bu oturumda okunmadi).

## Tur 3 (2026-11-15, dar) - N1-N5 + branch istisnasi (Owner emri)
Ayni scope; yazim yalniz docs/tasks/LIFE-010-proposed/ ve bu dosya. Owner-only dosyalara yazilmadi. Tur-2 hook kopyasi: PREV-round2-scope-guard.mjs.txt (67e744afbef2b048).

### Uygulananlar
| Emir | Degisiklik |
|---|---|
| N1 | Director ASK: `\bgh(\.exe)?\s` (Owner'in verdigi kural, aynen). |
| N2 | Paket yoneticisi kurali fiil konumundan bagimsiz: komutta npm/pnpm/yarn/bun/bunx/npx VE listeden bir fiil (ayri sozcuk) herhangi bir yerde -> ask. Liste: Owner listesi + tur-2 kisaltmalari (up, upgrade, un, rm, r, ln, in, it, isntall) + ic, cit, install-ci-test, unlink. npx/bunx her zaman ask (kaldirilsaydi `npx x` gerilerdi). `npm --prefix x ci` bos-kanit testi `npm --prefix app install` ve `npm --loglevel silent ci` ile degistirildi. |
| N3 | git ASK += update-ref, gc, submodule, notes, init, replace, reflog. |
| N4 | ASK: `GIT_<ad>=`, `$env:GIT_<ad>`, `EDITOR=`, `$env:EDITOR`. |
| N5 | PROTECTED_NAMES: `\.git(?![\w-])`; `ls .git*`, `gci .git,src` ask; `.github`, `.gitmodules`, `.gitkeep`, `.git-blame-ignore-revs` eslesmez (testli). |
| Ek | Tam olarak `git branch --show-current` ASK'tan muaf (ham komut, tam dize, DANGEROUS'tan SONRA). Bosluklu/ek secenekli/zincirli bicimler ask. |
| R3-1 (security tur 3, Director duzeltmesi; ayirac kumesi R3-1b ile genisletildi, bkz. "Tur 3 son") | N2 ilk gerceklemesi fiilden sonra yalniz bosluk kabul ediyordu: `npm ci&&npm test`, `npm ci;npm test`, `(npm ci)`, `npm install|tee log`, `pnpm i;x`, `npm install-test`, `npm install-clean` PASS oldu (tur 2'de ask; Director calistirarak DOGRULADI). Duzeltme: fiil oncesi `[\s;&|("'\x60]`, sonrasi `[\s;&|)<>"'\x60-]`. Dogrulanmamis alias adlari EKLENMEDI. |
| N6 | Degisiklik yok. KABUL / UNKNOWN: SCOPE_GUARD_NO_MAIN=1 iken hook sessiz exit 0 verir, log yazmaz; onFailure bunu yakalamaz. Yalniz log satirlarinin kesilmesiyle fark edilir. |

### Test ve mutasyon (Director, R3-1 duzeltmesinden sonra, R3-1b ONCESI - ESKI; guncel sayilar "Tur 3 son" ve "Tur 3 kapanis" bolumlerinde)
- `SCOPE_GUARD_NO_LOG=1 node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 469, suites 0, pass 469, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 5541.9907, exit 0.
- `node docs/tasks/LIFE-010-proposed/mutation-check.mjs` -> M0 taban pass 469 fail 0; 65/65 mutasyon yakalandi; "ASK tests: 132, never killed by any mutation: 0"; exit 0.
- Mutasyon kumesi: 27 adli tur 1-2 (duzeltme: ilk yazimda yanlislikla 29; reviewer yakaladi) + tur 3 (M23-M31b) + uretilen 12 "bir ASK kurali sil" + 11 "bir PROTECTED_NAMES alternatifini dusur". Tur 3 fail sayilari: M23 5, M24 43, M24b 13, M24c 2, M24d 2, M24e 2, M24f 1, M25 7, M26 6, M27 4, M28 1, M29 2, M30 2, M31 2, M31b 9.
- Ayirt edicilik: mutation-check artik her Director ASK testinin en az bir mutasyonla kirmiziya donmesini sart kosuyor. Ilk kosuda 7 test hicbir mutasyonla kirmiziya donmedi. 3 `.git/config` vakasi tasarim geregi cift kapsamli (ad kurali + git `config` fiili); bunlar "Double-covered" etiketli tek bir teste alindi ve ayirt edici kanit sayilmadi. 4 `npm -g install` tipi vaka silindi (-g kurali `npm ls -g`, `npm --global outdated` ile sabit). R3-1 duzeltmesinden sonra iki test daha ayirt ediciligini kaybetti (`pnpm dlx create-x`, `yarn dlx x`: `create-` / `x` artik eslesiyor); bunlar `... dlx cowsay` yapildi. Fiil oncesi ayiraci icin tirnakli fiil testleri eklendi (`npm "install"`, `npm --prefix app 'ci'`).
- Diff (ESKI, R3-1b oncesi; guncel: "Tur 3 son"): DIFF-vs-BASE.patch CR 0, +146 -40 (bos eklenmis satir dahil; 2 bos `+`). DELTA-round3.patch (tur 2 -> tur 3) CR 0, +25 -10 (0 bos `+`). Sayim: node ile, `+++`/`---` basliklari haric.

### Dosyalar (tur 3, SHA-256 ilk 16)
dot-claude/hooks/scope-guard.mjs f662b58d47b7840e (294, CRLF); scope-guard.test.mjs f9e481c6f39a3545 (492); mutation-check.mjs 460c838fa6d723b1 (115); AGENTS.patch.md 8332939eff36f4ba (40); DELTA-round3.patch 3bb313aec04417b1 (64); DIFF-vs-BASE.patch faca192b47e42af3 (303); PREV-round2-scope-guard.mjs.txt 67e744afbef2b048 (279, YENI). settings.json, office-manifest.mjs, scripts/guard-scope.mjs degismedi.

### Security tur 3 (yalniz delta; security-engineer, model incelemesi; Director bypass iddialarini calistirarak dogruladi)
Karar (ilk delta): ACCEPT WITH CHANGES. N1, N3, N4, N5, Ext DONE; N2 PARTIAL (R3-1).
- R3-1 MEDIUM, tur-2'ye gore regresyon: DUZELTILDI (yukarida).
- R3-2 LOW: `"gh" pr list` -> pass (DOGRULANDI); tirnakli gh.exe yolu da ayni sinif (prob sirasinda ters egik cizgiler kayboldu, bu dize NOT VERIFIED). Degistirilmedi; Owner'in verdigi kural aynen uygulandi. Oneri: `\bgh(\.exe)?(?=[\s"']|$)`.
- R3-3 LOW: `${env:GIT_PAGER}='x'`, `Set-Item env:GIT_PAGER x`, `PAGER=x git log`, `VISUAL=x git log` -> pass (DOGRULANDI). N4 emrinin disinda; Owner karari.
- R3-4 LOW: `git symbolic-ref ...`, `npm audit fix`, ciplak `yarn`, `pnpx x` -> pass (DOGRULANDI); read-tree, bisect, prune, repack vb. ayni sinif. Owner karari.
- R3-5 INFO: 8.3 adlari, glob/pipeline ile ad uretme gibi sozcuksel bosluklar kalir (hook basligiyla tutarli).
- Director secimleri (npx/bunx kurali, ek kisaltmalar, tam dize istisnasi, test budama): security KABUL.
- R3-1 duzeltmesinin incelemesi: asagida "Tur 3 son".

### Roles used (tur 3)
| Role | What it did | Result |
|---|---|---|
| Director | N1-N5, Ext, R3-1 yazimi (Director run); testler; mutasyon; diff; bypass dogrulamasi | PASS (yalniz kendi kosulari; onay degildir) |
| qa-test-engineer (1) | `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` | PASS 456/456 (R3-1 duzeltmesinden ONCE; artik eski) |
| qa-test-engineer (2) | ayni komut, R3-1 sonrasi | asagida "Tur 3 son" |
| security-engineer (delta) | DELTA-round3 metni + Read | PARTIAL: ACCEPT WITH CHANGES (R3-1) |
| security-engineer (R3-1 duzeltmesi) | yalniz PKG_VERB degisikligi | asagida "Tur 3 son" |
| security-engineer (kod oncesi) | Cagrilmadi | NOT RUN - SAPMA (AGENTS.md "once ve sonra"); gerekce: tasarim Owner'in N1-N5 emri; risk: R3-1 tasarimda yakalanabilirdi |
| release-evidence-reviewer | Tur sonunda guncel dosya seti | asagida "Tur 3 son" |
| research-engineer | Cagrilmadi | NOT RUN. Security, npm alias tablosunun (install-clean, sit vb.) belgeden dogrulanmasini onerdi; dogrulanmamis adlar eklenmedi. |

### Tur 3 son (R3-1b ve kapanis)
- Security R3-1 takip incelemesi: R3-1 PARTIAL. `cmd /c npm ^ci`, `&{npm ci}`, `Invoke-Command {npm ci}`, `npm ci,x` -> pass (Director calistirarak DOGRULADI; `npm \ci` shell'den sinanamadi, ters egik cizgi yolda kayboldu). Duzeltme (R3-1b): fiil oncesine `\ ^ { ,`, sonrasina `, }` eklendi. Testler: 6 ASK (R3-1b), 1 PASS (`npm test tests/install-flow.test.mjs`). Mutasyonlar M31c, M31d.
- Kabul edilen fazla-ask'ler (fail-safe, yalniz Director; hook yorumunda kismen yazili): `npm run check && echo up-to-date`, `npm test > x-report.txt`, `npm test -- --test-name-pattern="add-item"` (Director calistirdi: ask). Security ayrica supheli olarak: `npm test tests\install-flow.test.mjs` (ters egik cizgi), `npm test -- --reporter=spec,x`, `npm test -- --test-name-pattern="{add}"` (NOT TESTED).
- Director, son kod: tests 476, pass 476, fail 0, exit 0. Mutasyon: M0 476/0, 67/67 yakalandi, "ASK tests: 138, never killed: 0", exit 0.
- qa-test-engineer (son): `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 476, pass 476, fail 0, duration_ms 5246.6101; 6 "(R3-1b)" satiri ✔; exit kodu GOZLENMEDI. PASS.
- Security R3-1b onayi: R3-1 DONE; bu karakterlerden yeni fail-open yok. Karar: ACCEPT WITH CHANGES; tek kosul R3-6'nin duzeltilmesi YA DA bilinen sinir olarak yazilmasi.
- R3-6 (security; supheli, NOT TESTED; regresyon DEGIL; tum turlarda vardi): sozcuk ICINDE tirnak/kacis fiili gizler (`npm ins''tall`, `npm a""dd`, `npm in^stall`, `npm ins\x60tall`, `npm c${x}i`). Director karari: BILINEN SINIR olarak kaydedildi, kod degistirilmedi. Gerekce: kasitli gizleme gerektirir; hook "kaza onleyici, dusmana karsi sinir degil" kapsaminda. Onerilen duzeltme (Owner isterse tur 4): `texts`'e tirnak/kacis temizlenmis ucuncu bir bicim eklemek; yalniz ask ekler.
- Diff (son): DIFF-vs-BASE.patch CR 0, +148 -40 (2 bos `+`); DELTA-round3.patch CR 0, +27 -10 (0 bos `+`).
- (ESKI: test/mutation/AGENTS.patch hash'leri "Tur 3 kapanis"ta yenilendi) Son hash'ler (SHA-256 ilk 16): hook b4b45dcb8ebd45dd (296, CRLF); scope-guard.test.mjs 4e15fec42433f721 (496); mutation-check.mjs abe3691ff956be1d (117); AGENTS.patch.md 8332939eff36f4ba (40); DELTA-round3.patch 5926cbc3bf1b65b2 (66); DIFF-vs-BASE.patch 722bc4c8e677b068 (305). Yukaridaki "Dosyalar (tur 3)" satiri R3-1b oncesi durumdur.
- `git status --short` -> 0 satir (Director).

### Tur 3 kapanis (reviewer notlari sonrasi)
- Reviewer (release-evidence-reviewer, tur 3 sonu, Read ile): ACCEPT WITH NOTES; scope, N1-N5, Ext, N6, mutation-check, DELTA, git status PASS. Notlar:
  - Alt-kural duzeyinde iki ayirt edicilik bosluguna dikkat cekti. (a) Kisaltma testlerinin hepsinde `x` argumani vardi ve `x` kendisi bir fiil oldugu icin bu testler kisaltmayi tek basina kanitlamiyordu; M24f yalniz `up`'i kanitliyordu. (b) Fiil oncesi `{` ve `,` icin ayirt edici test yoktu; M31c yalniz `\` ve `^` ile yakalaniyordu.
  - Duzeltme (Director run, yalniz test ve arac): `npm unlink|remove|rm|r|up lodash`, `npm test,ci`, `npm run check {ci}`, `npm test \ci`, `npm test ^ci` testleri eklendi. M24f M24f-j olarak, M31c M31c/e/f/g olarak tek tek kisaltma ve karakter mutasyonlarina bolundu. Hook DEGISMEDI.
- Director, son: tests 485, pass 485, fail 0, exit 0 (Director'un kendi kosusunda `test exit=0` olarak gozlendi; qa'da exit kodu gozlenmedi). Mutasyon: M0 485/0; 74/74 yakalandi; "ASK tests: 147, never killed: 0"; exit 0 (Director gozlemi, `mut exit=0`). Her mutasyon en az 1 testi kirmiziya ceviriyor: M24f 2, M24g 1, M24h 1, M24i 1, M24j 1, M31c 2, M31e 2, M31f 1, M31g 1, M31d 3.
- Kayit duzeltmeleri: 27 adli mutasyon (29 degil); eski sayilar ESKI olarak isaretlendi; Measurement'a tur 3 eklendi. "Tur 3 son" bolumundeki R3-1b test iddiasi artik ayirt edici testlerle destekleniyor. AGENTS.patch.md'deki `.git` ifadesi kodla esitlendi (.git*, .git, ve tek basina .git; .gitmodules, .gitkeep haric).
- Diff'ler degismedi (hook degismedi): DIFF-vs-BASE.patch +148 -40, DELTA-round3.patch +27 -10, CR 0.
- qa-test-engineer (kapanis): `node --test docs/tasks/LIFE-010-proposed/scope-guard.test.mjs` -> tests 485, pass 485, fail 0, duration_ms 5609.2023; 9 "(alias/delimiter only)" satiri ✔; exit kodu GOZLENMEDI. PASS.
- release-evidence-reviewer (kapanis yeniden incelemesi, Read ile): madde 1-4 PASS. Kisaltma ve ayirac testlerinin her birinin yalniz kendi kisaltmasi veya karakteriyle yakalandigi statik olarak dogrulandi; git status bos. Karar: ACCEPT WITH NOTES. Notlar yalniz belge icindi (eski hash satiri, exit kaynagi, bu satir, R3-1 satiri) ve bu kayitta duzeltildi. Reviewer bu son belge duzeltmelerinden sonra yeniden cagrilmadi (yalniz belge).
- Kapanis hash'leri (SHA-256 ilk 16, satir): hook b4b45dcb8ebd45dd (296, CRLF, degismedi); scope-guard.test.mjs a3f136fb547f8900 (501); mutation-check.mjs 0ad87dc306232a5f (124); AGENTS.patch.md 29148bec335f3fa3 (40); DELTA-round3.patch 5926cbc3bf1b65b2 (66); DIFF-vs-BASE.patch 722bc4c8e677b068 (305).

### UNKNOWN / NOT TESTED (tur 3 eki)
- R3-6 sozcuk ici tirnak/kacis gizlemesi: BILINEN SINIR (yukarida), NOT TESTED.
- SHA-256 degerleri reviewer tarafindan dogrulanamaz (hesaplama araci yok); Director hesapladi.
- N6 (yukarida): KABUL, UNKNOWN.
- F10 (ciplak `node` komutu), F11 (MCP kaynak araclari, sunucu baslatma): UNKNOWN, degismedi.
- npm alias tablosu (install-clean, isntall-clean, clean-install-test, sit; ins/inst/instal kisaltmalari): NOT VERIFIED (research yok).
- onFailure "block" canli davranisi, EPIPE, matcher canli davranisi: NOT TESTED (onceki turlardan).

## Measurement
Unfilled field = NOT MEASURED.
- Model / effort: NOT MEASURED
- Duration: NOT MEASURED
- Changed lines: tur 3 hook +148 -40 vs taban, +27 -10 vs tur 2 (bos eklenmis satirlar dahil, node ile); tur 1 hook +96 -35 vs taban; tur 2 hook +131 -40 vs taban, +42 -13 vs tur 1 (`grep -c '^+'` / `'^-'`, basliklar haric)
- Errors: Director 2 hata (cd ile cwd kaymasi -> qa BLOCKED; perl `\u` -> BOM regex bozuldu, test yakaladi)
- Red/green: run 2 red (1 fail) -> run 3 green
