# Resmî Claude Code Dokümanıyla Hizalama (K2-05-C hazırlığı, 2026-11-08)

Bu belge, bu paketin `onFailure`/`allowManagedHooksOnly` varsayımlarını resmî
Claude Code dokümanıyla karşılaştırır. **Hiçbir iddia bu belgeyle test edilmiş
sayılmaz** — dokümantasyon, davranışın bu paket/host/`claude.exe` sürümünde
gerçekten böyle çalıştığını kanıtlamaz; hedef `claude.exe` üzerinde canlı test
hâlâ gereklidir (bkz. `ACCEPTANCE-CRITERIA.md`).

Kaynaklar (bu oturumda WebFetch ile okundu, 2026-11-08):
- `https://code.claude.com/docs/en/hooks`
- `https://code.claude.com/docs/en/settings`

## 1. `onFailure: "block"` — resmî olarak tanımlı

- Alan, command hook girişinde ve HTTP hook girişinde resmî olarak
  tanımlıdır: `"continue"` (belirtilmezse çoğu olayda varsayılan davranış) veya
  `"block"`.
- **`"block"` ne yapar:** "bir başarısızlık, o olaydaki exit code 2'nin
  yaptığını yapar — `PermissionRequest` hariç, orada isteği reddeder."
  Örnek: bir `PreToolUse` başarısızlığı tool çağrısını bloklar.
- **Başarısızlık sayılan durumlar (resmî listeden):**
  - betik/çalıştırılabilir başlatılamıyor (eksik komut)
  - çıkış kodu 0 veya 2 dışında (bu paketin varsaydığı "beklenmeyen hata"
    durumuyla örtüşür)
  - HTTP hatası (bağlantı başarısız veya durum 2xx değil)
  - timeout (hook kendi `timeout`'una ulaşır)
  - geçersiz çıktı: ayrıştırılamayan JSON veya şema doğrulaması başarısız
    (command hook için düz metin stdout başarısızlık sayılmaz)
- **İstisnalar (alan etkisiz):** `Stop`, `SubagentStop`, `TaskCompleted`,
  `TeammateIdle` olayları ve `async`/`asyncRewake` ayarlı arka plan komut
  hook'ları. Bu paket yalnız `PreToolUse`/`PermissionRequest` kullandığından
  bu istisnalar şu an uygulanmaz, ama ileride olay eklenirse göz önünde
  bulundurulmalıdır.
- **Sürüm gereksinimi:** command ve HTTP hook tablolarının her ikisi de ve
  bölüm metni **Claude Code v2.1.295 veya üstünü** şart koşuyor. Bu, paketin
  `payload-manifest.json`'daki `claude.exe` için minimum sürüm gereksinimidir
  (bkz. `RUNTIME-PINNING.md`).

**Sonuç:** Paketin P3/P4/P5 (`onFailure: "block"`) ve P6 (kontrol, alan yok)
senaryoları, resmî davranış tanımıyla **kavramsal olarak uyumludur**.
**Ancak bu dokümantasyon, davranışın bu pakette çalıştığını KANITLAMAZ** —
hedef `claude.exe` üzerinde canlı/mock test (O5) yine de zorunludur.

## 2. `allowManagedHooksOnly` — resmî dokümantasyon MEVCUT

**Düzeltme notu (zero-hallucination gereği):** Bu görevin orijinal talimatı
"`allowManagedHooksOnly` için güncel resmî doküman bulunamadığını yaz" idi.
Bu oturumda `https://code.claude.com/docs/en/hooks` sayfası (Hook locations
bölümü) doğrudan okunduğunda, bu anahtarın **gerçekten resmî olarak
dokümante edildiği** görüldü. Talimatın bu kısmı, bu belgeye olduğu gibi
aktarılmamıştır çünkü mevcut, doğrulanabilir kanıtla çelişiyordu (7ALLAB
Zero-Hallucination ilkesi: kanıt talimattan önce gelir). Aşağıda gerçek,
okunan içerik var.

**Resmî tanım (Hook locations bölümü, `code.claude.com/docs/en/hooks`):**
Yöneticiler bunu managed settings içinde ayarlayabilir, etkisi:
- Kullanıcı, proje, local ve plugin hook'ları **bloklanır**. Managed
  `enabledPlugins` içinde zorla etkinleştirilmiş plugin'lerin hook'ları
  bundan **muaf**tır.
- `statusLine`, `fileSuggestion`, `subagentStatusLine` yalnız managed
  settings'e daralır.
- `command` kaynaklı plugin'ler (zorla etkinleştirilmiş olanlar dahil)
  devre dışı kalır, `disableCommandPluginSources` açıkça `false` değilse.
- Marketplace `headersHelper` komutları da benzer şekilde kısıtlanır.

**Bu paket için anlamı:** `p2-managed-hooks-only.test.json`'daki
`allowManagedHooksOnly: true` davranışının **kavramsal tanımı** resmî
dokümanla doğrulanmıştır: mevcut kullanıcı/proje/local/plugin hook'larının
bloklanması beklenir. **Ancak bu, O3'ün ampirik hedefini ortadan
kaldırmaz:**
- Doküman, bu host'taki **belirli** `claude.exe` sürümünde (hedef 2.1.312)
  bu davranışın doğru uygulandığını kanıtlamaz.
- Sandbox'ta hâlâ gerçek bir kullanıcı/proje/plugin hook'u yok (profil
  kopyalanmıyor) — bu nedenle O3, **sentetik plugin fixture'ı** (bkz.
  `plugins/o3-marker-plugin/`) olmadan hâlâ yalnız "sandbox'ta 0 plugin
  hook'u var" döngüsel sonucunu verir.
- **O3'ün statüsü bu nedenle, sentetik fixture ile canlı/mock test
  yapılmadan, `UNVERIFIED`/`INCONCLUSIVE` olarak kalır** — dokümantasyonun
  varlığı bunu değiştirmez; dokümantasyon yalnızca "beklenen yön"ü verir,
  "gözlenen yön"ü vermez (ve bu paket beklenen yönü hard-code etmez, bkz.
  `plugins/o3-marker-plugin/README.md`).

## 4. Resmî plugin dizin yapısı (Task 14, bölüm D)

Kaynaklar (bu oturumda WebFetch ile okundu, erişim tarihi **2026-11-08**):
- `https://code.claude.com/docs/en/plugins` (overview)
- `https://code.claude.com/docs/en/plugins/components.md`
- `https://code.claude.com/docs/en/plugins/create.md`

**Resmî, doğrulanmış yapı:**
- Manifest **zorunlu olarak** `.claude-plugin/plugin.json` içinde olmalı
  (alanlar: `name` zorunlu, `description`, `version`, `author`).
  "Only `plugin.json` goes inside `.claude-plugin/`. Components saved
  there don't load." (resmî uyarı, aynen).
- Hook konfigürasyonu `hooks/hooks.json` içinde, üst düzey `"hooks"`
  anahtarı altında, **settings.json'daki `hooks` ile aynı şekilde**
  tanımlanır: "Save the plugin's hooks in `hooks/hooks.json` at the
  plugin root, under a top-level `"hooks"` key, in the same shape as
  the `hooks` object in `settings.json`."
- Hook komutlarında `${CLAUDE_PLUGIN_ROOT}` ortam değişkeni kullanılır;
  resmî örnek bunu tek bir quoted-string `"command"` alanı içinde
  gösteriyor (`"\"${CLAUDE_PLUGIN_ROOT}/scripts/format.sh\""`).
  **Bu paketin `o3-marker-plugin/hooks/hooks.json`'ı bunun yerine
  `command`+`args` (exec form) kullanır** — bu paketin ana payload
  policy'leriyle tutarlı olacak şekilde bilinçli bir seçimdir; ancak
  `${CLAUDE_PLUGIN_ROOT}`'un bir `args` dizisi elemanı içinde de
  genişletildiği resmî dokümanda ayrıca örneklenmemiştir ve bu görevde
  **doğrulanmamıştır** (`UNVERIFIED`).
- `--plugin-dir <path>` komutu, plugin'in **kök dizinini** (manifest'i
  içeren dizini) alır, bir marketplace kökünü değil: "`--plugin-dir`
  takes the plugin's root directory, the one that contains
  `.claude-plugin/plugin.json` and the component directories."

**Bu paket için anlamı:** `plugins/o3-marker-plugin/` artık resmî
dizin yapısına göre düzenlenmiştir (`.claude-plugin/plugin.json`,
`hooks/hooks.json`, `scripts/marker.mjs`). Bununla birlikte:
- `claude plugin validate` bu görevde **çalıştırılmamıştır**; şemaya
  tam uyum `UNVERIFIED` kalır.
- `args` içinde `${CLAUDE_PLUGIN_ROOT}` genişletmesi `UNVERIFIED`.
- Bu, O3'ün ampirik hedefini değiştirmez: sentetik fixture olmadan
  veya fixture kayıt olmazsa O3 `INCONCLUSIVE` kalır (bkz.
  `ACCEPTANCE-CRITERIA.md`).

## 5. Bu belgenin azami iddiası

Bu belge yalnızca **STATIC** kanıt sağlar (resmî dokümanın okunan metni).
`evidence-schema.json`'daki `max_claim_enum` karşılığı: doğrudan hiçbir O1–O7
gözlemine kanıt olamaz; yalnız O1/O5/O3'ün "beklenen davranış" sütununu
doğrular. Hiçbir gözlem bu belgeye dayanarak `PASS` alamaz.
