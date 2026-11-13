-- Sustituye "día de corte" mensual (dueDayOfMonth) por ciclo semanal desde el abono (cycleDays).
-- Convención: ventana = cycleDays + graceDays días después del abono ancla (día 0), plazo inclusive.
-- Defaults nuevos: 7 días de ciclo + 2 de gracia.

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "cycleDays" INTEGER NOT NULL DEFAULT 7;

-- Mapear filas existentes al nuevo default de negocio (7+2). dueDayOfMonth ya no aplica.
UPDATE "AppSettings"
SET
  "cycleDays" = 7,
  "graceDays" = 2;

ALTER TABLE "AppSettings" ALTER COLUMN "graceDays" SET DEFAULT 2;

ALTER TABLE "AppSettings" DROP COLUMN IF EXISTS "dueDayOfMonth";
