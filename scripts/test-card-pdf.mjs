/**
 * Prueba local del motor PDF (sin Next ni base de datos).
 * Uso: node scripts/test-card-pdf.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { jsPDF } from "jspdf";

const require = createRequire(import.meta.url);
const bwipjs = require("bwip-js");

const CARD_W = 85.6;
const CARD_H = 53.98;
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 8;
const GAP = 3;

const cols = 2;
const rows = Math.floor((PAGE_H - MARGIN * 2 + GAP) / (CARD_H + GAP));
const perPage = cols * rows;
const codes = Array.from({ length: 12 }, (_, i) => `CRD-${String(128 + i).padStart(6, "0")}`);

const gridW = cols * CARD_W + (cols - 1) * GAP;
const gridH = rows * CARD_H + (rows - 1) * GAP;
const marginX = Math.max(MARGIN, (PAGE_W - gridW) / 2);
const marginY = Math.max(MARGIN, (PAGE_H - gridH) / 2);

async function barcodePng(code) {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: code,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}

const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

for (let i = 0; i < codes.length; i += 1) {
  if (i > 0 && i % perPage === 0) doc.addPage();
  const indexOnPage = i % perPage;
  const col = indexOnPage % cols;
  const row = Math.floor(indexOnPage / cols);
  const x = marginX + col * (CARD_W + GAP);
  const y = marginY + row * (CARD_H + GAP);
  const code = codes[i];

  doc.setDrawColor(0, 69, 165);
  doc.setLineWidth(0.35);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2.5, 2.5, "FD");

  const barcode = await barcodePng(code);
  const bw = CARD_W * 0.78;
  const bh = 14;
  const bx = x + (CARD_W - bw) / 2;
  const by = y + CARD_H * 0.42;
  doc.addImage(barcode, "PNG", bx, by, bw, bh);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(33, 37, 41);
  doc.text(code, x + CARD_W / 2, by + bh + 5, { align: "center" });
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "tarjetas-prueba.pdf");
const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync(outPath, buf);

console.log(`OK PDF ${codes.length} tarjetas, ${cols}x${rows}=${perPage}/hoja → ${outPath} (${buf.length} bytes)`);
