# mocks/ — loopback-only "Anthropic Messages API compatible" mock fixture

Bu klasördeki `mock-endpoint.mjs`, O2/O4/O5 gözlemleri için deterministik,
sentetik bir HTTP fixture'ıdır.

**claude.exe'ye hiçbir çağrı yapılmamıştır.** Bu dosyanın yalnız kendi
`--self-test` harness'i (loopback üzerinde kendi kendine HTTP istekleri
göndererek kendi sözleşmesini doğrular) çalıştırılmıştır — sonuç: **8/8
PASS**. Hedef `claude.exe 2.1.312` ile protokol uyumluluğu **NOT
TESTED**'dir; bu, gelecekteki yetkili bir sandbox koşusunun konusudur.

## Protokol (Task 14, bölüm C)
- Hedef protokol açıkça **"Anthropic Messages API compatible test
  fixture"** olarak tanımlanır: `POST /v1/messages` ve Claude Code
  2.1.319.0'ın kullandığı allowlist'li `POST /v1/messages?beta=true`, JSON
  gövde/yanıt. Başka query, method veya path kabul edilmez.
- Yanıt şekli gerçek Messages API'nin bir `tool_use` içerik bloğuna ve
  uygun `stop_reason`'a benzer (bkz. `buildMessagesApiResponse`).
- Eski "üst düzey `tool_name` alanı" formatı **kaldırılmıştır**. Hangi
  tool (`Write`/`Edit`/`Bash`/`PowerShell`) döneceği istekten
  **tahmin edilmez** — sunucu başlatılırken `--scenario` ile açıkça
  seçilir.

## Zorunlu özellikler (kodda sabit, kaldırılamaz)
- Yalnız `127.0.0.1` (loopback) — sabit kodlanmış.
- **`listen()` öncesi** evidence dizini/log dosyası yazılabilirlik
  kontrolü (`checkEvidenceWritable`); başarısızsa süreç `listen()`
  çağrılmadan çıkış kodu != 0 ile sonlanır.
- Log yazma hatası runtime'da **exception** fırlatır; bu durumda HTTP
  200 / başarılı tool-use yanıtı **asla** verilmez (500 döner).
- İstek gövdesine açık bir boyut sınırı: **64 KiB** (`MAX_BODY_BYTES`).
- Yalnız `POST /v1/messages`, `application/json`; başka method/path/
  content-type **reddedilir**.
- Yalnız loopback istemcisi kabul edilir (`remoteAddress` kontrolü).
- Auth: yalnız dokümante edilmiş, açıkça sahte bir sentinel
  (`SYNTHETIC_AUTH_SENTINEL`) kabul edilir; farklı bir değer gelirse
  reddedilir ve **değeri loglanmaz** (yalnız `sentinel_mismatch: true`).
- Header ve gövde logları redakte edilir.
- `evidence_kind` her kayıtta `"MOCK_ENDPOINT"`dir; `"LIVE_REAL_MODEL"`
  etiketi hiçbir yerde kullanılmaz.

## Yerel self-test (claude.exe çağırmaz; C:\evidence'a DOKUNMAZ)
```
node mock-endpoint.mjs --self-test
```
8 senaryo: geçerli istek → tek `tool_use`, ardından `tool_result` →
terminal `end_turn`; yanlış path; yanlış method;
büyük body; geçersiz JSON; yanlış auth; log yazılamıyor (başlangıç
reddi); loopback-dışı adres (fonksiyon testi). **Bu self-test yalnız bu
dosyanın kendi HTTP sözleşmesini doğrular — `claude.exe` uyumluluğunun
kanıtı değildir.**

**Kanıt yolu ayrımı (Task 14B, bölüm 1):** `--self-test` hiçbir koşulda
gerçek `C:\evidence`'ı kullanmaz veya ona dokunmaz. `startServer` ve log
fonksiyonları (`appendLogOrThrow`, `handleRequest`) artık kanıt
dizini/log yolunu **parametre** olarak alır; normal (self-test dışı)
çalıştırmada varsayılan yol `C:\evidence` olarak **kalır** (geriye
dönük uyumluluk). Self-test, sistem **temp dizini** altında
(`fs.mkdtempSync`) kendine ait, benzersiz, tek-seferlik bir dizin
oluşturur, sahte sunucuyu o dizine karşı çalıştırır, ve testlerin
sonunda iki ek sonuç satırı daha üretir:
- `C:\evidence self-test sirasinda OLUSTURULMADI/DEGISTIRILMEDI` —
  çalışma öncesi/sonrası salt-okunur envanter karşılaştırmasıyla
  kanıtlanır (yazma YOK, yalnız okuma).
- `cleanup: ...` — self-test, **containment doğrulamasından sonra**,
  **sadece kendi oluşturduğu kesin temp dizinini** siler; kullanıcıya
  veya başka bir koşuya ait temp dizinine asla dokunulmaz. Cleanup
  başarısız olursa bu gizlenmez, sonuç satırında `FAIL` olarak
  raporlanır.

Bu iki ek kontrol, standart `8/8 PASS` HTTP-sözleşme sonucuna **ek
olarak** raporlanır (toplamda self-test çıkış kodu, 8 sözleşme
testinden herhangi biri, evidence-untouched kontrolü veya cleanup
herhangi biri başarısız olursa != 0 olur).

## Kullanım kapsamı
Bu fixture yalnız `evidence-schema.json`'daki `MOCK_ENDPOINT` kanıt türü
için tasarlanmıştır. `ACCEPTANCE-CRITERIA.md`'de belirtildiği gibi, bu
fixture ile üretilen hiçbir sonuç `ENFORCEMENT_MOCK_ENDPOINT`'ten daha
yüksek bir `max_claim` alamaz.
