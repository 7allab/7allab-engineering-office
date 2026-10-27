# P2 Karar Kaydı

Kullanıcı D1, D2 ve D3 kararlarını 2026-10-27 tarihinde açıkça onayladı.
Aynı tarihte proje sahibi D4 ve D5 kararlarını verdi (aşağıda).

## D1 — Organizasyon modeli

**Önerilen karar:** Ana Claude Code oturumu Engineering Director/orkestra şefi;
altında sekiz uzman ajan.

Uzmanlar:

1. Product Planner
2. Software Architect
3. Implementation Engineer
4. Security Engineer
5. QA & Test Engineer
6. UI/UX Engineer
7. Research Engineer
8. Release & Evidence Reviewer

Bu model dokuz mantıksal sorumluluk, fakat sekiz bölüm ajanı üretir. Director
ayrı bir bölüm ajanı değildir; yetki, dispatch ve nihai sentezi ana oturumda
tutar. Charter ve Core Operating Instructions bu karara göre güncellenmelidir.

**Alternatif:** Sekiz toplam rol; Research Engineer bağımsız rol olmaz ve
araştırma görevi Architect/Product Planner tarafından üstlenilir. Daha küçüktür
fakat güncel Protocol ve Assignment Matrix ile uyumsuzdur.

## D2 — Commit ve stage yetkisi

**Mevcut v1.2.3 davranışı:** Commit yetkisi stage yetkisi üretmez. Exact dosya
listesi için ayrıca stage yetkisi gerekir.

**Önerilen karar:** Güvenlik politikası olarak mevcut davranışı ilk pilotta
koru. Stage, commit ve push ayrı raporlanır; yalnız kullanıcının açıkça onayladığı
dosyalar stage edilir. Pilot verisi gereksiz onay yükü gösterirse şu dar değişikliği
ayrı sürümde değerlendir: explicit commit yetkisi, önceden onaylanmış exact dosya
listesinin minimal staging'ini kapsayabilir.

Bu karar değiştirilirse v1.2.3 üzerinde sessiz düzeltme yapılmaz; N3 kabul
kriteri ve Director davranışı yeni bir sürümde birlikte değiştirilir.

## D3 — İlk aktif kurulum yüzeyi

**Önerilen karar:** Önce bu kanonik repoda proje-kapsamlı Claude Code pilotu.
Global kullanıcı skill'i veya Agent Teams etkinleştirmesi yapılmaz. Claude
hesabında gözlenen v1.2.3 kopyası, düzeltilmiş sürüm hazır olana kadar mevcut
durumda bırakılır; üzerine yazılmaz veya kaldırılmaz.

## D4 — Governance temelinin kabulü

**Karar (proje sahibi, 2026-10-27):** Engineering Charter, Agent Roles & Handoff
Protocol, Core Operating Instructions, Skill & Tool Registry ve Agent-Skill
Assignment Matrix bağlayıcı Engineering Office politika temeli olarak kabul
edilir (statü: `Ratified`, sürüm: `1.1.1`; önceki: `Proposed — Ratification
Pending`, `1.1.1-candidate`). Karar bu beş belgeyi tek bir kararla kapsar;
belge bazında ayrı ayrı karar verilmedi. Roadmap kapısındaki "ayrı ayrı" ifadesi
bu toplu kararla karşılanmış sayılır; sahip aksini isterse belge bazlı kayıt
yeniden açılır.

Charter için dayanak: önceki tam inceleme ile Charter'a sonradan eklenen adaptör
referansı üzerindeki hedefli K8 kabul incelemesi birlikte değerlendirildi. Ana
oturum ayrıca Charter'ı ratifikasyondan önceki sürümüyle karşılaştırdı: tek fark
Bölüm 11 sonundaki referans paragrafı ve `P2-ADAPTER-REF` revizyon girdisi;
hiçbir izin, kapı veya güvenlik kuralı değişmedi.

Ratifikasyondaki içerik özeti (SHA-256, adaptör ve karar kaydı güncellemelerinden
sonraki nihai dosyalar):

| Belge | Sürüm | SHA-256 |
|---|---|---|
| `governance/engineering-charter.md` | 1.1.1 | `9DE20F792BFBDBA435FBCEEAA4DF40569F6D5DA079AA63D41274B9A1A896345D` |
| `governance/agent-roles-handoff-protocol.md` | 1.1.1 | `2A6CE0B647C353421CD698A554522714DE813513C36614BF6FE7C100F08266FE` |
| `governance/core-operating-instructions.md` | 1.1.1 | `D920E7717ACE56B5441B0BE25205F0FB265A1B51D6CEC41D9994ECAE5AEAE4A3` |
| `governance/skill-tool-registry.md` | 1.1.1 | `692D4899D856FEC2097D9513CB72CF096F57BE21328C4134AB30E04B1909CC85` |
| `governance/agent-skill-assignment-matrix.md` | 1.1.1 | `DA1E998BF3460614B372A5F1B3733F75CE7A647F6EDFDC221D556214F34F6544` |

Ratified, kurulu veya operasyonel anlamına gelmez: `.claude/` yoktur, hiçbir ajan,
skill veya hook kurulu değildir ve bu belgeler henüz Git'te sürümlenmemiştir.

## D5 — Proje adaptörlerinin statüsü

**Karar (proje sahibi, 2026-10-27):** KOVAN, APEXO, LIFEACTA ve 7ALLAB Web
adaptörleri yalnızca kontrollü güvenlik referansı olarak kabul edilir. Adaptörler
ratifiye edilmemiştir; belge statüleri `Draft — Ratification Pending` olarak kalır
(KOVAN 0.2-draft; APEXO, LIFEACTA, 7ALLAB Web 0.3-draft). Yeni bir statü
tanımlanmadı. Ayrım şöyle yapılır:

- `[GOV]` kurallar, yukarıdaki ratifiye governance belgelerine tabidir ve çelişkide
  governance üstündür (Charter Bölüm 11).
- `[DERIVED]` öneriler henüz bağlayıcı ürün politikası değildir; ayrıca ve açıkça
  kabul edilmedikçe tavsiye niteliğindedir.
- `[UNVERIFIED]` bilgiler doğrulanmış sayılamaz.

| Adaptör | Sürüm | SHA-256 |
|---|---|---|
| `governance/project-adapters/kovan.md` | 0.2-draft | `D80B5BBD38B8D230C4001CC7E2EDBC002894098D66E5FA9583AE6870FD997E63` |
| `governance/project-adapters/apexo.md` | 0.3-draft | `23FD0B7F98BD5AE1F7EDCF3EE33B1D6EB7C036DB67539F3A5EFC80E6DAC01A89` |
| `governance/project-adapters/lifeacta.md` | 0.3-draft | `B6BE9E3BB415CFB3D3D104BE9F829F41DD825FC33354EE348C67A448EDAECA75` |
| `governance/project-adapters/7allab-web.md` | 0.3-draft | `C88D4F171D02A514A8BAD6FCD75A02B58A199377A71DAE5CA72754884C94C33F` |

## Bilerek kabul edilen açık istisnalar

1. **Charter:** önceki tam incelemeden sonra adaptör referansı eklendi; tam Charter
   için ayrı bir yeniden kabul turu yapılmadı (bkz. D4 dayanağı).
2. **LIFEACTA R9:** son regresyon incelemesinde R9 FAIL (Medium) kaydedildi. Bu
   kayıt silinmez. `P2-LIFEACTA-R9` ile giderildi; hedefli incelemede K1–K8 PASS.
   Aynı etiket altında (0.3-draft) iki içerik revizyonu vardır; revizyon kimliği
   dosya hash'i ve Change ID'dir.
3. **Düşük (Low) editoryal bulgular açık:** Charter §9 Git örnek listesi tam değil;
   Matrix:93 KOVAN satırı Release & Evidence Reviewer'ı saymıyor; Registry:101/574;
   Charter:157; KOVAN `:81` ve `:28/:37/:80` atıf ifadeleri; APEXO yinelenen
   madde; Web atıfsız `[GOV]` etiketleri; LIFEACTA `:42` ifade.
4. **INCONCLUSIVE:** `git commit <paths>` sonrası indeks durumu; KOVAN ve diğer
   ürün depolarındaki olgular; adaptörlerin tüm `[UNVERIFIED]` listeleri.
5. **İnsan incelemesi sınırı:** bağımsız incelemelerin tamamı Explore (model)
   çıktısıdır; araç kısıtı prompt ile uygulanmıştır, teknik olarak zorlanmamıştır.
   İnsan incelemesi yapılmadı. Kabul kararı proje sahibine aittir.
6. **Operasyonel testler yapılmadı:** hiçbir ajan, skill, hook, MCP veya plugin
   kurulu değil; hiçbir eval çalıştırılmadı; hiçbir ürün deposu açılmadı.
7. **Git:** belgeler Git'te sürümlenmemiştir (commit yok). README "Kaynak önceliği"
   1. maddesindeki "Git ile sürümlenmiş" koşulu, ayrı bir commit yetkisi verilene
   kadar karşılanmaz. Stage, commit ve push için ayrı açık yetki gerekir.
8. **Manifest:** `generatedAt` ve `runtimeObservation` (Claude Code 2.1.295; bu
   makinede 2.1.311 gözlenmişti, Agent Teams ayarı yeniden doğrulanmadı)
   güncellenmedi.

## P3 için korunan engeller

Director v1.2.3 (`director/`) paketi ratifiye governance ile hizalı değildir:
durum sözlüğü (REVIEW_PERFORMED, alt çizgili adlar), REVIEW_VERIFIED tanımı,
SEC-01/SEC-02 veri aktarımı alanları ve "QA & Test Engineer" adı. v1.2.3 eval'leri
(N3, P2, P3, N2) NOT TESTED; paketleme ve hash adımı yapılmadı. Bu uyumsuzluklar
P3'ün engeli olarak kalır; ürün seçimi ve geliştirme sırası yalnızca proje
sahibinin kararıdır.

## Onay kaydı

- D1: APPROVED — main-session Director + eight specialist agents
- D2: APPROVED — stage, commit and push remain separate gates for the first pilot
- D3: APPROVED — project-scoped pilot; no global install or Agent Teams
- D4: APPROVED — five governance documents (Charter, Protocol, Core, Registry, Matrix) ratified as the binding policy baseline, version 1.1.1
- D5: APPROVED — four project adapters accepted as controlled safety references only; not ratified; status remains Draft — Ratification Pending
