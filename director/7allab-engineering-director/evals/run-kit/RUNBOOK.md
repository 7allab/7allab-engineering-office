# Director 1.2.14 — koşu kitabı

**Durum:** hazır; koşu başlatılmadı. Bu kit hiçbir kabul üretmez.
**Dondurma:** commit `31019228`, `SKILL.md` SHA-256 `8a0a346f...` (bkz. `RC-INTEGRITY.md`).
**Sözleşme:** `../test-cases.md` + `K1-02-EVAL-CONTRACT-REPAIR` bölümü.

Kit yalnız A ve B gruplarını kapsar: 13 senaryo, hepsi açık çağrı. C grubu
(N1, N2, N11 — doğal tetikleme) E1 uyarınca ayrı bir temiz yüzey gerektirir ve
koşu sırasında sonuncudur; kartları bilinçli olarak üretilmemiştir.

---

## 0. Mutlak kural — gizlilik

Test edilen oturuma **yalnız** kartın ```text bloğundaki metin verilir.

Asla verilmez: kabul kriterleri, başarısızlık göstergeleri, beklenen davranış,
beklenen rol seçimi, çapraz kesen ölçütler (S1–S6), önceki PASS/FAIL sonuçları,
`test-cases.md`'nin kendisi, bu kitabın bu bölümü ve kart dosyasının prompt
bloğu dışındaki satırları.

Bu kuralın ihlal edildiği koşu kayda `INCONCLUSIVE — bağlam kirlendi` yazılır.

Kriterleri okumuş bir oturum test öznesi olamaz. Hazırlayan/puanlayan taraf ile
test edilen taraf aynı oturum olamaz.

---

## 1. Kurulum

RC paketini şu üç yoldan **birine** kur; dizin adı birebir
`7allab-engineering-director-rc` olmalıdır:

| Kapsam | Konum |
| --- | --- |
| Proje | `<eval-çalışma-alanı>/.claude/skills/7allab-engineering-director-rc/` |
| Kullanıcı | `~/.claude/skills/7allab-engineering-director-rc/` |

Eval çalışma alanı olarak kanonik depoyu kullanma; ayrı, boş bir klasör aç.
Kanonik depodaki `.claude/` ve `.agents/` kopyalarına dokunma — roadmap bunu
yasaklar ve ikisi de 1.2.4'tür, aday değildir.

Hesap-senkron `7allab-engineering-director` (1.2.3) kaldırılmaz, güncellenmez,
devre dışı bırakılmaz. A ve B gruplarında ad farklı olduğu için çarpışma yoktur.

Kurulumdan sonra: skill listede görünüyor mu, ve `RC-INTEGRITY.md`'deki iki
doğrulama adımı geçiyor mu — ikisini de kaydet.

---

## 2. Koşu sırası ve kapılar

```
A grubu →  A1 P1 · A2 P2 · A3 P3 · A4 N3 · A5 N9 · A6 N10 · A7 N13
            ↓  (kapı: A tamamlanmadan B başlamaz)
B grubu →  B1 N4 · B2 N5 · B3 N6 · B4 N7 · B5 N8 · B6 N12
            ↓  (kapı: ayrı yüzey kararı gerekir)
C grubu →  N1 · N2 · N11            ← bu kitte YOK
```

**İki taze PASS gereken senaryolar:** P1, P3, N9, N10. Tek PASS yeterli değildir.

**Durdurma:** ilk kesin FAIL sonraki grubu durdurur. Koşuyu sürdürme; bulguyu
`1.2.15-aday` listesine yaz.

**INCONCLUSIVE:** yalnız bir kontrollü tekrar yapılır. İki koşu çelişirse sonuç
INCONCLUSIVE kalır ve kabulü geçmez. Üçüncü koşu yoktur.

**Kaynağa dokunma:** eval boyunca `director/` altı değişmez. Bulunan her kusur
`1.2.15-aday` listesine gider. Kaynağı değiştirirsen biriken tüm kanıt geçersiz
olur — on bir revizyondur kapanmayan kapının sebebi tam olarak budur.

---

## 3. Oturum yapılandırması

Her senaryo **ayrı ve taze** bir oturumda koşar. Temiz bağlam sağlanamazsa
senaryo NOT TESTED kalır; aynı oturumdaki ikinci bir değerlendirme bağımsız
sonuç sayılmaz.

- Araç listesi **teknik olarak** sınırlandırılır (ör. yalnız `Skill`).
- Plan modu veya eşdeğeri kullanılır. `auto` ve `bypassPermissions` kullanılmaz.
- Sınırın teknik mi yoksa yalnız prompt ile mi uygulandığı kayda yazılır.

**P1 istisnası (E2).** P1 koşularında `governance/` altına **salt-okunur**
erişim verilir — `governance/project-adapters/kovan.md` dahil. Bu klasör
Engineering Office'in kendi deposundadır, ürün reposu değildir; D7 ihlal
edilmez. Yazma, yürütme ve ağ kapalı kalır. Erişim sağlanamazsa P1 kriter 10
UNOBSERVABLE kalır ve PASS sayılmaz.

Diğer senaryolarda Read kapalıdır; gerçek dosya/repo inceleme gerektiren
boyutlar NOT TESTED olarak ayrılır.

---

## 4. Koşu adımları

1. Taze oturum aç, araç sınırını uygula, yapılandırmayı kaydet.
2. RC'yi açıkça çağır. Ek yönlendirme, ipucu, "dikkat et" notu verme.
3. Yüklenen gövdeyi doğrula (`RC-INTEGRITY.md`, iki adım).
4. Kartın ```text bloğunu birebir yapıştır. Tek karakter değiştirme.
5. Yanıtı bekle. Takip sorusu sorma, yönlendirme yapma.
6. `EVIDENCE-TEMPLATE.md`'yi doldur; ham olay akışını olduğu gibi sakla.
7. Oturumu kapat. Sonraki senaryoya geçmeden önce kaydı tamamla.

Puanlama koşudan **sonra**, ayrı bağlamda yapılır.

---

## 5. Sonuç ve kabul

Tanımlar `test-cases.md` "Sonuç tanımları" bölümündedir; burada tekrarlanmaz.

Bu kitin ürettiği şey bir **kanıt paketidir, kabul değildir.**

- Model puanlaması veya ana oturum öz-incelemesi `REVIEW_VERIFIED` değildir.
- Zorunlu senaryoların kanıt paketi ayrı, yetkilendirilmiş **insan** incelemesine
  sunulur.
- Açık blocking bulgu varken Director kabul edilmez.
- A ve B gruplarının tamamlanması C grubu, K2, K3 veya K4 hakkında hiçbir şey
  söylemez. `K2 NOT VERIFIED` ve `AUTHORITY.implemented=false` değişmez.

---

## 6. Bu kit yetki vermez

Kurulum, sistem değişikliği, ürün reposu erişimi, ajan dispatch, Git işlemi,
dağıtım ve managed policy değişikliği bu kitin kapsamı dışındadır ve her biri
ayrı açık yetki gerektirir. Koşu yürütmenin kendisi ayrı test/maliyet iznine
tabidir.
