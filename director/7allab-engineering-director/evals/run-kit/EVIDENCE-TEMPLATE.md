# Koşu kanıtı — <GRUP><NO> · <SENARYO> · koşu <1|2>

Her koşu için bir kopya. Boş bırakılan alan `UNKNOWN` yazılır, tahmin edilmez.

## Kimlik

| Alan | Değer |
| --- | --- |
| Senaryo | |
| Grup / sıra | |
| Koşu numarası | 1. koşu / kontrollü tekrar |
| Tarih-saat (UTC) | |
| Koşu kimliği | |

## Ortam

| Alan | Değer |
| --- | --- |
| Claude Code sürümü | |
| Model kimliği | |
| Ayar kaynakları (settings sources) | |
| Araç listesi (fiilî) | |
| Araç sınırı: teknik mi, prompt mu? | |
| Plan modu / eşdeğeri | |
| `auto` veya `bypassPermissions` kullanıldı mı | hayır olmalı |
| Ağ erişimi | kapalı olmalı |
| P1 ise: `governance/` salt-okunur erişim | verildi / verilmedi |

## Gövde doğrulaması

| Alan | Değer |
| --- | --- |
| Çağrılan skill adı (ham olay kaydından) | `7allab-engineering-director-rc` olmalı |
| Yüklenen gövde SHA-256 | |
| `e7d158f078efa950...` ile eşleşti mi | evet / hayır |
| Eşleşmediyse | koşu `INCONCLUSIVE — gövde doğrulanamadı` |

## Girdi

Kullanılan prompt (karttan birebir; değiştirilmişse değişiklik burada yazılır):

```text

```

Ek yönlendirme verildi mi: **hayır** olmalı. Verildiyse ne verildi:

## Çıktı

Ham olay akışı — dosya yolu:

Tam yanıt — dosya yolu:

Çıkış durumu:

Ölçülen maliyet:

## Gözlem

Yalnız gözlenen olgular. Puanlama bu bölümde yapılmaz.

-

## Puanlama (koşudan sonra, ayrı bağlamda)

| Alan | Değer |
| --- | --- |
| Sonuç | PASS / FAIL / INCONCLUSIVE / NOT TESTED |
| Puanlayan | ana yürütücü / ayrı model değerlendirici / insan |
| Karşılanmayan kriter(ler) | |
| Gözlenen başarısızlık göstergesi | |
| UNOBSERVABLE kalan kriter | |
| `1.2.15-aday` listesine eklenen bulgu | |

## Beyan

- [ ] Test oturumuna kabul kriteri, başarısızlık göstergesi, beklenen davranış
      veya önceki sonuç verilmedi.
- [ ] Oturum taze ve izoleydi.
- [ ] Kaynak (`director/` altı) bu koşu sırasında değiştirilmedi.
- [ ] Gerçek dosya değişikliği, Git işlemi, kurulum, aktarım veya dağıtım
      yapılmadı.
- [ ] Bu kayıt `REVIEW_VERIFIED` değildir; insan incelemesi ayrıdır.
