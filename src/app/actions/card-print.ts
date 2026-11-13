"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { barcodeRange, formatBarcode, parseBarcodeSequence } from "@/lib/barcode";
import { loadSettings } from "@/lib/settings";

const MAX_BATCH = 200;
const MAX_BACKGROUND_BYTES = 900 * 1024;

export type CardPrintBatchSummary = {
  id: string;
  fromNumber: number;
  toNumber: number;
  fromCode: string;
  toCode: string;
  quantity: number;
  createdAt: string;
  createdByName: string | null;
};

export type CardPrintState = {
  nextCardSequence: number;
  nextCode: string;
  hasBackground: boolean;
  backgroundMimeType: string | null;
  backgroundUrl: string | null;
  batches: CardPrintBatchSummary[];
};

async function ensureCardSequenceBaseline() {
  await loadSettings();
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { nextCardSequence: true },
  });
  if (!settings) return 1;

  const customers = await prisma.customer.findMany({ select: { barcodeId: true } });
  let maxUsed = 0;
  for (const row of customers) {
    const sequence = parseBarcodeSequence(row.barcodeId);
    if (sequence != null && sequence > maxUsed) maxUsed = sequence;
  }
  const lastBatch = await prisma.cardPrintBatch.findFirst({
    orderBy: { toNumber: "desc" },
    select: { toNumber: true },
  });
  const desired = Math.max(
    settings.nextCardSequence,
    maxUsed + 1,
    (lastBatch?.toNumber ?? 0) + 1,
    1,
  );
  if (desired > settings.nextCardSequence) {
    await prisma.appSettings.update({
      where: { id: "default" },
      data: { nextCardSequence: desired },
    });
    return desired;
  }
  return settings.nextCardSequence;
}

export async function getCardPrintState(): Promise<CardPrintState> {
  await requireUser(["ADMIN"]);
  const nextCardSequence = await ensureCardSequenceBaseline();
  const [settings, batches] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { id: "default" },
      select: {
        cardBackgroundMimeType: true,
        cardBackgroundData: true,
      },
    }),
    prisma.cardPrintBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const hasBackground = Boolean(settings?.cardBackgroundData?.length);
  return {
    nextCardSequence,
    nextCode: formatBarcode(nextCardSequence),
    hasBackground,
    backgroundMimeType: settings?.cardBackgroundMimeType ?? null,
    backgroundUrl: hasBackground ? `/api/card-background?t=${Date.now()}` : null,
    batches: batches.map((batch) => ({
      id: batch.id,
      fromNumber: batch.fromNumber,
      toNumber: batch.toNumber,
      fromCode: batch.fromCode,
      toCode: batch.toCode,
      quantity: batch.quantity,
      createdAt: batch.createdAt.toISOString(),
      createdByName: batch.createdByName,
    })),
  };
}

export type ReserveBatchResult =
  | {
      ok: true;
      codes: string[];
      fromNumber: number;
      toNumber: number;
      fromCode: string;
      toCode: string;
      quantity: number;
      batchId: string;
    }
  | { ok: false; error: string };

/** Reserva un rango secuencial CRD-###### sin crear clientes. */
export async function reserveCardPrintBatch(input: {
  quantity: number;
  startNumber?: number | null;
}): Promise<ReserveBatchResult> {
  const user = await requireUser(["ADMIN"]);
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BATCH) {
    return { ok: false, error: `La cantidad debe ser entre 1 y ${MAX_BATCH}.` };
  }

  const baseline = await ensureCardSequenceBaseline();
  const startRaw = input.startNumber;
  const fromNumber =
    startRaw == null || startRaw === undefined || Number.isNaN(Number(startRaw))
      ? baseline
      : Number(startRaw);

  if (!Number.isInteger(fromNumber) || fromNumber < 1) {
    return { ok: false, error: "El número inicial debe ser un entero positivo." };
  }

  let range: ReturnType<typeof barcodeRange>;
  try {
    range = barcodeRange(fromNumber, quantity);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Rango inválido.",
    };
  }

  const conflict = await prisma.customer.findFirst({
    where: { barcodeId: { in: range.codes } },
    select: { barcodeId: true, fullName: true },
  });
  if (conflict) {
    return {
      ok: false,
      error: `El código ${conflict.barcodeId} ya pertenece a ${conflict.fullName}. Elige otro número inicial.`,
    };
  }

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.cardPrintBatch.create({
      data: {
        fromNumber,
        toNumber: range.toNumber,
        fromCode: range.fromCode,
        toCode: range.toCode,
        quantity,
        createdByName: user.name,
      },
    });

    const settings = await tx.appSettings.findUnique({
      where: { id: "default" },
      select: { nextCardSequence: true },
    });
    const next = Math.max(settings?.nextCardSequence ?? 1, range.toNumber + 1);
    await tx.appSettings.update({
      where: { id: "default" },
      data: { nextCardSequence: next },
    });

    return created;
  });

  revalidatePath("/impresion-tarjetas");
  return {
    ok: true,
    codes: range.codes,
    fromNumber,
    toNumber: range.toNumber,
    fromCode: range.fromCode,
    toCode: range.toCode,
    quantity,
    batchId: batch.id,
  };
}

export async function saveCardBackground(input: {
  base64: string;
  mimeType?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser(["ADMIN"]);
  await loadSettings();

  const raw = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
  if (!raw) return { ok: false, error: "No se recibió la imagen." };

  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch {
    return { ok: false, error: "La imagen no es válida." };
  }

  if (buffer.length === 0) return { ok: false, error: "La imagen está vacía." };
  if (buffer.length > MAX_BACKGROUND_BYTES) {
    return { ok: false, error: "La imagen es demasiado grande (máximo ~900 KB)." };
  }

  const mime = input.mimeType?.toLowerCase() ?? "";
  const mimeType =
    mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg"
      ? mime === "image/jpg"
        ? "image/jpeg"
        : mime
      : "image/jpeg";

  await prisma.appSettings.update({
    where: { id: "default" },
    data: {
      cardBackgroundData: buffer,
      cardBackgroundMimeType: mimeType,
    },
  });

  revalidatePath("/impresion-tarjetas");
  return { ok: true };
}

export async function clearCardBackground(): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser(["ADMIN"]);
  await loadSettings();
  await prisma.appSettings.update({
    where: { id: "default" },
    data: {
      cardBackgroundData: null,
      cardBackgroundMimeType: null,
    },
  });
  revalidatePath("/impresion-tarjetas");
  return { ok: true };
}
