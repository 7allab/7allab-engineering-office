# Runtime Pinleme Sözleşmesi — `node.exe` / `claude.exe`

Bu belge `payload-manifest.json`'daki `owner_must_supply_not_in_repo`
girdilerini (`bin/node.exe`, `bin/claude.exe`) tamamlayan zorunlu alan
listesidir. **Task 13/14'te hiçbir ikili dosya repoya kopyalanmamıştı**
— bu belge o zaman yalnız bir sözleşme/şablondu. **Task 15'te** (bkz.
aşağıdaki `2.1.319.0 — PİNLENDİ` bölümü), host üzerindeki `node.exe` ve
`claude.exe` ikilileri ölçülmüş ve **repo dışındaki** yeni bir salt-okunur
payload hedefine kopyalanmıştır — gerçek hedef dizin yolu bu repoya
gömülmez, yalnız dış payload'ın kendi dosyalarında bulunur; repo'nun
kendisine hiçbir ikili dosya kopyalanmamıştır (bu belge yalnız ölçülen
değerleri metin olarak kaydeder).

## Zorunlu alanlar (her iki çalıştırılabilir için)

| Alan | Açıklama |
|---|---|
| `source_path` | İkili dosyanın host üzerindeki tam kaynak yolu (owner tarafından kayıt altına alınır, bu repoya yazılmaz) |
| `product_version` | Dosyanın ürün sürümü (ör. `claude.exe` için pinlenen `2.1.319.0`) |
| `file_size_bytes` | Dosyanın tam boyutu (byte) |
| `sha256` | Dosyanın SHA-256'sı |
| `authenticode_signature` | İmza durumu: `Valid` / `Invalid` / `Unsigned` / `NotChecked` |
| `authenticode_signer` | İmzalayan taraf adı (imzalıysa) |
| `prerun_payload_hash_equality` | Koşu öncesi hesaplanan hash ile payload'a kopyalanan dosyanın hash'inin eşitliği (`true`/`false`) — her koşu öncesi yeniden doğrulanmalı |

## Zorunlu minimum sürüm

- `claude.exe` **>= 2.1.295** olmalıdır. Bu, `onFailure: "block"` alanının
  resmî olarak tanımlı olduğu minimum sürümdür (bkz.
  `OFFICIAL-DOCS-ALIGNMENT.md` §1). Bu sürümün altındaki bir ikili ile
  yapılan hiçbir O5 testi geçerli kabul edilemez.

## 2.1.319.0 — PİNLENDİ (Task 15, 2026-11-09)

**Eski `2.1.312` hedefi güncel gözlemle geçersizdir.** Bu oturumda host
üzerindeki aktif `claude.exe` launcher binary'si doğrudan ölçülmüş ve
seçilen aday olarak pinlenmiştir:

| Alan | Değer |
|---|---|
| `product_version` | `2.1.319.0` |
| `file_size_bytes` | `344807072` |
| `sha256` | `2E055732C9D03D22700D9046251A8370B673607BFCC9E4D16A1B0E8FB1345CBD` |
| `authenticode_signature` | `Valid` |
| `authenticode_signer` | `Anthropic, PBC` |
| `source_path` | **bu repoya gömülmez** — gerçek host kaynak yolu yalnız dış payload'ın kendi `RUNTIME-PINS.json` runtime envanterinde bulunur (bu repoya hiçbir host dosya yolu yazılmaz) |
| `prerun_payload_hash_equality` | ölçüldü, `true` (bkz. aynı payload'ın `RUNTIME-PINS.json`'ı — payload'a kopyalanan dosyanın hash'i, yukarıdaki kaynak hash'iyle eşit) |

**`node.exe` için aynı oturumda ölçülen eşlik değerleri** (ayrı bir runtime,
ayrı bir sözleşme girdisi — `bin/node.exe`): `product_version=24.18.0`,
`file_size_bytes=92534088`,
`sha256=9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`,
`authenticode_signature=Valid`, `authenticode_signer=OpenJS Foundation`.

**Ayrıca gözlenen optional ikili (seçilmedi):** aynı npm paketinin
`node_modules\@anthropic-ai\claude-code-win32-x64\claude.exe` altındaki
optional-dependency binary'si (`2.1.318`, `342408352` bayt) de mevcuttur,
ancak bu pinlemede **seçilmemiştir** ve payload'a kopyalanmamıştır —
yalnız yukarıdaki aktif launcher (`.../claude-code/bin/claude.exe`,
`2.1.319.0`) pinlenmiştir.

> **Bu pinleme bir kurulum, sandbox çalıştırma veya `claude.exe`
> uyumluluk testi DEĞİLDİR.** Yalnız host üzerindeki ikili dosyanın
> kimliğinin (boyut/hash/sürüm/imza) ölçülüp kayıt altına alınmasıdır.
> Sandbox hiçbir şekilde başlatılmamıştır; `claude.exe` hiçbir şekilde
> çalıştırılmamıştır.

## Koşu öncesi kontrol sırası (her sandbox koşusu için)

1. Host'taki `node.exe`/`claude.exe` kaynak dosyalarının SHA-256'sını hesapla.
2. Authenticode imzasını doğrula (`Get-AuthenticodeSignature` veya denk
   bir araçla) ve sonucu kaydet.
3. Dosyaları payload'a kopyala.
4. Payload içindeki kopyanın SHA-256'sını yeniden hesapla ve adım 1'deki
   değerle eşitliğini doğrula (`prerun_payload_hash_equality`).
5. `claude.exe` sürümünün `>= 2.1.295` olduğunu doğrula; değilse koşuyu
   **BAŞLATMA**.
6. Tüm bu alanları o koşunun run-kaydına (bkz. `RUN-ORDER.md`) yaz.

## `check-package.mjs` ile ilişki

`check-package.mjs`, bu sözleşmenin alan isimlerinin
`payload-manifest.json`'da ve gelecekteki run-kayıtlarında eksiksiz
bulunmasını statik olarak doğrular (bkz. bölüm 8 güncellemeleri); ancak
gerçek ikili dosyaların hash/imza değerlerini kendisi ÜRETMEZ — bunlar
owner tarafından fiilen staged edilip ölçülmelidir.
