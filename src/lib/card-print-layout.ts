/** ISO/IEC 7810 ID-1 (tarjeta de crédito) en milímetros. */
export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;

/** A4 en milímetros. */
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;

export type CardSheetLayout = {
  cols: number;
  rows: number;
  perPage: number;
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
  cardWidth: number;
  cardHeight: number;
};

/**
 * Calcula filas/columnas que caben en A4 con márgenes y sangrado razonable para corte.
 * Prioriza 2 columnas × N filas (típico en papel calcomanía).
 */
export function computeCardSheetLayout(
  quantity = 1,
  opts?: { marginMm?: number; gapMm?: number },
): CardSheetLayout & { pages: number } {
  const marginMm = opts?.marginMm ?? 8;
  const gapMm = opts?.gapMm ?? 3;
  const usableW = PAGE_WIDTH_MM - marginMm * 2;
  const usableH = PAGE_HEIGHT_MM - marginMm * 2;

  let cols = Math.max(1, Math.floor((usableW + gapMm) / (CARD_WIDTH_MM + gapMm)));
  const rows = Math.max(1, Math.floor((usableH + gapMm) / (CARD_HEIGHT_MM + gapMm)));

  // Ajuste: máximo 2 columnas (típico en papel calcomanía ID-1).
  if (cols > 2) cols = 2;

  const gridW = cols * CARD_WIDTH_MM + (cols - 1) * gapMm;
  const gridH = rows * CARD_HEIGHT_MM + (rows - 1) * gapMm;
  const marginX = Math.max(marginMm, (PAGE_WIDTH_MM - gridW) / 2);
  const marginY = Math.max(marginMm, (PAGE_HEIGHT_MM - gridH) / 2);

  const perPage = cols * rows;
  const pages = Math.max(1, Math.ceil(quantity / perPage));

  return {
    cols,
    rows,
    perPage,
    marginX,
    marginY,
    gapX: gapMm,
    gapY: gapMm,
    cardWidth: CARD_WIDTH_MM,
    cardHeight: CARD_HEIGHT_MM,
    pages,
  };
}

export function cardPosition(
  layout: CardSheetLayout,
  indexOnPage: number,
): { x: number; y: number } {
  const col = indexOnPage % layout.cols;
  const row = Math.floor(indexOnPage / layout.cols);
  return {
    x: layout.marginX + col * (layout.cardWidth + layout.gapX),
    y: layout.marginY + row * (layout.cardHeight + layout.gapY),
  };
}
