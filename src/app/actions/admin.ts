"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  wipeOperationalData,
  WIPE_CONFIRMATION_PHRASE,
  type WipeCounts,
} from "@/lib/wipe-operational-data";

export type WipeOpsResult =
  | { ok: true; counts: WipeCounts }
  | { ok: false; error: string };

/**
 * ADMIN only. Same deletes as `scripts/wipe-operational-data.mjs --yes`.
 * Requires typed confirmation phrase LIMPIAR.
 */
export async function wipeOperationalDataAction(
  confirmation: string,
): Promise<WipeOpsResult> {
  await requireUser(["ADMIN"]);

  if (confirmation.trim() !== WIPE_CONFIRMATION_PHRASE) {
    return {
      ok: false,
      error: `Para confirmar, escribe exactamente ${WIPE_CONFIRMATION_PHRASE}.`,
    };
  }

  try {
    const counts = await prisma.$transaction((tx) => wipeOperationalData(tx));

    revalidatePath("/");
    revalidatePath("/usuarios");
    revalidatePath("/customers");
    revalidatePath("/asistencia");
    revalidatePath("/evidencias");
    revalidatePath("/rewards");
    revalidatePath("/alta");
    revalidatePath("/impresion-tarjetas");

    return { ok: true, counts };
  } catch {
    return {
      ok: false,
      error: "No se pudieron limpiar los datos. Intenta de nuevo.",
    };
  }
}
