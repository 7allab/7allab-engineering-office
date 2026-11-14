# Koruma sistemleri: hangisi canli, hangisi park edilmis

Tarih: 2026-11-14. Karar: Owner "A onay" (yerinde etiketle, tasima yok). Kayit: Claude Sonnet 5.5 + Owner.
Durum etiketleri: K2 NOT VERIFIED, AUTHORITY.implemented=false, K3/K4 BLOCKED (bkz. D17). Bu belge hicbir kabul degistirmez.

## 1. CANLI (Claude Code hook'u olarak calisiyor)
- `.claude/settings.json` -> PreToolUse (Write|Edit|NotebookEdit|Bash|PowerShell) -> `.claude/hooks/scope-guard.mjs`
- `scope-guard.mjs`, `scripts/guard-scope.mjs` dosyasindan `classifyPath` fonksiyonunu ice aktarir. Yani `guard-scope.mjs` CANLI bagimliliktir.
- Testler: `test/scope-guard.test.mjs`, `test/guard-scope.test.mjs`, `test/new-task.test.mjs`
- Windows'ta 2026-11-14 kosusu (Owner): 56 test, 56 gecti, 0 kaldi.
- 2026-11-14 (OFFICE-003 Owner run1): group 1 = 67/67, group 2 = 209/209. Reason for 56 -> 67: UNKNOWN (not analysed). [AGENT]

## 2. PARK EDILMIS (settings.json'a BAGLI DEGIL)
- `scripts/guard.mjs`, `scripts/authority-grant.mjs`, `scripts/identity-gate.mjs`, `scripts/decision-gate-event-adapter.mjs`, `scripts/validate-director-decision.mjs`
- Testler: `test/authority-grant.test.mjs`, `test/identity-gate.test.mjs`, `test/decision-gate-event-adapter.test.mjs`, `test/director-decision-gate.test.mjs`; ayrica `test/guard.test.mjs.prototype` ve `test/guard.v2.test.mjs.prototype` (kosulmaz)
- Bu zincir birbirine, K2/P4/ADIM_54_55/O4-NC belgelerine ve testlere referans verir; hicbir uretim giris noktasi onu cagirmaz (authority-grant.mjs kendi yorumunda da boyle der).
- Windows'ta 2026-11-14 kosusu (Owner): 209 test, 209 gecti, 0 kaldi. Bu, zincirin kendi testlerinin gectigini gosterir; zincirin calisma zamaninda etkin oldugunu GOSTERMEZ.
- 2026-11-14 (OFFICE-003 Owner run1): group 2 = 209/209 (OFFICE-003 Owner run1), unchanged. [AGENT]

## 3. Kurallar
- Park edilmis dosyalari TASIMA ve SILME: K2/P4 kanit belgeleri ve SHA-256 manifestleri bu yollara dayanir. Tasima icin ayri Owner karari gerekir.
- `scripts/guard-scope.mjs` degisirse canli hook etkilenir: degisiklikten sonra BOTH test gruplari (bolum 1 ve 2) calistirilir.
- Park edilmis zincir baglanacaksa bu ayri bir karar ve ayri bir kabul gerektirir (K2 hatti).

## 4. Bilinen bosluklar (canli hook)
- Hook MCP araclarini, Read/Grep'i ve WebFetch/WebSearch'u gormez (backlog B9).
- PermissionRequest denetimi yoktur.

## 5. git-read oracle (OFFICE-003)
Kaynak: `docs/tasks/OFFICE-003.md` (tek kaynak), `test/scope-guard-oracle.test.mjs`. Commit 0733e96, branch task/office-003-git-read-oracle. Etiketler: [AGENT] = bu belgeyi yazan ajanin ozeti; olculen degerler gorev dosyasindaki [DIRECTOR]/[OWNER] kosularindan alinmistir, burada yeniden kosulmadi (NOT TESTED).
- Ne yapar: `decide()`'in izin verdigi git-read komutlarini (2 rol x 2 arac) gercek shell'lerde (Git Bash, Windows PowerShell 5.1; pwsh yoksa SKIPPED) gecici bir repoda, sentetik gizli dosyalarla A ve B durumunda calistirir ve iki cikti arasindaki farki siniflar: FAIL = dosya adi, satir sayisi veya icerik farki ya da canary dizisi; WARN = ayni satirlar, yalniz sira farki; FLAKY = A tekrari ilk A ile eslesmiyor (harness hatasi). Kategoriler: C1 kontrol, C3 surucu-bagil, C5 ters bolu, C6 bagli secenek degeri, C8 yalniz PowerShell (`@var`, virgullu cift). Kapsam disi: C2, C4 (yalniz birim testleri), C7, C9 (OFFICE-003.md, Goal 3).
- Nasil calistirilir: varsayilan `node --test test/scope-guard-oracle.test.mjs`. Kalibrasyon: `ORACLE_CALIBRATION=1` ile ayni komut (esdegerlik kontrolu, ortam ablasyonu, 300-per-shell olcumu; varsayilanda 3 test atlanir). Test grup 1 veya grup 2'ye EKLENMEMISTIR (opt-in).
- Sinirlar (LIMITS, oracle dosyasi satir 32): totalMs 90000 (oracle fazi), defaultRunMs 240000 (tum varsayilan kosu), calibrationRunMs 720000 (tum kalibrasyon kosusu); ek guvenlik tavanlari: generated 5000, perShell 300, cmdTimeoutMs 10000. Gozlenen sureler (OFFICE-003.md, Stage 6 [DIRECTOR]): varsayilan 114 s, kalibrasyon 408 s. Kalibrasyon kosusu opt-in; asim = yeniden kos, guvenlik sinyali degil.
- Ek: Owner run 122 s (stopwatch, 2026-11-14, Owner PowerShell). Durations vary with machine and load; ceilings are 90 s oracle phase, 240 s default run, 720 s calibration run. [AGENT]
- KNOWN_OPEN: oracle'in mevcut hook'ta buldugu FAIL ve WARN bulgularinin listesi: 38 kayit (19 aday x 2 shell, hepsi C6). Karsilastirma tam esitliktir: yeni bir bulgu (olasi yeni aciklik) VEYA kaybolan bir bulgu (hook degisti, Owner listeyi guncellemeli; ya da dedektor bozuldu) testi dusurur. Liste Owner onayiyla degisir; ajanlar duzenlemez. Durum: v1 FINAL (Owner, 2026-11-14). "Kayitli acik sorun, kabul edilmis degil." EXISTENCE_CONFOUND: 3 candidates x 2 shells = 6 records (6 of the 38) (B durumu a1.txt'yi siler; icerik sizintisi bu kayitlar icin GOSTERILMEDI). Note: the KNOWN_OPEN_APPROVAL string in the oracle file (line 34) still reads 'v1 = WORKING BASELINE ... final approval after independent review'; the FINAL approval is recorded only in docs/tasks/OFFICE-003.md (Owner, 2026-11-14). The string was not changed so that the verified revision stays unchanged; updating it needs a re-run.
- Mutantlar: hook ve scripts/guard-scope.mjs'in kopyalari gecici kokte uretilir (gercek dosyalar degismez): M1 surucu-bagil kontrolunu, M2 ters bolu kontrolunu, M3 `@` kontrolunu kaldirir; oracle her birini FAIL olarak isaretlemelidir; hedef metin yoksa test yuksek sesle dusur. Sonuclar [DIRECTOR/AGENT], OFFICE-003.md: M1 18 FAIL / 88 calistirilan = Stage 3; M2 2 FAIL / 24 = Stage 3, 6 FAIL / 30 = Stage 5; M3 2 FAIL / 6 = Stage 3. Stage 4 ve Stage 6 icin mutant sayisi: UNKNOWN (kayitta yok). mutant counts were not re-measured on the final revision (commit 0733e96). [AGENT]
- Yurutme guvenligi katmani: `decide()`'dan BAGIMSIZDIR. Her adayin elle atanmis execClass'i (READ veya STATIC_ONLY) vardir; calistirma noktasinda `writerHit()` yazan/calistiran secenekleri (`--output`, `--ext-diff`, `--textconv`, `-c`, `--exec-path`, `--open-files-in-pager`, kisaltmalari, ters bolulu ve tirnakli bicimleri) tarar ve calistirmayi reddeder. Bu listenin git'in tamami icin eksiksizligi UNKNOWN (oracle dosyasinda belirtilmis). Gecici kok proje icinde olamaz (assertOutsideProject, her cagrida).
- Ortam allowlist'i: cocuk surecler sifirdan kurulan minimal ortamla calisir (miras GIT_* yok, HOME/TEMP gecici kokte). Zorunlu: PATHEXT (PowerShell'de yoklugu tum komutlari ayni sekilde basarisiz eder; C6 bulgulari PASS gorunur). ComSpec ve windir gerekli gosterilmedi (ablasyonda fark yok), zararsiz oldugu icin korundu (OFFICE-003.md, Env ablation).
- Bilinen sinirlamalar:
  - (a) Bos `node --test` kesfi: Node, dosya adi verilmeden test/ altindaki dosyalari kesfeder, dolayisiyla bos `node --test` oracle'i da calistirir; grup 1 ve 2 dosyalarini acikca adlandirir (OFFICE-003.md, Owner decisions). Oracle'i yalniz adiyla calistirin; grup komutlarini adli dosyalarla kullanin.
  - (b) Sure/zaman payi degiskenligi: gozlenen varsayilan sureler 93 s ile 144 s, kalibrasyon 393 s ile 463 s arasinda degisti (makine yuku). Oracle'i bosta bir makinede ve tek ornek olarak calistirin; sure asimi = yeniden kos, guvenlik sinyali degil.
  - (c) makeRoot testi (oracle-003-* sayimi) ayni anda ikinci bir oracle kosusuna duyarlidir; "bosta makine, tek ornek" (OFFICE-003.md, Owner decision).
