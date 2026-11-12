-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('PAYJOY', 'KREDIYA');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "imei" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "platform" "Platform",
ADD COLUMN     "tagCurp" TEXT;

-- CreateIndex
CREATE INDEX "Customer_imei_idx" ON "Customer"("imei");
