"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeBarcode } from "@/lib/utils";
import { evaluatePunctuality, punctualityLabel } from "@/lib/punctuality";
import { requireUser } from "@/lib/auth/session";
import { loadSettings } from "@/lib/settings";
import { startOfBusinessDay } from "@/lib/business-time";

export type LateDecision = "KEEP" | "RESET";

export type AttendanceLookup = {
  customer: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    barcodeId: string;
    platform: "PAYJOY" | "KREDIYA" | null;
    model: string | null;
    imei: string | null;
    tagCurp: string | null;
  };
  credit: {
    id: string;
    concept: string;
    installmentAmount: number;
    totalInstallments: number;
    paidInstallments: number;
    currentStreak: number;
    status: "ACTIVE" | "COMPLETED" | "DEFAULTED";
  } | null;
  lastPayment: { at: string; byName: string | null; isOnTime: boolean } | null;
  paidToday: boolean;
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

  const last = credit
    ? await prisma.payment.findFirst({
        where: { creditId: credit.id },
        orderBy: { paymentDate: "desc" },
        select: { paymentDate: true, receivedByName: true, isOnTime: true },
      })
    : null;

  return {
    ok: true,
    data: {
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
        barcodeId: customer.barcodeId,
        platform: customer.platform,
        model: customer.model,
        imei: customer.imei,
        tagCurp: customer.tagCurp,
      },
      credit: credit
        ? {
            id: credit.id,
            concept: credit.concept,
            installmentAmount: credit.installmentAmount,
            totalInstallments: credit.totalInstallments,
            paidInstallments: credit.paidInstallments,
            currentStreak: credit.currentStreak,
            status: credit.status,
          }
        : null,
      lastPayment: last
        ? { at: last.paymentDate.toISOString(), byName: last.receivedByName, isOnTime: last.isOnTime }
        : null,
      paidToday: !!last && last.paymentDate >= startOfBusinessDay(),
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
  allowDuplicateToday?: boolean;
}): Promise<
  | { ok: true; data: AttendanceResult }
  | { ok: false; error: string; needsLateDecision?: boolean; needsDuplicateConfirm?: boolean }
> {
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
      // Bloquea el crédito para que dos envíos simultáneos (doble clic) se registren uno a la vez.
      await tx.$queryRaw`SELECT id FROM "Credit" WHERE id = ${input.creditId} FOR UPDATE`;

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
      // totalInstallments = 0 significa crédito sin límite de abonos (altas nuevas).
      if (credit.totalInstallments > 0 && credit.paidInstallments >= credit.totalInstallments) {
        throw new Error("Este crédito ya cubrió todos sus abonos.");
      }

      if (!input.allowDuplicateToday) {
        const today = await tx.payment.findFirst({
          where: { creditId: credit.id, paymentDate: { gte: startOfBusinessDay() } },
          orderBy: { paymentDate: "desc" },
          select: { receivedByName: true },
        });
        if (today) {
          return {
            ok: false as const,
            needsDuplicateConfirm: true,
            error: `Ya hay un abono registrado hoy${today.receivedByName ? ` (${today.receivedByName})` : ""}. Confirma explícitamente para registrar otro.`,
          };
        }
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
      const creditCompleted =
        credit.totalInstallments > 0 && paidInstallments >= credit.totalInstallments;

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
  await requireUser();
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
