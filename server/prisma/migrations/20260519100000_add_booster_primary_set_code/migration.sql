-- AlterTable
ALTER TABLE "BoosterProduct" ADD COLUMN "primarySetCode" VARCHAR(10);

-- Backfill primarySetCode from lexicographically first set code per product
UPDATE "BoosterProduct" AS bp
SET "primarySetCode" = sub."setCode"
FROM (
  SELECT DISTINCT ON ("boosterProductId")
    "boosterProductId",
    "setCode"
  FROM "BoosterSetCode"
  ORDER BY "boosterProductId", "setCode" ASC
) AS sub
WHERE bp."id" = sub."boosterProductId";
