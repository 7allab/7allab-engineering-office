#!/usr/bin/env node
/**
 * mock-endpoint.mjs — K2-05-C hazirlik paketi, loopback-only deterministik
 * "Anthropic Messages API compatible test fixture".
 *
 * ONEMLI: Bu dosya bu gorevde (Task 13/14/14B) CALISTIRILMAMISTIR disinda
 * yalniz kendi yerel '--self-test' harness'i calistirilmistir (asagida
 * aciklaniyor); claude.exe'ye hicbir sekilde cagri yapilmamistir ve
 * hedef `claude.exe` ile protokol uyumlulugu bu gorevde TEST
 * EDILMEMISTIR (NOT TESTED). '--self-test', yalniz bu dosyanin KENDI
 * HTTP sozlesmesini (asagidaki validasyon kurallari) dogrular; bu
 * Claude Code'un gercekte hangi header/yol/auth semasini kullandigina
 * dair bir KANIT DEGILDIR (UNVERIFIED, bkz. OFFICIAL-DOCS-ALIGNMENT.md).
 *
 * NE DEGILDIR: Bu, gercek Anthropic/Claude modeli DEGILDIR. Gercek bir
 * modele hicbir sekilde proxy yapmaz. Her kayit ve her yanit
 * evidence_kind="MOCK_ENDPOINT" olarak etiketlenir; "LIVE_REAL_MODEL"
 * etiketi bu dosyanin hicbir yerinde kullanilmaz.
 *
 * Protokol (Task 14, bolum C):
 *  - Hedef protokol aciklikla "Anthropic Messages API compatible test
 *    fixture" olarak tanimlanir: POST /v1/messages, JSON govde, JSON
 *    yanit; yanit sekli gercek Messages API'nin bir tool_use icerik
 *    bloguna ve uygun stop_reason'a benzer.
 *  - Mock, ONCEDEN eski ozel "tool_name" alanini bekleyen formattan
 *    CIKARILMISTIR. Hangi tool (Write/Edit/Bash/PowerShell) donulecegi
 *    istek govdesinden TAHMIN EDILMEZ; sunucu baslatilirken
 *    --scenario bayragiyla ACIKCA secilir (run konfigurasyonu).
 *
 * Fail-closed kurallari (Task 14, bolum B):
 *  1. Yalniz 127.0.0.1 (loopback) uzerine bind olur; env ile override
 *     edilemez (sabit kodlanmistir).
 *  2. Baslamadan ONCE (listen() cagrisindan once) evidence dizini ve
 *     log dosyasinin YAZILABILIRLIGI dogrulanir; basarisizsa surec
 *     listen() cagrilmadan cikis kodu != 0 ile sonlanir.
 *  3. Log yazma hatasi runtime'da olursa exception firlatilir; bu
 *     durumda HTTP 200 veya basarili tool-use yaniti KESINLIKLE
 *     VERILMEZ (500 donulur).
 *  4. Istek govdesine kucuk, acik bir byte siniri (MAX_BODY_BYTES)
 *     uygulanir; asilirsa baglanti kapatilir, govde ayristirilmaz.
 *  5. Yanlis method/path/content-type REDDEDILIR (yalniz POST
 *     /v1/messages, application/json).
 *  6. Yalniz loopback istemcisi kabul edilir (remoteAddress kontrolu).
 *  7. Gercek credential kabul ETMEZ. Auth header'i yalniz dokumante
 *     edilmis, acikca sahte (gercek anahtar formatina benzemeyen)
 *     sabit bir sentinel degeriyle eslesirse kabul eder; farkli bir
 *     deger gelirse REDDEDILIR ve o deger LOGLANMAZ (yalniz
 *     "sentinel_mismatch": true kaydedilir).
 *  8. Header ve govde loglari redakte edilir (Authorization/x-api-key/
 *     cookie).
 *
 * Kanit yolu ayrimi (Task 14B, bolum 1): `--self-test` HICBIR KOSULDA
 * `C:\evidence`'i kullanmaz veya ona dokunmaz. `startServer` ve log
 * fonksiyonlari artik kanit dizini/log yolunu PARAMETRE olarak alir.
 * Normal (self-test disi) calistirmada varsayilan yol `C:\evidence`
 * olarak KALIR (geriye donuk uyumluluk). Self-test, sistem temp dizini
 * altinda KENDI benzersiz, tek-seferlik dizinini olusturur, onu kullanir
 * ve en sonda SADECE o kesin dizini - containment dogrulamasindan sonra -
 * temizler; cleanup basarisiz olursa bu durum GIZLENMEZ, sonuc satirinda
 * raporlanir. Self-test ayrica `C:\evidence`'in calisma oncesi/sonrasi
 * DEGISMEDIGINI salt-okunur bir envanter karsilastirmasiyla dogrular.
 *
 * Kullanim (SADECE gelecekteki yetkili sandbox kosusunda):
 *   node mock-endpoint.mjs --port 8765 --scenario Write
 * Yerel, model kullanmayan self-test (bu HTTP sozlesmesini dogrular;
 * KENDI sistem-temp dizinini kullanir, C:\evidence'a DOKUNMAZ):
 *   node mock-endpoint.mjs --self-test
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const MOCK_BIND_ADDRESS = "127.0.0.1"; // sabit kodlanmis, override edilemez
const DEFAULT_PORT = 8765;
// Varsayilan (self-test DISI, gercek/gelecekteki yetkili kosu) kanit yolu.
// Self-test bu sabitleri HICBIR SEKILDE kullanmaz; kendi parametrelerini
// (bkz. runSelfTest) startServer()'a acikca gecirir.
const DEFAULT_EVIDENCE_DIR = "C:\\evidence";
const DEFAULT_LOG_FILE = path.join(DEFAULT_EVIDENCE_DIR, "mock-endpoint.jsonl");
const EVIDENCE_KIND = "MOCK_ENDPOINT"; // sabit; asla "LIVE_REAL_MODEL" olmaz
const MAX_BODY_BYTES = 65536; // 64 KiB - acik, kucuk bir sinir
const EXPECTED_PATH = "/v1/messages";
const EXPECTED_QUERIES = new Set(["", "?beta=true"]);
const EXPECTED_METHOD = "POST";
const EXPECTED_CONTENT_TYPE = "application/json";
// Acikca sahte, gercek saglayici anahtar bicimlerinden kasten farkli olan
// sabit sentinel (gercek anahtarlar genellikle saglayici-onekli, uzun,
// yuksek-entropili dizgilerdir; bu deger oyle degildir). Gercek credential
// DEGILDIR; yalniz bu fixture'in kendi test-sozlesmesidir.
const SYNTHETIC_AUTH_SENTINEL = "mock-fixture-sentinel-not-a-real-key-0000";

const REDACT_HEADERS = ["authorization", "x-api-key", "cookie", "set-cookie"];

const SCENARIOS = ["Write", "Edit", "Bash", "PowerShell"];

// Her senaryo icin sentetik, zararsiz, deterministik tool_use girdisi.
// Mock bu komutlari/dosya islemlerini HICBIR SEKILDE calistirmaz; yalniz
// "model onerdi" seklinde dondurur. Gercek enforcement, Claude Code'un
// PreToolUse guard hook'u tarafindan yapilmalidir (bu O2/O4/O5'in konusu).
// NOT: Bu girdiler yalniz sentetik metin degerleridir; mock onlari hicbir
// dosyaya yazmaz veya calistirmaz, bu nedenle gercek C:\evidence'a
// dokunmazlar (self-test disindaki normal calistirmada da).
const SCENARIO_TOOL_INPUT = {
  Write: { file_path: "mock-write-target.txt", content: "synthetic-mock-content" },
  Edit: { file_path: "mock-edit-target.txt", old_string: "a", new_string: "b" },
  Bash: { command: "echo mock-synthetic-noop" },
  PowerShell: { command: "Write-Output 'mock-synthetic-noop'" },
};

function redactHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = REDACT_HEADERS.includes(k.toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

function redactBody(body) {
  if (typeof body !== "string") return body;
  return body
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

/** Evidence dizini + log dosyasinin yazilabilirligini dogrular. Basarisizsa
 *  THROW eder (cagiran taraf bunu listen()'dan ONCE kontrol eder). Parametre
 *  olarak alinan evidenceDir/logFile disinda HICBIR sabit yol kullanmaz. */
export function checkEvidenceWritable(evidenceDir, logFile) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  // Gercek bir yazma denemesi (bos append), ardindan hemen kapat; dosyayi
  // silmez (append-only log).
  const fd = fs.openSync(logFile, "a");
  fs.closeSync(fd);
}

/** Bu fonksiyon basarisiz olursa CAGIRAN TARAF 500 donmelidir; asla
 *  sessizce yutulup 200 donulmemelidir. logFile PARAMETRE olarak alinir;
 *  hicbir modul-seviyesi sabit yola dogrudan yazmaz. */
function appendLogOrThrow(logFile, entry) {
  fs.appendFileSync(
    logFile,
    JSON.stringify({ ts: new Date().toISOString(), evidence_kind: EVIDENCE_KIND, ...entry }) + "\n",
    "utf8"
  );
}

function isLoopbackRemote(remoteAddress) {
  return remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
}

function getContentTypeBase(headers) {
  return (headers["content-type"] || "").split(";")[0].trim().toLowerCase();
}

function isValidSentinel(headers) {
  return headers["x-api-key"] === SYNTHETIC_AUTH_SENTINEL;
}

/** Gercek Messages API'ye benzer deterministik yanit uretir (saf fonksiyon,
 *  test edilebilir). */
export function buildMessagesApiResponse(scenario) {
  const input = SCENARIO_TOOL_INPUT[scenario];
  return {
    id: "msg_mock_0001",
    type: "message",
    role: "assistant",
    model: "mock-endpoint-fixture",
    content: [
      { type: "tool_use", id: "toolu_mock_0001", name: scenario, input },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    evidence_kind: EVIDENCE_KIND,
    is_real_model: false,
  };
}

function hasToolResult(body) {
  return Array.isArray(body?.messages) && body.messages.some((message) =>
    Array.isArray(message?.content) && message.content.some((block) => block?.type === "tool_result")
  );
}

function buildTerminalResponse() {
  return {
    id: "msg_mock_0002",
    type: "message",
    role: "assistant",
    model: "mock-endpoint-fixture",
    content: [{ type: "text", text: "synthetic fixture complete" }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    evidence_kind: EVIDENCE_KIND,
    is_real_model: false,
  };
}

function handleRequest(scenario, logFile, req, res) {
  // 6. Yalniz loopback istemcisi.
  if (!isLoopbackRemote(req.socket.remoteAddress)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "loopback_only", evidence_kind: EVIDENCE_KIND }));
    return;
  }

  // 5. Yalniz POST /v1/messages, application/json.
  const requestUrl = new URL(req.url, `http://${MOCK_BIND_ADDRESS}`);
  if (req.method !== EXPECTED_METHOD || requestUrl.pathname !== EXPECTED_PATH || !EXPECTED_QUERIES.has(requestUrl.search)) {
    try {
      appendLogOrThrow(logFile, {
        direction: "request",
        rejected: "unexpected_method_or_path",
        method: req.method,
        path: req.url,
        evidence_kind: EVIDENCE_KIND,
      });
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "log_write_failed", evidence_kind: EVIDENCE_KIND }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unexpected_method_or_path", evidence_kind: EVIDENCE_KIND }));
    return;
  }
  if (getContentTypeBase(req.headers) !== EXPECTED_CONTENT_TYPE) {
    res.writeHead(415, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unsupported_content_type", evidence_kind: EVIDENCE_KIND }));
    return;
  }

  // 7. Auth sentinel kontrolu (gercek deger LOGLANMAZ).
  const authOk = isValidSentinel(req.headers);

  let total = 0;
  const chunks = [];
  let aborted = false;

  req.on("data", (chunk) => {
    if (aborted) return;
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      aborted = true;
      try {
        appendLogOrThrow(logFile, { direction: "request", rejected: "body_too_large", note: "evidence_kind=MOCK_ENDPOINT" });
      } catch { /* logging best-effort burada; FAIL-CLOSED karari zaten verildi */ }
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "body_too_large", evidence_kind: EVIDENCE_KIND }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (aborted) return;
    const raw = Buffer.concat(chunks).toString("utf8");

    if (!authOk) {
      try {
        appendLogOrThrow(logFile, { direction: "request", rejected: "sentinel_mismatch", sentinel_mismatch: true, note: "value NOT logged" });
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "log_write_failed", evidence_kind: EVIDENCE_KIND }));
        return;
      }
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_auth", evidence_kind: EVIDENCE_KIND }));
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        appendLogOrThrow(logFile, { direction: "request", rejected: "invalid_json" });
      } catch { /* best-effort */ }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_json", evidence_kind: EVIDENCE_KIND }));
      return;
    }

    // Loglama (FAIL-CLOSED: hata olursa 200 ASLA donulmez).
    try {
      appendLogOrThrow(logFile, {
        direction: "request",
        remote: req.socket.remoteAddress,
        headers: redactHeaders(req.headers),
        body: redactBody(raw),
        model_field: parsed && parsed.model,
        note: "evidence_kind=MOCK_ENDPOINT; this is NOT a real Anthropic/Claude model response",
      });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "log_write_failed", evidence_kind: EVIDENCE_KIND }));
      return;
    }

    const payload = JSON.stringify(hasToolResult(parsed) ? buildTerminalResponse() : buildMessagesApiResponse(scenario));

    try {
      appendLogOrThrow(logFile, { direction: "response", body: payload });
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "log_write_failed", evidence_kind: EVIDENCE_KIND }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(payload);
  });
}

/** evidenceDir/logFile PARAMETRE olarak alinir. Varsayilan (argumansiz)
 *  cagrida geriye-donuk uyumluluk icin DEFAULT_EVIDENCE_DIR/DEFAULT_LOG_FILE
 *  kullanilir; self-test bu varsayilanlari ASLA kullanmaz, kendi degerlerini
 *  acikca gecirir (bkz. runSelfTest). */
function startServer({ port, scenario, evidenceDir = DEFAULT_EVIDENCE_DIR, logFile = DEFAULT_LOG_FILE }) {
  // 2. listen() ONCESI yazilabilirlik kontrolu.
  try {
    checkEvidenceWritable(evidenceDir, logFile);
  } catch (err) {
    process.stderr.write(`[mock-endpoint] FAIL-CLOSED: evidence dir/log yazilamaz: ${String(err)}\n`);
    process.exit(1);
  }

  const server = http.createServer((req, res) => handleRequest(scenario, logFile, req, res));

  server.on("error", (err) => {
    process.stderr.write(`[mock-endpoint] FAIL-CLOSED: bind/listen error: ${String(err)}\n`);
    process.exit(1);
  });

  server.listen(port, MOCK_BIND_ADDRESS, () => {
    process.stdout.write(
      `[mock-endpoint] listening on ${MOCK_BIND_ADDRESS}:${server.address().port} scenario=${scenario} evidenceDir=${evidenceDir} (MOCK_ENDPOINT, NOT a real model, loopback-only)\n`
    );
  });
  return server;
}

// ---------------------------------------------------------------------------
// Salt-okunur yardimcilar: bir dizinin "once/sonra" envanterini alir, boylece
// self-test C:\evidence'a dokunmadigini KANITLAYABILIR (yalniz okur; hicbir
// zaman yazmaz/silmez).
// ---------------------------------------------------------------------------
function snapshotDirReadOnly(dir) {
  if (!fs.existsSync(dir)) return { existed: false, entries: [] };
  const entries = [];
  const walk = (d, relBase) => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const relp = relBase ? `${relBase}/${name}` : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, relp);
      else entries.push({ path: relp, size: st.size, mtimeMs: st.mtimeMs });
    }
  };
  walk(dir, "");
  return { existed: true, entries: entries.sort((a, b) => a.path.localeCompare(b.path)) };
}

function snapshotsEqual(a, b) {
  if (a.existed !== b.existed) return false;
  if (a.entries.length !== b.entries.length) return false;
  for (let i = 0; i < a.entries.length; i++) {
    const x = a.entries[i], y = b.entries[i];
    if (x.path !== y.path || x.size !== y.size || x.mtimeMs !== y.mtimeMs) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Yerel, model kullanmayan self-test harness (Task 14 bolum C; Task 14B
// bolum 1 ile kanit-yolu ayrimi eklendi). claude.exe'ye HICBIR cagri
// yapmaz; yalniz bu dosyanin KENDI HTTP sozlesmesini dogrular. claude.exe
// uyumlulugu bununla KANITLANMAZ. C:\evidence'a HICBIR SEKILDE dokunmaz;
// bunu kendi once/sonra salt-okunur envanter karsilastirmasiyla da
// dogrular (asagidaki ekstra kontrol satiri).
// ---------------------------------------------------------------------------
async function runSelfTest() {
  const results = [];
  const rec = (name, ok, detail) => results.push({ name, ok, detail });

  // Gercek/uretim kanit dizini: self-test bunu HICBIR ZAMAN kendi test
  // yolu olarak kullanmaz; yalniz once/sonra DEGISMEDIGINI dogrulamak
  // icin salt-okunur gozlenir.
  const productionEvidenceDir = DEFAULT_EVIDENCE_DIR;
  const beforeSnapshot = snapshotDirReadOnly(productionEvidenceDir);

  // Bu kosuya ait, sistem temp koku altinda BENZERSIZ, tek-seferlik dizin.
  // mkdtempSync rastgele bir sonek uretir; bu TAM ADI asagida sakliyoruz ki
  // cleanup sirasinda SADECE bu kesin dizini sildigimizi dogrulayabilelim.
  const tmpRoot = fs.realpathSync(os.tmpdir());
  const selfTestDir = fs.mkdtempSync(path.join(tmpRoot, "mock-endpoint-selftest-"));
  const selfTestLogFile = path.join(selfTestDir, "mock-endpoint.jsonl");

  const server = startServer({ port: 0, scenario: "Write", evidenceDir: selfTestDir, logFile: selfTestLogFile });
  await new Promise((r) => server.once("listening", r));
  const port = server.address().port;

  function request({ method = "POST", urlPath = EXPECTED_PATH, headers = {}, body = "" } = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port, path: urlPath, method, agent: false, headers: { "content-type": "application/json", connection: "close", ...headers } },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  const validHeaders = { "x-api-key": SYNTHETIC_AUTH_SENTINEL };
  const validBody = JSON.stringify({ model: "mock-endpoint-fixture", max_tokens: 64, messages: [{ role: "user", content: "noop" }] });

  try {
    const r1 = await request({ urlPath: "/v1/messages?beta=true", headers: validHeaders, body: validBody });
    const j1 = JSON.parse(r1.body);
    const toolResultBody = JSON.stringify({ model: "mock-endpoint-fixture", max_tokens: 64, messages: [{ role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_mock_0001", content: "blocked" }] }] });
    const r1b = await request({ urlPath: "/v1/messages?beta=true", headers: validHeaders, body: toolResultBody });
    const j1b = JSON.parse(r1b.body);
    rec("gecerli istek -> tek tool_use, tool_result -> end_turn", r1.status === 200 && j1.content?.[0]?.type === "tool_use" && j1.content[0].name === "Write" && r1b.status === 200 && j1b.stop_reason === "end_turn" && j1b.content?.[0]?.type === "text", { first: r1, second: r1b });
  } catch (e) { rec("gecerli istek -> beklenen tool_use", false, String(e)); }

  try {
    const r2 = await request({ urlPath: "/v1/not-messages", headers: validHeaders, body: validBody });
    const rejectionLogged = fs.readFileSync(selfTestLogFile, "utf8")
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
      .some((entry) => entry.rejected === "unexpected_method_or_path" && entry.method === "POST" && entry.path === "/v1/not-messages");
    rec("yanlis path -> ret", r2.status === 404 && rejectionLogged, r2);
  } catch (e) { rec("yanlis path -> ret", false, String(e)); }

  try {
    const r3 = await request({ method: "GET", headers: validHeaders, body: "" });
    rec("yanlis method -> ret", r3.status === 404, r3);
  } catch (e) { rec("yanlis method -> ret", false, String(e)); }

  try {
    const bigBody = JSON.stringify({ model: "x", filler: "A".repeat(MAX_BODY_BYTES + 1024) });
    const r4 = await request({ headers: validHeaders, body: bigBody });
    rec("buyuk body -> ret", r4.status === 413, r4);
  } catch (e) { rec("buyuk body -> ret", false, String(e)); }

  try {
    const r5 = await request({ headers: validHeaders, body: "{not-json" });
    rec("gecersiz JSON -> ret", r5.status === 400, r5);
  } catch (e) { rec("gecersiz JSON -> ret", false, String(e)); }

  try {
    const r6 = await request({ headers: { "x-api-key": "wrong-value" }, body: validBody });
    rec("yanlis auth -> ret", r6.status === 401, r6);
  } catch (e) { rec("yanlis auth -> ret", false, String(e)); }

  // "log yazilamiyor -> basarili yanit yok": runtime HTTP uzerinden degil,
  // checkEvidenceWritable'in dogrudan kendisiyle test edilir (gercek bir
  // sunucuyu bozuk bir log yoluyla baslatmak surec disi riski artirir).
  // ONEMLI: bu KENDI selfTestDir'i icinde yapilir; C:\evidence'a HICBIR
  // SEKILDE dokunmaz.
  try {
    const blockerFile = path.join(selfTestDir, "blocked-by-file");
    fs.writeFileSync(blockerFile, "bu bir dizin DEGIL, duz bir dosyadir");
    const badDir = path.join(blockerFile, "cannot-be-a-subdir-of-a-file");
    const badLog = path.join(badDir, "mock-endpoint.jsonl");
    let threw = false;
    try { checkEvidenceWritable(badDir, badLog); } catch { threw = true; }
    rec("log yazilamiyor -> basarili yanit yok (startup reddi)", threw, { badDir });
  } catch (e) { rec("log yazilamiyor -> basarili yanit yok (startup reddi)", false, String(e)); }

  // Loopback-disi simulasyon: dogrudan fonksiyon testi (gercek disaridan
  // baglanti bu sandbox/ortamda kurulamaz; fonksiyon izole test edilir).
  rec("loopback-disi adres -> ret (fonksiyon testi)", isLoopbackRemote("203.0.113.5") === false, { checked: "203.0.113.5" });

  server.close();

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : "  " + JSON.stringify(r.detail)}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} mock-endpoint self-tests passed (HTTP sozlesmesi; claude.exe uyumlulugu DEGIL)`);

  // Task 14B / bolum 1: C:\evidence self-test sirasinda OLUSTURULMADI veya
  // DEGISTIRILMEDI mi? Salt-okunur once/sonra karsilastirmasi (yazma YOK).
  const afterSnapshot = snapshotDirReadOnly(productionEvidenceDir);
  const evidenceUntouched = snapshotsEqual(beforeSnapshot, afterSnapshot);
  console.log(
    `${evidenceUntouched ? "PASS" : "FAIL"}  C:\\evidence self-test sirasinda OLUSTURULMADI/DEGISTIRILMEDI (salt-okunur once/sonra karsilastirma; once existed=${beforeSnapshot.existed} entries=${beforeSnapshot.entries.length}, sonra existed=${afterSnapshot.existed} entries=${afterSnapshot.entries.length})`
  );

  // Cleanup: SADECE bu kosunun KENDI olusturdugu kesin selfTestDir'i sil.
  // Once containment dogrulamasi yap: cozumlenmis yol, sistem temp kokunun
  // ALTINDA mi VE bu kosunun ADIYLA mi eslesiyor? Kullanicinin veya baska
  // bir kosunun temp dizinine ASLA dokunulmaz.
  let cleanupOk = false;
  let cleanupDetail = "";
  try {
    const resolvedSelfTestDir = fs.realpathSync(selfTestDir);
    const resolvedTmpRoot = tmpRoot.endsWith(path.sep) ? tmpRoot : tmpRoot + path.sep;
    const containedUnderTmpRoot = resolvedSelfTestDir.startsWith(resolvedTmpRoot);
    const nameMatches = path.basename(resolvedSelfTestDir) === path.basename(selfTestDir);
    if (!containedUnderTmpRoot || !nameMatches) {
      throw new Error(
        `containment check failed: resolved=${resolvedSelfTestDir} tmpRoot=${resolvedTmpRoot} nameMatches=${nameMatches} (refusing to delete)`
      );
    }
    fs.rmSync(resolvedSelfTestDir, { recursive: true, force: false });
    cleanupOk = true;
    cleanupDetail = resolvedSelfTestDir;
  } catch (err) {
    cleanupDetail = String(err);
  }
  console.log(`${cleanupOk ? "PASS" : "FAIL"}  cleanup: bu kosunun kendi temp dizini silindi (${selfTestDir}) -> ${cleanupDetail}`);
  if (!cleanupOk) {
    console.log(`      CLEANUP BASARISIZ OLDU; gizlenmiyor. Elle temizlik gerekebilir: ${selfTestDir}`);
  }

  process.exitCode = failed || !evidenceUntouched || !cleanupOk ? 1 : 0;
}

// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const portArgIdx = argv.indexOf("--port");
  const port = portArgIdx !== -1 ? Number(argv[portArgIdx + 1]) : DEFAULT_PORT;
  const scenarioArgIdx = argv.indexOf("--scenario");
  const scenario = scenarioArgIdx !== -1 ? argv[scenarioArgIdx + 1] : null;

  if (!scenario || !SCENARIOS.includes(scenario)) {
    process.stderr.write(
      `[mock-endpoint] FAIL-CLOSED: --scenario zorunludur ve su degerlerden biri olmalidir: ${SCENARIOS.join(", ")}. Belirsiz istekten tool adi TAHMIN EDILMEZ.\n`
    );
    process.exit(1);
  }

  // Normal (self-test disi) calistirmada varsayilan yol C:\evidence olarak
  // KALIR (geriye donuk uyumluluk); startServer'in varsayilan parametreleri
  // kullanilir.
  startServer({ port, scenario });
}

main();
