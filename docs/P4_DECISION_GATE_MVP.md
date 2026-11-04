# P4 Karar Doğrulayıcısı — MVP (Decision Gate)

Durum: **SENTETİK DOĞRULAYICI — OPERASYONEL DEĞİL.** Bu modül bir karar *doğrulayıcısıdır*; eylem
engelleyicisi değildir. Geçmesi, Director'a hiçbir operasyonel yetki vermez. Claude Code olaylarına,
hook'lara veya gerçek bir izin defterine bağlı değildir.

## Katmanlar: neyin uygulandığı

| Katman | Durum |
| --- | --- |
| **1. SENTETİK KARAR DOĞRULAMA** — yapılandırılmış bir kararı sentetik bir bağlama göre denetler | **Uygulanmış** (bu modül) |
| **2. GÜVENİLİR MODEL DIŞI KAYNAK** — yetki defteri, kabul/inceleme/dispatch kayıtları, sınıf kanıtı ve veri öznelerinin model dışında üretilip imzalanması | **Uygulanmamış** — `origin`, `trust.kind`, `subjects`, `data_subjects` değerlerini yazanın model olmadığı doğrulanamaz |
| **3. GERÇEK OLAY BAĞLAMA** — Claude Code olaylarından (araç çağrıları, ajan dispatch'i, onaylar) bağlam üretme | **Uygulanmamış** (`real_event_binding: "NOT_IMPLEMENTED"`) |
| **4. YÜRÜTME ÖNCESİ ENGELLEME** — reddedilen kararın aracın çalışmasını fiilen durdurması (PreToolUse benzeri) | **Uygulanmamış**; doğrulayıcı hiçbir eylemi engellemez |

Yalnız 1. katman mevcut kapsamdadır. `ACCEPTED_SYNTHETIC` gerçek bir eylem yetkisi değildir; `operational` daima `false`'tur.

## Güven sınırı

| Giriş | Kaynak | Güven |
| --- | --- | --- |
| `decision` — görev durumu, risk, veri sınıfı, işlem etiketleri, koordinasyon iddiaları | Director (model) | **Güvenilir değil.** Yalnızca incelenen öneridir. |
| `context` — izin defteri, yasaklar, kabul kanıtı, sınıf kanıtı, dispatch/inceleme kayıtları | Model dışı yürütme bağlamı | Bu sürümde **yalnız sentetik fixture** (`context.trust.kind = "synthetic_fixture"`). |

`context.trust.kind` başka bir değerse (ör. gerçek olay akışı) doğrulayıcı reddeder: hangi gerçek olayın
nasıl doğrulanacağı henüz uygulanmamış bir güven sınırıdır. Her kayıt `origin: "trusted_fixture"`
taşımalıdır; modelin ürettiği veya etiketsiz kayıt kanıt sayılmaz ve reddedilir. Bilinmeyen `decision`
alanları (ör. modelin eklediği `user_approval`) reddedilir.

## Kullanım

```
node scripts/validate-director-decision.mjs karar.json     # veya stdin: '-'
node --test test/director-decision-gate.test.mjs            # bağımlılıksız, yerleşik test çalıştırıcısı
```

Çıktı JSON'dur: `verdict`, `operational: false`, `trust_boundary`, `real_event_binding: "NOT_IMPLEMENTED"`,
`findings[]`, `derived`. Çıkış kodları: `0` ACCEPTED_SYNTHETIC, `2` REJECTED, `3` NOT_VERIFIED, `1` girdi dosyası okunamadı.
Bozuk JSON `INVALID_JSON` ve beklenmeyen iç hata `VALIDATOR_INTERNAL_ERROR` ile REJECTED (exit 2) olur; kütüphane
olarak çağrıldığında da `validateDecision` hiçbir zaman fırlatmaz.
Bunlar Protocol görev durumu değildir; yalnız doğrulayıcının sonucudur. Geçersiz bir karar hiçbir zaman
READY/VERIFIED gibi bir duruma dönüştürülmez.

## Kurallar ve ratifiye dayanakları

| Kural | Dayanak |
| --- | --- |
| D1 Tek, geçerli görev durumu (PROPOSED … CANCELLED, 9 değer); COMPLETED/VERIFIED her kabul ölçütü için güvenilir kanıt ister; HIGH ayrıca doğrulanmış bağımsız inceleme ister; BLOCKED yalnız gerçek yasak/güvenlik/geri çekilmiş yetki/harici karar; eksik kapsam tek başına BLOCKED değil; IN_PROGRESS yalnız AUTHORIZED_SCOPED işlemle; CANCELLED yalnız kullanıcı iptaliyle | Protocol §6, §6.1 |
| D2 Kanıtsız PUBLIC/INTERNAL reddedilir, kanıt yoksa `UNCLASSIFIED`; doğrulanmış sınıf düşürülemez; sınıf aktarım yetkisi vermez; UNCLASSIFIED aktarım yapılamaz; sınıf riski kendiliğinden belirlemez | Charter §8, Protocol §5 |
| D3 Stage/commit/push bağımsız; model etiketi yetersiz, etiket güvenilir defterden türetilir; hiç verilmemiş = NOT_AUTHORIZED, DENIED_OR_REVOKED yalnız defter/yasak kaydıyla; başka depo için yetki türetilmez | Charter §9, Protocol §6.1 |
| D4 Tek nihai risk; taban yalnız ratifiye Charter §4 HIGH örneklerinden (authorization, credentials, personal_data, financial_calculation, persistence_migration, security_contract, destructive_operation) veya sahibi/kaynağı belirtilmiş bir `risk_policy` fixture'ından gelir; eşiği olmayan işlem türünde `NOT_VERIFIED` üretir, taban tahmin edilmez | Charter §4 |
| D5 ROLE_SELECTED / AGENT_DISPATCHED / REVIEW_PERFORMED / REVIEW_VERIFIED ayrı doğrulanır; REVIEW_VERIFIED için incelemeci kimliği, birincil kanıt, ölçütlerin karşılandığı, uygulayıcıdan farklılık ve dispatch kaydı veya yetkili insan gerekir | Protocol §6.1 |
| D6 Eksik alan, bozuk yapı, bilinmeyen alan, çelişki, doğrulanamayan güven sınırı → fail-closed | Protocol §5 |

Git işlemleri için zorunlu kapsam alanları Charter §9'dan kodlanmıştır (stage: repo+dosya listesi;
commit: repo+staged kapsam+niyet; push: repo+remote+branch). Diğer işlemler (kaynak değişikliği,
bağımlılık kurulumu vb.) için ratifiye bir kapsam şeması olmadığından gerekli sınırları güvenilir defter
kaydı bildirir; bildirmezse sonuç `NOT_VERIFIED` olur.

Kaynak notu: "Authorization Matrix" adında ayrı bir ratifiye belge yoktur; yetki kuralları Charter §9 ve Protocol §6.1'den
alınmıştır.

### Sınıflandırma kanıtının veriye bağlanması (O4)

`classification_evidence` artık `subjects` (kapsadığı veri adları; boş olmayan, tekil string listesi) taşımak zorundadır.
Kanıt, yalnızca görevin dokunduğu **tüm** güvenilir veri öznelerini (`context.data_subjects`, `origin` etiketli kayıtlar)
adlandırıyorsa kullanılır; aksi halde `EVIDENCE_SUBJECT_UNBOUND` (`NOT_VERIFIED`) üretilir ve etkin sınıf `UNCLASSIFIED` kalır
(`PUBLIC`/`INTERNAL` iddiası `UNEVIDENCED_CLASS` ile reddedilir). Bir transferin `data` değeri de kanıtın `subjects` listesinde
bulunmalıdır (`TRANSFER_DATA_NOT_COVERED_BY_EVIDENCE`). Bozuk bir `data_subjects` kaydı atlanmaz, REJECTED olur. Karara özne, hash
veya kaynak etiketi eklenemez (`UNKNOWN_FIELD`).

**Bu bağ gerçek bir provenance doğrulaması değildir:** yalnızca sentetik fixture içindeki iki string listesinin
eşleştirilmesidir; gerçek veri kaynağını, içeriğini veya hash'ini doğrulayan bir bileşen yoktur. Çıktı bunu
`derived.classification_binding: "FIXTURE_STRING_MATCH_ONLY"` ve `CLASSIFICATION_PROVENANCE_NOT_IMPLEMENTED` notuyla belirtir.

### Etiketsiz bağlam girdileri (O7)

`operation_kinds`, `implementer_id` ve `acceptance_criteria` hâlâ **origin etiketi taşımaz ve doğrulanmış girdi değildir**;
bunlara etiket eklemek güvenilir yapmaz (etiketli kayıt biçimi reddedilir) ve çıktı her seferinde
`derived.unverified_inputs` ile `UNLABELED_CONTEXT_INPUTS` notunu verir. Yapılan yalnızca sıkılaştırmadır: şema doğrulaması
(`operation_kinds` benzersiz küçük harfli token'lar; `acceptance_criteria` benzersiz string'ler; `implementer_id` boş olmayan
string), `operation_kinds`'ın yetki üretememesi (yetki yalnız defterden gelir), model beyanının güvenilir kayıtlarla
çelişkisinin yakalanması (güvenilir dispatch kaydı başka bir uygulayıcıyı adlandırıyorsa `IMPLEMENTER_CONTRADICTED`; uygulayıcı
rolündeki ajan kendi işinin REVIEW_VERIFIED incelemecisi olamaz; kriter listesinde olmayan bir kriter için güvenilir kanıt varsa
`EVIDENCE_FOR_UNDECLARED_CRITERION`). Bu alanların gerçek bir model dışı kaynağı yoktur; bu güven sınırı **çözülmemiştir**.

### Yasaklı aktarımlar önceliklidir (Y-B)

Protocol §5: PROHIBITED DATA TRANSFERS "veri"dir ve her alandan önceliklidir; çelişkili veya belirsiz alanlar aktarım yok
olarak (fail-closed) çözülür. Şemada yasak yalnız **veri adıdır** (hedef, kapsam veya tür taşımaz); bu yüzden eşleştirme yalnız
`data` üzerinden yapılır ve başka bir eşleştirme politikası icat edilmemiştir.

- Her `permitted_transfers[].data`, sabit kanonik üç etiket (`raw_credentials`, `private_keys`, `production_secrets`) **ve kararın kendi**
  `prohibited_transfers` girdileriyle karşılaştırılır. Model bu listeye yalnız **ekleme** yapabilir; kanonik etiketlerden birini
  çıkarması hiçbir transferi serbest bırakmaz (ayrıca `PROHIBITED_TRANSFERS_INCOMPLETE` ile reddedilir).
- Karşılaştırma **tek birleşik normal form** üzerinden yapılır: Unicode NFKC, kontrol ve sıfır genişlikli karakterlerin (NUL dahil)
  silinmesi, boşluk kırpma, küçük harf, `\` → `/`, boş ve `.` segmentlerinin atılması, segment içinde boşluk / `_` / `-` dizilerinin tek
  `_` yapılması (`raw-credentials/`, `Private-Keys\`, `raw_ credentials`, tam genişlikli harfler aynı forma iner). Bu form yalnız
  *yasağı genişletir*; hiçbir şeye izin vermez, bu yüzden dosya adlarındaki `-`/`_` farkı gibi durumlarda aşırı red üretebilir.
- Permitted transfer öğesi yalnız `data`, `class`, `destination`, `scope` anahtarlarını taşıyabilir; ek anahtar (`UNKNOWN_FIELD`)
  yasak karşılaştırmasını aşmak için kullanılamaz.
- **Eşit** (yukarıdaki normal formda) →
  `PROHIBITED_DATA_IN_TRANSFER`, REJECTED. İzin kaydı, yetkilendirme veya sınıf bunu geçersiz kılamaz.
- **Kapsama veya desen** (biri diğerinin yol öneki; `*`, `?`, `[`, `]` içeriyor; `..` segmenti var; ya da girdi `.` / `/` gibi
  köke indirgeniyor) → ratifiye bir eşleştirme kuralı olmadığından
  karar verilemez: `PROHIBITED_SCOPE_AMBIGUOUS`, `NOT_VERIFIED` (aktarım izinli sayılmaz).
- Birden çok transferde biri yasaklıysa kararın **bütünü** reddedilir; kısmi izin türetilmez.
- `prohibited_transfers` girdileri boş olmayan string olmalıdır; `null`, sayı, nesne, boş/boşluk girdisi veya dizi olmayan değer
  `PROHIBITED_TRANSFERS_INCOMPLETE` ile REJECTED olur.
- **Güvenilir bağlamdaki yasak kaydı: UYGULANMADI (NOT IMPLEMENTED).** `context.prohibitions` yalnız *işlem* yasaklarını taşır
  (`op` + `repo`); aktarım verisi için güvenilir bir yasak kaydı şeması yoktur. Bu nedenle güvenilir bir yasağın modelin izin
  verdiği aktarımı kapsadığı durum (senaryo F) doğrulayıcıda yoktur; test yalnız bu eksikliği karakterize eder.

### Delegasyondan önce sınıflandırma (D-3)

Protocol §5: DATA CLASSIFICATION "delegasyon gönderilmeden önce tamamlanmalı"; §6.3: dispatch öncesinde veri alanları kaydedilir.
Doğrulayıcı bunu şöyle uygular: kararda `agent_dispatched` iddiası **veya** güvenilir bir dispatch kaydı varken etkin sınıf
(doğrulanmış ve veriye bağlı kanıttan gelen sınıf) `UNCLASSIFIED` ise `DISPATCH_BEFORE_CLASSIFICATION` ile REJECTED olur. Bağlanamayan,
bozuk veya modelin kendi yazdığı sınıf kanıtı etkin sınıfı `UNCLASSIFIED` bırakır. `UNCLASSIFIED` + `PROPOSED`/`READY` + yalnız
`ROLE_SELECTED` hâlâ meşru koşullu planlamadır; `ROLE_SELECTED` hiçbir zaman dispatch yetkisi türetmez. Bu bir dispatch mekanizması
değildir; dispatch kaydı yalnız sentetik fixture'dır.

### İnceleme bağımsızlığı ve çelişkili kayıtlar (O-2, O-3)

Şema (Protocol §6.1'e göre, yeni kanıt modeli yok): inceleme kaydı `reviewer_id`, `primary_evidence_ref` (boş olmayan string) ve
boolean `criteria_met` taşır; `reviewer_kind: "authorized_human"` için `authorization_ref` eklenir. Dispatch kaydı `agent` ve `record_ref`
taşır (`role` isteğe bağlı). Bozuk veya eksik kayıt atlanmaz, REJECTED olur.

- **Bağımsızlık (`REVIEW_PERFORMED` ve `REVIEW_VERIFIED`):** incelemeci uygulayıcıdan farklı olmalı (kimlikler ve dispatch rol adı Y-B ile aynı NFKC/sıfır genişlikli karakter/
  büyük-küçük harf/baş-son boşluk normalizasyonundan geçer; iç boşluk, ör. `impl 1`, ve rol alanının hiç yazılmaması normalize
  edilmez, kalan sınır), güvenilir bir dispatch kaydının uygulayıcı rolünde bulunmamalı ve bir dispatch kaydı **veya** yetkili insan kaydıyla
  desteklenmeli; `implementer_id` yoksa bağımsızlık gösterilemez ve reddedilir. Kendi kendini inceleme hiçbir durumda bağımsız
  sayılmaz (yetkili insan olsa bile uygulayıcıysa).
- **`REVIEW_PERFORMED` ≠ `REVIEW_VERIFIED`:** olumsuz sonuçlu bağımsız bir inceleme "performed" olabilir; "verified" olması için
  o incelemecinin **tüm** kayıtlarının bağımsız ve `criteria_met: true` olması gerekir.
- **Çelişki:** aynı incelemeciye (normalize kimlik) ait hem `true` hem `false` kayıt varsa sonuç kayıt sırasından bağımsız olarak
  REVIEW_VERIFIED vermez (`UNEVIDENCED_REVIEW_VERIFIED`) ve bağlam `REVIEW_RECORDS_CONFLICT` (`NOT_VERIFIED`) bulgusu üretir. İlk kayıt da
  son kayıt da kazanmaz (ratifiye metin sıra tanımlamaz). HIGH risk COMPLETED/VERIFIED aynı kuralı kullanır.
- Kimlikler sentetik fixture string'leridir; gerçek bir incelemecinin kimlik doğrulaması yoktur.

### Kabul kanıtı çelişkisi ve rol adı (dördüncü inceleme sonrası)

Bir kriter için güvenilir kanıtta `passed` dışında (`failed`) bir kayıt varsa, aynı kriter için ayrıca `passed` bir kayıt olması bunu
geçersiz kılmaz (`CONFLICTING_ACCEPTANCE_EVIDENCE`, REJECTED; ratifiye metin sıra veya öncelik tanımlamaz). Kabul kanıtı kayıtları
`criterion_id`, `result` (`passed`|`failed`) ve boş olmayan `ref` taşımalıdır; bozuk kayıt atlanmaz. Dispatch kaydında uygulayıcı rolü hem
`implementer` token'ı hem Protocol adı `Implementation Engineer` ile tanınır. Bir transferin `data` değeri yalnız kanıtın değil, görevin
güvenilir `data_subjects` listesinin de içinde olmalıdır (kanıt görevden geniş olabilir).

### Yetki türetme (ADIM 49 ile doğrulanan davranış)

- **Repository:** `repo` varsa boş olmayan bir string olmalıdır (null, sayı, boş, dizi, nesne → `INVALID_OPERATION` /
  `INVALID_CONTEXT_FIELD`, REJECTED). Bir *grant* depoya **tam** eşleşme ister; büyük/küçük harf veya eğik çizgi
  normalizasyonu yetkiyi genişleteceği için grant'te uygulanmaz. *İptal (revoked)* ve *yasak (prohibition)* kayıtları ise
  normalize edilmiş depoyla (küçük harf, `\`→`/`, sondaki `/` atılır) eşleşir; depo belirtmeyen kayıt, ya da depo
  belirtmeyen bir karar, o işlem için her depoda geçerli sayılır (yalnız yetkiyi daraltır). Depo belirtmeyen karar,
  depoya bağlı bir grant'i kullanamaz. **Repository her işlem için zorunlu sınırdır:** `required_scope` ne diyorsa desin
  `repo` her zaman eklenir; depo belirtmeyen grant yalnız `AUTHORIZED_PENDING_SCOPE` verir, depo belirtmeyen karar hiçbir
  zaman `AUTHORIZED_SCOPED` olamaz ve doğrulayıcı bir "varsayılan depo" seçmez. Gerekçe: Protocol §6.1 depoyu zorunlu
  sınırlara örnek verir, Charter §9 Git için zorunlu kılar ve ratifiye metinde depo gerektirmeyen bir işlem kategorisi
  tanımlı değildir; dayanak olmadığından istisna uygulanmamıştır (bu bir sıkılaştırma kararıdır, proje sahibi
  repo'suz bir kategori ratifiye ederse yeniden değerlendirilmelidir).
- **`required_scope`:** Git işlemlerinde Charter §9 alanları sabittir (defter bunları zayıflatamaz). Diğer işlemlerde
  gerekli sınırları defter kaydı bildirir; `required_scope` boş, boş-olmayan-string dizisi olmayan veya hatalı ise kayıt
  REJECTED olur (sınırsız yetki sayılmaz); hiç belirtilmemişse sonuç `NOT_VERIFIED` (`AUTH_UNVERIFIABLE`) olur.
- **Defter `state`:** yalnız `granted` ve `revoked`; başka her değer (büyük harf, boşluklu, boş, eksik) REJECTED olur, sessizce atlanmaz.
- **Commit–stage bağı:** `AUTHORIZED_SCOPED` bir commit'in `staged_scope` değeri, **aynı depoda** `AUTHORIZED_SCOPED`
  türetilmiş bir stage'in dosya listesiyle tamamen örtüşmelidir; aksi halde `NOT_VERIFIED`
  (`COMMIT_STAGED_SCOPE_UNVERIFIABLE`). Modelin yazdığı stage iddiası veya `origin`'i güvenilir olmayan stage kaydı bunu sağlamaz.
- **Transfer alanları:** karardaki her transferin `data`, `class`, `destination`, `scope` alanları boş olmayan string
  olmalıdır (`TRANSFER_INVALID`); `transfer_authorizations` kayıtları da aynı alanları taşımalıdır. Eksik alanlar
  `undefined === undefined` gibi eşleşemez.
- **Çoklu grant:** grant'ler birleştirilmez; bir karar yalnız onu **tek başına** tam kapsayan bir grant ile
  `AUTHORIZED_SCOPED` olur. Hiçbiri kapsamıyorsa, eksik kapsamlı bir grant varsa `AUTHORIZED_PENDING_SCOPE`
  (Protocol §6.1: izin var, sınırlar eksik), yoksa `NOT_AUTHORIZED`. Sonuç ve gerekçe metni defter sırasından bağımsızdır.
- **Grant–iptal/yasak çakışması:** aynı işlem ve depo için hem grant hem uygulanabilir iptal/yasak varsa ratifiye metin
  bir öncelik veya zaman sırası tanımlamadığından sonuç `NOT_VERIFIED`'dır (deny/allow önceliği icat edilmez).
  Yalnız iptal/yasak varsa `DENIED_OR_REVOKED`.
- **Eksik kapsamlı grant:** adlandırdığı sınırları yine belirler; kararın bu sınırlarla çelişen bir değeri
  (ör. farklı `remote`, `intent`) `NOT_AUTHORIZED` olur, `PENDING_SCOPE` iddiasıyla da geçmez.
- **İşlem adları ve yollar:** işlem adı tam küçük harfli token olmalıdır (`stage`; `Stage`, `stage ` reddedilir, böylece
  iptal/yasak kaydını yazım farkıyla atlatmak mümkün değildir). `files` / `staged_scope` girdileri somut göreli yol olmalıdır:
  glob (`* ? [ ]`), `.`, mutlak yol ve `..` geçişi reddedilir (karar ve defter için).
- **Bozuk bağlam kayıtları:** nesne olmayan `classification_evidence` ve geçersiz `user_cancellation` (güvenilir `origin` +
  boş olmayan `ref` gerekir) sessizce yok sayılmaz, REJECTED olur. Güvenilir bir kullanıcı iptali `CANCELLED` dışındaki her
  durumla, güvenilir bir gerçek engel (`prohibition`, `security_obstacle`, `revoked_authorization`, `external_decision`)
  `COMPLETED` / `VERIFIED` / `IN_PROGRESS` ile çelişir (REJECTED).
- **Ham sır etiketleri:** `permitted_transfers[].data`, büyük/küçük harf, boşluk ve tire normalizasyonundan sonra
  `raw_credentials`, `private_keys`, `production_secrets` ile eşleşirse reddedilir. Dosya adlarını (`.env`, `id_rsa`)
  tanımaz.

Kapsam karşılaştırması tüm alanlar için yapılır: karardaki her kapsam değeri (dosya listesi, remote, branch, staged
kapsam, niyet, paket listesi) defterdeki izinle örtüşmelidir; kararın üstlendiği sınırları bildirmemesi veya joker /
boş / dizi olmayan dosya listesi `AUTHORIZED_SCOPED` vermez. Yetkili her işlem türü `context.operation_kinds` içinde de
bildirilmelidir ki risk tabanı denetlensin. `external_destinations` yalnız bir üst sınırdır (Protocol §5): bir hedefi
listelemek aktarım yetkisi vermez; `permitted_transfers` her girdisi bu listede bulunmak, güvenilir bir
`transfer_authorizations` kaydıyla (veri, sınıf, hedef, kapsam) eşleşmek zorundadır ve ham sır/anahtar asla aktarılamaz.
Stage yetkisi olmadan kapsamlı (`AUTHORIZED_SCOPED`) bir commit `NOT_VERIFIED` üretir; eksik kapsamlı commit yalnız not düşer.
HIGH riskli COMPLETED/VERIFIED için inceleme kaydı hem güvenilir olmalı hem de kararın `coordination.review_verified`
alanında talep edilmelidir (kayıt görevle/kanıtla kriptografik bağlı değildir — aşağıdaki sınırlara bakınız).

## Sınırlar (önlemediği riskler)

- Defter, kayıt ve kanıtların **gerçekten** model dışı olduğunu doğrulayamaz; bu, çağıran taraf ve gelecekteki
  harness bağlantısının sorumluluğudur. Bu sürümde `trusted_fixture` etiketi yalnızca test sözleşmesidir.
- Kanıtın içeriğini (diff, test çıktısı) incelemez; yalnızca kaydın varlığını, kimliğini ve ilişkisini denetler.
- Yürütmeyi engellemez: PreToolUse veya benzeri bir yürütme kapısı olmadan model yine de araç çağırabilir.
- Sahte `risk_policy` fixture'ı taban üretebilir; fixture'ın ratifiye kaynağı doğrulanmaz (`ratified_by`/`source_ref`
  yalnızca dolu olmalıdır). Test fixture'ı hiçbir şeyi ratifiye etmez.
- Metinsel içerik analizi yapmaz (ör. yanıtın "tamamlandı" demesini ayrıştırmaz); yalnız yapılandırılmış karar alır.
- `decision` ve `context` tek JSON dosyasında gelir; ayrım şema düzeyindedir. Her ikisini de modelin yazması durumunda
  doğrulayıcı sentetik etiketlere güvenir (`trust.kind`, `origin`). Bu bir güven kanıtı değil, test sözleşmesidir.
- Çıktıdaki `operational: false`, `trust_boundary` ve `real_event_binding` sabit beyanlardır; koşuldan türetilmez.
- İnceleme/dispatch kaydı belirli bir göreve veya kanıt özetine bağlanmaz; kimlik karşılaştırması yalnız büyük/küçük
  harf ve boşluk farkını gözetir.
- Testler OS geçici dizininde CLI sınaması için kısa ömürlü bir dizin oluşturur ve alt süreç başlatır (`process.execPath`);
  depoya yazmaz, ağ kullanmaz.

### Bilinen açık noktalar (üçüncü inceleme + ADIM 50 sonrası durum)

Kapatılanlar: O1 (glob/yol), O2 (eksik kapsamlı grant), O3 (ham sır etiketleri), O5 (iptal `ref`), O6 (depo her zaman zorunlu),
Y1–Y3. Kısmen: O4 (veri bağı yalnız fixture düzeyinde), O7 (şema ve çapraz kontrol; kaynak güveni yok).

**ADIM 51 bağımsız incelemesinin sınıflandırması** (salt-okunur, elle izleme; insan veya REVIEW_VERIFIED değil):

| Sınıf | Maddeler |
| --- | --- |
| **BLOCKER** (sentetik MVP kapsamında yanlış kabul) | ADIM 51 sonunda: O-2, O-3, D-3 (**ADIM 52'de kapatıldı**, aşağıya bakın). ADIM 52 sonrası açık BLOCKER yoktur; bağımsız son incelemenin bulguları aşağıdaki "ADIM 52 sonrası durum" bölümündedir. |
| **DEFERRED** (zaman damgalı / model dışı kaynak ister) | **O-6** (grant sonrası iptal sıralaması), O-11'in dizin adı kısmı |
| **LOW / DOCUMENTED** (yanlış kabul yok; aşırı red veya sınırlılık) | **O-5**, **O-7**, **O-8**, **O-11** (sözdizimsel kısım: `C:foo`, `:/` ucuzca reddedilebilir), `Y-B` yalnız `data` eşleştirir |

Not: belgedeki "O5/O6/O7/O8" (üçüncü inceleme numaraları) ile "O-5…O-8" (dördüncü inceleme) farklı bulgulardır.

Y-B kapsamı: **Y-B kapatıldı (ADIM 51)** — kararın kendi `prohibited_transfers` içeriği `permitted_transfers` ile çapraz denetlenir, birleşik
normal form, kapsama/desen belirsizliği ve transfer öğesi ek anahtarları dahil (yukarıdaki bölüm). Bu, "başka atlatma yoktur"
anlamına gelmez; kapsam yalnız veri adıdır ve gerçek veri içeriği (ör. `.env`, `api_key`) tanınmaz. Güvenilir bağlamdaki *veri aktarımı
yasağı* için şema hâlâ yoktur (senaryo F: NOT IMPLEMENTED).

Açık maddelerin ayrıntısı:
- **O-2 kapatıldı (ADIM 52):** `review_performed` artık `review_verified` ile aynı bağımsızlık denetimini ister (bkz. İnceleme bağımsızlığı bölümü).
- **O-3 kapatıldı (ADIM 52):** aynı incelemeci için çelişkili kayıtlar sıradan bağımsız olarak kabul üretmez (bkz. aşağıda).
- **O-5:** commit'in stage'e bağlanması Charter §9'un lafzından değil bu belgenin bir sıkılaştırma kararındandır (Charter yalnız
  "commit stage yetkisi vermez" der); önceden stage edilmiş içeriği commit etmek meşru olabilir, bu durumda kod `NOT_VERIFIED`
  verir (aşırı red). `git commit -a` gibi örtük index değişiklikleri şemada ifade edilemez.
- **O-6:** "önce grant, sonra iptal" (gerçek geri çekme) zaman sırası olmadığı için sınıflanamaz; `DENIED_OR_REVOKED` yalnız grant'siz
  iptal/yasakta üretilir.
- **O-7:** repo'suz grant + repo belirten karar `NOT_AUTHORIZED` verir (Protocol'ün PENDING_SCOPE tanımına göre `PENDING` olabilirdi).
- **O-8:** `BLOCKED` engel türleri sözlüğü ratifiye değildir ve Protocol §6'nın "bağımlılık" ifadesinden dardır.
- **O-9 (kalan):** `dispatch_records` / `review_records` için yalnız `origin` doğrulanır; `nonEmpty` bazı alanlarda `0`/`false` değerini dolu sayar.
- **O-10 (ADIM 52'de kodla yeniden sınıflandırıldı: LOW / DOCUMENTED):** `permitted_transfers[]` tarafı ADIM 51'de kapandı. `operations[].scope` için yanlış kabul üretilemedi: SCOPED iddiasındaki fazladan anahtar defterde olmadığı için `NOT_AUTHORIZED` olur; PENDING/NOT_AUTHORIZED iddialarındaki fazladan anahtar hiçbir yetki üretmez. Kalan: raporun `derived.authorization[].scope` alanı modelin yazdığı kapsamı yansıtır; yetki yalnız `derived.authorization[].derived` alanıdır.
- **O-11:** `pathOk` "kesin dosya listesi" garantisi vermez (dizin adları, `C:foo`, git pathspec büyüsü `:/` geçebilir).
- **D-3 kapatıldı (ADIM 52):** dispatch iddiası veya güvenilir dispatch kaydı varken sınıf `UNCLASSIFIED` ise `DISPATCH_BEFORE_CLASSIFICATION` (bkz. aşağıda).
- Tek sınıf kanıtı tek sınıftır; veri öznesi başına ayrı sınıf yoktur.
- **O4/O7 kök sorunu:** `origin`, `trust.kind`, `subjects` ve `data_subjects` gibi alanları yazan taraf doğrulanamaz; hem `decision` hem
  `context` aynı kaynaktan (model) gelirse doğrulayıcı kandırılabilir. Gerçek model dışı kaynak, imza veya defter yoktur.
- **Risk tabanının tek kaynağı `operation_kinds`:** gerçek işin türü ile bu liste arasındaki tutarlılık doğrulanmaz.
- **Repo normalizasyonu sınırlı (O8):** `./`, `//`, 8.3 kısa adları, Unicode NFC işlenmez; farklı yazılmış bir iptal kaydı kaçabilir.
  Grant tarafı tam eşleşme istediği için bu yalnız iptal/yasak yönünü zayıflatır.
- **Blocker kayıtları defterle çapraz kontrol edilmez** (`revoked_authorization` etiketi gerçek bir iptal olmadan yeterli) (D1).
- **LOW/MEDIUM `VERIFIED` için bağımsız inceleme istenmez** (yalnız HIGH ister); "VERIFIED" durum adı ile "REVIEW_VERIFIED" kanıtı farklıdır (D2).
- **İptalden sonra yeniden grant** zaman sırası olmadığı için kalıcı `NOT_VERIFIED` verir (D5; güvenli ama kullanışsız).
- Hata yolu tanıları siler: iç hata olursa yalnız `VALIDATOR_INTERNAL_ERROR` döner (D3; yine REJECTED).
- Aynı op+repo için **farklı statülü** iki girdi `CONTRADICTORY_OPERATION` verir (D4; aşırı red). Statüsü aynı olan, kapsamı farklı iki
  girdi bu hatayı vermez (önceki sürümdeki "farklı kapsamlı" ifadesi hatalıydı).
- `localeCompare` locale'e bağlıdır (D6); BOM'lu / UTF-16 JSON `INVALID_JSON` ile reddedilir (D7).
- Çoklu grant davranışı bu belgede tanımlıdır (D8 kapatıldı: SCOPED → belirtilmemiş kapsam → PENDING → NOT_AUTHORIZED).

## Test doğrulaması

`node --test test/director-decision-gate.test.mjs` bağımlılıksız çalışır (134 test). Testlerin gerçekten doğrulayıcının
kodunu ölçtüğü, kuralları tek tek bozan geçici kopyalarla (mutasyon) denenmiştir: bozulan her kural için en az bir test
başarısız olmalıdır. ADIM 49'da yetki türetmenin altı güvenlik düzeltmesi için 21 mutasyon uygulandı; ilk turda 3
mutant hayatta kaldı: ikisi gerçek test boşluğuydu (düzeltildi, artık yakalanıyor), biri (grant eşleşmesinde yalnızca
normalizasyon) eşdeğerdir — `evalGrant` içindeki tam `repo` karşılaştırması aynı korumayı zaten sağlar. Üçüncü
incelemenin düzeltmeleri için 9 mutasyon daha uygulandı ve hepsi yakalandı. Bu kontrol elle yapılmıştır; depoda otomatik
bir mutasyon aracı yoktur. ADIM 50'de O4/O6/O7 ve Y1–Y3 için 28 mutasyon daha uygulandı: 27 yakalandı (biri, bozuk
`data_subjects` kaydının atlanması, ilk turda hayatta kaldı ve test eklenince yakalandı), 1'i eşdeğerdir (`policy.floors`
için `Object.hasOwn`: devralınan özellikler `RISKS.includes` testinden zaten geçemez). ADIM 51'de Y-B için 10 ve önceki korumalar için 9 örnek mutasyon daha uygulandı (hepsi yakalandı). Bağımsız incelemenin Y-B düzeltmesinde bulduğu atlatmalar için ADIM 51'de 17 mutasyon daha uygulandı: 16 yakalandı, 1 eşdeğer (`d.length === 0 || p.length === 0` koruması: kanonik üç etiket her zaman karşılaştırıldığı için boş veri zaten kapsama olarak yakalanır). ADIM 52'de O-3, O-2, D-3, O-10 için 21 ve önceki korumalar için 13 mutasyon daha uygulandı: ilk turda 1 hayatta kaldı (D-3 dispatch iddiası; test eklenince yakalandı), diğerleri yakalandı, eşdeğer yok. ADIM 52 bağımsız incelemesinin M1/M2 bulguları (rol adı ve kimlik normalizasyonu) düzeltildi; 2 mutasyon daha uygulandı, ikisi de yakalandı. Kapsam yalnız seçilen toplam 130
kural-bozmayla sınırlıdır; bilinmeyen açıkları ölçmez.

Bağımsız incelemeden belgelenen DÜŞÜK sınırlar: (L1) HIGH kapısı yalnız talep edilen incelemecinin kayıtlarına bakar; talep
edilmemiş başka bir incelemecinin olumsuz kaydı HIGH tamamlanmayı engellemez (yalnız aynı kimlikte true+false çelişkisi
`REVIEW_RECORDS_CONFLICT` üretir); (L2) dispatch/review kayıtları göreve veya kanıta bağlı değildir; boş değerli ek `scope`
anahtarı yok sayılır ve yetki taşımaz.

## Gerçek olaylara bağlamak için eksikler

1. Director çıktısının doğrulanan yapılandırılmış biçimi ve bunu zorunlu kılan bir üretim adımı (şu an yok).
2. Kullanıcı mesajından türetilen yetki defteri (alıntı aralığı + zaman damgası) ve onu model dışında tutan bileşen.
3. Gerçek ajan dispatch'i ve inceleme kayıtlarının harness olay akışından okunması ve imzalanması.
4. Kabul kanıtı (komut, çıkış kodu) için model dışı yürütme kaydı.
5. Yürütme kapısı (PreToolUse benzeri) — kararın reddi, aracın çalışmasını fiilen durdurmalıdır.

Bu bileşenler olmadan doğrulayıcı yalnız tasarımı ve kuralları sınayan bir referanstır.
