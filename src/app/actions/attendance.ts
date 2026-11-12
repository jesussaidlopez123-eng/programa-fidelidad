"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeBarcode } from "@/lib/utils";
import { evaluatePunctuality, punctualityLabel } from "@/lib/punctuality";
import { requireUser } from "@/lib/auth/session";
import { loadSettings } from "@/lib/settings";

export type LateDecision = "KEEP" | "RESET";

export type AttendanceLookup = {
  customer: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    barcodeId: string;
  };
  credit: {
    id: string;
    concept: string;
    totalInstallments: number;
    paidInstallments: number;
    currentStreak: number;
    status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  } | null;
  punctuality: {
    isOnTime: boolean;
    label: string;
    dueDayOfMonth: number;
    graceDays: number;
  };
};

export type AttendanceResult = {
  ok: true;
  isOnTime: boolean;
  currentStreak: number;
  paidInstallments: number;
  totalInstallments: number;
  creditCompleted: boolean;
  rewardUnlocked: boolean;
  rewardId: string | null;
  rewardName: string | null;
  notes: string;
};

export async function lookupByBarcode(rawBarcode: string): Promise<
  { ok: true; data: AttendanceLookup } | { ok: false; error: string }
> {
  await requireUser();
  const barcodeId = normalizeBarcode(rawBarcode);
  if (!barcodeId) {
    return { ok: false, error: "Escribe o escanea un código de barras." };
  }

  const customer = await prisma.customer.findUnique({
    where: { barcodeId },
    include: {
      credits: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    return { ok: false, error: `No hay cliente con el código ${barcodeId}.` };
  }

  const credit =
    customer.credits.find((item) => item.status === "ACTIVE") ?? customer.credits[0] ?? null;

  const settings = await loadSettings();
  const punctuality = evaluatePunctuality(new Date(), settings);

  return {
    ok: true,
    data: {
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        barcodeId: customer.barcodeId,
      },
      credit: credit
        ? {
            id: credit.id,
            concept: credit.concept,
            totalInstallments: credit.totalInstallments,
            paidInstallments: credit.paidInstallments,
            currentStreak: credit.currentStreak,
            status: credit.status,
          }
        : null,
      punctuality: {
        isOnTime: punctuality.isOnTime,
        label: punctualityLabel(punctuality),
        dueDayOfMonth: settings.dueDayOfMonth,
        graceDays: settings.graceDays,
      },
    },
  };
}

export async function registerAttendance(input: {
  creditId: string;
  lateDecision?: LateDecision;
}): Promise<{ ok: true; data: AttendanceResult } | { ok: false; error: string; needsLateDecision?: boolean }> {
  const user = await requireUser();
  const settings = await loadSettings();
  const punctuality = evaluatePunctuality(new Date(), settings);

  if (!punctuality.isOnTime && !input.lateDecision) {
    return {
      ok: false,
      error: "El abono es tardío. Elige si conservas o reinicias la racha.",
      needsLateDecision: true,
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.credit.findUnique({
        where: { id: input.creditId },
        include: { customer: true },
      });

      if (!credit) {
        throw new Error("No se encontró el crédito.");
      }
      if (credit.status !== "ACTIVE") {
        throw new Error("Este crédito ya no está activo.");
      }
      if (credit.paidInstallments >= credit.totalInstallments) {
        throw new Error("Este crédito ya cubrió todos sus abonos.");
      }

      let streak = credit.currentStreak;
      let rewardUnlocked = false;
      let rewardId: string | null = null;
      let rewardName: string | null = null;
      let notes: string;

      if (punctuality.isOnTime) {
        streak += 1;
        notes = "Abono puntual";
        if (streak >= settings.rewardEvery) {
          const reward = await tx.reward.create({
            data: {
              customerId: credit.customerId,
              creditId: credit.id,
              rewardName: settings.rewardName,
              status: "PENDING",
            },
          });
          rewardUnlocked = true;
          rewardId = reward.id;
          rewardName = reward.rewardName;
          streak = 0;
          notes = `Abono puntual · ${settings.rewardName} desbloqueado`;
        }
      } else if (input.lateDecision === "RESET") {
        streak = 0;
        notes = "Abono tardío · racha reiniciada";
      } else {
        notes = "Abono tardío · racha conservada (sin incremento)";
      }

      const paidInstallments = credit.paidInstallments + 1;
      const creditCompleted = paidInstallments >= credit.totalInstallments;

      await tx.payment.create({
        data: {
          creditId: credit.id,
          amount: credit.installmentAmount,
          isOnTime: punctuality.isOnTime,
          streakCountAfterPayment: streak,
          notes,
          receivedById: user.id,
          receivedByName: user.name,
        },
      });

      await tx.credit.update({
        where: { id: credit.id },
        data: {
          currentStreak: streak,
          paidInstallments,
          status: creditCompleted ? "COMPLETED" : "ACTIVE",
        },
      });

      return {
        ok: true as const,
        data: {
          ok: true as const,
          isOnTime: punctuality.isOnTime,
          currentStreak: streak,
          paidInstallments,
          totalInstallments: credit.totalInstallments,
          creditCompleted,
          rewardUnlocked,
          rewardId,
          rewardName,
          notes,
        },
      };
    });

    revalidatePath("/");
    revalidatePath("/asistencia");
    revalidatePath("/customers");
    revalidatePath("/rewards");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la asistencia.";
    return { ok: false, error: message };
  }
}

export async function markRewardDelivered(rewardId: string) {
  await requireUser(["ADMIN"]);
  await prisma.reward.update({
    where: { id: rewardId },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });
  revalidatePath("/");
  revalidatePath("/rewards");
  revalidatePath("/asistencia");
  return { ok: true };
}
