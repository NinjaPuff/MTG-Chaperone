import {
  LeagueRole,
  EventStatus,
  RoundStatus,
  MatchStatus,
  DecklistStatus,
  DeckZone,
  EventFormat,
  SideboardRule,
  SchedulingType,
  DeckLockingMode,
  SeedingSource,
  BoosterType,
  PoolVerificationMode,
  InviteLinkStatus,
  AcquisitionApprovalStatus,
} from './enums.js';

export interface User {
  id: string;
  discordId: string | null;
  googleId: string | null;
  displayName: string;
  publicName: string | null;
  discordHandle: string | null;
  slug: string;
  avatarUrl: string | null;
  role?: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface League {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueMembership {
  id: string;
  userId: string;
  leagueId: string;
  role: LeagueRole;
  joinedAt: Date;
}

export interface InviteLink {
  id: string;
  leagueId: string;
  token: string;
  status: InviteLinkStatus;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date | null;
  createdById: string;
  createdAt: Date;
}

export interface Season {
  id: string;
  leagueId: string;
  name: string;
  number: number;
  tradingEnabled: boolean;
  isActive: boolean;
  poolVisibility: boolean;
  decklistVisibility: boolean;
  scheduleVisibility: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PointConfig {
  id: string;
  seasonId: string;
  matchWinPoints: number;
  matchDrawPoints: number;
  matchLossPoints: number;
  gameWinPoints: number;
  sweepBonusPoints: number;
}

export interface Standing {
  id: string;
  seasonId: string;
  userId: string;
  points: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  omwPercent: number;
  gwPercent: number;
  ogwPercent: number;
  updatedAt: Date;
}

export interface Event {
  id: string;
  seasonId: string;
  name: string;
  status: EventStatus;
  pointMultiplier: number;
  standingsOverride: boolean;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventConfig {
  id: string;
  eventId: string;
  format: EventFormat;
  bestOfN: number;
  deckCount: number;
  minDeckSize: number;
  sideboardRule: SideboardRule;
  schedulingType: SchedulingType;
  deckLockingMode: DeckLockingMode;
  seedingSource: SeedingSource | null;
}

export interface Round {
  id: string;
  eventId: string;
  roundNumber: number;
  status: RoundStatus;
  deadline: Date | null;
  createdAt: Date;
}

export interface Match {
  id: string;
  roundId: string;
  player1Id: string;
  player2Id: string | null;
  isBye: boolean;
  status: MatchStatus;
  reportedById: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface GameResult {
  id: string;
  matchId: string;
  gameNumber: number;
  winnerId: string | null;
  isDraw: boolean;
  notes: string | null;
}

export interface BoosterProduct {
  id: string;
  name: string;
  setReleaseName: string;
  boosterType: BoosterType;
  primarySetCode?: string | null;
  createdAt: Date;
}

export interface BoosterSetCode {
  id: string;
  boosterProductId: string;
  setCode: string;
}

export interface CardPool {
  id: string;
  userId: string;
  seasonId: string;
  boosterProductId: string;
  verificationMode: PoolVerificationMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface PoolAcquisition {
  id: string;
  cardPoolId: string;
  phaseLabel: string;
  approvalStatus: AcquisitionApprovalStatus;
  addedAt: Date;
}

export interface CardPoolEntry {
  id: string;
  acquisitionId: string;
  cachedCardId: string;
  quantity: number;
}

export interface Decklist {
  id: string;
  userId: string;
  eventId: string;
  roundId: string;
  name: string | null;
  status: DecklistStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecklistEntry {
  id: string;
  decklistId: string;
  cachedCardId: string;
  quantity: number;
  zone: DeckZone;
}

export interface CachedCard {
  scryfallId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  oracleText: string | null;
  colors: string[];
  colorIdentity: string[];
  cmc: number;
  rarity: string;
  setCode: string;
  imageUris: Record<string, string> | null;
  prices: Record<string, string | null> | null;
  lastFetched: Date;
}

export interface DeckUniquenessRule {
  id: string;
  eventId: string;
  constraintType: string;
  parameters: Record<string, unknown>;
}

export interface RoundRobinSchedule {
  id: string;
  seasonId: string;
  createdAt: Date;
}

export interface ScheduledPairing {
  id: string;
  scheduleId: string;
  player1Id: string;
  player2Id: string;
  eventId: string | null;
  roundId: string | null;
}
