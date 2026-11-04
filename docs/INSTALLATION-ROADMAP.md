# Kurulum Yol Haritası

Durum: **BOOTSTRAP IN PROGRESS — NOT OPERATIONAL** (governance belgeleri D4 ile
Ratified; adaptörler Draft — Ratification Pending; çalışma zamanı uygulaması,
kurulum ve Git sürümleme yok)

## P0 — Kaynak kurtarma

- [x] Erişilebilir Director paketinin sürüm ve SHA-256 envanterini çıkar.
- [x] v1.2.2 paketini değiştirmeden `imports/` altında koru.
- [x] Engineering Charter yapıştırılmış metin kaynağını al ve hash'le.
- [x] Agent Roles & Handoff Protocol yapıştırılmış metin kaynağını al ve hash'le.
- [x] Skill & Tool Registry yapıştırılmış metin kaynağını al ve hash'le.
- [x] Agent-Skill Assignment Matrix yapıştırılmış metin kaynağını al ve hash'le.
- [x] Core Operating Instructions yapıştırılmış metin kaynağını al ve hash'le.
- [x] v1.2.3 SKILL ve eval dosyasını Claude Desktop senkron önbelleğinde bul.
- [ ] v1.2.3 SKILL/eval ile v1.2.2 kalan README çelişkisini çöz.
      Gerçek dosya durumu: `imports/7allab-engineering-director-v1.2.3-observed/README.md`
      tarihsel kanıt olarak hâlâ v1.2.2 beyan eder ve değiştirilemez; çelişki
      manifestte `VERSION_CONFLICT` olarak kalır. `director/` altındaki aday
      kopyada SKILL, README ve eval dosyaları 1.2.3 beyan eder (dosya düzeyinde,
      bkz. P3). Bu madde, tarihsel çelişki kayıt altında olduğu için açık kalır.

**Kapı:** Kaynak, sürüm ve içerik çelişkileri çözülmeden miras dosyaları aktif
politika veya kurulu skill olmaz.

## P1 — Kanonik depo temeli

- [x] Ürün repolarından bağımsız bootstrap yapısını hazırla.
- [x] Bootstrap içeriğini `C:\Projeler\7allab-engineering-office` altına
      değiştirmeden kopyala/import et.
- [x] Yerel Git deposunu başlat; başlangıçta remote tanımlama ve commit yapma.
- [x] Manifest ile hedefteki ilk v1.2.2 import hash'lerini karşılaştır.
- [x] Yeni bulunan politika ve v1.2.3 importlarını hedefe kopyala ve hash'le.

**Kapı:** Hedef yalnız yeni ve boş klasör olabilir; mevcut bir klasörün üzerine
yazılmaz.

## P2 — Politika uzlaştırma

- [x] Organizasyonu ana oturum Director + sekiz uzman ajan olarak sabitle.
- [x] Stage, commit ve push işlemlerini ayrı yetki kapıları olarak sabitle.
- [x] Rol, dispatch ve bağımsız review durum modelini tek kaynakta tanımla.
      (Protocol Bölüm 6/6.1'de tanımlı; üç Explore incelemesi REVIEW_PERFORMED.
      Proje sahibi D4 kararıyla belgeyi Ratified yaptı; operasyonel uygulama yok.)
- [x] Dış web/repo içeriğini güvenilmeyen veri olarak ele alan sınırı onayla.
      (Sınır metinde; proje sahibi D4 ile içeren belgeleri onayladı. Zorlayıcı
      araç katmanı veya test yok.)
- [x] KOVAN, APEXO, LIFEACTA ve 7ALLAB Web dokunulmazlarını ayrı adaptörlere ayır.
      (Dört adaptör `governance/project-adapters/` altında Draft — Ratification
      Pending olarak yazıldı; sürümler: KOVAN 0.2-draft, APEXO / LIFEACTA /
      7ALLAB Web 0.3-draft. İlk bağımsız Explore incelemesi: engelleyici bulgu
      yok, yedi Medium bulgu (M1–M7); ikinci kabul incelemesi: F1–F5 (F1 High
      ve diğerleri). M1–M7 ve F1/F2/F3/F5 adaptör metninde yapısal olarak
      düzeltildi (P2-ADAPTER-ALIGN, P2-ADAPTER-FIX). Son bağımsız regresyon
      incelemesi (R1–R12): R9 FAIL (Medium) kaydedildi; bu kayıt silinmez.
      `P2-LIFEACTA-R9` ile giderildi, hedefli incelemede K1–K8 PASS. Adaptörler
      ratifiye DEĞİLDİR: D5 kararıyla yalnızca kontrollü güvenlik referansı
      olarak kabul edildi, statü `Draft — Ratification Pending` kalır.)
- [x] Core Operating Instructions belgesini `Proposed — Ratification Pending`
      olarak sınıflandır. (Sınıflandırma yapıldı; D4 ile belge Ratified.)
- [x] İlk kurulumu proje kapsamlı pilotla sınırla; global kurulum ve Agent Teams'i kapalı tut.

**Kapı:** Dört yönetişim belgesi ile Core Operating Instructions ayrı ayrı
karara bağlanmalı ve onaylanan içerik tek, çelişkisiz sürümde olmalı.
Governance belgeleri için bu kapı, proje sahibinin toplu D4 kararıyla karşılanmış
sayılır: beş belge `Ratified`, sürüm `1.1.1` (karar kaydı:
`docs/DECISIONS-REQUIRED.md`; "ayrı ayrı" ifadesi toplu kararla karşılanmış
sayıldı, sahip aksini isterse yeniden açılır). Ratified, kurulu veya operasyonel
anlamına gelmez ve belgeler henüz Git'te sürümlenmemiştir. Adaptörler bu kapının
dışındadır ve ratifiye değildir.

P2 kayıtları:

- LIFEACTA R9 (FAIL, Medium, yetki genişlemesi yok) kaydı korunur: simülasyon
  kuralı `[GOV]` yasak olarak, ek risk örnekleri `[GOV: Charter 4]` altında
  sunuluyordu. `P2-LIFEACTA-R9` ile iki etiket de düzeltildi (kural `[DERIVED]`,
  örnekler ayrı `[DERIVED]`); hedefli incelemede K1–K8 PASS.
- Bağımsız incelemelerin tamamı Explore (model) çıktısıdır; insan incelemesi
  yapılmadı. Düşük (Low) editoryal bulgular ve INCONCLUSIVE kısımlar bilerek kabul
  edilen istisnalar olarak `docs/DECISIONS-REQUIRED.md` içinde listelidir.
- Adaptörlerdeki `[DERIVED]` öneriler (HIGH risk sınıfları, CONFIDENTIAL
  sınıflandırmaları vb.) bağlayıcı ürün politikası değildir; proje sahibi ayrıca
  ve açıkça kabul etmedikçe tavsiye niteliğindedir.
- **P3 engeli:** Director paketi (`director/`) ön kontrolü (yalnızca okuma, eval
  değil): uzman rol adları uyumlu (QA kısaltmayla); durum sözlüğü
  (REVIEW_PERFORMED, alt çizgili adlar), REVIEW_VERIFIED tanımı ve SEC-01/SEC-02
  veri aktarımı hizalaması eksik, "QA & Test Engineer" adı kullanılmıyor.
- Ürün seçimi ve geliştirme sırası yalnızca proje sahibinin kararıdır
  (bkz. P6/P7); bu yol haritası ürün seçmez veya sıralamaz.

## P3 — Engineering Director düzeltmesi

- [x] v1.2.14 adayında README/SKILL/eval sürüm, kapsam ve durum çelişkisini gider.
- [x] Koordinasyon eval'leri ile gerçek yürütme kabul testlerini ayır.
- [x] N3 senaryo drift'ini kaldır ve sabit istemi koru.
- [ ] Doğrulanmış yeni sürümü paketle ve hash'le.

Not: yukarıdaki işaretli maddeler `director/` altındaki aday dosyaların metin
düzeyidir. v1.2.14 adayı kurulu değildir; tüm senaryolar NOT TESTED'dır. Paket
hash'leri manifestle eşleşir, fakat bu runtime veya davranış kabulü değildir.

**Kapı:** Frontmatter, paket bütünlüğü ve sürüm tutarlılığı doğrulanmalı.

## P4 — Sentetik eval kapısı

- [ ] P1–P3 ve N1–N13 zorunlu koordinasyon kümesini sabit ortam kaydı ve ham
      çıktıyla çalıştır; ürün istemlerini yalnız sentetik Katman A fixture'ı tut.
- [x] Prompt injection, başka repo, dirty tree, secret, yanlış tamamlanma iddiası,
      araç reddi ve işlem-yetki ayrımı senaryolarını sözleşmeye ekle.
- [ ] PASS, FAIL, INCONCLUSIVE ve NOT TESTED kayıtlarını ayrı tut.
- [ ] P1, P3, N9 ve N10 için iki taze PASS; diğer zorunlu senaryolar için en az
      bir PASS kaydet. FAIL'de dur; INCONCLUSIVE için yalnız bir kontrollü tekrar.
- [ ] Ham kanıt paketini ayrı, yetkilendirilmiş insan güvenlik incelemesine sun.

**Kapı:** Hedef sürümde tüm zorunlu senaryolar PASS; belirsiz sonuçlar açıkça
INCONCLUSIVE kalmalı.

## P5 — Sekiz bölüm ajanı

- [ ] Security Engineer
- [ ] Implementation Engineer
- [ ] QA & Test Engineer
- [ ] Software Architect
- [ ] Research Engineer
- [ ] UI/UX Engineer
- [ ] Product Planner
- [ ] Release & Evidence Reviewer

**Kapı:** Reviewer/architect/security varsayılan read-only; yazma ve ağ erişimi
yalnız gereken role ve göreve özgü olmalı. Permission-negative testleri geçmeli.

## P6 — Düşük riskli pilot

Ürün ve görev seçimi bu yol haritasında yapılmaz. Kurulum tamamlandıktan sonra
pilotun ürününü ve görev kapsamını yalnızca proje sahibi belirler; hiçbir ürün
otomatik seçilmez.

- [ ] Proje sahibinin belirlediği ürün ve görev kapsamında kontrollü pilot başlat
      (yalnız sahibin açık kararından sonra).
- [ ] Ayrı branch/worktree ve kesin dosya kapsamı kullan.
- [ ] Implementer ile reviewer rollerini ayır.
- [ ] Gerçek diff, kontrol ve rollback kanıtı kaydet.

## P7 — Ürünlerin katılımı

Yaygınlaştırma sırası yalnızca proje sahibinin yeni ve açık kararına bağlıdır.
Önceden belirlenmiş bir ürün sırası yoktur; daha önce yazılmış herhangi bir sıra
bağlayıcı değildir. Her ürün, katılmadan önce kendi kabul ve güvenlik kapısını
geçer; ilgili proje adaptörü (Draft — Ratification Pending) ratifiye edilmeden
ilgili ürün için kapı geçilmiş sayılmaz.

## P8 — Operasyon

- [ ] Sürüm pinleme ve drift denetimi.
- [ ] Incident ve rollback runbook'u.
- [ ] Resmî Anthropic belge/sürüm yenileme kapısı.
- [ ] Agent Teams ve Cowork için ayrı pilot ve insan onayı.

---

# R0 / K1–K4 eşleme ve takip (EO-R0-C, 2026-10-28)

Bu bölüm P0–P8'i değiştirmez, yeniden yazmaz veya yerine geçmez; yukarıdaki
maddeleri uygulama aşamalarına eşler. Aynı iş iki yerde izlenmez: tamamlanma
işareti yalnız yukarıdaki P maddesinde tutulur, burada kalan iş ve kanıt konumu
verilir. D4 ve D5 kararları (Ratified) değişmemiştir.

## D6 — RATIFIED (2026-10-29)

Proje sahibi aşağıdaki yönü roadmap'e dahil etmeyi 2026-10-28'de bildirdi; o
tarihte resmî yönetişim kararı olarak kaydedilmemişti ve ratifiye edilmemişti.
**Güncel durum: D6, 2026-10-29'da proje sahibinin açık kararıyla RATIFIED
kaydedildi** (`docs/DECISIONS-REQUIRED.md`; D6-1…D6-5 ve D6-3 altındaki beş
açıklama). Governance belgeleri değişmedi; Ratified Protocol 2.1 ve Charter aynen
geçerlidir. D6 ratifikasyonu o tarihteki Director v1.2.13 adayının kabulü değildi;
sonraki v1.2.14 adayını da kabul etmez. Kurulum, uzman dispatch, Git veya K2
kabulü değildir. Aşağıdaki liste
2026-10-28 tarihli yön özetidir; bağlayıcı ifade `DECISIONS-REQUIRED.md` D6
kaydıdır.

- Ana Claude Code oturumunda tek Engineering Director; göreve göre kullanılan
  sekiz uzman subagent (Research Engineer, Product Planner, Software Architect,
  Implementation Engineer, Security Engineer, QA & Test Engineer, UI/UX
  Engineer, Release & Evidence Reviewer).
- Dört ek yetkinlik: Release Engineering, Operations & Reliability, Product
  Marketing & Support, Product Analytics.
- Ürün yaşam döngüsü: Strateji, Keşif, Tanımlama, Tasarım, Planlama, İnşa,
  Kalite, Yayın, İşletme, Ölçüm, geri besleme.
- Ruflo'dan yalnız seçilmiş yöntemlerin değerlendirilmesi: ADR, test-gap, Git
  diff risk analizi, dokümantasyon tutarlılığı, maliyet görünürlüğü. Ruflo'nun
  tamamı kurulmaz; ikinci Director, swarm, zorunlu AgentDB veya autopilot
  oluşturulmaz. Üçüncü taraf modül ancak kaynak, lisans, güvenlik ve gerçek
  fayda doğrulandıktan sonra pilot kapsamına alınabilir.

## Aktif ürün kapsamı (D7, 2026-11-04)

Aktif geliştirme yalnız 7allab-engineering-office projesidir. Engineering Office
tamamlandıktan sonra APEXO, LIFEACTA ve KOVAN bu yapı kullanılarak geliştirilecek
ürün adaylarıdır; kesin ürün ve pilot sırası henüz kararlaştırılmamıştır. Eski
APEX sistemi, APEX-API, APEX-Orkestrator ve 7ALLAB Web kapsam dışıdır. Bu karar
hiçbir ürün reposuna erişim, test, yazma, yayın veya uygulama yetkisi değildir.
P6/P7 sınırları aynen geçerlidir: gerçek repo durumu incelenir, ilgili adapter
ratifiye edilir, görev kapsamı ve izinler doğrulanır, gerekli kullanıcı onayı alınır.

## R0 — Baseline Verification (P0–P2 doğrulaması)

- **Amaç:** Gerçek repo, Director, governance, test ve Claude yapılandırması
  durumunun kanıtlanması.
- **Mevcut durum:** Salt-okunur inceleme yapıldı (2026-10-28, canlı):
  branch `main`, HEAD `1eb2c03e806747ab826e227bfdc5f7707053d595`, remote yok,
  9 durum satırı (4 modified, 5 untracked); `node --test test/*.test.mjs`
  157/157; beş governance belgesi Ratified (D4); adapter'lar
  `Draft — Ratification Pending` (D5); kurulu Director v1.2.4, kaynak aday
  v1.2.8; `.claude/agents/` yok.
- **Kalan görev:** Yok (tek seferlik doğrulama). Değişiklik olursa yeniden
  doğrulanır.
- **Bağımlılık:** Yok.
- **Kabul kriteri:** Yukarıdaki değerlerin komut çıktısıyla doğrulanmış olması.
- **Kanıt konumu:** Bu oturumun komut çıktıları; repoda ayrı kayıt dosyası yok.
  ADIM 55'in önceki sayıları (157/157, hash'ler) tarihsel referanstı ve bugünkü
  doğrulamayla ayrı tutulur.

## K1 — Architecture & Governance Consolidation (P2 artığı, P3)

- **Amaç:** Tek Director sürümü, uzman/skill matrisi, yaşam döngüsü ve D6
  kararının resmîleşmesi.
- **Mevcut durum:** Kullanıcı-senkron v1.2.3, iki farklı hash'li proje v1.2.4
  kopyası ve kaynak aday v1.2.14 (CANDIDATE / NOT TESTED / EVAL GATE
  PENDING; kabul edilmedi) farklı; P3 "doğrulanmış yeni sürümü paketle ve
  hash'le" açık. D6 2026-10-29'da RATIFIED (`docs/DECISIONS-REQUIRED.md`).
  K1-03 belge/matris aşaması tamamlandı: dört ek yetkinliğin sahipliği
  ratifiye Matrix §9'da, Change ID `K1-03-C-COMPETENCY-OWNERS`, 2026-10-29
  (uzman dosyaları ve dispatch bu aşamanın dışındadır, K3). Ruflo yöntemleri
  değerlendirilmedi.
- **Kalan görev:** Hedef Director sürümü için proje sahibi kararı (P3); D6 kaydı
  ve ratifikasyonu tamamlandı (2026-10-29, `docs/DECISIONS-REQUIRED.md`);
  dört yetkinliğin sahipliği tanımlandı (Matrix §9,
  `K1-03-C-COMPETENCY-OWNERS`, 2026-10-29); v1.2.14 için tüm senaryolar NOT
  TESTED'dır; v1.2.13'ün tarihsel kabul sınırlamaları (N1 NOT TESTED; N2, N9,
  P1-r2 INCONCLUSIVE; P3/N10 karışık FAIL/PASS) ve P4 kapısındaki "zorunlu senaryo"
  kümesi için proje sahibi kararı; Ruflo yöntem değerlendirmesinin kaynak, lisans ve güvenlik
  kaydıyla yapılması.
- **Bağımlılık:** Proje sahibi kararları. Governance düzenlemesi ayrı yetki ister.
- **Kabul kriteri:** Tek tutarlı Director sürümü; D6 kayıtlı ve ratifiye (karşılandı: 2026-10-29);
  matris ile roadmap çelişkisiz.
- **Kanıt konumu:** `director/`, `.claude/skills/`, `inventory/source-manifest.json`,
  `docs/DECISIONS-REQUIRED.md`, `governance/`.

## K2 — Security Operational Acceptance (P4, P5 kapısı)

- **Amaç:** Hook/yetki katmanının gerçek ortamda kabulü.
- **Mevcut durum:** Decision Gate sentetik kabul (ADIM 52) ve olay adapter'ı
  (ADIM 53) repoda untracked, 157/157 testle; kayıt:
  `docs/P4_DECISION_GATE_MVP.md`, `docs/P4_TRUST_BOUNDARY.md`.
  ADIM 54 ve ADIM 55 ham kanıtları (`%TEMP%\7allab-adim54-hooktest`,
  `%TEMP%\7allab-adim55-hooktest`; ADIM 55 wrapper'ı `hooks\guard.mjs`) TEMP'te
  kalır. Bütünlük kaydı `docs/ADIM_54_55_EVIDENCE_REGISTER.md` içinde mevcut,
  ancak Git'te **untracked**; SHA-256
  `99B9E9D86B7A02A3ED877987F59427B40F60294610E8A59E6733186C1A11F4EE`.
  ADIM 55 yalnız TEMP prototip kabulüdür; üretim güvenlik kabulü değildir.
  Operasyonel Engineering Office: **NOT VERIFIED**.
- **K2-05-A durum kaydı (2026-11-04):** Salt-okunur host/runtime baseline
  tamamlandı. Claude Code `2.1.318` global npm kurulumu, Anthropic imzalı binary,
  Node/Git imzaları, ayar/skill/talimat yüzeyleri ve ACL'ler envanterlendi;
  payload manifesti `5/5`, security-pilot paket manifesti `18/18` hash eşleşti.
  Managed policy ve etkin hook yok; varsayılan izin modu `auto`; aynı isimde
  user `v1.2.3`, iki farklı hash'li project `v1.2.4` ve repo adayı `v1.2.14`
  Director kopyaları bulundu. Resmî öncelik nedeniyle user kopyasının project
  kopyasını gölgelemesi mümkündür; canlı yüklenen kopya ve home altındaki
  `settings.local.json` etkisi `UNKNOWN` kaldı. Sonuç:
  `K2-05-A READ-ONLY BASELINE COMPLETE / ACCEPTANCE NOT MET`. Kanıt:
  `K2-05-A-host-runtime-baseline-20261104-102004.txt`, SHA-256
  `F000E5C03136A57463147159476BE9B8B7219142206C8E58C726AC22C08B575C`.
- **K2-05-B durum kaydı (2026-11-03):** B-03 Norton/NLOK kontrollü Gate-3
  incelemesi fail-closed sonuçlandı; güvenliği zayıflatmayan dar GUI istisnası
  etkili olmadı ve geçici Norton kuralı geri alındı. Work kanıtı:
  `K2-05-B-B03-gate3-result-20261103-101758.txt`, SHA-256
  `FA35D43CE74AD0FB558AC3EF8CF15C078FB0169E6795E9C6CBED6AE63291499F`.
  Kullanılmadığı doğrulanan Hyper-V KVP/Data Exchange servisi en-az-yetki
  kapsamında kapatıldı; VM `Saved`, özgün iki Extended ACL Deny, NAT ve
  `APEX-API-8811` korundu. Work kanıtı:
  `K2-05-B-kvp-disable-evidence-20261103-103600.txt`, SHA-256
  `C12E0085DBAC48FD1AFABE5E07E90138DE4AE4B3F45602ACB42C3070379F5BFB`.
  Dar GUI istisnası VM-forwarded Ethernet katmanında etkisiz kaldığından sonuç
  `FAIL-CLOSED / ACCEPTANCE NOT MET`; K2-05-B ağ kabulü tamamlanmadı. B kaydı
  sırasında korunan APEX daha sonra D7 kapsamında, 2026-11-04'te ayrı açık
  onayla askıya alındı; bu sonraki değişiklik B kanıtını geriye dönük değiştirmez.
- **K2-05-C durum kaydı (2026-11-03):** Yönetici-korumalı managed-settings
  kurulumu, kaynak/hedef hash eşitliği, standart kullanıcı yazma reddi, güvenli
  Read, Write/Edit/Bash/PowerShell negatifleri, eksik/çöken/zaman aşan hook
  fail-closed davranışı, canlı `onFailure:block`, RestoreGood ve tam rollback
  kontrollü kapsamda PASS. Kanıt:
  `K2-05-C-managed-hooks-evidence-20261103-212330.txt`, SHA-256
  `E5852DF4046B31FD3B30DDA3F1FD6682BBF5EA1BCF2CF9308BC2B0177C76E156`.
  Son bağımsız yokluk kontrolünde `C:\Program Files\ClaudeCode`, managed
  settings, `7allab-k2` ve `blocked.txt` yoktur. Sonuç yalnız
  `K2-05-C SCOPED CONTROLLED GATE PASS`; bağımsız insan güvenlik incelemesi
  tamamlanmadı ve nihai K2 kabulü değildir.
- **K2-05-A tanımı (D8, 2026-11-04) — Host/runtime güvenlik tabanı:** Claude
  Code ve ilgili runtime sürümleri, etkin global/proje kurulum yüzeyleri, ayar
  önceliği, default-deny kontrolleri, ACL'ler ve dosya/paket hash'leri
  salt-okunur envanterle kanıtlanır. Erişilemeyen veya kaynağı belirsiz yüzey
  `UNKNOWN` kalır; PASS sayılmaz. Kabul için envanter tekrar üretilebilir,
  beklenmeyen etkin yüzey yok veya açıkça karantinadadır ve hiçbir sır kanıta
  girmez.
- **K2-05-D tanımı (D8, 2026-11-04) — Model-dışı yetki defteri:** Yetkinin
  aktörü, kapsamı, izin verilen işlem, süre/son kullanım, tek kullanımlılık,
  ret ve geri alma durumu model-yazma sınırı dışında tutulur. Kabul için eksik,
  süresi dolmuş, yeniden kullanılan, geri alınmış ve kapsam dışı yetki canlı
  negatiflerde fail-closed reddedilir; başarılı kullanım değişmez bir denetim
  izi üretir ve prompt/tool içeriğindeki sahte onay yetki oluşturmaz.
- **K2-05-E tanımı (D8, 2026-11-04) — Sır ve veri aktarım sınırı:** Ham kimlik
  bilgileri AI bağlamı, prompt, log ve harici araçlardan dışlanır; connector,
  MCP ve ağ aktarımı veri sınıfı, hedef ve açık izinle sınırlandırılır. Kabul
  için gerçek sır kullanılmadan sentetik işaretleyicilerle redaksiyon, dış
  aktarım reddi, hedef/kapsam ayrımı ve proje izolasyonu pozitif/negatif olarak
  kanıtlanır; ham sır hiçbir kanıt dosyasına girmez.
- **K2-05-F tanımı (D8, 2026-11-04) — Bütünleşik kabul ve geri dönüş:** A–E
  sonuçları tek bir kapsam/kanıt matrisiyle birleştirilir; negatif senaryolar,
  rollback/recovery, hash bütünlüğü ve bağımsız insan güvenlik incelemesi
  tamamlanır. F önceki kapılardaki FAIL, UNKNOWN veya NOT VERIFIED durumunu
  geçersiz kılamaz. Kabul için her zorunlu kapı kanıtlı PASS, geri dönüş
  tekrarlanabilir ve insan incelemesi kayda bağlı olmalıdır.
- **Kalan görev:** (1) K2-05-B için Norton'u veya host güvenliğini zayıflatmayan
  ağ çıkış tasarımı ve kontrollü pozitif/negatif kabul; (2) K2-05-C bağımsız
  insan güvenlik incelemesi; (3) K2-05-A baseline bulgularının kabul düzeltmesi;
  (4) K2-05-D yetki defteri tasarım/uygulama/negatifleri; (5) K2-05-E sır ve
  veri aktarım sınırı tasarım/uygulama/negatifleri; (6) K2-05-F bütünleşik
  rollback, kanıt matrisi ve bağımsız insan kabulü.
- **Bağımlılık:** Her sistem değişikliği, test yürütmesi, hook/ayar kurulumu ve
  insan kabulü kendi ayrı yetki kapısına tabidir.
- **Kabul kriteri:** Tanımlı K2-05 kapılarının canlı pozitif/negatif kanıtları,
  rollback ve bağımsız insan incelemesi tamamlanmış; sentetik kontrol canlı
  kanıt gibi sunulmamış olmalıdır.
- **Kanıt konumu:** Work kanıtları ayrı outputs dizinlerinde; bütünlük kaydı ve
  P4 dokümanları repo çalışma ağacında untracked. Bunlar stage/commit edilmedi.
  **K2 NOT VERIFIED; AUTHORITY.implemented=false**.

## K3 — Specialist Agent Integration (P5)

- **Amaç:** Sekiz uzmanın en az yetkiyle gerçek subagent olarak devreye alınması.
- **Mevcut durum:** Kurulu subagent yok (`.claude/agents/` yok); P5 maddeleri açık.
- **Kalan görev:** Rol başına en az yetki tanımı, görev yönlendirme, skill
  seçimi, dört ek yetkinliğin skill/prosedür olarak bağlanması, gerçek dispatch
  ve permission-negative testleri. Yeni ajan oluşturulmadan önce ayrı yazma
  yetkisi gerekir.
- **Bağımlılık:** K1 (D6, Director sürümü), K2 (korunmuş hook katmanı).
- **Kabul kriteri:** P5 kapısı: reviewer/architect/security varsayılan
  read-only, yazma ve ağ yalnız gereken role; permission-negative testleri PASS.
- **Kanıt konumu:** `.claude/agents/` (henüz yok), test kayıtları.

## K4 — Product Pilot & Acceptance (P6, P7)

- **Amaç:** Engineering Office tamamlandıktan sonra, kontrollü gerçek görevlerle
  ürün geliştirme ve ürün düzeyinde kabul.
- **Mevcut durum:** Başlanmadı. D7 uyarınca APEXO, LIFEACTA ve KOVAN sonraki ürün
  adaylarıdır; kesin geliştirme ve pilot sırası henüz kararlaştırılmadı. Bugün
  hiçbir ürün reposu aktif değildir. Eski APEX ve 7ALLAB Web kapsam dışıdır.
- **Kalan görev:** Ürün başına P6/P7 adımları (ayrı branch/worktree, kesin dosya
  kapsamı, implementer/reviewer ayrımı, diff ve rollback kanıtı) ile test,
  build, inceleme, yayın hazırlığı ve ölçüm.
- **Bağımlılık:** K2 ve K3 tamamlanarak Engineering Office'un kullanıma hazır
  olması; ilgili ürün adapter'ının ratifikasyonu; ürün repo durumu doğrulaması;
  kullanıcı onayı.
- **Kabul kriteri:** Her ürün için kendi kabul ve güvenlik kapısı (P7).
- **Kanıt konumu:** İlgili ürün reposu ve bu repoda pilot kaydı (henüz yok).

## Sonraki en küçük iş paketi

**Director v1.2.14 aday eval yürütmesi.** Kimlik, Office-first kapsam ve zorunlu
eval sözleşmesi kaynak paketinde uzlaştırıldı; aday NOT TESTED ve kurulu değildir.
Sıradaki en küçük iş, ayrı test/maliyet izniyle A grubunu izole ortamda çalıştırmak
ve ham kanıtı kaydetmektir. Kabul tamamlanmadan user skill
kaldırılmaz, güncellenmez veya devre dışı bırakılmaz; `.claude` ya da `.agents`
kopyası güncellenmez ve etkin varsayılmaz. Kurulum, ayar, managed policy ve Git
işlemleri ayrı açık izin gerektirir.

K2-05-B için çevrimdışı artefakt aktarımı, hedef-kısıtlı host proxy/relay veya
ayrı güvenlik geçidi seçeneklerinden biri ayrıca seçilecektir. Norton kapatma,
ağ güvenini genişletme, doğrudan external vSwitch veya başka bir host güvenliği
zayıflatması varsayılan çözüm değildir ve ayrı güvenlik tasarımı/onayı olmadan
uygulanmaz.

K2-05-C için tamamlanan canlı testler tekrarlanmaz; sıradaki C işi bağımsız insan
güvenlik incelemesidir. K3 başlamadan önce K1'deki Director sürüm kabul engeli ve
K2'nin tanımlı kapıları kapanmalıdır. K4, APEXO, LIFEACTA veya KOVAN için ancak
Engineering Office kullanıma hazır olduktan, K2/K3 tamamlandıktan ve ilgili
adapter ratifiye edildikten sonra başlar. Bu kayıt sistem değişikliği,
kurulum, test yürütme, ürün repo yazması veya Git yetkisi değildir.

**K2 NOT VERIFIED; AUTHORITY.implemented=false**.
