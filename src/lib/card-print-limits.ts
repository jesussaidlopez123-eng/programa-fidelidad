/** Límite de tarjetas por lote reservado / generado. */
export const MAX_CARD_BATCH = 2000;

/**
 * Tarjetas por archivo PDF. Lotes grandes se parten en varios PDFs
 * para evitar memoria/tiempo excesivos en el navegador (jsPDF).
 */
export const CARDS_PER_PDF_FILE = 200;
