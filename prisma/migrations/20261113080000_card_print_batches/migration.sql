-- Impresión de tarjetas: secuencia, fondo y historial de lotes.
-- Seguro de re-ejecutar en deploy: solo ADD COLUMN / CREATE TABLE.

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "nextCardSequence" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "cardBackgroundData" BYTEA;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "cardBackgroundMimeType" TEXT;

CREATE TABLE IF NOT EXISTS "CardPrintBatch" (
    "id" TEXT NOT NULL,
    "fromNumber" INTEGER NOT NULL,
    "toNumber" INTEGER NOT NULL,
    "fromCode" TEXT NOT NULL,
    "toCode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByName" TEXT,

    CONSTRAINT "CardPrintBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CardPrintBatch_createdAt_idx" ON "CardPrintBatch"("createdAt");
CREATE INDEX IF NOT EXISTS "CardPrintBatch_fromNumber_toNumber_idx" ON "CardPrintBatch"("fromNumber", "toNumber");

-- Inicializa la secuencia al máximo CRD-###### existente + 1 (clientes o lotes previos).
UPDATE "AppSettings" AS s
SET "nextCardSequence" = GREATEST(
  s."nextCardSequence",
  COALESCE(
    (
      SELECT MAX(n) + 1
      FROM (
        SELECT CAST(SUBSTRING("barcodeId" FROM 5) AS INTEGER) AS n
        FROM "Customer"
        WHERE "barcodeId" ~ '^CRD-[0-9]{6,}$'
        UNION ALL
        SELECT "toNumber" AS n
        FROM "CardPrintBatch"
      ) nums
    ),
    1
  )
)
WHERE s."id" = 'default';
