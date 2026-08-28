-- Event-scoped uniqueness: one (userId, eventId, orderIndex) row.
-- Delete non-keepers (required: locked > submitted > draft-with-entries > empty,
-- then lowest roundNumber, then oldest createdAt; extra: hasEntries > empty,
-- then highest roundNumber, then newest updatedAt) before creating the unique index.
-- Do not retarget DecklistShare.decklistId; ON DELETE SET NULL remains.

WITH required_count AS (
  SELECT
    e.id AS "eventId",
    GREATEST(1, COALESCE(ec."deckCount", 1)) AS "deckCount"
  FROM "Event" e
  LEFT JOIN "EventConfig" ec ON ec."eventId" = e.id
),
ranked_required AS (
  SELECT
    d.id,
    ROW_NUMBER() OVER (
      PARTITION BY d."userId", d."eventId", d."orderIndex"
      ORDER BY
        CASE d.status
          WHEN 'locked' THEN 0
          WHEN 'submitted' THEN 1
          ELSE 2
        END,
        CASE
          WHEN d.status = 'draft' AND NOT EXISTS (
            SELECT 1 FROM "DecklistEntry" e WHERE e."decklistId" = d.id
          ) THEN 1
          ELSE 0
        END,
        r."roundNumber" ASC,
        d."createdAt" ASC
    ) AS rn
  FROM "Decklist" d
  INNER JOIN "Round" r ON r.id = d."roundId"
  INNER JOIN required_count rc ON rc."eventId" = d."eventId"
  WHERE d."orderIndex" < rc."deckCount"
),
ranked_extra AS (
  SELECT
    d.id,
    ROW_NUMBER() OVER (
      PARTITION BY d."userId", d."eventId", d."orderIndex"
      ORDER BY
        CASE
          WHEN EXISTS (
            SELECT 1 FROM "DecklistEntry" e WHERE e."decklistId" = d.id
          ) THEN 0
          ELSE 1
        END,
        r."roundNumber" DESC,
        d."updatedAt" DESC
    ) AS rn
  FROM "Decklist" d
  INNER JOIN "Round" r ON r.id = d."roundId"
  INNER JOIN required_count rc ON rc."eventId" = d."eventId"
  WHERE d."orderIndex" >= rc."deckCount"
),
losers AS (
  SELECT id FROM ranked_required WHERE rn > 1
  UNION ALL
  SELECT id FROM ranked_extra WHERE rn > 1
)
DELETE FROM "Decklist" WHERE id IN (SELECT id FROM losers);

DROP INDEX "Decklist_userId_eventId_roundId_orderIndex_key";

CREATE UNIQUE INDEX "Decklist_userId_eventId_orderIndex_key"
ON "Decklist"("userId", "eventId", "orderIndex");

CREATE INDEX "Decklist_roundId_idx" ON "Decklist"("roundId");

ALTER TABLE "Decklist" DROP CONSTRAINT "Decklist_roundId_fkey";

ALTER TABLE "Decklist" ADD CONSTRAINT "Decklist_roundId_fkey"
FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
