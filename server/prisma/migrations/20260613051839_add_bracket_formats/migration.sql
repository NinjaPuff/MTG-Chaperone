-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventFormat" ADD VALUE 'single_elimination';
ALTER TYPE "EventFormat" ADD VALUE 'double_elimination';
ALTER TYPE "EventFormat" ADD VALUE 'custom_10_player';

-- AlterTable
ALTER TABLE "EventConfig" ADD COLUMN     "grandFinalsReset" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BracketSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "bracketSide" TEXT NOT NULL,
    "bracketRound" INTEGER NOT NULL,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "matchId" TEXT,
    "winnerId" TEXT,
    "loserId" TEXT,

    CONSTRAINT "BracketSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketSlot_matchId_key" ON "BracketSlot"("matchId");

-- CreateIndex
CREATE INDEX "BracketSlot_eventId_bracketRound_idx" ON "BracketSlot"("eventId", "bracketRound");

-- CreateIndex
CREATE INDEX "BracketSlot_matchId_idx" ON "BracketSlot"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketSlot_eventId_slotKey_key" ON "BracketSlot"("eventId", "slotKey");

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
