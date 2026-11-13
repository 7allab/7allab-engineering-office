# Kurulum Yol Haritası

Durum: **BOOTSTRAP IN PROGRESS — NOT OPERATIONAL** (governance belgeleri D4 ile
Ratified; adaptörler Draft — Ratification Pending; çalışma zamanı uygulaması,
kurulum ve Git sürümleme yok)

Güncel günlük yürütme ve hızlandırılmış kritik yol:
`docs/ACCELERATED-EXECUTION-PLAN.md`. Bu roadmap tarihsel karar ve kilometre
taşı kaydıdır; aktif iş sırası yalnız hızlandırılmış plandaki W0–W5 panosunda
tutulur. Kabul statülerinin sahibi bu belge ve `DECISIONS-REQUIRED.md` olmaya
devam eder.

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
- **P3 engeli — tarihsel kayıt (eski/tarihsel ve güncel durumu belirlemiyor):**
  Director paketi (`director/`) ön kontrolünde (yalnızca okuma, eval değil)
  gözlenen durum sözlüğü (REVIEW_PERFORMED, alt çizgili adlar), REVIEW_VERIFIED
  tanımı, SEC-01/SEC-02 veri aktarımı hizalaması ve "QA & Test Engineer" adı
  uyumsuzlukları v1.2.14 eval kampanyasında (D10/D11, 2026-11-07) giderilmiştir;
  artık güncel bir engel değildir (bkz. aşağıdaki P3 bölümü ve güncel durum).
- Ürün seçimi ve geliştirme sırası yalnızca proje sahibinin kararıdır
  (bkz. P6/P7); bu yol haritası ürün seçmez veya sıralamaz.

## P3 — Engineering Director düzeltmesi

- [x] v1.2.14 adayında README/SKILL/eval sürüm, kapsam ve durum çelişkisini gider.
- [x] Koordinasyon eval'leri ile gerçek yürütme kabul testlerini ayır.
- [x] N3 senaryo drift'ini kaldır ve sabit istemi koru.
- [x] Doğrulanmış yeni sürümü paketle ve hash'le.

**Paket kaydı (2026-11-08):**
- Paket yolu: `C:\Projeler\7allab-engineering-office-releases\7allab-engineering-director-v1.2.14\`
  (ve `...\7allab-engineering-director-v1.2.14.zip`, repo dışında).
- Paket içeriği: yalnız `SKILL.md`, `README.md`, `MANIFEST.sha256` (evals/run-kit/rc,
  `.claude`, `.agents`, `inventory/source-manifest.json`, kanıt/transkript dosyası yok).
- ZIP SHA-256: `D668924A0AF7FC268AF16C1D42DB106C3A2131D89257A7070B8F1CC8AD5B41A0`
  (2026-11-08 taşınabilirlik düzeltmesi — giriş adları `/` ile; önceki ZIP
  `CF849B8BF87D1CE6D2E87A10142D63E53EBD82AC3849DFB089588D7DD3EBF3E6` Windows
  `\` ayırıcı kullanıyordu, bu değerle değiştirildi).
- Kaynak hash'leri: `SKILL.md` `8A0A346FB0B8281DD44A44CB7799C17560BEEC53C55F703C71C99D3F29A01643`;
  `README.md` `B998D28A1B034BE4ACF82E9BC4906D458F89AC2CA030CC4BC7D09859D4E6FCDE`.
- Paket manifest doğrulaması: ZIP içindeki `SKILL.md`/`README.md` bayt bazında kaynakla
  eşleşti; `MANIFEST.sha256` kayıtları yeniden hesaplanan hash'lerle eşleşti (2/2 eşleşme).
- Durum: **NOT INSTALLED / NOT OPERATIONALLY ACCEPTED** — paket üretimi kurulum, aktivasyon
  veya operasyonel kabul değildir.
- `.claude/skills/...` (v1.2.4, hash `324B114F45D8F2F0D30BB2CBCED5CE8C757779DF3A632C2B1C5A5F993F5DAD65`)
  ve `.agents/skills/...` (v1.2.4, hash `1A749FE39B7D0D6BFE0B5912646634649CCCAB17A2833916A447C53D6CEA6930`)
  bu paketleme sırasında **değiştirilmedi** — her ikisi de bu işlemden önceki hash'leriyle
  aynı kaldı.

Not: yukarıdaki işaretli maddeler `director/` altındaki aday dosyaların metin
düzeyidir. **v1.2.14 adayı kurulu değildir.** `.claude/skills/` ve
`.agents/skills/` altında tracked, temiz v1.2.4 kopyaları bulunmaktadır; bu
kopyalar bu adayın runtime kimliği değildir ve bu paketleme sırasında
değiştirilmemiştir (yukarıdaki Paket kaydı'ndaki hash'ler). **Zorunlu
koordinasyon eval kümesi test edilmiştir:** 13 senaryo, 17 koşu; D10/D11
sonrasında ratifiye edilen ölçüm sözleşmesine göre **17/17 PASS** (ayrıntı:
aşağıdaki P4 bölümü). Ratifiye edilen kararlar D10/D11'dir; eval sonucu
kurulum veya operasyonel kabul değildir. Mevcut aday kaynak dosyalarının
hash/attribution zinciri doğrulanmıştır; **P3'teki paketleme ve hash'leme işi
tamamlanmıştır** (bkz. yukarıdaki Paket kaydı) — ancak bu da kurulum veya
operasyonel kabul değildir. **P3 için sıradaki durum:** doğrulanmış paket
artefaktı hazır; kurulum/aktivasyon ayrı, açık yetki gerektiren bir kapıdır.
**P4'teki bağımsız insan güvenlik incelemesi tamamlandı** (2026-11-08, proje
sahibi Cem; `docs/P4-HUMAN-REVIEW-2026-11-08.md`) ve P4 koordinasyon eval
kapısı ACCEPTED olarak kapandı. Bu, P3'ün kurulum/aktivasyon kapısını
etkilemez — o ayrı ve hâlâ açık yetki gerektiren bir kapıdır.

**Kapı:** Frontmatter, paket bütünlüğü ve sürüm tutarlılığı doğrulanmalı.

## P4 — Sentetik eval kapısı

- [ ] P1–P3 ve N1–N13 zorunlu koordinasyon kümesini sabit ortam kaydı ve ham
      çıktıyla çalıştır; ürün istemlerini yalnız sentetik Katman A fixture'ı tut.
- [x] Prompt injection, başka repo, dirty tree, secret, yanlış tamamlanma iddiası,
      araç reddi ve işlem-yetki ayrımı senaryolarını sözleşmeye ekle.
- [ ] PASS, FAIL, INCONCLUSIVE ve NOT TESTED kayıtlarını ayrı tut.
- [ ] P1, P3, N9 ve N10 için iki taze PASS; diğer zorunlu senaryolar için en az
      bir PASS kaydet. FAIL'de dur; INCONCLUSIVE için yalnız bir kontrollü tekrar.
- [x] Ham kanıt paketini ayrı, yetkilendirilmiş insan güvenlik incelemesine sun —
      tamamlandı (2026-11-08). Bkz. `docs/P4-HUMAN-REVIEW-2026-11-08.md`.

**Kapı:** Hedef sürümde tüm zorunlu senaryolar PASS; belirsiz sonuçlar açıkça
INCONCLUSIVE kalmalı. (D11 ile zorunlu küme koordinasyon davranışına daraltıldı;
tetikleme disiplini ayrı kapıdır.)

**Durum (2026-11-08, bağımsız insan incelemesi tamamlandı) — P4 KOORDİNASYON
EVAL KAPISI KAPANDI (ACCEPTED).** Zorunlu küme redefinize edildi; koordinasyon
kümesi kanıt olarak tamamdır. Bağımsız insan güvenlik incelemesi proje sahibi
Cem tarafından 2026-11-08'de yapılmıştır; `REVIEW_PERFORMED = YES`,
`REVIEW_VERIFIED = YES`, `P4_COORDINATION_EVAL_GATE = ACCEPTED` (bkz.
`docs/P4-HUMAN-REVIEW-2026-11-08.md`). **Bu kabul yalnız P4 koordinasyon eval
kapısına aittir** — kurulum, runtime enforcement, K2/K3/K4 kabulü, global
kurulum, Agent Teams veya Git yetkisi **değildir** ve bunları değiştirmez.

- **Zorunlu küme (D11 Seçenek 2 ile redefinize, 2026-11-07):** P1–P3 ve
  N3–N13 = **13 senaryo** (koordinasyon davranışı). N1, N2, N11 (C grubu,
  negatif tetikleme) bu kümeden çıkarılmış, ayrı "tetikleme disiplini"
  kapısına taşınmıştır; o kapının kabul kriterleri henüz tanımlanmamıştır
  (ayrı iş paketi, bkz. Sonraki en küçük iş paketi).
- **Koşulan:** 13 senaryo / 17 koşu / **17 PASS**, 0 FAIL, 0 INCONCLUSIVE.
  P1, P2, P3, N3, N4, N5, N6, N7, N8, N9, N10, N12, N13. İki taze PASS gereken
  dört senaryonun (P1, P3, N9, N10) hepsi karşılandı. Ölçülen maliyet $7,4805.
  **Redefinize edilmiş zorunlu küme %100 koşuldu, 13/13 PASS.**
- **D10 (2026-11-07 RATIFIED):** B3-N6 koşu 1 artık koşulsuz PASS'tır.
- **Sürüm atfı:** E4 dondurma referansı doğrulandı; aday `SKILL.md` = `8a0a346f…`
  E4 ile aynı (donma commit'inden beri değişmedi). `README.md`'nin commit
  edilmiş/donmuş hali de E4 ile aynıdır (`b184e4b7…`); çalışma ağacındaki güncel
  metadata README'si (`b998d28a…`) bundan kasıtlı olarak farklıdır — bu sapma,
  `7allab-eval-1214/ATTRIBUTION-ADDENDUM-2026-11-08.md` ile belgelenmiş,
  davranışı etkilemeyen bir durum-metni düzeltmesidir (8/8 PASS,
  `verify-freeze.py`). RC paketi yalnız `name:` satırında farklı (`name:`
  çıkarıldığında gövde özeti her üçünde `9e703327…`). Dondurma commit'i
  `31019228` → kampanya HEAD `b650e36` arasında aday kaynağında değişiklik
  yok. Kayıt: `7allab-eval-1214/ATTRIBUTION-CHAIN.md` ve
  `ATTRIBUTION-ADDENDUM-2026-11-08.md`.
- **Kanıt paketi:** `C:\Projeler\7allab-eval-1214\evidence\` (17 kayıt) ve
  `transcripts\` (17 ham olay akışı), `MANIFEST.sha256` 53 kayıt / 0 uyuşmazlık
  (52 orijinal + attribution addendum, 2026-11-08). İnsan incelemesi için
  rehber: `REVIEW-GUIDE.md`.
- **Bağımsız insan güvenlik incelemesi tamamlandı (2026-11-08):** proje sahibi
  Cem, inceleyen sıfatıyla (Charter gereği uygulayıcıdan farklı) kaydını
  yapmıştır. Ayrıntı, korunan sınırlamalar ve kabul kapsamı:
  `docs/P4-HUMAN-REVIEW-2026-11-08.md`.
- **Ayrı, henüz tanımsız iş paketi:** C grubu (N1, N2, N11) için "tetikleme
  disiplini" kapısının kabul kriterlerini yazmak (D11 Seçenek 2'nin gerektirdiği
  takip işi — P4'ü bloklamaz, kendi başına ayrı bir kapıdır).
  Bulgu listesi: `docs/1.2.15-ADAY-BULGULAR.md` — hiçbiri kaynağa işlenmemiştir
  (E4 gereği).

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

## Aktif ürün kapsamı (D7, 2026-11-10 revizyonu)

Aktif geliştirme yalnız 7allab-engineering-office projesidir. Engineering Office
tamamlandıktan sonra yalnız APEXO ve LIFEACTA bu yapı kullanılarak geliştirilecek
ürün adaylarıdır; kesin ürün ve pilot sırası henüz kararlaştırılmamıştır. KOVAN,
eski APEX sistemi, APEX-API, APEX-Orkestrator ve 7ALLAB Web kapsam dışıdır.
Tarihsel KOVAN adaptörü ve kanıt kayıtları korunur. Bu karar
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
- **Mevcut durum (2026-11-08 ile güncellendi):** Kullanıcı-senkron v1.2.3 ve
  iki farklı hash'li proje v1.2.4 kopyası hâlâ etkin (kanonik repoda kısa
  ismi v1.2.4 kazanır — bkz. aşağıda K2-05-A). Kaynak aday **v1.2.14** artık
  NOT TESTED değildir: P4 bölümündeki güncel kayıtla tutarlı olarak, zorunlu
  koordinasyon kümesi (13 senaryo, 17 koşu) **17/17 PASS**'tır (D10/D11 ile
  RATIFIED, 2026-11-07; E4 kaynak dondurma zinciri doğrulandı). **Bu, kurulum
  veya operasyonel kabul DEĞİLDİR.** D6 2026-10-29'da RATIFIED
  (`docs/DECISIONS-REQUIRED.md`). K1-03 belge/matris aşaması tamamlandı: dört
  ek yetkinliğin sahipliği ratifiye Matrix §9'da, Change ID
  `K1-03-C-COMPETENCY-OWNERS`, 2026-10-29 (uzman dosyaları ve dispatch bu
  aşamanın dışındadır, K3). Ruflo yöntemleri değerlendirilmedi.
- **Kalan görev:** v1.2.14 paketleme ve hash'leme P3 kaydına göre tamamlandı.
  Kritik yolda kalan iş, project/synced v1.2.3/v1.2.4 kopyalarının
  kurulum/kaldırma/karantina kararıdır (proje sahibine ait, ayrı açık yetki
  gerekir ve K2 canlı kampanyasıyla birlikte planlanır). **P4:** bağımsız insan güvenlik incelemesi tamamlandı
  (2026-11-08) ve P4 koordinasyon eval kapısı ACCEPTED olarak kapandı
  (`docs/P4-HUMAN-REVIEW-2026-11-08.md`); bu kabul yalnız P4 koordinasyon
  eval kapısına aittir, kurulum/K2-K3-K4 kabulü değildir. Ayrı tetikleme
  disiplini kapısı (N1/N2/N11) için
  kabul kriterleri henüz tanımlı değildir (D11 Seçenek 2). *Tarihsel, güncel
  durumu belirlemez:* v1.2.13'ün o zamanki kabul sınırlamaları (N1 NOT
  TESTED; N2, N9, P1-r2 INCONCLUSIVE; P3/N10 karışık FAIL/PASS) v1.2.14
  kampanyasıyla aşılmıştır, salt tarihsel referans olarak kalır. Ruflo
  yöntem değerlendirmesinin kaynak, lisans ve güvenlik kaydıyla yapılması.
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
- **K2-05-A durum kaydı (2026-11-04, 2026-11-07 ile düzeltildi):** Salt-okunur
  host/runtime baseline tamamlandı. Claude Code `2.1.319` global npm kurulumu
  (2026-11-07'de canlı doğrulandı, `C:\Users\crypt\AppData\Roaming\npm\claude.ps1`).
  Managed policy ve etkin hook yok; kullanıcı kapsamı `settings.json`
  `permissions.defaultMode: "auto"`, `blockReadsOutsideWorkingDirectories: true`;
  `settings.local.json` yalnızca ilgisiz Bash/WebSearch izinleri içeriyor, Director
  ile ilgili bir giriş yok.
  **2026-11-07 düzeltmesi — "UNKNOWN" sonlandırıldı, somut bulguya dönüştürüldü:**
  resmî Claude Code dokümantasyonu doğrulandı (`code.claude.com/docs/en/skills`,
  "Resolve skills that share a name"): aynı isimli skill'lerde öncelik
  personal > project; ancak hesap-senkron (synced) bir skill yerel (personal
  veya project) bir skille çakışırsa **kısa ismi yerel skill kazanır**, senkron
  kopya yalnızca `anthropic-skills:<isim>` adıyla erişilebilir kalır. Canlı
  taranan durum: proje kapsamında (`C:\Projeler\7allab-engineering-office\.claude\skills\`)
  Director **v1.2.4**; hesap-senkron kopyada (`~\.claude\skills\synced\...`)
  Director **v1.2.3**; test edilen/dondurulan aday **v1.2.14** yalnızca izole
  eval ortamında (`7allab-eval-1214`), ayrı isimle (`-rc`) kurulu. **Sonuç:**
  kanonik repo içinde çalışılırken kısa ismi proje kopyası v1.2.4 kazanır —
  yani 1.2.14 kampanyasının 17/17 PASS kanıtı gerçekte invoke edilebilen hiçbir
  canlı kopyaya uygulanmaz. Bu durum K2-05-A tanımındaki "beklenmeyen etkin
  yüzey yok veya açıkça karantinadadır" şartını **karşılamaz**: iki eski, test
  edilmemiş kopya (v1.2.3, v1.2.4) hâlâ etkin ve karantinada değil. Sonuç
  değişmedi ama artık UNKNOWN değil:
  `K2-05-A READ-ONLY BASELINE COMPLETE / ACCEPTANCE NOT MET — nedeni somutlaştı:
  iki test edilmemiş Director kopyası (project v1.2.4, synced v1.2.3) hâlâ
  etkin ve karantinaya alınmamış`. Kanıt: `K2-05-A-host-runtime-baseline-20261104-102004.txt`,
  SHA-256 `F000E5C03136A57463147159476BE9B8B7219142206C8E58C726AC22C08B575C`
  (tarihsel); 2026-11-07 doğrulaması bu oturumun komut çıktılarıdır, ayrı dosya
  kaydı yok. **Kalan görev:** v1.2.14 kabul edilip kanonik repoya kurulana kadar,
  project ve synced kopyaların kurulum/kaldırma/karantina kararı proje sahibine
  aittir (ayrı açık yetki gerekir — bu bulgu kendiliğinden hiçbir dosyayı
  silmez veya değiştirmez).
- **`.agents/skills/` yüzeyi (2026-11-08 kaydı):** `.agents/skills/7allab-engineering-director/SKILL.md`
  git'te tracked ve temizdir (HEAD ile birebir eşleşir), içerik v1.2.4'tür;
  `.claude/skills/` kopyasından tek satır farklıdır (platform cümlesi "Claude
  Code" → "Codex"). Hangi platform tarafından gerçekten keşfedildiği/tarandığı
  **UNKNOWN**'dur — bu oturumda doğrulanabilecek resmî bir Codex skill-keşif
  mekanizması bulunamadı. Bu kopyanın değiştirilmesi veya kaldırılması bu iş
  paketinin kapsamında değildir. Eski kopyalar (project v1.2.4 × 2, synced
  v1.2.3) paket üretimini değil, kurulum/aktivasyon kabulünü bloklar.
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
- **K2-05-B tasarım kararı (D12, 2026-11-07 RATIFIED):** Yukarıdaki fail-closed
  sonuçtan sonra, ayrı bir AI aracıyla (Codex) yapılan daha derin kök-neden
  teşhisi (`Documents\Codex\2026-10-31\...-4`, 2026-11-01/03) temel pozitif
  kontrollerin (ICMP, TCP:443) guest VM içinden FAIL verdiğini ve paket
  yakalamanın kök nedeni netleştiremediğini kaydetmiştir; o rapor yeni
  müdahaleye yetki vermemektedir. Proje sahibi 2026-11-07'de **Seçenek 1
  (çevrimdışı artefakt aktarımı)** kararını onayladı: sandbox VM'e kalıcı
  internet erişimi verilmeyecek, çıktılar yalnızca insan onaylı çevrimdışı
  adımla taşınacak. Kayıt: `docs/DECISIONS-REQUIRED.md` D12. **Bu, ağ kabul
  testlerinin yapıldığı anlamına gelmez** — yalnızca tasarım yönü belirlendi;
  somut mekanizma tasarımı ve pozitif/negatif kabul testleri hâlâ açık iştir.
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
  **2026-11-08 güncellemesi:** yukarıdaki kanıt dosyası
  (`K2-05-C-managed-hooks-evidence-20261103-212330.txt`) bu hostta kapsamlı
  bir aramayla (Desktop, Downloads, Documents, kullanıcı kökü, Public,
  `C:\7allab-sandbox-io`, `C:\Projeler`, `C:\` kökü, `AppData\Local\Temp`,
  `AppData\Roaming`) **bulunamadı**. Dosya olmadan 2026-11-03 tarihli canlı
  test iddiası bağımsız olarak yeniden doğrulanamaz; durum bu nedenle
  `SCOPED CONTROLLED GATE PASS` değil **`UNVERIFIED`** olarak
  güncellenmiştir. Bu eksiklik K2-05-D/E'nin bağımsız doğrulanmış
  kanıtlarıyla kapatılmaz; yeniden test (dosyanın bulunması veya testin
  tekrarı) ayrı yetki ve ayrı iş paketidir. Ayrıntı:
  `docs/DECISIONS-REQUIRED.md` "Bilerek kabul edilen açık istisnalar" madde
  9, `docs/K2-BAGIMSIZ-INCELEME-REHBERI.md` Bölüm 2.
  **2026-11-10 güncellemesi:** Eski 3 Kasım dosyası hâlâ yoktur ve tarihsel
  iddia geriye dönük doğrulanmış sayılmaz. Bunun yerine taze P1–P6 Windows
  Sandbox kanıtları, 149 dosyalık indeks + indeksin kendisiyle ayrı bir
  değişmez inceleme paketinde korunmuştur. Altı koşu mock-endpoint gözlemidir.
  2026-11-10 bağımsız insan incelemesi tamamlandı; nihai sınıflandırma
  `REVIEW_PERFORMED_NOT_VERIFIED` (`REVIEW_PERFORMED=YES`,
  `REVIEW_VERIFIED=NO`) oldu. O1 parse/load kesin değil, O4
  yalnız Write için kısmi, O6 diagnostic-only ve altı `result.json` koşu-düzeyi
  `auth_mode`/`auth_provenance` taşımadığından O7 `INCONCLUSIVE` kalır. Güncel
  gap kaydı: `test/security-pilot/K2-05-C-GAP-MATRIX.md`; insan inceleme kaydı:
  `docs/K2-05-C-HUMAN-REVIEW-2026-11-10.md`. Genel statü:
  **`K2-05-C UNVERIFIED / REVIEW_PERFORMED_NOT_VERIFIED`**.
- **K2-05-D durum kaydı (D13, 2026-11-07 — düzeltildi, mevcut G1 paketi temel
  alındı):** Sıfırdan tasarım taslağı geri çekildi; `C:\Users\crypt\
  7allab-k2-production-staging-20261030\` altındaki staged "K2-04-G1" paketi
  (`identity-gate.mjs → guard.mjs → decision-gate-event-adapter.mjs` +
  `authority-grant.mjs`) K2-05-D'nin D8 tanımını zaten karşılıyor (aktör/kapsam/
  işlem/süre/tek-kullanımlılık/ret/geri-alma model-yazma sınırı dışında, hash
  doğrulamalı, fail-closed, model'in "onaylandı" iddiaları yok sayılıyor).
  2026-11-07'de **gerçek (mock olmayan) cc-agent Windows kimliği altında** canlı
  test yapıldı: `cc-agent` hesabı proje sahibi tarafından oluşturuldu
  (`net user cc-agent *`, şifre görülmeden), G1 paketinin 6 `.mjs` dosyası ve
  `managed-settings.json` paylaşılan bir test dizinine (`C:\Users\Public\
  g1-ccagent-test\`, `C:\Program Files\` DOKUNULMADI) kopyalandı, `cc-agent`
  oturumunda `run-as-ccagent.ps1` çalıştırıldı. Sonuç: `ran_as` alanı gerçek
  cc-agent SID'ini (`S-1-5-21-2587344737-3047673138-827517886-1009`) doğruladı;
  8/8 test durumu (4 PreToolUse + 4 PermissionRequest; Write/Read × içeride/
  dışarıda) paketin kendi offline referans sonucuyla (`verify\result-3-ccagent.json`,
  TEST-ONLY mock kimlik) istisnasız örtüştü. İlk koşuda betikte unutulan
  `CLAUDE_PROJECT_DIR` ortam değişkeni nedeniyle 7/8 eşleşme vardı; kök neden
  kaynak koddan doğrulanıp (`guard.mjs`/`guard-scope.mjs`, referans:
  `run-chain.mjs`) betik düzeltildi ve ikinci koşuda 8/8'e tamamlandı. **Sonuç:**
  `K2-05-D STAGED PACKAGE REAL-IDENTITY TEST PASS (8/8)` — ancak bu, G1 paketinin
  `node.exe` ile doğrudan çağrılmasıyla elde edildi, gerçek Claude Code hook
  mekanizması üzerinden canlı kurulumla (K2-05-C'dekiyle aynı sınıfta kurulum/
  geri-alma kanıtı) değil; o kanıt turu ve bağımsız insan güvenlik incelemesi
  hâlâ açıktır. Kayıt: `docs/DECISIONS-REQUIRED.md` D13.
- **K2-05-D EK — canlı kurulum kanıtı (2026-11-08, proje sahibi açık onayı):**
  G1, `C:\Program Files\ClaudeCode\managed-settings.json` +
  `C:\Program Files\7allab-security\` üzerinden gerçekten kuruldu. Hem crypt
  (ALLOW, muafiyet) hem cc-agent (Read-proje-içi ALLOW, Write-proje-dışı
  **DENY exit=2**) gerçek Claude Code CLI + gerçek managed hook mekanizması
  üzerinden (`--debug=hooks` ham log kanıtıyla, model raporuyla değil) test
  edildi; DENY testinde dosyanın gerçekten oluşmadığı `Test-Path` ile
  doğrulandı. Ardından tam geri alma yapıldı (her iki dizin silindi) ve hem
  dosya yokluğu hem **davranışsal yokluk** (silme sonrası aynı test tekrar
  koşulup hook referansının log'dan kaybolduğu) doğrulandı. Kayıt:
  `docs/DECISIONS-REQUIRED.md` D13 — EK. **Kalan açık:** bağımsız insan
  güvenlik incelemesi. **Ayrı, çözülmemiş sistem değişikliği (K2-D
  başarısının parçası DEĞİL):** test için cc-agent hesabına kalıcı bir
  `@anthropic-ai/claude-code` npm global kurulumu yapıldı; bu geri alma
  kapsamına girmedi (yalnızca managed-hook dizinleri kaldırıldı), hâlâ
  durmaktadır; kaldırılıp kaldırılmayacağı proje sahibinin ayrı kararını
  bekleyen bir sistem değişikliğidir (ayrıntı: `docs/DECISIONS-REQUIRED.md`
  D13 — EK).
- **K2-05-E durum kaydı (D14, 2026-11-07 — RATIFIED, sıfırdan tasarım +
  prototip test; ratifikasyon öncesi mühendislik incelemesi prototip
  hook'ların fail-open hata işleme hatasını bulup düzeltti, artık
  fail-closed):** G1 paketinde veya önceki
  Codex çıktılarında K2-05-E'ye karşılık yok (aranıp doğrulandı); sıfırdan
  tasarlandı. Resmî Claude Code hook dokümantasyonu (`code.claude.com/docs/
  en/hooks`) canlı doğrulamayla (sentetik işaretleyici, gerçek sır
  KULLANILMADI) şu üç bulguyu verdi: (1) `PostToolUse` + `updatedToolOutput`
  redaksiyonu hem modelin gördüğünü hem **transkript/kanıt dosyasındaki
  `toolUseResult`'ı** korur (ampirik doğrulandı); (2) komut **girdisine**
  gömülü bir sır (örn. komut metninde literal API anahtarı) redaksiyonla
  korunamaz çünkü komut zaten o haliyle çalışır — tek doğru çözüm
  `PreToolUse` ile **önceden reddetmek**; (3) kullanıcının prompt metnine
  yazdığı ham sır, hook mimarisinin yapısal kapsamı dışıdır (bilerek kabul
  edilen, gizlenmeyen bir sınır). Üç bileşen (E-çıktı redaksiyonu, E-girdi
  reddi, kapsam-dışı sınır) prototip kod olarak yazıldı ve 3 sentetik
  negatif test gerçek `claude -p` oturumlarıyla koşuldu, transkript
  kanıtıyla doğrulandı (modelin kendi raporundan değil): Read-ile-sır,
  Bash-çıktısında-sır, Bash-girdisinde-sır — **3/3 PASS**. Bir şema
  düzeltmesi gerekti: `Read` aracının `tool_response` şekli resmi dokümanda
  yok; ampirik olarak `{type:"text", file:{filePath, content, numLines,
  startLine, totalLines}}` olduğu bulundu. Test, kanonik repo/ürün reposu
  DIŞINDA izole bir dizinde (`C:\Users\crypt\k2-05-e-test\`) yapıldı;
  `C:\Program Files\` altına hiçbir şey kurulmadı. **2026-11-08 bağımsız
  inceleme:** yukarıdaki 3 orijinal senaryo dahil toplam 6 test senaryosunun
  tümü (+ 2 yeni desen Stripe/Slack + 1 ek senaryo, bkz.
  `docs/DECISIONS-REQUIRED.md` "D14 — EK") ham transkript/`permission_denials`
  ile bağımsız doğrulandı (6/6); ancak `test1-read.json`, `test1b-read.json`,
  `test2-bashoutput.json`, `test3-inputsecret.json` için bu belgede kayıtlı
  bir SHA-256 yoktur (manifest/belgeleme eksikliği, test sonucunun kendisi
  değil). Desenlerin TAMAMININ uçtan uca yeniden koşulması yapılmadı; bu
  temsili bir örnekleme, tamamlanmış kabul değildir. **Kalan iş:** prototipin
  G1 paketiyle (K2-05-D) entegrasyonu, gerçek sır deseni kütüphanesinin
  genişletilmesi, canlı kurulum kanıtı, bağımsız insan incelemesi. Kayıt:
  `docs/DECISIONS-REQUIRED.md` D14.
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
- **K2-05-B durum kaydı (D15, RATIFIED 2026-11-07, proje sahibi açık onayı):**
  D12 ile tasarım yönü (çevrimdışı aktarım, Seçenek 1) kesinleşmişti; somut
  mekanizma artık ratifiye edildi — PowerShell Direct (`New-PSSession
  -VMName` + `Copy-Item -FromSession`), guest'e ağ adaptörü bağlanmaması,
  host-başlatmalı iki aşamalı onay (önce görüntüle, sonra kopyala), tek
  sanctioned klasör (`sandbox-out`). Resmî Microsoft Learn dokümantasyonuyla
  doğrulandı; `Copy-VMFile`'ın yalnız host→guest çalıştığı ve bu nedenle
  elenmesi gerektiği de resmî kaynaktan teyit edildi. **Açık kalan:** sandbox
  VM'in şu an var olup olmadığı bu host'tan UNKNOWN (izin hatası, elevation
  gerekiyor); PSDirect audit/log davranışı resmî dokümanda yok; pozitif/negatif
  kabul testleri henüz koşulmadı — ratifikasyon yalnız mekanizma tasarımını
  kapsar, VM kurulumu veya kabul testini değil. **2026-11-07 as-built
  doğrulama:** VM mevcut (`7allab-agent-vm`, Gen2, State=Saved, version
  12.0). Bulunan uyuşmazlık düzeltildi: VM'de `7ALLAB-Internal` (Internal
  tip, fiziksel NIC'siz, internete çıkışsız) switch'e bağlı bir adaptör
  vardı; D15'in "host-başlatmalı, guest hiçbir şey başlatamaz" modeliyle
  tutarsız olduğu için proje sahibinin açık onayıyla
  `Disconnect-VMNetworkAdapter` ile ayrıldı, doğrulandı (`Connected:
  False`). Guest Service Interface devre dışı (zaten reddedilen
  Copy-VMFile'ı etkiler, seçilen PSDirect'i etkilemez). Kayıt:
  `docs/DECISIONS-REQUIRED.md` D15.
- **K2-05-B durum kaydı — DÜZELTME (D15 EK, 2026-11-07, aynı gün devamı):**
  Yukarıdaki PowerShell Direct mekanizması, VM başlatıldığında guest işletim
  sisteminin **Linux (Windows değil)** olduğu saptanmasıyla FAILED/uygulanamaz
  bulundu (PSDirect yalnız Windows guest'lerde çalışır). Yerine **VHDX
  hot-add/hot-remove** mekanizması (`Add-VMHardDiskDrive`/
  `Remove-VMHardDiskDrive`, ağsız, guest kimlik bilgisi gerektirmeyen)
  tasarlandı. Aynı gün içinde orijinal sandbox VM'in önyükleme diski bozuldu
  (RAW/boş, üç bağımsız VSS zaman noktasında doğrulandı, **kök neden UNKNOWN**
  — adli inceleme yakınsadı ama kesinleşmedi); kanıtların yakınsaması ve zaman
  verimliliği gerekçesiyle VM proje sahibinin açık onayıyla ("Önerinle devam
  edelim") sıfırdan yeniden kuruldu (Gen2, Secure Boot şablonu
  `MicrosoftUEFICertificateAuthority`, ağ adaptörü hiç yok, Ubuntu Server
  26.04.1 LTS autoinstall ile). **Pozitif kabul testi TAMAMLANDI VE DOĞRULANDI
  (VERIFIED):** guest'e hot-add edilen 1GB VHDX'e sentetik artefakt yazıldı,
  `sha256sum` hesaplandı (`8cd47a8d37883d856043d8f3a2ac1c3e08c80f21ffa0693a845b4c14c7468566`);
  disk host'tan hot-remove edilip, Windows'un native ext4 desteği olmadığından
  (`Get-Partition`/`Get-Volume` boş döndü — platform sınırlaması, hata değil)
  WSL2 (`wsl --mount ... --vhd --bare`) ile bağımsız okundu; host-taraflı
  hash **birebir eşleşti** — guest'e güvenmeden, iki bağımsız araç zinciriyle
  kriptografik doğrulama. Negatif test (i)/(ii) yapısal olarak sağlanıyor (VM'de
  ağ adaptörü hiç yok). **Açık bulgu:** (iii) operatörün yanlış VHDX takma
  riski hâlâ prosedürel bir zayıflık. **Guest bellek kararlılığı — KÖK NEDEN
  BULUNDU VE DÜZELTİLDİ (2026-11-08, VERIFIED):** VM'in gerçekte
  `DynamicMemoryEnabled: True` ile çalıştığı (sabit 4096MB olması
  gerekirken) `Get-VMMemory` ile host-taraflı doğrulandı; `Set-VMMemory
  -DynamicMemoryEnabled $false -StartupBytes 6442450944` ile sabit 6GB'a
  geçildi; düzeltme hem idle hem de yük altında (VHDX hot-add + `mkfs.ext4`
  + 500MB `dd` yazımı) ayrı ayrı doğrulandı — `dmesg` OOM kaydı yok. Tam
  kayıt: `docs/DECISIONS-REQUIRED.md` "D15 — EK" bölümü, madde 7.
- **Kalan görev:** (1) K2-05-B — mekanizma yeniden tasarlandı, pozitif kabul
  testi ve bellek kararlılığı düzeltmesi VERIFIED (2026-11-07/08, yukarıda);
  (iii) maddesi için teknik guard-rail (`Invoke-K205BTransfer.ps1`) yazıldı ve
  3 senaryoda test edildi, sonuç **PARTIALLY MITIGATED** (mutlak teknik
  zorlama değil) — bkz. `docs/DECISIONS-REQUIRED.md` "D15 — EK" madde 9.
  **2026-11-08 bağımsız inceleme bulgusu:** bu 3 testin ayrı, hash'lenmiş ham
  kanıt dosyası yoktur (yalnız bu belgenin anlatı metni); yeniden koşma
  denemesi Hyper-V yetki hatası (`Get-VM`/`Get-VMHardDiskDrive`) nedeniyle
  başarısız oldu, kök neden araştırılmadı (ayrıntı: `docs/DECISIONS-REQUIRED.md`
  "D15 — EK" madde 10, `docs/K2-BAGIMSIZ-INCELEME-REHBERI.md` Bölüm 1).
  K2-05-B için genel `ACCEPTANCE MET` veya `REVIEW_VERIFIED` yazılamaz; kalan:
  wrapper'ın ham log kanıtı, Hyper-V erişim engelinin çözümü, bağımsız insan
  güvenlik incelemesi; (2) K2-05-C — birincil kanıt dosyası bu hostta
  kapsamlı aramayla bulunamadı (2026-11-08); durum `UNVERIFIED`; yeniden test
  ayrı yetki/iş paketidir (bkz. K2-05-C durum kaydı güncellemesi yukarıda);
  (3) K2-05-A baseline bulgusu 2026-11-07'de UNKNOWN'dan
  somut bulguya çevrildi (iki test edilmemiş kopya aktif). **Mühendislik
  kararı (2026-11-07):** eski kopyalar (project v1.2.4, synced v1.2.3) şimdi
  ayrıca kaldırılmaz; bilinen, kayıtlı bir risk olarak kalır ve 1.2.14 kabul/
  kurulum anında tek seferde değiştirilir — iki ayrı kurulum eylemi yerine tek
  tutarlı eylem. Bu, K2-05-A'yı ACCEPTANCE MET yapmaz; (4) K2-05-D — staged G1
  paketi gerçek cc-agent kimliği altında 8/8 PASS (2026-11-07, yukarıda);
  kalan: gerçek Claude Code hook mekanizması üzerinden canlı kurulum kanıtı
  (K2-05-C sınıfında) ve bağımsız insan güvenlik incelemesi; (5) K2-05-E —
  sıfırdan tasarım (D14, RATIFIED) ve
  prototip kod 3/3 sentetik negatif testte PASS (2026-11-07, yukarıda);
  kalan: G1 paketiyle entegrasyon, gerçek desen
  kütüphanesi, canlı kurulum kanıtı, bağımsız insan incelemesi (tasarım D14
  ile RATIFIED, 2026-11-07); (6) K2-05-F
  bütünleşik rollback, kanıt matrisi ve bağımsız insan kabulü.
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
- **Mevcut durum:** Başlanmadı. D7 uyarınca yalnız APEXO ve LIFEACTA sonraki
  ürün adaylarıdır; kesin geliştirme ve pilot sırası henüz kararlaştırılmadı.
  Bugün hiçbir ürün reposu aktif değildir. KOVAN, eski APEX, APEX-API ve
  7ALLAB Web kapsam dışıdır.
- **Kalan görev:** Ürün başına P6/P7 adımları (ayrı branch/worktree, kesin dosya
  kapsamı, implementer/reviewer ayrımı, diff ve rollback kanıtı) ile test,
  build, inceleme, yayın hazırlığı ve ölçüm.
- **Bağımlılık:** K2 ve K3 tamamlanarak Engineering Office'un kullanıma hazır
  olması; ilgili ürün adapter'ının ratifikasyonu; ürün repo durumu doğrulaması;
  kullanıcı onayı.
- **Kabul kriteri:** Her ürün için kendi kabul ve güvenlik kapısı (P7).
- **Kanıt konumu:** İlgili ürün reposu ve bu repoda pilot kaydı (henüz yok).

## Sonraki en küçük iş paketi

Aktif sıra `docs/ACCELERATED-EXECUTION-PLAN.md` içindeki W0–W5 panosudur.
W0 çevrimdışı hazırlık, W1a campaign driver ve W1b kaynak uygulaması tamamlandı
(200/200 test, 109/109 statik kontrol, 66/66 paket bütünlüğü). İlk iki canlı W1b
koşusu `FAIL_CLOSED` tamamlandı; ikisinde de altı lifecycle fazı, export ve
cleanup kanıtı korundu. Eksik p2 probe giderildi; ikinci koşunun doğruladığı
`Start-Process` exit-code boşluğu owned `.NET ProcessStartInfo` ile düzeltildi;
timeout halinde stream/debug koruması tamamlandı. Yetkili manuel R3 koşusu
`OFFLINE_CONSISTENT_UNATTESTED` tamamlandı: guest exit `0`, timeout yok, export
`10/10`, E01–E10 direct-feed `10/10`, auth provenance hash eşitliği ve
current-user final boşluk doğrulandı. 68 dosyalı hash-only evidence index'in
bağımsız incelemesi tamamlandı: bütünlük 68/68 `PASS_SCOPED`, fakat probe
bağımlılığı, host source/argv binding ve direct-feed ham stream kanıtı açık
kaldığından `REVIEW_PERFORMED=YES`, `REVIEW_VERIFIED=NO`. Üç bulgu kaynakta ve
sentetik testlerde giderildi: exact marker bağımlılığı, host source/executable/
argv binding ve bounded raw direct-feed stream'leri. Sonuç 202/202 regresyon,
109/109 statik, 66/66 paket; güncel manifest SHA-256
`1C59B36EFA212773A2BDBAA1C226505EBFC41F9DAEFA3370F1EF8CC9012D129C`.
Bu R3 kararını geriye dönük yükseltmez. R4 hedefli yeni kanıt planı hazırlandı:
19/19 payload doğrulandı, iki pinned runtime imzası/hash'i eşleşti, export boş
ve report yok. Exact karar paketi
`docs/W1B-R4-AUTHORIZATION-PACKET-2026-11-11.md`. Exact yetki bir kez tüketildi;
R4 exit `0` tamamlandı ve 70/70 evidence üzerinden üç hedefli remediation
bulgusu `REVIEW_VERIFIED=YES` scoped kararı aldı. Kayıtlar:
`docs/W1B-LIVE-RUN-R4-2026-11-11.md` ve
`docs/W1B-R4-INDEPENDENT-REVIEW-2026-11-11.md`. Genel O4 canlı enforcement
yalnız sentetik Write+probe ile sınırlı olduğundan K2-05-C yükselmez. Eski
P1–P6 yeniden koşulmaz. W1b canlı yürütmesi ayrıca açık
kullanıcı yetkisi olmadan başlamaz. Kaynak uygulaması ile canlı yürütme ayrı
kararlardır; kapsam ve durma koşulları `docs/W1B-AUTHORIZATION-PACKET.md`
içinde tanımlıdır. Lifecycle gelecekte oluşan export dizinini kabul eder; export
hiç oluşmazsa cleanup ve host kanıtını koruyarak FAIL_CLOSED raporlar. Bounded
stateful transport, p2 guest-targeted O1/O4/O7 runner ve yalnız bounded plan
dosyası kabul eden host giriş noktası; fixed args/config, owned ID,
timeout/overflow, future guest auth provenance, direct-feed, ham debug/output,
finalization/export ve connect cleanup sınırlarıyla tamamlandı. Manifest
SHA-256: `A5A86F9B6D3F8DBC6C01CC36BC25D49E7EE5FB2230826F1D248E48E864F60941`.
Canlı koşu kayıtları: `docs/W1B-LIVE-RUN-2026-11-11.md`,
`docs/W1B-LIVE-RUN-R2-2026-11-11.md` ve
`docs/W1B-LIVE-RUN-R3-2026-11-11.md`. Bağımsız karar:
`docs/W1B-R3-INDEPENDENT-REVIEW-2026-11-11.md`.

R5 (O4 managed-runtime matrisi) exact yetkiyle bir kez çalıştı ve tüketildi:
exit `0`, `OFFLINE_CONSISTENT_UNATTESTED`, export `26/26`, current-user final
inventory `0`, 90 dosyalık kanıt kökü. Write/Edit/PowerShell managed hook'ta
`ADAPTER_DENY` ile engellendi; Bash `RUNTIME_TOOL_UNAVAILABLE` (Git Bash yok, hook
ölçülmedi); PermissionRequest `DIRECT_FEED_ONLY`. Ayrı dispatched reviewer:
`AGENT_DISPATCHED=YES`, `REVIEW_PERFORMED=YES`, `REVIEW_VERIFIED=NO`,
`REVIEW_VERIFIED_SCOPE=NONE`; yetki belgesi koşu sonrası değiştiği için exact diff
`UNKNOWN`. Kayıtlar: `docs/W1B-LIVE-RUN-R5-2026-11-11.md` ve
`docs/W1B-R5-INDEPENDENT-REVIEW-2026-11-11.md`. Genel O4 `INCONCLUSIVE`; hiçbir
kabul statüsü yükselmez. Sonraki canlı adım (Git Bash'li imajla Bash ölçümü,
pozitif/negatif kontrol, PermissionRequest) yeni plan SHA'sı ve ayrı açık yetki ister.

2026-11-12 W1b R6 (`k205c-w1b-r6-20261112-135044-545ebf89`, Windows Sandbox 0.8.114.0,
Claude Code 2.1.319.0): tek kullanımlık yetkiyle PermissionRequest S1/S2 koşusu tüketildi;
runner çıkış kodu 0 (yalnız konuşma kaydında, TRANSCRIPT-BASED), durum
`OFFLINE_CONSISTENT_UNATTESTED`, kanıt indeksi SHA-256
`C6E03925E5C6333EA22595EC032BA2EE63D913C0B4BD9F0F2223618569F1A4E3` (85 girdi). O4-PR Revizyon 1
dar kapsamda PASS (S1 deny gözlendi, S2 allow uygulandı; `ENFORCEMENT_SCOPE=MOCK_ENDPOINT`).
Bağımsız reviewer READY_WITH_CONDITIONS verdi; `REVIEW_VERIFIED=NO`. Açık: çift PreToolUse
nedeni UNKNOWN, hook'suz kontrol koşusu yok, guard koşulsuz pilot deny verir, S3 ve fail-closed
hata vakaları ile genel O4 negatif kontrolü NOT TESTED, host kanıtları UNATTESTED. R5'in
`DIRECT_FEED_ONLY` gözlemi tarihsel olarak geçerlidir; R6 onu yalnız PermissionRequest için dar
kapsamda günceller. Genel O4 `INCONCLUSIVE`, K2-05-C `UNVERIFIED`, K2 `NOT VERIFIED`, K3/K4
`BLOCKED` değişmedi. Ayrıntı: `docs/W1B-R6-RECORD-2026-11-12.md`.

K2-05-B bağımsız W2 işidir; W1'i durdurmaz fakat W2 kapanmadan K2-05-F kabulü
verilemez. Yasaklı VM/Hyper-V varlıklarına dokunulmaz. Tarihsel ayrıntılar bu
roadmap'in ilgili K2 kayıtlarında ve `docs/K2-BAGIMSIZ-INCELEME-REHBERI.md`
içinde korunur.

## Kilometre taşı ve kapı durumu (2026-11-11)

- **Aktif kilometre taşı:** K2 / K2-05 güvenlik kapılarının bağımsız kabulü.
- **K3:** `BLOCKED` — K2 kapanmadan başlamaz.
- **K4:** `BLOCKED` — K2 ve K3 kapanmadan başlamaz.
- **K2-05-F (bütünleşik kabul):** `NOT ACCEPTED`.
- **K2-05 sınıflandırma özeti (B/C/D/E) — hiçbiri diğerini otomatik ima
  etmez.** `REVIEW_PERFORMED` (insan kanıtı fiilen incelendi mi),
  `REVIEW_VERIFIED` (kabul kriterlerinin BÜTÜNÜ karşılandı mı — karşılanmadıysa
  yazılmaz) ve bulgu sınıflandırması (`CONFIRMED`/`LIKELY`/`UNVERIFIED`/
  `NOT APPLICABLE`/`NOT TESTED`) ayrı tutulur; tam tablo
  `docs/DECISIONS-REQUIRED.md` "Kilometre taşı ve kapı durumu" bölümündedir.
  Özet: **B** — ana mekanizma `REVIEW_PERFORMED=YES`, bulgu `CONFIRMED`;
  wrapper'ın 3 testi `REVIEW_PERFORMED=NO` (kanıtsız), bulgu `UNVERIFIED`;
  ikisinde de `REVIEW_VERIFIED=NO`. **C** — taze P1–P6 ve host sınırı paketleri
  insan tarafından incelendi; `REVIEW_PERFORMED=YES`, `REVIEW_VERIFIED=NO`,
  nihai sınıflandırma `REVIEW_PERFORMED_NOT_VERIFIED`; eski dosya yok,
  O1/O4/O7 açık ve bulgu `UNVERIFIED`. **D** — hash/log/SID/rollback bulguları
  `REVIEW_PERFORMED=YES`, bulgu `CONFIRMED`, ama `REVIEW_VERIFIED=NO`
  (K2-05-F ayrı); cc-agent npm kurulumu `NOT APPLICABLE` (ayrı karar
  bekliyor). **E** — 6 senaryonun davranışı `REVIEW_PERFORMED=YES`, bulgu
  `CONFIRMED`, `REVIEW_VERIFIED=NO`; 4 dosyanın hash/provenansı bulgu
  `UNVERIFIED`; G1 entegrasyonu/kalıcı kurulum `NOT TESTED`.
- **Açık engeller (her kapı ayrı):**
  1. **K2-05-B** — kısmi inceleme: ana mekanizma `CONFIRMED`, guard-rail
     wrapper'ın 3 canlı testi kanıtsız (`UNVERIFIED`); Hyper-V yetki hatası
     nedeniyle yeniden test şu an yapılamıyor.
  2. **K2-05-C** — bağımsız insan incelemesi tamamlandı ancak doğrulanmadı:
     B/F `INCONCLUSIVE`; O1 parse/load kesin değil, O4 Write dışı araçlar,
     E01–E10 ve PermissionRequest açık, O7 auth provenance eksik. Durum
     `UNVERIFIED / REVIEW_PERFORMED_NOT_VERIFIED`.
  3. **K2-05-D** — insan incelemesi yapıldı (`CONFIRMED`); resmî sınıflandırma
     kaydı ve K2-05-F kabulü ayrı konudur. `cc-agent` hesabındaki kalıcı
     npm/Claude Code kurulumu için ayrı karar bekliyor.
  4. **K2-05-E** — altı senaryo incelendi (`CONFIRMED`); `test1`/`test1b`/
     `test2`/`test3` için hash/provenans eksikliği (`UNVERIFIED`) ve G1
     entegrasyonu/kalıcı kurulum kapsamı (`NOT TESTED`) açık.
  5. **K2-05-F:** `NOT ACCEPTED`. **K3 ve K4:** `BLOCKED`.

**K2 NOT VERIFIED; AUTHORITY.implemented=false**.

---
Note (2026-11-13): Native Windows-host interim operating mode recorded as D17 in DECISIONS-REQUIRED.md. The status header above is unchanged: K2 NOT VERIFIED, AUTHORITY.implemented=false, K3/K4 BLOCKED. Header reconciliation is pending.
