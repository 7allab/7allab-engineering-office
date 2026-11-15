# K2 D18 D ve E: SHA-256 + provenans kaydi (2026-11-15)

Etiketler: [OWNER] = Owner PowerShell kosusu; [OWNER, Claude chat] = sohbet asistaninin repodan okudugu karsilastirma, bagimsiz inceleme degil. Degerler `k2-hash-record.txt` dosyasindan kopyalanmistir.

## 1. Yontem

- Kaynak: `k2-hash-record.ps1` (Owner PowerShell 5.1). Salt okunur; dosya icerigini rapora yazmaz; hash icin baytlari okur. [OWNER]
- Boyut 3512, SHA-256 69BC9D62F156835DA9B60810DF169419421BC132279F4E6188493B8A94A0E6A6 (Owner'in bildirdigi deger; `k2-hash-record.txt` icinde yok). [OWNER]
- Cikti: 152 satir (`k2-hash-record.txt`). [OWNER]
- Hash = BUGUNKU icerik. Incelenen surumle esitligi, daha eski bir hash olmadikca GOSTERILMEZ.

## 2. E tablosu (4 dosya)

Kaynak: txt "=== E" bolumu (`C:\Users\crypt\k2-05-e-test`). [OWNER]

| Ad | Tam yol | SHA-256 | Bayt | mtimeUTC |
|---|---|---|---|---|
| test1-read.json | C:\Users\crypt\k2-05-e-test\test1-read.json | E1830BA1A9B92BD4B2EE001E9D5A0A16E4BE598AB3F60C607D12DBA9CEF769FC | 2854 | 2026-11-07 09:03:32 |
| test1b-read.json | C:\Users\crypt\k2-05-e-test\test1b-read.json | 0DACF9AE960F66F639360ADAFAF885BDC48A01DD9B6E80103087C764A43F91AA | 2840 | 2026-11-07 09:04:36 |
| test2-bashoutput.json | C:\Users\crypt\k2-05-e-test\test2-bashoutput.json | C894FBF03CEFE047FD0041C77F075956B80923C479574B9A8FCF628DC4B0F09C | 2838 | 2026-11-07 09:05:28 |
| test3-inputsecret.json | C:\Users\crypt\k2-05-e-test\test3-inputsecret.json | B2F5B80836B90A856892DB8D87A6C2DCF61F80B37A63025165A4CF53B8D56A6C | 3125 | 2026-11-07 09:06:06 |

Provenans:
- Dosyalar 2026-11-07 09:03-09:06 UTC'de yazilmis (mtime; txt degerleriyle karsilastirildi, uyumlu).
- `docs/DECISIONS-REQUIRED.md` satir 808-816, icerigin ham transkriptle dogrulandigini ve bu dort dosya icin kayitli SHA-256 OLMADIGINI soyler.
- `git grep` ile bu hash'lerin belgelerde HIC gecmedigi dogrulandi [OWNER, Claude chat].
- Sinir: bu ILK kayitli hash'tir; incelenen surumle esitligi GOSTERILMEZ (kalici artik risk).

## 3. D tablosu

Staged paket: `C:\Users\crypt\7allab-k2-production-staging-20261030`. Kaynak: txt "=== D1" bolumu; 19 dosya (18 + manifest). Yollar pakete goredir. [OWNER]

Manifest: created 2026-10-30; note "K2-04-G1 offline package, NOT INSTALLED"; `MANIFEST.sha256.json` SHA-256 0AD0618FBEC7F1422E2EC9FD4E064A6EE0C00E78410447AC97ADAD49313FBDE4, 4842 bayt (mtimeUTC 2026-10-30 07:48:56).

| Yol | SHA-256 | Bayt | Manifest |
|---|---|---|---|
| docs\G1-README.md | 7FB2A4446319854C17E36D6B339AF74B0C9E1F8A64164F11F3ED3F418BBE37A3 | 3443 | MANIFESTTE: EVET |
| payload\ProgramFiles\7allab-security\authority-grant.mjs | B20284F6CA93F77DD8855979B67365E7F248A76952036DCBDC280D71E63277C4 | 13804 | MANIFESTTE: EVET |
| payload\ProgramFiles\7allab-security\decision-gate-event-adapter.mjs | 486E510BE3723E4223BF2B9DE245EF35262A4F5E131BEE8DAF59E6C25BF909FE | 13271 | MANIFESTTE: EVET |
| payload\ProgramFiles\7allab-security\guard-scope.mjs | A4EA9FF7F554A30C21CFA4838D922CFB44C377A8E6916BECB1B9B113732B9053 | 9260 | MANIFESTTE: EVET |
| payload\ProgramFiles\7allab-security\guard.mjs | 6DB9C5474333B6FED31019F880C8B10507E304122A841A7C4650462625312EE8 | 10738 | MANIFESTTE: EVET |
| payload\ProgramFiles\7allab-security\identity-gate.mjs | CB83A3AD54D759FE9CF2F782D3F620D1DA3311588B42961975EFACEF3AC0435A | 6644 | MANIFESTTE: EVET |
| payload\ProgramFiles\7allab-security\validate-director-decision.mjs | 23EB84F2F526CB5C2F2224F568710FD88EFDBEF10A32E6E0D4647D3F25A9A002 | 37199 | MANIFESTTE: EVET |
| payload\ProgramFiles\ClaudeCode\managed-settings.json | D9B7DC681EA07FF7439F3FB4B223F5A7228FA061214FB58F05F5FE615A241A5B | 1195 | MANIFESTTE: EVET |
| tests-only\authority-grant.mjs | B20284F6CA93F77DD8855979B67365E7F248A76952036DCBDC280D71E63277C4 | 13804 | MANIFESTTE: EVET |
| tests-only\guard-scope.mjs | A4EA9FF7F554A30C21CFA4838D922CFB44C377A8E6916BECB1B9B113732B9053 | 9260 | MANIFESTTE: EVET |
| tests-only\identity-gate.TEST-ONLY.ccagent.mjs | 58DC280CE82E4E75D46D5F53D4D72E8F05863ED74CC9E14AB5E80AE540B92267 | 6764 | MANIFESTTE: EVET |
| tests-only\identity-gate.TEST-ONLY.unknown.mjs | 8B341CCAD23E2722FF000877F700B5F6AB995F79014BA34306EE108344A1565B | 6745 | MANIFESTTE: EVET |
| verify\check-policy.mjs | B230FB4813C1CD656C0CF976D35AAEEF0AA55C605566945436A144BD1A40103B | 3126 | MANIFESTTE: EVET |
| verify\result-1-policy-check.json | E2FD306EA41CF051991893D072EF7BFA133BD0B3921495C95C857CEEE6326AD3 | 3512 | MANIFESTTE: EVET |
| verify\result-2-real-crypt-direct-feed.json | BC2A7BD57FF62D9880124479C708B7538629B257E2FC5EFFBA56C408337E3B9F | 1108 | MANIFESTTE: EVET |
| verify\result-3-ccagent.json | 0C22D894EA28391C663224F18697727CA1B7C73AAE2A1BA30C7C57B95587C88A | 1897 | MANIFESTTE: EVET |
| verify\result-3-unknown.json | DABDC8260FD9596BC238DD39D40E51A6A8F23D88FEE4E31F64EE93584D7595E8 | 1924 | MANIFESTTE: EVET |
| verify\run-chain.mjs | F5A492A051BF2CE982C1A8CB67FA03EB176FBE5C8EEC46600447925AB2E5638D | 2235 | MANIFESTTE: EVET |
| MANIFEST.sha256.json | 0AD0618FBEC7F1422E2EC9FD4E064A6EE0C00E78410447AC97ADAD49313FBDE4 | 4842 | manifestin kendisi |

Sonuc: 18/18 dosyanin hash'i ve bayt sayisi manifestle esit [OWNER; bayt karsilastirmasi gozle, Claude chat].

D13'un adlandirdigi 4 dosya (identity-gate, guard, decision-gate-event-adapter, authority-grant) ve ayrica guard-scope ile validate-director-decision paketin `payload\ProgramFiles\7allab-security` altindadir. "D18'in 4 dosyasi = D13'te adlandirilan 4 dosya" bir OKUMADIR (PROPOSED), Owner onayi: 2026-11-15.

## 4. D capraz kontrol

Paketteki 6 .mjs dosyasinin SHA-256 degerlerinin ilk 16 hex karakteri `scripts/` altindaki ayni adli dosyalarla esit [OWNER, Claude chat; yalniz 16 karakter]:

| Dosya | Ilk 16 hex |
|---|---|
| authority-grant | B20284F6CA93F77D |
| guard | 6DB9C5474333B6FE |
| identity-gate | CB83A3AD54D759FE |
| decision-gate-event-adapter | 486E510BE3723E42 |
| guard-scope | A4EA9FF7F554A30C |
| validate-director-decision | 23EB84F2F526CB5C |

(Bu 16 karakterlik degerler txt'deki tam hash'lerin basiyla karsilastirildi, uyumlu.)

Canli kurulum kanitlari (txt "=== D2") [OWNER]:

`C:\Users\crypt\k2-05d-live-check`

| Dosya | SHA-256 | Bayt | mtimeUTC |
|---|---|---|---|
| crypt-hookdebug.log | E13D7FA47F70B19D7315C3AB2F85A87602C3BF974497DE0646A59710EEAA73F8 | 1997 | 2026-11-08 07:47:49 |
| crypt-managed-hook-check2.json | 7CBD69C2EC36F56A74F72AD616B7222EDE381DDE1E6677C44FD8579A5008D0E0 | 5068 | 2026-11-08 07:46:21 |
| crypt-managed-hook-check3.txt | AC4039D01CED426AC711171CA6E84EF78640747288B5ED9A6247D35DD9CAFA0D | 1182 | 2026-11-08 07:47:01 |
| crypt-managed-hook-check4.txt | AC4039D01CED426AC711171CA6E84EF78640747288B5ED9A6247D35DD9CAFA0D | 1182 | 2026-11-08 07:47:50 |
| crypt-postremoval-check.log | FA7FE8A1FD37B51F62EE9B4DBE4EF135B4A09D584C68A36D12730D9940F62605 | 1697 | 2026-11-08 11:34:34 |
| crypt-postremoval-check.txt | AC4039D01CED426AC711171CA6E84EF78640747288B5ED9A6247D35DD9CAFA0D | 1182 | 2026-11-08 11:34:35 |
| hello.txt | 572A95FEE9C0F320030789E4883707AFFE12482FBB1EA04B3EA8267C87A890FB | 13 | 2026-11-08 07:45:51 |
| latest | FA7FE8A1FD37B51F62EE9B4DBE4EF135B4A09D584C68A36D12730D9940F62605 | 0 | 2026-11-08 11:34:18 |

`C:\Users\Public\k2-05d-live-check-ccagent`

| Dosya | SHA-256 | Bayt | mtimeUTC |
|---|---|---|---|
| check-read.txt | 14A0A162CFBE1211A2E3AE58089E96808C7B445A58A2E5F25AC3BC335496EB2D | 116 | 2026-11-08 11:27:26 |
| check-write.txt | F7FAEC07A333F2F02D941D49F06CDCBBD3169368E63810525826E52DF8142D2D | 852 | 2026-11-08 11:30:07 |
| hello.txt | 572A95FEE9C0F320030789E4883707AFFE12482FBB1EA04B3EA8267C87A890FB | 13 | 2026-11-08 08:18:21 |
| hookdebug-read.log | 16FE44B34638127349DE15AED84918293D1F8E52DF09481450BC79306323DC5C | 618 | 2026-11-08 11:27:24 |
| hookdebug-write.log | D0C271493628510230FB45E4B8DFA7941AB153E3D2248385F3635277F1BDDAE1 | 619 | 2026-11-08 11:30:03 |
| latest | D0C271493628510230FB45E4B8DFA7941AB153E3D2248385F3635277F1BDDAE1 | 0 | 2026-11-08 11:29:59 |

Asagidaki alti dosyanin hash'inin ilk 13-16 karakteri belgelerde yazili degerlerle esit (git grep) [OWNER, Claude chat]: crypt-hookdebug.log E13D7FA47F70B19D, crypt-postremoval-check.log FA7FE8A1FD37B51F, check-read.txt 14A0A162CFBE1211, check-write.txt F7FAEC07A333F2F0, hookdebug-read.log 16FE44B346381273, hookdebug-write.log D0C271493628.

Iki "latest" dosyasi 0 bayttir ve hash'i baska bir dosyayla ayni; bagimsiz tur UNKNOWN (muhtemelen baglanti).

## 5. Siniflandirma (Owner, 2026-11-15, ONERILEN; commit onayi ile kesinlesir)

- D = PASS (D18 D: 4 dosyanin SHA-256 + provenans kaydi; G1 entegrasyonu ve cc-agent kalici kurulum karari K3'e ertelenir).
- E = PASS, sinirli (D18 E: SHA-256 + provenans kaydi yazildi; incelenen surumle esitligi gosterilmedi; G1 entegrasyonu NOT TESTED, K3'e ertelenir).
- Bu belge K2'yi KAPATMAZ ve K2 VERIFIED anlamina gelmez. Ara kontrol (2026-11-24) icin A, C, D, E'den en az 3 PASS gerekir: D ve E bu belgeyle; A icin OFFICE-007 gerekir.

## 6. Artik risk ve UNKNOWN

- E hash'inin incelenen surumle esitligi: UNKNOWN.
- Manifestin kendisi icin daha once kayitli bir hash yok (bugunku manifest hash'i bolum 3'te).
- Manifest imzasiz, kendi kendine beyan.
- "latest" dosyalarinin turu: UNKNOWN.
- D18'in "4 dosya" ifadesinin D13 okumasi: PROPOSED okuma.

## 7. Olcum

- /usage once/sonra: NOT MEASURED (Owner snapshot almadi).
- Sure: NOT MEASURED.
