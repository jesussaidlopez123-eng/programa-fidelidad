import { jsPDF } from "jspdf";
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  cardPosition,
  computeCardSheetLayout,
  type CardSheetLayout,
} from "@/lib/card-print-layout";

export type CardPdfOptions = {
  codes: string[];
  /** Data URL (image/jpeg|png) del fondo, o null para silueta limpia. */
  backgroundDataUrl?: string | null;
  /** Genera canvas de Code 128 (PNG data URL). */
  renderBarcode: (code: string) => Promise<string>;
};

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

/**
 * Genera un PDF A4 con siluetas ID-1 y códigos Code 128 (CRD-######).
 * Pensado para el navegador; `renderBarcode` inyecta bwip-js u otro motor.
 */
export async function buildCardBatchPdf(options: CardPdfOptions): Promise<Blob> {
  const { codes, backgroundDataUrl, renderBarcode } = options;
  if (!codes.length) throw new Error("No hay códigos para imprimir.");

  const layout = computeCardSheetLayout(codes.length);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const hasBackground = Boolean(backgroundDataUrl);

  for (let i = 0; i < codes.length; i += 1) {
    if (i > 0 && i % layout.perPage === 0) {
      doc.addPage();
    }
    const indexOnPage = i % layout.perPage;
    const { x, y } = cardPosition(layout, indexOnPage);
    const code = codes[i];

    if (hasBackground && backgroundDataUrl) {
      const format = backgroundDataUrl.includes("image/png") ? "PNG" : "JPEG";
      try {
        doc.addImage(backgroundDataUrl, format, x, y, layout.cardWidth, layout.cardHeight);
      } catch {
        // Si el fondo falla, sigue con marco vacío.
      }
    }

    drawCardFrame(doc, x, y, layout, hasBackground);

    const barcodeDataUrl = await renderBarcode(code);
    const barcodeW = layout.cardWidth * 0.78;
    const barcodeH = 14;
    const barcodeX = x + (layout.cardWidth - barcodeW) / 2;
    const barcodeY = y + layout.cardHeight * 0.42;

    // Franja clara detrás del código para legibilidad sobre fondos oscuros.
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(barcodeX - 2, barcodeY - 2, barcodeW + 4, barcodeH + 10, 1.2, 1.2, "F");

    doc.addImage(barcodeDataUrl, "PNG", barcodeX, barcodeY, barcodeW, barcodeH);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(33, 37, 41);
    doc.text(code, x + layout.cardWidth / 2, barcodeY + barcodeH + 5, {
      align: "center",
    });
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
