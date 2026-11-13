# W1b R5 — O4 Managed-Runtime Matris Yetkilendirme Paketi

Durum: **EXECUTED ONCE — AUTHORIZATION CONSUMED**  
Tarih: 2026-11-11

## Amaç

R4'te yalnız sentetik Write için elde edilen canlı managed-runtime gözlemini,
aynı loopback mock ve aynı fail-closed P2 politikası altında sıralı
`Write`, `Edit`, `Bash`, `PowerShell` matrisiyle ölçmek.

Bu kampanya gerçek model, gerçek credential, PermissionRequest kabulü veya K2
authority iddiası değildir. Başarılı sonuç dahi bağımsız inceleme öncesinde
yalnız yeni ve değişmez teknik kanıt üretir.

## Exact kampanya kimliği

- Run ID: `k205c-w1b-r5-20261111-164202-c829fbb2`
- Owned Sandbox ID: `c829fbb2-7dc2-472a-856b-6e396a3cbb33`
- Plan:
  `C:\Users\crypt\AppData\Local\Temp\7allab-w1b-live\k205c-w1b-r5-20261111-164202-c829fbb2\plan.json`
- Plan SHA-256:
  `567C56B5FD02C3F25F66F231F112E43C69B1415A410223F6784F71248F7F6942`
- Paket manifest SHA-256:
  `A6478F688F183FCCD091AE06EF18C684C60139ACD275BC0715760AE84EA4421B`
- Payload exact set SHA-256 (19 sıralı `relative-path<TAB>sha256` satırının
  UTF-8 özeti):
  `4095C9DB7A3AAA61BB22F616645B75EE94AFF2645D8C57C1BE88166E3BB06414`

## Salt-okunur preflight

- `wsb list --raw`: exit `0`, timeout `false`, stderr boş.
- Scope: `CURRENT_USER_WSB_CLI`; görünür count `0`.
- `system_wide_empty=NOT_ATTESTED`.
- Windows Sandbox paketi:
  `MicrosoftWindows.WindowsSandbox_0.8.107.0_x64__cw5n1h2txyewy`.
- App Execution Alias reparse tag: `APPEXECLINK`.
- `wsb.exe` SHA-256:
  `247E092B5C5BD37820F225A7DD3DDF10AE37A67E2751A19C24B802C84769C441`.
- Preflight observation SHA-256:
  `8550CB7EFB5536A5998B7EE57C4211FB6FAF5339E026EB387742D21B0CB20B48`.
- Preflight raw stdout SHA-256:
  `90255A0B24D45DA9C2280C4628D0E08D80902949213F5F5F76D7F282B678A6BB`.

## Payload ve regresyon

- Payload validator: `19/19` — 17 kaynak + 2 pinned runtime.
- `node.exe`: `24.18.0`, signature `Valid`, SHA-256
  `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`.
- `claude.exe`: `2.1.319.0`, signature `Valid`, SHA-256
  `2E055732C9D03D22700D9046251A8370B673607BFCC9E4D16A1B0E8FB1345CBD`.
- Tam host regresyonu: `203/203 PASS`, skipped `0`.
- Paket statik kontrolü: `109/109 PASS`.
- Paket bütünlüğü: `66/66 PASS`.
- Export kökü mevcut ve boş; report dizini mevcut değil.

## İzin verilen tek komut

```powershell
Set-Location -LiteralPath 'C:\Projeler\7allab-engineering-office\test\security-pilot'
node .\host\w1b-live-runner.mjs --plan 'C:\Users\crypt\AppData\Local\Temp\7allab-w1b-live\k205c-w1b-r5-20261111-164202-c829fbb2\plan.json'
$LASTEXITCODE
```

Başka plan, policy, Sandbox ID, ek argüman veya elle `wsb start/connect/stop`
kullanılmaz. Payload Sandbox'a read-only, export kökü write-only amaçla map edilir;
network ve clipboard kapalıdır. Gerçek credential/secret yoktur. Koşul sonucundan
bağımsız olarak exact owned-ID cleanup ve final current-user inventory zinciri
çalışır.

## Exact yetki ifadesi

Canlı yürütme ancak proje sahibinin aşağıdaki exact kapsamı açıkça onaylamasıyla
başlar:

> `W1B-LIVE-EXECUTION-R5 kapsamında, plan SHA-256 567C56B5FD02C3F25F66F231F112E43C69B1415A410223F6784F71248F7F6942 ve owned Sandbox ID c829fbb2-7dc2-472a-856b-6e396a3cbb33 ile sınırlandırılmış tek canlı kampanyaya izin veriyorum.`

Bu karar commit, push, dependency kurulumu, host ayarı değişikliği,
PermissionRequest kabulü veya ikinci bir kampanya yetkisi vermez.

## Yürütme sonucu

Exact yetki bir kez tüketildi. Kampanya outer exit `0` ve
`OFFLINE_CONSISTENT_UNATTESTED` ile tamamlandı; export `26/26` host tarafından
doğrulandı ve final current-user inventory `0` oldu.

Managed-runtime teknik matrisi tam kabul vermedi: `Write`, `Edit` ve
`PowerShell` managed PreToolUse hook'una ulaşıp `ADAPTER_DENY` ile engellendi;
`Bash` ise Claude Code 2.1.319 Windows runtime araç listesinde bulunmadığından
hook'tan önce `No such tool available: Bash` ile reddedildi. Hook marker seti
tam olarak `Write`, `Edit`, `PowerShell` oldu. Bu nedenle genel O4
`INCONCLUSIVE` kalır; PermissionRequest ayrıca açıktır.

Evidence index `89` dosyadır; SHA-256:
`AA8E930589FC2C8165C94F0477E399DDC1731A091DE1E731E052EF73E0BB88AC`.
Bu sonuç bağımsız review değildir ve yeni bir canlı koşu yetkisi vermez.
