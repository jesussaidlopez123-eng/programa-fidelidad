"use server";

import { revalidatePath } from "next/cache";
import { RewardStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

export async function listRewards(status?: RewardStatus) {
  await requireUser(["ADMIN"]);
  return prisma.reward.findMany({
    where: status ? { status } : undefined,
    orderBy: { unlockedAt: "desc" },
    include: {
      customer: true,
      credit: true,
    },
  });
}

export async function deliverReward(rewardId: string) {
  await requireUser(["ADMIN"]);
  await prisma.reward.update({
    where: { id: rewardId },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });
  revalidatePath("/rewards");
  revalidatePath("/");
  revalidatePath("/asistencia");
  return { ok: true };
}
