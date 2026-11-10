"use server";

import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [attendancesToday, pendingRewards, streakFour, activeCredits, recentAttendances, settings] =
    await Promise.all([
      prisma.payment.count({
        where: { paymentDate: { gte: start, lte: end } },
      }),
      prisma.reward.count({ where: { status: "PENDING" } }),
      prisma.credit.findMany({
        where: { status: "ACTIVE", currentStreak: 4 },
        include: { customer: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.credit.count({ where: { status: "ACTIVE" } }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: start, lte: end } },
        orderBy: { paymentDate: "desc" },
        take: 8,
        include: { credit: { include: { customer: true } } },
      }),
      prisma.appSettings.findUnique({ where: { id: "default" } }),
    ]);

  return {
    attendancesToday,
    pendingRewards,
    streakFour,
    activeCredits,
    recentAttendances,
    settings,
  };
}
