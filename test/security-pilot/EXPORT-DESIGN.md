# Kanıt Export Tasarımı — Option A (hazırlık, uygulanmadı)

Bu belge, Task 12'nin 3. bölümünde önerilen ve bu görevde (Task 13)
**uygulamaya hazırlanan ama ÇALIŞTIRILMAYAN/OLUŞTURULMAYAN** Option A
("sandbox'a ayrı, salt-okunur olmayan bir export mapped folder eklemek")
tasarımını somutlaştırır.

**Bu görevde host'ta hiçbir klasör oluşturulmamış, hiçbir sandbox
çalıştırılmamıştır.** Aşağıdaki her adım, gelecekteki bir yetkilendirme
sonrasında uygulanacak bir plandır.

## 1. İki ayrı mapped folder

`sandbox/pilot.wsb.draft.xml` artık iki `MappedFolder` tanımlar:

| Sandbox yolu | Amaç | ReadOnly | Host placeholder |
|---|---|---|---|
| `C:\payload` | Paketin kendisi (kod, fixture, policy) | `true` | `__HOST_PAYLOAD_DIR__` |
| `C:\export` | Kanıt çıkışı | `false` | `__HOST_EXPORT_DIR_PLACEHOLDER__` |

İkisi **asla aynı host dizini olamaz** — `check-package.mjs` bunu statik
olarak doğrular (bkz. bölüm 8).

## 2. Her koşu için benzersiz export dizini

Owner, her sandbox koşusundan önce `__HOST_EXPORT_DIR_PLACEHOLDER__`'ı
**yeni, boş, benzersiz** bir host dizinine ayarlamalıdır (ör. bir
`run_id` zaman damgası + policy adıyla adlandırılmış). `export-manifest.ps1`
betiği (sandbox içi) bu kuralı kendi tarafında da zorunlu kılar: aynı
`RunId` ile ikinci bir export denemesi hata ile durur.

**Önceki export dizinini silen/boşaltan hiçbir komut bu pakette yoktur
ve eklenmemelidir.** Bu, owner'ın elle yapacağı bir temizlik kararıdır.

## 3. Export allowlist

Mevcut `sandbox/export-manifest.ps1` allowlist'i: `.json`, `.jsonl`,
`.log`, `.txt`, `.sha256`. Herhangi bir allowlist dışı dosya,
reparse point veya secret deseni bulunduğunda **tüm preflight FAIL-CLOSED**
durur; başka dosyalar sessizce atlanmaz, run export dizini oluşturulmaz.
Bu, önceki hazırlık metnindeki "uyarı ile atlanır" davranışını düzeltir.

## 4. Sandbox içi SHA-256 manifesti

`export-manifest.ps1`, export edilen her dosyanın SHA-256'sını
hesaplayıp `MANIFEST.sha256.json` olarak export dizinine yazar
(sandbox içinde, kapanmadan önce).

## 5. Host doğrulama adımları (owner tarafından, sandbox kapandıktan sonra)

1. Export mapped folder'daki her dosyanın host'ta SHA-256'sını yeniden
   hesapla.
2. `MANIFEST.sha256.json`'daki değerlerle bire bir karşılaştır.
3. Herhangi bir uyuşmazlık, manifest'te olmayan bir dosya, bir
   `.BLOCKED.txt` uyarı dosyası, bir symlink/reparse point veya secret
   deseni varsa → **FAIL-CLOSED**: export'un bütünlüğü reddedilir, hiçbir
   dosya güvenilir kanıt olarak kabul edilmez.
4. Export edilen hiçbir dosya host üzerinde **otomatik çalıştırılmaz**
   (çift tıklama/`Invoke-Item`/script çalıştırma owner'ın elle, bilinçli
   kararıdır — bu paket bunu otomatikleştirmez).

## 6. Secret taraması

`export-manifest.ps1`, export etmeden önce her dosyanın içeriğini basit
secret desenlerine (`sk-...`, `BEGIN PRIVATE KEY`, `Bearer ...`) karşı
tarar. Herhangi bir eşleşmede **bütün export reddedilir**; `.BLOCKED.txt`
notu veya başarılı completion marker üretilmez. Bu tarama genel kapsamlı
DLP olduğu iddiası taşımaz.

## 7. Bu tasarımın sınırları

- Bu, **tasarım ve hazırlıktır** — hiçbir sandbox, hiçbir host export
  klasörü bu görevde gerçekten oluşturulmamıştır.
- `export-manifest.ps1`'in gerçek bir Windows Sandbox içinde çalıştığı
  bu görevde **test edilmemiştir** (`NOT TESTED`).
- Placeholder host yolları (`__HOST_PAYLOAD_DIR__`,
  `__HOST_EXPORT_DIR_PLACEHOLDER__`) gerçek kullanıcı yolu DEĞİLDİR;
  owner tarafından koşu zamanında doldurulmalıdır.

## 8. K2-05-C-R1 — bağımsız host manifest doğrulama yardımcısı (aday)

`host/verify-export.mjs`, **yalnızca zaten mevcut** bir guest export dizinini
host tarafında salt-okunur doğrular. Run ID; manifest/marker eşleşmesi;
her dosyanın boyutu ve SHA-256'sı; beklenmeyen dosyalar, yol taşması,
case-collision ve sembolik bağlantılar kontrol edilir. Başarılı doğrulamada
`host_manifest_verified=true`, başarısızlıkta `false` ve kısa bir hata kodu,
**önceden bulunmayan** ayrı bir rapor dizinindeki
`host-manifest-verification.json` dosyasına kaydedilir. Rapor kaydı oluşmadan
başarı bildirilmez; export içine yazılmaz, eski raporların üzerine yazılmaz.

Bu kontrol, **manifesti guest'in gerçekten güvenilir biçimde ürettiğinin veya
host'un saldırıya uğramadığının kanıtı değildir**. İmza/attestation, gerçek
çalışma kimliği ve bağımsız insan incelemesi ayrı kapılardır. Windows reparse
point türleri ve eşzamanlı dosya değişimi gibi platform-spesifik durumlar
ayrıca host testinde doğrulanmalıdır.

Gelecekteki ayrı yetkilendirilmiş koşuda örnek çağrı (bu belge çalıştırmaz):

```text
node test/security-pilot/host/verify-export.mjs \
  --run-dir <existing-run-export-dir> --run-id <exact-run-id> \
  --report-dir <new-empty-report-dir-path>
```

`host/verify-export.test.mjs`, geçici dizinlerde Node'un kendi `node:test`
modülüyle fixture testleri çalıştırır; Sandbox/Hyper-V/Program Files'a dokunmaz.
Mevcut host runner kaynak kodu bu inceleme paketinde sunulmadığından,
**runner entegrasyonu yapılmadı**. Özellikle r1/r2 host stdout/stderr/exit,
cleanup ve son `wsb list --raw` envanterinin birincil kaydı bu yardımcıyla
**üretilmez**. Bunlar ancak yetkili yeni koşu için gerçek runner'a eklenebilir.
Yeni raporlar geçmiş başarısızlıkların kök nedenini geriye dönük kanıtlamaz.
