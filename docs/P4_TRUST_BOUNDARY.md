# P4B — Trusted Boundary Adapter (prototip)

Durum: **PROTOTİP, SENTETİK TESTLİ, KURULMAMIŞ.** `operational: false`. Hook kurulmadı, yetki defteri yok, uzman ajan yok.
Bu belge Engineering Office'i VERIFIED_OPERATIONAL ilan etmez.

Dosyalar: `scripts/decision-gate-event-adapter.mjs`, `test/decision-gate-event-adapter.test.mjs`. Decision Gate dosyalarına dokunulmadı;
adapter yalnız sözlük sabitlerini (`TASK_STATES`, `RISKS`, `CLASSES`, `AUTH_STATES`) içe aktarır, `validateDecision` kullanmaz.

## Üç giriş

| Giriş | Kaynak | Adapter'daki muamele |
| --- | --- | --- |
| MODEL_DECISION | Director çıktısı, güvenilmez | Yalnız yapısal okunur (`assessModelDecision`); `accepted_as_authority` her zaman `false`. `origin`, `trust`, `authorized_human`, `approved`, `permission_mode` gibi etiketler her derinlikte raporlanır ve yok sayılır. |
| HOST_EVENT | Claude Code hook JSON'u | Şekli doğrulanır (`checkHostEvent`); **kaynağın gerçekliği doğrulanmaz** (aşağıya bak). Bilinmeyen ek alanlar yok sayılır, yetki sayılmaz. |
| TRUSTED_AUTHORITY | Model dışı yetki defteri / insan onayı | **UYGULANMADI** (`AUTHORITY.implemented === false`). Sonuç: her yürütme talebi DENY. |

## Resmî sözleşmeden doğrulanan alanlar (code.claude.com/docs/en/hooks, bu oturumda okundu)

- Ortak: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `agent_id`/`agent_type` (alt ajan içinde).
- PreToolUse: `tool_name`, `tool_input`, `tool_use_id`. Karar `hookSpecificOutput.permissionDecision` ∈ allow|deny|ask|defer. Exit 2 engeller; exit 0 ve çıktısız = karar yok (normal izin akışı). Exit 1 ve diğer kodlar **engellemez**. Deny/ask kuralları hook ne dönerse dönsün yine değerlendirilir. Birden çok hook: deny > defer > ask > allow.
- PermissionRequest: `tool_name`, `tool_input` (`tool_use_id` yok); çıktı `hookSpecificOutput.decision.behavior` allow|deny; **exit 2 bu olayda dikkate alınmaz**, bu yüzden adapter deny'ı JSON ile verir.
- SubagentStart: `agent_id`, `agent_type`; **engelleyemez**. SubagentStop: `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`; `decision: "block"` ile alt ajanı sürdürebilir (adapter bunu kullanmaz).
- `Write`/`Edit`/`Read` için `tool_input.file_path` mutlak; `Write`: `file_path`, `content`; `Edit`: `file_path`, `old_string`, `new_string`, `replace_all`; `Bash`/`PowerShell`: `command`, `description`, `timeout`, `run_in_background`.
- Başarısızlık: çökme, geçersiz JSON veya exit 0/2 dışı çıkış varsayılan olarak **fail-open**; `"onFailure": "block"` bunu engeller (sürüm numarası olarak okunan `v2.1.295+` bu oturumda yalnız dokümandan alındı, bağımsız doğrulanmadı). `if` filtreleri en-iyi-çaba, kesin kural için izin sistemi gerekir.

Okunmayan kısım: sayfanın son ~82 bin karakteri (offset 200000 sonrası) okunmadı; orada ek olay alanları olabilir. Kullanılmayan alanlar hakkında iddia yoktur.

## Uygulanan teknik sınırlar (testle ölçüldü)

1. **Allow üretilmez.** Disposition kümesi: DENY, ASK, NO_OPINION, OBSERVE. Hiçbir yanıt `allow`, `approve` veya `updatedInput` içermez (10 binden fazla üretilmiş olayla özellik testi).
2. **Yürütme talepleri DENY:** Bash, PowerShell, Write, Edit, NotebookEdit, Agent, WebFetch, WebSearch, `mcp__*`, sınıflandırılmamış her araç. Etiketler (Git stage/commit/push, harici aktarım, paket kurulumu, yıkıcı işlem, başka repo, çözülemeyen yol) yalnız gerekçeyi bilgilendirir; karar etiketten bağımsız DENY'dır.
3. **Salt-okunur araçlar** (Read, Glob, Grep): `file_path`, `notebook_path`, `path` alanlarının **hepsi** (ve Glob/Grep için cwd) kanıtlanabilir biçimde proje kökünde ise ve Glob `pattern` / Grep `glob` mutlak, sürücü harfli, `..` içeren veya string olmayan değilse NO_OPINION (allow değil); aksi halde ASK. (Bağımsız incelemenin Y1/Y2 bulgusu: yedek bir yol alanı gerçek hedefi gizleyebiliyordu; düzeltildi ve testlendi.)
4. **Yol sınırı** (Windows ve POSIX): `..`, önek hilesi (`...-evil`), UNC, `\\?\`, `\\.\`, NTFS alternatif veri akışı, 8.3 kısa adlar, sonda nokta/boşluk, kontrol/sıfır genişlikli/uyumluluk karakterleri, göreli yol, kök yoksa her şey "belirsiz" sayılır; belirsiz asla "içeride" değildir.
5. **Hatalı olay** (şekil, tip, mutlak olmayan cwd, eksik alan, bozuk JSON, boş stdin, adapter istisnası) DENY; CLI exit 2. Sınır: olay adı çözümlenemeyen girdide (bozuk/boş JSON) yalnız exit 2 verilir; bu PreToolUse'da engeller ama PermissionRequest'te exit 2 dikkate alınmadığından orada karar verilmemiş sayılır ve normal izin diyaloğu çıkar. CLI başındaki UTF-8 BOM'u soyar.
6. **Alt ajan olayları yalnız gözlemdir.** SubagentStart/Stop ne ROLE_SELECTED yetkisi ne REVIEW_VERIFIED kanıtıdır; `last_assistant_message` model çıktısıdır. Modelin `review_*` iddiaları her zaman `REVIEW_UNBACKED`, eşleşen SubagentStart olmayan `agent_dispatched` iddiası `DISPATCH_UNOBSERVED` raporlanır. Gözlenen bir başlatma bile yetki değildir.
7. **Bağımsızlık:** kaynakta yazma/ağ/süreç yeteneği yok (yalnız `node:fs` `readFileSync`, `node:path`, `node:url`, kapı sözlüğü); test bunu statik olarak denetler.

## Teknik olarak UYGULANMAYAN / bilinen sınırlar

- **HOST_EVENT kaynağı doğrulanmaz.** Hook stdin'ine yazabilen herhangi bir yerel süreç olay uydurabilir; `transcript_path` ve `agent_*` alanları bağımsız doğrulanmaz. Güven, Claude Code'un hook'u kendisinin çalıştırmasına dayanır.
- **TRUSTED_AUTHORITY yok.** İmzalı/model dışı yetki defteri, kullanıcı onayı kanalı, gerçek reviewer kimliği, `implementer_id`, `operation_kinds`, `data_subjects` kaynağı yoktur. Bu yüzden ADIM 52'deki sentetik MVP'nin "trusted_fixture" etiketleri gerçek kanıta çevrilmedi; adapter onları kullanmaz.
- **Hook kurulu değil.** Kurulursa: hook çökmesi varsayılan olarak fail-open'dır; `"onFailure": "block"` gerekir ve kurulu Claude Code sürümünde desteklendiği **doğrulanmadı (NOT TESTED)**. Ayrıca deny kuralları ve izin kipleri hook'tan bağımsız çalışır; hook tek başına yeterli bir sınır değildir.
- **Komut sınıflandırması sezgiseldir** (regex). Etiketler yanlış/eksik olabilir; karar buna bağlı olmadığı için güvenlik etkisi yok, ama gerekçe metni eksik kalabilir. Kabuk komutu içinden yol çıkarımı yapılmaz.
- **NO_OPINION/ASK tam koruma değildir:** okuma araçları için normal izin akışı geçerlidir; hassas dosya adı (ör. `.env`) ayrımı yapılmaz.
- **Symlink/junction çözülmez:** `pathRelation` yalnız sözdizimseldir; proje içindeki bir bağlantı dışarıyı gösteriyorsa Read NO_OPINION olur. DOS aygıt adları (`CON`, `nul.txt`) içeride sayılır. Kök yapılandırması `..` içeriyorsa normalize edilir; kök `C:` ise her şey içeride sayılır (yapılandırma sorumluluğu).
- **Şema gevşeklikleri (düşük):** `permission_mode`, `transcript_path`, `stop_hook_active` tipi doğrulanmaz; `cwd` POSIX biçimli olabilir. `ExitPlanMode` ve `AskUserQuestion` NO_OPINION döner (yürütme değil).
- **Bağımsızlık testi sezgiseldir:** metin taramasıdır, sandbox değildir.
- **Durumsuz:** `observed` olayları çağıran verir; adapter oturum durumu tutmaz, gerçek zamanlı olay akışına bağlı değildir.
- **Canlı Claude Code olayıyla test edilmedi.** Tüm testler elle yazılmış, resmî belgeye göre kurulmuş sentetik olaylardır; bu canlı veya bağımsız kanıt değildir (NOT TESTED: gerçek hook çağrısı, Windows'ta gerçek stdin kodlaması/BOM, zaman aşımı).

## P5 öncesi eksik entegrasyonlar

1. Model dışı yetki defteri (grant/revoke, imza/bütünlük) ve kullanıcı onayı kanalı.
2. Hook kurulumu için ayrı yetki; `onFailure: block` sürüm doğrulaması; gerçek olayla uçtan uca test.
3. Reviewer ve implementer kimliğinin harness kaynaklı bağlanması.
4. Adapter çıktısının Decision Gate bağlamına, model yazımı olmayan kayıtlarla bağlanması.

## Bağımsız inceleme (ADIM 53)

Salt-okunur alt ajan incelemesi (aynı model ailesi; insan onayı veya REVIEW_VERIFIED değildir): execution araçlarında allow üreten girdi bulunamadı. Bulgular: Y1/Y2 (read-only ASK atlaması) düzeltildi; O1 (symlink), O2 (PermissionRequest + bozuk stdin), O4 (sürüm), O5 (bağımsızlık testi sezgisel) ve D1–D4 belgelendi; O3 (BOM) kodla giderildi. D3 (komut etiketi eksikleri: `g""it`, değişkenle git, tam yollu `git.exe`) karar etkilemediği için düzeltilmedi.

## K2-04-D2B-2B — Yetki kaydı entegrasyonu (ÇEVRİMDIŞI, ÜRETİMDE KAPALI)

Durum: **entegrasyon kodu var, üretim girişleri kapalı.** `AUTHORITY.implemented` adapter'da ve `scripts/authority-grant.mjs`'te `false` kalır.
Korumalı bir yetki defteri yoktur; bu bölüm hiçbir Write/Edit/Bash izni açmaz ve K2'yi kabul etmez.

- `scripts/authority-grant.mjs` yalnız `MATCH` / `DENY` döndürür. `MATCH` = "olay, defterdeki bir kayıtla biçimsel olarak eşleşiyor"; allow, yürütme veya insan onayı değildir. Kayıt kaynağı doğrulanmaz.
- **guard.mjs** `decide()` içine yalnız enjeksiyonla açılan bir `grantCheck` noktası eklendi. `main()` onu hiç geçirmez; bu yüzden CLI hiçbir koşulda `ask` üretmez. Enjekte edilirse yalnız **PreToolUse + Write/Edit + adapter DENY** durumunda ve `grantCheck` tam biçimli `MATCH` (`allow:false`, `authority:'NONE'`, geçerli `grant_id`) döndürürse kanonik bir `ask` üretir. Bash, PowerShell, Agent, MCP, Glob/Grep ve diğer her araç aynı DENY'dır.
- **Kanonik ask** (tek biçim, bayt bayt): `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"GRANT:<id>"}}`, `<id>` = `[A-Za-z0-9._-]{1,64}`. `allow`, `updatedInput`, `updatedPermissions` hiçbir yolda üretilmez.
- **identity-gate.mjs** bu `ask`'ı yalnız `acceptGrantAsk:true` ile tanır; varsayılan `false` ve `main()` onu hiç geçirmez. PermissionRequest çıktıları için bu bayrak etkisizdir.
- **PermissionRequest** değişmedi: her zaman sabit deny JSON. Sessiz `exit 0` bir karar vermemek demektir, onay değildir, ve guard/kapı tarafından asla üretilmez/kabul edilmez. PermissionRequest'in her işlemde tetiklendiği varsayılmaz. Not: PreToolUse `ask` sonrası bir PermissionRequest tetiklenirse bu deny onu engeller; bu uçtan uca akış **NOT TESTED / UNKNOWN**'dır.
- **JSON bütünlüğü:** `JSON.parse` yinelenen anahtarda son değeri sessizce alır. `hasDuplicateKeys` (JSON.parse'ın kabul ettiği metin üzerinde tarayıcı, ayrıştırıcı değil) yinelenen anahtarlı defteri `LEDGER_DUPLICATE_KEY` ile tümüyle reddeder. Üretici ve oracle ile 2000 belgelik tohumlu testle sınandı; bu bir kanıt değil, test kapsamıdır.
- Açık riskler: TOCTOU (eşleşme ile yürütme arasında dosya/bağlantı değişebilir), tekrar oynatma (durumsuz; yalnız ≤4 saat pencere), Bash komut hash'i çalıştırma güvenliği değildir, defter bütünlüğü/kaynağı doğrulanmaz, `now` sistem saatidir.
