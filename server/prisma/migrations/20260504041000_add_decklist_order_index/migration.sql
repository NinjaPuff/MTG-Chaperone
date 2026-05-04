-- Add deck ordering for multi-deck rounds.
ALTER TABLE "Decklist"
ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Replace non-unique lookup index with uniqueness across round deck slots.
DROP INDEX "Decklist_userId_eventId_roundId_idx";
CREATE UNIQUE INDEX "Decklist_userId_eventId_roundId_orderIndex_key"
ON "Decklist"("userId", "eventId", "roundId", "orderIndex");
