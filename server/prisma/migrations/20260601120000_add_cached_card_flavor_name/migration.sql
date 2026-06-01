-- AlterTable
ALTER TABLE "CachedCard" ADD COLUMN "flavorName" TEXT;

-- CreateIndex
CREATE INDEX "CachedCard_flavorName_idx" ON "CachedCard"("flavorName");
