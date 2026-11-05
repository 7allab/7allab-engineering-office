# P2 Karar Kaydı

Kullanıcı D1, D2 ve D3 kararlarını 2026-10-27 tarihinde açıkça onayladı.
Aynı tarihte proje sahibi D4 ve D5 kararlarını verdi (aşağıda).

## D1 — Organizasyon modeli

**Önerilen karar:** Ana Claude Code oturumu Engineering Director/orkestra şefi;
altında sekiz uzman ajan.

Uzmanlar:

1. Product Planner
2. Software Architect
3. Implementation Engineer
4. Security Engineer
5. QA & Test Engineer
6. UI/UX Engineer
7. Research Engineer
8. Release & Evidence Reviewer

Bu model dokuz mantıksal sorumluluk, fakat sekiz bölüm ajanı üretir. Director
ayrı bir bölüm ajanı değildir; yetki, dispatch ve nihai sentezi ana oturumda
tutar. Charter ve Core Operating Instructions bu karara göre güncellenmelidir.

**Alternatif:** Sekiz toplam rol; Research Engineer bağımsız rol olmaz ve
araştırma görevi Architect/Product Planner tarafından üstlenilir. Daha küçüktür
fakat güncel Protocol ve Assignment Matrix ile uyumsuzdur.

## D2 — Commit ve stage yetkisi

**Mevcut v1.2.3 davranışı:** Commit yetkisi stage yetkisi üretmez. Exact dosya
listesi için ayrıca stage yetkisi gerekir.

**Önerilen karar:** Güvenlik politikası olarak mevcut davranışı ilk pilotta
koru. Stage, commit ve push ayrı raporlanır; yalnız kullanıcının açıkça onayladığı
dosyalar stage edilir. Pilot verisi gereksiz onay yükü gösterirse şu dar değişikliği
ayrı sürümde değerlendir: explicit commit yetkisi, önceden onaylanmış exact dosya
listesinin minimal staging'ini kapsayabilir.

Bu karar değiştirilirse v1.2.3 üzerinde sessiz düzeltme yapılmaz; N3 kabul
kriteri ve Director davranışı yeni bir sürümde birlikte değiştirilir.

## D3 — İlk aktif kurulum yüzeyi

**Önerilen karar:** Önce bu kanonik repoda proje-kapsamlı Claude Code pilotu.
Global kullanıcı skill'i veya Agent Teams etkinleştirmesi yapılmaz. Claude
hesabında gözlenen v1.2.3 kopyası, düzeltilmiş sürüm hazır olana kadar mevcut
durumda bırakılır; üzerine yazılmaz veya kaldırılmaz.

## D4 — Governance temelinin kabulü

**Karar (proje sahibi, 2026-10-27):** Engineering Charter, Agent Roles & Handoff
Protocol, Core Operating Instructions, Skill & Tool Registry ve Agent-Skill
Assignment Matrix bağlayıcı Engineering Office politika temeli olarak kabul
edilir (statü: `Ratified`, sürüm: `1.1.1`; önceki: `Proposed — Ratification
Pending`, `1.1.1-candidate`). Karar bu beş belgeyi tek bir kararla kapsar;
belge bazında ayrı ayrı karar verilmedi. Roadmap kapısındaki "ayrı ayrı" ifadesi
bu toplu kararla karşılanmış sayılır; sahip aksini isterse belge bazlı kayıt
yeniden açılır.

Charter için dayanak: önceki tam inceleme ile Charter'a sonradan eklenen adaptör
referansı üzerindeki hedefli K8 kabul incelemesi birlikte değerlendirildi. Ana
oturum ayrıca Charter'ı ratifikasyondan önceki sürümüyle karşılaştırdı: tek fark
Bölüm 11 sonundaki referans paragrafı ve `P2-ADAPTER-REF` revizyon girdisi;
hiçbir izin, kapı veya güvenlik kuralı değişmedi.

Ratifikasyondaki içerik özeti (SHA-256, adaptör ve karar kaydı güncellemelerinden
sonraki nihai dosyalar):

| Belge | Sürüm | SHA-256 |
|---|---|---|
| `governance/engineering-charter.md` | 1.1.1 | `9DE20F792BFBDBA435FBCEEAA4DF40569F6D5DA079AA63D41274B9A1A896345D` |
| `governance/agent-roles-handoff-protocol.md` | 1.1.1 | `2A6CE0B647C353421CD698A554522714DE813513C36614BF6FE7C100F08266FE` |
| `governance/core-operating-instructions.md` | 1.1.1 | `D920E7717ACE56B5441B0BE25205F0FB265A1B51D6CEC41D9994ECAE5AEAE4A3` |
| `governance/skill-tool-registry.md` | 1.1.1 | `692D4899D856FEC2097D9513CB72CF096F57BE21328C4134AB30E04B1909CC85` |
| `governance/agent-skill-assignment-matrix.md` | 1.1.1 | `DA1E998BF3460614B372A5F1B3733F75CE7A647F6EDFDC221D556214F34F6544` |

Ratified, kurulu veya operasyonel anlamına gelmez: `.claude/` yoktur, hiçbir ajan,
skill veya hook kurulu değildir ve bu belgeler henüz Git'te sürümlenmemiştir.

## D5 — Proje adaptörlerinin statüsü

**Karar (proje sahibi, 2026-10-27):** KOVAN, APEXO, LIFEACTA ve 7ALLAB Web
adaptörleri yalnızca kontrollü güvenlik referansı olarak kabul edilir. Adaptörler
ratifiye edilmemiştir; belge statüleri `Draft — Ratification Pending` olarak kalır
(KOVAN 0.2-draft; APEXO, LIFEACTA, 7ALLAB Web 0.3-draft). Yeni bir statü
tanımlanmadı. Ayrım şöyle yapılır:

- `[GOV]` kurallar, yukarıdaki ratifiye governance belgelerine tabidir ve çelişkide
  governance üstündür (Charter Bölüm 11).
- `[DERIVED]` öneriler henüz bağlayıcı ürün politikası değildir; ayrıca ve açıkça
  kabul edilmedikçe tavsiye niteliğindedir.
- `[UNVERIFIED]` bilgiler doğrulanmış sayılamaz.

| Adaptör | Sürüm | SHA-256 |
|---|---|---|
| `governance/project-adapters/kovan.md` | 0.2-draft | `D80B5BBD38B8D230C4001CC7E2EDBC002894098D66E5FA9583AE6870FD997E63` |
| `governance/project-adapters/apexo.md` | 0.3-draft | `23FD0B7F98BD5AE1F7EDCF3EE33B1D6EB7C036DB67539F3A5EFC80E6DAC01A89` |
| `governance/project-adapters/lifeacta.md` | 0.3-draft | `B6BE9E3BB415CFB3D3D104BE9F829F41DD825FC33354EE348C67A448EDAECA75` |
| `governance/project-adapters/7allab-web.md` | 0.3-draft | `C88D4F171D02A514A8BAD6FCD75A02B58A199377A71DAE5CA72754884C94C33F` |

## D6 — Engineering Office çalışma modeli

**Durum: RATIFIED (2026-10-29).** Ratifikasyonun kaynağı: proje sahibinin
2026-10-29 tarihli açık talimatı (K1-02-R): D6-1–D6-5 kararlarını, D6-3 altındaki
beş açıklamayı ve kayıtlı yetki sınırlarını mevcut hâliyle RATIFIED statüsüne
geçirmeyi onaylamıştır. Governance belgeleri (Charter, Protocol, Core, Registry,
Matrix) bu kayıtla değişmedi; D6 ratifiye Protocol 2.1'i ve Charter'ı değiştirmez.

*Tarihsel kayıt:* D6, aynı gün (2026-10-29) proje sahibinin kayıt iziniyle
`PROPOSED / OWNER RATIFICATION PENDING` durumunda bu dosyaya yazıldı (ratifikasyon
veya kabul değildi). Ratifikasyon aşağıdaki D6 içeriğini değiştirmedi.

*Ratifikasyonun kapsamı:* Bu ratifikasyon yalnız D6 yönetişim kararına aittir.
Director v1.2.13'ün kabulü değildir (Director `CANDIDATE / EVAL GATE PENDING`
kalır); kurulu Director'ı yükseltme, uzman ajan oluşturma veya dispatch, kod, Git,
dependency, hook, MCP veya Ruflo kurulumu, ürün depolarına erişim veya yazma
yetkisi vermez; K2 operasyonel güvenlik kabulü değildir.

**D6-1 — Organizasyon.** Tek Engineering Director ve sekiz uzman rol korunur
(D1, Protocol 2.1). Release Engineering, Operations & Reliability, Product
Marketing & Support ve Product Analytics dört ek ajan değil; mevcut uzmanlara
bağlanacak yetkinliklerdir.

**D6-2 — Yetkilendirme.** Mevcut default-deny, insan onayı ve ayrı işlem
yetkileri korunur. ROLE_SELECTED, AGENT_DISPATCHED anlamına gelmez. D6 hiçbir
yeni yürütme yetkisi vermez.

**D6-3 — İki çalışma ortamının koordinasyonu.** Claude Desktop içindeki 7ALLAB
SOFTWARE Engineering Office projesi; araştırma, gereksinim analizi, mimari
değerlendirme, planlama, raporlama ve karar hazırlama ortamıdır. Yerel Claude
Code, ratifiye sözleşmeye tabi tek Engineering Director yürütme yüzeyidir.
İki yönlü devirde mevcut Protocol §5 ve §16 kullanılır. Desktop çıktıları, repo
doğrulaması ve ayrı yetki kontrolü olmadan yürütme emrine dönüşmez.
Bulut/proje ortamına yeni yerel kaynak veya kanıt aktarımı varsayılan olarak
kapalıdır; paylaşılacak malzeme, veri sınıfı ve hedef için açık izin gerekir.
Ham sır aktarımı yasaktır. Kanonik kaynak Git deposudur. Skill kopyaları otomatik
senkronize varsayılmaz; hedeflenen etkin kopya ile doğrulanmış yükleme ayrı
kaydedilir.

**D6-4 — Ruflo.** Yalnız uygun ve doğrulanmış yöntemler seçici kullanılabilir.
Tam Ruflo kurulumu, ikinci Director, swarm, autopilot ve otomatik yetki yükseltme
yoktur.

**D6-5 — Ürün yaşam döngüsü.** On aşama yalnız planlama ve sınıflandırma
rehberidir. Yeni bağlayıcı süreç kapısı oluşturmaz.

### D6-3 için proje sahibi açıklamaları (2026-10-29)

1. **Desktop kanıt değerlendirmesi.** Claude Desktop tarafından yapılan inceleme,
   birincil kanıt gerçekten incelenmişse en fazla `REVIEW_PERFORMED` statüsünde
   olabilir. `REVIEW_VERIFIED`, yalnız Ratified Protocol 6.1'in gerektirdiği
   bağımsız doğrulama koşullarıyla oluşturulur. Desktop'ın özet değerlendirmesi
   bağımsız doğrulama yerine geçmez.
2. **Yetkinin ortamlar arasında taşınması.** Desktop'tan aktarılan bir görevde
   proje sahibinin kendi yetki ifadesi ve Protocol §5 kapsamı korunmalıdır. AI
   tarafından yeniden yazılmış yetki ifadeleri yeni yetki oluşturmaz. Kod yazma,
   Git, kurulum ve dış aktarım işlemlerinden önce açık yetkinin kapsamı Claude
   Code'da doğrulanmalı; gerekiyorsa proje sahibinden yeniden onay alınmalıdır.
3. **Desktop'taki Director kopyası.** Claude Desktop'taki v1.2.3 skill kopyasının
   etkin yürütme Director'ı olduğu doğrulanmamıştır. Bu kopyanın bulunması ikinci
   Director yetkisi oluşturmaz. Desktop çıktıları öneri ve çalışma girdisidir;
   ratifiye Director kararı veya `AGENT_DISPATCHED` kanıtı değildir.
4. **Protocol 2.1 uyumluluğu.** D6, Ratified Protocol 2.1'i değiştirmez. Desktop,
   yalnız paylaşımı onaylanmış bilgilerle araştırma, analiz, planlama ve taslak
   hazırlama işlevleri üstlenebilir. Bu işlevler yerel depo yetkisi, bağımsız
   Director otoritesi veya otomatik yürütme hakkı oluşturmaz.
5. **Desktop ortamı ve veri sınırı.** Claude Desktop / Projects / Cowork
   ortamlarının gerçek depolama, bağlantı ve yürütme özellikleri doğrulanmadıkça
   `UNKNOWN` kalır. Yerel kanıtların, kaynak kodun veya hassas verinin paylaşımı
   için veri sınıfı, hedef ve açık yetki gereklidir. Varsayılan dış aktarım
   `NONE` olarak korunur.

### Açık kalan konular

Director v1.2.13 kabul bekleyen kaynak adayıdır (`CANDIDATE / EVAL GATE PENDING`).
Kurulu kopyaların kimlik doğrulaması, `.agents/` kökeni, Desktop projesinin mevcut
yapılandırması ve K2 operasyonel güvenlik kabulü ayrı süreçlerde tamamlanır.
K1-03 (uzman matrisi) D6 ratifikasyonundan sonra başlar.

Bu kararın onaylanması Director kurulumu, uzman ajan başlatılması, Git işlemleri
veya ürün depolarına yazma yetkisi vermez.

## D7 — Aktif ürün kapsamı

**Durum: RATIFIED — REVISED (2026-11-04).** Proje sahibinin son açık kararıyla
aktif geliştirme yalnız `7allab-engineering-office` projesidir. Engineering Office
tamamlandıktan sonra `APEXO` (`C:\Users\crypt\Projelerim\edge-ledger`), `LIFEACTA`
(`C:\Users\crypt\Projelerim\lifeacta`) ve `KOVAN` bu yapı kullanılarak geliştirilecek
ürün adaylarıdır. Üç ürünün kesin geliştirme ve pilot sırası ayrıca proje sahibi
tarafından kararlaştırılacaktır. Bu karar bugün hiçbir ürün reposunu aktif
geliştirme, erişim, test veya işlem kapsamına almaz.

Eski `APEX` sistemi (`C:\Users\crypt\Projelerim\apex`), `APEX-API` ve
`APEX-Orkestrator` Engineering Office geliştirme, test ve K4 ürün pilotu kapsamı
dışındadır. 2026-11-04 tarihli kontrollü askıya almada iki servis
`Stopped / Disabled`, uygulama kill-switch'i `DURDURULDU`, pozisyon çarpanı `0`
ve `APEX-API-8811` kuralı silinmeden devre dışı bırakılmıştır. Kanıt:
`APEX-suspension-evidence-20261104-100215.txt`, SHA-256
`B0563A1A6A18194A217EA0030D5A9E316B1DE3D816857385606ABECCA2A82B95`.
Broker tarafındaki açık emir/pozisyon sayısı TLS sertifika zinciri hatası nedeniyle
bağımsız doğrulanamamıştır; yerel sıfır sayacı broker kanıtı sayılmaz.

Bu karar APEX dosyalarını, servis veya NSSM kayıtlarını ya da firewall kuralını
silme; APEX'i yeniden başlatma veya reaktive etme; APEXO, LIFEACTA veya KOVAN
repolarına erişme ya da yazma; Git, test, kurulum, dağıtım ya da K2/K3/K4 kabul
yetkisi vermez. Her biri ayrı açık onay gerektirir.

## D8 — K2-05 güvenlik kapılarının tanımı

**Durum: RATIFIED (2026-11-04).** Proje sahibi, resmî
`K2-05-A/B/C/D/E/F → K3 → K4` sırasındaki daha önce tanımsız A, D, E ve F
kapılarını aşağıdaki kapsamla onaylamıştır. Mevcut K2-05-B ağ izolasyonu ve
K2-05-C managed-hook güven sınırı değişmez.

- **K2-05-A — Host/runtime güvenlik tabanı:** Sürümler, etkin kurulum yüzeyleri,
  global ve proje ayarları, default-deny kontrolleri ve dosya/paket bütünlüğü
  salt-okunur envanterle kanıtlanır. Bilinmeyen veya erişilemeyen durum PASS
  sayılmaz.
- **K2-05-D — Model-dışı yetki defteri:** Yetkinin aktörü, kapsamı, işlemi,
  süresi, tek kullanımlılığı, reddi ve geri alınması modelin değiştiremeyeceği bir
  sınırda tutulur; eksik, süresi dolmuş, tekrar kullanılan veya kapsam dışı yetki
  fail-closed reddedilir.
- **K2-05-E — Sır ve veri aktarım sınırı:** Ham kimlik bilgileri AI bağlamına,
  promptlara, loglara veya harici araçlara girmez; connector/MCP/ağ aktarımı veri
  sınıfı, hedef ve açık izinle sınırlandırılır; redaksiyon ve proje izolasyonu
  pozitif/negatif kanıtla doğrulanır.
- **K2-05-F — Bütünleşik kabul ve geri dönüş:** A–E sonuçları birlikte negatif
  senaryolar, rollback/recovery, kanıt bütünlüğü ve bağımsız insan güvenlik
  incelemesiyle değerlendirilir. F, önceki kapılardaki eksikliği geçersiz kılamaz.

Bu tanımlar kurulum, test yürütme, sistem değişikliği, ürün repo yazması, ajan
dispatch, Git işlemi veya K2 kabulü yetkisi değildir. Her kapının planı,
yürütmesi ve kabulü ilgili ayrı yetki ve kanıt koşullarına tabidir.

## D9 — Değerlendirme sözleşmesi onarımının ratifikasyonu (K1-02-R2)

**Durum: RATIFIED (2026-11-05).** Ratifikasyonun kaynağı: proje sahibinin
2026-11-05 tarihli açık talimatı — A1-P1 pilot bulgusunun analiz edilip doğru
kararın verilmesi ve uygulanması. Dayanak kanıt: A1-P1 pilot koşusu (oturum
`2dd0b4d4-acae-4db5-9599-add38aed9b50`, 2026-11-05) ve
`evals/test-cases.md` K1-02-EVAL-CONTRACT-REPAIR bölümü.

K1-02-EVAL-CONTRACT-REPAIR ratifiye edilir. E1 ve E3 yazıldığı gibi kabul
edilir; E2 aşağıdaki biçimde değiştirilerek kabul edilir (E2-R2).

**E1 — pilot kanıtıyla doğrulandı.** Aday ayrı adla (`-rc`) yüklendi; ham olay
kaydında çağrılan ad `7allab-engineering-director-rc`, eksiz ad 0; gövde
SHA-256 `e7d158f078efa9506b07a497a50506e671e40191891cd741ded138e0cf8d30e4`
kaynakla eşleşti; hesap-senkron 1.2.3'e dokunulmadı ve çarpışma gözlenmedi.

**E2 — yetersiz bulundu ve değiştirildi (E2-R2).** E2, `governance/` altına
salt-okunur erişim vererek kriter 10'u ölçülebilir kılmayı amaçlıyordu. Pilotta
erişim fiilen verildi (ham kayıt: `additionalWorkingDirectories` =
`...\governance`; Read/Glob/Grep mevcut) ve aday hiçbir okuma yapmadı;
`kovan.md` kayıtta 0 kez geçti. Kriter 10 yine UNOBSERVABLE kaldı. Erişim
gerekli koşuldur, yeterli koşul değildir.

E2-R2 — salt-okunur governance erişimi korunur; buna ek olarak kriter 10'un
ölçüm koşulu tanımlanır:

- Kriter 10 **yalnızca** çıktı adaptör kaynaklı bir madde içerdiğinde ölçülür.
- Adaptör içeriği ne okunmuş ne de çıktıda kullanılmışsa kriter 10 **N/A**'dır
  ve PASS'ı engellemez.
- Mekanik kayıt ölçütü: ham olay kaydında `governance/project-adapters/`
  altında en az bir `Read`, `Grep` veya `Glob` çağrısı varsa ölçülür; yoksa
  N/A yazılır.
- Adaptör kaynaklı bir madde `[DERIVED]` yerine `[GOV]` ile sunulursa sonuç
  FAIL'dir.
- Adayın erişilebilir governance belgelerini okumaması puanlanmaz; gözlem
  olarak kaydedilir ve `1.2.15-aday` listesine işlenir.

Gerekçe: kriter 10 negatif bir kriterdir (ratifiye governance ile Draft adaptör
karıştırılmasın). Adaptör içeriği çıktıya hiç girmediyse karıştırma riski
doğmamıştır. Doğmamış riski "doğrulanamadı" sayıp kabulü bloklamak ürün
kusuru değil, ölçüm sözleşmesi kusurudur. P1 bu nedenle üç sürümde dört
koşuda yapısal olarak PASS alamamıştır: 1.2.12 PASS ("kriter 10 gözlenemedi"
notuyla), 1.2.13 iki koşu INCONCLUSIVE, 1.2.14 pilot INCONCLUSIVE. Kriter metni
değişmemiştir ve gevşetilmemiştir; yalnızca doğmamış riskin kabulü
bloklaması kaldırılmıştır. Tarihsel sonuçlar silinmez ve yeniden puanlanmaz.

**E3 — yazıldığı gibi kabul edilir.** N6/N9 henüz koşulmadığı için ampirik
olarak doğrulanmamıştır; tanımsal bir netleştirmedir ve ilgili senaryolar
koşulduğunda sınanacaktır.

**Ertelenen madde (bloklamaz).** Kriter 10'u fiilen egzersiz eden adanmış bir
senaryo, proje adaptörlerinin ratifikasyonuna bağlanır. Adaptörler D5 uyarınca
`Draft — Ratification Pending` olduğundan adaptör-karıştırma riski henüz
operasyonel değildir.

Bu karar kurulum, test yürütme, sistem değişikliği, ürün repo erişimi, ajan
dispatch, Git işlemi veya K2/K3 kabulü yetkisi değildir. Director 1.2.14'ün
kabulü değildir; yalnızca ölçüm sözleşmesini geçerli kılar.

## Bilerek kabul edilen açık istisnalar

1. **Charter:** önceki tam incelemeden sonra adaptör referansı eklendi; tam Charter
   için ayrı bir yeniden kabul turu yapılmadı (bkz. D4 dayanağı).
2. **LIFEACTA R9:** son regresyon incelemesinde R9 FAIL (Medium) kaydedildi. Bu
   kayıt silinmez. `P2-LIFEACTA-R9` ile giderildi; hedefli incelemede K1–K8 PASS.
   Aynı etiket altında (0.3-draft) iki içerik revizyonu vardır; revizyon kimliği
   dosya hash'i ve Change ID'dir.
3. **Düşük (Low) editoryal bulgular açık:** Charter §9 Git örnek listesi tam değil;
   Matrix:93 KOVAN satırı Release & Evidence Reviewer'ı saymıyor; Registry:101/574;
   Charter:157; KOVAN `:81` ve `:28/:37/:80` atıf ifadeleri; APEXO yinelenen
   madde; Web atıfsız `[GOV]` etiketleri; LIFEACTA `:42` ifade.
4. **INCONCLUSIVE:** `git commit <paths>` sonrası indeks durumu; KOVAN ve diğer
   ürün depolarındaki olgular; adaptörlerin tüm `[UNVERIFIED]` listeleri.
5. **İnsan incelemesi sınırı:** bağımsız incelemelerin tamamı Explore (model)
   çıktısıdır; araç kısıtı prompt ile uygulanmıştır, teknik olarak zorlanmamıştır.
   İnsan incelemesi yapılmadı. Kabul kararı proje sahibine aittir.
6. **Operasyonel testler sınırlı:** hiçbir ajan, hook, MCP veya plugin kurulu
   değil; hiçbir ürün deposu açılmadı. 2026-11-05'te kanonik depo dışında,
   izole bir eval çalışma alanında (`C:\Projeler\7allab-eval-1214`) Director
   1.2.14 RC'si `7allab-engineering-director-rc` adıyla proje kapsamında kuruldu
   ve A1-P1 **pilot** koşusu yapıldı. Kanonik depoya, hesap-senkron skill'e ve
   kullanıcı kapsamındaki kuruluma dokunulmadı. Pilot kabul kanıtı değildir
   (bkz. D9).
7. **Git:** belgeler Git'te sürümlenmemiştir (commit yok). README "Kaynak önceliği"
   1. maddesindeki "Git ile sürümlenmiş" koşulu, ayrı bir commit yetkisi verilene
   kadar karşılanmaz. Stage, commit ve push için ayrı açık yetki gerekir.
8. **Manifest:** `generatedAt` ve `runtimeObservation` (Claude Code 2.1.295; bu
   makinede 2.1.311 gözlenmişti, Agent Teams ayarı yeniden doğrulanmadı)
   güncellenmedi. 2026-11-05 pilotunda çalışan sürüm `2.1.318` olarak
   gözlendi; manifest yine de güncellenmemiştir.

## P3 için korunan engeller

Director v1.2.3 (`director/`) paketi ratifiye governance ile hizalı değildir:
durum sözlüğü (REVIEW_PERFORMED, alt çizgili adlar), REVIEW_VERIFIED tanımı,
SEC-01/SEC-02 veri aktarımı alanları ve "QA & Test Engineer" adı. v1.2.3 eval'leri
(N3, P2, P3, N2) NOT TESTED; paketleme ve hash adımı yapılmadı. Bu uyumsuzluklar
P3'ün engeli olarak kalır; ürün seçimi ve geliştirme sırası yalnızca proje
sahibinin kararıdır.

## Onay kaydı

- D1: APPROVED — main-session Director + eight specialist agents
- D2: APPROVED — stage, commit and push remain separate gates for the first pilot
- D3: APPROVED — project-scoped pilot; no global install or Agent Teams
- D4: APPROVED — five governance documents (Charter, Protocol, Core, Registry, Matrix) ratified as the binding policy baseline, version 1.1.1
- D5: APPROVED — four project adapters accepted as controlled safety references only; not ratified; status remains Draft — Ratification Pending
- D6: RATIFIED — Engineering Office working model (Desktop / Claude Code coordination), D6-1 to D6-5 and the five D6-3 clarifications; ratified 2026-10-29 by explicit project owner instruction (K1-02-R); previously recorded 2026-10-29 as PROPOSED / OWNER RATIFICATION PENDING; does not accept Director v1.2.13, authorize installation, dispatch, Git, product-repo access, or K2 acceptance
- D7: RATIFIED — REVISED — active development is only 7allab-engineering-office; APEXO, LIFEACTA and KOVAN are deferred product candidates after Engineering Office completion, with order undecided; legacy APEX and 7ALLAB Web remain outside scope; does not authorize product-repo access or writes, APEX deletion/reactivation, Git, test execution, installation, dispatch, or K2/K3/K4 acceptance
- D8: RATIFIED — K2-05-A host/runtime baseline, K2-05-D model-external authority ledger, K2-05-E secrets/data-transfer boundary, and K2-05-F integrated acceptance/rollback definitions; does not authorize implementation, test execution, system changes, Git, or K2 acceptance
- D9: RATIFIED — eval measurement contract repair K1-02 ratified as K1-02-R2; E1 confirmed by pilot evidence, E2 amended so criterion 10 is measured only when adapter-sourced content appears in the output (otherwise N/A), E3 accepted as written; a dedicated criterion-10 scenario is deferred until project adapters are ratified; does not accept Director 1.2.14 or authorize installation, dispatch, Git, product-repo access, or K2/K3 acceptance
