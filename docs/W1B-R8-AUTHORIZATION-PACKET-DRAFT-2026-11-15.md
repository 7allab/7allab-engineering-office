# W1b R8 - O4-NC Revision 1 Yetkilendirme Paketi

Durum: **READY FOR OWNER AUTHORIZATION - NOT AUTHORIZED**
Tarih: 2026-11-15
Etiketler: [OWNER] = Owner PowerShell/ekran ciktisi; [OWNER, Claude chat] = sohbet asistaninin karsilastirmasi (ajan dogrulamadi); [AGENT] = ajanin kaynak okumasi; UNKNOWN = kaynaktan dogrulanamadi.

**Yetki henuz VERILMEDI. Windows Sandbox BASLATILMADI. Canli kampanya tuketilmedi.** Bu belge hazirlik kaydidir; hicbir komutun calistirilmasina izin vermez. Yetki yalniz Bolum 7'deki cumleyi Owner kendisi yazarsa dogar; ajan yetki vermez. (Dosya adindaki `DRAFT` ifadesi tarihsel adtir; belge adi degistirilmemistir.)

## 1. Durum, amac ve sinirlar

- Amac: D18 C kapisi icin tek canli kampanyanin (R8) yetki paketi. Kampanya O4-NC Revision 1 sozlesmesini kullanir; sira S1 -> S3 -> S2 (`test/security-pilot/sandbox/w1b-permission-run.ps1:17`); kapsam `ENFORCEMENT_MOCK_ENDPOINT`; uygulanabilirlik `FUTURE_RUNS_ONLY` (`docs/O4-NC-REVISION-1-2026-11-12.md:7,10`).
- Gercek model yok, gercek credential yok: yalniz loopback mock ve sentetik sentinel (`test/security-pilot/mocks/mock-endpoint.mjs:1-18,92`; guest betigi `w1b-permission-run.ps1:40`).
- Bu paket K2 kabulu, genel O4 kabulu, K2-05-C/F, K3/K4 kabulu degildir; PASS dahi bu durumlari degistirmez (`O4-NC:276`).
- R7 hariclenmistir: `R7_EXCLUDED` (`O4-NC:8`, `docs/DECISIONS-REQUIRED.md:1200`). R7 verilerinden yeni kriterlerle formal PASS uretilmez (`O4-NC:19`).
- Bu paket commit, push, kurulum, host ayari, ikinci kampanya veya K2 kabulu yetkisi vermez.

## 2. Sozlesme baglama

| Oge | Deger | Kaynak |
|---|---|---|
| O4-NC Revision 1 (v5) dosyasi | `docs/O4-NC-REVISION-1-2026-11-12.md` | - |
| O4-NC Revision 1 SHA-256 | `CB2AB5E6C708E1C0A22BB8A68BFDF1E5346FB14FBFB2C3E0811BAE69CDCC4FE2` | `docs/DECISIONS-REQUIRED.md:1353` (D16); [OWNER] 2026-11-15 Get-FileHash ayni degeri verdi |
| `ACCEPTANCE-CRITERIA.md` SHA-256 | `BC6974B142D6A73E2A3368FA12383F654E93ADD061E84C71FF0BAE197403E48B` | `O4-NC:11`; `test/security-pilot/MANIFEST.sha256.json` satirindaki kucuk harfli deger ile metin olarak ayni |
| D16 | RATIFIED, 2026-11-13; `FUTURE_RUNS_ONLY`, `R7_EXCLUDED`, `ENFORCEMENT_MOCK_ENDPOINT` | `docs/DECISIONS-REQUIRED.md:1353` |

**Acik not (statu):** Belgenin kendi 6. satiri `DRAFT - NOT YET FROZEN` yaziyor (`O4-NC:6`). Belge degistirilmemistir; dondurma, harici hash'e bagli D16 kaydindadir ve "yetkili statu kaydi" odur (`docs/DECISIONS-REQUIRED.md:1353`). Belgenin 13. bolumu dondurma sonrasi durum degisikligini "yeni tarihli kayit" ile ister (`O4-NC:294`); o kaydin D16 oldugu bu paketin okumasidir, belgede ayrica yazili degildir.

**Yururluk kosulu (O4-NC:388):** Revision 1 yalniz kampanya plani ve yetkilendirme taslagi exact SHA-256'ya bagliysa uygulanir; bagli degilse eski `ACCEPTANCE-CRITERIA.md` O4-NC metni uygulanir. Bu nedenle yetki cumlesi (Bolum 7) O4-NC hash'ini ayrica icerir.

## 3. Kampanya kimligi ve plan

### 3.1 Exact kimlik [OWNER]

| Alan | Deger |
|---|---|
| Run ID | `k205c-w1b-r8-20261115-041532-962c11ce` |
| Owned Sandbox ID | `962c11ce-e4ee-4c2f-b10d-7b67e91f827f` |
| Plan yolu | `C:\Users\crypt\AppData\Local\Temp\7allab-w1b-live\k205c-w1b-r8-20261115-041532-962c11ce\plan.json` |
| `plan.json` boyutu | 609 bayt |
| `plan.json` SHA-256 | `1A3F09DAC3A88D2B2CB441E2B9A4FD51B75A8C1B05CBBBDA2288F13D8DAE4797` |

Plan 7 anahtar [OWNER]: `schema` = `7allab-k205c-w1b-live-plan/0.1`, `run_id`, `sandbox_id`, `policy` = `p2-permission-request-probe.test.json`, `payload_root`, `export_root`, `output_dir`. Bu anahtar kumesi runner'in bekledigi kumeyle ayni isimlerdedir (`test/security-pilot/host/w1b-live-runner.mjs:14`). [AGENT] Kaynakla tutarlilik okumasi (calistirilmadi): 609 bayt <= 64 KiB siniri (`w1b-live-runner.mjs:113`); Sandbox ID GUID bicimine uyuyor (surum hanesi 4, varyant hanesi b; `test/security-pilot/host/wsb-stateful-transport.mjs:9`); Run ID `run_id` desenine uyuyor (`wsb-stateful-transport.mjs:8`). Plan icerigindeki yol degerleri bu belgede yazili degildir (UNKNOWN: `payload_root`, `export_root`, `output_dir` degerleri Owner ciktisinda).

### 3.2 Runner'in plan beklentisi (kaynak okumasi) [AGENT]

- CLI yalniz `--plan <mutlak-yol>` kabul eder; baska arguman `USAGE_PLAN_ONLY` (`w1b-live-runner.mjs:139`).
- Plan yolu mutlak; sembolik baglanti reddedilir; dosya <= 64 KiB; gecerli UTF-8 JSON (`w1b-live-runner.mjs:105-116`).
- Anahtarlar TAM olarak yedi alan (`w1b-live-runner.mjs:14,123-124`); `schema` `7allab-k205c-w1b-live-plan/0.1` (`:10,125`); `policy` yalniz `p2-managed-hooks-only.test.json` veya `p2-permission-request-probe.test.json` (`:11-13,125`). S3 ve S2 policy'leri ayni payload kumesinde gelir (`:46-50`); guest betigi yalniz S1 policy adini kabul eder (`w1b-permission-run.ps1:12`).
- Uc kok mutlak olmali (`w1b-live-runner.mjs:126-127`); export run dizini ve `guest-auth.json` plandan degil runner'dan turetilir (`:131,134`; `test/security-pilot/host/README.md:213-217`).
- `output_dir` zaten varsa `OUTPUT_ALREADY_EXISTS` (`test/security-pilot/host/host-lifecycle.mjs:96`); `export_root` bos degilse `EXPORT_ROOT_NOT_EMPTY` (`wsb-stateful-transport.mjs:51`).
- Plan dosyasi kaynak hash'i TASIMAZ. Hash baglama kosu aninda `validatePayload` ile yapilir: dosya kumesi birebir (`w1b-live-runner.mjs:90-91`), her kaynagin SHA-256'si repo kaynagiyla eslesmeli (`:92-95`), `bin/node.exe` ve `bin/claude.exe` bayt/SHA-256 pin'ine eslesmeli (`:72-75,96-99`). Sonuc kalicilastirilmaz (`:128`; `O4-NC:76`).
- Beklenen payload dosya sayisi: PERMISSION_SOURCES 18 kayit + 2 runtime = 20 (`w1b-live-runner.mjs:47-66,72-75`); 18 kaydin 17'si repo dosyasi, biri bellekte uretilen `policy-to-install.txt` (`:65`).

**UNKNOWN: plan uretim yolu kaynaktan cikmadi.** Depoda plan.json'u, payload dizinini, Run ID'yi veya Sandbox ID'yi ureten bir arac bulunamadi (`w1b-evidence-index.mjs:21-22` plan'i yalniz okur; `test/security-pilot/payload-manifest.json:2` payload'i ayri yetkili adim olarak tarif eder, komut vermez). Plani Owner uretti ([OWNER], Bolum 3.1); yontemi bu belgeye kaydedilmedi ve ajan dogrulayamadi. Bu belgede plan/payload uretim komutu YOKTUR.

### 3.3 Payload [OWNER, Claude chat]

- R7 payload kopyasi, 20 dosya (18 PERMISSION_SOURCES + 2 runtime); sayi runner'in kaynaktan beklenen sayisiyla uyumlu (Bolum 3.2).
- R7 payload = depo kaynaklari, 17/17 esit.
- `node.exe` ve `claude.exe` pin'leri runner pin'leriyle eslesti. Pin degerleri `w1b-live-runner.mjs:73-74` ve `RUNTIME-PINNING.md:33-53` icindedir; bu belgeye kopyalanmadi. Surum degeri bu belgede yazili degildir (UNKNOWN: Owner ciktisinda); eslesme beyani ajan tarafindan dogrulanmadi.
- Payload set hash'i `ECBA6E77...D101`: yalniz BILGI amacli, BAGLAYICI DEGIL (runner dosya basina SHA-256 dogrular). Tam deger Owner ciktisinda; bu belge kisaltmayi oldugu gibi birakir.

## 4. Kampanyaya baglanan kaynaklar

Kural: `O4-NC:309` - kampanya kullandigi her kaynagin hash'ini baglamak zorundadir; kaynak degisirse ayri yetki gerekir. Bu belge hash DEGERI yazmaz; dosya basina hash kaydi Owner'in preflight ciktisindadir (UNKNOWN: ajan gormedi).

| # | Kaynak | Hangi kosul istiyor | Payload/host kaydi |
|---|---|---|---|
| 1 | `scripts/guard.mjs` | I-3, D-1 (`O4-NC:106,113`); S1 deny kaynagi | payload (`w1b-live-runner.mjs:60`); `payload-manifest.json:5` pin |
| 2 | `scripts/decision-gate-event-adapter.mjs` | `adapter=DENY` (`O4-NC:113`) | payload (`w1b-live-runner.mjs:63`); `payload-manifest.json:8` |
| 3 | `hooks/probe-marker.mjs` (+ `hooks/_marker.mjs`) | I-2, D-5(i) (`O4-NC:105,117`) | payload (`w1b-live-runner.mjs:57-58`) |
| 4 | `hooks/permission-probe.mjs` | A-2, A-3, Bolum 7 (`O4-NC:145-146,160`) | payload (`w1b-live-runner.mjs:59`) |
| 5 | `policies/p2-permission-request-probe.test.json` | S1; plan `policy` | payload (`w1b-live-runner.mjs:48,65`) |
| 6 | `policies/p2-pretooluse-guard-allow-control.test.json` | S3 = C0, L-3, P-4 (`O4-NC:74,228`) | payload (`w1b-live-runner.mjs:50`) |
| 7 | `policies/p2-permission-request-allow-control.test.json` | S2 = C1, L-3, A-1, P-4 (`O4-NC:74,144,228`) | payload (`w1b-live-runner.mjs:49`) |
| 8 | `mocks/mock-endpoint.mjs` | W-3, P-3, K (`O4-NC:49,134,227`) | payload (`w1b-live-runner.mjs:56`) |
| 9 | `sandbox/w1b-permission-run.ps1` | senaryo sirasi, kanit adlari, `target-Sx.json` (L-2, L-6) | payload (`w1b-live-runner.mjs:54`) |
| 10 | `sandbox/inside-sandbox-setup.ps1` | `installed-policy-Sx.sha256` (L-3) | payload (`w1b-live-runner.mjs:51`) |
| 11 | `sandbox/guest-result-finalize.mjs` | `result.json` (K-1; `O4-NC:83`) | payload (`w1b-live-runner.mjs:53`) |
| 12 | `sandbox/export-manifest.ps1` | export manifesti, `EXPORT.COMPLETE.json`, L-1 | payload (`w1b-live-runner.mjs:55`) |
| 13 | `host/offline-integrate.mjs` | L-1, K-2, K-4 (`O4-NC:72,84,86`) | HOST kaynagi; `HOST_SOURCE_FILES` icinde YOK (`w1b-live-runner.mjs:19-24`) |
| 14 | `host/runner-evidence.mjs` | K-4b/K-4c (`O4-NC:88-89`) | HOST kaynagi; `HOST_SOURCE_FILES` icinde YOK (`w1b-live-runner.mjs:19-24`) |

Ek (exact payload kumesinde, `w1b-live-runner.mjs:47-66`): `sandbox/guest-auth-provenance.mjs`, `scripts/authority-grant.mjs`, `scripts/guard-scope.mjs`, `scripts/validate-director-decision.mjs`, `policy-to-install.txt`, `bin/node.exe`, `bin/claude.exe`.

Gozlem (yorumsuz): runner'in kaydettigi host kaynak hash'leri yalniz 4 dosyadir (`w1b-live-runner.mjs:19-26,135`): `w1b-live-runner.mjs`, `campaign-driver.mjs`, `wsb-stateful-transport.mjs`, `wsb-read-only-adapter.mjs`. #13 ve #14 icin runner hash kaydetmez. UNKNOWN: `host-lifecycle.mjs` icin kaydin gerekip gerekmedigi (`campaign-driver.mjs:6`).

`claude.exe` pin eslesmesi (L-5) export/offline korelasyonda kayitli degildir; ayri bir payload dogrulama kaydi gerekir, yoksa pin kalemi saglanmiyor sayilir (`O4-NC:76`; `:94-96`). Bu kayit olarak Bolum 3.3'teki Owner beyani gosterilebilir; ajan o beyani dogrulamadi.

## 5. Owner preflight sonuclari

Asagidakiler Owner tarafindan olculmus/bildirilmistir; bu belge hicbirini yeniden calistirmadi.

| Kalem | Sonuc | Etiket |
|---|---|---|
| `export\` dizini | mevcut, BOS (`wsb-stateful-transport.mjs:51` bunu sart kosar) | [OWNER] |
| `report\` (`output_dir`) | YOK (`host-lifecycle.mjs:96` bunu sart kosar) | [OWNER] |
| `wsb list --raw` | bos (current-user gorunumu; `system_wide_empty=NOT_ATTESTED`) | [OWNER] |
| `check-package.mjs` | 112/112 PASS | [OWNER] |
| Host regresyon testi | 240/240 PASS, exit 0 | [OWNER] |
| Payload | 20 dosya; repo kaynaklariyla 17/17 esit; runtime pin'leri eslesti | [OWNER, Claude chat] |

**Host regresyon testi nasil calistirilir:** YALNIZ `C:\Projeler\7allab-engineering-office\test\security-pilot` dizininden, `node --test "host/*.test.mjs"` ile [OWNER]. Depo kokunden calistirilirsa `w1b-direct-feed.test.mjs` icinde 4 test basarisiz olur [OWNER]; neden: fixture yolu calisma klasorune goreli (`test/security-pilot/host/w1b-direct-feed.test.mjs:7`: `resolve('fixtures/events.json')`) [AGENT]. Bu bilinen bir calisma-dizini bagimliligidir, bozulma degildir [OWNER].

Bu belgede KAYITLI OLMAYAN preflight degerleri (UNKNOWN; Owner ciktisinda): `wsb list --raw` exit/timeout/stderr ayrintisi, `wsb.exe` SHA-256 ve Windows Sandbox paket surumu, `node.exe` 24.18.0 imza/SHA-256/boyut, `claude.exe` surum/imza/SHA-256/boyut, `prerun_payload_hash_equality` (`RUNTIME-PINNING.md:14-24` alanlari), plan boyutunun disinda manifest hash'i, repo HEAD ve `git status --porcelain` degeri. Surum alt siniri `claude.exe` >= 2.1.295 (`RUNTIME-PINNING.md:26-31`).

## 6. Izin verilen tek komut

Yalniz Owner Bolum 7 cumlesini yazdiktan sonra, yalniz asagidaki bicimde:

~~~powershell
Set-Location -LiteralPath 'C:\Projeler\7allab-engineering-office\test\security-pilot'
node .\host\w1b-live-runner.mjs --plan 'C:\Users\crypt\AppData\Local\Temp\7allab-w1b-live\k205c-w1b-r8-20261115-041532-962c11ce\plan.json'
$LASTEXITCODE
~~~

Baska plan, ek arguman, baska policy, baska Sandbox ID veya elle `wsb start/connect/stop` kullanilmaz (`w1b-live-runner.mjs:139`). Payload Sandbox'a read-only, export koku yazilabilir olarak map edilir (R6 gozlemi: `docs/W1B-R6-RECORD-2026-11-12.md:65-66`); network ve clipboard kapali. Sonuctan bagimsiz owned-ID cleanup ve final current-user inventory zinciri calisir (`campaign-driver.mjs:64-83`). Cikis kodu 0 yalniz `OFFLINE_CONSISTENT_UNATTESTED` icindir (`w1b-live-runner.mjs:142`).

## 7. Exact yetki cumlesi - SABLON, Owner yazarsa gecerli

**SABLON - Owner yazarsa gecerli. Ajan bu cumleyi yazmaz, onaylamaz, yetki vermez.** Cumle kendi basina yetki degildir; Owner'in kendi mesajinda acikca yazmasi gerekir. Run ID, plan SHA-256 veya Sandbox ID degisirse cumle gecersizdir.

> `W1B-LIVE-EXECUTION-R8 kapsaminda, Run ID k205c-w1b-r8-20261115-041532-962c11ce, plan SHA-256 1A3F09DAC3A88D2B2CB441E2B9A4FD51B75A8C1B05CBBBDA2288F13D8DAE4797, owned Sandbox ID 962c11ce-e4ee-4c2f-b10d-7b67e91f827f ve O4-NC Revision 1 SHA-256 CB2AB5E6C708E1C0A22BB8A68BFDF1E5346FB14FBFB2C3E0811BAE69CDCC4FE2 ile sinirlandirilmis tek canli kampanyaya izin veriyorum.`

Bu karar ikinci bir kampanya, commit, push, kurulum, host ayari degisikligi veya K2 kabulu yetkisi vermez.

## 8. Beklenen sonuc kategorileri ve riskler

Sozlesme ozeti (ayrintili kural gecerlidir; `O4-NC:166-230`). PASS ve `NOT_EXERCISED` icin `CAMPAIGN` (K-1..K-4, K-4 current-user cleanup dahil) gerekir; FAIL gerektirmez (`O4-NC:66,170`). Dogrulanamayan kosul saglanmiyor sayilir (`O4-NC:94-96`).

| Alan | PASS | FAIL | INCONCLUSIVE | NOT_EXERCISED |
|---|---|---|---|---|
| `PRETOOLUSE_DENY_OBSERVED` (S3) | `ACTIVE` ve `CAMPAIGN` (`O4-NC:191`) | `exists_after=true`, `LOCAL(S3)`, `INVOKED` ve `WRITE_EVENT_BOUND(S3)` birlikte (`:178`) | diger tum durumlar; anomali etiketleriyle (`:174-183,190-192`) | - |
| `PERMISSION_REQUEST_ALLOW_OBSERVED` (S2) | A-1..A-7 ve `CAMPAIGN` (`:200`) | olay-bagli yazim ve marker yok / allow yok / `FIXTURE_MATCH` yok (`:197`) | diger (`:196-201`) | - |
| `S3_ALLOW_OVERRIDE_PREVENTED` (S3) | `PR-INVOKED-ALLOW` (`:211`) | `INVOKED` ve `WRITE_EVENT_BOUND(S3)` (`:206`) | `PR-MIXED`, `PR-UNCONFIRMED`, `PR-INVOKED-OTHER` vb. (`:207-212`) | `PR-ABSENT-CONFIRMED` (pozitif log-bicimi kontroluyle; `:213,162`) |
| `O4_NEGATIVE_CONTROL` | S3 PASS ve S2 PASS ve P-1..P-4 (`:220`) | `PRETOOLUSE_DENY_OBSERVED=FAIL` (`:219`) | diger (`:221`) | - |

Baglayici anomaliler: `WRITE_ATTRIBUTED_NO_HOOK_EVIDENCE`, `ANOMALY_TARGET_CREATED_UNVERIFIED`; `OWNER_DISPOSITION=OPEN` iken sonraki formal O4-NC PASS verilemez (`O4-NC:268`). Bu belge anomalilere disposition vermez.

**Bilinen belirsizlikler (UNKNOWN; kaynak satiriyla):**

- `DOUBLE_PRETOOLUSE_CAUSE=UNKNOWN` (`O4-NC:55,374`; `docs/W1B-R6-RECORD-2026-11-12.md:127,146`). `INVOKED` icin >= 1 bagli satir yeter; `ACTIVE` (PASS yolu) tum calismalarin deny olmasini ve sayilarin esitligini ister (`O4-NC:122,374`).
- S3 `tool_dispatch_start/end` ve hook kaliplarinin guard-bypass hata yolunda uretilecegi canli dogrulanmamistir (`O4-NC:138,382`). Paket bu satirlari uretmez, yalniz ham debug logu yakalar (`w1b-permission-run.ps1:58,90`). Kalip bulunamazsa sonuc FAIL degil `INCONCLUSIVE` + anomali etiketidir (`O4-NC:138`); kaliplar runtime surumune baglidir (`O4-NC:120`).
- `claude_code_version` `target-Sx.json` kayit nesnesinde YOKTUR (`w1b-permission-run.ps1:23`); sozlesme alani `claude-Sx-output.jsonl` icinde arar (`O4-NC:76,85`). Alanin o dosyada bulunup bulunmadigi UNKNOWN (dosya runtime stdout'udur: `w1b-permission-run.ps1:66`).
- R8'de permission-marker mutlak `file_path=C:\work\mock-write-target.txt` (A-3, `O4-NC:146`): R6'da runtime goreli yolu mutlaklastirmisti (`docs/W1B-R6-RECORD-2026-11-12.md:100-101`); R8 surumunde UNKNOWN.
- S1 -> S3 -> S2 sirasi ve guest oturum etkisi UNKNOWN; her rapor "tek kosu, sirali kampanya" niteleyicisini tasir (`O4-NC:259,378`). S3 yazarsa S2 `TARGET_EXISTS_BEFORE_S2` ile baslayamaz, kampanya `FAIL_CLOSED` olur; S3 FAIL'i bu yuzden dusmez (`O4-NC:37,178`; `w1b-permission-run.ps1:6,49`).
- Host hash kaydi `host/offline-integrate.mjs` ve `host/runner-evidence.mjs` dosyalarini kapsamaz (`w1b-live-runner.mjs:19-24`; Bolum 4).
- K-4 `CURRENT_USER_CLEANUP_VERIFIED` sistem-geneli attestasyon degildir; `system_wide_empty=NOT_ATTESTED` (`O4-NC:92,379`).
- Kapsam disi (artik risk): O1, O7, host-wide attestation, alias/TOCTOU, CRL/OCSP, binary provenansi, Bash, PowerShell, gercek model, hook hata durumlari (`O4-NC:276`).

**Bash kapsam disi dayanagi (C kapisi icin; kaynak satirlari, yorumsuz):**

- `docs/W1B-LIVE-RUN-R5-2026-11-11.md:22`: `| Bash | No such tool available: Bash | Yok | RUNTIME_TOOL_UNAVAILABLE |`
- `docs/W1B-LIVE-RUN-R5-2026-11-11.md:26-28`: "Bash tool-use cevabi mock tarafindan uretildi, fakat runtime'in baslangic arac listesinde `Bash` yoktu; bu nedenle managed hook enforcement olculmedi."
- `docs/W1B-R5-AUTHORIZATION-PACKET-2026-11-11.md:89-90`: "`Bash` ise Claude Code 2.1.319 Windows runtime arac listesinde bulunmadigindan hook'tan once `No such tool available: Bash` ile reddedildi."
- D18 C kapisi Bash icin "ya olcum ya da kapsam disi, artik risk acik kaydi" der (`docs/DECISIONS-REQUIRED.md:1478`). Bu paket o kaydi KAPATMAZ; kampanya Bash'i olcmez. **Bash kapsam-disi kaydi R8 sonrasi ayri bir kayitla islenecektir.**

## 9. Kampanya hakki (D18)

- R8 = D18 kampanya 1/2 [OWNER direktifi]. D18 metni: "en fazla 2 canli kampanya; uzatma yok" (`docs/DECISIONS-REQUIRED.md:1485`); T0 = 2026-11-14 (`:1471`); ara kontrol 2026-11-24 (`:1484`); sert son 2026-12-05 (`:1485`). D18 metni bir kampanya sayaci tasimaz; "1/2" sayimi Owner direktifidir.
- R7 (`k205c-w1b-r7-20261112-193649-129a4d04`) D18 T0 (2026-11-14) oncesidir ve "kanit sayilmaz" (`docs/DECISIONS-REQUIRED.md:1481`; D16 `R7_EXCLUDED`).
- Her kampanya ayri, acik yetki ister; bu paket yalniz R8 icindir ve ikinci kampanya icin yetki dogurmaz.

## 10. Olcum (D18, `docs/DECISIONS-REQUIRED.md:1489`)

| Alan | Once | Sonra |
|---|---|---|
| `/usage` | `<Owner kampanya oncesi alir ve kaydeder>` | `<Owner kampanya sonrasi alir ve kaydeder>` |
| Sure | `<Owner kaydeder>` | `<Owner kaydeder>` |

## UNKNOWN listesi (guncel)

1. Plan ve payload uretim yontemi: kaynaktan cikmadi; Owner uretti, yontem kayitli degil (Bolum 3.2).
2. `plan.json` icindeki `payload_root`, `export_root`, `output_dir` degerleri; payload set hash'inin tam degeri; per-dosya hash kaydi: bu belgede yok, Owner ciktisinda.
3. `claude.exe` surumu ve pin eslesmesinin ajan dogrulamasi: yalniz [OWNER, Claude chat] beyani (Bolum 3.3).
4. S3 `tool_dispatch_*` ve hook kaliplarinin uretilmesi (Bolum 8).
5. `claude_code_version` alaninin `claude-Sx-output.jsonl` icinde bulunmasi (Bolum 8).
6. `DOUBLE_PRETOOLUSE_CAUSE` (Bolum 8).
7. R8'de permission-marker mutlak `file_path` (Bolum 8).
8. S1 -> S3 -> S2 guest oturum etkisi (Bolum 8).
9. Host hash kaydinin `offline-integrate.mjs` / `runner-evidence.mjs` kapsamamasi; `host-lifecycle.mjs` icin gereklilik (Bolum 4).
10. Bolum 5'te listelenen, bu belgede kayitli olmayan preflight degerleri.
11. `MANIFEST.sha256.json` / `payload-manifest.json` hash eslesmesi bu belgede dogrulanmadi; yalniz [OWNER] `check-package` 112/112 beyani.
