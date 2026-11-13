# Engineering Office — Hızlandırılmış Yürütme Planı

Durum: **ACTIVE PLAN — K2 NOT VERIFIED**  
Tarih: 2026-11-11

Bu belge günlük yürütmenin tek kontrol panosudur. Tarihsel kanıt ve kararlar
`INSTALLATION-ROADMAP.md` ile `DECISIONS-REQUIRED.md` içinde korunur; burada
tekrar anlatılmaz. Bu plan hiçbir kurulum, Sandbox/Hyper-V işlemi, Git işlemi,
ürün reposu erişimi veya kabul yetkisi vermez.

## 1. Hedef ve başarı ölçüsü

Kritik hedef, yeni özellik eklemek değil, K2-05-B/C/D/E kanıtlarını en az sayıda
kontrollü kampanyayla tamamlayıp K2-05-F kararına hazır tek bir inceleme paketi
üretmektir.

Başarı ölçüleri:

- plan dışı dosya değişikliği: `0`;
- aynı değişmemiş kanıtın yeniden üretilmesi: `0`;
- her canlı kampanya için bir preflight, bir cleanup ve bir hash'li indeks;
- FAIL/INCONCLUSIVE sonuçlarının yeniden adlandırılması: `0`;
- K2-05-F öncesinde B/C/D/E için ayrı, açık verdict;
- yüksek riskli kabul için uygulayıcıdan bağımsız `REVIEW_VERIFIED`.

## 2. Kritik yoldan çıkarılan işler

Aşağıdakiler kapı değildir ve aktif işi geciktirmeyecektir:

- Değişmez P1–P6 tarihsel koşularını yeniden çalıştırmak.
- R0 ve kabul edilmiş P4 koordinasyon kampanyasını her oturumda yeniden
  doğrulamak; yalnız ilgili kaynak hash'i değişirse yeniden açılır.
- Ruflo değerlendirmesi, C grubu tetikleme disiplini ve ürün adaptörü
  ratifikasyonunu K2'nin ön koşulu yapmak. Bunlar ayrı backlog'dur.
- K2-05-B harici engelini beklerken K2-05-C/D/E çevrimdışı hazırlığını veya
  yetkilendirilmiş hedefli testini durdurmak.
- Aynı kampanyadaki host, guest, auth, cleanup ve export kanıtları için ayrı
  paketler ve ayrı review turları üretmek.
- K3'te sekiz rolü sekiz ayrı kurulum projesi gibi yürütmek; tek manifest ve
  parametreli permission-negative test matrisi kullanılacaktır.

## 3. Kaldırılamayacak kapılar

- Sistem değişikliği ve canlı test için önceden açık, kapsamlı kullanıcı yetkisi.
- Kaynak/binary kimliği, SHA-256, ham kanıt, provenance, timeout ve cleanup.
- Gerçek sır kullanmama ve authority alanlarını varsayılan `false` tutma.
- K2-05-B/C/D/E'nin ayrı verdict'leri ve K2-05-F bütünleşik kabulü.
- HIGH risk için uygulayıcıdan bağımsız inceleme.
- K2 kapanmadan K3; K2 ve K3 kapanmadan K4 başlatmama.

## 4. Tek kritik yol

| Paket | Kapsam | Girdi | Çıkış / bitiş ölçütü | Durum |
|---|---|---|---|---|
| W0 | Çevrimdışı güvenlik zinciri | R2-A/B/C1 | R2-C2 adapter, R2-D auth provenance, result binding, host/guest correlation; 157/157 test, 109/109 statik, 54/54 manifest | `DONE_OFFLINE` |
| W1 | K2-C/D/E hedefli kampanya | Mevcut çevrimdışı modüller + sabit çalışma planı + canlı aşama için ayrı açık yetki | R4 exit `0`; 70/70 evidence ve üç R3 remediation bulgusu bağımsız scoped review ile doğrulandı. Genel O4 yalnız Write canlı, diğer araçlar direct-feed | `R4_TARGETED_REMEDIATION_REVIEW_VERIFIED` |
| W2 | K2-B kapanış | Mevcut doğrulanmış mekanizma + yalnız eksik guard-rail ölçütleri | Eksik üç canlı test veya yetkili reviewer'ın mevcut kanıtla verdiği açık verdict | `EXTERNAL_BLOCKER` |
| W3 | Bağımsız inceleme ve K2-05-F | W1 ve W2 değişmez paketleri | B/C/D/E ayrı verdict, açık bulgu yoksa `REVIEW_VERIFIED`; ardından F kabul/ret kararı | `BLOCKED_BY_W1_W2` |
| W4 | K3 uzman entegrasyonu | K2 kapanmış olmalı | Sekiz rol için tek manifest, en az yetki, parametrik negatif izin testleri ve bağımsız review | `BLOCKED_BY_K2` |
| W5 | K4 ürün pilotu | K2+K3 ve ürün kararı | Yalnız seçilen ürün için küçük, geri alınabilir pilot ve ürün kabul paketi | `BLOCKED_BY_K2_K3` |

W1 ve W2 birbirinden bağımsız yürütülür. W2 beklerken W1 durmaz; ancak ikisi
tamamlanmadan W3, K2-05-F'yi kabul edilmiş sayamaz.

## 5. W1 tek-kampanya sözleşmesi

W1 yeni bir kabul kapısı eklemeden iki yürütme adımına ayrılır:

- **W1a — offline assembly:** Mevcut `wsb-read-only-adapter`, host lifecycle,
  guest auth provenance, guest result finalizer, export verifier ve offline
  correlator tek, sabit planlı campaign driver'a bağlanır. Gerçek process veya
  Sandbox kullanılmadan injected/synthetic failure ve cleanup testleri geçer.
- **W1b — authorized live run:** W1a hash'i sabitlendikten sonra aşağıdaki tek
  kampanya ayrıca açık kullanıcı yetkisiyle çalıştırılır.

Birden çok parçalı oturum yerine bir yetkilendirme paketi hazırlanır. Paket;
tam komut/araç allowlist'ini, hedef yolları, beklenen dosyaları, süre ve boyut
limitlerini, gerçek sır kullanılmayacağını, rollback'i ve durma koşullarını
önceden gösterir. Onay kapsamı dışına çıkılırsa kampanya durur.

Kampanya sırası:

1. Hash ve kimlik preflight; beklenmeyen drift varsa hiçbir state change yok.
2. Başlangıç envanteri ve temiz-baseline kontrolü.
3. Tek guest yaşam döngüsünde yalnız eksik O1/O4/O7 ve D/E korelasyonları.
4. Ham stdout/stderr, auth provenance ve export'un atomik/hash'li alınması.
5. Koşul başarısından bağımsız cleanup ve son bağımsız envanter.
6. Tek `EVIDENCE-INDEX.json` ve makinece doğrulanabilir özet.

Eski P1–P6 sonuçları değiştirilmez ve tekrar koşulmaz. Yeni kampanya yalnız açık
boşlukları ölçer; geçmiş sonucu geriye dönük yükseltmez.

## 6. Kanıt ve review optimizasyonu

- Her artefakt içerik hash'iyle adreslenir; hash değişmemişse yeniden incelenmez.
- Reviewer'a konsol dökümü değil, ölçüt→kanıt→hash eşlemeli tek indeks verilir.
- Uygulayıcı raporu yalnız teknik sonuçtur; review verdict'i ayrı dosyadır.
- Bir başarısızlıkta bütün kampanya tekrarlanmaz. Yalnız arızanın etkilediği ve
  bağımsızlığı bozulmayan hedefli ölçüt yeniden çalıştırılır; ilk kayıt korunur.
- Offline regresyon yalnız kaynak değiştiğinde; canlı regresyon yalnız ilgili
  kabul ölçütü veya sabitlenmiş runtime kimliği değiştiğinde yeniden çalışır.

## 7. Değişiklik yönetimi

Her iş paketi şu sırayı izler:

1. Kapsam ve beklenen drift whitelist'i.
2. En küçük kod/doküman değişikliği.
3. Hedef testler.
4. Tam regresyon ve statik kontrol.
5. Manifesti yalnız beklenen drift doğrulandıktan sonra güncelleme.
6. Tek sonuç raporu: değişen dosyalar, gerçek log, hash, açık risk ve sonraki kapı.

Commit, push, dependency kurulumu, host ayarı veya ürün repo değişikliği bu
akışın doğal uzantısı sayılmaz; her biri kendi açık yetkisini gerektirir.

## 8. Güncel yönetim kararı

W1a tamamlandı: bounded inventory evidence mevcut lifecycle'a bağlandı;
injected/synthetic testler ve ayrıntılı yetkilendirme paketi
`docs/W1B-AUTHORIZATION-PACKET.md` olarak hazırlandı.
`W1B-SOURCE-IMPLEMENTATION` tamamlandı:
gelecekte oluşturulacak export dizini destekleniyor; export hiç oluşmazsa
cleanup ve host kanıtı korunarak FAIL_CLOSED üretiliyor. Bounded stateful
transport da tamamlandı: fixed args/config, owned ID, timeout/overflow ve
connection cleanup doğrulandı. p2 guest runner; bağımsız auth provenance,
E01–E10 direct-feed, ham debug/output, result finalization ve export sırasını
fail-closed olarak bağladı. Gelecekte üretilecek guest provenance yolu ile
lifecycle arasındaki zamanlama çelişkisi giderildi; bounded live runner yalnız
tek mutlak plan dosyası kabul edecek şekilde zinciri kapattı. Tam sonuç:
İki canlı koşu `GUEST_RUN_FAILED_CLOSED` verdi; ikisinde de altı lifecycle fazı,
export ve cleanup tamamlandı, final current-user envanteri boştu. İlk koşunun
eksik p2 probe'u giderildi; ikinci koşu `Start-Process` exit-code boşluğunun
`Refresh()` ile kapanmadığını gösterdi. Runner owned `.NET ProcessStartInfo`
akışına geçirildi. Ayrıntılar `docs/W1B-LIVE-RUN-2026-11-11.md` ve
`docs/W1B-LIVE-RUN-R2-2026-11-11.md`. Düzeltme sonrası sonuç:
Timeout halinde kısmi stdout/stderr ve debug export'tan önce korunacak şekilde
son failure-path boşluğu kapatıldı. Manuel R3 akışı
`docs/W1B-R3-MANUAL-RUNBOOK.md` içinde tanımlıdır. Sonuç: 200/200 regresyon,
109/109 statik, 66/66 paket; manifest SHA-256
`A5A86F9B6D3F8DBC6C01CC36BC25D49E7EE5FB2230826F1D248E48E864F60941`.
Üçüncü koşu `OFFLINE_CONSISTENT_UNATTESTED` tamamlandı: guest exit `0`, timeout
yok, host manifest `10/10`, direct-feed E01–E10 `10/10`, provenance hash'leri
eşit ve current-user final envanteri boş. Hash-only 68 dosyalı evidence index
bağımsız review'a hazırdır; ayrıntılar
`docs/W1B-LIVE-RUN-R3-2026-11-11.md`. Bağımsız inceleme 68/68 bütünlüğü ve
teknik korelasyonu scoped olarak doğruladı; ancak probe `_marker.mjs`
bağımlılığı, host source/argv binding ve direct-feed ham stream kanıtı açık
kaldığından `REVIEW_VERIFIED=NO`. Kayıt:
`docs/W1B-R3-INDEPENDENT-REVIEW-2026-11-11.md`. Üç bulgu kaynakta giderildi:
`_marker.mjs` exact payload'a eklendi; dört host kaynak hash'i ve her fazın
bounded executable/argv kaydı runner evidence'a bağlandı; E01–E10 ham
stdout/stderr ayrı 1 MiB limitlerle korunuyor. Sonuç 202/202 regresyon,
109/109 statik ve 66/66 paket; güncel manifest SHA-256
`1C59B36EFA212773A2BDBAA1C226505EBFC41F9DAEFA3370F1EF8CC9012D129C`.
Bu kaynak sonucu R3'ü geriye dönük doğrulamaz. Sıradaki W1 kapısı hedefli yeni
kanıt planı ve ayrıca açık canlı yetkidir. W2
için yasaklı VM/Hyper-V varlıklarına dokunulmaz; uygulanabilir yol yetki ve
altyapı kararıyla ayrıca seçilir.

Değişmeyen statüler: `K2-05-C UNVERIFIED`, `K2-05-F NOT_ACCEPTED`,
`K2 NOT VERIFIED`, `K3/K4 BLOCKED`, `AUTHORITY.implemented=false`.
