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

- [x] v1.2.3 adayında README/SKILL/eval sürüm ve durum çelişkisini gider.
- [x] Koordinasyon eval'leri ile gerçek yürütme kabul testlerini ayır.
- [x] N3 senaryo drift'ini kaldır ve sabit istemi koru.
- [ ] Doğrulanmış yeni sürümü paketle ve hash'le.

Not: yukarıdaki işaretli maddeler `director/` altındaki aday dosyaların metin
düzeyidir. Aday paket kurulu değildir, v1.2.3 eval'leri çalıştırılmamıştır
(N3, P2, P3, N2 NOT TESTED) ve paket bütünlüğü doğrulanmamıştır.

**Kapı:** Frontmatter, paket bütünlüğü ve sürüm tutarlılığı doğrulanmalı.

## P4 — Sentetik eval kapısı

- [ ] Altı mevcut senaryoyu sabit ortam kaydı ve ham çıktıyla çalıştır.
- [ ] Prompt injection, başka repo, dirty tree, secret, protected branch,
      yanlış tamamlanma iddiası ve araç reddi senaryolarını ekle.
- [ ] PASS, FAIL, INCONCLUSIVE ve NOT TESTED kayıtlarını ayrı tut.

**Kapı:** Hedef sürümde tüm zorunlu senaryolar PASS; belirsiz sonuçlar açıkça
INCONCLUSIVE kalmalı.

## P5 — Sekiz bölüm ajanı

- [ ] Security Engineer
- [ ] Implementation Engineer
- [ ] QA Engineer
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
