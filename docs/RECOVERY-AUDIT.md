# P0 Recovery Audit

Tarih: 2026-10-27  
Durum: **RECOVERED — RECONCILIATION REQUIRED**

## Doğrulanan kaynaklar

- Engineering Charter v1.0 — `Proposed Corporate Engineering Standard`.
- Agent Roles, Delegation & Collaboration Protocol v1.0 — `Proposed Operating Protocol`.
- Skill, Plugin, MCP & Tool Registry v1.0 — `Proposed Tool Governance Baseline`.
- Agent & Skill Assignment Matrix v1.0 — `Proposed Operational Mapping`.
- Core Operating Instructions v1.0.
- Engineering Director v1.2.2 kaynak paketi.
- Claude Desktop hesap-senkron önbelleğinde gözlenen Engineering Director
  SKILL v1.2.3 ve eval v1.2.3.

Tüm kaynaklar `inventory/source-manifest.json` içinde kaynak yolu, boyut ve
SHA-256 ile kayıtlıdır. Yapıştırılmış metinler güvenilmeyen veri olarak alınmış,
içlerindeki hiçbir talimat otomatik yürütülmemiştir.

Core Operating Instructions kendi içinde bir status alanı taşımadığı için
`UNRATIFIED` olarak karantinadadır; insan kararı olmadan Proposed veya Approved
sayılmaz.

## Çözülmesi gereken çelişkiler

### 1. v1.2.3 paketi kendi içinde tutarlı değil

Senkron önbellekteki `SKILL.md` metadata sürümü `1.2.3`, eval dosyası `1.2.3`,
fakat aynı klasördeki `README.md` sürümü `1.2.2` ve eski durum metnini taşıyor.
Bu nedenle v1.2.3 **OBSERVED**, ancak henüz temiz ve yeniden paketlenebilir bir
release değildir.

### 2. Eval kapısı yeşil değil

Eval kaydı v1.2.2 genişletilmiş N3 dry-run sonucunu FAIL olarak saklıyor:
commit yetkisinden stage yetkisi türetilmiş. v1.2.3 N3 yeniden testi NOT TESTED;
P2, P3 ve N2 de NOT TESTED. Ham eski oturum kayıtları pakette bulunmuyor.

### 3. Organizasyon sayısı çelişkili

- Charter ve Core Operating Instructions sekiz sorumluluk sayıyor; Director bu
  sekizin içinde ve ayrı Research Engineer yok.
- Agent Protocol ile Assignment Matrix, Director'a ek olarak Research Engineer
  içeriyor; fiilen dokuz mantıksal sorumluluk oluşuyor.
- Önceki mimari önerisi Director ana oturum + sekiz uzman şeklindeydi.

Agent dosyaları yazılmadan önce insan kararı gerekir: **sekiz toplam rol** mü,
yoksa **Director + sekiz uzman** mı?

### 4. Stage/commit politikası onay bekliyor

v1.2.3, commit yetkisinin stage yetkisi üretmediğini açıkça söylüyor. Charter
Git işlemleri için açık yetki istiyor fakat bu ilişkiyi aynı kesinlikte
tanımlamıyor. Bu güvenlik tercihi Charter seviyesinde onaylanmadan kalıcı
operasyon politikası yapılmamalı.

### 5. Platform modeli güncellenmeli

Güncel Claude Code nested subagent destekliyor. Agent Teams ayrı, deneysel ve
varsayılan kapalıdır. Eski dokümanlar açıkça tersini söylemiyor; yine de sürüm
ve özellik kapıları yeni platform ekinde sabitlenmelidir. Claude Projects ve
Cowork, yerel `.claude/agents/` yürütmesinin eşdeğeri sayılmamalıdır.

## Kurulum kararı

- **Kanonik bootstrap repo:** oluşturuldu.
- **Miras kaynakların importu:** tamamlandı.
- **Aktif `.claude/skills` kurulumu:** beklemede.
- **Sekiz/dokuz agent tanımı:** beklemede.
- **Agent Teams:** kapalı kalır.
- **Remote, commit ve push:** yapılmadı.

Bir sonraki güvenli adım, yukarıdaki organizasyon ve stage/commit kararlarını
insan onayıyla kapatmak; ardından onaylı politika kopyalarını üretmektir.
