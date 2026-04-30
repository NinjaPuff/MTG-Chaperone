-- CreateEnum
CREATE TYPE "LeagueRole" AS ENUM ('admin', 'player');

-- CreateEnum
CREATE TYPE "InviteLinkStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('setup', 'active', 'completed');

-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('swiss', 'seeded_swiss', 'round_robin');

-- CreateEnum
CREATE TYPE "SideboardRule" AS ENUM ('entire_pool', 'fixed_15', 'none');

-- CreateEnum
CREATE TYPE "SchedulingType" AS ENUM ('fixed_deadlines', 'open_window', 'weekly_auto');

-- CreateEnum
CREATE TYPE "DeckLockingMode" AS ENUM ('required_before_round', 'free_modification', 'admin_locked');

-- CreateEnum
CREATE TYPE "SeedingSource" AS ENUM ('previous_season', 'previous_event', 'manual');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('pending', 'reported', 'confirmed', 'disputed', 'resolved');

-- CreateEnum
CREATE TYPE "BoosterType" AS ENUM ('draft', 'play', 'set', 'collector');

-- CreateEnum
CREATE TYPE "PoolVerificationMode" AS ENUM ('honor_system', 'admin_approval', 'peer_approval');

-- CreateEnum
CREATE TYPE "AcquisitionApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "DecklistStatus" AS ENUM ('draft', 'submitted', 'locked');

-- CreateEnum
CREATE TYPE "DeckZone" AS ENUM ('main', 'sideboard');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT,
    "googleId" TEXT,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "poolVisibility" BOOLEAN NOT NULL DEFAULT true,
    "decklistVisibility" BOOLEAN NOT NULL DEFAULT true,
    "scheduleVisibility" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "role" "LeagueRole" NOT NULL DEFAULT 'player',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteLinkStatus" NOT NULL DEFAULT 'active',
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "tradingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointConfig" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "matchWinPoints" INTEGER NOT NULL DEFAULT 3,
    "matchDrawPoints" INTEGER NOT NULL DEFAULT 1,
    "matchLossPoints" INTEGER NOT NULL DEFAULT 0,
    "gameWinPoints" INTEGER NOT NULL DEFAULT 0,
    "sweepBonusPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PointConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standing" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "matchWins" INTEGER NOT NULL DEFAULT 0,
    "matchLosses" INTEGER NOT NULL DEFAULT 0,
    "matchDraws" INTEGER NOT NULL DEFAULT 0,
    "gameWins" INTEGER NOT NULL DEFAULT 0,
    "gameLosses" INTEGER NOT NULL DEFAULT 0,
    "omwPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gwPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ogwPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'setup',
    "pointMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "standingsOverride" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventConfig" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "format" "EventFormat" NOT NULL,
    "bestOfN" INTEGER NOT NULL DEFAULT 3,
    "deckCount" INTEGER NOT NULL DEFAULT 1,
    "minDeckSize" INTEGER NOT NULL DEFAULT 40,
    "sideboardRule" "SideboardRule" NOT NULL DEFAULT 'entire_pool',
    "schedulingType" "SchedulingType" NOT NULL DEFAULT 'open_window',
    "deckLockingMode" "DeckLockingMode" NOT NULL DEFAULT 'free_modification',
    "seedingSource" "SeedingSource",

    CONSTRAINT "EventConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'not_started',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundRobinSchedule" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundRobinSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPairing" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT NOT NULL,
    "eventId" TEXT,
    "roundId" TEXT,

    CONSTRAINT "ScheduledPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "status" "MatchStatus" NOT NULL DEFAULT 'pending',
    "reportedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "winnerId" TEXT,
    "isDraw" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoosterProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setReleaseName" TEXT NOT NULL,
    "boosterType" "BoosterType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoosterProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoosterSetCode" (
    "id" TEXT NOT NULL,
    "boosterProductId" TEXT NOT NULL,
    "setCode" VARCHAR(10) NOT NULL,

    CONSTRAINT "BoosterSetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "boosterProductId" TEXT NOT NULL,
    "verificationMode" "PoolVerificationMode" NOT NULL DEFAULT 'honor_system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolAcquisition" (
    "id" TEXT NOT NULL,
    "cardPoolId" TEXT NOT NULL,
    "phaseLabel" TEXT NOT NULL,
    "approvalStatus" "AcquisitionApprovalStatus" NOT NULL DEFAULT 'pending',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPoolEntry" (
    "id" TEXT NOT NULL,
    "acquisitionId" TEXT NOT NULL,
    "cachedCardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CardPoolEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decklist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "name" TEXT,
    "status" "DecklistStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecklistEntry" (
    "id" TEXT NOT NULL,
    "decklistId" TEXT NOT NULL,
    "cachedCardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "zone" "DeckZone" NOT NULL DEFAULT 'main',

    CONSTRAINT "DecklistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckUniquenessRule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "constraintType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "DeckUniquenessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedCard" (
    "scryfallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manaCost" TEXT,
    "typeLine" TEXT NOT NULL,
    "oracleText" TEXT,
    "colors" TEXT[],
    "colorIdentity" TEXT[],
    "cmc" DOUBLE PRECISION NOT NULL,
    "rarity" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "imageUris" JSONB,
    "prices" JSONB,
    "lastFetched" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CachedCard_pkey" PRIMARY KEY ("scryfallId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_userId_leagueId_key" ON "LeagueMembership"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_token_key" ON "InviteLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Season_leagueId_number_key" ON "Season"("leagueId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PointConfig_seasonId_key" ON "PointConfig"("seasonId");

-- CreateIndex
CREATE INDEX "Standing_seasonId_points_idx" ON "Standing"("seasonId", "points" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Standing_seasonId_userId_key" ON "Standing"("seasonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventConfig_eventId_key" ON "EventConfig"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundRobinSchedule_seasonId_key" ON "RoundRobinSchedule"("seasonId");

-- CreateIndex
CREATE INDEX "Match_roundId_idx" ON "Match"("roundId");

-- CreateIndex
CREATE INDEX "Match_player1Id_idx" ON "Match"("player1Id");

-- CreateIndex
CREATE INDEX "Match_player2Id_idx" ON "Match"("player2Id");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BoosterSetCode_boosterProductId_setCode_key" ON "BoosterSetCode"("boosterProductId", "setCode");

-- CreateIndex
CREATE UNIQUE INDEX "CardPool_userId_seasonId_key" ON "CardPool"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "CardPoolEntry_acquisitionId_idx" ON "CardPoolEntry"("acquisitionId");

-- CreateIndex
CREATE INDEX "Decklist_userId_eventId_roundId_idx" ON "Decklist"("userId", "eventId", "roundId");

-- CreateIndex
CREATE INDEX "DecklistEntry_decklistId_idx" ON "DecklistEntry"("decklistId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckUniquenessRule_eventId_key" ON "DeckUniquenessRule"("eventId");

-- CreateIndex
CREATE INDEX "CachedCard_setCode_idx" ON "CachedCard"("setCode");

-- CreateIndex
CREATE INDEX "CachedCard_name_idx" ON "CachedCard"("name");

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointConfig" ADD CONSTRAINT "PointConfig_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standing" ADD CONSTRAINT "Standing_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standing" ADD CONSTRAINT "Standing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventConfig" ADD CONSTRAINT "EventConfig_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundRobinSchedule" ADD CONSTRAINT "RoundRobinSchedule_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPairing" ADD CONSTRAINT "ScheduledPairing_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RoundRobinSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPairing" ADD CONSTRAINT "ScheduledPairing_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPairing" ADD CONSTRAINT "ScheduledPairing_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoosterSetCode" ADD CONSTRAINT "BoosterSetCode_boosterProductId_fkey" FOREIGN KEY ("boosterProductId") REFERENCES "BoosterProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPool" ADD CONSTRAINT "CardPool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPool" ADD CONSTRAINT "CardPool_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPool" ADD CONSTRAINT "CardPool_boosterProductId_fkey" FOREIGN KEY ("boosterProductId") REFERENCES "BoosterProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolAcquisition" ADD CONSTRAINT "PoolAcquisition_cardPoolId_fkey" FOREIGN KEY ("cardPoolId") REFERENCES "CardPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPoolEntry" ADD CONSTRAINT "CardPoolEntry_acquisitionId_fkey" FOREIGN KEY ("acquisitionId") REFERENCES "PoolAcquisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPoolEntry" ADD CONSTRAINT "CardPoolEntry_cachedCardId_fkey" FOREIGN KEY ("cachedCardId") REFERENCES "CachedCard"("scryfallId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decklist" ADD CONSTRAINT "Decklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decklist" ADD CONSTRAINT "Decklist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decklist" ADD CONSTRAINT "Decklist_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecklistEntry" ADD CONSTRAINT "DecklistEntry_decklistId_fkey" FOREIGN KEY ("decklistId") REFERENCES "Decklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecklistEntry" ADD CONSTRAINT "DecklistEntry_cachedCardId_fkey" FOREIGN KEY ("cachedCardId") REFERENCES "CachedCard"("scryfallId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckUniquenessRule" ADD CONSTRAINT "DeckUniquenessRule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
