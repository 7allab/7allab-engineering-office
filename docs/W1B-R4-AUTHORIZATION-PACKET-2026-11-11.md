# W1b R4 — Hedefli Canlı Kanıt Yetkilendirme Paketi

Durum: **EXECUTED ONCE — AUTHORIZATION CONSUMED**  
Tarih: 2026-11-11

## Amaç

R3 bağımsız review'unda bulunan üç boşluğun yeni ve değişmez kanıtta kapanıp
kapanmadığını ölçmek:

1. probe marker ve `_marker.mjs` bağımlılığının birlikte çalışması;
2. host kaynak SHA-256 ve faz bazlı executable/argv evidence binding;
3. E01–E10 bounded ham stdout/stderr kanıtı.

R3 kanıtları değiştirilmez. P1–P6 tekrar koşulmaz. Başarılı R4 dahi kendi
başına K2 kabulü veya authority değildir.

## Exact kampanya kimliği

- Run ID: `k205c-w1b-r4-20261111-131051-c829fbb2`
- Owned Sandbox ID: `c829fbb2-7dc2-472a-856b-6e396a3cbb33`
- Plan:
  `C:\Users\crypt\AppData\Local\Temp\7allab-w1b-live\k205c-w1b-r4-20261111-131051-c829fbb2\plan.json`
- Plan SHA-256:
  `80D76237B8EAE0468887930242C28D6D00CB7D0FB5FE8CCB2DBA306E17A9E69E`
- Paket manifest SHA-256:
  `1C59B36EFA212773A2BDBAA1C226505EBFC41F9DAEFA3370F1EF8CC9012D129C`

## Preflight

- Regresyon: `202/202 PASS`, skipped `0`.
- Statik paket kontrolü: `109/109 PASS`.
- Paket bütünlüğü: `66/66 PASS`.
- Payload validator: `file_count=19`, `source_count=17`, `runtime_count=2`.
- `node.exe`: `24.18.0`, signature `Valid`, SHA-256
  `9A4EB5F1C29C6A2E93852EAD46B999E284A6A5CA8BAB4D4E241D587D025A52DE`.
- `claude.exe`: `2.1.319.0`, signature `Valid`, SHA-256
  `2E055732C9D03D22700D9046251A8370B673607BFCC9E4D16A1B0E8FB1345CBD`.
- Export kökü boş; report dizini mevcut değil.

## İzin verilen tek komut

```powershell
Set-Location -LiteralPath 'C:\Projeler\7allab-engineering-office\test\security-pilot'
node .\host\w1b-live-runner.mjs --plan 'C:\Users\crypt\AppData\Local\Temp\7allab-w1b-live\k205c-w1b-r4-20261111-131051-c829fbb2\plan.json'
$LASTEXITCODE
```

Başka plan, policy, Sandbox ID, ek argüman veya elle `wsb start/connect/stop`
kullanılmaz. Gerçek credential/secret yoktur; yalnız loopback mock ve sentetik
sentinel kullanılır. Koşul başarısından bağımsız exact owned-ID cleanup ve final
current-user inventory zinciri çalışır. `system_wide_empty` yine
`NOT_ATTESTED` kalır.

## Yetki ifadesi

Canlı yürütme ancak proje sahibinin aşağıdaki exact kapsamı açıkça onaylamasıyla
başlar:

> `W1B-LIVE-EXECUTION-R4` kapsamında, bu belgede kayıtlı exact plan SHA-256 ve
> owned Sandbox ID ile sınırlandırılmış tek canlı kampanyaya izin veriyorum.

Bu karar commit, push, dependency kurulumu, host ayarı değişikliği veya yeni bir
kampanya yetkisi vermez.

## Yürütme sonucu

Exact yetki bir kez tüketildi. Kampanya `OFFLINE_CONSISTENT_UNATTESTED`, outer
exit `0` tamamlandı; bağımsız hedefli review `REVIEW_VERIFIED=YES` verdi.
Kayıtlar: `docs/W1B-LIVE-RUN-R4-2026-11-11.md` ve
`docs/W1B-R4-INDEPENDENT-REVIEW-2026-11-11.md`. Bu belge yeni bir koşuya yetki
vermez.
