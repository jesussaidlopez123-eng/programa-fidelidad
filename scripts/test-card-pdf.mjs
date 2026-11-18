/**
 * Prueba local del motor PDF (sin Next ni base de datos).
 * Uso:
 *   node scripts/test-card-pdf.mjs           # 12 tarjetas, un PDF
 *   node scripts/test-card-pdf.mjs 2000      # 2000 tarjetas en chunks de 200
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
const CARDS_PER_FILE = 200;
const BACKGROUND_ALIAS = "card-bg";

const qtyArg = Number(process.argv[2] ?? 12);
const totalCards =
  Number.isInteger(qtyArg) && qtyArg > 0 ? Math.min(qtyArg, 5000) : 12;

const cols = 2;
const rows = Math.floor((PAGE_H - MARGIN * 2 + GAP) / (CARD_H + GAP));
const perPage = cols * rows;

const gridW = cols * CARD_W + (cols - 1) * GAP;
const gridH = rows * CARD_H + (rows - 1) * GAP;
const marginX = Math.max(MARGIN, (PAGE_W - gridW) / 2);
const marginY = Math.max(MARGIN, (PAGE_H - gridH) / 2);

async function barcodeJpeg(code) {
  // PNG buffer → still embed as PNG here (Node sin canvas); scale 2 ya reduce peso.
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: code,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Mini JPEG 1×1 azul como fondo de prueba (alias reutilizado). */
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z";

async function buildChunk(codes, withBackground) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  for (let i = 0; i < codes.length; i += 1) {
    if (i > 0 && i % perPage === 0) doc.addPage();
    const indexOnPage = i % perPage;
    const col = indexOnPage % cols;
    const row = Math.floor(indexOnPage / cols);
    const x = marginX + col * (CARD_W + GAP);
    const y = marginY + row * (CARD_H + GAP);
    const code = codes[i];

    if (withBackground) {
      doc.addImage(TINY_JPEG, "JPEG", x, y, CARD_W, CARD_H, BACKGROUND_ALIAS, "FAST");
    }

    doc.setDrawColor(0, 69, 165);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    if (!withBackground) {
      doc.roundedRect(x, y, CARD_W, CARD_H, 2.5, 2.5, "FD");
    } else {
      doc.setDrawColor(180, 190, 205);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, CARD_W, CARD_H, 2.5, 2.5, "S");
      doc.setFillColor(255, 255, 255);
    }

    const barcode = await barcodeJpeg(code);
    const bw = CARD_W * 0.78;
    const bh = 14;
    const bx = x + (CARD_W - bw) / 2;
    const by = y + CARD_H * 0.42;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(bx - 2, by - 2, bw + 4, bh + 10, 1.2, 1.2, "F");
    doc.addImage(barcode, "PNG", bx, by, bw, bh);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(33, 37, 41);
    doc.text(code, x + CARD_W / 2, by + bh + 5, { align: "center" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp");
mkdirSync(outDir, { recursive: true });

const codes = Array.from({ length: totalCards }, (_, i) =>
  `CRD-${String(1 + i).padStart(6, "0")}`,
);
const totalChunks = Math.ceil(totalCards / CARDS_PER_FILE);
const withBackground = totalCards >= 50;
const started = Date.now();
let totalBytes = 0;

for (let c = 0; c < totalChunks; c += 1) {
  const slice = codes.slice(c * CARDS_PER_FILE, (c + 1) * CARDS_PER_FILE);
  const buf = await buildChunk(slice, withBackground);
  totalBytes += buf.length;
  const outPath =
    totalChunks === 1
      ? join(outDir, "tarjetas-prueba.pdf")
      : join(
          outDir,
          `tarjetas-lote-${slice[0]}-${slice[slice.length - 1]}-parte-${c + 1}-de-${totalChunks}.pdf`,
        );
  writeFileSync(outPath, buf);
  console.log(
    `OK parte ${c + 1}/${totalChunks}: ${slice.length} tarjetas → ${outPath} (${buf.length} bytes)`,
  );
}

const ms = Date.now() - started;
console.log(
  `OK total ${totalCards} tarjetas en ${totalChunks} PDF(s), ${cols}x${rows}=${perPage}/hoja, fondo=${withBackground}, ${totalBytes} bytes, ${ms} ms`,
);
