import { createBoosterProductService } from '../services/boosterProductService.js';
import { createCardPoolService } from '../services/cardPoolService.js';
import { createEventService } from '../services/eventService.js';
import { createInviteService } from '../services/inviteService.js';
import { createLeagueService } from '../services/leagueService.js';
import { createMatchService } from '../services/matchService.js';
import { createPairingService } from '../services/pairingService.js';
import { createRoundService } from '../services/roundService.js';
import { createSeasonService } from '../services/seasonService.js';
import { createStandingsService } from '../services/standingsService.js';
import { createScryfallService } from '../services/scryfallService.js';
import type { AppDeps } from './types.js';

export function createServices(_deps: AppDeps) {
  return {
    boosterProductService: createBoosterProductService(),
    cardPoolService: createCardPoolService(),
    eventService: createEventService(),
    inviteService: createInviteService(),
    leagueService: createLeagueService(),
    matchService: createMatchService(),
    pairingService: createPairingService(),
    roundService: createRoundService(),
    seasonService: createSeasonService(),
    standingsService: createStandingsService(),
    scryfallService: createScryfallService(),
  };
}
