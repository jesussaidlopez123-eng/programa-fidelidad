"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { loadActiveGiftTiers, nextGiftThreshold } from "@/lib/gifts";
import { loadSettings } from "@/lib/settings";
import { startOfBusinessDay } from "@/lib/business-time";

export async function getDashboardData() {
  await requireUser(["ADMIN"]);
  const start = startOfBusinessDay();
  const settings = await loadSettings();
  const activeGifts = await loadActiveGiftTiers();
  const firstThreshold = activeGifts[0]?.marksRequired ?? 5;
  const almostThere = Math.max(1, firstThreshold - 1);

  const [attendancesToday, pendingRewards, nearReward, activeCredits, recentAttendances, pendingPhotos] =
    await Promise.all([
      prisma.payment.count({
        where: { paymentDate: { gte: start } },
      }),
      prisma.reward.count({ where: { status: "PENDING" } }),
      prisma.credit.findMany({
        where: { status: "ACTIVE", currentStreak: almostThere },
        include: { customer: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.credit.count({ where: { status: "ACTIVE" } }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: start } },
        orderBy: { paymentDate: "desc" },
        take: 8,
        include: { credit: { include: { customer: true } } },
      }),
      prisma.reward.count({
        where: { photoUploadedAt: null, unlockedAt: { gte: start } },
      }),
    ]);

  return {
    attendancesToday,
    pendingRewards,
    pendingPhotos,
    streakNear: nearReward.map((credit) => ({
      ...credit,
      target: nextGiftThreshold(credit.currentStreak, activeGifts) ?? firstThreshold,
    })),
    almostThere,
    firstThreshold,
    activeCredits,
    recentAttendances,
    settings,
  };
}
