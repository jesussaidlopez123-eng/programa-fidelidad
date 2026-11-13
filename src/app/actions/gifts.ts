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

  if (tiers.length !== 3 || ![1, 2, 3].every((slot) => tiers.some((t) => Number(t.slot) === slot))) {
    return { ok: false as const, error: "Debes configurar exactamente Regalo 1, 2 y 3." };
  }

  try {
    await ensureGiftTiers();
  } catch (error) {
    return missingGiftTierResult(error);
  }

  const normalized = tiers
    .map((tier) => {
      const slot = Number(tier.slot);
      const name = String(tier.name ?? "").trim() || `Regalo ${slot}`;
      const description = String(tier.description ?? "").trim();
      const rawMarks = tier.marksRequired == null ? null : Number(tier.marksRequired);
      const marks = rawMarks == null || Number.isNaN(rawMarks) ? null : Math.trunc(rawMarks);
      return {
        slot,
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

  try {
    // Upserts secuenciales (sin $transaction) para ir bien con el pooler de Supabase/pgbouncer.
    for (const tier of normalized) {
      await prisma.giftTier.upsert({
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
      });
    }
  } catch (error) {
    return missingGiftTierResult(error);
  }

  // Mantener AppSettings alineado con el primer regalo activo (compatibilidad / dashboard legacy).
  const first = active[0];
  if (first) {
    await prisma.appSettings.upsert({
      where: { id: "default" },
      update: { rewardEvery: first.marksRequired, rewardName: giftDisplayName(first) },
      create: {
        id: "default",
        cycleDays: 7,
        graceDays: 2,
        rewardEvery: first.marksRequired,
        rewardName: giftDisplayName(first),
      },
    });
  }

  const saved = await prisma.giftTier.findMany({
    orderBy: { slot: "asc" },
    select: { slot: true, name: true, description: true, marksRequired: true },
  });

  revalidatePath("/rewards");
  revalidatePath("/asistencia");
  revalidatePath("/");
  revalidatePath("/evidencias");
  return { ok: true as const, tiers: saved };
}

function missingGiftTierResult(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  if (code === "P2021") {
    return {
      ok: false as const,
      error:
        "Falta la tabla GiftTier en la base. En Vercel haz Redeploy para aplicar la migración de regalos (o ejecuta `npx prisma migrate deploy`).",
    };
  }
  console.error("[saveGiftTiers]", error);
  return {
    ok: false as const,
    error: "No se pudo guardar la configuración de regalos. Intenta de nuevo.",
  };
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
