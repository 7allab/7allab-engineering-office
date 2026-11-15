# K2 D18 A: karantina denemesi ve sonucu (2026-11-15)

Etiketler: [OWNER] = Owner PowerShell/ekran goruntusu; [OWNER, Claude chat] = sohbet asistaninin karsilastirmasi.

## 1. Ozet

A yazildigi gibi uygulandi (iki kopya tasindi, post envanter alindi) ama sonuc zararli ve synced yarisi kalici degil. A NOT ACHIEVED, yeniden adlandirilmadi, D18 matrisi degismedi. Dal task/office-007-quarantine-director-copies (commit f4669a8) main'e ALINMADI, kanit olarak saklanir. main'de proje kopyasi yerinde.

## 2. Uygulama [OWNER]

- Tasima kaydi: C:\Projeler\_moves\office-007-20261115.csv
- Hedef: C:\Projeler\_quarantine\director-old-20261115\
- Proje kopyasi: 1 dosya, SKILL.md v1.2.4, SHA-256 324B114F45D8F2F0D30BB2CBCED5CE8C757779DF3A632C2B1C5A5F993F5DAD65. PRE=1 POST=1 FARK=0.
- Synced kopya v1.2.3: PRE=3 POST=3 FARK=0.
  - README.md: 4B5AE1814A1C4548487B4A0E781A465BADCF8CB6616159A4E9EDD77D019557A5 (8107 bayt)
  - SKILL.md: AD39EA4A621A19CAA5DB2FE3D1AA3041BF3197BC9E24B16F35DD329D48612425 (14631 bayt)
  - evals\test-cases.md: 3357627E68ADFDA428C44B358A62E2056397F740F9F84F65B3BCD2445686D3AD (16042 bayt)
- Karantina sonrasi salt-okunur envanterde .claude\skills ve synced satirlari yoktu.
- AppData skills-plugin kopyasi (v1.2.3, ayni SKILL.md hash) ve .agents\skills (1A749FE39B7D0D6BFE0B5912646634649CCCAB17A2833916A447C53D6CEA6930) yerinde birakildi.

## 3. Test 1, dal office-007 (proje kopyasi yok) [OWNER]

- Yeni Claude Code oturumu (v2.1.325), acilista uyari/hata yok.
- /skills: 119 skill; 7allab-engineering-director tek satir, kaynak "claude.ai sync".
- Sonra synced\<uuid>\7allab-engineering-director yeniden olusmus: dosya mtime 2026-11-15 03:40:55, uc dosyanin hash'i karantinadakiyle ayni (v1.2.3), .last-complete-round 03:43:37, manifest.json klasoru listeliyor.
- Saatler yerel saat (Owner PowerShell); saat dilimi belirtilmedi.

## 4. Test 2, main (proje kopyasi var) [OWNER]

- /skills: 120 skill; hesap skill'i "anthropic-skills:7allab-engineering-director" adiyla ayri.
- Ekranda: "/7allab-engineering-director runs this project's skill, not your claude.ai skill."
- Sonuc: ayni adda proje kopyasi kazaniyor.

## 5. Etki [OWNER, Claude chat]

- Proje kopyasi karantinada iken etkin Director v1.2.3 (hesap).
- v1.2.3 ile v1.2.4 arasi yaklasik 212 degisen satir (diff); v1.2.3'te rol modeli, HIGH gorevde REVIEW_VERIFIED kurali ve AUTHORIZED_SCOPED etiketleri yok.
- Karantina oncesi hangisinin kazandigi test 2 ile gosterildi.

## 6. Karar (Owner onayina bagli, ONERILEN)

- A acik; D18 matrisi degistirilmedi.
- Ara kontrol (2026-11-24) icin D ve E PASS, ucuncu PASS icin C yolu.
- A'yi gercekten karsilamak icin kanonik surumun (director/7allab-engineering-director v1.2.14) projeye kurulumu ayri yetki ister (Charter Bolum 12). v1.2.14 degerlendirme durumu bu kayitta DOGRULANMADI.

## 7. Artik risk/UNKNOWN

- Hesap tarafi skill'i v1.2.3 ve claude.ai sync her Claude Code acilisinda yeniden uretiyor.
- AppData kopyasinin rolu: UNKNOWN.
- Saat dilimi: UNKNOWN.
- v1.2.14'un kurulabilirligi: UNKNOWN.

## 8. Olcum

/usage ve sure NOT MEASURED.
