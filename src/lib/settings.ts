import { prisma } from "@/lib/prisma";

export function loadSettings() {
  return prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      dueDayOfMonth: 15,
      graceDays: 3,
      rewardEvery: 5,
      rewardName: "Premio 5to Abono",
    },
  });
}
