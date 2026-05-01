-- CreateEnum
CREATE TYPE "SiteRole" AS ENUM ('admin', 'user');

-- AlterTable: add site-wide role to User
ALTER TABLE "User" ADD COLUMN "role" "SiteRole" NOT NULL DEFAULT 'user';

-- Promote users who were league admins to site admins
UPDATE "User"
SET "role" = 'admin'
WHERE "id" IN (
  SELECT DISTINCT "userId" FROM "LeagueMembership" WHERE "role" = 'admin'
);

-- AlterTable: drop league-level role from LeagueMembership
ALTER TABLE "LeagueMembership" DROP COLUMN "role";

-- DropEnum
DROP TYPE "LeagueRole";
