import { prisma } from "@/lib/prisma";
import { ensureGiftTiers } from "@/lib/gifts";

export async function loadSettings() {
  const settings = await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      cycleDays: 7,
      graceDays: 2,
      rewardEvery: 5,
      rewardName: "Regalo 1",
    },
  });
  // Garantiza GiftTier en el mismo arranque (migración / seed idempotente).
  await ensureGiftTiers();
  return settings;
}
