-- AlterTable Reward: foto del ganador y metadatos del regalo
ALTER TABLE "Reward" ADD COLUMN IF NOT EXISTS "giftSlot" INTEGER,
ADD COLUMN IF NOT EXISTS "marksRequired" INTEGER,
ADD COLUMN IF NOT EXISTS "photoData" BYTEA,
ADD COLUMN IF NOT EXISTS "photoMimeType" TEXT,
ADD COLUMN IF NOT EXISTS "photoUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "unlockedByName" TEXT;

CREATE INDEX IF NOT EXISTS "Reward_unlockedAt_idx" ON "Reward"("unlockedAt");

-- CreateTable GiftTier
CREATE TABLE IF NOT EXISTS "GiftTier" (
    "id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "marksRequired" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GiftTier_slot_key" ON "GiftTier"("slot");
CREATE INDEX IF NOT EXISTS "GiftTier_marksRequired_idx" ON "GiftTier"("marksRequired");

-- Migrar la regla actual (AppSettings.rewardEvery / rewardName) al Regalo 1 si aún no hay tiers.
-- Por defecto: Regalo 1 = 5, Regalo 2 = 10, Regalo 3 = 15.
DO $$
DECLARE
  existing_tiers INTEGER;
  every_n INTEGER;
  prize_name TEXT;
BEGIN
  SELECT COUNT(*) INTO existing_tiers FROM "GiftTier";
  IF existing_tiers = 0 THEN
    SELECT COALESCE("rewardEvery", 5), COALESCE(NULLIF(TRIM("rewardName"), ''), 'Regalo 1')
      INTO every_n, prize_name
      FROM "AppSettings"
      WHERE "id" = 'default';

    IF every_n IS NULL OR every_n < 1 THEN
      every_n := 5;
    END IF;
    IF prize_name IS NULL OR prize_name = '' THEN
      prize_name := 'Regalo 1';
    END IF;

    INSERT INTO "GiftTier" ("id", "slot", "name", "description", "marksRequired", "updatedAt")
    VALUES
      ('gift-tier-1', 1, prize_name, '', every_n, CURRENT_TIMESTAMP),
      ('gift-tier-2', 2, 'Regalo 2', '', CASE WHEN every_n < 10 THEN 10 ELSE every_n * 2 END, CURRENT_TIMESTAMP),
      ('gift-tier-3', 3, 'Regalo 3', '', CASE WHEN every_n < 10 THEN 15 ELSE every_n * 3 END, CURRENT_TIMESTAMP);
  END IF;
END $$;
