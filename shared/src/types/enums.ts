export enum LeagueRole {
  ADMIN = 'admin',
  PLAYER = 'player',
}

export enum EventStatus {
  SETUP = 'setup',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export enum RoundStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum MatchStatus {
  PENDING = 'pending',
  REPORTED = 'reported',
  CONFIRMED = 'confirmed',
  DISPUTED = 'disputed',
  RESOLVED = 'resolved',
}

export enum DecklistStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  LOCKED = 'locked',
}

export enum DeckZone {
  MAIN = 'main',
  SIDEBOARD = 'sideboard',
}

export enum EventFormat {
  SWISS = 'swiss',
  SEEDED_SWISS = 'seeded_swiss',
  ROUND_ROBIN = 'round_robin',
  SINGLE_ELIMINATION = 'single_elimination',
  DOUBLE_ELIMINATION = 'double_elimination',
  CUSTOM_10_PLAYER = 'custom_10_player',
}

export enum SideboardRule {
  ENTIRE_POOL = 'entire_pool',
  FIXED_15 = 'fixed_15',
  NONE = 'none',
}

export enum SchedulingType {
  FIXED_DEADLINES = 'fixed_deadlines',
  OPEN_WINDOW = 'open_window',
  WEEKLY_AUTO = 'weekly_auto',
}

export enum DeckLockingMode {
  REQUIRED_BEFORE_ROUND = 'required_before_round',
  FREE_MODIFICATION = 'free_modification',
  ADMIN_LOCKED = 'admin_locked',
}

export enum SeedingSource {
  PREVIOUS_SEASON = 'previous_season',
  PREVIOUS_EVENT = 'previous_event',
  CURRENT_SEASON = 'current_season',
  MANUAL = 'manual',
}

export enum BoosterType {
  DRAFT = 'draft',
  PLAY = 'play',
  SET = 'set',
  COLLECTOR = 'collector',
}

export enum PoolVerificationMode {
  HONOR_SYSTEM = 'honor_system',
  ADMIN_APPROVAL = 'admin_approval',
  PEER_APPROVAL = 'peer_approval',
}

export enum InviteLinkStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

export enum AcquisitionApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
