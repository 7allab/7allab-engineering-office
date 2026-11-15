# LIFE-010 - AGENTS.md icin Owner'in ELLE ekleyecegi satirlar

AGENTS.md yalniz Owner tarafindan elle degistirilir (E1); bu dosya ajan tarafindan AGENTS.md'ye uygulanmadi.
Mevcut satirlar degismez. Asagidaki blok AGENTS.md sonuna, "Rol yonlendirme" bolumunden SONRA eklenir.
Dil ve yazim AGENTS.md ile ayni tutuldu (ASCII Turkce).

---8<--- eklenecek blok baslangici ---8<---

## Ofis korkulugu (hook) kurallari (LIFE-010)
- scope-guard hook'u bir kaza onleyici korkuluktur, dusmana karsi guvenlik siniri degildir. Asil kontrol Owner incelemesi ve manifest karsilastirmasidir.
- Yalniz Owner elle degistirir: AGENTS.md, CLAUDE.md, CLAUDE.local.md, .mcp.json, .claude/ (settings.json, hooks/, agents/, task-scope.json), scripts/guard-scope.mjs, .git/ (config, hooks/, info/ dahil), .gitattributes, .gitignore. Bu yollar task-scope.json allow listesine yazilmaz (sonda egik cizgiyle de: `AGENTS.md/`); yazilirsa hook tum scope'u reddeder ve hicbir yazma gecmez.
- Temel ad korumasi: AGENTS.md, CLAUDE.md, CLAUDE.local.md ve .mcp.json HER DERINLIKTE Owner-only'dir (or. docs/CLAUDE.md). Scope bir klasoru kapsasa bile bu adlara Write/Edit reddedilir.
- release-evidence-reviewer test CALISTIRMAZ. Test kaniti olarak qa-test-engineer'in calistirdigi komut ve ciktisini alir; yalniz salt okunur git komutlari calistirir.
- Alt ajan shell izinleri (tek duz komut; ; & | < > $ ` ( ) tirnak ve yonlendirme yok):
  | Rol | Izinli |
  | qa-test-engineer | npm test, npm run test, npm run check, node --test tests/<ad>.test.mjs (secenek yok), salt okunur git |
  | implementation-engineer | qa ile ayni |
  | release-evidence-reviewer | yalniz salt okunur git |
  | digerleri | shell yok |
- Salt okunur git = status, diff, log, show, rev-parse, ls-files ve branch --show-current; yalniz listelenen secenekler (or. git diff --check, git ls-files --eol). git -C, git -c, --no-index, --output, --ext-diff, --textconv yok.
- node --test yalniz tests/ altindaki adlandirilmis .test.mjs dosyalarini calistirir. docs/tasks/ altindaki teklif testlerini Owner veya Director calistirir.
- npm run build, npm run verify (build'i icerir), npm ci, npm install alt ajana kapali; Director'da Owner onayi ister.
- MCP araclari (mcp__*) varsayilan olarak kapali. Acmak icin Owner, tam arac adini hook icindeki MCP_ALLOW listesine elle ekler.
- Director shell'i allowlist degildir. push, reset --hard, clean, rebase, remote degisikligi ve recursive silme engellenir. Asagidakiler Owner onayi ister:
  - komut metninde korunan bir ad: agents.md, claude.md, claude.local.md, .mcp.json, .claude, task-scope, scope-guard / SCOPE_GUARD_*, guard-scope, .git ile baslayan ve ardindan harf, rakam, `_` veya `-` gelmeyen her ad (.git/, .git\, .git*, .git, ve tek basina .git; hooks/, info/, config dahil; .github, .gitmodules, .gitkeep haric), .gitattributes, .gitignore;
  - git restore, git reset (her bicim; --hard zaten engelli), git pull, git fetch, git clone, git revert, git config, git -c, git update-ref, git gc, git submodule, git notes, git init, git replace, git reflog; diger `git branch ...` komutlari da onay ister, YALNIZ tam olarak `git branch --show-current` istemez;
  - --config-env, GIT_CONFIG* veya GIT_EXTERNAL_DIFF gecen komut;
  - GIT_<ad>= veya $env:GIT_<ad> atamasi (GIT_PAGER, GIT_SSH_COMMAND, GIT_DIR ...) ve EDITOR= / $env:EDITOR atamasi;
  - GitHub CLI: `gh` ile calisan her komut (gh pr merge, gh release create, gh api ...);
  - satir ici yorumlayici kodu (python -, node -e, iex, -EncodedCommand);
  - paket yoneticisi: komutta npm, pnpm, yarn, bun, bunx veya npx gecip ayni komutta kurulum benzeri bir fiil HERHANGI BIR YERDE geciyorsa (ci, clean-install, install, i, add, update, uninstall, remove, link, exec, x, dlx, rebuild, dedupe, prune, publish, init, create, version, pkg ve kisaltmalari; or. `npm --prefix app install`); ayrica npx ve bunx her zaman, npm -g/--global, npm run build/verify. `npm test` ve `npm run check` onay istemez.
- SCOPE_GUARD_NO_MAIN=1 hook'u kapatir; yalniz testler icindir. Bu degisken kullanici veya sistem ortamina yazilmaz.
- Oturum basinda ve sonunda Owner manifesti dogrular: `node <office>/office-manifest.mjs verify <calisma-agaci-disi>/office-manifest.json --root <proje>`. Cikis 0 = ayni, 1 = fark var (is durur; Owner farki inceler), 2 = hata.
- Hook log'u (.claude/hooks/scope-guard.log) komutun ilk 300 karakterini yazar. Log'a yalniz Owner YAZAR, ama Read araci ve shell onu OKUYABILIR: komut satirina gizli bilgi (token, parola) yazilmaz. Log 1 MiB'de doner (bir onceki dosya .1 olarak tutulur).

---8<--- eklenecek blok sonu ---8<---

## Not (eklenmez, Owner icin)
- "Rol yonlendirme" tablosundaki "Yalniz belge -> release-evidence-reviewer" satiri degismez; reviewer'in test calistirmamasi bu satirla celismez.
- Mevcut AGENTS.md satiri "Dogrulama: npm run check ve npm test" alt ajanlar icin yukaridaki tabloyla uyumludur.
