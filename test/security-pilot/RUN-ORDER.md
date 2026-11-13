# Politika Koşu Sırası (p1→p6) — hazırlık planı

Bu belge, `policies/` altındaki 6 test policy'sinin hangi sırayla ve
hangi kayıt alanlarıyla koşulacağını tanımlar. **Bu görevde hiçbir
koşu gerçekleştirilmemiştir.**

## Zorunlu ilke: her policy TAZE bir sandbox örneğinde

Her policy (`p1`...`p6`) **ayrı, taze (sıfırdan başlatılmış)** bir
Windows Sandbox örneğinde koşulmalıdır. Önceki policy'nin kalıntı
durumu (process, dosya, log) bir sonraki koşuya asla taşınmamalıdır —
sandbox'ın kendisi geçici olduğundan bu doğal olarak sağlanır, ancak
export edilen kanıtların da policy bazında ayrı tutulması gerekir (bkz.
aşağıdaki run-kaydı alanları).

## P1 semantik düzeltmesi (Task 15, 2026-11-09)

**`p1`, "managed ayar bulunmayan baseline" DEĞİLDİR.** Bu, önceki bir
revizyonun hatalı tanımıydı; `policies/p1-baseline.test.json`'ın gerçek
içeriği bunu doğrular (PreToolUse + PermissionRequest altında managed
hook girdileri tanımlıdır, `onFailure: "block"` dahil).

**Doğru tanım:** `p1`, managed settings üzerinden hook'ların
**yüklendiği**, fakat `allowManagedHooksOnly` anahtarının
**bulunmadığı** managed-hook baseline'ıdır.

Ayrım:
- **p1**: managed hooks var, `allowManagedHooksOnly` **yok**.
- **p2**: aynı managed-hook temelinin üzerine `allowManagedHooksOnly: true`.
- **O1**: managed settings'in **yüklenmesi**.
- **O2**: managed hook'un **çağrılması**.
- **O3**: p1/p2 arasındaki sentetik plugin farkı.

**P1 smoke test bu görevde (Task 15) henüz YAPILMAMIŞTIR.** Yukarıdaki
tanım yalnız bir semantik düzeltmedir; hiçbir sandbox koşusu, hiçbir
managed settings kurulumu, hiçbir `claude.exe` çalıştırması bu görevde
gerçekleşmemiştir.

## Sıra

| # | Policy | Amaç | İlgili gözlem(ler) |
|---|---|---|---|
| 1 | `p1-baseline` | Managed hooks yüklü, `allowManagedHooksOnly` YOK; O1/O2 referans davranışı | O1, O2, O3 (baseline) |
| 2 | `p2-managed-hooks-only` | Aynı managed-hook temeli + `allowManagedHooksOnly: true` | O1, O3 (karşılaştırma) |
| 3 | `p3-missing-command` | Hook komutu kasıtlı eksik/geçersiz | O5 |
| 4 | `p4-handler-error` | Hook betiği kasıtlı hata fırlatır | O5 |
| 5 | `p5-timeout` | Hook kasıtlı olarak zaman aşımına uğrar | O5 |
| 6 | `p6-control` | Kontrol — `onFailure` alanı YOK | O5 (negatif kontrol) |

## Her koşu için zorunlu kayıt alanları

Her koşu, `evidence-template.json`'ın bir kopyası olarak şu ek alanlarla
kaydedilmelidir:

- **`run_id`**: benzersiz tanımlayıcı (ör. `YYYYMMDD-HHMMSS-pN`)
- **`export_dir`**: o koşuya özel benzersiz export dizini (bkz.
  `EXPORT-DESIGN.md`) — başka hiçbir koşuyla paylaşılmaz
- **`policy_file` / `policy_sha256`**: koşulan policy dosyasının adı ve
  hash'i
- **`runtime_hashes`**: o koşuda kullanılan `node.exe`/`claude.exe`
  için `RUNTIME-PINNING.md`'deki tüm zorunlu alanlar
- **`auth_mode`**: koşu-düzeyi `NONE` / `MOCK_ENDPOINT` / `REAL`; hiçbir
  zaman `evidence_kind` alanından türetilmez
- **`auth_provenance`**: kullanılan credential türü, endpoint türü, provenance
  kaynağı ve bu kaynağın SHA-256'sı; `MOCK_ENDPOINT` için sentetik sentinel ve
  loopback endpoint ayrı ayrı kaydedilir
- **`raw_log_list`**: o koşuda üretilen ham log dosyalarının tam listesi
  (ör. `C:\evidence\mock-endpoint.jsonl`, `C:\evidence\o3-marker.log`,
  managed-settings startup log satırları)

## Sıralamanın gerekçesi

- p1 önce gelir çünkü diğer tüm karşılaştırmalar (p2, p6) ona göre
  yapılır.
- p2, p1 ile doğrudan karşılaştırılacağı için hemen ardından gelir.
- p3→p5, O5'in üç ayrı arıza modunu izole bir şekilde test eder —
  aralarına p6 (kontrol) konulması karşılaştırmayı bulandırabileceğinden
  en sona bırakılmıştır.
- p6, "fark" ölçümünün paydası olduğu için en sonda — p3/p4/p5
  sonuçlarının her biri ayrı ayrı p6 ile karşılaştırılır.

## Bu görevin kapsamı

Bu belge yalnız bir **plandır**. Hiçbir `run_id` üretilmemiş, hiçbir
sandbox başlatılmamış, hiçbir export dizini oluşturulmamıştır.

## 2026-11-10 tarihsel koşular için uyumluluk notu

P1–P6'nın `7allab-k205c-sandbox-run/0.1` sonuçları değişmez kanıttır ve
geriye dönük düzenlenmez. Bu altı sonuçta `auth_mode`/`auth_provenance`
bulunmadığından O7 bakımından `INCONCLUSIVE` kalırlar. Ayrı, hash-bağlı bir
provenance eki runner ortamını açıklayabilir; ancak özgün `result.json`
dosyalarını şema-uyumlu hâle getirmez veya kabul statüsü üretmez.
