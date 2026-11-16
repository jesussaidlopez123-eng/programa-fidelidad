-- Diseño activo de impresión de tarjetas (id predefinido o "custom").
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "cardDesignId" TEXT;
