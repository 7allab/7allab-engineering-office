# W1b — Yetkilendirme ve Canlı Kampanya Karar Paketi

Durum: **DECISION REQUIRED — NO LIVE AUTHORITY**  
Tarih: 2026-11-11

Bu paket bir izin talebidir; kendi başına izin değildir. W1b iki ayrı yetki
kategorisine bölünür. Kaynak uygulaması onayı canlı yürütme onayı sayılmaz.

## 1. Doğrulanmış başlangıç noktası

- W1a campaign driver: çevrimdışı ve injected/synthetic olarak tamamlandı.
- Düzeltme sonrası regresyon: 200/200 PASS; statik paket kontrolü: 109/109 PASS.
- Paket: 66/66; `MANIFEST.sha256.json` SHA-256
  `A5A86F9B6D3F8DBC6C01CC36BC25D49E7EE5FB2230826F1D248E48E864F60941`.
- Bounded stateful transport ile p2 guest-targeted runner kaynağı ve sentetik
  testleri hazır; canlı çalıştırılmadı.
- Sandbox/Hyper-V başlatılmadı; host ayarı ve gerçek credential kullanılmadı.

## 2. Tarihsel runner kararı

İnceleme paketindeki aşağıdaki dosyalar yalnız tarihsel kanıttır:

- `run-one-policy.ps1` SHA-256
  `6B00021A9D8D90FBAF31581CB02BADC58ED9334721F1ED2B7DDC3F285C1A409A`
- `run-policy.ps1` SHA-256
  `5CDFBF9F208889C72B7896C7CDA6D713A1D67ED34E808C3028D245AE8FD6A1CC`

W1b'de doğrudan çalıştırılmaz veya kanonik kaynağa kopyalanmaz. Nedenleri:

- yeni binary-identity/hash sabitlemeli inventory adapter'ını kullanmıyor;
- guest auth provenance recorder ve result finalizer entegrasyonu yok;
- hedefli açık boşluklar yerine eski P1–P6 kampanyasını tekrar ediyor;
- `--dangerously-skip-permissions`, PermissionRequest ölçümünü geçersiz veya
  belirsiz hale getirebilir;
- current-user final inventory ile sistem-geneli boşluk iddiasını ayıran yeni
  sözleşmeyi taşımıyor.

## 3. Yetki A — yalnız kaynak uygulaması

Önerilen karar kimliği: `W1B-SOURCE-IMPLEMENTATION`.

İzin verilirse yalnız kanonik `test/security-pilot/` kapsamında:

1. Sabit `wsb start --id <owned-id> --config <bounded-config> --raw`,
   `wsb connect --id <owned-id>` ve `wsb stop --id <owned-id>` kabiliyetlerini
   temsil eden, `shell:false` kullanan bounded transport yazılır.
2. Rastgele komut, serbest argüman, PowerShell metni veya kullanıcı seçilebilir
   executable kabul edilmez.
3. Paket/binary kimliği R2-C2 ile aynı sabitlenmiş `wsb.exe` üzerinden gelir.
4. Start/stop/connect sonuçları için ayrı timeout, stdout/stderr 1 MiB limit,
   spawn/nonzero/timeout/overflow ayrımı ve owned-ID doğrulaması uygulanır.
5. Guest runner yalnız O1, açık O4/PermissionRequest ve O7 ölçütlerine daraltılır;
   gerçek sır reddedilir, loopback mock + sentetik sentinel dışında auth yoktur.
6. Guest auth recorder sonuçtan önce, result finalizer export'tan önce çalışır.
7. Yalnız injected/synthetic süreç testleri çalıştırılır.

Bu transport dilimi tamamlandı: exact owned GUID, binary identity, closed config,
30 saniye start/stop, 15 saniye connect, 4 dakika export, ayrı 1 MiB stream
limitleri, connection termination doğrulaması ve completion pre-read boyut
sınırı doğrulandı. Guest dilimi de yalnız p2, guest kimliği, sentetik loopback
auth, E01–E10 direct-feed, 120 saniye Claude sınırı, ham debug/output,
fail-closed finalization/export ve `authority=false` ile tamamlandı. Gelecek
export içindeki exact `guest-auth.json` yolu lifecycle tarafından güvenle
ertelenebiliyor; başka eksik auth yolu başlamadan reddediliyor. Host giriş
noktası yalnız `node host/w1b-live-runner.mjs --plan <absolute-json-path>`
biçimini kabul ediyor. İlgili hedef testler ve 199/199 tam regresyon geçti.

Bu yetki verilse bile Sandbox başlatılmaz, host ayarı değiştirilmez, payload
kurulmaz ve canlı komut çalıştırılmaz.

## 4. Yetki B — tek canlı W1b kampanyası

Önerilen karar kimliği: `W1B-LIVE-EXECUTION`. Yetki A tamamlanıp kaynak hash'i,
test sonucu, kesin payload/export yolları ve tam komut allowlist'i kullanıcıya
gösterilmeden Yetki B istenmez.

Yetki B'nin azami kapsamı:

- en fazla bir owned Windows Sandbox kimliği;
- mevcut başka Sandbox görülürse start yok;
- VGPU/network/clipboard/audio/video/printer kapalı, ProtectedClient açık;
- payload read-only, yalnız yeni export kökü writable;
- dış ağ yok, gerçek credential/auth/secret yok;
- yalnız hedefli O1/O4/O7 + D/E korelasyonu; eski P1–P6 tekrarı yok;
- export bekleme üst sınırı 4 dakika;
- sonuçtan bağımsız exact owned-ID stop girişimi ve son `wsb list --raw`;
- başka Sandbox durdurulmaz; Hyper-V/VM/NIC/VHDX veya host güvenlik ayarı yok;
- kanıt korunur, otomatik silme yapılmaz.

## 5. Fail-closed durma koşulları

Aşağıdakilerden biri görülürse start yapılmaz veya başlamış owned Sandbox için
cleanup'a geçilir:

- beklenmeyen repo/paket/payload/manifest drift'i;
- binary/package/alias/hash kimliği değişimi;
- mevcut output/export yolu veya reparse/symlink;
- başlangıç envanterinin boş olduğunun current-user görünümünde kanıtlanamaması;
- config allowlist dışı özellik veya writable üçüncü mapping;
- gerçek/bilinmeyen auth kaynağı;
- spawn, nonzero exit, timeout, stdout/stderr overflow veya bozuk JSON;
- owned Sandbox ID uyuşmazlığı;
- export marker/manifest/hash/result/provenance çelişkisi;
- cleanup veya son envanterin doğrulanamaması.

Hiçbir hata kaydı silinmez veya PASS olarak yeniden adlandırılmaz.

## 6. Kanıt paketi ve kabul sınırı

Tek paket şunları içerir:

- kaynak ve runtime hash envanteri;
- başlangıç/final raw inventory ve SHA-256;
- altı lifecycle fazının ayrı stdout/stderr/exit/timeout kayıtları;
- guest auth provenance ve finalized `result.json`;
- export manifest/completion doğrulaması;
- cleanup sonucu;
- ölçüt→kanıt→hash eşlemeli `EVIDENCE-INDEX.json`.

Başarılı teknik koşu yalnız `OFFLINE_CONSISTENT_UNATTESTED` veya yeni canlı
gözlem sınıfını üretebilir; kendi başına `REVIEW_VERIFIED`, K2-05-F kabulü veya
authority değildir. Bağımsız inceleme W3'te ayrıca yapılır.

## 7. Gerekli kullanıcı kararı

İlk ve ikinci **Yetki B** koşuları fail-closed tamamlandı. ProcessStartInfo
düzeltmesi sonrası üçüncü ayrı yetkili koşu
`OFFLINE_CONSISTENT_UNATTESTED` tamamlandı. Üç yetki de tüketildi; ayrıntılar
`docs/W1B-LIVE-RUN-2026-11-11.md`,
`docs/W1B-LIVE-RUN-R2-2026-11-11.md` ve
`docs/W1B-LIVE-RUN-R3-2026-11-11.md`. Yeni canlı tekrar planlanmamıştır;
sıradaki kapı değişmez kanıt paketinin bağımsız incelemesidir.
Açık karar örneği:

> `W1B-LIVE-EXECUTION` kapsamında bu belgede sınırlandırılmış tek canlı W1b
> kampanyasına izin veriyorum.

Bu karar örneği tarihsel kapsam kaydıdır ve yeni bir koşuya yetki vermez. Yeni
bir canlı tekrar ayrıca açık karar olmadan başlatılmaz. Kaynak tamamlanması veya
R3 teknik başarısı güvenlik kabulü sayılmaz.

Değişmeyen statüler: `K2-05-C UNVERIFIED`, `K2-05-F NOT_ACCEPTED`,
`K2 NOT VERIFIED`, `K3/K4 BLOCKED`, `AUTHORITY.implemented=false`.
