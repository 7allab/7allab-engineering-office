# K2-05-C host kurulum aracı

Durum: **repo içi hazırlık; host üzerinde çalıştırılmadı.** Bu araç ve geçici
dizin testi K2 kabulü, insan incelemesi veya üretim yetkisi oluşturmaz.

## Güvenlik sözleşmesi

- Üretim hedefleri yalnız `C:\Program Files\ClaudeCode\managed-settings.json`,
  `C:\Program Files\7allab-security\<dosya>` ve
  `C:\ProgramData\7allab-k205c\install-state.json` olabilir.
- `Install` ve `RestoreGood` yönetici ister; `VerifyAbsent` salt okunurdur.
- Yalnız temiz başlangıç desteklenir. Hedef veya state dizini zaten varsa işlem
  reddedilir; mevcut kurulumun üstüne yazılmaz.
- Kaynak dosyalar manifestte SHA-256 ile sabitlenir. Reparse-point içeren kaynak,
  manifest veya hedef yolu reddedilir.
- Üretimde oluşturulan dizinler SYSTEM/Administrators tam denetim, Users
  salt-okuma/çalıştırma ACL'i alır. Bu yalnız yapılandırmadır; gerçek standart
  kullanıcı yazma reddi ayrıca gözlenmeden O4 PASS sayılamaz.
- `RestoreGood` yalnız state kaydındaki, izin verilen hedefteki ve hash'i
  değişmemiş dosyaları siler. Değişmiş/eksik dosyada fail-closed durur.

## Manifest

Kanonik pilot girdileri `managed-settings.json` ve `install-manifest.json` ile
sabitlenir. Manifest tam olarak bir `managed-settings.json` hedefi ve en az bir
`security/<dosya>` hedefi taşımalıdır. `install-manifest.template.json` yalnız
gelecekteki paketler için sıfır hash'li, doğrudan kurulamaz bir şablondur.

## Onaylı bir host pilotunda sıra

1. Ayrı sistem-değişikliği onayı ve temiz hedef doğrulaması alın.
2. `Install` çalıştırın; sonuç `INSTALLED_UNATTESTED` olarak kalır.
3. Ayrı standart kullanıcıyla managed policy ve güvenlik dosyalarına yazmanın
   reddedildiğini, hook davranışını ve üretilen hash'leri kanıtlayın.
4. Yönetici olarak `RestoreGood` çalıştırın.
5. `VerifyAbsent` ve bağımsız host-yokluk kontrolünü kaydedin.

`-TestMode`, yalnız `-TestRoot` altındaki geçici dizinler içindir ve ACL davranışı
kanıtlamaz. Repo içi davranış kontrolü:

```powershell
& .\test\security-pilot\host\managed-hooks.test.ps1
```

Bu belge komutları çalıştırma yetkisi vermez; host pilotu için ayrıca açık onay
gerekir.

## K2-05-C-R1 — offline host export doğrulayıcısı (aday)

`verify-export.mjs`, mevcut bir export'u okuyarak her manifest girdisini
SHA-256 ve boyutla doğrular; `EXPORT.COMPLETE.json`, Run ID, dosya kümesi,
yol taşması ve sembolik bağlantı kontrollerini uygular. **Sandbox veya başka
bir process başlatmaz.** `host_manifest_verified` yalnız kontrol geçerse
`true` olur ve ayrı, yeni rapor dizinine yazılır. Bu bir guest/host kimlik
attestation'ı veya `REVIEW_VERIFIED` değildir.

- İzole fixture regresyonu: `node test/security-pilot/host/verify-export.test.mjs`
- Host koşusu: ayrıca onay gerekir; mevcut runner ile bağlantı henüz yapılmadı.
- Üretilen `host-manifest-verification.json` ayrı kanıt olarak indekslenmeli,
  hash'lenmeli ve bağımsız incelenmelidir.
- K2-05-C için B/F, O1/O4/O7 ve insan kabulü açık kalır; bu yardımcı onların
  hiçbirini otomatik PASS'a yükseltmez.

## R1.1/R1.3/R1.4 — pasif host kanıt yakalayıcısı (gelecek koşular)

`host/runner-evidence.mjs` **wsb.exe, Claude, Sandbox, Hyper-V veya host
ayarlarını ÇALIŞTIRMAZ**. Sadece ayrı bir host yürütücüsünün önceden yakaladığı
stdout/stderr dosyaları, komut çıkış kodları, timeout/hata kodu, `wsb list --raw`
son envanteri ve bağımsız runtime auth provenance girdisini işler. Her yeni,
önceden bulunmayan rapor dizininde ham girişlerin SHA-256 bağını ve
`host-runner-evidence.json` kaydını üretir. Üstüne yazma yoktur. Önceki run
kanıtlarına veya mevcut manifest paketine yazmaz.

Tek seferlik çevrimdışı normalizasyon (yalnız **önceden oluşturulmuş** ve
hassas veriler bakımından gözden geçirilmiş girdi dosyalarıyla):

```text
node test/security-pilot/host/runner-evidence.mjs --input <runner-input.json> --output <new-report-dir>
node --test test/security-pilot/host/runner-evidence.test.mjs
```

Giriş sözleşmesi (`7allab-k205c-host-observability-input/0.1`):
`run_id`, `sandbox_id`, `collected_at` (UTC), en az bir `events` girdisi.
Her olayda `phase`, `observed_at` (UTC), `exit_code` (başlatma başarısızlığında
`null`), `timed_out`, `stdout_path`/`stderr_path` (yoksa `null`), hata varsa
`error_code` gerekir. Fazlar: `PREFLIGHT`, `SANDBOX_START`, `CONNECT`,
`WAIT_FOR_EXPORT`, `SANDBOX_STOP`, `FINAL_INVENTORY`, `EXPORT_VERIFY`,
`HOST_ERROR`. Son envanter fazı, `sandbox_id` ile ilişkilendirilmiş, korunmuş
**ham** `wsb list --raw` stdout dosyasını gerektirir. Yalnız sıfır çıkış kodu,
şemaya uygun JSON ve *tüm* `WindowsSandboxEnvironments=[]` sonucu
`all_sandboxes_absent=true` verir. Sadece ilgili Sandbox'ın kaybolması yeterli
değildir. Toplama zamanlamasının gerçekten cleanup sonrasında gerçekleştiğini
bu yardımcı tek başına kanıtlayamaz.

İsteğe bağlı `auth_provenance_path`, guest/runner'ın **bağımsız çalışma
ortamı gözleminden** kaydettiği JSON dosyasıdır. Tam olarak `auth_mode`,
`credential_kind`, `endpoint_kind`, `source=RUNNER_ENVIRONMENT`, `observed_at`
alanlarını içerir; sır, API anahtarı veya token alanı içeremez. `MOCK_ENDPOINT`
için `SYNTHETIC_SENTINEL` + `LOOPBACK_MOCK`, `NONE` için `NONE` + `NONE`
aranır. `REAL`, ayrı izin ve sözleşme olmadığından reddedilir. Auth girdisi
yoksa `NOT_RECORDED` kalır; **`evidence_kind` değerinden çıkarım yapılmaz**.
Kaydın varlığı çalışma anındaki gerçek kimlik doğrulamasını tek başına
attest etmez.

**Kritik güvenlik ayrımı:** Ham stdout/stderr dosyaları loglarda sır
bulunabileceğinden yalnız erişim denetimi uygun, kontrollü bir yerel dizinde
saklanmalı; otomatik paylaşılmamalıdır. Bu yardımcı içerikleri maskelemez.
Bu aşamada kanonik repo içinde canlı host/guest transport **YOK**;
`run-one-policy.ps1` ve `run-policy.ps1` tarihsel kanıt kopyalarıdır.
Dolayısıyla bu yardımcı R1.1/R1.3/R1.4'ü *entegre ve canlı doğrulanmış*
yapmaz. Yeni gerçek Sandbox/host testleri için ayrı açık izin gerekir.
Hiçbir sonuç `REVIEW_VERIFIED`, genel K2-05-C PASS veya operasyonel yetki
değildir. R1.2 `verify-export.mjs` entegrasyonu da ayrıca beklemektedir.

## R1.6 — Offline host/guest correlation (pre-existing synthetic evidence only)

`host/offline-integrate.mjs` combines the **already existing**
`verify-export.mjs` and `runner-evidence.mjs` interfaces without launching
`wsb.exe`, PowerShell, Claude, network, Hyper-V, or any live test. It consumes a
completed guest export and an independently prepared host-runner observation
input. Every invocation requires an **absent** output directory outside the
export and input trees. Output is `offline-correlation.json` plus a fresh
`host-evidence/` directory containing the host recorder's raw snapshots.

```text
node test/security-pilot/host/offline-integrate.mjs --run-dir <existing-guest-export-run-directory> --run-id <run-id> --policy <p1..p6-policy-file.json> --runner-input <host-observability-input.json> --report-dir <new-separate-output-directory>
node --test test/security-pilot/host/offline-integrate.test.mjs
```

**Result states** (these are offline consistency classifications, never runtime
security enforcement or acceptance):

- `OFFLINE_CONSISTENT_UNATTESTED`: export verified; `result.json` is itself
  hash-bound in the manifest; guest `run_id`, allowlisted `policy_file`,
  `RUN_COMPLETED_UNATTESTED`, `claude_exit_code=0`, `claude_timed_out=false`
  and immutable authority-false fields agree; host stages are present,
  ordered, error-free; captured final global inventory is empty; separate
  `RUNNER_ENVIRONMENT` auth observation declares a synthetic loopback mock.
- `INCONCLUSIVE`: required host stage, final global-empty inventory or
  independent mock auth record is missing or uncertain, absent contradictions.
- `FAIL_CLOSED`: malformed/changed export, guest failure or contradiction,
  mismatched run/policy, invalid host evidence, timeout, nonzero exit or
  contradictory stage chronology. Both nonpositive statuses use exit code 1.

The recorder's `evidence_kind` and `auth_mode` are deliberately **not**
interchangeable: auth is never inferred from guest result fields. Positive
reports are *not signed*, do not establish independent host trust custody,
real execution, final Sandbox emptiness, managed-hook enforcement, O1/O4/O7,
K2-05-F acceptance, or human review. All reports retain
`sourceTrusted=false`, `authorityImplemented=false`,
`operationalAuthority=false`, `review_verified=false`. An exit code of 0
means *only* that supplied offline evidence met these constraints.

The host recorder copies unredacted stdout/stderr; inspect for credentials or
personal information and restrict report-directory access before any sharing.
There is still **no live host or guest runner in this canonical repo**.
Historical immutable evidence is never modified or retroactively attested.

## W1a — bounded inventory campaign binding

`host/campaign-driver.mjs`, R2-C2 collector tarafından yeni bir dizine yazılan
dört dosyalı envanter kaydını yeniden hash/contract kontrolünden geçirip mevcut
`host-lifecycle.mjs` akışının yalnız `PREFLIGHT` ve `FINAL_INVENTORY`
fazlarına bağlar. Stateful `start/connect/waitForExport/stop` işlemleri bu
modülde uygulanmaz; yalnız çağıranın enjekte ettiği dört sabit metoda aktarılır.
Ek metod, CLI, shell veya process başlatma yolu yoktur.

Guest auth recorder ve result finalizer host tarafında çalıştırılmaz. Bunların
çıktısı guest export manifestinde hash-bound `result.json` olarak taşınır ve
mevcut offline correlator tarafından doğrulanır. Böylece guest/host sınırı
korunur. Injected testler başarı, authority şişirme, raw hash değişimi,
collector hatası, stateful hata sonrası cleanup/final inventory, output
collision ve transport belirsizliğini kapsar.

Bu bağlantı W1a'nın çevrimdışı assembly sonucudur; canlı W1b kampanyası,
Sandbox yürütmesi, O1/O4/O7 kanıtı, K2 kabulü veya operasyonel authority
değildir.

## W1b source — bounded stateful transport

`host/wsb-stateful-transport.mjs`, yalnız kaynak/sentetik test kapsamında dört
metot üretir: `start`, `connect`, `waitForExport`, `stop`. Komutlar sabittir;
`shell:false`, doğrulanmış R2-C2 binary identity ve exact owned GUID kullanılır.
Çağıran executable, komut, argüman veya XML sağlayamaz. Config; network, VGPU,
clipboard, audio/video/printer kapalı, ProtectedClient açık, payload read-only
ve tek export mapping writable olacak şekilde modül içinde üretilir.

Start/stop için 30 saniye, connect spawn için 15 saniye, export için 4 dakika
sabit üst sınır vardır. stdout/stderr ayrı ayrı 1 MiB ile sınırlıdır;
spawn/nonzero/stderr/timeout/overflow sonuçları ayrı error code üretir. Connect
arka plan süreci stop sonrasında kapanmadan cleanup başarılı sayılamaz. Yanlış
start ID connect'i engeller fakat yalnız rezerve owned ID için stop yolunu açık
tutar. Export completion exact run ID ve pozitif file count gerektirir.

Bu modülün CLI'si yoktur. Testler fake child process kullanır; hiçbir gerçek
`wsb start/connect/stop` çalıştırılmaz. Canlı kullanım ayrıca
`W1B-LIVE-EXECUTION` izni gerektirir.

## W1b source — guest-targeted p2 runner

`sandbox/w1b-run.ps1`, yalnız `p2-managed-hooks-only.test.json`, Sandbox guest
kimliği ve sentetik loopback endpoint için kapalıdır. Çalıştırmadan önce guest
auth provenance kaydeder, ham Claude debug/output akışlarını korur, mevcut
E01–E10 fixture'larını `sandbox/w1b-direct-feed.mjs` üzerinden değerlendirir;
sonuç finalizasyonu ve export manifestini mevcut fail-closed modüllere bırakır.
Permission bypass bayrağı kullanmaz ve tüm authority alanlarını `false` tutar.

Runner ve evaluator testleri yalnız kaynak/statik veya injected-process
testleridir; Sandbox, Claude, Hyper-V ya da host ayarı çalıştırmaz. Direct-feed
eşleşmesi yalnız `DIRECT_FEED_MATCHED_UNATTESTED` olabilir; canlı managed-hook
enforcement değildir. Canlı yürütme ayrı yetki sınırı olarak kalır.

`host/w1b-live-runner.mjs`, bu parçaları tek kapalı çağrıda birleştirir. CLI
yalnız `--plan <absolute-json-path>` kabul eder; plan tam olarak schema, run ID,
owned Sandbox GUID, p2 policy ve üç mutlak kök taşır. Export run dizini ile
`guest-auth.json` yolu plan girdisinden değil, runner tarafından türetilir.
Bilinmeyen alan, başka policy, göreli yol veya serbest komut yüzeyi reddedilir.
Bu dosyanın testleri dependency injection kullanır; CLI'nin gerçekten çağrılması
canlı WSB işlemi olduğundan ayrıca `W1B-LIVE-EXECUTION` yetkisi gerektirir.
