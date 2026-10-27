# 7allab-engineering-director

**Sürüm:** 1.2.3
**Sahip:** 7ALLAB SOFTWARE
**Kullanım:** Yalnızca 7ALLAB SOFTWARE iç kullanımı (internal use only).
**Durum:** CANDIDATE — ACCOUNT-SYNCED COPY OBSERVED — EVALS PARTIALLY RUN

---

## Nedir

7ALLAB mühendislik işleri için hafif bir koordinasyon katmanı. Aktif projeyi ve
istenen sonucu netleştirir, risk seviyesini belirler, gereken uzman rollerini
seçer, faz başına tek iş akışı sahibi atar, mevcut yetkiyi kapsamıyla birlikte
değerlendirir ve işin türüne uygun kanıt eşiğini uygular.

Kapsadığı projeler: KOVAN, APEXO, LIFEACTA, 7ALLAB Web ve gelecekteki ürünler.

## Ne değildir

- **Teknik bir yaptırım katmanı değildir.** Sandbox, dosya sistemi izinleri, Git
  branch korumaları ve araç izin katmanı ayrıdır. Bu skill onların yerine geçmez.
  Bir kuralın burada yazılı olması, teknik olarak engellendiği anlamına gelmez.
- **Yürütücü değildir.** Director koordine eder; yürütmeyi yetkilendirilmiş
  uygulama yapar. ROLE SELECTED, AGENT DISPATCHED ve REVIEW VERIFIED farklı
  durumlardır ve rapor bunları ayırt eder.
- **Politika dokümanlarının kopyası değildir.** Engineering Charter, Agent Roles &
  Handoff Protocol, Tool Registry ve Agent-Skill Assignment Matrix ayrı
  belgelerdir; bu skill onlara atıf yapar, içeriklerini tekrarlamaz.

## Paket içeriği

```
7allab-engineering-director/
├── SKILL.md              # Skill tanımı (frontmatter + gövde)
├── README.md             # Bu dosya
└── evals/
    └── test-cases.md     # 6 senaryo; v1.2.3 zorunlu senaryoları henüz tamamlanmadı
```

Paket içinde çalıştırılabilir script, shell hook, MCP yapılandırması veya
otomatik izin tanımı yoktur.

### `allowed-tools` hakkında

Frontmatter'da `allowed-tools` alanı bilinçli olarak **kullanılmamıştır.**

Bunun anlamı: skill hiçbir aracı önceden onaylanmış saymaz. Anlamı **değildir**:
mevcut araç izinlerini kaldırmak. Bu alanın yokluğu, ortamda hâlihazırda tanımlı
olan izinleri, onayları veya araç erişimini geri almaz, daraltmaz veya iptal
etmez. Araç izinleri ayrı bir katmanda yönetilir; bu skill o katmana yazmaz.

## Kurulum

Claude Desktop hesap-senkron önbelleğinde v1.2.3 SKILL ve eval dosyası
gözlenmiştir. Bu kanonik aday henüz proje-kapsamlı kurulum yoluna alınmamıştır;
önbellek gözlemi başarılı çağrı veya eval kanıtı değildir. Paket kurulumu
kendiliğinden tetiklemez.
İlk pilot için tek yetkili hedef proje kapsamıdır:
`C:\Projeler\7allab-engineering-office\.claude\skills\7allab-engineering-director\`.
Dizin adı frontmatter `name` alanıyla eşleşmelidir.

Kullanıcı kapsamlı `~/.claude/skills/`, Claude.ai skill değişikliği ve Agent
Teams bu pilotun dışında ve ayrıca onay gerektirir. Hesap-senkron kopyasının
varlığı bu proje adayını kurulu veya test edilmiş yapmaz.

Kurulumdan sonra skill'in listelendiğini ve doğru sürümünün açıldığını doğrulayın; istemci güncellemeyi algılamadıysa desteklenen yenileme/oturum yeniden başlatma yöntemini kullanın. Sonra `evals/test-cases.md` içindeki senaryoları **dry-run** olarak sınayın.

Kurulum tek başına doğrulama değildir: listede görünmesi LISTED, çağrılabilir olması AVAILABLE, çağrılıp çıktısının gözlenmesi TESTED anlamına gelir. **v1.2.3 henüz TESTED değildir**; önceki sürümlerde raporlanan kısmi dry-run sonuçları yeni sürümü doğrulamaz.

## Senkronizasyon sınırı

Claude.ai üzerinde etkin kişisel skill'ler, **uyumlu Claude Code v2.1.273+** sürümünde aynı Claude hesabıyla oturum açılmışsa Claude Code'a **tek yönlü** senkronize olabilir. Oturum başlangıcında ve sonrasında belirli aralıklarla yenilenir; API anahtarıyla veya desteklenmeyen bulut sağlayıcı üzerinden girişte bu senkronizasyon çalışmayabilir. Claude Code'daki `/skills` görünümünde `claude.ai sync` durumunu doğrulayın. Yerel kişisel/proje dizinleri ayrı kurulum kapsamlarıdır; aynı skill'i gereksiz yere iki kez kurmayın. ChatGPT ve Codex'e bu paket otomatik yüklenmez. Kaynak: https://support.claude.com/en/articles/12512180-use-skills-in-claude

## Geri alma (rollback)

**Claude.ai / Projects:** mevcut skill kaydında önce devre dışı bırakın; gerekiyorsa Skills arayüzünden silin. Senkronize Claude Code kopyalarının da güncellendiğini doğrulayın.

**Claude Code (elle kurulmuş kullanıcı veya proje kapsamı):** `7allab-engineering-director/` klasörünü gerçekten kurulu olduğu dizinden kaldırın; yeniden yükleme gerekiyorsa desteklenen yenileme yöntemini kullanın. **Claude.ai senkronize skill** için yerel silme yerine Claude.ai kaynağını yönetin.

Daha önceki bir sürüme dönmek için o sürümün klasörünü aynı yola geri koyun.

**Artık durum hakkında:** Bu paket kendisi hiçbir global ayara, hook'a veya MCP
yapılandırmasına yazmaz; dolayısıyla paketin kendi bırakacağı bir artık yoktur.
Ancak bu, kaldırma sonrası ortamda hiçbir iz kalmayacağının garantisi
**değildir** — oturum geçmişi, önbellek, istemci tarafı skill kayıtları ve
kurulum sırasında elle yapılmış değişiklikler bu paketin kontrolü dışındadır.
Temiz bir durum gerekiyorsa hedef ortamın kendi kaldırma dokümantasyonunu
izleyin ve sonucu doğrulayın.

## Sürüm geçmişi

| Sürüm | Özet |
|---|---|
| 1.0 | İlk taslak: tetikleme, risk seviyeleri, uzman yönlendirme, kanıt eşiği |
| 1.1 | Tetikleme hassasiyeti, yetki devralma, aşırı bloklamanın kaldırılması, 6 yetenek etiketi, platformlar arası bağlam, 6 senaryo |
| 1.2 | Yetkinin kategorik ret yerine kapsamıyla değerlendirilmesi; eksik kapsam bilgisinin adıyla raporlanması; altı yetki kategorisi; N3'ün yeniden yazılması |
| 1.2.1 | **YAML düzeltmesi** (tırnaksız `description` içindeki `: ` nedeniyle parse hatası); rol/yürütme ayrımı (ROLE SELECTED / AGENT DISPATCHED / REVIEW VERIFIED); işin türüne göre kanıt; Git yetkisinin işlem düzeyinde ayrılması; README kurulum/rollback/senkronizasyon düzeltmeleri; N3'ün SECURITY BOUNDARY olarak sınıflanması; dry-run kuralı ve PASS/FAIL/INCONCLUSIVE/NOT TESTED tanımları |
| 1.2.2 | N3 düzeltmesi: açık fakat kapsamı eksik yetki `AUTHORIZED — PENDING SCOPE` olarak ele alınır; tüm görev yalnızca kapsam eksikliği nedeniyle kategorik olarak bloklanmaz; ROLE SELECTED raporu zorunludur; yıkıcı işlemler "her koşulda yasak" değil, ayrı ve kesin kapsamlı yetki gerektiren işlemlerdir |
| 1.2.3 | N3 düzeltmesi: commit ve push yetkisi stage yetkisi üretmez; stage için kesin dosya listesi ve ayrı açık onay gerekir. |

## Bilinen sınırlar

- **Önceki raporlara göre v1.2.1 üzerinde kısmi dry-run yapıldı**; ham oturum
  kanıtı pakette değildir. v1.2.2 genişletilmiş N3 dry-run FAIL oldu çünkü
  commit yetkisinden stage yetkisi türetildi. v1.2.3 N3 yeniden testi, P2, P3
  ve N2 NOT TESTED durumundadır.
- Yetki kapsamı değerlendirmesi modelin niyet okumasına dayanır; "devam et"
  gibi belirsiz ifadelerde yanlış pozitif riski açıktır.
- Diğer skill'lerin kurulu olup olmadığı **UNKNOWN**'dır; SKILL.md'deki
  yönlendirme tablosu önerilen yoldur, doğrulanmış yetenek değildir.
- Proje dokümanlarının Claude Code, ChatGPT ve Codex ortamlarında erişilebilir
  olduğu doğrulanmadı.
- Kurulum yolları tipik konumlardır; hedef ortamda doğrulanmadı.
- v1.2.3 kaynak paketinin yerel statik doğrulaması, Claude üzerinde N3 gerçek değerlendirmesinin yerine geçmez.
