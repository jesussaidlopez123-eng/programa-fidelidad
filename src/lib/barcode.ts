import { normalizeBarcode } from "@/lib/utils";

/** Formato CRD-###### usado en Alta e impresión de lotes. */
export function formatBarcode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("El número de tarjeta debe ser un entero positivo.");
  }
  return `CRD-${String(sequence).padStart(6, "0")}`;
}

export function parseBarcodeSequence(barcodeId: string): number | null {
  const normalized = normalizeBarcode(barcodeId);
  const match = /^CRD-(\d+)$/.exec(normalized);
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isInteger(sequence) && sequence > 0 ? sequence : null;
}

export function barcodeRange(fromNumber: number, quantity: number): {
  codes: string[];
  fromCode: string;
  toCode: string;
  toNumber: number;
} {
  if (!Number.isInteger(fromNumber) || fromNumber < 1) {
    throw new Error("El número inicial debe ser un entero positivo.");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("La cantidad debe ser un entero positivo.");
  }
  const codes: string[] = [];
  for (let i = 0; i < quantity; i += 1) {
    codes.push(formatBarcode(fromNumber + i));
  }
  const toNumber = fromNumber + quantity - 1;
  return {
    codes,
    fromCode: codes[0],
    toCode: codes[codes.length - 1],
    toNumber,
  };
}
