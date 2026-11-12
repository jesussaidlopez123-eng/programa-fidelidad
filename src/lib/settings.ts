import { prisma } from "@/lib/prisma";
import { ensureGiftTiers } from "@/lib/gifts";

export async function loadSettings() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      dueDayOfMonth: 15,
      graceDays: 3,
      rewardEvery: 5,
      rewardName: "Regalo 1",
    },
  });
  // Garantiza GiftTier en el mismo arranque (migración / seed idempotente).
  await ensureGiftTiers();
  return settings;
}
