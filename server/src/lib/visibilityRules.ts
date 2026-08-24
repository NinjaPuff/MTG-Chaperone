export type SeasonVisibility = {
  poolVisibility: boolean;
  decklistVisibility: boolean;
  scheduleVisibility: boolean;
};

export type VisibilityViewer = {
  id: string;
  role: 'admin' | 'user';
};

function isSiteAdmin(viewer?: VisibilityViewer | null) {
  return viewer?.role === 'admin';
}

export function canViewSeasonPools(
  season: SeasonVisibility,
  viewer?: VisibilityViewer | null,
  ownerUserId?: string | null,
) {
  if (season.poolVisibility || isSiteAdmin(viewer)) {
    return true;
  }
  if (ownerUserId && viewer?.id === ownerUserId) {
    return true;
  }
  return false;
}

export function canViewPool(
  pool: { userId: string },
  season: SeasonVisibility,
  viewer?: VisibilityViewer | null,
) {
  if (season.poolVisibility || isSiteAdmin(viewer)) {
    return true;
  }
  return viewer?.id === pool.userId;
}

export function canViewSeasonDecklists(
  season: SeasonVisibility,
  viewer?: VisibilityViewer | null,
  decklistOwnerId?: string | null,
) {
  if (season.decklistVisibility || isSiteAdmin(viewer)) {
    return true;
  }
  if (decklistOwnerId && viewer?.id === decklistOwnerId) {
    return true;
  }
  return false;
}

export function canViewDecklist(
  decklist: { userId: string },
  season: SeasonVisibility,
  viewer?: VisibilityViewer | null,
) {
  if (season.decklistVisibility || isSiteAdmin(viewer)) {
    return true;
  }
  return viewer?.id === decklist.userId;
}

export function canViewFullSchedule(season: SeasonVisibility, viewer?: VisibilityViewer | null) {
  return season.scheduleVisibility || isSiteAdmin(viewer);
}

export function isPublicDecklistStatus(status: 'draft' | 'submitted' | 'locked') {
  return status === 'submitted' || status === 'locked';
}

export function isArchiveRound(
  event: { status: 'setup' | 'active' | 'completed' },
  round: { status: 'not_started' | 'in_progress' | 'completed' },
) {
  return event.status === 'completed' || round.status === 'completed';
}

export function isDecklistVisibleToViewer(
  decklist: { userId: string; status: 'draft' | 'submitted' | 'locked' },
  season: SeasonVisibility,
  viewer: VisibilityViewer | null | undefined,
  context: {
    eventStatus: 'setup' | 'active' | 'completed';
    roundStatus: 'not_started' | 'in_progress' | 'completed';
  },
) {
  const isOwnerOrAdmin = viewer?.role === 'admin' || viewer?.id === decklist.userId;
  if (isOwnerOrAdmin) {
    return true;
  }
  if (!canViewDecklist(decklist, season, viewer ?? null)) {
    return false;
  }
  if (isPublicDecklistStatus(decklist.status)) {
    return true;
  }
  return (
    decklist.status === 'draft' &&
    isArchiveRound({ status: context.eventStatus }, { status: context.roundStatus })
  );
}
