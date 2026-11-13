# 7ALLAB SOFTWARE AI Engineering Office

Bu depo, 7ALLAB ürünlerinden bağımsız mühendislik yönetişimi ve Claude Code
yürütme mimarisi için kanonik kaynak olmayı hedefler.

## Mevcut durum

**BOOTSTRAP — NOT OPERATIONAL**

- Erişilebilir Engineering Director v1.2.2 paketi `imports/` altında
  değiştirilmeden korunur.
- Claude Desktop hesap-senkron önbelleğinde v1.2.3 SKILL ve eval dosyası
  gözlendi; aynı paketteki README hâlâ v1.2.2 olduğu için paket tutarsızdır.
- Dört yönetişim belgesi ve Core Operating Instructions özgün yapıştırılmış
  metin kaynaklarından `imports/governance-proposed-v1/` altına alındı.
- `governance/` altındaki beş belge (Charter, Protocol, Core, Registry, Matrix)
  proje sahibinin D4 kararıyla (2026-10-27) `Ratified` (sürüm `1.1.1`) yapıldı ve
  bağlayıcı Engineering Office politika temelidir. Ratified; kurulu, zorlanan
  veya operasyonel anlamına gelmez. Bu beş belge Git'te commit edilmiştir
  (`git ls-files governance/` ile doğrulanabilir) ve bu nedenle aşağıdaki Kaynak
  önceliği 1. maddesindeki "Git ile sürümlenmiş" koşulunu karşılar; buna karşın
  devam eden karar kayıtları (`docs/DECISIONS-REQUIRED.md`,
  `docs/INSTALLATION-ROADMAP.md`) şu an çalışma ağacında değişiklik hâlindedir
  (modified) ve henüz commit edilmemiştir. Bilerek kabul edilen açık istisnalar
  `docs/DECISIONS-REQUIRED.md` içindedir.
- `governance/project-adapters/` altında KOVAN, APEXO, LIFEACTA ve 7ALLAB Web
  adaptörleri `Draft — Ratification Pending` olarak kalır (KOVAN 0.2-draft;
  APEXO, LIFEACTA ve 7ALLAB Web 0.3-draft). Proje sahibi D5 kararıyla bunları
  yalnızca kontrollü güvenlik referansı olarak kabul etti; ratifiye değildir ve
  uygulanmış kontrol değildirler. `[GOV]` kurallar üst governance'a tabidir,
  `[DERIVED]` öneriler henüz bağlayıcı ürün politikası değildir, `[UNVERIFIED]`
  bilgiler doğrulanmış sayılamaz.
- Bağımsız inceleme geçmişi: M1–M7 ve F1/F2/F3/F5 bulguları düzeltildi. Son
  regresyon incelemesinde LIFEACTA için R9 FAIL (Medium) kaydedildi; bu kayıt
  korunur. `P2-LIFEACTA-R9` ile giderildi ve hedefli incelemede (K1–K8) PASS.
  İncelemelerin tamamı Explore model çıktısıdır, insan incelemesi değildir.
- Engineering Director ve sekiz uzman ajan henüz operasyonel değildir: `.claude/`
  yoktur, hiçbir ajan veya skill kurulu değildir. `director/` altındaki aday
  (şu an v1.2.14) için eval paketi koşulmuştur: zorunlu koordinasyon kümesi
  P1–P3 ve N3–N13 (toplam 13 senaryo), 17 koşu, **17/17 PASS**. N1, N2 ve N11
  bu zorunlu kümede değildir — ayrı ve kabul kriterleri henüz tanımlanmamış
  "tetikleme disiplini" kapısındadır (D11). **D10 ve D11 ratifiye edilmiştir**
  (2026-11-07) — bu bir kanıt paketidir; bağımsız insan kabulü veya
  operasyonel kurulum değildir.
- Hiçbir ürün geliştirmeye açılmadı. Engineering Office tamamlandıktan sonraki
  tek ürün adayları APEXO ve LIFEACTA'dır; sıraları henüz seçilmemiştir. KOVAN,
  APEX-API ve 7ALLAB Web bu geliştirme kapsamının dışındadır. Bu kapsam kararı
  hiçbir ürün reposuna erişim veya yazma yetkisi vermez.
- Yerel Git deposunda commit vardır (branch `main`, HEAD `b650e36c...`); remote
  tanımlı değildir; şu an staged dosya yoktur (çalışma ağacında modified/untracked
  değişiklikler bulunur — ayrıntı için `git status`).
- **Aktif kilometre taşı:** K2 / K2-05 güvenlik kapılarının bağımsız kabulü
  (ayrıntı: `docs/INSTALLATION-ROADMAP.md`, `docs/DECISIONS-REQUIRED.md`).
  K2-05-F **NOT ACCEPTED**; K3 ve K4 **BLOCKED**. Ortak açık engel: bağımsız
  insan güvenlik incelemesinin eksik kalemleri (bkz.
  `docs/K2-BAGIMSIZ-INCELEME-REHBERI.md`).
- Claude hesabındaki v1.2.3 önbellek gözlemi, skill'in başarılı çağrıldığını veya
  eval'lerinin geçtiğini kanıtlamaz.

Bu depo, uzlaştırma kapıları tamamlanmadan ürün repolarına yazma, GitHub yayını,
ek/global Claude kurulumu veya otomatik yürütme yetkisi üretmez.

## Kaynak önceliği

1. Bu depoda insan tarafından onaylanmış ve Git ile sürümlenmiş politika.
2. İlgili ürün reposunun güncel kuralları ve gerçek çalışma ağacı.
3. Sabitlenmiş resmî platform belgesi.
4. `imports/` altındaki miras artefaktları yalnız tarihsel kanıttır.

Not: 1. madde "Git ile sürümlenmiş" koşulunu içerir. `governance/` belgeleri
commit edilmiştir ve bu koşulu karşılar; devam eden karar kayıtları (örn.
`docs/DECISIONS-REQUIRED.md`, `docs/INSTALLATION-ROADMAP.md`) henüz commit
edilmemiş olabilir ve bu durumda koşulu karşılamaz. Her hâlde stage, commit ve
push ayrı açık yetki ister.

Kurulum ve kabul sırası için `docs/INSTALLATION-ROADMAP.md`, erişilebilir
kaynakların durumu için `inventory/source-manifest.json` esas alınır.
