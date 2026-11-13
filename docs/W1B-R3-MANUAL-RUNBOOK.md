# W1b R3 — Manuel ve Gözlenebilir Canlı Retest Runbook

Durum: **EXECUTED — TECHNICAL SUCCESS, REVIEW REQUIRED**  
Tarih: 2026-11-11

Bu runbook, üçüncü canlı retest'i görünür bir PowerShell penceresinde kullanıcı
tarafından başlatmak içindir. Manuel başlatma güvenlik kontrollerini kaldırmaz:
aynı bounded plan, payload hash kontrolü, preflight, exact owned Sandbox ID,
timeout, cleanup ve final inventory zinciri çalışır.

## 1. Kaynak kapısı

- Regresyon: `200/200 PASS`, skipped `0`.
- Paket kontrolü: `109/109 PASS`.
- Paket bütünlüğü: `66/66 PASS`.
- `MANIFEST.sha256.json` SHA-256:
  `A5A86F9B6D3F8DBC6C01CC36BC25D49E7EE5FB2230826F1D248E48E864F60941`.
- Claude process capture: owned `.NET ProcessStartInfo`, async stdout/stderr,
  120 saniye timeout, timeout halinde de stream ve debug koruması.

Bu değerlerden biri değişirse R3 hazırlanmaz; önce drift incelenir.

## 2. R3 hazırlığı

Yeni açık yetki alındıktan sonra tek kullanımlık yeni run ID, owned Sandbox GUID
ve yeni dış `payload/export/report/plan` kökü üretilir. R1 veya R2 yolları tekrar
kullanılmaz. Payload tam olarak 18 dosya olmalı; 16 kanonik kaynak ve iki pinned
runtime hash'i start öncesi doğrulanmalıdır.

Hazırlık tamamlandığında kullanıcıya şu dört değer gösterilir:

1. run ID ve owned Sandbox ID;
2. plan dosyasının mutlak yolu ve SHA-256'sı;
3. `validatePayload`: `file_count=18`, `source_count=16`, `runtime_count=2`;
4. boş export ve mevcut olmayan report kontrolü.

## 3. Kullanıcının görünür PowerShell adımı

Kullanıcı yeni bir PowerShell penceresinde yalnız aşağıdaki biçimi çalıştırır:

```powershell
Set-Location -LiteralPath 'C:\Projeler\7allab-engineering-office\test\security-pilot'
node .\host\w1b-live-runner.mjs --plan '<R3_PLAN_MUTLAK_YOLU>'
$LASTEXITCODE
```

Plan yolu hazırlık sonrasında gerçek değerle değiştirilir. Ek argüman, farklı
policy, elle `wsb start/connect/stop`, başka Sandbox ID veya eski export yolu
kullanılmaz. Pencere `W1B_CAMPAIGN=...` satırı ve exit code görünene kadar
kapatılmaz.

## 4. Beklenen terminal sonuçları

- Teknik olarak tutarlı sonuç:
  `W1B_CAMPAIGN=OFFLINE_CONSISTENT_UNATTESTED`, exit `0`.
- Her `FAIL_CLOSED` veya `INCONCLUSIVE`: exit `1`; otomatik tekrar yok.
- Altı dakikayı aşan veya konsolu kapanan koşu başarı sayılmaz. Yeni komut
  çalıştırılmadan owned ID ve current-user inventory salt okunur incelenir;
  gerekiyorsa yalnız aynı açık yetki kapsamındaki exact owned-ID cleanup yapılır.

`OFFLINE_CONSISTENT_UNATTESTED` dahi K2 kabulü veya authority değildir.

## 5. Koşu sonrası zorunlu kontroller

1. Altı lifecycle fazının ayrı exit/timeout/stdout/stderr kayıtları.
2. Export manifest/completion doğrulaması ve finalized guest result.
3. Host/guest auth provenance hash eşitliği.
4. Direct-feed E01–E10 sonucu ve managed Write gözlemi.
5. Owned Sandbox yokluğu ve final raw `wsb list --raw`.
6. Yeni hash-only `EVIDENCE-INDEX.json`.
7. Bağımsız review öncesi statüler değişmeden sonuç raporu.

Değişmeyen statüler: `K2-05-C UNVERIFIED`, `K2-05-F NOT_ACCEPTED`,
`K2 NOT VERIFIED`, `K3/K4 BLOCKED`, `AUTHORITY.implemented=false`.

## 6. Yürütme kaydı

Runbook, `k205c-w1b-r3-20261111-100828-40f60311` koşusunda uygulanmıştır.
Sonuç `OFFLINE_CONSISTENT_UNATTESTED`; ayrıntılar ve kanıt hash'leri
`docs/W1B-LIVE-RUN-R3-2026-11-11.md` içindedir. Bu runbook yeni bir koşu için
yeniden kullanılmaz; yeni canlı tekrar ayrıca açık yetki gerektirir.
