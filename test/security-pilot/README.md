# Security Pilot — izole Windows Sandbox test paketi (K2-03-D)

Durum: **hazırlık paketi. K2 NOT VERIFIED.** Hiçbir şey kurulmadı, hiçbir test canlı çalıştırılmadı.
Paket yalnızca bütünlük ve sentaks açısından denetlenir: `node test/security-pilot/check-package.mjs`
(`--self-test` kontrolleri aynı çalıştırmanın içindedir; `--write-manifest` yalnız paket değişince kullanılır).

## İçerik
- `sandbox/pilot.wsb.draft.xml` — taslak (`.wsb` değil): ağ, pano, vGPU, ses/video/yazıcı kapalı; tek salt-okunur `C:\payload` eşlemesi; yazılabilir eşleme yok.
- `sandbox/inside-sandbox-setup.ps1` — yalnız sandbox içinde çalışır (`WDAGUtilityAccount` değilse reddeder); seçilen test politikasını sandbox'ın kendi `C:\Program Files\ClaudeCode` dizinine koyar.
- `policies/p1..p6*.test.json` — örnek managed test politikaları; hook girdileri exec formunda (`command` + `args`), `onFailure` hook girdisinin içinde, PermissionRequest yalnız p1/p2 (p1 temel, p2 `allowManagedHooksOnly`, p3 eksik betik, p4 hata, p5 timeout, p6 `onFailure`'sız kontrol).
- `hooks/` — işaretleyici/hata/timeout probe betikleri (yalnız sandbox içi `C:\evidence` altına yazar).
- `fixtures/events.json` — guard'a doğrudan beslenecek deterministik girdiler. `expect` değerleri kod okumasından türetildi, **NOT TESTED**.
- `evidence-schema.json`, `evidence-template.json` — O1–O7 gözlemleri için beklenen/gözlenen kanıt şeması.
- `payload-manifest.json` — hazırlanacak salt-okunur yük (mevcut guard/adapter/gate SHA-256 ile sabitlenmiş) ve sahibin sağlaması gerekenler (`node.exe`, `claude.exe`).
- `MANIFEST.sha256.json` — paket dosyalarının bütünlük özeti (test sonucu değildir).

## Kurallar
- Politikanın **yüklenmesi** enforcement PASS değildir (O1 en fazla `LOADED`).
- Doğrudan besleme (`DIRECT_FEED`) ve sahte uç nokta (`MOCK_ENDPOINT`) gerçek model testi sayılmaz.
- `onFailure` alanının hook girdisindeki yeri bu paketin varsayımıdır (UNVERIFIED); şema reddi de kayıt altına alınacak bir sonuçtur.
- O6 için "bilinen managed-hook yükleme problemi"nin tanımı pakete verilmedi: belirti UNKNOWN.
- Kanıt dışa aktarımı **tanımlı değil**; kanıt sandbox içinde `C:\evidence` altında kalır. Yazılabilir eşleme veya başka yöntem sahibin ayrı kararıdır.

## Ayrıcalıksız hesap pilotu önkoşulları (karar değil, gereksinim)
1. Ayrı yerel **standart** kullanıcı (yönetici grubunda değil); yalnızca günlük Director yürütmesi için.
2. Managed policy, guard, adapter ve yetki defteri **yönetici-yazılabilir, standart-kullanıcı-salt-okunur** bir konumda (örn. `C:\Program Files\ClaudeCode` ve ayrı bir yönetici dizini); depo içinde değil.
3. Standart kullanıcıya yalnızca kendi **ayrı çalışma kopyasında** değiştirme izni; mevcut kullanıcının deposu/izlenmeyen dosyaları pilot hesabına açılmaz.
4. Ayrı Claude profili (`CLAUDE_CONFIG_DIR` veya hesabın kendi profili) ve ayrı kimlik bilgisi; mevcut kullanıcı profili/oturumu kopyalanmaz.
5. Rollback: policy dosyası ve guard için bilinen-iyi kopya + SHA-256; kurtarma yönetici hesabıyla policy dosyasını silmek/geri koymaktır. Politika makine geneli olduğundan mevcut kullanıcının hook'larını da etkiler — önce sandbox'ta gözlenmeli.
