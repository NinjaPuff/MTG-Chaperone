-- CreateTable
CREATE TABLE "PlayerDrop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "eventId" TEXT,
    "reason" TEXT,
    "droppedById" TEXT NOT NULL,
    "droppedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerDrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerDrop_seasonId_userId_idx" ON "PlayerDrop"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "PlayerDrop_eventId_idx" ON "PlayerDrop"("eventId");

-- AddForeignKey
ALTER TABLE "PlayerDrop" ADD CONSTRAINT "PlayerDrop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDrop" ADD CONSTRAINT "PlayerDrop_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDrop" ADD CONSTRAINT "PlayerDrop_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDrop" ADD CONSTRAINT "PlayerDrop_droppedById_fkey" FOREIGN KEY ("droppedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
