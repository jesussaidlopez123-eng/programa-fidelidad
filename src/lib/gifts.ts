import { prisma } from "@/lib/prisma";

export type GiftTierRow = {
  id: string;
  slot: number;
  name: string;
  description: string;
  marksRequired: number | null;
};

export const DEFAULT_GIFT_TIERS: Omit<GiftTierRow, "id">[] = [
  { slot: 1, name: "Regalo 1", description: "", marksRequired: 5 },
  { slot: 2, name: "Regalo 2", description: "", marksRequired: 10 },
  { slot: 3, name: "Regalo 3", description: "", marksRequired: 15 },
];

/** Asegura los 3 slots (idempotente). Migra rewardEvery/rewardName de AppSettings al Regalo 1 si faltan. */
export async function ensureGiftTiers() {
  const existing = await prisma.giftTier.findMany({ orderBy: { slot: "asc" } });
  if (existing.length >= 3) {
    return existing;
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const gift1Marks = settings?.rewardEvery && settings.rewardEvery > 0 ? settings.rewardEvery : 5;
  const gift1Name =
    settings?.rewardName?.trim() && settings.rewardName.trim() !== "Premio 5to Abono"
      ? settings.rewardName.trim()
      : "Regalo 1";

  const defaults = [
    { slot: 1, name: gift1Name, description: "", marksRequired: gift1Marks },
    {
      slot: 2,
      name: "Regalo 2",
      description: "",
      marksRequired: gift1Marks < 10 ? 10 : gift1Marks * 2,
    },
    {
      slot: 3,
      name: "Regalo 3",
      description: "",
      marksRequired: gift1Marks < 10 ? 15 : gift1Marks * 3,
    },
  ];

  for (const tier of defaults) {
    const found = existing.find((row) => row.slot === tier.slot);
    if (found) continue;
    await prisma.giftTier.create({
      data: {
        id: `gift-tier-${tier.slot}`,
        ...tier,
      },
    });
  }

  return prisma.giftTier.findMany({ orderBy: { slot: "asc" } });
}

export async function loadGiftTiers() {
  return ensureGiftTiers();
}

export type ActiveGiftTier = GiftTierRow & { marksRequired: number };

/** Solo tiers activos (con marcas definidas), ordenados por marcas crecientes. */
export async function loadActiveGiftTiers(): Promise<ActiveGiftTier[]> {
  const tiers = await loadGiftTiers();
  const active: ActiveGiftTier[] = [];
  for (const tier of tiers) {
    if (tier.marksRequired != null && tier.marksRequired > 0) {
      active.push({ ...tier, marksRequired: tier.marksRequired });
    }
  }
  return active.sort((a, b) => a.marksRequired - b.marksRequired || a.slot - b.slot);
}

export function giftDisplayName(tier: { name: string; description: string; slot: number }) {
  const name = tier.name.trim() || `Regalo ${tier.slot}`;
  const description = tier.description.trim();
  return description ? `${name}: ${description}` : name;
}

export function nextGiftThreshold(
  streak: number,
  active: { marksRequired: number }[],
): number | null {
  if (active.length === 0) return null;
  const next = active.find((tier) => tier.marksRequired > streak);
  return next?.marksRequired ?? active[active.length - 1]?.marksRequired ?? null;
}

export function maxGiftThreshold(active: { marksRequired: number }[]): number | null {
  if (active.length === 0) return null;
  return Math.max(...active.map((tier) => tier.marksRequired));
}
