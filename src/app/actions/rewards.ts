"use server";

import { revalidatePath } from "next/cache";
import { RewardStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";

const rewardListSelect = {
  id: true,
  rewardName: true,
  status: true,
  unlockedAt: true,
  deliveredAt: true,
  giftSlot: true,
  marksRequired: true,
  photoMimeType: true,
  photoUploadedAt: true,
  unlockedByName: true,
  customer: { select: { id: true, fullName: true, barcodeId: true } },
  credit: { select: { concept: true } },
} as const;

export async function listRewards(status?: RewardStatus) {
  await requireUser(["ADMIN"]);
  return listRewardsSummary(status);
}

/** Lista premios para la tabla admin (incluye si hay foto, sin el bytea). */
export async function listRewardsSummary(status?: RewardStatus) {
  await requireUser(["ADMIN"]);
  const rewards = await prisma.reward.findMany({
    where: status ? { status } : undefined,
    orderBy: { unlockedAt: "desc" },
    select: rewardListSelect,
  });

  return rewards.map((reward) => ({
    id: reward.id,
    rewardName: reward.rewardName,
    status: reward.status,
    unlockedAt: reward.unlockedAt,
    deliveredAt: reward.deliveredAt,
    giftSlot: reward.giftSlot,
    marksRequired: reward.marksRequired,
    hasPhoto: reward.photoUploadedAt != null || reward.photoMimeType != null,
    photoUploadedAt: reward.photoUploadedAt,
    unlockedByName: reward.unlockedByName,
    customer: reward.customer,
    credit: reward.credit,
  }));
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
  revalidatePath("/customers");
  revalidatePath("/evidencias");
  return { ok: true };
}
