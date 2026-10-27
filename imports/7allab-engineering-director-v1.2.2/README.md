# 7allab-engineering-director

**Sürüm:** 1.2.2
**Sahip:** 7ALLAB SOFTWARE
**Kullanım:** Yalnızca 7ALLAB SOFTWARE iç kullanımı (internal use only).
**Durum:** PREPARED — v1.2.1 SAVED/ENABLED — EVALS PARTIALLY RUN

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
    └── test-cases.md     # 6 senaryo (çalıştırılmadı)
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

Kurulum **yapılmamıştır** ve bu paket onu kendiliğinden tetiklemez. Kurulum yolu
hedef ortama göre değişir ve üç ortam birbirinden farklıdır:

**1. Claude.ai / Claude Projects — skill yükleme arayüzü**
Paket arayüz üzerinden yüklenir. Dosya sistemine elle kopyalama yoktur. Yüklenen
skill hesap/organizasyon kapsamındadır; yerel bir dizine yazılmaz.

**2. Claude Code — kullanıcı kapsamlı yerel skill**
Klasör kullanıcı skill dizinine kopyalanır (tipik olarak
`~/.claude/skills/7allab-engineering-director/`). O makinedeki tüm projelerde
görünür.

**3. Claude Code — proje kapsamlı yerel skill**
Klasör ilgili deponun içine kopyalanır (tipik olarak
`<repo>/.claude/skills/7allab-engineering-director/`). Yalnızca o depoda
görünür ve depoyla birlikte versiyonlanır.

Her üç yolda da dizin adı birebir `7allab-engineering-director` olmalıdır —
Agent Skills spesifikasyonu `name` alanının üst dizin adıyla eşleşmesini zorunlu
kılar. Yukarıdaki yollar tipik konumlardır; kesin yol ve yöntem kurulum sürümüne
göre değişir, hedef ortamın güncel dokümantasyonundan doğrulayın.

Kurulumdan sonra: oturumu yeniden başlatın, skill'in listelendiğini doğrulayın,
ardından `evals/test-cases.md` içindeki altı senaryoyu **dry-run** olarak
çalıştırın.

Kurulum tek başına doğrulama değildir: listede görünmesi LISTED, çağrılabilir
olması AVAILABLE, çağrılıp çıktısının gözlenmesi TESTED anlamına gelir. Şu anda
skill hiçbir ortamda TESTED değildir.

## Senkronizasyon sınırı

Bir ortama kurulum diğerlerini etkilemez. Claude.ai'ye yüklenen skill Claude
Code'da görünmez; kullanıcı kapsamlı yerel skill proje kapsamlı kuruluma
dönüşmez; ChatGPT ve Codex bu paketi hiç çalıştırmaz. Üç ortamda aynı sürümü
istiyorsanız üçüne ayrı ayrı kurmanız ve sürümü ayrı ayrı takip etmeniz gerekir.
Otomatik senkronizasyon yoktur.

## Geri alma (rollback)

**Claude.ai / Projects:** skill'i yükleme arayüzünden kaldırın.

**Claude Code (kullanıcı veya proje kapsamı):** `7allab-engineering-director/`
klasörünü ilgili skill dizininden kaldırın ve oturumu yeniden başlatın.

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

## Bilinen sınırlar

- **v1.2.1 üzerinde kısmi dry-run yapıldı.** P1 açık çağrı davranışı PASS, P1
  doğal davranış PASS fakat skill'e atıf INCONCLUSIVE, N1 yönlendirme PASS,
  N3 FAIL. v1.2.2 için N3 yeniden çalıştırılmadan regresyon kapanmış sayılmaz;
  P2, P3 ve N2 NOT TESTED durumundadır.
- Yetki kapsamı değerlendirmesi modelin niyet okumasına dayanır; "devam et"
  gibi belirsiz ifadelerde yanlış pozitif riski açıktır.
- Diğer skill'lerin kurulu olup olmadığı **UNKNOWN**'dır; SKILL.md'deki
  yönlendirme tablosu önerilen yoldur, doğrulanmış yetenek değildir.
- Proje dokümanlarının Claude Code, ChatGPT ve Codex ortamlarında erişilebilir
  olduğu doğrulanmadı.
- Kurulum yolları tipik konumlardır; hedef ortamda doğrulanmadı.
