import type { Prisma } from "@prisma/client";

export const WIPE_CONFIRMATION_PHRASE = "LIMPIAR";

export type WipeCounts = {
  rewards: number;
  payments: number;
  credits: number;
  customers: number;
  batches: number;
};

type WipeDb = Prisma.TransactionClient;

/**
 * Borra datos operativos / de ejemplo. Conserva Users, GiftTier y
 * cycle/grace/reward settings (solo resetea secuencia y fondo de tarjetas).
 * Misma lógica que `scripts/wipe-operational-data.mjs`.
 */
export async function wipeOperationalData(db: WipeDb): Promise<WipeCounts> {
  const deletedRewards = await db.reward.deleteMany({});
  const deletedPayments = await db.payment.deleteMany({});
  const deletedCredits = await db.credit.deleteMany({});
  const deletedCustomers = await db.customer.deleteMany({});
  const deletedBatches = await db.cardPrintBatch.deleteMany({});

  await db.appSettings.upsert({
    where: { id: "default" },
    update: {
      nextCardSequence: 1,
      cardBackgroundData: null,
      cardBackgroundMimeType: null,
      cardDesignId: null,
    },
    create: {
      id: "default",
      cycleDays: 7,
      graceDays: 2,
      rewardEvery: 5,
      rewardName: "Regalo 1",
      nextCardSequence: 1,
    },
  });

  return {
    rewards: deletedRewards.count,
    payments: deletedPayments.count,
    credits: deletedCredits.count,
    customers: deletedCustomers.count,
    batches: deletedBatches.count,
  };
}
