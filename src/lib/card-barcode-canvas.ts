"use client";

import bwipjs from "bwip-js/browser";

/**
 * Renderiza Code 128 a data URL JPEG (navegador).
 * Escala 2 + JPEG mantiene legibilidad de impresión y reduce mucho el peso del PDF
 * frente a PNG scale 3 (crítico en lotes de miles de etiquetas).
 */
export async function renderBarcodeDataUrl(code: string): Promise<string> {
  const canvas = document.createElement("canvas");
  bwipjs.toCanvas(canvas, {
    bcid: "code128",
    text: code,
    scale: 2,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  return canvas.toDataURL("image/jpeg", 0.82);
}
