# RC paketi bütünlüğü

Koşulan gövde, dondurulmuş 1.2.14 kaynağından **tam olarak bir satır** farklıdır.

| Nesne | SHA-256 |
| --- | --- |
| Dondurulmuş kaynak `director/7allab-engineering-director/SKILL.md` | `8a0a346fb0b8281dd44a44cb7799c17560beec53c55f703c71c99d3f29a01643` |
| Koşulan `rc/7allab-engineering-director-rc/SKILL.md` | `e7d158f078efa9506b07a497a50506e671e40191891cd741ded138e0cf8d30e4` |
| Dondurma commit'i | `31019228f1ac7e9966082bf386410ff9523988e5` |

Tek fark, satır 2:

```diff
- name: 7allab-engineering-director
+ name: 7allab-engineering-director-rc
```

Satır sayısı aynıdır; başka hiçbir karakter değişmemiştir. Ad değişikliği E1
uyarınca zorunludur: Agent Skills spesifikasyonu `name` alanının üst dizin adıyla
eşleşmesini ister ve hesap-senkron 1.2.3 ile ad çarpışmasını önlemek gerekir.
`description` bilerek aynen korunmuştur.

## Her koşuda doğrulama

1. Yüklenen gövdenin SHA-256'sı `e7d158f0...` ile eşleşmeli. Eşleşmiyorsa koşu
   hedef sürüme atfedilmez ve kayda `INCONCLUSIVE — gövde doğrulanamadı` yazılır.
2. Ham olay kaydında çağrılan skill adı `7allab-engineering-director-rc` olmalı.
   `7allab-engineering-director` (eki olmayan) görünüyorsa senkron 1.2.3 yüklenmiş
   demektir; koşu geçersizdir.

Yeniden üretim (salt-okunur):

```powershell
Get-FileHash '.\rc\7allab-engineering-director-rc\SKILL.md' -Algorithm SHA256
Get-FileHash '..\..\SKILL.md' -Algorithm SHA256
```
