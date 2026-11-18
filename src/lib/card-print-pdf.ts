import { jsPDF } from "jspdf";
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  cardPosition,
  computeCardSheetLayout,
  type CardSheetLayout,
} from "@/lib/card-print-layout";
import { CARDS_PER_PDF_FILE } from "@/lib/card-print-limits";
import {
  CREDICEL_LOGO_HEIGHT_MM,
  CREDICEL_LOGO_MARGIN_MM,
  CREDICEL_LOGO_PDF_ALIAS,
  CREDICEL_LOGO_WIDTH_MM,
  loadCredicelLogoDataUrl,
} from "@/lib/credicel-logo";

export type CardPdfOptions = {
  codes: string[];
  /** Data URL (image/jpeg|png) del fondo, o null para silueta limpia. */
  backgroundDataUrl?: string | null;
  /** Data URL PNG del logo CREDICEL (si se omite, se carga desde /credicel-logo-card.png). */
  logoDataUrl?: string | null;
  /** Genera canvas de Code 128 (data URL). */
  renderBarcode: (code: string) => Promise<string>;
  /** Progreso 0…codes.length (opcional). */
  onProgress?: (done: number, total: number) => void;
  /** Tarjetas por archivo PDF (por defecto CARDS_PER_PDF_FILE). */
  cardsPerFile?: number;
};

export type CardPdfChunk = {
  blob: Blob;
  fromCode: string;
  toCode: string;
  index: number;
  totalChunks: number;
  quantity: number;
};

const BACKGROUND_ALIAS = "card-bg";

function drawCardFrame(
  doc: jsPDF,
  x: number,
  y: number,
  layout: CardSheetLayout,
  hasBackground: boolean,
) {
  if (!hasBackground) {
    doc.setDrawColor(0, 69, 165);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, layout.cardWidth, layout.cardHeight, 2.5, 2.5, "FD");
  } else {
    doc.setDrawColor(180, 190, 205);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, layout.cardWidth, layout.cardHeight, 2.5, 2.5, "S");
  }
}

function yieldToUi() {
  return new Promise<void>((resolve) => {
    if (typeof setTimeout === "function") {
      setTimeout(resolve, 0);
    } else {
      resolve();
    }
  });
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.includes("image/png") ? "PNG" : "JPEG";
}

/**
 * Genera un único PDF A4 con siluetas ID-1 y códigos Code 128 (CRD-######).
 * Para lotes grandes preferir `forEachCardBatchPdfChunk` (varios archivos).
 * Pensado para el navegador; `renderBarcode` inyecta bwip-js u otro motor.
 */
export async function buildCardBatchPdf(options: CardPdfOptions): Promise<Blob> {
  if (!options.codes.length) throw new Error("No hay códigos para imprimir.");
  return buildOnePdfDocument(options.codes, options);
}

/**
 * Genera y entrega cada PDF del lote de inmediato (no acumula Blobs en memoria).
 * Un lote de 2000 con cardsPerFile=200 → 10 archivos.
 */
export async function forEachCardBatchPdfChunk(
  options: CardPdfOptions,
  onChunk: (chunk: CardPdfChunk) => void | Promise<void>,
): Promise<{ totalChunks: number; quantity: number }> {
  const { codes } = options;
  if (!codes.length) throw new Error("No hay códigos para imprimir.");

  const perFile = Math.max(1, options.cardsPerFile ?? CARDS_PER_PDF_FILE);
  const totalChunks = Math.ceil(codes.length / perFile);
  let doneGlobal = 0;

  for (let c = 0; c < totalChunks; c += 1) {
    const slice = codes.slice(c * perFile, (c + 1) * perFile);
    const blob = await buildOnePdfDocument(slice, {
      ...options,
      onProgress: (doneInChunk) => {
        options.onProgress?.(doneGlobal + doneInChunk, codes.length);
      },
    });
    doneGlobal += slice.length;
    options.onProgress?.(doneGlobal, codes.length);

    await onChunk({
      blob,
      fromCode: slice[0],
      toCode: slice[slice.length - 1],
      index: c + 1,
      totalChunks,
      quantity: slice.length,
    });

    await yieldToUi();
  }

  return { totalChunks, quantity: codes.length };
}

/** @deprecated Preferir forEachCardBatchPdfChunk para lotes grandes. */
export async function buildCardBatchPdfChunks(
  options: CardPdfOptions,
): Promise<CardPdfChunk[]> {
  const chunks: CardPdfChunk[] = [];
  await forEachCardBatchPdfChunk(options, (chunk) => {
    chunks.push(chunk);
  });
  return chunks;
}

async function buildOnePdfDocument(
  codes: string[],
  options: Omit<CardPdfOptions, "codes" | "cardsPerFile">,
): Promise<Blob> {
  const { backgroundDataUrl, renderBarcode, onProgress } = options;
  const layout = computeCardSheetLayout(codes.length);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const hasBackground = Boolean(backgroundDataUrl);
  const bgFormat = backgroundDataUrl
    ? imageFormatFromDataUrl(backgroundDataUrl)
    : "JPEG";

  const logoDataUrl =
    options.logoDataUrl === null
      ? null
      : options.logoDataUrl ?? (await loadCredicelLogoDataUrl());

  for (let i = 0; i < codes.length; i += 1) {
    if (i > 0 && i % layout.perPage === 0) {
      doc.addPage();
      // Ceder el hilo entre hojas para no congelar la UI en lotes grandes.
      await yieldToUi();
    }
    const indexOnPage = i % layout.perPage;
    const { x, y } = cardPosition(layout, indexOnPage);
    const code = codes[i];

    if (hasBackground && backgroundDataUrl) {
      try {
        doc.addImage(
          backgroundDataUrl,
          bgFormat,
          x,
          y,
          layout.cardWidth,
          layout.cardHeight,
          BACKGROUND_ALIAS,
          "FAST",
        );
      } catch {
        // Si el fondo falla, sigue con marco vacío.
      }
    }

    drawCardFrame(doc, x, y, layout, hasBackground);

    // Logo CREDICEL pequeño arriba-derecha (fondo transparente).
    if (logoDataUrl) {
      const logoX = x + layout.cardWidth - CREDICEL_LOGO_WIDTH_MM - CREDICEL_LOGO_MARGIN_MM;
      const logoY = y + CREDICEL_LOGO_MARGIN_MM;
      try {
        doc.addImage(
          logoDataUrl,
          "PNG",
          logoX,
          logoY,
          CREDICEL_LOGO_WIDTH_MM,
          CREDICEL_LOGO_HEIGHT_MM,
          CREDICEL_LOGO_PDF_ALIAS,
          "FAST",
        );
      } catch {
        // Si el logo falla, la tarjeta sigue imprimible.
      }
    }

    const barcodeDataUrl = await renderBarcode(code);
    const barcodeFormat = imageFormatFromDataUrl(barcodeDataUrl);
    const barcodeW = layout.cardWidth * 0.78;
    const barcodeH = 14;
    const barcodeX = x + (layout.cardWidth - barcodeW) / 2;
    const barcodeY = y + layout.cardHeight * 0.42;

    // Franja clara detrás del código para legibilidad sobre fondos oscuros.
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(barcodeX - 2, barcodeY - 2, barcodeW + 4, barcodeH + 10, 1.2, 1.2, "F");

    doc.addImage(barcodeDataUrl, barcodeFormat, barcodeX, barcodeY, barcodeW, barcodeH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(33, 37, 41);
    doc.text(code, x + layout.cardWidth / 2, barcodeY + barcodeH + 5, {
      align: "center",
    });

    onProgress?.(i + 1, codes.length);
  }

  return doc.output("blob");
}

export function suggestLayoutSummary(quantity: number) {
  const layout = computeCardSheetLayout(quantity);
  return {
    ...layout,
    cardLabel: `${CARD_WIDTH_MM}×${CARD_HEIGHT_MM} mm (ISO/IEC 7810 ID-1)`,
  };
}

/** Descarga un Blob; retorna una promesa que espera un breve delay (multi-file). */
export function downloadBlob(blob: Blob, filename: string, delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    const run = () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revocar tras un instante para que el navegador alcance a iniciar la descarga.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    };
    if (delayMs > 0) setTimeout(run, delayMs);
    else run();
  });
}
