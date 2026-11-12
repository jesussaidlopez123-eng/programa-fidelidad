"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { ensureGiftTiers, giftDisplayName, loadGiftTiers } from "@/lib/gifts";
import { startOfBusinessDay } from "@/lib/business-time";

export type GiftTierInput = {
  slot: number;
  name: string;
  description: string;
  marksRequired: number | null;
};

export async function listGiftTiers() {
  await requireUser(["ADMIN"]);
  return loadGiftTiers();
}

export async function saveGiftTiers(tiers: GiftTierInput[]) {
  await requireUser(["ADMIN"]);
  await ensureGiftTiers();

  if (tiers.length !== 3 || ![1, 2, 3].every((slot) => tiers.some((t) => t.slot === slot))) {
    return { ok: false as const, error: "Debes configurar exactamente Regalo 1, 2 y 3." };
  }

  const normalized = tiers
    .map((tier) => {
      const name = tier.name.trim() || `Regalo ${tier.slot}`;
      const description = tier.description.trim();
      const marks =
        tier.marksRequired == null || Number.isNaN(tier.marksRequired)
          ? null
          : Math.trunc(tier.marksRequired);
      return {
        slot: tier.slot,
        name,
        description,
        marksRequired: marks != null && marks > 0 ? marks : null,
      };
    })
    .sort((a, b) => a.slot - b.slot);

  const active = normalized.filter((tier) => tier.marksRequired != null) as Array<{
    slot: number;
    name: string;
    description: string;
    marksRequired: number;
  }>;

  for (let i = 1; i < active.length; i++) {
    if (active[i].marksRequired <= active[i - 1].marksRequired) {
      return {
        ok: false as const,
        error: "Los números de marcas deben ser enteros crecientes (ej. 5, 10, 15). Vacío = desactivado.",
      };
    }
  }

  const uniqueMarks = new Set(active.map((tier) => tier.marksRequired));
  if (uniqueMarks.size !== active.length) {
    return { ok: false as const, error: "Cada regalo activo debe tener un número de marcas distinto." };
  }

  await prisma.$transaction(
    normalized.map((tier) =>
      prisma.giftTier.upsert({
        where: { slot: tier.slot },
        update: {
          name: tier.name,
          description: tier.description,
          marksRequired: tier.marksRequired,
        },
        create: {
          id: `gift-tier-${tier.slot}`,
          slot: tier.slot,
          name: tier.name,
          description: tier.description,
          marksRequired: tier.marksRequired,
        },
      }),
    ),
  );

  // Mantener AppSettings alineado con el primer regalo activo (compatibilidad / dashboard legacy).
  const first = active[0];
  if (first) {
    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: { rewardEvery: first.marksRequired, rewardName: giftDisplayName(first) },
      create: {
        id: "default",
        dueDayOfMonth: 15,
        graceDays: 3,
        rewardEvery: first.marksRequired,
        rewardName: giftDisplayName(first),
      },
    });
  }

  revalidatePath("/rewards");
  revalidatePath("/asistencia");
  revalidatePath("/");
  revalidatePath("/evidencias");
  return { ok: true as const };
}

export async function listPendingPhotoRewards() {
  await requireUser();
  const since = startOfBusinessDay();
  return prisma.reward.findMany({
    where: {
      photoUploadedAt: null,
      unlockedAt: { gte: since },
    },
    orderBy: { unlockedAt: "desc" },
    select: {
      id: true,
      rewardName: true,
      unlockedAt: true,
      giftSlot: true,
      marksRequired: true,
      unlockedByName: true,
      customer: { select: { id: true, fullName: true, barcodeId: true } },
      credit: { select: { id: true, concept: true } },
    },
  });
}

export async function countPendingPhotoRewards() {
  await requireUser();
  const since = startOfBusinessDay();
  return prisma.reward.count({
    where: {
      photoUploadedAt: null,
      unlockedAt: { gte: since },
    },
  });
}

const MAX_PHOTO_BYTES = 450 * 1024;

export async function uploadRewardPhoto(input: {
  rewardId: string;
  base64: string;
  mimeType?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const rewardId = input.rewardId?.trim();
  if (!rewardId) return { ok: false, error: "Falta el premio." };

  const raw = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
  if (!raw) return { ok: false, error: "No se recibió la foto." };

  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch {
    return { ok: false, error: "La foto no es válida." };
  }

  if (buffer.length === 0) return { ok: false, error: "La foto está vacía." };
  if (buffer.length > MAX_PHOTO_BYTES) {
    return { ok: false, error: "La foto es demasiado grande (máximo ~300 KB comprimidos)." };
  }

  const mimeType = input.mimeType?.startsWith("image/") ? input.mimeType : "image/jpeg";

  try {
    await prisma.reward.update({
      where: { id: rewardId },
      data: {
        photoData: buffer,
        photoMimeType: mimeType,
        photoUploadedAt: new Date(),
      },
    });
  } catch {
    return { ok: false, error: "No se encontró el premio o no se pudo guardar la foto." };
  }

  revalidatePath("/evidencias");
  revalidatePath("/rewards");
  revalidatePath("/customers");
  revalidatePath("/asistencia");
  return { ok: true };
}
