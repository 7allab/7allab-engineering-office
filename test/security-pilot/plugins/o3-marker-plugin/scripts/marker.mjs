#!/usr/bin/env node
/**
 * marker.mjs — O3 sentetik plugin fixture'inin tek hook betigi.
 * Resmi konum: scripts/marker.mjs (hooks/hooks.json'dan payload'a sabitlenmis
 * node.exe + bu dosya yolu ile cagrilir; CLAUDE_PLUGIN_ROOT uzerinden).
 *
 * Bu gorevde (Task 13/14) CALISTIRILMAMISTIR. Yalniz statik syntax
 * kontrolunden gecmesi icin hazirlanmistir.
 *
 * Amac: p1 (baseline) ve p2 (allowManagedHooksOnly) altinda bu hook'un
 * kayitli/calisir olup olmadigini gozlemlemek. Beklenen yon HARD-CODE
 * EDILMEMISTIR — sinif landirma disaridan, startup log + marker dosyasi
 * karsilastirmasiyla yapilir (bkz. ../../ACCEPTANCE-CRITERIA.md, O3).
 *
 * FAIL-CLOSED DUZELTMESI (Task 14, bolum D): marker yazma basarisizligi
 * SESSIZCE BASARIYA DONUSMEZ. Yazma basarisiz olursa bu betik exit code
 * != 0 ile sonlanir (hata bir ".error.log" dosyasina da kaydedilmeye
 * calisilir, ama bu da basarisiz olabilir). Disaridaki gozlemci, bu hook
 * exit kodunu ve/veya marker dosyasinin yoklugunu gorerek O3'u
 * FAIL/INCONCLUSIVE olarak siniflandirabilir — "calisti ama marker
 * yazilamadi" durumu asla "hic calismadi" ile ayni (sessiz, exit 0)
 * gorunmez.
 */
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = "C:\\evidence";
const MARKER_FILE = path.join(EVIDENCE_DIR, "o3-marker.log");
const ERROR_FILE = path.join(EVIDENCE_DIR, "o3-marker.error.log");

function main() {
  try {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.appendFileSync(
      MARKER_FILE,
      `${new Date().toISOString()} o3-marker-plugin:SessionStart executed (synthetic, harmless)\n`,
      "utf8"
    );
    process.exit(0);
  } catch (err) {
    const msg = `${new Date().toISOString()} MARKER WRITE FAILED: ${String(err)}\n`;
    process.stderr.write(`[o3-marker] ${msg}`);
    try {
      fs.appendFileSync(ERROR_FILE, msg, "utf8");
    } catch {
      // Hata dosyasi da yazilamadi; yine de exit 1 ile fail-closed davran.
    }
    // KASITLI: exit 0 DONDURULMEZ. Marker yazilamadiginda bu hook'un
    // "basarili calisti" gibi gorunmesi YASAKTIR (Task 14, bolum D).
    process.exit(1);
  }
}

main();
