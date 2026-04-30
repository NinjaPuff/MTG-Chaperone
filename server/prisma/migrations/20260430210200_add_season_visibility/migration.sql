-- Add season-scoped visibility controls.
ALTER TABLE "Season"
ADD COLUMN "poolVisibility" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "decklistVisibility" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "scheduleVisibility" BOOLEAN NOT NULL DEFAULT true;
