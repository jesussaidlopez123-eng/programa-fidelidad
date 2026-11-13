"use client";

import bwipjs from "bwip-js/browser";

/** Renderiza Code 128 a data URL PNG (navegador). */
export async function renderBarcodeDataUrl(code: string): Promise<string> {
  const canvas = document.createElement("canvas");
  bwipjs.toCanvas(canvas, {
    bcid: "code128",
    text: code,
    scale: 3,
    height: 12,
    includetext: false,
    backgroundcolor: "FFFFFF",
  });
  return canvas.toDataURL("image/png");
}
