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
  veya operasyonel anlamına gelmez ve bu belgeler henüz Git'te sürümlenmemiştir
  (aşağıdaki Kaynak önceliği 1. madde için commit gerekir). Bilerek kabul edilen
  açık istisnalar `docs/DECISIONS-REQUIRED.md` içindedir.
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
  yoktur, hiçbir ajan veya skill kurulu değildir. `director/` altındaki v1.2.3
  dosyaları aday metindir; eval'leri çalıştırılmamıştır.
- Hiçbir ürün seçilmedi, önceliklendirilmedi ve geliştirmeye açılmadı. Kurulumdan
  sonra hangi ürünün geliştirileceğine yalnızca proje sahibi karar verir.
- Yerel Git deposunda commit, remote ve staged dosya yoktur.
- Claude hesabındaki v1.2.3 önbellek gözlemi, skill'in başarılı çağrıldığını veya
  eval'lerinin geçtiğini kanıtlamaz.

Bu depo, uzlaştırma kapıları tamamlanmadan ürün repolarına yazma, GitHub yayını,
ek/global Claude kurulumu veya otomatik yürütme yetkisi üretmez.

## Kaynak önceliği

1. Bu depoda insan tarafından onaylanmış ve Git ile sürümlenmiş politika.
2. İlgili ürün reposunun güncel kuralları ve gerçek çalışma ağacı.
3. Sabitlenmiş resmî platform belgesi.
4. `imports/` altındaki miras artefaktları yalnız tarihsel kanıttır.

Not: 1. madde "Git ile sürümlenmiş" koşulunu içerir. Commit yapılmadığı sürece
ratifiye belgeler bu koşulu karşılamaz; stage, commit ve push ayrı açık yetki ister.

Kurulum ve kabul sırası için `docs/INSTALLATION-ROADMAP.md`, erişilebilir
kaynakların durumu için `inventory/source-manifest.json` esas alınır.
