# o3-marker-plugin — O3 için sentetik, yalnız-marker plugin fixture'ı

Task 16 P1 koşusunda plugin yüklendi ve `SessionStart` çağrıldı; ilk çağrı,
temiz sandbox `PATH`'inde `node` bulunmadığı için başlayamadı. Hook komutu bu
nedenle payload manifestinde zaten hash/sürüm pinlenen
`C:\payload\bin\node.exe` yoluna sabitlenmiştir.

## Resmî dizin yapısı (Task 14, bölüm D düzeltmesi)

Önceki sürüm (Task 13), manifest/hooks/script'i hatalı şekilde tek bir
`plugin.json` dosyasında birleştirmişti. Bu, **resmî yapıya
uymuyordu**. Task 14'te, resmî dokümana göre düzeltildi:

| Dosya | Resmî konum | Kaynak |
|---|---|---|
| Manifest | `.claude-plugin/plugin.json` (yalnız `name`/`description`/`version`/`author`) | `code.claude.com/docs/en/plugins/create.md`, "Write the manifest" — erişim: 2026-11-08 |
| Hook config | `hooks/hooks.json`, üst düzey `"hooks"` anahtarı, settings.json'daki `hooks` ile aynı şekil | aynı sayfa, "Plugin layout" tablosu — erişim: 2026-11-08 |
| Hook betiği | `scripts/marker.mjs` | `scripts/` konvansiyon (resmî zorunluluk değil, dokümandaki örnekle aynı) |

Task 16 debug kaydı, `args` dizisindeki `${CLAUDE_PLUGIN_ROOT}` değişkeninin
tam plugin yoluna genişletildiğini doğrulamıştır. Aynı kayıt, yalın `node`
komutunun `PATH` üzerinden bulunamadığını da göstermiştir.

## Ne işe yarar
`allowManagedHooksOnly` policy ayarının (p2) mevcut plugin hook'larına
etkisini, bu sentetik fixture ile p1 (baseline, bu ayar yok) karşısında
gözlemlemek için kullanılır. `--plugin-dir` ile sandbox'a yüklenmesi
öngörülür (gerçek kullanıcı profili kopyalanmaz). Marker `SessionStart`
olayında çalışır; böylece aynı `PreToolUse` olayındaki managed guard reddi
plugin fixture'ını kısa devre edemez.

## Ne DEĞİLDİR
- Gerçek kullanıcı plugin'i değildir.
- `%USERPROFILE%\.claude` içeriğinden kopyalanmamıştır.
- ponytail, sage veya başka bir gerçek profil plugin'inden türetilmemiştir.
- Hiçbir enforcement/engelleme davranışı yoktur — yalnız bir marker satırı
  yazar.

## Fail-closed marker davranışı (Task 14 düzeltmesi)
`scripts/marker.mjs`, marker yazımı başarısız olursa **artık sessizce
exit 0 döndürmez** — `exit 1` ile sonlanır ve mümkünse bir
`o3-marker.error.log` kaydı bırakır. Böylece dışarıdaki gözlemci,
"hook hiç çalışmadı" ile "hook çalıştı ama marker yazılamadı"
durumlarını ayırt edebilir; ikincisi O3'ü `FAIL`/`INCONCLUSIVE` olarak
sınıflandırmalıdır, sessizce başarılı gibi görünmemelidir.

## Sınıflandırma kuralı
Beklenen yön (p1'de çalışır/p2'de çalışmaz veya tersi) bu fixture'da veya
`evidence-template.json`'da **hard-code edilmemiştir**. Sonuç yalnız şu
gözlenebilir sinyallerden çıkarılır:
1. `C:\evidence\o3-marker.log`'daki satır sayısı/varlığı,
2. `C:\evidence\o3-marker.error.log`'un varlığı (marker yazma hatası),
3. hook'un exit kodu,
4. `claude.exe` başlangıç logundaki "Registered N hooks from M plugins" satırı,
5. Startup log'daki plugin-yükleme hata/uyarı mesajları.

## Önemli uyarı
`claude plugin validate` ile bu fixture'ın resmî şemaya tam uyumu bu
görevde **doğrulanmamıştır** (`UNVERIFIED`) — yalnız dokümanda okunan
dizin/alan yapısına göre düzenlenmiştir. Gerçek bir sandbox koşusunda bu
fixture'ın hiç kaydolmaması da olası bir sonuçtur ve bu `FAIL` değil,
fixture'ın kendisinin düzeltilmesi gereken bir bulgu olarak kayıt altına
alınmalıdır — O3'ün kendisi bu durumda `INCONCLUSIVE` kalır.
